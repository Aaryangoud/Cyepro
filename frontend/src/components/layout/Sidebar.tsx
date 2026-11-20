"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Bot,
  GitCompare,
  Settings,
  Car,
  Menu,
  X,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const NAV_ITEMS = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "AI Assistant", href: "/assistant", icon: Bot },
  { name: "Brochure Library", href: "/documents", icon: FileText },
  { name: "Vehicle Comparison", href: "/comparison", icon: GitCompare },
  { name: "Account Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Load sidebar collapsed preference
  useEffect(() => {
    const saved = localStorage.getItem("cyepro_sidebar_collapsed");
    if (saved === "true") {
      setIsCollapsed(true);
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("cyepro_sidebar_collapsed", String(next));
      return next;
    });
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shadow-2xs">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Car className="w-4 h-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 tracking-tight text-sm leading-none">
              Cyepro
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Automotive AI</span>
          </div>
        </Link>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Toggle mobile navigation"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Sidebar (Desktop Collapsible & Mobile Drawer) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-white border-r border-slate-200/90 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0 w-64" : "-translate-x-full lg:translate-x-0"
        } ${isCollapsed ? "lg:w-20" : "lg:w-64"}`}
      >
        {/* Brand Header */}
        <div
          className={`h-16 flex items-center justify-between px-4 border-b border-slate-100 ${
            isCollapsed ? "lg:justify-center lg:px-0" : "px-5"
          }`}
        >
          <Link
            href="/"
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 overflow-hidden group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform shrink-0">
              <Car className="w-5 h-5" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-900 text-sm tracking-tight leading-tight flex items-center gap-1.5">
                  Cyepro
                  <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                    SaaS
                  </span>
                </span>
                <span className="text-[11px] text-slate-400 font-medium truncate">
                  Automotive Intelligence
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={toggleCollapse}
            className={`hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors ${
              isCollapsed ? "hidden" : ""
            }`}
            title="Collapse sidebar"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Collapsed state expand button */}
        {isCollapsed && (
          <div className="hidden lg:flex justify-center pt-2">
            <button
              onClick={toggleCollapse}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
          {!isCollapsed && (
            <div className="px-3 pb-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Platform
            </div>
          )}

          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                title={isCollapsed ? item.name : undefined}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group ${
                  isActive
                    ? "bg-blue-50 text-blue-700 font-semibold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${isCollapsed ? "justify-center px-0" : ""}`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-600 rounded-r-full" />
                )}
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? "text-blue-600"
                      : "text-slate-400 group-hover:text-slate-700"
                  }`}
                />
                {!isCollapsed && <span className="truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Knowledge Base Status Badge (When Expanded) */}
        {!isCollapsed && (
          <div className="px-4 py-2 mx-3 mb-2 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Multi-User RAG</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-0.5">
              Shared brochures • Private chats
            </p>
          </div>
        )}

        {/* User Card & Logout in Bottom of Sidebar */}
        <div className="p-3 border-t border-slate-100 bg-white">
          {user && (
            <div
              className={`p-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between transition-all ${
                isCollapsed ? "justify-center p-1.5" : ""
              }`}
            >
              <Link
                href="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity"
                title="Account Settings"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-2xs">
                  {user.full_name?.charAt(0).toUpperCase() || <User className="w-4 h-4" />}
                </div>
                {!isCollapsed && (
                  <div className="min-w-0 text-left">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {user.full_name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[120px]">
                      {user.email}
                    </p>
                  </div>
                )}
              </Link>

              {!isCollapsed && (
                <button
                  onClick={signOut}
                  title="Sign out of account"
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                  aria-label="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
