"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Layers,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  HardDrive,
  Database,
  Info,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { UploadZone } from "@/components/documents/UploadZone";
import { DocumentsTable } from "@/components/documents/DocumentsTable";
import { DocumentDetailsModal } from "@/components/documents/DocumentDetailsModal";
import { fetchDocumentsList, fetchDashboardData } from "@/lib/api";
import { DocumentItem, SystemHealth } from "@/lib/types";

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [health, setHealth] = useState<SystemHealth>({
    appStatus: "checking",
    dbStatus: "checking",
  });

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [docsData, dashData] = await Promise.allSettled([
        fetchDocumentsList(),
        fetchDashboardData(),
      ]);

      if (docsData.status === "fulfilled") {
        setDocuments(docsData.value);
      } else {
        throw docsData.reason;
      }

      if (dashData.status === "fulfilled") {
        setHealth(dashData.value.health);
      }
    } catch (err: any) {
      console.error("Failed to fetch documents:", err);
      setError(
        err.message ||
          "Unable to load documents from the backend. Ensure FastAPI server is running."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Aggregate stats
  const totalDocs = documents.length;
  const completedDocs = documents.filter(
    (d) => d.processing_status.toLowerCase() === "completed"
  ).length;
  const totalChunks = documents.reduce((acc, d) => acc + (d.chunks_count || 0), 0);
  const totalPages = documents.reduce((acc, d) => acc + (d.total_pages || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Top Navigation */}
        <TopNav
          health={health}
          title="Brochures & Document Management"
          subtitle="Manage automotive technical PDFs, PyMuPDF chunking, and Supabase Storage"
        />

        {/* Workspace Container */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Total PDFs
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
                  {totalDocs}
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Indexed
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
                  {completedDocs}
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Vector Chunks
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
                  {totalChunks}
                </p>
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-sm flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 shrink-0">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Extracted Pages
                </p>
                <p className="text-lg font-bold text-slate-900 leading-tight mt-0.5">
                  {totalPages}
                </p>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3 text-rose-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <div className="flex-1">
                <span className="font-semibold">Backend Connection Issue:</span> {error}
              </div>
              <button
                onClick={loadDocuments}
                className="px-2.5 py-1 bg-white border border-rose-300 text-rose-700 rounded-md font-medium hover:bg-rose-100 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Section 1: Upload Dropzone */}
          <section>
            <div className="mb-2.5">
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                Upload New Automotive Brochure
              </h2>
              <p className="text-xs text-slate-500">
                PDFs are checked with SHA-256 to prevent duplicate storage, then securely saved to
                the private Supabase bucket.
              </p>
            </div>
            <UploadZone onUploadSuccess={loadDocuments} />
          </section>

          {/* Section 2: Documents Catalog Table */}
          <section>
            <DocumentsTable
              documents={documents}
              isLoading={isLoading}
              onSelectDocument={(doc) => setSelectedDocument(doc)}
              onRefresh={loadDocuments}
            />
          </section>

          {/* Document Details Modal */}
          <DocumentDetailsModal
            document={selectedDocument}
            isOpen={!!selectedDocument}
            onClose={() => setSelectedDocument(null)}
            onReprocessSuccess={loadDocuments}
          />
        </main>
      </div>
    </div>
  );
}
