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
      bg: "bg-blue-50",
      text: "text-blue-600",
      border: "border-blue-100",
    },
    emerald: {
      bg: "bg-emerald-50",
      text: "text-emerald-600",
      border: "border-emerald-100",
    },
    amber: {
      bg: "bg-amber-50",
      text: "text-amber-600",
      border: "border-amber-100",
    },
    indigo: {
      bg: "bg-indigo-50",
      text: "text-indigo-600",
      border: "border-indigo-100",
    },
  };

  const currentTheme = colorMap[accentColor];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 tracking-tight">
          {label}
        </span>
        <div className={`w-9 h-9 rounded-lg ${currentTheme.bg} flex items-center justify-center ${currentTheme.text}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="mt-4">
        <div className="text-2xl font-bold text-slate-900 tracking-tight">
          {value}
        </div>
        {subtext && (
          <p className="text-[11px] text-slate-400 font-medium mt-1">
            {subtext}
          </p>
        )}
      </div>
    </div>
  );
}
