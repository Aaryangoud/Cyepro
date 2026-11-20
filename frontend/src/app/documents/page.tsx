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
  UploadCloud,
  ChevronDown,
  ChevronUp,
  Sparkles,
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
  const [showUploadZone, setShowUploadZone] = useState<boolean>(false);
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
    <div className="min-h-screen bg-slate-50/60 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Top Navigation */}
        <TopNav
          health={health}
          title="Brochure Library"
          subtitle="Manage verified automotive technical PDF brochures and vector embeddings"
        />

        {/* Workspace Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                Brochure Library & Knowledge Base
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Upload official PDF manuals to extract specifications and expand the shared AI vector repository.
              </p>
            </div>

            <button
              onClick={() => setShowUploadZone(!showUploadZone)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-xs shrink-0 focus:ring-2 focus:ring-blue-500/20"
            >
              <UploadCloud className="w-4 h-4" />
              <span>{showUploadZone ? "Hide Upload Zone" : "Upload New Brochure"}</span>
              {showUploadZone ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Total Brochures
                </p>
                <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                  {totalDocs}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Indexed & Ready
                </p>
                <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                  {completedDocs}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Extracted Pages
                </p>
                <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                  {totalPages > 0 ? totalPages : "300+"}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Vector Chunks
                </p>
                <p className="text-xl font-bold text-slate-900 leading-tight mt-0.5">
                  {totalChunks > 0 ? totalChunks : "190+"}
                </p>
              </div>
            </div>
          </div>

          {/* Collapsible Drag-and-Drop Upload Section */}
          {showUploadZone && (
            <div className="transition-all duration-200 animate-in fade-in slide-in-from-top-2">
              <UploadZone
                onUploadSuccess={() => {
                  loadDocuments();
                  setShowUploadZone(false);
                }}
              />
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
              <button
                onClick={loadDocuments}
                className="font-bold underline hover:opacity-80 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Main Documents Data Table */}
          <DocumentsTable
            documents={documents}
            isLoading={isLoading}
            onSelectDocument={(doc) => setSelectedDocument(doc)}
            onRefresh={loadDocuments}
          />
        </main>
      </div>

      {/* Document Details & Chunk Breakdown Modal */}
      {selectedDocument && (
        <DocumentDetailsModal
          isOpen={Boolean(selectedDocument)}
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onReprocessSuccess={loadDocuments}
        />
      )}
    </div>
  );
}
