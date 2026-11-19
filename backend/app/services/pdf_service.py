import re
import uuid
import logging
from pathlib import Path
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID

import pymupdf as fitz
from postgrest.exceptions import APIError

from app.services.supabase_service import supabase_service

logger = logging.getLogger("automotive_ai.pdf")

# Constants
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_EXTENSIONS = {".pdf"}
ALLOWED_MIME_TYPES = {"application/pdf"}
PDF_MAGIC_BYTES = b"%PDF-"
STORAGE_BUCKET = "automotive-brochures"


class PDFService:
    """
    Service for validating, extracting text from, and managing PDF brochures and manuals.
    """

    def validate_pdf(
        self,
        file_name: str,
        content_type: Optional[str],
        file_bytes: bytes,
    ) -> None:
        """
        Validates file extension, MIME type, size limit, and PDF magic bytes signature.
        Raises ValueError if any validation check fails.
        """
        # 1. Validate file extension
        ext = Path(file_name).suffix.lower() if file_name else ""
        if ext not in ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid file extension '{ext}'. Only .pdf files are accepted.")

        # 2. Validate MIME type
        if content_type and content_type.lower() not in ALLOWED_MIME_TYPES:
            raise ValueError(f"Invalid MIME type '{content_type}'. Expected 'application/pdf'.")

        # 3. Validate file size
        file_size = len(file_bytes)
        if file_size == 0:
            raise ValueError("The uploaded file is empty (0 bytes).")
        if file_size > MAX_FILE_SIZE_BYTES:
            max_mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
            raise ValueError(f"File size ({file_size / (1024 * 1024):.2f} MB) exceeds maximum allowed limit of {max_mb} MB.")

        # 4. Validate PDF magic bytes signature
        if not file_bytes.startswith(PDF_MAGIC_BYTES):
            raise ValueError("Invalid PDF signature. The file header does not match a valid PDF document.")

    def extract_text_by_page(self, file_bytes: bytes) -> Tuple[int, List[Dict[str, Any]]]:
        """
        Extracts plain text page-by-page from PDF bytes using PyMuPDF.
        Preserves 1-indexed page numbering and rejects corrupted or blank documents.

        :param file_bytes: In-memory bytes of the PDF.
        :return: Tuple of (total_pages, list of page dicts with page_number, text, char_count).
        """
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
        except Exception as exc:
            logger.error("PyMuPDF failed to open PDF document: %s", str(exc))
            raise ValueError("The uploaded file is corrupted or could not be parsed as a valid PDF.") from exc

        try:
            if doc.is_encrypted:
                raise ValueError("Encrypted or password-protected PDF files are not supported.")

            total_pages = len(doc)
            if total_pages == 0:
                raise ValueError("The uploaded PDF contains no pages.")

            pages: List[Dict[str, Any]] = []
            total_extracted_chars = 0

            for page_index, page in enumerate(doc, start=1):
                page_text = page.get_text("text").strip()
                char_count = len(page_text)
                total_extracted_chars += char_count

                pages.append({
                    "page_number": page_index,
                    "text": page_text,
                    "char_count": char_count,
                })

            if total_extracted_chars == 0:
                raise ValueError(
                    "The uploaded PDF contains no extractable text. "
                    "Scanned images or PDFs without an embedded text layer are not supported."
                )

            return total_pages, pages

        finally:
            doc.close()

    def upload_to_storage(self, file_name: str, file_bytes: bytes) -> str:
        """
        Uploads the raw PDF file to the private Supabase Storage bucket 'automotive-brochures'.

        :param file_name: Original filename.
        :param file_bytes: Raw file bytes.
        :return: Storage path within the bucket.
        """
        # Sanitize filename and create unique storage path
        safe_name = re.sub(r"[^a-zA-Z0-9_.-]", "_", Path(file_name).name)
        storage_path = f"brochures/{uuid.uuid4()}_{safe_name}"

        try:
            client = supabase_service.client
            storage = client.storage.from_(STORAGE_BUCKET)
            storage.upload(
                path=storage_path,
                file=file_bytes,
                file_options={"content-type": "application/pdf", "upsert": "true"},
            )
            return storage_path
        except Exception as exc:
            logger.error("Failed to upload PDF to Supabase Storage: %s", str(exc))
            raise RuntimeError("Failed to store PDF file in private storage.") from exc

    @staticmethod
    def compute_file_hash(file_bytes: bytes) -> str:
        """
        Computes SHA-256 cryptographic hexadecimal checksum of the file bytes.
        """
        import hashlib
        return hashlib.sha256(file_bytes).hexdigest()

    def find_duplicate_document(
        self,
        file_bytes: bytes,
        file_name: str,
    ) -> Optional[Dict[str, Any]]:
        """
        Checks whether the exact PDF already exists in the documents table using SHA-256 hash.
        Gracefully falls back to size/content verification if the 'file_hash' column has not yet
        been migrated in the PostgreSQL schema.
        """
        file_hash = self.compute_file_hash(file_bytes)
        client = supabase_service.client

        # 1. Primary check: query file_hash column
        try:
            res = client.table("documents").select("*").eq("file_hash", file_hash).execute()
            if res.data and len(res.data) > 0:
                logger.info("Found existing document via file_hash: %s (ID: %s)", file_name, res.data[0].get("id"))
                return res.data[0]
        except APIError as api_err:
            if "file_hash" in str(api_err.message) or "PGRST204" in str(api_err.code) or "42703" in str(api_err.code):
                # Column file_hash does not exist yet; fall back to matching by size and content/name
                logger.debug("file_hash column not found in schema cache, falling back to size-based check.")
                try:
                    size_res = client.table("documents").select("*").eq("file_size", len(file_bytes)).execute()
                    for doc in size_res.data or []:
                        # If filename matches, or verify by downloading and hashing
                        if doc.get("file_name") == file_name:
                            logger.info("Found duplicate document via filename + size: %s", doc.get("id"))
                            return doc
                        # Download and check hash to be certain
                        try:
                            remote_bytes = client.storage.from_(STORAGE_BUCKET).download(doc.get("storage_path"))
                            if self.compute_file_hash(remote_bytes) == file_hash:
                                logger.info("Found duplicate document via content hash comparison: %s", doc.get("id"))
                                return doc
                        except Exception:
                            pass
                except Exception as fb_exc:
                    logger.warning("Duplicate fallback check failed: %s", str(fb_exc))
            else:
                logger.warning("Error querying documents by hash: %s", str(api_err))
        except Exception as exc:
            logger.warning("Unexpected error during duplicate check: %s", str(exc))

        return None

    def save_document_metadata(
        self,
        file_name: str,
        storage_path: str,
        file_size: int,
        total_pages: int,
        vehicle_id: Optional[UUID] = None,
        file_hash: Optional[str] = None,
    ) -> Tuple[Optional[str], str, Optional[str]]:
        """
        Saves document record into the existing 'documents' Supabase PostgreSQL table.

        :return: Tuple of (document_id, processing_status, warning_message).
        """
        doc_record: Dict[str, Any] = {
            "file_name": file_name,
            "storage_path": storage_path,
            "file_type": "application/pdf",
            "file_size": file_size,
            "processing_status": "completed",
            "total_pages": total_pages,
        }
        if vehicle_id:
            doc_record["vehicle_id"] = str(vehicle_id)
        if file_hash:
            doc_record["file_hash"] = file_hash

        client = supabase_service.client
        try:
            res = client.table("documents").insert(doc_record).execute()
            if res.data and len(res.data) > 0:
                return str(res.data[0].get("id")), "completed", None
            return None, "completed", None
        except APIError as api_err:
            # If insert failed because file_hash column does not exist yet (PGRST204 or 42703), retry without it
            if "file_hash" in str(api_err.message) or "PGRST204" in str(api_err.code):
                logger.info("Retrying document insert without 'file_hash' (migration pending).")
                doc_record.pop("file_hash", None)
                try:
                    res_retry = client.table("documents").insert(doc_record).execute()
                    if res_retry.data and len(res_retry.data) > 0:
                        return str(res_retry.data[0].get("id")), "completed", None
                except Exception as retry_exc:
                    logger.error("Retry insert failed: %s", str(retry_exc))

            logger.warning("Supabase table insert notice: %s (%s)", api_err.message, api_err.code)
            warning_msg = f"Document stored, but metadata insert returned: {api_err.message}."
            return None, "completed", warning_msg
        except Exception as exc:
            logger.error("Failed to insert document metadata: %s", str(exc))
            return None, "completed", f"Notice: Could not insert metadata ({type(exc).__name__})"


# Reusable singleton instance
pdf_service = PDFService()
