-- ==============================================================================
-- Migration 002: Multi-User Production Authentication, RLS & Access Security
-- Safe, non-destructive, and idempotent. Preserves all existing records.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REUSABLE TRIGGER FUNCTIONS (With Fixed search_path)
-- ------------------------------------------------------------------------------

-- Generic updated_at timestamp trigger function with fixed search_path
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;


-- ------------------------------------------------------------------------------
-- 2. USER PROFILES TABLE & IMMUTABILITY GUARDS
-- ------------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles updated_at trigger
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_updated_at') THEN
        CREATE TRIGGER trg_profiles_updated_at
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_updated_at();
    END IF;
END $$;

-- Automatic profile sync from Supabase auth.users signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        email = EXCLUDED.email,
        updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT OR UPDATE OF raw_user_meta_data, email ON auth.users
            FOR EACH ROW
            EXECUTE FUNCTION public.handle_new_user();
    END IF;
END $$;

-- Immutability guard trigger: Prevents direct client tampering with profile ID and email
CREATE OR REPLACE FUNCTION public.protect_profile_immutable_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- Prevent modifying id directly
    IF NEW.id <> OLD.id THEN
        RAISE EXCEPTION 'Profile ID is strictly immutable.';
    END IF;

    -- Prevent direct client updates to email; email sync is governed strictly by auth.users trigger
    IF NEW.email <> OLD.email AND current_user NOT IN ('postgres', 'service_role') THEN
        IF pg_trigger_depth() <= 1 THEN
            RAISE EXCEPTION 'Email cannot be updated directly. It must be updated via Auth verification.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_profile_immutable_fields() FROM PUBLIC;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_profiles_protect_fields') THEN
        CREATE TRIGGER trg_profiles_protect_fields
            BEFORE UPDATE ON public.profiles
            FOR EACH ROW
            EXECUTE FUNCTION public.protect_profile_immutable_fields();
    END IF;
END $$;

-- Privacy helper: Exposes only display names, never email addresses
CREATE OR REPLACE FUNCTION public.get_user_display_name(user_id UUID)
RETURNS TEXT 
LANGUAGE sql 
STABLE 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT full_name FROM public.profiles WHERE id = user_id;
$$;

