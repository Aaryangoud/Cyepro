-- ==============================================================================
-- Migration: 001_add_document_file_hash.sql
-- Purpose: Add SHA-256 cryptographic content hash to documents table with unique constraint
-- ==============================================================================

-- 1. Add file_hash column (64-character hexadecimal SHA-256 string)
ALTER TABLE public.documents 
ADD COLUMN IF NOT EXISTS file_hash VARCHAR(64);

COMMENT ON COLUMN public.documents.file_hash IS 'SHA-256 cryptographic hexadecimal checksum for duplicate detection';

-- 2. Create unique index to guarantee database-level concurrency protection
-- against duplicate PDF uploads
CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_file_hash 
ON public.documents (file_hash) 
WHERE file_hash IS NOT NULL;

-- 3. Backfill existing uploaded documents with their verified SHA-256 hashes
UPDATE public.documents 
SET file_hash = '7a808f42415d006f024eb582f361d68faeed6f0e8f3ae394861d4b702db82627' 
WHERE file_name = 'macan_ev.pdf' AND file_hash IS NULL;

UPDATE public.documents 
SET file_hash = 'aaacd5108dfe47d54aeab14c20e923dd83a2ca19aea7c808e7aff4f3352edf4b' 
WHERE file_name = 'alcazar.pdf' AND file_hash IS NULL;

UPDATE public.documents 
SET file_hash = 'cc80b7d123a38c8c748a47f8e63be29fa3acaabb947a4617a09311505a315aba' 
WHERE file_name = 'bayon.pdf' AND file_hash IS NULL;
