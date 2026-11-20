"use client";

import React, { useState, useEffect } from "react";
import {
  User,
  Mail,
  Lock,
  ShieldCheck,
  Save,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  LogOut,
  Loader2,
  Sparkles,
  KeyRound,
  ShieldAlert,
} from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopNav } from "@/components/layout/TopNav";
import { useAuth } from "@/context/AuthContext";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export default function SettingsPage() {
  const { user, updateName, requestPasswordReset, signOut } = useAuth();

  const [fullName, setFullName] = useState("");
  const [isSavingName, setIsSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);

  const [copiedId, setCopiedId] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    if (user?.full_name) {
      setFullName(user.full_name);
    }
  }, [user]);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || fullName.trim() === user?.full_name) return;

    setIsSavingName(true);
    setNameSuccess(null);
    setNameError(null);

    try {
      await updateName(fullName.trim());
      setNameSuccess("Display name updated successfully.");
      setTimeout(() => setNameSuccess(null), 4000);
    } catch (err: any) {
      setNameError(err.message || "Failed to update display name.");
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;

    setIsSendingReset(true);
    setResetSuccess(null);
    setResetError(null);

    try {
      const msg = await requestPasswordReset(user.email);
      setResetSuccess(
        msg || `A password recovery link has been dispatched to ${user.email}. Please check your inbox.`
      );
    } catch (err: any) {
      setResetError(err.message || "Failed to dispatch password recovery email.");
    } finally {
      setIsSendingReset(false);
    }
  };

  const copyUserId = () => {
    if (user?.id) {
      navigator.clipboard.writeText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col lg:flex-row">
      <Sidebar />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <TopNav
          title="Account Settings"
          subtitle="Manage your personal profile, display name, and authentication credentials"
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl w-full mx-auto">
          {/* Header */}
          <div className="pb-1">
            <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              User Profile & Security
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Your profile information is strictly protected. Only your display name is visible across shared brochures.
            </p>
          </div>

          {/* Profile Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
                  {user?.full_name ? user.full_name.charAt(0).toUpperCase() : <User className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Personal Information</h3>
                  <p className="text-xs text-slate-500">Update your public display identity</p>
                </div>
              </div>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                Verified Account
              </span>
            </div>

            <form onSubmit={handleUpdateName} className="p-5 sm:p-6 space-y-4">
              {nameSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">{nameSuccess}</span>
                </div>
              )}

              {nameError && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span className="font-medium">{nameError}</span>
                </div>
              )}

              {/* Display Name Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Full Display Name
                </label>
                <div className="relative rounded-xl shadow-2xs">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  This name appears on brochure uploads and system activity logs.
                </p>
              </div>

              {/* Email Address (Read-Only) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Email Address
                  </label>
                  <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    Primary Sign-In Identity
                  </span>
                </div>
                <div className="relative rounded-xl">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ""}
                    className="block w-full pl-10 pr-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl text-slate-600 font-medium cursor-not-allowed"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Email addresses are strictly private and never exposed to other authenticated users.
                </p>
              </div>

              {/* User UUID */}
              {user?.id && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Account User ID (UUID)
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 px-3.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-600 truncate">
                      {user.id}
                    </div>
                    <button
                      type="button"
                      onClick={copyUserId}
                      className="px-3 py-2 text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 inline-flex items-center gap-1.5 transition-colors shadow-2xs"
                      title="Copy User ID"
                    >
                      {copiedId ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-600">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingName || !fullName.trim() || fullName.trim() === user?.full_name}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSavingName ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>

          {/* Security & Password Reset Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Security & Credentials</h3>
                  <p className="text-xs text-slate-500">Manage account access and password resets</p>
                </div>
              </div>
            </div>

            {resetSuccess && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-medium">{resetSuccess}</span>
              </div>
            )}

            {resetError && (
              <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-medium">{resetError}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-slate-900">Request Password Reset Link</p>
                <p className="text-[11px] text-slate-500">
                  We will dispatch a secure, single-use recovery link to <span className="font-semibold text-slate-700">{user?.email}</span>.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSendPasswordReset}
                disabled={isSendingReset}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition-colors shadow-2xs disabled:opacity-50 shrink-0"
              >
                {isSendingReset ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                ) : (
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                )}
                <span>Send Reset Link</span>
              </button>
            </div>
          </div>

          {/* Active Session & Logout Card */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-900">Active Authentication Session</p>
              <p className="text-[11px] text-slate-500">
                Sign out of your active session on this device.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 transition-colors shadow-2xs shrink-0"
            >
              <LogOut className="w-4 h-4 text-rose-600" />
              <span>Sign Out of Cyepro</span>
            </button>
          </div>
        </main>
      </div>

      {/* Confirmation Dialog for Logout */}
      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to end your active session? You will need to log back in with your email and password to access the platform."
        confirmText="Sign Out"
        variant="primary"
        onConfirm={() => {
          setShowLogoutConfirm(false);
          signOut();
        }}
        onClose={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
