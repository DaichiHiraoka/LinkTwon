import type {
  AuthResponse,
  EventItem,
  ExchangeResponse,
  ParticipationResponse,
  RegisterResponse,
  ServiceItem,
  UserHistory,
  UserProfile,
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

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

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

export function login(email: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function register(payload: {
  name: string;
  email: string;
  password: string;
  age_group?: string;
  user_type?: string;
}) {
  return request<RegisterResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getUserProfile(userId: number, token: string) {
  return request<UserProfile>(`/users/${userId}/points`, {}, token);
}

export function getUserHistory(userId: number, token: string) {
  return request<UserHistory>(`/users/${userId}/history`, {}, token);
}

export function getEvents(token: string) {
  return request<EventItem[]>("/events", {}, token);
}

export function participateInEvent(eventId: number, token: string) {
  return request<ParticipationResponse>(
    "/events/participate",
    {
      method: "POST",
      body: JSON.stringify({ event_id: eventId }),
    },
    token,
  );
}

export function getServices(token: string) {
  return request<ServiceItem[]>("/points/services", {}, token);
}

export function exchangePoints(serviceId: number, token: string) {
  return request<ExchangeResponse>(
    "/points/exchange",
    {
      method: "POST",
      body: JSON.stringify({ service_id: serviceId }),
    },
    token,
  );
}
