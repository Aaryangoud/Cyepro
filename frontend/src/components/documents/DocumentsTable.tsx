"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  FileText,
  Eye,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Database,
  Layers,
  Calendar,
  X,
  Trash2,
  Download,
  User,
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import { DocumentItem, ProcessingStatus } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { processDocument, getDocumentDownloadUrl, deleteDocument } from "@/lib/api";

interface DocumentsTableProps {
  documents: DocumentItem[];
  isLoading: boolean;
  onSelectDocument: (doc: DocumentItem) => void;
  onRefresh: () => void;
}

export function DocumentsTable({
  documents,
  isLoading,
  onSelectDocument,
  onRefresh,
}: DocumentsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<string>("all");
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [inlineNotification, setInlineNotification] = useState<{
    id: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === "" ||
        doc.file_name.toLowerCase().includes(q) ||
        (doc.uploader_name && doc.uploader_name.toLowerCase().includes(q)) ||
        doc.id.toLowerCase().includes(q);

      const matchesStatus =
        statusFilter === "all" ||
        doc.processing_status.toLowerCase() === statusFilter.toLowerCase();

      const matchesOwnership =
        ownershipFilter === "all" ||
        (ownershipFilter === "mine" && doc.is_owner) ||
        (ownershipFilter === "shared" && !doc.is_owner);

      return matchesSearch && matchesStatus && matchesOwnership;
    });
  }, [documents, searchQuery, statusFilter, ownershipFilter]);

  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDate = (dateStr?: string | null): string => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const handleReprocess = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    try {
      setReprocessingId(doc.id);
      setInlineNotification(null);
      await processDocument(doc.id);
      setInlineNotification({
        id: doc.id,
        type: "success",
        message: `Successfully reprocessed ${doc.file_name}`,
      });
      onRefresh();
    } catch (err: any) {
      setInlineNotification({
        id: doc.id,
        type: "error",
        message: err.message || "Reprocessing failed.",
      });
    } finally {
      setReprocessingId(null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    try {
      setDownloadingId(doc.id);
      const res = await getDocumentDownloadUrl(doc.id);
      if (res.download_url) {
        window.open(res.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setInlineNotification({
        id: doc.id,
        type: "error",
        message: err.message || "Failed to generate download link.",
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const confirmDelete = async () => {
    if (!docToDelete) return;

    setIsDeleting(true);
    try {
      await deleteDocument(docToDelete.id);
      setInlineNotification({
        id: docToDelete.id,
        type: "success",
        message: `Brochure '${docToDelete.file_name}' deleted successfully.`,
      });
      onRefresh();
    } catch (err: any) {
      setInlineNotification({
        id: docToDelete.id,
        type: "error",
        message: err.message || "Failed to delete brochure.",
      });
    } finally {
      setIsDeleting(false);
      setDocToDelete(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col gap-4 bg-slate-50/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>Brochure Knowledge Catalog</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
                {filteredDocuments.length} of {documents.length}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified official automotive PDFs accessible to all authenticated users
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50"
              title="Refresh list"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : "text-slate-500"}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by brochure or vehicle name..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-2xs"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {["all", "completed", "processing", "failed"].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl capitalize transition-all shrink-0 ${
                  statusFilter === st
                    ? "bg-slate-900 text-white shadow-2xs"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Ownership Filter */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setOwnershipFilter(ownershipFilter === "mine" ? "all" : "mine")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all ${
                ownershipFilter === "mine"
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              Uploaded by you
            </button>
          </div>
        </div>
      </div>

      {/* Inline Notification Banner */}
      {inlineNotification && (
        <div
          className={`px-5 py-3 text-xs flex items-center justify-between border-b ${
            inlineNotification.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-100"
              : "bg-rose-50 text-rose-800 border-rose-100"
          }`}
        >
          <div className="flex items-center gap-2">
            {inlineNotification.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="font-medium">{inlineNotification.message}</span>
          </div>
          <button
            onClick={() => setInlineNotification(null)}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table Body */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-5">Technical Brochure</th>
              <th className="py-3 px-4">Knowledge Scope</th>
              <th className="py-3 px-4">Pages & Size</th>
              <th className="py-3 px-4">Ingestion Date</th>
              <th className="py-3 px-4">Processing Status</th>
              <th className="py-3 px-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading && documents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-xs">Loading brochure catalog...</span>
                  </div>
                </td>
              </tr>
            ) : filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-500">
                  <div className="max-w-sm mx-auto space-y-2">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-800 text-xs">No matching brochures found</p>
                    <p className="text-[11px] text-slate-400">
                      Try clearing filters or search queries to view available automotive brochures.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                >
                  {/* File & Vehicle Name */}
                  <td className="py-3.5 px-5 min-w-[220px]">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {doc.file_name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-[180px]">
                          {doc.id}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* Ownership & Scope */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    {doc.is_owner ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                        <User className="w-3 h-3 text-blue-600" />
                        Uploaded by you
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <Shield className="w-3 h-3 text-slate-400" />
                        Shared Knowledge
                      </span>
                    )}
                  </td>

                  {/* Pages & Size */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                    <div className="space-y-0.5">
                      <span className="font-medium text-slate-800">
                        {doc.total_pages ? `${doc.total_pages} pages` : "—"}
                      </span>
                      <span className="text-[11px] text-slate-400 block">
                        {formatFileSize(doc.file_size_bytes)}
                      </span>
                    </div>
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-500 font-medium">
                    {formatDate(doc.created_at)}
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={doc.processing_status} />
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {/* View Details */}
                      <button
                        onClick={() => onSelectDocument(doc)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="View details & chunks"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Download Brochure (Backend Signed URL) */}
                      <button
                        onClick={(e) => handleDownload(e, doc)}
                        disabled={downloadingId === doc.id}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Download official PDF brochure"
                      >
                        {downloadingId === doc.id ? (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                        ) : (
                          <Download className="w-4 h-4" />
                        )}
                      </button>

                      {/* Reprocess action if failed or incomplete */}
                      {doc.processing_status.toLowerCase() !== "completed" && (
                        <button
                          onClick={(e) => handleReprocess(e, doc)}
                          disabled={reprocessingId === doc.id}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Reprocess brochure text & embeddings"
                        >
                          <RefreshCw
                            className={`w-4 h-4 ${
                              reprocessingId === doc.id ? "animate-spin text-emerald-600" : ""
                            }`}
                          />
                        </button>
                      )}

                      {/* Delete Brochure (Strictly Scoped to Uploader) */}
                      {doc.is_owner && (
                        <button
                          onClick={() => setDocToDelete(doc)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete brochure from shared knowledge base"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Dialog for Deleting Document */}
      <ConfirmDialog
        isOpen={Boolean(docToDelete)}
        title="Delete Brochure"
        message={`Are you sure you want to permanently delete '${docToDelete?.file_name}'? This will remove the PDF from Supabase Storage and purge all associated vector embeddings from the shared knowledge base.`}
        confirmText="Delete Brochure"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onClose={() => setDocToDelete(null)}
      />
    </div>
  );
}
