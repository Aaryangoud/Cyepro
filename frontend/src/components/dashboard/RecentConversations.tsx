import React from "react";
import Link from "next/link";
import { MessageSquare, ArrowRight, Clock, PlusCircle, Sparkles } from "lucide-react";
import { ChatSessionItem } from "@/lib/types";

interface RecentConversationsProps {
  sessions: ChatSessionItem[];
  isLoading?: boolean;
}

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return "Recently";
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return dateStr;
  }
}

export function RecentConversations({ sessions, isLoading }: RecentConversationsProps) {
  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-12 bg-slate-50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight">
            Recent Private AI Consultations
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Your private automotive engineering Q&A sessions (scoped exclusively to you)
          </p>
        </div>
        <Link
          href="/assistant"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <span>Open Chat</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="py-8 px-4 text-center bg-slate-50/60 rounded-xl border border-dashed border-slate-200">
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
            <MessageSquare className="w-5 h-5" />
          </div>
          <p className="text-xs font-bold text-slate-800">No Consultations Yet</p>
          <p className="text-[11px] text-slate-500 max-w-xs mx-auto mt-1 mb-3">
            Start a new session with the AI Assistant to inquire about vehicle powertrains, dimensions, and ADAS features.
          </p>
          <Link
            href="/assistant"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Start Consultation</span>
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sessions.slice(0, 5).map((sess) => (
            <Link
              key={sess.id}
              href={`/assistant?sessionId=${sess.id}`}
              className="py-2.5 px-2 flex items-center justify-between gap-3 hover:bg-slate-50/80 rounded-xl transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-50 text-slate-500 group-hover:text-blue-600 flex items-center justify-center shrink-0 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                    {sess.title || "Automotive Technical Query"}
                  </p>
                  <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(sess.updated_at || sess.created_at)}
                  </p>
                </div>
              </div>

              <div className="text-slate-400 group-hover:text-blue-600 transition-colors">
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
