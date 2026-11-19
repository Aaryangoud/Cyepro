"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  FileText,
  Filter,
  CheckCircle2,
  AlertCircle,
  Car,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ChatInput } from "@/components/chat/ChatInput";
import { askChatMessage, fetchDashboardData } from "@/lib/api";
import { ChatMessage, SystemHealth } from "@/lib/types";

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealth>({
    appStatus: "checking",
    dbStatus: "checking",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial health status
  useEffect(() => {
    fetchDashboardData()
      .then((data) => setHealth(data.health))
      .catch(() =>
        setHealth({ appStatus: "offline", dbStatus: "disconnected" })
      );
  }, []);

  // Smooth scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Handle New Conversation / Clear Chat
  const handleNewChat = () => {
    setMessages([]);
    setSessionId(null);
    setInput("");
  };

  // Submit query to RAG endpoint
  const handleSendMessage = async (textOverride?: string) => {
    const questionText = (textOverride || input).trim();
    if (!questionText || isLoading) return;

    // Create user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: questionText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await askChatMessage({
        question: questionText,
        session_id: sessionId || undefined,
        top_k: 5,
        similarity_threshold: 0.35,
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      const isRejected = response.status === "rejected";

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.answer || response.message,
        sources: isRejected ? [] : (response.sources || []),
        confidence_score: isRejected ? undefined : response.confidence_score,
        chunks_retrieved: isRejected ? 0 : response.chunks_retrieved,
        is_fallback: isRejected ? false : response.is_fallback,
        status: response.status || "accepted",
        isRejected,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error("Chat question failed:", err);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content:
          err.message ||
          "Unable to communicate with the Automotive AI Assistant. Please ensure the backend server is running.",
        isError: true,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = (questionToRetry: string) => {
    handleSendMessage(questionToRetry);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col h-screen overflow-hidden">
        {/* Sticky Top Navigation */}
        <TopNav
          health={health}
          title="Automotive AI Assistant"
          subtitle="Grounded question answering powered by official brochure vector embeddings"
        />

        {/* Chat Control Toolbar */}
        <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-800">
              RAG Engine Active
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-[11px] text-slate-500 font-normal hidden sm:inline">
              Gemini Embeddings (768-dim) • pgvector Cosine Retrieval
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-lg transition-colors shadow-2xs"
              title="Start a fresh conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New Conversation
            </button>
          </div>
        </div>

        {/* Chat Stream Viewport */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 flex flex-col">
          {messages.length === 0 ? (
            <ChatWelcome onSelectQuestion={(q) => handleSendMessage(q)} />
          ) : (
            <div className="flex-1 space-y-4">
              {messages.map((msg) => (
                <ChatMessageItem
                  key={msg.id}
                  message={msg}
                  onRetry={handleRetry}
                />
              ))}

              {/* In-Flight Thinking Indicator */}
              {isLoading && (
                <div className="flex gap-3 sm:gap-4 my-4 max-w-4xl mx-auto w-full">
                  <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 text-white shadow-sm">
                    <Bot className="w-4 h-4 animate-bounce" />
                  </div>
                  <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none p-4 shadow-sm flex items-center gap-3">
                    <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-800">
                        Synthesizing answer from official brochure chunks...
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Retrieving top vectors from Supabase pgvector & applying zero-hallucination constraint
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Bar */}
        <ChatInput
          input={input}
          setInput={setInput}
          onSubmit={() => handleSendMessage()}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
