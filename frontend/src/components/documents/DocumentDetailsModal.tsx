"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileText,
  Layers,
  Calendar,
  Hash,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Download,
  Trash2,
  User,
  Shield,
} from "lucide-react";
import { DocumentItem, DocumentChunkItem } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";
import { processDocument, fetchDocumentChunks, getDocumentDownloadUrl, deleteDocument } from "@/lib/api";

interface DocumentDetailsModalProps {
  document: DocumentItem | null;
  isOpen: boolean;
  onClose: () => void;
  onReprocessSuccess: () => void;
}

export function DocumentDetailsModal({
  document,
  isOpen,
  onClose,
  onReprocessSuccess,
}: DocumentDetailsModalProps) {
  const [chunks, setChunks] = useState<DocumentChunkItem[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error" | null;
    text: string;
  }>({ type: null, text: "" });
  const [copiedHash, setCopiedHash] = useState(false);

  useEffect(() => {
    if (document && isOpen) {
      setActionMessage({ type: null, text: "" });
      loadChunks(document.id);
    }
  }, [document, isOpen]);

  const loadChunks = async (docId: string) => {
    setLoadingChunks(true);
    try {
      const data = await fetchDocumentChunks(docId);
      setChunks(data.chunks || []);
    } catch {
      setChunks([]);
    } finally {
      setLoadingChunks(false);
    }
  };

  const handleReprocess = async () => {
    if (!document) return;
    setIsReprocessing(true);
    setActionMessage({ type: null, text: "" });

    try {
      const result = await processDocument(document.id);
      setActionMessage({
        type: "success",
        text: `Reprocessed successfully! Generated ${result.chunks_created} chunks and stored ${result.embeddings_stored} embeddings in pgvector.`,
      });
      loadChunks(document.id);
      onReprocessSuccess();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to reprocess document.",
      });
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleDownload = async () => {
    if (!document) return;
    setIsDownloading(true);
    try {
      const res = await getDocumentDownloadUrl(document.id);
      if (res.download_url) {
        window.open(res.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to generate download URL.",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!document) return;
    if (!confirm(`Are you sure you want to permanently delete '${document.file_name}'?`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await deleteDocument(document.id);
      onReprocessSuccess();
      onClose();
    } catch (err: any) {
      setActionMessage({
        type: "error",
        text: err.message || "Failed to delete document.",
      });
      setIsDeleting(false);
    }
  };

  const copyToClipboard = (text?: string | null) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  if (!isOpen || !document) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 truncate max-w-md">
                {document.file_name}
              </h2>
              <p className="text-[11px] text-slate-500 font-mono">
                ID: {document.id}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Action Notification */}
          {actionMessage.type && (
            <div
              className={`p-3.5 rounded-lg text-xs flex items-start gap-2.5 ${
                actionMessage.type === "success"
                  ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                  : "bg-rose-50 border border-rose-200 text-rose-800"
              }`}
            >
              {actionMessage.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              )}
              <div className="font-medium">{actionMessage.text}</div>
            </div>
          )}

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Processing Status</span>
              <div className="mt-1.5">
                <StatusBadge status={document.processing_status} />
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Ownership</span>
              <div className="mt-1.5">
                {document.is_owner ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                    <User className="w-3.5 h-3.5" />
                    Uploaded by you
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs text-slate-600">
                    <Shield className="w-3.5 h-3.5 text-slate-400" />
                    Shared Knowledge
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Total Pages</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {document.total_pages ?? "—"} pages
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Vector Chunks</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {document.chunks_count ?? chunks.length} chunks
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">File Size</span>
              <div className="text-sm font-semibold text-slate-800 mt-1">
                {document.file_size_bytes > 0
                  ? `${(document.file_size_bytes / 1024).toFixed(1)} KB`
                  : "—"}
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">PDF Access</span>
              <div className="mt-1">
                <button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  <Download className={`w-3.5 h-3.5 ${isDownloading ? "animate-spin" : ""}`} />
                  View Original PDF
                </button>
              </div>
            </div>
          </div>

          {/* SHA-256 Checksum Card */}
          {document.file_hash && (
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="min-w-0 pr-3">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
                  <Hash className="w-3.5 h-3.5 text-blue-600" />
                  <span>SHA-256 Checksum (Duplicate Protection)</span>
                </div>
                <div className="font-mono text-xs text-slate-700 truncate mt-1">
                  {document.file_hash}
                </div>
              </div>
              <button
                onClick={() => copyToClipboard(document.file_hash)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-200 transition-colors"
                title="Copy SHA-256 Hash"
              >
                {copiedHash ? (
                  <Check className="w-4 h-4 text-emerald-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          )}

          {/* Vector Chunks Preview */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Indexed Vector Chunks ({chunks.length})</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                pgvector VECTOR(768)
              </span>
            </div>

            {loadingChunks ? (
              <div className="h-24 flex items-center justify-center text-xs text-slate-400">
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Loading chunks...
              </div>
            ) : chunks.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-center text-xs text-slate-400">
                No vector chunks found. Click &quot;Reprocess Document&quot; below to generate embeddings.
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {chunks.map((chk) => (
                  <div
                    key={chk.id}
                    className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-700"
                  >
                    <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 mb-1">
                      <span>Chunk #{chk.chunk_index}</span>
                      <span>Page {chk.page_number}</span>
                    </div>
                    <p className="line-clamp-2 text-slate-600 leading-relaxed font-normal">
                      {chk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            {document.is_owner && (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? "Deleting..." : "Delete Brochure"}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReprocess}
              disabled={isReprocessing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? "animate-spin" : ""}`} />
              <span>{isReprocessing ? "Reprocessing..." : "Reprocess Document"}</span>
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
