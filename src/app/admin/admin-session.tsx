"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type AdminUser = { name: string; role: "SUPER_ADMIN" | "ADMIN" | "SECRETARY" };
const AdminSessionContext = createContext<AdminUser | null>(null);

/** One session request for the navigation and every page within this shell. */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/auth/me", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (!controller.signal.aborted) setUser(data?.user ?? null); })
      .catch(() => { if (!controller.signal.aborted) setUser(null); });
    return () => controller.abort();
  }, []);
  return <AdminSessionContext.Provider value={user}>{children}</AdminSessionContext.Provider>;
}

export function useAdminUser() {
  return useContext(AdminSessionContext);
}
