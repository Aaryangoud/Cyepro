-- ==============================================================================
-- Automotive AI Assistant - Production Database Schema
-- Supabase PostgreSQL + pgvector
-- Target Embedding Model: Google Gemini gemini-embedding-001 (768 dimensions)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------------------------

-- Enable pgvector extension for high-dimensional vector search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID extension for cryptographic ID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for gen_random_uuid() fallback
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ------------------------------------------------------------------------------
-- REUSABLE FUNCTIONS & TRIGGERS
-- ------------------------------------------------------------------------------

-- Generic updated_at timestamp trigger function
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------------------------
-- 1. VEHICLES TABLE
-- Master registry of vehicle models manufactured by supported brands
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    manufacturer VARCHAR(100) NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_vehicles_manufacturer_model UNIQUE (manufacturer, model_name)
);

COMMENT ON TABLE vehicles IS 'Master registry of vehicle makes and models';
COMMENT ON COLUMN vehicles.manufacturer IS 'Automotive brand or OEM name (e.g., Porsche, BMW, Audi)';
COMMENT ON COLUMN vehicles.model_name IS 'Model name (e.g., Taycan, M4, e-tron GT)';

-- Safe, repeatable trigger creation for vehicles updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vehicles_updated_at'
    ) THEN
        CREATE TRIGGER trg_vehicles_updated_at
            BEFORE UPDATE ON vehicles
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 2. VEHICLE_VARIANTS TABLE
-- Detailed trims, powertrains, and configuration specifications per vehicle
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    variant_name VARCHAR(100) NOT NULL,
    fuel_type VARCHAR(50),
    transmission VARCHAR(50),
    price NUMERIC(12, 2) CHECK (price IS NULL OR price >= 0),
    specifications JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_vehicle_variants_vehicle_variant UNIQUE (vehicle_id, variant_name),
    -- Composite unique key to support composite foreign key checks from document_chunks
    CONSTRAINT uq_vehicle_variants_id_vehicle UNIQUE (id, vehicle_id)
);

COMMENT ON TABLE vehicle_variants IS 'Trims, powertrain variants, and detailed specifications';
COMMENT ON COLUMN vehicle_variants.specifications IS 'JSONB payload for battery capacity, horsepower, torque, range, charging speeds, etc.';

-- Safe, repeatable trigger creation for vehicle_variants updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_vehicle_variants_updated_at'
    ) THEN
        CREATE TRIGGER trg_vehicle_variants_updated_at
            BEFORE UPDATE ON vehicle_variants
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 3. DOCUMENTS TABLE
-- Ingested technical brochures, owner manuals, and service guides
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_pages INTEGER CHECK (total_pages IS NULL OR total_pages >= 0),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_documents_processing_status 
        CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed'))
);

COMMENT ON TABLE documents IS 'Metadata for brochures and manuals stored in Supabase Storage';
COMMENT ON COLUMN documents.storage_path IS 'Path within the private automotive-brochures storage bucket';
COMMENT ON COLUMN documents.processing_status IS 'State of background PyMuPDF extraction: pending, processing, completed, or failed';

-- Safe, repeatable trigger creation for documents updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_updated_at'
    ) THEN
        CREATE TRIGGER trg_documents_updated_at
            BEFORE UPDATE ON documents
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 4. DOCUMENT_CHUNKS TABLE
-- Extracted text chunks with 768-dimensional Gemini vector embeddings
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES vehicle_variants(id) ON DELETE SET NULL,
    chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
    content TEXT NOT NULL,
    page_number INTEGER CHECK (page_number IS NULL OR page_number >= 1),
    embedding VECTOR(768),
    metadata JSONB DEFAULT '{}'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT uq_document_chunks_doc_chunk UNIQUE (document_id, chunk_index),
    -- Data integrity constraint: variant requires vehicle_id to be populated
    CONSTRAINT chk_document_chunks_variant_requires_vehicle 
        CHECK (variant_id IS NULL OR vehicle_id IS NOT NULL),
    -- Data integrity constraint: variant must strictly belong to the referenced vehicle
    CONSTRAINT fk_document_chunks_variant_vehicle 
        FOREIGN KEY (variant_id, vehicle_id) 
        REFERENCES vehicle_variants(id, vehicle_id) 
        ON DELETE SET NULL
);

COMMENT ON TABLE document_chunks IS 'Chunked document text and 768-dim embeddings from gemini-embedding-001';
COMMENT ON COLUMN document_chunks.embedding IS 'gemini-embedding-001 dense vector (768 dimensions)';
COMMENT ON COLUMN document_chunks.metadata IS 'Contextual chunk metadata (headers, section names, token counts)';

