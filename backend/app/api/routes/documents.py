import logging
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends, status

from app.core.auth import get_current_user, AuthenticatedUser
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

router = APIRouter(prefix="/documents", tags=["Documents & Shared Knowledge Base"])
logger = logging.getLogger("automotive_ai.documents_api")


@router.post(
    "/upload",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload Automotive PDF (Shared Knowledge Base)",
    description=(
        "Uploads a PDF technical brochure or vehicle manual (up to 20 MB) to the private "
        "Supabase Storage bucket, computes SHA-256 checksum to detect duplicates, extracts text "
        "page-by-page, and binds the document strictly to the authenticated user's ID."
    ),
)
async def upload_pdf_document(
    file: UploadFile = File(..., description="PDF brochure or manual file"),
    vehicle_id: Optional[UUID] = Form(None, description="Optional UUID of associated vehicle"),
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> DocumentUploadResponse:
    """
    Validates, detects duplicates, extracts text page-by-page, and archives an automotive PDF document.
    Ownership is strictly bound to the authenticated caller's identity derived from their JWT.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File upload must include a valid filename.",
        )

    try:
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
                message="Duplicate PDF detected. Existing brochure already available in shared knowledge base.",
            )

        # 3. Text extraction via PyMuPDF (fitz)
        total_pages, extracted_pages_data = pdf_service.extract_text_by_page(file_bytes)

        # 4. Upload to private Supabase Storage bucket ('automotive-brochures')
        storage_path = pdf_service.upload_to_storage(
            file_name=file.filename,
            file_bytes=file_bytes,
        )

        # 5. Save metadata record into PostgreSQL 'documents' table with authenticated uploader
        doc_id, processing_status, notice = pdf_service.save_document_metadata(
            file_name=file.filename,
            storage_path=storage_path,
            file_size=len(file_bytes),
            total_pages=total_pages,
            vehicle_id=vehicle_id,
            file_hash=file_hash,
            uploaded_by=str(current_user.id),
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


@router.get(
    "",
    response_model=DocumentListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Shared Automotive Brochures",
    description="Returns all shared automotive documents in the knowledge base, marking ownership for the authenticated user.",
)
@router.get(
    "/",
    response_model=DocumentListResponse,
    include_in_schema=False,
)
async def list_documents(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> DocumentListResponse:
    """
    Returns all uploaded documents from the shared knowledge base.
    Marks is_owner=True for documents uploaded by the current caller.
    """
    client = supabase_service.client
    try:
        res = client.table("documents").select("*").order("created_at", desc=True).execute()
        docs = res.data or []

        doc_details: List[DocumentDetailResponse] = []
        user_id_str = str(current_user.id)

        for d in docs:
            c_res = client.table("document_chunks").select("id", count="exact").eq("document_id", d["id"]).execute()
            c_count = c_res.count if c_res.count is not None else len(c_res.data or [])
            uploader = str(d.get("uploaded_by") or "")

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
                    uploaded_by=uploader if uploader else None,
                    is_owner=(uploader == user_id_str),
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
    "/{document_id}",
    response_model=DocumentDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Document Details and Processing Metrics",
)
async def get_document_details(
    document_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> DocumentDetailResponse:
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

        chunk_res = client.table("document_chunks").select("id", count="exact").eq("document_id", doc_id_str).execute()
        chunks_count = chunk_res.count if chunk_res.count is not None else len(chunk_res.data or [])

        uploader = str(doc.get("uploaded_by") or "")
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
            uploaded_by=uploader if uploader else None,
            is_owner=(uploader == str(current_user.id)),
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


@router.get(
    "/{document_id}/download",
    status_code=status.HTTP_200_OK,
    summary="Get Temporary Signed URL for Private PDF Download",
)
async def download_document(
    document_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Generates a secure 15-minute signed URL from the private Supabase Storage bucket.
    Accessible to all authenticated users for viewing brochures in the shared knowledge base.
    """
    client = supabase_service.client
    res = client.table("documents").select("file_name, storage_path").eq("id", str(document_id)).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    doc = res.data[0]
    signed_url = pdf_service.create_signed_url(doc["storage_path"], expires_in=900)
    if not signed_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate secure download link for this document.",
        )

    return {
        "success": True,
        "file_name": doc["file_name"],
        "download_url": signed_url,
        "expires_in_seconds": 900,
    }


@router.delete(
    "/{document_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete Uploaded Brochure (Owner Only)",
)
async def delete_document(
    document_id: UUID,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Deletes an uploaded brochure.
    STRICT SECURITY RULE: Only the original uploader (uploaded_by) can delete their document.
    Unauthorized attempts return HTTP 403 Forbidden.
    """
    client = supabase_service.client
    res = client.table("documents").select("*").eq("id", str(document_id)).execute()
    if not res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    doc = res.data[0]
    uploader = doc.get("uploaded_by")

    # Strict ownership verification
    if not uploader or str(uploader) != str(current_user.id):
        logger.warning(
            "User %s attempted unauthorized deletion of document %s (owned by %s)",
            current_user.id,
            document_id,
            uploader,
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You can only delete brochures that you uploaded. Another user's document cannot be deleted.",
        )

    # 1. Delete file from private Supabase Storage
    pdf_service.delete_from_storage(doc.get("storage_path", ""))

    # 2. Delete database record (foreign keys cascade to document_chunks)
    client.table("documents").delete().eq("id", str(document_id)).execute()

    logger.info("User %s deleted their document %s (%s)", current_user.id, document_id, doc.get("file_name"))
    return {
        "success": True,
        "message": f"Document '{doc.get('file_name')}' deleted successfully.",
    }


@router.post(
    "/{document_id}/process",
    response_model=ProcessDocumentResponse,
    status_code=status.HTTP_200_OK,
    summary="Process Document: Chunk and Embed into Shared Knowledge Base",
)
async def process_document_endpoint(
    document_id: UUID,
    request: Optional[ProcessDocumentRequest] = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> ProcessDocumentResponse:
    """
    Chunks document and generates embeddings.
    Prevents duplicate processing if already completed.
    """
    client = supabase_service.client
    doc_res = client.table("documents").select("id, file_name, processing_status, total_pages").eq("id", str(document_id)).execute()
    if not doc_res.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    doc = doc_res.data[0]
    # Check if already completed and chunks exist
    if doc.get("processing_status") == "completed":
        c_res = client.table("document_chunks").select("id", count="exact").eq("document_id", str(document_id)).execute()
        if (c_res.count or 0) > 0:
            return ProcessDocumentResponse(
                success=True,
                document_id=str(document_id),
                file_name=doc.get("file_name", ""),
                processing_status="completed",
                total_pages=doc.get("total_pages") or 1,
                chunks_created=c_res.count or 0,
                embeddings_stored=c_res.count or 0,
                embedding_dimension=768,
                sample_chunks=[],
                message="Document is already processed and active in the shared knowledge base.",
            )

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
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(val_err).lower() else status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        )
    except RuntimeError as run_err:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(run_err),
        )
    except Exception as exc:
        logger.error("Unexpected error processing document %s: %s", str(document_id), str(exc))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process document.",
        )
