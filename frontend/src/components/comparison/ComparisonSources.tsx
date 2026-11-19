"use client";

import React, { useState } from "react";
import { FileText, ChevronDown, ChevronUp, ShieldCheck, ExternalLink } from "lucide-react";
import { ChatSourceItem } from "@/lib/types";

interface ComparisonSourcesProps {
  sources: ChatSourceItem[];
}

export function ComparisonSources({ sources }: ComparisonSourcesProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (!sources || sources.length === 0) return null;

  // Group sources by document name
  const docCounts = sources.reduce((acc: Record<string, number>, s) => {
    acc[s.document_name] = (acc[s.document_name] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Accordion Header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/60 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              Verified Source Citations & PDF Pages
            </h4>
            <p className="text-xs text-slate-500">
              {sources.length} brochure passages referenced across {Object.keys(docCounts).join(", ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span>{isOpen ? "Hide Sources" : "View Source Passages"}</span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Accordion Content */}
      {isOpen && (
        <div className="p-4 sm:p-5 pt-0 border-t border-slate-100 bg-slate-50/40 space-y-2.5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            {sources.map((src, idx) => (
              <div
                key={idx}
                className="p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-1.5 shadow-2xs hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span className="font-semibold text-slate-800 truncate">
                      {src.document_name}
                    </span>
                  </div>

                  {src.page_number && (
                    <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded shrink-0">
                      Page {src.page_number}
                    </span>
                  )}
                </div>

                {src.excerpt && (
                  <p className="text-[11px] text-slate-500 italic line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100 font-serif leading-relaxed">
                    &ldquo;{src.excerpt}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
