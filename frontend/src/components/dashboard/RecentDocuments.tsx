import React from "react";
import Link from "next/link";
import { FileText, ArrowRight, Layers, Calendar, ExternalLink } from "lucide-react";
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
  if (!dateStr) return "Just now";
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
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="h-5 w-44 bg-slate-100 rounded-md animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-slate-50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Recent Ingested Brochures
          </h2>
          <p className="text-xs text-slate-500">
            Latest vehicle documentation processed in Supabase vector store
          </p>
        </div>

        {documents.length > 0 && (
          <Link
            href="/documents"
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>

      {documents.length === 0 ? (
        <EmptyState
          title="No Brochures Ingested"
          description="Upload your first technical brochure to generate 768-dimensional vector embeddings."
          actionText="Upload First PDF"
          actionHref="/documents"
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Document Name</th>
                <th className="pb-3 font-semibold">Pages / Chunks</th>
                <th className="pb-3 font-semibold">File Size</th>
                <th className="pb-3 font-semibold">Ingestion Date</th>
                <th className="pb-3 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/70 transition-colors group">
                  <td className="py-3.5 pr-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-medium text-slate-800 truncate max-w-[200px] sm:max-w-xs">
                        {doc.file_name}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 pr-4 text-slate-600">
                    <div className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>{doc.total_pages ?? "—"} pgs</span>
                      {doc.chunks_count > 0 && (
                        <span className="text-slate-400 text-[11px]">
                          ({doc.chunks_count} chunks)
                        </span>
                      )}
                    </div>
                  </td>

                  <td className="py-3.5 pr-4 text-slate-500">
                    {formatBytes(doc.file_size_bytes)}
                  </td>

                  <td className="py-3.5 pr-4 text-slate-500">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </td>

                  <td className="py-3.5 text-right">
                    <StatusBadge status={doc.processing_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
