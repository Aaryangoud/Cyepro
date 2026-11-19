"use client";

import React, { useEffect, useState } from "react";
import {
  FileText,
  CheckCircle,
  Clock,
  Car,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { RecentDocuments } from "@/components/dashboard/RecentDocuments";
import { SystemStatus } from "@/components/dashboard/SystemStatus";
import { fetchDashboardData } from "@/lib/api";
import { DashboardStats, DocumentItem, SystemHealth } from "@/lib/types";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDocuments: 0,
    completedDocuments: 0,
    processingDocuments: 0,
    availableVehicles: 0,
  });
  const [recentDocuments, setRecentDocuments] = useState<DocumentItem[]>([]);
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
      const data = await fetchDashboardData();
      setStats(data.stats);
      setRecentDocuments(data.recentDocuments);
      setHealth(data.health);
    } catch (err: any) {
      console.error("Dashboard data load failed:", err);
      setError("Unable to connect to Automotive AI backend. Check if the server is running on port 8000.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Sticky Top Navigation */}
        <TopNav health={health} />

        {/* Dashboard Workspace */}
        <main className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Header Bar with Refresh */}
          <div className="flex items-center justify-between pb-1">
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                Automotive Intelligence Overview
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Overview of vector stores, ingested technical brochures, and RAG pipelines
              </p>
            </div>

            <button
              onClick={loadData}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs disabled:opacity-50"
              title="Refresh Dashboard"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Error Banner if connection fails */}
          {error && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-xs text-amber-800">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-semibold">Backend Connection Notice: </span>
                {error}
              </div>
              <button
                onClick={loadData}
                className="underline font-semibold hover:text-amber-950 ml-2"
              >
                Retry
              </button>
            </div>
          )}

          {/* Section 1: Core Statistics Cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              label="Total Uploaded Brochures"
              value={isLoading ? "—" : stats.totalDocuments}
              icon={FileText}
              subtext="Stored in automotive-brochures"
              accentColor="blue"
            />
            <StatCard
              label="Processed & Indexed"
              value={isLoading ? "—" : stats.completedDocuments}
              icon={CheckCircle}
              subtext="Embedded into pgvector 768D"
              accentColor="emerald"
            />
            <StatCard
              label="Processing In-Queue"
              value={isLoading ? "—" : stats.processingDocuments}
              icon={Clock}
              subtext="Pending PyMuPDF extraction"
              accentColor="amber"
            />
            <StatCard
              label="Available Vehicles"
              value={isLoading ? "—" : stats.availableVehicles}
              icon={Car}
              subtext="Registered in vehicle registry"
              accentColor="indigo"
            />
          </section>

          {/* Section 2: Quick Actions */}
          <section className="space-y-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Quick Actions
            </div>
            <QuickActions />
          </section>

          {/* Section 3: Recent Ingested Documents */}
          <section className="space-y-2">
            <RecentDocuments
              documents={recentDocuments}
              isLoading={isLoading}
            />
          </section>

          {/* Section 4: Infrastructure & AI Stack */}
          <section className="space-y-2">
            <SystemStatus health={health} />
          </section>
        </main>
      </div>
    </div>
  );
}