REVOKE ALL ON FUNCTION public.get_user_display_name(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_display_name(UUID) TO authenticated;


-- ------------------------------------------------------------------------------
-- 3. DOCUMENTS TABLE: TRACK UPLOADER
-- ------------------------------------------------------------------------------

ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON public.documents(uploaded_by);


-- ------------------------------------------------------------------------------
-- 4. VECTOR SEARCH FUNCTION (Quality Filter for Completed Brochures)
-- Strictly excludes chunks from failed, pending, or incomplete documents.
-- Preserves identical parameter signature and return columns for FastAPI compatibility.
-- ------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.match_document_chunks(
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
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_threshold FLOAT := COALESCE(similarity_threshold, 0.5);
    v_limit INTEGER := LEAST(COALESCE(match_count, 5), 100);
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.content,
        dc.document_id,
        dc.vehicle_id,
        dc.page_number,
        (1 - (dc.embedding <=> query_embedding))::FLOAT AS similarity,
        dc.metadata
    FROM public.document_chunks dc
    INNER JOIN public.documents d ON d.id = dc.document_id
    WHERE 
        dc.embedding IS NOT NULL
        AND d.processing_status = 'completed'  -- Exclude incomplete or failed brochures
        AND (1 - (dc.embedding <=> query_embedding)) >= v_threshold
        AND (filter_vehicle_id IS NULL OR dc.vehicle_id = filter_vehicle_id)
    ORDER BY dc.embedding <=> query_embedding ASC
    LIMIT v_limit;
END;
$$;


-- ------------------------------------------------------------------------------
-- 5. ROW-LEVEL SECURITY (RLS) POLICIES & CONFLICT RESOLUTION
-- Enables RLS and safely replaces existing/conflicting policies to prevent policy leakage.
-- ------------------------------------------------------------------------------

-- Ensure RLS is active across all application tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_variants ENABLE ROW LEVEL SECURITY;

-- Explicitly grant required table privileges to authenticated role so RLS policies are evaluated
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT ON public.document_chunks TO authenticated;
GRANT SELECT ON public.vehicles TO authenticated;
GRANT SELECT ON public.vehicle_variants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;

DO $$
BEGIN
    -- --------------------------------------------------------------------------
    -- 5.1 PROFILES: Strict Owner Privacy
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS profiles_owner_select ON public.profiles;
    DROP POLICY IF EXISTS profiles_owner_update ON public.profiles;

    -- Authenticated users can only read their own profile
    CREATE POLICY profiles_owner_select ON public.profiles 
        FOR SELECT TO authenticated USING (auth.uid() = id);

    -- Authenticated users can only update their own profile (field immutability guarded by trigger)
    CREATE POLICY profiles_owner_update ON public.profiles 
        FOR UPDATE TO authenticated 
        USING (auth.uid() = id) 
        WITH CHECK (auth.uid() = id);

    -- --------------------------------------------------------------------------
    -- 5.2 DOCUMENTS: Shared Read-Only for Clients (Modifications Mediated by FastAPI)
    -- Direct client INSERT, UPDATE, and DELETE are intentionally NOT granted to authenticated.
    -- Document upload, chunking, status updates, and deletions are strictly controlled
    -- by the FastAPI backend using service-role authorization.
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS documents_select_authenticated ON public.documents;
    DROP POLICY IF EXISTS documents_select_shared ON public.documents;
    DROP POLICY IF EXISTS documents_insert_authenticated ON public.documents;
    DROP POLICY IF EXISTS documents_update_authenticated ON public.documents;
    DROP POLICY IF EXISTS documents_update_owner ON public.documents;
    DROP POLICY IF EXISTS documents_delete_owner ON public.documents;

    -- All authenticated users can read completed brochures in the shared knowledge base, plus their own uploads
    CREATE POLICY documents_select_shared ON public.documents 
        FOR SELECT TO authenticated 
        USING (processing_status = 'completed' OR uploaded_by = auth.uid());

    -- --------------------------------------------------------------------------
    -- 5.3 DOCUMENT CHUNKS: Filtered Read Access Only
    -- Direct client modifications denied. Chunk ingestion reserved for backend service role.
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS document_chunks_select_authenticated ON public.document_chunks;
    DROP POLICY IF EXISTS document_chunks_select_completed ON public.document_chunks;
    DROP POLICY IF EXISTS document_chunks_insert_authenticated ON public.document_chunks;
    DROP POLICY IF EXISTS document_chunks_update_authenticated ON public.document_chunks;
    DROP POLICY IF EXISTS document_chunks_delete_authenticated ON public.document_chunks;

    -- Authenticated clients can only read chunks belonging to completed documents or their own uploads
    CREATE POLICY document_chunks_select_completed ON public.document_chunks
        FOR SELECT TO authenticated
        USING (
            EXISTS (
                SELECT 1 FROM public.documents d
                WHERE d.id = document_chunks.document_id
                AND (d.processing_status = 'completed' OR d.uploaded_by = auth.uid())
            )
        );

    -- --------------------------------------------------------------------------
    -- 5.4 CHAT SESSIONS: Strict User Isolation
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS chat_sessions_owner_select ON public.chat_sessions;
    DROP POLICY IF EXISTS chat_sessions_owner_insert ON public.chat_sessions;
    DROP POLICY IF EXISTS chat_sessions_owner_update ON public.chat_sessions;
    DROP POLICY IF EXISTS chat_sessions_owner_delete ON public.chat_sessions;

    CREATE POLICY chat_sessions_owner_select ON public.chat_sessions 
        FOR SELECT TO authenticated USING (auth.uid() = user_id);

    CREATE POLICY chat_sessions_owner_insert ON public.chat_sessions 
        FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

    CREATE POLICY chat_sessions_owner_update ON public.chat_sessions 
        FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

    CREATE POLICY chat_sessions_owner_delete ON public.chat_sessions 
        FOR DELETE TO authenticated USING (auth.uid() = user_id);

    -- --------------------------------------------------------------------------
    -- 5.5 CHAT MESSAGES: Strict Isolation via Session Ownership
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS chat_messages_owner_select ON public.chat_messages;
    DROP POLICY IF EXISTS chat_messages_owner_insert ON public.chat_messages;
    DROP POLICY IF EXISTS chat_messages_owner_update ON public.chat_messages;
    DROP POLICY IF EXISTS chat_messages_owner_delete ON public.chat_messages;

    CREATE POLICY chat_messages_owner_select ON public.chat_messages 
        FOR SELECT TO authenticated USING (
            EXISTS (
                SELECT 1 FROM public.chat_sessions cs 
                WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
            )
        );

    CREATE POLICY chat_messages_owner_insert ON public.chat_messages 
        FOR INSERT TO authenticated WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.chat_sessions cs 
                WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
            )
        );

    CREATE POLICY chat_messages_owner_update ON public.chat_messages 
        FOR UPDATE TO authenticated 
        USING (
            EXISTS (
                SELECT 1 FROM public.chat_sessions cs 
                WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
            )
        )
        WITH CHECK (
            EXISTS (
                SELECT 1 FROM public.chat_sessions cs 
                WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
            )
        );

    CREATE POLICY chat_messages_owner_delete ON public.chat_messages 
        FOR DELETE TO authenticated USING (
            EXISTS (
                SELECT 1 FROM public.chat_sessions cs 
                WHERE cs.id = chat_messages.session_id AND cs.user_id = auth.uid()
            )
        );

    -- --------------------------------------------------------------------------
    -- 5.6 VEHICLES & VEHICLE VARIANTS: Read-Only for Authenticated Users
    -- Direct client modifications denied. Managed exclusively by backend service role.
    -- --------------------------------------------------------------------------
    DROP POLICY IF EXISTS vehicles_select_authenticated ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_insert_authenticated ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_update_authenticated ON public.vehicles;
    DROP POLICY IF EXISTS vehicles_delete_authenticated ON public.vehicles;

    CREATE POLICY vehicles_select_authenticated ON public.vehicles 
        FOR SELECT TO authenticated USING (true);

    DROP POLICY IF EXISTS vehicle_variants_select_authenticated ON public.vehicle_variants;
    DROP POLICY IF EXISTS vehicle_variants_insert_authenticated ON public.vehicle_variants;
    DROP POLICY IF EXISTS vehicle_variants_update_authenticated ON public.vehicle_variants;
    DROP POLICY IF EXISTS vehicle_variants_delete_authenticated ON public.vehicle_variants;

    CREATE POLICY vehicle_variants_select_authenticated ON public.vehicle_variants 
        FOR SELECT TO authenticated USING (true);
END $$;


-- ------------------------------------------------------------------------------
-- 6. SUPABASE STORAGE SECURITY FOR 'automotive-brochures' BUCKET
-- Ensures bucket is strictly private.
-- Broad client SELECT/INSERT policies are removed.
-- All uploads, downloads, and deletions are strictly mediated through authorized
-- FastAPI backend endpoints using server-side service-role authentication.
-- ------------------------------------------------------------------------------

-- Ensure the bucket exists and is strictly private
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'automotive-brochures',
    'automotive-brochures',
    false, -- Strictly private
    20971520, -- 20 MB max
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = false,
    file_size_limit = 20971520,
    allowed_mime_types = ARRAY['application/pdf'];

-- Clean up any prior client-side storage policies to enforce private mediation
DO $$
BEGIN
    DROP POLICY IF EXISTS brochures_authenticated_select ON storage.objects;
    DROP POLICY IF EXISTS brochures_authenticated_insert ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can read brochures" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload brochures" ON storage.objects;
END $$;
