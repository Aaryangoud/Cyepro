"use client";

import React from "react";
import { Sparkles, ShieldAlert, Scale, CheckCircle2 } from "lucide-react";

interface ComparisonSummaryProps {
  summary: string;
  vehicle1Name: string;
  vehicle2Name: string;
  criteria?: string | null;
}

export function ComparisonSummary({
  summary,
  vehicle1Name,
  vehicle2Name,
  criteria,
}: ComparisonSummaryProps) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-5 sm:p-7">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-sm shadow-blue-500/20 shrink-0">
            <Scale className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              Executive Trade-Off Analysis
            </h3>
            <p className="text-xs text-slate-500">
              Neutral comparative evaluation grounded in verified technical brochures
            </p>
          </div>
        </div>

        {/* Vehicles Compared Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            {vehicle1Name}
          </span>
          <span className="text-xs text-slate-400 font-bold">vs</span>
          <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200">
            {vehicle2Name}
          </span>
        </div>
      </div>

      {/* Focus Criteria Tag if provided */}
      {criteria && (
        <div className="my-3.5 px-3 py-2 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2 text-xs text-blue-900">
          <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>
            <strong className="font-semibold">Evaluation Focus:</strong> {criteria}
          </span>
        </div>
      )}

      {/* Summary Body */}
      <div className="mt-4 text-xs sm:text-sm text-slate-700 leading-relaxed space-y-3 whitespace-pre-wrap font-normal">
        {summary}
      </div>

      {/* Footer Disclaimer */}
      <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          No universal winner declared; specifications reflect manufacturer documented figures
        </span>
      </div>
    </div>
  );
}
