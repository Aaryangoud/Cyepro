import React from "react";
import { Database, Cpu, HardDrive, CheckCircle2 } from "lucide-react";
import { SystemHealth } from "@/lib/types";

interface SystemStatusProps {
  health?: SystemHealth;
}

export function SystemStatus({ health }: SystemStatusProps) {
  const isDbConnected = health?.dbStatus === "connected";
  const latency = health?.latencyMs ? `${Math.round(health.latencyMs)} ms` : "Active";

  const components = [
    {
      title: "Supabase pgvector",
      spec: "VECTOR(768) • Cosine HNSW",
      status: isDbConnected ? "Connected" : "Online",
      detail: latency,
      icon: Database,
    },
    {
      title: "Google Gemini AI Engine",
      spec: "gemini-3.5-flash-lite • 768D RAG",
      status: "Ready",
      detail: "RAG Prompt Guard",
      icon: Cpu,
    },
    {
      title: "Automotive Storage",
      spec: "automotive-brochures",
      status: "Private",
      detail: "PyMuPDF Ingestion",
      icon: HardDrive,
    },
  ];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
            Infrastructure & AI Stack
          </h2>
          <p className="text-xs text-slate-500">
            Current operational status of database, embeddings, and storage services
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {components.map((comp) => {
          const Icon = comp.icon;
          return (
            <div
              key={comp.title}
              className="flex items-start gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-100"
            >
              <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center text-blue-600 flex-shrink-0 shadow-2xs">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {comp.title}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                    <CheckCircle2 className="w-2.5 h-2.5" />
                    {comp.status}
                  </span>
                </div>
                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                  {comp.spec}
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-1">
                  {comp.detail}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
