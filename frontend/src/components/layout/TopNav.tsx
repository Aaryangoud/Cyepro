"use client";

import React from "react";
import { Bell, User, Server, Database } from "lucide-react";
import { SystemHealth } from "@/lib/types";

interface TopNavProps {
  health?: SystemHealth;
  title?: string;
  subtitle?: string;
}

export function TopNav({
  health,
  title = "Executive Overview",
  subtitle = "Real-time vector intelligence & document processing",
}: TopNavProps) {
  const isOnline = health?.appStatus === "online";
  const isDbConnected = health?.dbStatus === "connected";

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Title & Context */}
      <div>
        <h1 className="text-base font-semibold text-slate-900 tracking-tight leading-tight">
          {title}
        </h1>
        <p className="text-xs text-slate-500 font-normal">{subtitle}</p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Backend & DB Health Indicators */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-slate-400" />
              API: {isOnline ? "Online" : "Connecting"}
            </span>
          </div>

          <span className="text-slate-300">|</span>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" />
              DB: {isDbConnected ? "Ready" : "Syncing"}
            </span>
          </div>
        </div>

        {/* Notifications Icon */}
        <button
          className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg border border-transparent hover:border-slate-200 transition-colors"
          title="Notifications"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
        </button>

        {/* User Profile */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 text-xs font-semibold">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div className="hidden md:flex flex-col text-left">
            <span className="text-xs font-semibold text-slate-800 leading-none">
              Admin Engineer
            </span>
            <span className="text-[10px] text-slate-400 font-medium mt-0.5">
              Service Role
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
