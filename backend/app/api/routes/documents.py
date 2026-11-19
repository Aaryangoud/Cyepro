import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, Header, status

from app.core.config import settings
from app.models.schemas import (
    DocumentUploadResponse,
    DocumentDetailResponse,
    DocumentListResponse,
    ExtractedPage,
    ProcessDocumentRequest,
    ChunkSummary,
    ProcessDocumentResponse,
)
from app.services.pdf_service import pdf_service
from app.services.document_processing_service import document_processor
from app.services.supabase_service import supabase_service

router = APIRouter(prefix="/documents", tags=["Documents & PDF Ingestion"])
logger = logging.getLogger("automotive_ai.documents_api")


def verify_admin_authorization(
    x_admin_key: Optional[str] = Header(None, alias="X-Admin-Key", description="Admin authorization secret key")
) -> bool:
    """
    Enforces server-side admin key verification to protect document administration endpoints.
    Reads ADMIN_API_KEY strictly from backend environment settings.
    """
    if not settings.ADMIN_API_KEY:
        return True
    if not x_admin_key or x_admin_key != settings.ADMIN_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authorization required. Please provide a valid 'X-Admin-Key' header.",
        )
    return True


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Automotive PDF and Extract Text (With SHA-256 Duplicate Detection)",
    description=(
        "Uploads a PDF technical brochure or vehicle manual (up to 20 MB) to the private "
        "Supabase Storage bucket 'automotive-brochures', computes SHA-256 checksum to detect duplicates, "
        "extracts text page-by-page using PyMuPDF, and saves document metadata to the 'documents' database table."
    ),
)
async def upload_pdf_document(
    file: UploadFile = File(..., description="PDF brochure or manual file"),
    vehicle_id: Optional[UUID] = Form(None, description="Optional UUID of associated vehicle"),
) -> DocumentUploadResponse:
    """
    Validates, detects duplicates, extracts text page-by-page, and archives an automotive PDF document.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File upload must include a valid filename.",
        )

    try:
        # Read file bytes into memory
        file_bytes = await file.read()

        # 1. Validation (extension, MIME type, size limit <= 20MB, and %PDF- signature)
        pdf_service.validate_pdf(
            file_name=file.filename,
            content_type=file.content_type,
            file_bytes=file_bytes,
        )

        # 2. SHA-256 Hashing and Duplicate Check
        file_hash = pdf_service.compute_file_hash(file_bytes)
        existing_doc = pdf_service.find_duplicate_document(file_bytes=file_bytes, file_name=file.filename)
        if existing_doc:
            logger.info("Duplicate PDF detected for '%s' (Existing Doc ID: %s)", file.filename, existing_doc.get("id"))
            return DocumentUploadResponse(
                success=True,
                document_id=str(existing_doc.get("id")),
                file_name=existing_doc.get("file_name", file.filename),
                storage_path=existing_doc.get("storage_path", ""),
                file_size_bytes=existing_doc.get("file_size", len(file_bytes)),
                file_hash=file_hash,
                is_duplicate=True,
                total_pages=existing_doc.get("total_pages") or 1,
                processing_status=existing_doc.get("processing_status", "completed"),
                pages=[],
                message="Duplicate PDF detected. Existing document record returned without re-upload.",
            )

        # 3. Text extraction via PyMuPDF (fitz)
        total_pages, extracted_pages_data = pdf_service.extract_text_by_page(file_bytes)

        # 4. Upload to private Supabase Storage bucket ('automotive-brochures')
        storage_path = pdf_service.upload_to_storage(
            file_name=file.filename,
            file_bytes=file_bytes,
        )

        # 5. Save metadata record into PostgreSQL 'documents' table
        doc_id, processing_status, notice = pdf_service.save_document_metadata(
            file_name=file.filename,
            storage_path=storage_path,
            file_size=len(file_bytes),
            total_pages=total_pages,
            vehicle_id=vehicle_id,
            file_hash=file_hash,
        )

        # 6. Build response model
        pages_model = [
            ExtractedPage(
                page_number=p["page_number"],
                text=p["text"],
                char_count=p["char_count"],
            )
            for p in extracted_pages_data
        ]

        response_msg = "PDF uploaded and text extracted successfully."
        if notice:
            response_msg = f"{response_msg} ({notice})"

        return DocumentUploadResponse(
            success=True,
            document_id=doc_id,
            file_name=file.filename,
            storage_path=storage_path,
            file_size_bytes=len(file_bytes),
            file_hash=file_hash,
            is_duplicate=False,
            total_pages=total_pages,
            processing_status=processing_status,
            pages=pages_model,
            message=response_msg,
        )

    except ValueError as val_err:
        logger.warning("PDF upload rejected: %s", str(val_err))
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        logger.error("Storage upload failed: %s", str(run_err))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error in document upload: %s", type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while processing the PDF document.",
        )
    finally:
        await file.close()


async def _get_all_documents_response() -> DocumentListResponse:
    """
    Internal helper returning all uploaded documents and processing metrics from Supabase.
    """
    client = supabase_service.client
    try:
        res = client.table("documents").select("*").order("created_at", desc=True).execute()
        docs = res.data or []

        doc_details: List[DocumentDetailResponse] = []
        for d in docs:
            c_res = client.table("document_chunks").select("id", count="exact").eq("document_id", d["id"]).execute()
            c_count = c_res.count if c_res.count is not None else len(c_res.data or [])
            doc_details.append(
                DocumentDetailResponse(
                    id=str(d["id"]),
                    file_name=d["file_name"],
                    storage_path=d["storage_path"],
                    file_type=d.get("file_type", "application/pdf"),
                    file_size_bytes=d.get("file_size", 0),
                    file_hash=d.get("file_hash"),
                    processing_status=d.get("processing_status", "pending"),
                    total_pages=d.get("total_pages"),
                    chunks_count=c_count,
                    vehicle_id=str(d.get("vehicle_id")) if d.get("vehicle_id") else None,
                    created_at=str(d.get("created_at")) if d.get("created_at") else None,
                    updated_at=str(d.get("updated_at")) if d.get("updated_at") else None,
                )
            )

        return DocumentListResponse(
            total_documents=len(doc_details),
            documents=doc_details,
        )
    except Exception as exc:
        logger.error("Document list failed: %s", str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document list.",
        )


@router.get(
    "",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List All Ingested Documents and Processing Statuses",
    description="Application endpoint returning all ingested documents with page counts and processing statuses for the dashboard and document management UI.",
)
@router.get(
    "/",
    response_model=DocumentListResponse,
    include_in_schema=False,
)
async def list_documents() -> DocumentListResponse:
    """
    Application-level document list endpoint. Authorizes requests directly on the backend without requiring client-side secrets.
    """
    return await _get_all_documents_response()


@router.get(
    "/admin/list",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin: List All Ingested Documents and Processing Statuses",
    description="Secured admin endpoint returning all documents with page counts, chunk metrics, and processing statuses.",
)
async def admin_list_documents(
    authorized: bool = Depends(verify_admin_authorization),
) -> DocumentListResponse:
    """
    Returns full list of uploaded brochures and their processing metrics for administrative review.
    Requires 'X-Admin-Key' authentication header when ADMIN_API_KEY is configured in backend environment.
    """
    return await _get_all_documents_response()


@router.get(
    "/{document_id}",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Details and Processing Status",
    description="Retrieves metadata, processing status, page count, and vector chunk counts for a document.",
)
async def get_document_details(document_id: UUID) -> DocumentDetailResponse:
    """
    Returns document details and vector storage metrics for a specific document ID.
    """
    client = supabase_service.client
    doc_id_str = str(document_id)
    try:
        res = client.table("documents").select("*").eq("id", doc_id_str).execute()
        if not res.data or len(res.data) == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document with ID {doc_id_str} was not found.",
            )
        doc = res.data[0]

        # Query chunk count in document_chunks
        chunk_res = client.table("document_chunks").select("id", count="exact").eq("document_id", doc_id_str).execute()
        chunks_count = chunk_res.count if chunk_res.count is not None else len(chunk_res.data or [])

        return DocumentDetailResponse(
            id=str(doc["id"]),
            file_name=doc["file_name"],
            storage_path=doc["storage_path"],
            file_type=doc.get("file_type", "application/pdf"),
            file_size_bytes=doc.get("file_size", 0),
            file_hash=doc.get("file_hash"),
            processing_status=doc.get("processing_status", "pending"),
            total_pages=doc.get("total_pages"),
            chunks_count=chunks_count,
            vehicle_id=str(doc.get("vehicle_id")) if doc.get("vehicle_id") else None,
            created_at=str(doc.get("created_at")) if doc.get("created_at") else None,
            updated_at=str(doc.get("updated_at")) if doc.get("updated_at") else None,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Failed to retrieve document %s: %s", doc_id_str, str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document details.",
        )


@router.post(
    "/{document_id}/process",
    response_model=ProcessDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Document: Chunk, Embed with Gemini, and Store in pgvector",
    description=(
        "Retrieves an uploaded PDF from private Supabase Storage, extracts text page-by-page, "
        "performs sentence-aware chunking (~1,000 chars with ~150 chars overlap) preserving page numbers, "
        "generates 768-dimensional Gemini vector embeddings in batches, and safely stores them in "
        "the Supabase 'document_chunks' table using pgvector."
    ),
)
async def process_document_endpoint(
    document_id: UUID,
    request: Optional[ProcessDocumentRequest] = None,
) -> ProcessDocumentResponse:
    """
    Processes an existing document: splits text into sentence-aware chunks, generates 768-dim
    Gemini embeddings, and stores them in Supabase PostgreSQL vector store.
    """
    target_size = request.target_chunk_size if request else 1000
    overlap = request.chunk_overlap if request else 150
    model = request.model if request else None

    try:
        result = document_processor.process_document(
            document_id=document_id,
            target_chunk_size=target_size,
            chunk_overlap=overlap,
            model=model,
        )

        sample_chunks_models = [
            ChunkSummary(
                chunk_index=c["chunk_index"],
                page_number=c["page_number"],
                char_count=c["char_count"],
                content_preview=c["content_preview"],
            )
            for c in result.get("sample_chunks", [])
        ]

        return ProcessDocumentResponse(
            success=True,
            document_id=result["document_id"],
            file_name=result["file_name"],
            processing_status=result["processing_status"],
            total_pages=result["total_pages"],
            chunks_created=result["chunks_created"],
            embeddings_stored=result["embeddings_stored"],
            embedding_dimension=result["embedding_dimension"],
            sample_chunks=sample_chunks_models,
            message=f"Document successfully chunked into {result['chunks_created']} chunks and stored in pgvector.",
        )

    except ValueError as val_err:
        logger.warning("Document processing validation error for %s: %s", str(document_id), str(val_err))
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(val_err).lower() else status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        logger.error("Document processing runtime error for %s: %s", str(document_id), str(run_err))
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Unexpected error processing document %s: %s", str(document_id), type(exc).__name__)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected error occurred during document chunking and vector embedding.",
        )


@router.get(
    "/{document_id}/chunks",
    summary="List Document Chunks",
    description="Retrieves the chunk text and page numbers stored in Supabase for a given document (excluding raw vectors for lightweight response).",
)
async def list_document_chunks(
    document_id: UUID,
    limit: int = 50,
):
    """
    Returns stored text chunks and metadata for a processed document.
    """
    try:
        client = supabase_service.client
        res = (
            client.table("document_chunks")
            .select("id, document_id, chunk_index, page_number, content, metadata, created_at")
            .eq("document_id", str(document_id))
            .order("chunk_index")
            .limit(limit)
            .execute()
        )
        return {
            "document_id": str(document_id),
            "total_chunks": len(res.data) if res.data else 0,
            "chunks": res.data or [],
        }
    except Exception as exc:
        logger.error("Failed to fetch chunks for document %s: %s", str(document_id), str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve document chunks from database.",
        )

