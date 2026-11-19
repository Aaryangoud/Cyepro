import React from "react";
import { FileText, PlusCircle } from "lucide-react";
import Link from "next/link";

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  actionHref?: string;
}

export function EmptyState({
  title = "No documents found",
  description = "No automotive brochures or technical manuals have been uploaded yet.",
  actionText = "Upload Brochure",
  actionHref = "/documents",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white border border-dashed border-slate-300 rounded-xl text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
        <FileText className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">{description}</p>
      {actionText && actionHref && (
        <Link
          href={actionHref}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          {actionText}
        </Link>
      )}
    </div>
  );
}
