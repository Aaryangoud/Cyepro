"use client";

import React from "react";
import {
  Bot,
  Sparkles,
  ShieldCheck,
  FileText,
  Compass,
  ArrowRight,
  Zap,
} from "lucide-react";

interface ChatWelcomeProps {
  onSelectQuestion: (question: string) => void;
}

const SUGGESTED_QUESTIONS = [
  {
    category: "Specifications & Mileage",
    question: "What is the mileage and fuel efficiency of Tata Harrier?",
    icon: Zap,
    hint: "Fuel efficiency, ARAI mileage & powertrains",
  },
  {
    category: "Safety & Driver Assist",
    question: "What are the key safety features, ADAS, and airbag count in the vehicle?",
    icon: ShieldCheck,
    hint: "Airbags, ESC, BNCAP rating & ADAS features",
  },
  {
    category: "Cabin & Dimensions",
    question: "What are the vehicle dimensions, wheelbase, and boot space?",
    icon: Sparkles,
    hint: "Length, width, height & cargo capacity",
  },
  {
    category: "Engines & Transmissions",
    question: "What engine options, horsepower, and gearbox types are available?",
    icon: Compass,
    hint: "Powertrains, torque, turbo & transmission options",
  },
];

export function ChatWelcome({ onSelectQuestion }: ChatWelcomeProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 max-w-3xl mx-auto w-full text-center">
      {/* Bot Icon with glowing pulse */}
      <div className="relative mb-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
          <Bot className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-[10px] text-white font-bold">
          ✓
        </div>
      </div>

      {/* Main Heading */}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
        Automotive AI Intelligence Assistant
      </h2>
      <p className="text-xs sm:text-sm text-slate-500 max-w-lg mt-2 leading-relaxed">
        Ask natural-language questions about vehicle specifications, safety equipment, powertrains,
        and features. Answers are strictly grounded in official manufacturer PDF brochures.
      </p>

      {/* Grounding Trust Highlights */}
      <div className="flex flex-wrap items-center justify-center gap-3 my-6">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          Strict Zero-Hallucination Policy
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <FileText className="w-3.5 h-3.5 text-emerald-600" />
          Exact PDF Page Citations
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Google Gemini 768-dim RAG
        </span>
      </div>

      {/* Suggested Questions Grid */}
      <div className="w-full text-left mt-2">
        <div className="flex items-center gap-2 mb-3">
          <Compass className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
            Suggested Queries
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SUGGESTED_QUESTIONS.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={() => onSelectQuestion(item.question)}
                className="group p-4 bg-white hover:bg-blue-50/50 border border-slate-200 hover:border-blue-300 rounded-xl transition-all duration-150 text-left shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {item.category}
                    </span>
                    <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
                  </div>
                  <p className="text-xs font-semibold text-slate-800 group-hover:text-blue-900 transition-colors line-clamp-2">
                    {item.question}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-slate-100 text-[11px] text-slate-400 group-hover:text-blue-600">
                  <span>{item.hint}</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