-- Trigger function to enforce vehicle consistency between parent document and chunk
CREATE OR REPLACE FUNCTION trg_fn_validate_document_chunk_relations()
RETURNS TRIGGER AS $$
DECLARE
    v_doc_vehicle_id UUID;
BEGIN
    IF NEW.document_id IS NOT NULL THEN
        SELECT vehicle_id INTO v_doc_vehicle_id 
        FROM documents 
        WHERE id = NEW.document_id;

        -- If parent document is explicitly bound to a vehicle, chunk vehicle must not conflict
        IF v_doc_vehicle_id IS NOT NULL THEN
            IF NEW.vehicle_id IS NOT NULL AND NEW.vehicle_id <> v_doc_vehicle_id THEN
                RAISE EXCEPTION 'Chunk vehicle_id (%) conflicts with parent document vehicle_id (%)', 
                    NEW.vehicle_id, v_doc_vehicle_id;
            END IF;
            -- Automatically inherit parent document vehicle_id if not specified
            IF NEW.vehicle_id IS NULL THEN
                NEW.vehicle_id := v_doc_vehicle_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Safe, repeatable trigger creation for document_chunks relation validation
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_document_chunks_validate_relations'
    ) THEN
        CREATE TRIGGER trg_document_chunks_validate_relations
            BEFORE INSERT OR UPDATE ON document_chunks
            FOR EACH ROW
            EXECUTE FUNCTION trg_fn_validate_document_chunk_relations();
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 5. CHAT_SESSIONS TABLE
-- User chat sessions for automotive AI consultations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL DEFAULT 'New Conversation',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

COMMENT ON TABLE chat_sessions IS 'Conversation sessions associated with authenticated users';

-- Safe, repeatable trigger creation for chat_sessions updated_at
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at'
    ) THEN
        CREATE TRIGGER trg_chat_sessions_updated_at
            BEFORE UPDATE ON chat_sessions
            FOR EACH ROW
            EXECUTE FUNCTION handle_updated_at();
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- 6. CHAT_MESSAGES TABLE
-- Individual conversational turns, responses, and grounded RAG citations
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT chk_chat_messages_role CHECK (role IN ('user', 'assistant'))
);

COMMENT ON TABLE chat_messages IS 'Chat messages with role validation and grounded citation sources';
COMMENT ON COLUMN chat_messages.sources IS 'JSONB array of cited document chunk IDs, pages, and similarity scores';


-- ------------------------------------------------------------------------------
-- INDEXES
-- ------------------------------------------------------------------------------

