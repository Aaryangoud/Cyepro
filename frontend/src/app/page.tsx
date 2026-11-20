"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Car,
  MessageSquare,
  RefreshCw,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";
import { RecentConversations } from "@/components/dashboard/RecentConversations";
import { fetchDashboardData, fetchChatSessions } from "@/lib/api";
import { DashboardStats, DocumentItem, SystemHealth, ChatSessionItem } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    completedDocuments: 0,
    processingDocuments: 0,
    availableVehicles: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<DocumentItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<ChatSessionItem[]>([]);
  const [health, setHealth] = useState<SystemHealth>({
    appStatus: "checking",
    dbStatus: "checking",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [dashData, sessions] = await Promise.all([
        fetchDashboardData(),
        fetchChatSessions().catch(() => []),
      ]);

      setStats(dashData.stats);
      setRecentDocuments(dashData.recentDocuments);
      setHealth(dashData.health);
      setRecentSessions(sessions);
    } catch (err: any) {
      console.error("Dashboard data load failed:", err);
      setError("Unable to connect to the backend. Please verify the FastAPI service is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const firstName = user?.full_name ? user.full_name.split(" ")[0] : "Engineer";

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 transition-all">
        {/* Sticky Top Navigation */}
        <TopNav health={health} title="Dashboard" subtitle="Automotive AI Engineering Workspace" />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Personalized Welcome Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 text-white rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
            <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
            
            <div className="relative z-10 max-w-2xl space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Enterprise Automotive Intelligence
              </div>
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight">
                Welcome back, {firstName} 👋
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Access official vehicle technical brochures, inquire with our RAG automotive assistant, and run brochure-grounded side-by-side vehicle comparisons.
              </p>
            </div>

            {/* Quick Refresh action */}
            <div className="mt-5 pt-4 border-t border-slate-700/60 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-medium">
                Shared Brochure Knowledge Base • Private Consultation Isolation
              </span>
              <button
                onClick={loadData}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors disabled:opacity-50"
                title="Refresh dashboard data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-900">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
              <button
                onClick={loadData}
                className="underline font-bold text-amber-950 hover:opacity-80"
              >
                Retry
              </button>
            </div>
          )}

          {/* Section 1: Core Metrics Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Shared Brochures"
              value={isLoading ? "—" : stats.totalDocuments}
              icon={FileText}
              subtext="Stored in Supabase Storage"
              accentColor="blue"
            />
            <StatCard
              label="Indexed in pgvector"
              value={isLoading ? "—" : stats.completedDocuments}
              icon={CheckCircle}
              subtext="768-dim vector embeddings"
              accentColor="emerald"
            />
            <StatCard
              label="Available Vehicles"
              value={isLoading ? "—" : stats.availableVehicles}
              icon={Car}
              subtext="Ready for side-by-side comparison"
              accentColor="indigo"
            />
            <StatCard
              label="Private Consultations"
              value={isLoading ? "—" : recentSessions.length}
              icon={MessageSquare}
              subtext="Private to your account"
              accentColor="amber"
            />
          </section>

          {/* Section 2: Prominent Quick Actions */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Quick Actions
              </h3>
            </div>
            <QuickActions />
          </section>

          {/* Section 3: Two-Column Activity & Content Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <RecentDocuments documents={recentDocuments} isLoading={isLoading} />
            <RecentConversations sessions={recentSessions} isLoading={isLoading} />
          </section>
        </main>
      </div>
    </div>
  );
}
