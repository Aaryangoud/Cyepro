"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { User, Server, Database, LogOut, Settings, ChevronDown, Sparkles } from "lucide-react";
import { SystemHealth } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";

interface TopNavProps {
  health?: SystemHealth;
  title?: string;
  subtitle?: string;
}

export function TopNav({
  health,
  title = "Dashboard Overview",
  subtitle = "Grounded automotive vector intelligence & shared technical brochures",
}: TopNavProps) {
  const { user, signOut } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOnline = health?.appStatus === "online";
  const isDbConnected = health?.dbStatus === "connected";

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
      {/* Title & Context */}
      <div className="min-w-0 pr-4">
        <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight truncate">
          {title}
        </h1>
        <p className="text-[11px] sm:text-xs text-slate-500 font-normal truncate hidden sm:block">
          {subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Backend & DB Health Indicators */}
        <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-[11px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isOnline ? "bg-emerald-500 shadow-xs" : "bg-amber-400"
              }`}
            />
            <span className="flex items-center gap-1">
              <Server className="w-3 h-3 text-slate-400" />
              API {isOnline ? "Online" : "Connecting"}
            </span>
          </div>

          <span className="text-slate-300">|</span>

          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbConnected ? "bg-emerald-500 shadow-xs" : "bg-amber-400"
              }`}
            />
            <span className="flex items-center gap-1">
              <Database className="w-3 h-3 text-slate-400" />
              pgvector {isDbConnected ? "Ready" : "Syncing"}
            </span>
          </div>
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1 rounded-xl hover:bg-slate-50 transition-colors focus:outline-none"
            aria-label="User profile options"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs">
              {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
            </div>
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-tight">
                {user?.full_name || "Enterprise User"}
              </span>
              <span className="text-[10px] text-slate-400 font-medium truncate max-w-[130px]">
                {user?.email || "user@cyepro.com"}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
          </button>

          {/* Profile Dropdown */}
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-200/90 py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {user?.full_name}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              <div className="py-1">
                <Link
                  href="/settings"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Settings className="w-4 h-4 text-slate-400" />
                  Account Settings
                </Link>
                <Link
                  href="/assistant"
                  onClick={() => setDropdownOpen(false)}
                  className="flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-blue-600" />
                  AI Assistant
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    signOut();
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
