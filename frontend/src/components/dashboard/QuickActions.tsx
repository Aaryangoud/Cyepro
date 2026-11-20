import React from "react";
import Link from "next/link";
import { UploadCloud, MessageSquareText, GitCompare, ArrowRight, Sparkles } from "lucide-react";

export function QuickActions() {
  const actions = [
    {
      title: "Upload Brochure",
      subtitle: "Shared Technical Knowledge",
      description: "Upload official vehicle PDF brochures to extract specifications and expand the shared vector index.",
      href: "/documents",
      icon: UploadCloud,
      buttonText: "Upload PDF Brochure",
      accent: "from-blue-600 to-indigo-700",
      isPrimary: true,
    },
    {
      title: "Open AI Assistant",
      subtitle: "Grounded RAG Consultation",
      description: "Ask natural language questions strictly grounded in verified technical brochures with page citations.",
      href: "/assistant",
      icon: MessageSquareText,
      buttonText: "Launch AI Assistant",
      accent: "from-slate-800 to-slate-900",
      isPrimary: false,
    },
    {
      title: "Compare Vehicles",
      subtitle: "Side-by-Side Trade-Offs",
      description: "Perform structured multi-trim specification comparisons across powertrains, dimensions, and safety.",
      href: "/comparison",
      icon: GitCompare,
      buttonText: "Start Comparison",
      accent: "from-slate-800 to-slate-900",
      isPrimary: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <div
            key={act.title}
            className={`bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm ${
              act.isPrimary
                ? "border-blue-200 bg-gradient-to-br from-white via-white to-blue-50/30"
                : "border-slate-200/90 hover:border-slate-300"
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${act.accent} flex items-center justify-center text-white shadow-2xs`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {act.isPrimary && (
                  <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Quick Add
                  </span>
                )}
              </div>

              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {act.subtitle}
              </div>
              <h3 className="text-base font-bold text-slate-900 tracking-tight mt-0.5">
                {act.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                {act.description}
              </p>
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <Link
                href={act.href}
                className={`w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all shadow-2xs ${
                  act.isPrimary
                    ? "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/10 focus:ring-2 focus:ring-blue-500/20"
                    : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 hover:border-slate-300"
                }`}
              >
                <span>{act.buttonText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
