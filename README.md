# Automotive AI Assistant

A production-ready Automotive AI Assistant engineered with a modern Full-Stack AI/ML architecture. The platform combines Retrieval-Augmented Generation (RAG) powered by Google Gemini, high-speed document processing with PyMuPDF, vector similarity search via Supabase PostgreSQL (`pgvector`), a modular Python FastAPI backend, and a Next.js (TypeScript & Tailwind CSS) frontend with automotive-grade UI styling.

---

## Technology Stack

### Frontend
- **Framework**: Next.js (App Router, React 19)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Iconography**: Lucide React
- **Design Philosophy**: Premium automotive technology aesthetic — clean white/light background, dark charcoal typography, subtle blue accents, and responsive layout.

### Backend
- **Framework**: Python FastAPI
- **Architecture**: Asynchronous RESTful APIs with modular core, api, services, rag, and models
- **Document Ingestion**: PyMuPDF (`fitz`) for PDF text & structure extraction
- **Validation**: Pydantic v2 & Pydantic Settings
- **ASGI Server**: Uvicorn

### Database & Vector Storage
- **Database**: Supabase PostgreSQL
- **Vector Search**: `pgvector` extension with HNSW cosine similarity index
- **Dimensions**: 768-dimensional embeddings (`gemini-embedding-001`)

### Artificial Intelligence & RAG
- **LLM**: Google Gemini API (Configurable via `GEMINI_MODEL`, default: `gemini-1.5-flash`)
- **Embeddings**: Google Gemini Embedding API (`gemini-embedding-001`, output dimensionality: 768)
- **Pipeline**: Retrieval Augmented Generation (RAG) for vehicle technical manuals and diagnostic data

---

## Project Structure

```
automotive-ai-assistant/
├── frontend/                     # Next.js TypeScript application
│   ├── src/
│   │   └── app/
│   │       ├── globals.css       # Tailwind CSS configuration
│   │       ├── layout.tsx        # Root HTML layout and fonts
│   │       └── page.tsx          # Initial automotive tech dashboard
│   ├── public/                   # Static assets
│   ├── package.json              # Frontend dependencies and scripts
│   ├── tsconfig.json             # TypeScript configuration
│   └── next.config.ts            # Next.js build configuration
├── backend/                      # Python FastAPI application
│   ├── app/
│   │   ├── __init__.py
│   │   ├── api/                  # REST API routes and endpoints
│   │   │   ├── __init__.py
│   │   │   └── endpoints.py      # Health check and API router
│   │   ├── core/                 # Core configurations and settings
│   │   │   ├── __init__.py
│   │   │   └── config.py         # Environment and app settings
│   │   ├── models/               # Pydantic data schemas
│   │   │   ├── __init__.py
│   │   │   └── schemas.py
│   │   ├── rag/                  # RAG pipeline & Gemini embeddings
│   │   │   └── __init__.py
│   │   ├── services/             # Document extraction & business logic
│   │   │   └── __init__.py
│   │   └── main.py               # FastAPI application entrypoint
│   ├── .env.example              # Environment variables template
│   └── requirements.txt          # Python dependencies
├── database/
│   └── schema.sql                # Supabase PostgreSQL & pgvector schema
├── docs/
│   └── architecture.md           # System architecture overview
├── .gitignore                    # Root gitignore for frontend and backend
└── README.md                     # Project documentation
```

---

## Prerequisites

- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **Python**: v3.10 or later
- **Supabase Account**: (For PostgreSQL + `pgvector` database)
- **Google AI Studio API Key**: (For Google Gemini models and embeddings)

---

## Installation & Setup

### 1. Backend Setup

1. Open a terminal and navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create and activate a Python virtual environment:
   - **Windows (PowerShell)**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\Activate.ps1
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. Install required Python packages:
   ```bash
   pip install -r requirements.txt
   ```

4. Configure environment variables:
   - Copy the `.env.example` file to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Add your Google Gemini API key and Supabase database credentials to `.env`.

### 2. Frontend Setup

1. Open a terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Startup Commands

Both frontend and backend are independently executable.

### Start Backend API Server
From the `backend` directory (with virtual environment activated):
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
- **Backend API Base**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc Documentation**: `http://localhost:8000/redoc`
- **Health Check Endpoint**: `http://localhost:8000/api/v1/health`

### Start Frontend Application
From the `frontend` directory:
```bash
npm run dev
```
- **Frontend URL**: `http://localhost:3000`

---

## Database Configuration (Supabase PostgreSQL + pgvector)

### Step 1: Open Supabase Project
1. Navigate to the [Supabase Dashboard](https://app.supabase.com) and select your project.
2. In the left navigation sidebar, click on **SQL Editor**.

### Step 2: Execute Schema Script
1. Click **New query** in the SQL Editor.
2. Open [database/schema.sql](file:///d:/Cyepro/database/schema.sql), copy its entire content, and paste it into the query editor.
3. Click **Run** (or press `Ctrl + Enter` / `Cmd + Enter`).
4. The script safely and repeatably executes:
   - Enables `vector`, `uuid-ossp`, and `pgcrypto` extensions.
   - Creates the six core tables: `vehicles`, `vehicle_variants`, `documents`, `document_chunks`, `chat_sessions`, and `chat_messages`.
   - Creates `updated_at` triggers and foreign key lookup indexes.
   - Builds the **HNSW vector index** on `document_chunks.embedding` using cosine distance.
   - Installs the `match_document_chunks` stored procedure with boundary validation and vehicle filtering.
   - Enables **Row Level Security (RLS)** and user isolation policies on all six tables.
   - Configures the private `automotive-brochures` Supabase Storage bucket (20 MB limit, PDF only, private).

### Step 3: Verify Installation
Run this verification query in the SQL Editor:
```sql
-- Verify all 6 tables exist and RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('vehicles', 'vehicle_variants', 'documents', 'document_chunks', 'chat_sessions', 'chat_messages');

-- Verify pgvector extension
SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';

-- Verify the HNSW vector index
SELECT indexname, indexdef FROM pg_indexes WHERE indexname = 'idx_document_chunks_embedding_hnsw';
```

---

## Storage Configuration (Private PDF Bucket)

The private bucket `automotive-brochures` is automatically initialized by `schema.sql`:
- **Bucket ID**: `automotive-brochures`
- **Visibility**: Private (`public = false`)
- **Allowed MIME Types**: `application/pdf`
- **Max Upload Size**: 20 MB (`20,971,520` bytes)
- **RLS Policy**: Read access for authenticated users; write access reserved for backend service role.

---

## Security & Guidelines
- No API keys, credentials, or secrets are hardcoded.
- All secrets are loaded through `.env` files and validated via Pydantic settings.
- Build artifacts, virtual environments, caches, and sensitive files are ignored via `.gitignore`.
