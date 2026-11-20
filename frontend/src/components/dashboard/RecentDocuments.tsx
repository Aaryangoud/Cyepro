import React from "react";
import Link from "next/link";
import { FileText, ArrowRight, Layers, Calendar, ExternalLink, HardDrive } from "lucide-react";
import { DocumentItem } from "@/lib/types";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface RecentDocumentsProps {
  documents: DocumentItem[];
  isLoading?: boolean;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(1)} ${units[i]}`;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "Recently";
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
}

export function RecentDocuments({ documents, isLoading }: RecentDocumentsProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-14 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Recently Ingested Technical Brochures
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            PDF technical specifications synchronized with the pgvector knowledge base
          </p>
        </div>
        <Link
          href="/documents"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>View All</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No Brochures Ingested"
          description="Upload vehicle PDF brochures to initialize the vector database and enable AI grounded queries."
          actionText="Upload First Brochure"
          actionHref="/documents"
        />
      ) : (
        <div className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="py-3 flex items-center justify-between gap-4 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">
                    {doc.file_name}
                  </p>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                    {doc.total_pages && (
                      <span className="flex items-center gap-1">
                        <Layers className="w-3 h-3 text-slate-400" />
                        {doc.total_pages} {doc.total_pages === 1 ? "page" : "pages"}
                      </span>
                    )}
                    {doc.file_size_bytes && (
                      <span className="flex items-center gap-1">
                        <HardDrive className="w-3 h-3 text-slate-400" />
                        {formatBytes(doc.file_size_bytes)}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-400">
                      <Calendar className="w-3 h-3" />
                      {formatDate(doc.created_at)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <StatusBadge status={doc.processing_status} />
                <Link
                  href="/documents"
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                  title="View in Library"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
