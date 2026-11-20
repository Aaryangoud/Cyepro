import React from "react";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  subtext?: string;
  accentColor?: "blue" | "emerald" | "amber" | "indigo";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  subtext,
  accentColor = "blue",
}: StatCardProps) {
  const colorMap = {
    blue: {
      bg: "bg-blue-50/80",
      iconBg: "bg-blue-600",
      border: "border-blue-100",
      text: "text-blue-600",
    },
    emerald: {
      bg: "bg-emerald-50/80",
      iconBg: "bg-emerald-600",
      border: "border-emerald-100",
      text: "text-emerald-600",
    },
    amber: {
      bg: "bg-amber-50/80",
      iconBg: "bg-amber-600",
      border: "border-amber-100",
      text: "text-amber-600",
    },
    indigo: {
      bg: "bg-indigo-50/80",
      iconBg: "bg-indigo-600",
      border: "border-indigo-100",
      text: "text-indigo-600",
    },
  };

  const theme = colorMap[accentColor];

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-all">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            {label}
          </span>
          <div className="text-2xl font-bold text-slate-900 tracking-tight">
            {value}
          </div>
        </div>
        <div className={`w-10 h-10 rounded-xl ${theme.iconBg} text-white flex items-center justify-center shadow-xs shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {subtext && (
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center text-[11px] text-slate-500 font-medium">
          <span className="truncate">{subtext}</span>
        </div>
      )}
    </div>
  );
}
