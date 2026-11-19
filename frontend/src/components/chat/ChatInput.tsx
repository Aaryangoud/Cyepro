"use client";

import React, { useRef, useEffect } from "react";
import { Send, Loader2, Sparkles, CornerDownLeft } from "lucide-react";

interface ChatInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: (e?: React.FormEvent) => void;
  isLoading: boolean;
  placeholder?: string;
}

export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  placeholder = "Ask about vehicle specs, fuel efficiency, ADAS, or powertrains...",
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        180
      )}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && input.trim()) {
        onSubmit();
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoading && input.trim()) {
      onSubmit(e);
    }
  };

  return (
    <div className="border-t border-slate-200 bg-white/80 backdrop-blur-md p-4 sm:p-5">
      <div className="max-w-4xl mx-auto w-full">
        <form
          onSubmit={handleSubmit}
          className="relative flex flex-col bg-white border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 rounded-2xl shadow-sm transition-all overflow-hidden"
        >
          {/* Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={placeholder}
            className="w-full px-4 pt-3.5 pb-2 text-xs sm:text-sm text-slate-800 placeholder-slate-400 bg-transparent resize-none focus:outline-none min-h-[46px] max-h-[180px] leading-relaxed"
          />

          {/* Action Footer inside Input Box */}
          <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <CornerDownLeft className="w-3 h-3 text-slate-400" />
              <span className="hidden sm:inline">
                Press <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Enter</kbd> to send, <kbd className="px-1 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[10px] text-slate-600">Shift + Enter</kbd> for new line
              </span>
              <span className="sm:hidden">Enter to send</span>
            </div>

            {/* Send Button */}
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span className="hidden sm:inline">Thinking...</span>
                </>
              ) : (
                <>
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-center text-[10px] text-slate-400 mt-2">
          Automotive AI synthesizes answers strictly from uploaded PDF technical brochures.
        </p>
      </div>
    </div>
  );
}
