import re
import logging
from typing import List, Dict, Any, Optional, Tuple
from uuid import UUID

from postgrest.exceptions import APIError

from app.core.config import settings
from app.services.supabase_service import supabase_service
from app.services.gemini_service import gemini_service
from app.services.pdf_service import pdf_service

logger = logging.getLogger("automotive_ai.document_processor")


class DocumentProcessingService:
    """
    Service responsible for retrieving stored PDF brochures, extracting text page-by-page,
    performing sentence-aware text chunking with overlap, generating 768-dimensional Gemini
    vector embeddings in batches, and persisting chunks to the Supabase PostgreSQL vector store.
    """

    def __init__(
        self,
        target_chunk_size: int = 1000,
        chunk_overlap: int = 150,
        batch_size: int = 10,
    ) -> None:
        self.default_chunk_size = target_chunk_size
        self.default_chunk_overlap = chunk_overlap
        self.batch_size = batch_size

    @staticmethod
    def split_page_into_sentences(text: str, max_sentence_len: int = 1000) -> List[str]:
        """
        Splits a page's text into discrete sentence units without cutting across numbers,
        abbreviations, or bullet points. If an individual sentence/table row exceeds
        max_sentence_len, it is cleanly broken on word boundaries.
        """
        if not text or not text.strip():
            return []

        # Split on double newline (paragraphs) first
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        sentences: List[str] = []

        for para in paragraphs:
            lines = para.split("\n")
            for line in lines:
                line = line.strip()
                if not line:
                    continue

                # Split line on terminal punctuation followed by space and capital/digit/quote
                line_sentences = re.split(r'(?<=[.!?])\s+(?=[A-Z0-9"\'(])', line)
                for s in line_sentences:
                    s = s.strip()
                    if not s:
                        continue

                    # If a single sentence or unpunctuated specification line exceeds max_sentence_len,
                    # break it cleanly on word boundaries
                    if len(s) > max_sentence_len:
                        words = s.split(" ")
                        cur: List[str] = []
                        cur_len = 0
                        for w in words:
                            if cur_len + len(w) + 1 > max_sentence_len and cur:
                                sentences.append(" ".join(cur))
                                cur = [w]
                                cur_len = len(w)
                            else:
                                cur.append(w)
                                cur_len += len(w) + 1
                        if cur:
                            sentences.append(" ".join(cur))
                    else:
                        sentences.append(s)

        return sentences

    def chunk_sentences(
        self,
        sentences: List[str],
        page_number: int,
        target_size: int = 1000,
        overlap_size: int = 150,
    ) -> List[Dict[str, Any]]:
        """
        Groups discrete sentences into chunks targeting approximately target_size characters
        with approximately overlap_size characters of overlap. Never splits inside sentences.
        """
        if not sentences:
            return []

        page_chunks: List[Dict[str, Any]] = []
        current_sentences: List[str] = []
        current_len = 0

        for s in sentences:
            # If adding this sentence exceeds target size, emit current chunk
            if current_sentences and (current_len + len(s) + 1 > target_size):
                chunk_str = " ".join(current_sentences).strip()
                if chunk_str:
                    page_chunks.append({
                        "content": chunk_str,
                        "page_number": page_number,
                        "char_count": len(chunk_str),
                        "word_count": len(chunk_str.split()),
                    })

                # Calculate overlap by taking sentences from the end of the current chunk
                overlap_sentences: List[str] = []
                overlap_len = 0
                for prev_s in reversed(current_sentences):
                    overlap_sentences.insert(0, prev_s)
                    overlap_len += len(prev_s) + 1
                    if overlap_len >= overlap_size:
                        break

                # Ensure forward progress: do not overlap 100% of the sentences if multiple exist
                if len(overlap_sentences) >= len(current_sentences) and len(current_sentences) > 1:
                    overlap_sentences = overlap_sentences[1:]

                current_sentences = list(overlap_sentences)
                current_len = sum(len(x) + 1 for x in current_sentences)

            current_sentences.append(s)
            current_len += len(s) + 1

        # Emit remaining sentences as the final chunk of the page
        if current_sentences:
            chunk_str = " ".join(current_sentences).strip()
            if chunk_str:
                page_chunks.append({
                    "content": chunk_str,
                    "page_number": page_number,
                    "char_count": len(chunk_str),
                    "word_count": len(chunk_str.split()),
                })

        return page_chunks

    def chunk_document_pages(
        self,
        pages: List[Dict[str, Any]],
        target_size: Optional[int] = None,
        overlap_size: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        """
        Iterates over all extracted pages of a document and generates sequential chunks,
        preserving the exact page_number for every chunk.
        """
        effective_target = target_size or self.default_chunk_size
        effective_overlap = overlap_size or self.default_chunk_overlap

        all_chunks: List[Dict[str, Any]] = []
        global_chunk_index = 0

        for page in pages:
            page_num = page.get("page_number", 1)
            raw_text = page.get("text", "")
            if not raw_text or not raw_text.strip():
                continue

            sentences = self.split_page_into_sentences(raw_text, max_sentence_len=effective_target)
            chunks = self.chunk_sentences(
                sentences=sentences,
                page_number=page_num,
                target_size=effective_target,
                overlap_size=effective_overlap,
            )

            for chunk in chunks:
                chunk["chunk_index"] = global_chunk_index
                all_chunks.append(chunk)
                global_chunk_index += 1

        return all_chunks

    def process_document(
        self,
        document_id: UUID,
        target_chunk_size: Optional[int] = None,
        chunk_overlap: Optional[int] = None,
        model: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Full orchestration pipeline for Phase 3 – Step 4:
        1. Retrieves document metadata from Supabase 'documents' table.
        2. Sets document status to 'processing'.
        3. Downloads PDF from private Supabase Storage bucket 'automotive-brochures'.
        4. Extracts text page-by-page preserving page numbers.
        5. Performs sentence-aware chunking targeting ~1000 chars with ~150 chars overlap.
        6. Generates 768-dimensional Gemini vector embeddings in batches.
        7. Safely removes any existing chunks for this document to prevent duplicates.
        8. Stores chunks, vector embeddings, and metadata in Supabase 'document_chunks'.
        9. Sets document status to 'completed'.
        """
        client = supabase_service.client
        doc_id_str = str(document_id)

        # 1. Fetch document record
        try:
            res = client.table("documents").select("*").eq("id", doc_id_str).execute()
        except Exception as exc:
            logger.error("Failed to query documents table for ID %s: %s", doc_id_str, str(exc))
            raise RuntimeError(f"Database error while querying document {doc_id_str}") from exc

        if not res.data or len(res.data) == 0:
            raise ValueError(f"Document with ID {doc_id_str} was not found.")

        doc_record = res.data[0]
        file_name = doc_record.get("file_name", "unknown.pdf")
        storage_path = doc_record.get("storage_path")
        vehicle_id = doc_record.get("vehicle_id")

        if not storage_path:
            raise ValueError(f"Document {doc_id_str} has no storage_path registered.")

        # 2. Mark document as 'processing'
        try:
            client.table("documents").update({"processing_status": "processing"}).eq("id", doc_id_str).execute()
        except Exception as exc:
            logger.warning("Could not update document status to 'processing': %s", str(exc))

        try:
            # 3. Download original PDF from Supabase Storage
            logger.info("Downloading PDF from storage bucket '%s': %s", settings.SUPABASE_STORAGE_BUCKET, storage_path)
            try:
                file_bytes = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET).download(storage_path)
            except Exception as exc:
                logger.error("Failed to download PDF '%s' from storage: %s", storage_path, str(exc))
                raise RuntimeError(f"Unable to retrieve file '{storage_path}' from storage.") from exc

            # 4. Extract text page-by-page
            total_pages, extracted_pages = pdf_service.extract_text_by_page(file_bytes)
            if not extracted_pages:
                raise ValueError(f"Document '{file_name}' contains no extractable text.")

            # 5. Chunk text preserving page numbers
            chunks = self.chunk_document_pages(
                pages=extracted_pages,
                target_size=target_chunk_size,
                overlap_size=chunk_overlap,
            )
            if not chunks:
                raise ValueError(f"No valid text chunks could be formed for document '{file_name}'.")

            logger.info(
                "Document %s: Generated %d chunks across %d pages.",
                doc_id_str,
                len(chunks),
                total_pages,
            )

            # 6. Generate 768-dimensional Gemini vector embeddings in batches
            chunk_contents = [c["content"] for c in chunks]
            embeddings = gemini_service.embed_batch(
                texts=chunk_contents,
                model=model,
                batch_size=self.batch_size,
            )

            if len(embeddings) != len(chunks):
                raise RuntimeError(
                    f"Embedding count mismatch: generated {len(embeddings)} embeddings for {len(chunks)} chunks"
                )

            # 7. Safe Deduplication Strategy: Delete existing chunks for this document before inserting
            logger.info("Purging any existing chunks for document %s to prevent duplicate records.", doc_id_str)
            try:
                client.table("document_chunks").delete().eq("document_id", doc_id_str).execute()
            except Exception as exc:
                logger.warning("Notice while purging existing chunks for document %s: %s", doc_id_str, str(exc))

            # 8. Build records for document_chunks table matching exact schema
            db_records: List[Dict[str, Any]] = []
            for chunk, emb in zip(chunks, embeddings):
                record = {
                    "document_id": doc_id_str,
                    "chunk_index": chunk["chunk_index"],
                    "content": chunk["content"],
                    "page_number": chunk["page_number"],
                    "embedding": emb,  # List of 768 floats for pgvector VECTOR(768)
                    "metadata": {
                        "page_number": chunk["page_number"],
                        "chunk_index": chunk["chunk_index"],
                        "char_count": chunk["char_count"],
                        "word_count": chunk["word_count"],
                        "file_name": file_name,
                        "storage_path": storage_path,
                    },
                }
                if vehicle_id:
                    record["vehicle_id"] = str(vehicle_id)

                db_records.append(record)

            # 9. Insert records into document_chunks in batches of 50
            insert_batch_size = 50
            total_inserted = 0
            for i in range(0, len(db_records), insert_batch_size):
                sub_batch = db_records[i : i + insert_batch_size]
                res_ins = client.table("document_chunks").insert(sub_batch).execute()
                total_inserted += len(res_ins.data) if res_ins.data else len(sub_batch)

            logger.info(
                "Document %s: Successfully inserted %d chunks into 'document_chunks'.",
                doc_id_str,
                total_inserted,
            )

            # 10. Mark document status as 'completed'
            client.table("documents").update({
                "processing_status": "completed",
                "total_pages": total_pages,
            }).eq("id", doc_id_str).execute()

            # 11. Prepare sample previews for response
            sample_chunks = [
                {
                    "chunk_index": c["chunk_index"],
                    "page_number": c["page_number"],
                    "char_count": c["char_count"],
                    "content_preview": c["content"][:180] + ("..." if len(c["content"]) > 180 else ""),
                }
                for c in chunks[:3]
            ]

            return {
                "document_id": doc_id_str,
                "file_name": file_name,
                "processing_status": "completed",
                "total_pages": total_pages,
                "chunks_created": len(chunks),
                "embeddings_stored": len(embeddings),
                "embedding_dimension": settings.EMBEDDING_DIMENSION,
                "sample_chunks": sample_chunks,
            }

        except Exception as exc:
            # Mark document as 'failed' on any error
            logger.error("Processing failed for document %s: %s", doc_id_str, str(exc))
            try:
                client.table("documents").update({"processing_status": "failed"}).eq("id", doc_id_str).execute()
            except Exception as update_err:
                logger.error("Failed to update status to 'failed': %s", str(update_err))
            raise


# Reusable singleton instance
document_processor = DocumentProcessingService()
