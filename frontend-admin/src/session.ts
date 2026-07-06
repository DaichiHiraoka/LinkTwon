import type { AdminAuthResponse } from "./types";

const STORAGE_KEY = "link-town-admin-session";

export type AdminSession = Pick<AdminAuthResponse, "token" | "admin">;

export function readSession(): AdminSession | null {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdminSession;
    return typeof parsed.token === "string" ? parsed : null;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function writeSession(session: AdminSession | null) {
  if (session) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
