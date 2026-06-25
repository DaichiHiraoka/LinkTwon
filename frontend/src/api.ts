import type {
  AdminAuthResponse,
  AdminServiceItem,
  AdminStats,
  AdminUserDetail,
  AuthResponse,
  EmailVerificationResponse,
  EventItem,
  ExchangeResponse,
  ManagedUser,
  NotificationItem,
  ParticipationCancellationResponse,
  ParticipationResponse,
  PasswordResetRequestResponse,
  PaymentMethod,
  Purchase,
  PurchaseResponse,
  RegisterResponse,
  ServiceItem,
  StoreItem,
  SupportTicket,
  UserHistory,
  UserProfile,
  UserSettings,
} from "./types";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

type ApiBaseUrlConfig = {
  baseUrl: string;
  configurationError?: string;
};

function getApiBaseUrl(): ApiBaseUrlConfig {
  const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

  if (!configuredBaseUrl) {
    if (!import.meta.env.DEV && !isLoopbackHost(window.location.hostname)) {
      return {
        baseUrl: "",
        configurationError:
          "公開環境のAPI URLが設定されていません。フロントエンドの環境変数 VITE_API_BASE_URL にRenderのBackend URLを設定してください。",
      };
    }

    return { baseUrl: "" };
  }

  try {
    const url = new URL(configuredBaseUrl);
    if (isLoopbackHost(url.hostname) && !isLoopbackHost(window.location.hostname)) {
      if (import.meta.env.DEV) {
        return { baseUrl: "" };
      }

      return {
        baseUrl: "",
        configurationError:
          "公開環境のAPI URLがlocalhostを指しています。VITE_API_BASE_URLをRenderのBackend URLに変更して再デプロイしてください。",
      };
    }
  } catch {
    return { baseUrl: configuredBaseUrl };
  }

  return { baseUrl: configuredBaseUrl };
}

const API_BASE_URL_CONFIG = getApiBaseUrl();
const API_BASE_URL = API_BASE_URL_CONFIG.baseUrl;
const NETWORK_RETRY_DELAYS_MS = [1200, 3000, 6000];

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function wait(ms: number) {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchWithNetworkRetry(url: string, init: RequestInit, retryOnNetworkError: boolean) {
  const maxAttempts = retryOnNetworkError ? NETWORK_RETRY_DELAYS_MS.length + 1 : 1;
  let lastError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;

      if (attempt >= maxAttempts - 1) {
        break;
      }

      await wait(NETWORK_RETRY_DELAYS_MS[attempt]);
    }
  }

  throw lastError;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string, options: { retryOnNetworkError?: boolean } = {}): Promise<T> {
  if (API_BASE_URL_CONFIG.configurationError) {
    throw new ApiError(0, API_BASE_URL_CONFIG.configurationError);
  }

  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetchWithNetworkRetry(
    `${API_BASE_URL}${path}`,
    {
      ...init,
      headers,
    },
    options.retryOnNetworkError === true,
  );

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
  return request<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    undefined,
    { retryOnNetworkError: true },
  );
}

