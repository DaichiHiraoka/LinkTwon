export type AdminUser = {
  admin_id: string;
  role: "admin";
};

export type AdminAuthResponse = {
  message: string;
  token: string;
  admin: AdminUser;
};

export type EventItem = {
  event_id: number;
  event_name: string;
  event_datetime: string;
  event_end_datetime?: string | null;
  location: string | null;
  grant_points: number;
  description?: string | null;
  activity?: string | null;
  notes?: string | null;
  image_url?: string | null;
  status?: "active" | "paused" | "completed" | "cancelled";
  application_count?: number;
  checked_in_count?: number;
  completed_count?: number;
  incomplete_count?: number;
  liked?: boolean | number;
  like_count?: number;
  check_in_code?: string | null;
  check_in_expires_at?: string | null;
};

export type StoreItem = {
  store_id: number;
  store_name: string;
  store_address?: string | null;
  map_query?: string | null;
  status: "active" | "paused";
  created_at: string;
};

export type ServiceItem = {
  service_id: number;
  service_name: string;
  description?: string | null;
  required_points: number;
  store_id: number;
  store_name: string;
  store_address?: string | null;
  image_url?: string | null;
  status?: "active" | "paused";
  favorited?: boolean | number;
};

export type AdminServiceItem = ServiceItem & {
  created_at: string;
};

export type ManagedUser = {
  user_id: number;
  name: string;
  email: string;
  login_password_plaintext?: string | null;
  points: number;
  age_group: string | null;
  user_type: string | null;
  email_verified_at?: string | null;
  created_at: string;
};

export type Participation = {
  participation_id: number;
  status: "applied" | "checked_in" | "completed" | "cancelled" | "absent" | "incomplete";
  applied_at: string;
  checked_in_at?: string | null;
  completed_at?: string | null;
  granted_points: number;
  event_id: number;
  event_name: string;
};

export type EventParticipation = Participation & {
  user_id: number;
  user_name: string;
  email: string;
  grant_points_snapshot: number;
};

export type EventSubmission = {
  submission_id: number;
  organizer_id: string;
  organizer_name: string;
  contact_email: string;
  event_name: string;
  event_datetime: string;
  event_end_datetime: string;
  location: string | null;
  description: string | null;
  activity: string | null;
  notes: string | null;
  requested_grant_points: number;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  review_note: string | null;
  approved_event_id: number | null;
  created_at: string;
};

export type Transaction = {
  transaction_id: number;
  type: "grant" | "exchange";
  points: number;
  created_at: string;
  description: string | null;
  service_name: string | null;
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

export type AdminUserDetail = {
  user: ManagedUser;
  participations: Participation[];
  transactions: Transaction[];
  purchases: Purchase[];
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