-- Foreign key and lookup indexes for optimal relational join performance
CREATE INDEX IF NOT EXISTS idx_documents_vehicle_id ON documents(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_vehicle_variants_vehicle_id ON vehicle_variants(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_vehicle_id ON document_chunks(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_variant_id ON document_chunks(variant_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- HNSW Vector Index on document_chunks.embedding using Cosine Distance
-- m = 16: bi-directional links per node
-- ef_construction = 64: size of dynamic candidate list for index build quality
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding_hnsw 
ON document_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);


-- ------------------------------------------------------------------------------
-- VECTOR SIMILARITY SEARCH FUNCTION
-- Production RAG retrieval routine matching gemini-embedding-001 (768 dimensions)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION match_document_chunks(
    query_embedding VECTOR(768),
    similarity_threshold FLOAT DEFAULT 0.5,
    match_count INTEGER DEFAULT 5,
    filter_vehicle_id UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    document_id UUID,
    vehicle_id UUID,
    page_number INTEGER,
    similarity FLOAT,
    metadata JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER -- Executes using the authenticated caller's permissions, strictly respecting RLS
SET search_path = public, pg_temp
AS $$
DECLARE
    v_threshold FLOAT;
    v_limit INTEGER;
BEGIN
    -- Safely handle NULL or out-of-range similarity thresholds
    IF similarity_threshold IS NULL THEN
        v_threshold := 0.5;
    ELSIF similarity_threshold < 0.0 THEN
        v_threshold := 0.0;
    ELSIF similarity_threshold > 1.0 THEN
        v_threshold := 1.0;
    ELSE
        v_threshold := similarity_threshold;
    END IF;

    -- Safely handle NULL or out-of-range match count limits
    IF match_count IS NULL OR match_count <= 0 THEN
        v_limit := 5;
    ELSIF match_count > 100 THEN
        v_limit := 100;
    ELSE
        v_limit := match_count;
    END IF;

    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.document_id,
        dc.vehicle_id,
        dc.page_number,
        (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity,
        dc.metadata
    FROM document_chunks dc
    WHERE 
        dc.embedding IS NOT NULL
        AND (1 - (dc.embedding <=> query_embedding)) >= v_threshold
        AND (filter_vehicle_id IS NULL OR dc.vehicle_id = filter_vehicle_id)
    ORDER BY dc.embedding <=> query_embedding ASC
    LIMIT v_limit;
END;
$$;

COMMENT ON FUNCTION match_document_chunks IS 'Performs cosine vector similarity search over document chunks with vehicle filtering, safe threshold handling, and SECURITY INVOKER RLS compliance';


-- ------------------------------------------------------------------------------
-- SECURITY: ROW LEVEL SECURITY (RLS)
-- ------------------------------------------------------------------------------

-- Enable RLS on all six application tables (owned by the executing postgres/admin role)
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vehicle_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- 1. VEHICLES: Authenticated read access; modifications reserved for service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'vehicles' AND policyname = 'vehicles_select_authenticated'
    ) THEN
        CREATE POLICY vehicles_select_authenticated ON vehicles
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 2. VEHICLE_VARIANTS: Authenticated read access; modifications reserved for service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'vehicle_variants' AND policyname = 'vehicle_variants_select_authenticated'
    ) THEN
        CREATE POLICY vehicle_variants_select_authenticated ON vehicle_variants
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 3. DOCUMENTS: Authenticated read access; modifications reserved for service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'documents' AND policyname = 'documents_select_authenticated'
    ) THEN
        CREATE POLICY documents_select_authenticated ON documents
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 4. DOCUMENT_CHUNKS: Authenticated read access for RAG retrieval; modifications reserved for service_role
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'document_chunks' AND policyname = 'document_chunks_select_authenticated'
    ) THEN
        CREATE POLICY document_chunks_select_authenticated ON document_chunks
            FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 5. CHAT_SESSIONS: Strict user isolation based on auth.uid()
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_owner_select'
    ) THEN
        CREATE POLICY chat_sessions_owner_select ON chat_sessions
            FOR SELECT TO authenticated USING (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_owner_insert'
    ) THEN
        CREATE POLICY chat_sessions_owner_insert ON chat_sessions
            FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_owner_update'
    ) THEN
        CREATE POLICY chat_sessions_owner_update ON chat_sessions
            FOR UPDATE TO authenticated 
            USING (auth.uid() = user_id) 
            WITH CHECK (auth.uid() = user_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_sessions' AND policyname = 'chat_sessions_owner_delete'
    ) THEN
        CREATE POLICY chat_sessions_owner_delete ON chat_sessions
            FOR DELETE TO authenticated USING (auth.uid() = user_id);
    END IF;
END $$;

-- 6. CHAT_MESSAGES: Strict user isolation via session ownership
-- Enforces that messages can only be read, created, modified, or deleted by the session owner.
-- The WITH CHECK condition on UPDATE prevents moving a message to a session owned by another user.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_owner_select'
    ) THEN
        CREATE POLICY chat_messages_owner_select ON chat_messages
            FOR SELECT TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM chat_sessions cs
                    WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_owner_insert'
    ) THEN
        CREATE POLICY chat_messages_owner_insert ON chat_messages
            FOR INSERT TO authenticated WITH CHECK (
                EXISTS (
                    SELECT 1 FROM chat_sessions cs
                    WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_owner_update'
    ) THEN
        CREATE POLICY chat_messages_owner_update ON chat_messages
            FOR UPDATE TO authenticated 
            USING (
                EXISTS (
                    SELECT 1 FROM chat_sessions cs
                    WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM chat_sessions cs
                    WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
                )
            );
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_owner_delete'
    ) THEN
        CREATE POLICY chat_messages_owner_delete ON chat_messages
            FOR DELETE TO authenticated USING (
                EXISTS (
                    SELECT 1 FROM chat_sessions cs
                    WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
                )
            );
    END IF;
END $$;


-- ------------------------------------------------------------------------------
-- STORAGE: PRIVATE BUCKET SPECIFICATION
-- Bucket Name: automotive-brochures
-- ------------------------------------------------------------------------------

-- Safely register the private storage bucket if the Supabase storage schema exists.
-- Note: Supabase manages RLS on storage.objects internally. Do not execute ALTER TABLE
-- on storage.objects or storage.buckets as those are owned by supabase_storage_admin.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.schemata WHERE schema_name = 'storage'
    ) THEN
        -- Create or update private bucket with 20 MB file size limit and PDF-only restriction
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'automotive-brochures',
            'automotive-brochures',
            false,
            20971520, -- 20 MB in bytes (20 * 1024 * 1024)
            ARRAY['application/pdf']::text[]
        )
        ON CONFLICT (id) DO UPDATE SET
            public = false,
            file_size_limit = 20971520,
            allowed_mime_types = ARRAY['application/pdf']::text[];

        -- No public or client-side read/upload policies are created.
        -- Storage access is strictly mediated by the FastAPI backend using server-side service-role authentication.
    END IF;
END $$;
