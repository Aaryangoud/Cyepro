import React from "react";
import Link from "next/link";
import { UploadCloud, MessageSquareText, GitCompare, ArrowRight } from "lucide-react";

export function QuickActions() {
  const actions = [
    {
      title: "Upload Brochure",
      description: "Upload vehicle PDF manuals or technical brochures (up to 20 MB).",
      href: "/documents",
      icon: UploadCloud,
      buttonText: "Upload PDF",
      highlight: true,
    },
    {
      title: "Ask AI Assistant",
      description: "Ask natural language questions grounded in official brochure specifications.",
      href: "/assistant",
      icon: MessageSquareText,
      buttonText: "Start Chat",
      highlight: false,
    },
    {
      title: "Compare Vehicles",
      description: "Side-by-side trade-off analysis across dimensions, powertrains, and safety.",
      href: "/comparison",
      icon: GitCompare,
      buttonText: "Compare Trims",
      highlight: false,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {actions.map((act) => {
        const Icon = act.icon;
        return (
          <div
            key={act.title}
            className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 transition-colors"
          >
            <div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 mb-3">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {act.title}
              </h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {act.description}
              </p>
            </div>

            <div className="mt-5 pt-3 border-t border-slate-100">
              <Link
                href={act.href}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                  act.highlight
                    ? "text-blue-600 hover:text-blue-700"
                    : "text-slate-700 hover:text-slate-900"
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
