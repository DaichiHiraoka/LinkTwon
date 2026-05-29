export type Screen = "login" | "home" | "events" | "scan" | "wallet" | "purchase" | "history" | "account";
export type EventTab = "recommended" | "history";
export type ExchangeTab = "services" | "history";

export type AuthUser = {
  user_id: number;
  name: string;
  email: string;
  points: number;
  role: "user";
};

export type AuthResponse = {
  message: string;
  token: string;
  user: AuthUser;
};

export type RegisterResponse = {
  message: string;
  user_id: number;
  token: string;
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

export type UserHistory = {
  participations: Participation[];
  transactions: Transaction[];
};

export type ParticipationResponse = {
  message: string;
  event_id: number;
  granted_points: number;
  current_points: number;
};

export type ExchangeResponse = {
  message: string;
  service_id: number;
  service_name: string;
  used_points: number;
  current_points: number;
};
