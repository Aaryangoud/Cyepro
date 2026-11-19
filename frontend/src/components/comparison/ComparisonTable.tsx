"use client";

import React from "react";
import {
  Gauge,
  Fuel,
  Zap,
  Maximize2,
  Users,
  ShieldCheck,
  Tv,
  Tag,
  AlertCircle,
  CheckCircle2,
  FileText,
  Sparkles,
  Scale,
} from "lucide-react";
import { ComparisonRowItem, VehicleSpecData } from "@/lib/types";

interface ComparisonTableProps {
  vehicle1: VehicleSpecData;
  vehicle2: VehicleSpecData;
  rows: ComparisonRowItem[];
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  "Engine and transmission": Gauge,
  "Fuel type": Fuel,
  "Mileage": Zap,
  "Dimensions": Maximize2,
  "Seating capacity": Users,
  "Safety features": ShieldCheck,
  "Infotainment and comfort features": Tv,
  "Price": Tag,
  "Executive Trade-Off & Ideal Use-Case": Scale,
};

export function ComparisonTable({
  vehicle1,
  vehicle2,
  rows,
}: ComparisonTableProps) {
  const isUnavailable = (val: string) => {
    if (!val) return true;
    const lower = val.toLowerCase();
    return (
      lower.includes("not available in uploaded documents") ||
      lower.includes("not available in uploaded brochures") ||
      lower.includes("not available") ||
      lower.includes("n/a")
    );
  };

  const renderValueCell = (value: string, isSpecial: boolean = false) => {
    if (isUnavailable(value)) {
      return (
        <div className="flex items-center gap-1.5 text-slate-400 italic text-xs bg-slate-50/70 p-2 rounded-lg border border-dashed border-slate-200">
          <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Not available in uploaded brochures</span>
        </div>
      );
    }

    return (
      <div
        className={`text-xs sm:text-sm leading-relaxed whitespace-pre-line ${
          isSpecial
            ? "font-medium text-slate-900"
            : "font-normal text-slate-800"
        }`}
      >
        {value}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Table Header Controls */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 tracking-tight">
            Side-by-Side Specification Matrix & Trade-Off Analysis
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Complete side-by-side comparative evaluation across specifications, focused criteria, and practical trade-offs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Verified Technical Data
          </span>
        </div>
      </div>

      {/* Table Element */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="py-3.5 px-4 sm:px-6 text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-1/4">
                Comparison Dimension
              </th>
              <th className="py-3.5 px-4 sm:px-6 text-xs sm:text-sm font-bold text-blue-900 w-[37.5%]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                  <span>{vehicle1.name}</span>
                </div>
                {vehicle1.document_name && (
                  <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                    <FileText className="w-3 h-3" />
                    {vehicle1.document_name}
                  </span>
                )}
              </th>
              <th className="py-3.5 px-4 sm:px-6 text-xs sm:text-sm font-bold text-indigo-900 w-[37.5%]">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                  <span>{vehicle2.name}</span>
                </div>
                {vehicle2.document_name && (
                  <span className="text-[10px] font-normal text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                    <FileText className="w-3 h-3" />
                    {vehicle2.document_name}
                  </span>
                )}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => {
              const isFocusRow = row.attribute.toLowerCase().startsWith("comparison focus:");
              const isTradeoffRow = row.attribute === "Executive Trade-Off & Ideal Use-Case";

              let Icon = CATEGORY_ICONS[row.attribute] || Gauge;
              if (isFocusRow) Icon = Sparkles;
              if (isTradeoffRow) Icon = Scale;

              let rowClass = "hover:bg-slate-50/60 transition-colors";
              if (isFocusRow) {
                rowClass = "bg-blue-50/50 hover:bg-blue-50/70 border-y border-blue-200/80";
              } else if (isTradeoffRow) {
                rowClass = "bg-indigo-50/30 hover:bg-indigo-50/50 border-t-2 border-indigo-200";
              }

              return (
                <tr key={idx} className={rowClass}>
                  {/* Category Label */}
                  <td className="py-4 px-4 sm:px-6 align-top">
                    <div className="flex items-start gap-2.5">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                          isFocusRow
                            ? "bg-blue-600 text-white shadow-xs"
                            : isTradeoffRow
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        {isFocusRow ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-100 px-2 py-0.5 rounded mb-1">
                              Specific Focus
                            </span>
                            <div className="text-xs font-bold text-blue-900 leading-snug">
                              {row.attribute.replace(/^comparison focus:\s*/i, "")}
                            </div>
                          </>
                        ) : isTradeoffRow ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded mb-1">
                              Side-by-Side Analysis
                            </span>
                            <div className="text-xs font-bold text-indigo-950 leading-snug">
                              Executive Trade-Off & Use-Case
                            </div>
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-slate-900 leading-snug">
                            {row.attribute}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Vehicle 1 Value */}
                  <td className="py-4 px-4 sm:px-6 align-top border-l border-slate-100">
                    {renderValueCell(row.vehicle_1_value, isFocusRow || isTradeoffRow)}
                  </td>

                  {/* Vehicle 2 Value */}
                  <td className="py-4 px-4 sm:px-6 align-top border-l border-slate-100">
                    {renderValueCell(row.vehicle_2_value, isFocusRow || isTradeoffRow)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
