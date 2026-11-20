"use client";

import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bot,
  PlusCircle,
  RotateCcw,
  Sparkles,
  Loader2,
  FileText,
  AlertCircle,
  MessageSquare,
  Trash2,
  Clock,
  ShieldCheck,
  PanelLeftClose,
  PanelLeftOpen,
  Send,
  X,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { ChatWelcome } from "@/components/chat/ChatWelcome";
import { ChatMessageItem } from "@/components/chat/ChatMessageItem";
import { ChatInput } from "@/components/chat/ChatInput";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  askChatMessage,
  fetchDashboardData,
  fetchChatSessions,
  fetchChatSessionMessages,
  deleteChatSession,
  getAuthToken,
} from "@/lib/api";
import { ChatMessage, ChatSessionItem, SystemHealth } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

function AssistantContent() {
  const searchParams = useSearchParams();
  const initialSessionId = searchParams.get("sessionId");
  const { user, loading: authLoading } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId);
  const [sessions, setSessions] = useState<ChatSessionItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState<boolean>(true);
  const [sessionsSidebarOpen, setSessionsSidebarOpen] = useState<boolean>(true);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [isDeletingSession, setIsDeletingSession] = useState<boolean>(false);
  const [health, setHealth] = useState<SystemHealth>({
    appStatus: "checking",
    dbStatus: "checking",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load initial health status
  useEffect(() => {
    fetchDashboardData()
      .then((data) => setHealth(data.health))
      .catch(() => setHealth({ appStatus: "offline", dbStatus: "disconnected" }));
  }, []);

  // Load user sessions when authenticated
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      loadSessions();
    } else {
      setSessions([]);
      setLoadingSessions(false);
    }
  }, [user, authLoading]);

  const loadSessions = async () => {
    if (!getAuthToken()) {
      setSessions([]);
      setLoadingSessions(false);
      return;
    }
    setLoadingSessions(true);
    try {
      const userSessions = await fetchChatSessions();
      setSessions(userSessions);
      if (initialSessionId && userSessions.some((s) => s.id === initialSessionId)) {
        loadSessionMessages(initialSessionId);
      }
    } catch (err: any) {
      if (!err?.message?.includes("expired") && !err?.message?.includes("Authentication failed")) {
        console.warn("Could not load user sessions:", err);
      }
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSessionMessages = async (id: string) => {
    setIsLoading(true);
    try {
      const data = await fetchChatSessionMessages(id);
      const formatted: ChatMessage[] = (data.messages || []).map((m: any) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources || [],
        created_at: m.created_at,
      }));
      setMessages(formatted);
      setSessionId(id);
    } catch (err) {
      console.error("Failed to load session messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectSession = async (sess: ChatSessionItem) => {
    if (sess.id === sessionId) return;
    await loadSessionMessages(sess.id);
  };

  const confirmDeleteSession = async () => {
    if (!sessionToDelete) return;
    setIsDeletingSession(true);
    try {
      await deleteChatSession(sessionToDelete);
      setSessions((prev) => prev.filter((s) => s.id !== sessionToDelete));
      if (sessionId === sessionToDelete) {
        handleNewChat();
      }
    } catch (err: any) {
      console.error("Failed to delete chat session:", err);
    } finally {
      setIsDeletingSession(false);
      setSessionToDelete(null);
    }
  };

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
        loadSessions();
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
        <div className="bg-white border-b border-slate-200/90 px-4 sm:px-6 py-2.5 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSessionsSidebarOpen(!sessionsSidebarOpen)}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title={sessionsSidebarOpen ? "Hide chat history" : "Show chat history"}
              aria-label="Toggle chat history"
            >
              {sessionsSidebarOpen ? (
                <PanelLeftClose className="w-4 h-4 text-slate-600" />
              ) : (
                <PanelLeftOpen className="w-4 h-4 text-blue-600" />
              )}
            </button>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800">
              RAG Engine Active
            </span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
              Private History • Shared Knowledge Base
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleNewChat}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 rounded-xl transition-colors shadow-2xs"
              title="Start a fresh conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>New Conversation</span>
            </button>
          </div>
        </div>

        {/* Split View: Chat History Sidebar + Active Chat Stream */}
        <div className="flex-1 flex overflow-hidden">
          {/* Chat Sessions History Panel */}
          {sessionsSidebarOpen && (
            <div className="w-72 border-r border-slate-200/90 bg-white flex flex-col shrink-0 transition-all duration-200 z-10">
              <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  Private Consultations
                </span>
                <button
                  onClick={handleNewChat}
                  className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="New conversation"
                >
                  <PlusCircle className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {loadingSessions ? (
                  <div className="p-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                    <span>Loading consultations...</span>
                  </div>
                ) : sessions.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No conversation history yet. Start asking vehicle questions!
                  </div>
                ) : (
                  sessions.map((sess) => (
                    <div
                      key={sess.id}
                      onClick={() => selectSession(sess)}
                      className={`group flex items-center justify-between p-3 rounded-xl text-xs cursor-pointer transition-all ${
                        sessionId === sess.id
                          ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs border border-blue-200/60"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <p className="truncate leading-tight font-medium">
                          {sess.title || "Automotive Consultation"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(sess.updated_at || sess.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSessionToDelete(sess.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Delete chat session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Main Chat Viewport */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-50/70">
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
                      <div className="w-8 h-8 rounded-xl bg-blue-600 flex items-center justify-center shrink-0 text-white shadow-2xs">
                        <Bot className="w-4 h-4 animate-bounce" />
                      </div>
                      <div className="bg-white border border-slate-200/90 rounded-2xl rounded-tl-none p-4 shadow-xs flex items-center gap-3">
                        <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
                        <div className="space-y-0.5">
                          <p className="text-xs font-semibold text-slate-900">
                            Synthesizing answer from official brochure chunks...
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Retrieving top vectors from Supabase pgvector & enforcing zero-hallucination constraint
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
      </div>

      {/* Delete Chat Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(sessionToDelete)}
        title="Delete Conversation"
        message="Are you sure you want to delete this private conversation? All messages within this consultation session will be permanently removed."
        confirmText="Delete"
        variant="danger"
        isLoading={isDeletingSession}
        onConfirm={confirmDeleteSession}
        onClose={() => setSessionToDelete(null)}
      />
    </div>
  );
}

export default function AssistantPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <AssistantContent />
    </Suspense>
  );
}