export function adminLogin(adminId: string, password: string) {
  return request<AdminAuthResponse>(
    "/auth/admin/login",
    {
      method: "POST",
      body: JSON.stringify({ admin_id: adminId, password }),
    },
    undefined,
    { retryOnNetworkError: true },
  );
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

export function verifyEmail(verificationToken: string) {
  return request<EmailVerificationResponse>("/auth/email/verify", {
    method: "POST",
    body: JSON.stringify({ verification_token: verificationToken }),
  });
}

export function resendEmailVerification(email: string) {
  return request<EmailVerificationResponse>("/auth/email/resend", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function requestPasswordReset(email: string) {
  return request<PasswordResetRequestResponse>("/auth/password/reset-request", {
    method: "POST",
    body: JSON.stringify({ email }),
  }, undefined, { retryOnNetworkError: true });
}

export function resetPassword(resetToken: string, newPassword: string) {
  return request<{ message: string }>("/auth/password/reset", {
    method: "POST",
    body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
  }, undefined, { retryOnNetworkError: true });
}

export function changePassword(currentPassword: string, newPassword: string, token: string) {
  return request<{ message: string }>(
    "/auth/password",
    {
      method: "PUT",
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    },
    token,
  );
}

export function getUserProfile(userId: number, token: string) {
  return request<UserProfile>(`/users/${userId}/points`, {}, token);
}

export function getUserHistory(userId: number, token: string) {
  return request<UserHistory>(`/users/${userId}/history`, {}, token);
}

export function getUserPurchases(userId: number, token: string) {
  return request<Purchase[]>(`/users/${userId}/purchases`, {}, token);
}

export function getLikedEvents(userId: number, token: string) {
  return request<EventItem[]>(`/users/${userId}/liked-events`, {}, token);
}

export function getFavoriteServices(userId: number, token: string) {
  return request<ServiceItem[]>(`/users/${userId}/favorite-services`, {}, token);
}

export function getUserSettings(userId: number, token: string) {
  return request<UserSettings>(`/users/${userId}/settings`, {}, token);
}

export function updateUserSettings(
  userId: number,
  payload: Partial<Pick<UserSettings, "notification_enabled" | "language" | "font_size">>,
  token: string,
) {
  return request<UserSettings>(
    `/users/${userId}/settings`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function updateUserEmail(userId: number, email: string, token: string) {
  return request<{ message: string; email: string }>(
    `/users/${userId}/email`,
    {
      method: "PUT",
      body: JSON.stringify({ email }),
    },
    token,
  );
}

export function deleteUser(userId: number, token: string) {
  return request<{ message: string }>(
    `/users/${userId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function getPaymentMethods(userId: number, token: string) {
  return request<PaymentMethod[]>(`/users/${userId}/payment-methods`, {}, token);
}

export function addPaymentMethod(
  userId: number,
  payload: { label: string; brand?: string; last4?: string; is_default?: boolean },
  token: string,
) {
  return request<{ message: string; payment_method_id: number }>(
    `/users/${userId}/payment-methods`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function deletePaymentMethod(userId: number, paymentMethodId: number, token: string) {
  return request<{ message: string }>(
    `/users/${userId}/payment-methods/${paymentMethodId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function getNotifications(userId: number, token: string) {
  return request<NotificationItem[]>(`/users/${userId}/notifications`, {}, token);
}

export function markNotificationRead(notificationId: number, token: string) {
  return request<{ message: string; notification_id: number }>(
    `/notifications/${notificationId}/read`,
    {
      method: "PUT",
    },
    token,
  );
}

export function getMySupportTickets(token: string) {
  return request<SupportTicket[]>("/support/tickets", {}, token);
}

export function createSupportTicket(payload: { category: "support" | "bug"; subject: string; body: string }, token: string) {
  return request<{ message: string; ticket_id: number }>(
    "/support/tickets",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
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

export function cancelEventParticipation(eventId: number, token: string) {
  return request<ParticipationCancellationResponse>(
    `/events/${eventId}/participation`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function checkInEvent(checkInCode: string, token: string) {
  return request<ParticipationResponse>(
    "/events/check-in",
    {
      method: "POST",
      body: JSON.stringify({ check_in_code: checkInCode }),
    },
    token,
  );
}

export function likeEvent(eventId: number, token: string) {
  return request<{ message: string; event_id: number; liked: boolean }>(
    `/events/${eventId}/like`,
    {
      method: "POST",
    },
    token,
  );
}

export function unlikeEvent(eventId: number, token: string) {
  return request<{ message: string; event_id: number; liked: boolean }>(
    `/events/${eventId}/like`,
    {
      method: "DELETE",
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

export function purchasePoints(
  payload: { points: number; payment_method_id?: number | null; simulate_status?: Purchase["status"] },
  token: string,
) {
  return request<PurchaseResponse>(
    "/points/purchase",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function favoriteService(serviceId: number, token: string) {
  return request<{ message: string; service_id: number; favorited: boolean }>(
    `/points/services/${serviceId}/favorite`,
    {
      method: "POST",
    },
    token,
  );
}

export function unfavoriteService(serviceId: number, token: string) {
  return request<{ message: string; service_id: number; favorited: boolean }>(
    `/points/services/${serviceId}/favorite`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function adminGetStats(token: string) {
  return request<AdminStats>("/admin/stats", {}, token);
}

export function adminGetEvents(token: string) {
  return request<EventItem[]>("/admin/events", {}, token);
}

export function adminCreateEvent(
  payload: { event_name: string; event_datetime: string; location?: string; grant_points: number; status?: "active" | "paused" },
  token: string,
) {
  return request<{ message: string; event_id: number; check_in_code: string }>(
    "/admin/events",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminUpdateEvent(eventId: number, payload: Partial<EventItem>, token: string) {
  return request<{ message: string }>(
    `/admin/events/${eventId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminDeleteEvent(eventId: number, token: string) {
  return request<{ message: string }>(
    `/admin/events/${eventId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function adminGetEventCheckInCode(eventId: number, token: string) {
  return request<{ event_id: number; check_in_code: string; expires_at: string }>(`/admin/events/${eventId}/check-in-code`, {}, token);
}

export function adminGetStores(token: string) {
  return request<StoreItem[]>("/admin/stores", {}, token);
}

export function adminCreateStore(payload: { store_name: string; status?: "active" | "paused" }, token: string) {
  return request<{ message: string; store_id: number }>(
    "/admin/stores",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminUpdateStore(storeId: number, payload: Partial<StoreItem>, token: string) {
  return request<{ message: string }>(
    `/admin/stores/${storeId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminDeleteStore(storeId: number, token: string) {
  return request<{ message: string }>(
    `/admin/stores/${storeId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function adminGetServices(token: string) {
  return request<AdminServiceItem[]>("/admin/services", {}, token);
}

export function adminCreateService(
  payload: { store_id: number; service_name: string; required_points: number; status?: "active" | "paused" },
  token: string,
) {
  return request<{ message: string; service_id: number }>(
    "/admin/services",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminUpdateService(serviceId: number, payload: Partial<AdminServiceItem>, token: string) {
  return request<{ message: string }>(
    `/admin/services/${serviceId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminDeleteService(serviceId: number, token: string) {
  return request<{ message: string }>(
    `/admin/services/${serviceId}`,
    {
      method: "DELETE",
    },
    token,
  );
}

export function adminGetUsers(token: string, search = "") {
  return request<ManagedUser[]>(`/admin/users?search=${encodeURIComponent(search)}`, {}, token);
}

export function adminGetUser(userId: number, token: string) {
  return request<AdminUserDetail>(`/admin/users/${userId}`, {}, token);
}

export function adminUpdateUser(userId: number, payload: Partial<ManagedUser>, token: string) {
  return request<{ message: string }>(
    `/admin/users/${userId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminCreateNotification(payload: { user_id?: number; title: string; body: string }, token: string) {
  return request<{ message: string; delivered_count: number }>(
    "/admin/notifications",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
    token,
  );
}

export function adminGetSupportTickets(token: string) {
  return request<SupportTicket[]>("/admin/support/tickets", {}, token);
}

export function adminUpdateSupportTicket(
  ticketId: number,
  payload: { status?: SupportTicket["status"]; admin_note?: string },
  token: string,
) {
  return request<{ message: string }>(
    `/admin/support/tickets/${ticketId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
    token,
  );
}
