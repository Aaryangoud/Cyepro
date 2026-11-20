"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { UserProfile } from "@/lib/types";
import {
  loginUser,
  signupUser,
  forgotPassword as forgotPasswordApi,
  resetPassword as resetPasswordApi,
  fetchCurrentUser,
  setAuthToken,
  getAuthToken,
} from "@/lib/api";

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (fullName: string, email: string, password: string, confirmPassword: string) => Promise<string>;
  signOut: () => void;
  requestPasswordReset: (email: string) => Promise<string>;
  submitPasswordReset: (password: string, confirmPassword: string) => Promise<string>;
  refreshUser: () => Promise<void>;
  updateName: (fullName: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = ["/login", "/signup", "/forgot-password", "/reset-password"];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const activeToken = getAuthToken();
      if (!activeToken) {
        setUser(null);
        setTokenState(null);
        return;
      }
      const profile = await fetchCurrentUser();
      setUser(profile);
      setTokenState(activeToken);
    } catch {
      setAuthToken(null);
      setUser(null);
      setTokenState(null);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = getAuthToken();
      if (savedToken) {
        await refreshUser();
      }
      setLoading(false);
    };
    initAuth();
  }, [refreshUser]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuthToken(null);
      setTokenState(null);
      setUser(null);
      const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
      if (!isPublic) {
        router.push("/login");
      }
    };

    window.addEventListener("cyepro:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("cyepro:unauthorized", handleUnauthorized);
  }, [pathname, router]);

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
    if (!user && !isPublic) {
      router.push("/login");
    } else if (user && isPublic && pathname !== "/reset-password") {
      router.push("/");
    }
  }, [user, loading, pathname, router]);

  const signIn = async (email: string, password: string) => {
    const res = await loginUser(email, password);
    setAuthToken(res.access_token);
    setTokenState(res.access_token);
    setUser({
      id: res.user_id,
      email: res.email,
      full_name: res.full_name,
      email_confirmed: true,
    });
    router.push("/");
  };

  const signUp = async (
    fullName: string,
    email: string,
    password: string,
    confirmPassword: string
  ): Promise<string> => {
    const res = await signupUser(fullName, email, password, confirmPassword);
    return res.message;
  };

  const signOut = () => {
    setAuthToken(null);
    setTokenState(null);
    setUser(null);
    router.push("/login");
  };

  const requestPasswordReset = async (email: string): Promise<string> => {
    const res = await forgotPasswordApi(email);
    return res.message;
  };

  const submitPasswordReset = async (password: string, confirmPassword: string): Promise<string> => {
    const res = await resetPasswordApi(password, confirmPassword);
    return res.message;
  };

  const updateName = async (fullName: string): Promise<void> => {
    const { updateUserProfile } = await import("@/lib/api");
    const res = await updateUserProfile(fullName);
    setUser((prev) => (prev ? { ...prev, full_name: res.full_name } : null));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signUp,
        signOut,
        requestPasswordReset,
        submitPasswordReset,
        refreshUser,
        updateName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
