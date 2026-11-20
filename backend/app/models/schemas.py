from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from uuid import UUID


class AppHealthResponse(BaseModel):
    """
    Standard application health status payload.
    """
    status: str = Field(default="online", description="Application status")
    api_name: str = Field(default="Automotive AI Assistant API", description="API service name")
    version: str = Field(default="1.0.0", description="API version")


class DatabaseHealthResponse(BaseModel):
    """
    Supabase database connectivity health status payload.
    """
    status: str = Field(description="Connection status: 'connected' or 'disconnected'")
    database: str = Field(default="Supabase PostgreSQL", description="Target database provider")
    latency_ms: Optional[float] = Field(default=None, description="Round-trip latency in milliseconds")
    error: Optional[str] = Field(default=None, description="Sanitized connection error message if unsuccessful")


# ------------------------------------------------------------------------------
# Gemini AI Schemas
# ------------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    """
    Request model for Gemini text generation.
    """
    prompt: str = Field(..., min_length=1, description="Prompt text to generate content from")
    model: Optional[str] = Field(default=None, description="Optional Gemini model override")


class GenerateResponse(BaseModel):
    """
    Response model for Gemini text generation.
    """
    success: bool = Field(default=True, description="Indicates if generation succeeded")
    response: str = Field(description="Generated answer from Google Gemini")


class EmbedRequest(BaseModel):
    """
    Request model for Gemini vector embedding generation.
    """
    text: str = Field(..., min_length=1, description="Text content to convert into 768-dim vector embedding")


class EmbedResponse(BaseModel):
    """
    Response model for Gemini vector embedding generation.
    """
    success: bool = Field(default=True, description="Indicates if embedding succeeded")
    dimensions: int = Field(default=768, description="Dimensionality of the vector embedding")
    embedding: List[float] = Field(description="Dense vector embedding with exactly 768 dimensions")


# ------------------------------------------------------------------------------
# Document Ingestion & PyMuPDF Schemas
# ------------------------------------------------------------------------------

class ExtractedPage(BaseModel):
    """
    Represents extracted text content for a single page of a PDF document.
    """
    page_number: int = Field(..., ge=1, description="1-indexed page number")
    text: str = Field(..., description="Extracted plain text content for the page")
    char_count: int = Field(..., ge=0, description="Total characters extracted from the page")


class DocumentUploadResponse(BaseModel):
    """
    Response model for PDF upload and PyMuPDF text extraction with duplicate detection.
    """
    success: bool = Field(default=True, description="Indicates if upload and extraction succeeded")
    document_id: Optional[str] = Field(default=None, description="UUID of created database record if saved")
    file_name: str = Field(..., description="Original filename of the uploaded PDF")
    storage_path: str = Field(..., description="Path within Supabase automotive-brochures storage bucket")
    file_size_bytes: int = Field(..., description="Uploaded file size in bytes")
    file_hash: Optional[str] = Field(default=None, description="SHA-256 hash of file contents")
    is_duplicate: bool = Field(default=False, description="True if document already existed in repository")
    total_pages: int = Field(..., ge=1, description="Total pages extracted from the PDF")
    processing_status: str = Field(default="completed", description="Status in database: pending, processing, completed, or failed")
    pages: List[ExtractedPage] = Field(default_factory=list, description="Extracted text content preserved by page number")
    message: str = Field(default="PDF uploaded and text extracted successfully.")


class DocumentDetailResponse(BaseModel):
    """
    Detailed document metadata and vector processing status.
    """
    id: str = Field(..., description="Document UUID")
    file_name: str = Field(..., description="Original brochure filename")
    storage_path: str = Field(..., description="Path within private Supabase storage bucket")
    file_type: str = Field(default="application/pdf", description="MIME content type")
    file_size_bytes: int = Field(..., description="Total file size in bytes")
    file_hash: Optional[str] = Field(default=None, description="SHA-256 cryptographic checksum")
    processing_status: str = Field(..., description="Processing status: pending, processing, completed, or failed")
    total_pages: Optional[int] = Field(default=None, description="Total pages extracted from the PDF")
    chunks_count: int = Field(default=0, description="Total number of chunks stored in pgvector")
    vehicle_id: Optional[str] = Field(default=None, description="Associated vehicle UUID if linked")
    uploaded_by: Optional[str] = Field(default=None, description="UUID of user who uploaded the document")
    is_owner: Optional[bool] = Field(default=False, description="Whether current authenticated user is the uploader")
    created_at: Optional[str] = Field(default=None, description="Ingestion timestamp")
    updated_at: Optional[str] = Field(default=None, description="Last status update timestamp")


class DocumentListResponse(BaseModel):
    """
    List of uploaded automotive brochure documents with processing metrics.
    """
    total_documents: int = Field(..., description="Total registered documents")
    documents: List[DocumentDetailResponse] = Field(default_factory=list, description="List of document metadata items")



# ------------------------------------------------------------------------------
# Chunking, Vector Embeddings & Processing Schemas
# ------------------------------------------------------------------------------

class ProcessDocumentRequest(BaseModel):
    """
    Configuration parameters for document text chunking and vector embedding generation.
    """
    target_chunk_size: Optional[int] = Field(
        default=1000,
        ge=200,
        le=4000,
        description="Target character length per chunk (default: 1000)",
    )
    chunk_overlap: Optional[int] = Field(
        default=150,
        ge=0,
        le=500,
        description="Character overlap between consecutive chunks (default: 150)",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional embedding model override (defaults to EMBEDDING_MODEL setting)",
    )


class ChunkSummary(BaseModel):
    """
    Summary preview of an individual stored chunk.
    """
    chunk_index: int = Field(..., description="0-indexed sequence of the chunk within the document")
    page_number: int = Field(..., description="1-indexed source PDF page number")
    char_count: int = Field(..., description="Character length of chunk text")
    content_preview: str = Field(..., description="Preview snippet of the chunk content")


class ProcessDocumentResponse(BaseModel):
    """
    Response payload for document text chunking and vector embedding storage.
    """
    success: bool = Field(default=True, description="Indicates if processing succeeded")
    document_id: str = Field(..., description="UUID of the processed document")
    file_name: str = Field(..., description="Original filename of the processed document")
    processing_status: str = Field(..., description="Final processing status: pending, processing, completed, or failed")
    total_pages: int = Field(..., ge=0, description="Total pages processed from the PDF")
    chunks_created: int = Field(..., ge=0, description="Total number of chunks generated from the document")
    embeddings_stored: int = Field(..., ge=0, description="Total number of 768-dim embeddings stored in Supabase pgvector")
    embedding_dimension: int = Field(default=768, description="Dimensions of stored vector embeddings")
    sample_chunks: List[ChunkSummary] = Field(
        default_factory=list,
        description="Preview of the first few generated chunks",
    )
    message: str = Field(default="Document chunked, embedded, and stored successfully.")


# ------------------------------------------------------------------------------
# RAG Retrieval & Chat Schemas
# ------------------------------------------------------------------------------

class ChatSource(BaseModel):
    """
    Detailed source attribution for a grounded RAG response.
    """
    document_name: str = Field(..., description="Original name of the source PDF document")
    document_id: str = Field(..., description="UUID of the parent document")
    page_number: Optional[int] = Field(default=None, description="1-indexed source PDF page number")
    similarity: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")
    excerpt: str = Field(..., description="Short snippet from the source chunk text")
    chunk_id: Optional[str] = Field(default=None, description="UUID of the document chunk")


class ChatAskRequest(BaseModel):
    """
    Request model for grounded automotive question answering.
    """
    question: str = Field(..., min_length=1, description="User's natural language automotive question")
    session_id: Optional[UUID] = Field(
        default=None,
        description="Optional UUID of existing chat session. If omitted, a new session is created.",
    )
    vehicle_id: Optional[UUID] = Field(
        default=None,
        description="Optional vehicle UUID to scope retrieval to a specific vehicle",
    )
    top_k: Optional[int] = Field(
        default=5,
        ge=1,
        le=20,
        description="Maximum number of relevant chunks to retrieve (default: 5)",
    )
    similarity_threshold: Optional[float] = Field(
        default=0.4,
        ge=0.0,
        le=1.0,
        description="Minimum cosine similarity threshold (default: 0.4)",
    )
    model: Optional[str] = Field(
        default=None,
        description="Optional Gemini model override for text generation",
    )


class ChatAskResponse(BaseModel):
    """
    Response model for grounded automotive question answering with citations.
    """
    success: bool = Field(default=True, description="Indicates if query succeeded")
    status: str = Field(default="accepted", description="Processing status: 'accepted' or 'rejected'")
    question: str = Field(..., description="The user's original question")
    answer: str = Field(..., description="Grounded answer from Gemini or rejection notice")
    session_id: Optional[str] = Field(default=None, description="UUID of the chat session")
    sources: List[ChatSource] = Field(
        default_factory=list,
        description="List of cited brochure documents, page numbers, and excerpts",
    )
    chunks_retrieved: int = Field(default=0, description="Total number of chunks retrieved above threshold")
    confidence_score: Optional[float] = Field(
        default=None,
        description="Top similarity score among retrieved chunks",
    )
    is_fallback: Optional[bool] = Field(
        default=False,
        description="True if answer used general knowledge fallback when brochure chunks were unavailable",
    )
    message: str = Field(default="Query processed successfully.")


# ------------------------------------------------------------------------------
# Vehicle Comparison Schemas
# ------------------------------------------------------------------------------

class VehicleSpecData(BaseModel):
    """
    Extracted vehicle specifications strictly grounded in uploaded brochures.
    """
    name: str = Field(..., description="Vehicle make and model name")
    identified: bool = Field(default=True, description="Whether the vehicle was found in database or brochures")
    variant: Optional[str] = Field(default=None, description="Specific trim or variant if requested")
    document_name: Optional[str] = Field(default=None, description="Name of source brochure PDF")
    engine_transmission: str = Field(
        default="Not available in uploaded documents",
        description="Powertrain, displacement, gearbox, and motor specifications",
    )
    fuel_type: str = Field(
        default="Not available in uploaded documents",
        description="Fuel type (Petrol, Diesel, Electric, Hybrid)",
    )
    mileage: str = Field(
        default="Not available in uploaded documents",
        description="Fuel economy, range, or consumption figures",
    )
    dimensions: str = Field(
        default="Not available in uploaded documents",
        description="Length, width, height, wheelbase, or ground clearance",
    )
    seating_capacity: str = Field(
        default="Not available in uploaded documents",
        description="Seating capacity and cabin layout (e.g., 5-seater, 6/7-seater)",
    )
    safety_features: str = Field(
        default="Not available in uploaded documents",
        description="Airbags, ADAS, ESC, VSM, braking, and structural safety",
    )
    infotainment_comfort: str = Field(
        default="Not available in uploaded documents",
        description="Touchscreen size, audio system, connectivity, sunroof, and climate control",
    )
    price: str = Field(
        default="Not available in uploaded documents",
        description="Pricing or MSRP if documented in brochures or database",
    )


class ComparisonRow(BaseModel):
    """
    Side-by-side comparison row for a specific technical attribute.
    """
    attribute: str = Field(..., description="Specification category name")
    vehicle_1_value: str = Field(..., description="Value for first vehicle")
    vehicle_2_value: str = Field(..., description="Value for second vehicle")
    difference: Optional[str] = Field(default=None, description="Neutral factual distinction")


class VehicleCompareRequest(BaseModel):
    """
    Request model for comparing two vehicles side-by-side.
    """
    vehicle_1: str = Field(..., min_length=1, description="First vehicle name (e.g., 'Tata Harrier')")
    vehicle_2: str = Field(..., min_length=1, description="Second vehicle name (e.g., 'Hyundai Grand i10 Nios')")
    variant_1: Optional[str] = Field(default=None, description="Optional trim/variant for vehicle 1")
    variant_2: Optional[str] = Field(default=None, description="Optional trim/variant for vehicle 2")
    comparison_criteria: Optional[str] = Field(
        default=None,
        description="Optional user criteria (e.g., 'family road trips', 'city commute', 'safety')",
    )
    model: Optional[str] = Field(default=None, description="Optional Gemini model override")


class VehicleCompareResponse(BaseModel):
    """
    Response model for vehicle comparison with structured specifications, neutral summary, and source citations.
    """
    success: bool = Field(default=True, description="Indicates if comparison completed")
    vehicle_1: VehicleSpecData = Field(..., description="Specifications for first vehicle")
    vehicle_2: VehicleSpecData = Field(..., description="Specifications for second vehicle")
    comparison_table: List[ComparisonRow] = Field(
        default_factory=list,
        description="Structured side-by-side comparison across 8 key attributes",
    )
    summary: str = Field(..., description="Neutral comparison summary and trade-off analysis")
    sources: List[ChatSource] = Field(
        default_factory=list,
        description="Source document names, page numbers, and excerpts for verified claims",
    )
    message: str = Field(default="Vehicle comparison completed successfully.")



