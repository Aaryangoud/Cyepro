"use client";

import React, { useState } from "react";
import {
  User,
  Bot,
  Copy,
  Check,
  FileText,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  RefreshCw,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { ChatMessage, ChatSourceItem } from "@/lib/types";

interface ChatMessageItemProps {
  message: ChatMessage;
  onRetry?: (question: string) => void;
}

export function ChatMessageItem({ message, onRetry }: ChatMessageItemProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [showSources, setShowSources] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTimestamp = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return "";
    }
  };

  return (
    <div
      className={`flex gap-3 sm:gap-4 my-4 ${
        isUser ? "flex-row-reverse" : "flex-row"
      } max-w-4xl mx-auto w-full`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white shadow-sm ${
          isUser
            ? "bg-slate-800"
            : message.isError
            ? "bg-rose-600"
            : message.isRejected
            ? "bg-amber-600"
            : "bg-blue-600"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : message.isError ? (
          <AlertCircle className="w-4 h-4" />
        ) : message.isRejected ? (
          <ShieldAlert className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
      </div>

      {/* Message Bubble Container */}
      <div
        className={`flex flex-col min-w-0 max-w-[85%] sm:max-w-[78%] ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        {/* Author & Timestamp Header */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[11px] font-semibold text-slate-600">
            {isUser ? "You" : "Automotive AI Assistant"}
          </span>
          <span className="text-[10px] text-slate-400">
            {formatTimestamp(message.created_at)}
          </span>
        </div>

        {/* Bubble Surface */}
        <div
          className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm transition-all ${
            isUser
              ? "bg-blue-600 text-white rounded-tr-none"
              : message.isError
              ? "bg-rose-50 border border-rose-200 text-rose-900 rounded-tl-none"
              : message.isRejected
              ? "bg-amber-50/70 border border-amber-200 text-slate-800 rounded-tl-none"
              : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
          }`}
        >
          {/* Main Content */}
          <div className="whitespace-pre-wrap break-words font-normal">
            {message.content}
          </div>

          {/* Error Actions */}
          {message.isError && onRetry && (
            <div className="mt-3 pt-2.5 border-t border-rose-200/80 flex items-center justify-between">
              <span className="text-[11px] text-rose-700">
                Failed to retrieve response from RAG backend.
              </span>
              <button
                onClick={() => onRetry(message.content)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 rounded-md transition-colors shadow-xs"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Assistant Footer: Copy & Badges */}
          {!isUser && !message.isError && (
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {message.isRejected ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded-md border border-amber-300">
                    <ShieldAlert className="w-3 h-3 text-amber-600" />
                    Automotive Domain Guard Active
                  </span>
                ) : (
                  <>
                    {message.is_fallback && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                        <Sparkles className="w-3 h-3 text-indigo-600" />
                        Gemini Automotive Fallback
                      </span>
                    )}

                    {!message.is_fallback &&
                      message.confidence_score !== undefined &&
                      message.confidence_score !== null && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          {(message.confidence_score * 100).toFixed(0)}% Match
                        </span>
                      )}

                    {message.sources && message.sources.length > 0 && (
                      <button
                        onClick={() => setShowSources(!showSources)}
                        className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 transition-colors"
                      >
                        <FileText className="w-3 h-3 text-blue-600" />
                        {message.sources.length}{" "}
                        {message.sources.length === 1 ? "Citation" : "Citations"}
                        {showSources ? (
                          <ChevronUp className="w-3 h-3 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-3 h-3 ml-0.5" />
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
                title="Copy response"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible Source Attribution Cards */}
        {!isUser &&
          showSources &&
          message.sources &&
          message.sources.length > 0 && (
            <div className="mt-2.5 w-full space-y-2 p-3 bg-slate-50 border border-slate-200/90 rounded-xl text-left">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 px-1">
                <span>Verified Source Brochures</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Retrieved via pgvector cosine distance
                </span>
              </div>

              <div className="space-y-1.5">
                {message.sources.map((src: ChatSourceItem, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-white border border-slate-200 rounded-lg text-xs hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <FileText className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span className="font-semibold text-slate-800 truncate text-[11px]">
                          {src.document_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {src.page_number && (
                          <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                            Page {src.page_number}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-emerald-600 font-medium">
                          {(src.similarity * 100).toFixed(1)}% match
                        </span>
                      </div>
                    </div>
                    {src.excerpt && (
                      <p className="text-[11px] text-slate-500 italic line-clamp-2 mt-1 bg-slate-50 p-1.5 rounded border border-slate-100 font-serif">
                        &ldquo;{src.excerpt}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
      </div>
    </div>
  );
}
