import type {
  AdminAuthResponse,
  AdminServiceItem,
  AdminStats,
  AdminUserDetail,
  EventItem,
  ManagedUser,
  StoreItem,
  SupportTicket,
} from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "API request failed.";
    throw new ApiError(response.status, message);
  }

  return payload as T;
}

export function adminLogin(adminId: string, password: string) {
  return request<AdminAuthResponse>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ admin_id: adminId, password }),
  });
}

export function getStats(token: string) {
  return request<AdminStats>("/admin/stats", {}, token);
}

export function getEvents(token: string) {
  return request<EventItem[]>("/admin/events", {}, token);
}

export function createEvent(
  payload: { event_name: string; event_datetime: string; location?: string; grant_points: number; status?: "active" | "paused" },
  token: string,
) {
  return request<{ message: string; event_id: number; check_in_code: string }>("/admin/events", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateEvent(eventId: number, payload: Partial<EventItem>, token: string) {
  return request<{ message: string }>(`/admin/events/${eventId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteEvent(eventId: number, token: string) {
  return request<{ message: string }>(`/admin/events/${eventId}`, { method: "DELETE" }, token);
}

export function getEventCheckInCode(eventId: number, token: string) {
  return request<{ event_id: number; check_in_code: string; expires_at: string }>(
    `/admin/events/${eventId}/check-in-code`,
    {},
    token,
  );
}

export function getStores(token: string) {
  return request<StoreItem[]>("/admin/stores", {}, token);
}

export function createStore(payload: { store_name: string; status?: "active" | "paused" }, token: string) {
  return request<{ message: string; store_id: number }>("/admin/stores", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateStore(storeId: number, payload: Partial<StoreItem>, token: string) {
  return request<{ message: string }>(`/admin/stores/${storeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteStore(storeId: number, token: string) {
  return request<{ message: string }>(`/admin/stores/${storeId}`, { method: "DELETE" }, token);
}

export function getServices(token: string) {
  return request<AdminServiceItem[]>("/admin/services", {}, token);
}

export function createService(
  payload: { store_id: number; service_name: string; required_points: number; status?: "active" | "paused" },
  token: string,
) {
  return request<{ message: string; service_id: number }>("/admin/services", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function updateService(serviceId: number, payload: Partial<AdminServiceItem>, token: string) {
  return request<{ message: string }>(`/admin/services/${serviceId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function deleteService(serviceId: number, token: string) {
  return request<{ message: string }>(`/admin/services/${serviceId}`, { method: "DELETE" }, token);
}

export function getUsers(token: string, search = "") {
  return request<ManagedUser[]>(`/admin/users?search=${encodeURIComponent(search)}`, {}, token);
}

export function getUser(userId: number, token: string) {
  return request<AdminUserDetail>(`/admin/users/${userId}`, {}, token);
}

export function updateUser(userId: number, payload: Partial<ManagedUser>, token: string) {
  return request<{ message: string }>(`/admin/users/${userId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function createNotification(payload: { user_id?: number; title: string; body: string }, token: string) {
  return request<{ message: string; delivered_count: number }>("/admin/notifications", {
    method: "POST",
    body: JSON.stringify(payload),
  }, token);
}

export function getSupportTickets(token: string) {
  return request<SupportTicket[]>("/admin/support/tickets", {}, token);
}

export function updateSupportTicket(
  ticketId: number,
  payload: { status?: SupportTicket["status"]; admin_note?: string },
  token: string,
) {
  return request<{ message: string }>(`/admin/support/tickets/${ticketId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  }, token);
}

export function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      return "APIサーバーに接続できません。Backend URLとCORS設定を確認してください。";
    }
    return error.message;
  }
  return "処理に失敗しました。";
}
