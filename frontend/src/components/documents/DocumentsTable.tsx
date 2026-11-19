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
} from "lucide-react";
import { DocumentItem, ProcessingStatus } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";
import { processDocument } from "@/lib/api";

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
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [inlineNotification, setInlineNotification] = useState<{
    id: string;
    type: "success" | "error";
    message: string;
  } | null>(null);

  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.id.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        statusFilter === "all" ||
        doc.processing_status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter]);

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
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
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
        message: err.message || "Reprocessing failed",
      });
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">Brochure Catalog</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
            {filteredDocuments.length} of {documents.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by filename..."
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative flex items-center">
            <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh document list"
            className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 bg-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
          </button>
        </div>
      </div>

      {/* Inline Notification Banner if reprocessed */}
      {inlineNotification && (
        <div
          className={`px-4 py-2.5 text-xs border-b flex items-center justify-between ${
            inlineNotification.type === "success"
              ? "bg-emerald-50 border-emerald-100 text-emerald-800"
              : "bg-rose-50 border-rose-100 text-rose-800"
          }`}
        >
          <span>{inlineNotification.message}</span>
          <button
            onClick={() => setInlineNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4 sm:px-6">Document Details</th>
              <th className="py-3 px-4">Pages & Chunks</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Ingested At</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right pr-6">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                    <span>Loading documents catalog...</span>
                  </div>
                </td>
              </tr>
            ) : filteredDocuments.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
                      <FileText className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-semibold text-slate-800">No documents found</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {searchQuery || statusFilter !== "all"
                        ? "No documents match your filter criteria. Try resetting the filters."
                        : "No brochures have been uploaded yet. Upload a PDF using the dropzone above."}
                    </p>
                    {(searchQuery || statusFilter !== "all") && (
                      <button
                        onClick={() => {
                          setSearchQuery("");
                          setStatusFilter("all");
                        }}
                        className="mt-3 text-xs font-semibold text-blue-600 hover:text-blue-700 underline"
                      >
                        Reset filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredDocuments.map((doc) => (
                <tr
                  key={doc.id}
                  onClick={() => onSelectDocument(doc)}
                  className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                >
                  {/* File Name & Identifier */}
                  <td className="py-3.5 px-4 sm:px-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <FileText className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 max-w-xs sm:max-w-sm">
                        <div className="font-semibold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                          {doc.file_name}
                        </div>
                        <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                          ID: {doc.id}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Pages & Chunks */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <FileText className="w-3 h-3 text-slate-400" />
                        {doc.total_pages ?? "—"} pgs
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {doc.chunks_count ?? 0} chunks
                      </span>
                    </div>
                  </td>

                  {/* Size */}
                  <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                    {formatFileSize(doc.file_size_bytes)}
                  </td>

                  {/* Date */}
                  <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                    {formatDate(doc.created_at)}
                  </td>

                  {/* Status */}
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={doc.processing_status} />
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 px-4 text-right pr-6 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onSelectDocument(doc)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-blue-50 hover:text-blue-700 rounded-md transition-colors"
                        title="Inspect Document Details & Chunks"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>

                      <button
                        onClick={(e) => handleReprocess(e, doc)}
                        disabled={reprocessingId === doc.id}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors disabled:opacity-50"
                        title="Re-extract and regenerate vector embeddings"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            reprocessingId === doc.id ? "animate-spin text-blue-600" : ""
                          }`}
                        />
                        Reprocess
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
