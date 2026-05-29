export type Screen =
  | "login"
  | "home"
  | "events"
  | "scan"
  | "wallet"
  | "purchase"
  | "notifications"
  | "support"
  | "account"
  | "admin";

export type EventTab = "all" | "liked" | "history";
export type ExchangeTab = "services" | "favorites" | "history";
export type AdminTab = "dashboard" | "events" | "stores" | "services" | "users" | "support";

export type AuthUser = {
  user_id: number;
  name: string;
  email: string;
  points: number;
  role: "user";
};

export type AdminUser = {
  admin_id: string;
  role: "admin";
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export type AdminAuthResponse = {
  message: string;
  token: string;
  admin: AdminUser;
};

export type RegisterResponse = {
  message: string;
  user_id: number;
  token: string;
};

export type PasswordResetRequestResponse = {
  message: string;
  reset_token?: string;
};

export type UserProfile = {
  user_id: number;
  name: string;
  email: string;
  points: number;
  age_group: string | null;
  user_type: string | null;
};

export type EventItem = {
  event_id: number;
  event_name: string;
  event_datetime: string;
  location: string | null;
  grant_points: number;
  status?: "active" | "paused";
  liked?: boolean | number;
  like_count?: number;
  check_in_code?: string | null;
  check_in_expires_at?: string | null;
};

export type Participation = {
  participation_id: number;
  participated_at: string;
  granted_points: number;
  event_id: number;
  event_name: string;
  event_datetime: string;
  location: string | null;
};

export type ServiceItem = {
  service_id: number;
  service_name: string;
  required_points: number;
  store_id: number;
  store_name: string;
  status?: "active" | "paused";
  favorited?: boolean | number;
};

export type Transaction = {
  transaction_id: number;
  type: "grant" | "exchange";
  points: number;
  created_at: string;
  description: string | null;
  service_id: number | null;
  service_name: string | null;
  store_name: string | null;
};

export type Purchase = {
  purchase_id: number;
  payment_method_id: number | null;
  payment_method_label?: string | null;
  points: number;
  amount_yen: number;
  status: "pending" | "paid" | "failed" | "cancelled";
  created_at: string;
};

export type UserHistory = {
  participations: Participation[];
  transactions: Transaction[];
  purchases?: Purchase[];
};

export type ParticipationResponse = {
  message: string;
  event_id: number;
  granted_points: number;
  current_points: number;
  check_in_code?: string;
};

export type ExchangeResponse = {
  message: string;
  service_id: number;
  service_name: string;
  used_points: number;
  current_points: number;
};

export type PurchaseResponse = {
  message: string;
  purchase_id: number;
  points: number;
  amount_yen: number;
  status: Purchase["status"];
  current_points: number;
};

export type UserSettings = {
  user_id: number;
  notification_enabled: boolean | number;
  language: string;
  font_size: "small" | "medium" | "large";
  updated_at?: string;
};

export type PaymentMethod = {
  payment_method_id: number;
  label: string;
  brand: string;
  last4: string;
  is_default: boolean | number;
  created_at: string;
};

export type NotificationItem = {
  notification_id: number;
  title: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

export type SupportTicket = {
  ticket_id: number;
  user_id?: number | null;
  user_name?: string | null;
  user_email?: string | null;
  category: "support" | "bug";
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export type StoreItem = {
  store_id: number;
  store_name: string;
  status: "active" | "paused";
  created_at: string;
};

export type AdminServiceItem = ServiceItem & {
  created_at: string;
};

export type ManagedUser = {
  user_id: number;
  name: string;
  email: string;
  points: number;
  age_group: string | null;
  user_type: string | null;
  created_at: string;
};

export type AdminUserDetail = {
  user: ManagedUser;
  participations: Array<{
    participation_id: number;
    participated_at: string;
    granted_points: number;
    event_id: number;
    event_name: string;
  }>;
  transactions: Array<{
    transaction_id: number;
    type: "grant" | "exchange";
    points: number;
    description: string | null;
    created_at: string;
    service_name: string | null;
  }>;
  purchases: Purchase[];
};

export type AdminStats = {
  total_users: number;
  active_events: number;
  open_tickets: number;
  total_participations: number;
  total_granted_points: number;
  total_exchanges: number;
  total_exchanged_points: number;
  total_purchases: number;
  total_purchased_points: number;
  event_participants: Array<{
    event_id: number;
    event_name: string;
    participation_count: number;
    granted_points: number;
  }>;
  service_exchanges: Array<{
    service_id: number;
    service_name: string;
    exchange_count: number;
    exchanged_points: number;
  }>;
};
