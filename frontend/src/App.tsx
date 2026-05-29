import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  addPaymentMethod,
  adminCreateEvent,
  adminCreateNotification,
  adminCreateService,
  adminCreateStore,
  adminDeleteEvent,
  adminDeleteService,
  adminDeleteStore,
  adminGetEvents,
  adminGetServices,
  adminGetStats,
  adminGetStores,
  adminGetSupportTickets,
  adminGetUser,
  adminGetUsers,
  adminLogin,
  adminUpdateEvent,
  adminUpdateService,
  adminUpdateStore,
  adminUpdateSupportTicket,
  adminUpdateUser,
  changePassword,
  checkInEvent,
  createSupportTicket,
  deletePaymentMethod,
  deleteUser,
  exchangePoints,
  favoriteService,
  getEvents,
  getFavoriteServices,
  getLikedEvents,
  getMySupportTickets,
  getNotifications,
  getPaymentMethods,
  getServices,
  getUserHistory,
  getUserProfile,
  getUserPurchases,
  getUserSettings,
  likeEvent,
  login,
  markNotificationRead,
  participateInEvent,
  purchasePoints,
  register,
  requestPasswordReset,
  resetPassword,
  unfavoriteService,
  unlikeEvent,
  updateUserEmail,
  updateUserSettings,
} from "./api";
import { Logo } from "./components/Logo";
import {
  AccountIcon,
  ArrowIcon,
  CheckIcon,
  EventIcon,
  HelpIcon,
  HomeIcon,
  MailIcon,
  QrIcon,
  WalletIcon,
} from "./components/Icons";
import type {
  AdminAuthResponse,
  AdminStats,
  AdminTab,
  AdminUserDetail,
  AuthResponse,
  EventItem,
  EventTab,
  ExchangeTab,
  ManagedUser,
  NotificationItem,
  PaymentMethod,
  Purchase,
  Screen,
  ServiceItem,
  StoreItem,
  SupportTicket,
  Transaction,
  UserHistory,
  UserProfile,
  UserSettings,
} from "./types";

const SESSION_STORAGE_KEY = "link-town-session";
const ADMIN_SESSION_STORAGE_KEY = "link-town-admin-session";

type AuthMode = "login" | "register" | "admin";
type Session = Pick<AuthResponse, "token" | "user">;
type AdminSession = Pick<AdminAuthResponse, "token" | "admin">;

type BarcodeDetectorResult = {
  rawValue: string;
};

type BarcodeDetectorInstance = {
  detect: (image: HTMLVideoElement) => Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options: { formats: string[] }) => BarcodeDetectorInstance;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

type NoticeState = {
  kind: "info" | "success" | "error";
  title: string;
  message: string;
} | null;

type ServiceGroup = {
  id: string;
  name: string;
  services: ServiceItem[];
};

function readStoredValue<T>(key: string): T | null {
  const rawValue = window.localStorage.getItem(key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as T;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeStoredValue<T>(key: string, value: T | null) {
  if (value) {
    window.localStorage.setItem(key, JSON.stringify(value));
  } else {
    window.localStorage.removeItem(key);
  }
}

function formatDateTimeParts(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return { date: value, time: "-" };
  }

  const dateText = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
  const timeText = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  return { date: dateText, time: timeText };
}

function formatDateTime(value: string) {
  const parts = formatDateTimeParts(value);
  return `${parts.date} ${parts.time}`;
}

function formatUserType(value: string | null | undefined) {
  if (!value) {
    return "未設定";
  }

  if (value === "general") {
    return "一般ユーザー";
  }

  return value;
}

function boolFlag(value: boolean | number | undefined | null) {
  return value === true || value === 1;
}

function groupServicesByStore(services: ServiceItem[]): ServiceGroup[] {
  const grouped = new Map<number, ServiceGroup>();

  for (const service of services) {
    const existing = grouped.get(service.store_id);

    if (existing) {
      existing.services.push(service);
      continue;
    }

    grouped.set(service.store_id, {
      id: `store-${service.store_id}`,
      name: service.store_name,
      services: [service],
    });
  }

  return [...grouped.values()];
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "通信に失敗しました。";
}

function mapTransactionToText(transaction: Transaction) {
  const label = transaction.service_name ?? (transaction.type === "grant" ? "ポイント付与" : "ポイント交換");
  return `${label}: ${transaction.points}pt / ${formatDateTime(transaction.created_at)}`;
}

export function App() {
  const [screen, setScreen] = useState<Screen>(() => {
    if (readStoredValue<AdminSession>(ADMIN_SESSION_STORAGE_KEY)) {
      return "admin";
    }

    return readStoredValue<Session>(SESSION_STORAGE_KEY) ? "home" : "login";
  });
  const [eventTab, setEventTab] = useState<EventTab>("all");
  const [exchangeTab, setExchangeTab] = useState<ExchangeTab>("services");
  const [adminTab, setAdminTab] = useState<AdminTab>("dashboard");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<Session | null>(() => readStoredValue<Session>(SESSION_STORAGE_KEY));
  const [adminSession, setAdminSession] = useState<AdminSession | null>(() => readStoredValue<AdminSession>(ADMIN_SESSION_STORAGE_KEY));

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [likedEvents, setLikedEvents] = useState<EventItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [favoriteServices, setFavoriteServices] = useState<ServiceItem[]>([]);
  const [history, setHistory] = useState<UserHistory>({ participations: [], transactions: [], purchases: [] });
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);

  const [adminStats, setAdminStats] = useState<AdminStats | null>(null);
  const [adminEvents, setAdminEvents] = useState<EventItem[]>([]);
  const [adminStores, setAdminStores] = useState<StoreItem[]>([]);
  const [adminServices, setAdminServices] = useState<ServiceItem[]>([]);
  const [adminUsers, setAdminUsers] = useState<ManagedUser[]>([]);
  const [adminTickets, setAdminTickets] = useState<SupportTicket[]>([]);
  const [adminUserDetail, setAdminUserDetail] = useState<AdminUserDetail | null>(null);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerAgeGroup, setRegisterAgeGroup] = useState("");
  const [registerUserType, setRegisterUserType] = useState("general");
  const [adminId, setAdminId] = useState("admin");
  const [adminPassword, setAdminPassword] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [resetNewPassword, setResetNewPassword] = useState("");

  const [checkInCode, setCheckInCode] = useState("");
  const [purchasePointAmount, setPurchasePointAmount] = useState("100");
  const [purchasePaymentMethodId, setPurchasePaymentMethodId] = useState("");
  const [purchaseStatus, setPurchaseStatus] = useState<Purchase["status"]>("paid");
  const [paymentLabel, setPaymentLabel] = useState("");
  const [paymentBrand, setPaymentBrand] = useState("mock-visa");
  const [paymentLast4, setPaymentLast4] = useState("4242");
  const [emailDraft, setEmailDraft] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [supportCategory, setSupportCategory] = useState<"support" | "bug">("support");
  const [supportSubject, setSupportSubject] = useState("");
  const [supportBody, setSupportBody] = useState("");

  const [adminEventName, setAdminEventName] = useState("");
  const [adminEventDatetime, setAdminEventDatetime] = useState("2026-06-15 10:00:00");
  const [adminEventLocation, setAdminEventLocation] = useState("");
  const [adminEventPoints, setAdminEventPoints] = useState("50");
  const [adminStoreName, setAdminStoreName] = useState("");
  const [adminServiceStoreId, setAdminServiceStoreId] = useState("");
  const [adminServiceName, setAdminServiceName] = useState("");
  const [adminServicePoints, setAdminServicePoints] = useState("100");
  const [adminUserSearch, setAdminUserSearch] = useState("");
  const [adminUserPointDrafts, setAdminUserPointDrafts] = useState<Record<number, string>>({});
  const [adminNotificationUserId, setAdminNotificationUserId] = useState("");
  const [adminNotificationTitle, setAdminNotificationTitle] = useState("");
  const [adminNotificationBody, setAdminNotificationBody] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>({
    kind: "info",
    title: "仮実装フロントエンド",
    message: "追加 UI 設計図への差し替え前提で、backend 機能を操作確認するための暫定画面です。",
  });

  async function reloadUserData(activeSession: Session, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const userId = activeSession.user.user_id;
      const [
        nextProfile,
        nextEvents,
        nextServices,
        nextHistory,
        nextPurchases,
        nextLikedEvents,
        nextFavoriteServices,
        nextSettings,
        nextPaymentMethods,
        nextNotifications,
        nextTickets,
      ] = await Promise.all([
        getUserProfile(userId, activeSession.token),
        getEvents(activeSession.token),
        getServices(activeSession.token),
        getUserHistory(userId, activeSession.token),
        getUserPurchases(userId, activeSession.token),
        getLikedEvents(userId, activeSession.token),
        getFavoriteServices(userId, activeSession.token),
        getUserSettings(userId, activeSession.token),
        getPaymentMethods(userId, activeSession.token),
        getNotifications(userId, activeSession.token),
        getMySupportTickets(activeSession.token),
      ]);

      setProfile(nextProfile);
      setEmailDraft(nextProfile.email);
      setEvents(nextEvents);
      setServices(nextServices);
      setHistory({ ...nextHistory, purchases: nextPurchases });
      setPurchases(nextPurchases);
      setLikedEvents(nextLikedEvents);
      setFavoriteServices(nextFavoriteServices);
      setSettings(nextSettings);
      setPaymentMethods(nextPaymentMethods);
      setNotifications(nextNotifications);
      setSupportTickets(nextTickets);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  async function reloadAdminData(activeAdminSession: AdminSession, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [stats, nextEvents, stores, nextServices, users, tickets] = await Promise.all([
        adminGetStats(activeAdminSession.token),
        adminGetEvents(activeAdminSession.token),
        adminGetStores(activeAdminSession.token),
        adminGetServices(activeAdminSession.token),
        adminGetUsers(activeAdminSession.token, adminUserSearch),
        adminGetSupportTickets(activeAdminSession.token),
      ]);

      setAdminStats(stats);
      setAdminEvents(nextEvents);
      setAdminStores(stores);
      setAdminServices(nextServices);
      setAdminUsers(users);
      setAdminTickets(tickets);
      if (!adminServiceStoreId && stores[0]) {
        setAdminServiceStoreId(String(stores[0].store_id));
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!session) {
      writeStoredValue(SESSION_STORAGE_KEY, null);
      setProfile(null);
      setEvents([]);
      setLikedEvents([]);
      setServices([]);
      setFavoriteServices([]);
      setHistory({ participations: [], transactions: [], purchases: [] });
      setPurchases([]);
      setSettings(null);
      setPaymentMethods([]);
      setNotifications([]);
      setSupportTickets([]);
      return;
    }

    writeStoredValue(SESSION_STORAGE_KEY, session);
    reloadUserData(session).catch((error) => {
      setNotice({
        kind: "error",
        title: "ユーザーデータ取得に失敗しました",
        message: getErrorMessage(error),
      });

      if (error instanceof ApiError && error.status === 401) {
        writeStoredValue(SESSION_STORAGE_KEY, null);
        setSession(null);
        setScreen("login");
      }
    });
  }, [session]);

  useEffect(() => {
    if (!adminSession) {
      writeStoredValue(ADMIN_SESSION_STORAGE_KEY, null);
      setAdminStats(null);
      setAdminEvents([]);
      setAdminStores([]);
      setAdminServices([]);
      setAdminUsers([]);
      setAdminTickets([]);
      setAdminUserDetail(null);
      return;
    }

    writeStoredValue(ADMIN_SESSION_STORAGE_KEY, adminSession);
    reloadAdminData(adminSession).catch((error) => {
      setNotice({
        kind: "error",
        title: "管理者データ取得に失敗しました",
        message: getErrorMessage(error),
      });

      if (error instanceof ApiError && error.status === 401) {
        writeStoredValue(ADMIN_SESSION_STORAGE_KEY, null);
        setAdminSession(null);
        setScreen("login");
      }
    });
  }, [adminSession]);

  const currentPoints = profile?.points ?? session?.user.points ?? 0;
  const participatedEventIds = new Set(history.participations.map((item) => item.event_id));
  const visibleEvents =
    eventTab === "all"
      ? events
      : eventTab === "liked"
        ? likedEvents
        : history.participations.map((item) => ({
            event_id: item.event_id,
            event_name: item.event_name,
            event_datetime: item.event_datetime,
            location: item.location,
            grant_points: item.granted_points,
            liked: false,
            like_count: 0,
          }));
  const visibleServices =
    exchangeTab === "services"
      ? services
      : exchangeTab === "favorites"
        ? favoriteServices
        : services.filter((service) =>
            history.transactions.some((item) => item.type === "exchange" && item.service_id === service.service_id),
          );
  const unreadNotificationCount = notifications.filter((item) => !item.read_at).length;

  async function handleLogin() {
    if (!loginEmail || !loginPassword) {
      setNotice({ kind: "error", title: "入力不足", message: "メールアドレスとパスワードを入力してください。" });
      return;
    }

    setBusyAction("login");
    try {
      const auth = await login(loginEmail, loginPassword);
      setAdminSession(null);
      setSession({ token: auth.token, user: auth.user });
      setScreen("home");
      setNotice({ kind: "success", title: "ログイン完了", message: "一般ユーザー機能を backend に接続しました。" });
      setLoginPassword("");
    } catch (error) {
      setNotice({ kind: "error", title: "ログイン失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAdminLogin() {
    if (!adminId || !adminPassword) {
      setNotice({ kind: "error", title: "入力不足", message: "管理者IDとパスワードを入力してください。" });
      return;
    }

    setBusyAction("admin-login");
    try {
      const auth = await adminLogin(adminId, adminPassword);
      setSession(null);
      setAdminSession({ token: auth.token, admin: auth.admin });
      setScreen("admin");
      setNotice({ kind: "success", title: "管理者ログイン完了", message: "管理者 API 操作用の仮画面へ遷移しました。" });
      setAdminPassword("");
    } catch (error) {
      setNotice({ kind: "error", title: "管理者ログイン失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRegister() {
    if (!registerName || !registerEmail || !registerPassword) {
      setNotice({ kind: "error", title: "入力不足", message: "登録には名前、メールアドレス、パスワードが必要です。" });
      return;
    }

    setBusyAction("register");
    try {
      await register({
        name: registerName,
        email: registerEmail,
        password: registerPassword,
        age_group: registerAgeGroup || undefined,
        user_type: registerUserType || undefined,
      });

      const auth = await login(registerEmail, registerPassword);
      setAdminSession(null);
      setSession({ token: auth.token, user: auth.user });
      setScreen("home");
      setAuthMode("login");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterAgeGroup("");
      setRegisterUserType("general");
      setNotice({ kind: "success", title: "ユーザー登録完了", message: "登録後に自動ログインしました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "ユーザー登録失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePasswordResetRequest() {
    if (!resetEmail) {
      setNotice({ kind: "error", title: "入力不足", message: "再発行対象のメールアドレスを入力してください。" });
      return;
    }

    setBusyAction("reset-request");
    try {
      const result = await requestPasswordReset(resetEmail);
      if (result.reset_token) {
        setResetToken(result.reset_token);
      }
      setNotice({
        kind: "success",
        title: "再発行 token を発行",
        message: result.reset_token ? `開発用 token: ${result.reset_token}` : result.message,
      });
    } catch (error) {
      setNotice({ kind: "error", title: "再発行要求失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePasswordReset() {
    if (!resetToken || !resetNewPassword) {
      setNotice({ kind: "error", title: "入力不足", message: "reset token と新しいパスワードを入力してください。" });
      return;
    }

    setBusyAction("reset-password");
    try {
      await resetPassword(resetToken, resetNewPassword);
      setResetNewPassword("");
      setNotice({ kind: "success", title: "パスワード再設定完了", message: "新しいパスワードでログインできます。" });
    } catch (error) {
      setNotice({ kind: "error", title: "パスワード再設定失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function refreshUser(message = "backend から最新データを再読み込みしました。") {
    if (!session) {
      return;
    }

    try {
      await reloadUserData(session);
      setNotice({ kind: "info", title: "データ再取得", message });
    } catch (error) {
      setNotice({ kind: "error", title: "再取得失敗", message: getErrorMessage(error) });
    }
  }

  async function refreshAdmin(message = "管理者データを再読み込みしました。") {
    if (!adminSession) {
      return;
    }

    try {
      await reloadAdminData(adminSession);
      setNotice({ kind: "info", title: "管理者データ再取得", message });
    } catch (error) {
      setNotice({ kind: "error", title: "管理者データ再取得失敗", message: getErrorMessage(error) });
    }
  }

  async function handleParticipate(eventId: number) {
    if (!session || participatedEventIds.has(eventId)) {
      return;
    }

    setBusyAction(`event-${eventId}`);
    try {
      const result = await participateInEvent(eventId, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "参加登録完了", message: `現在のポイント: ${result.current_points}pt` });
    } catch (error) {
      setNotice({ kind: "error", title: "参加登録失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleEventLike(event: EventItem) {
    if (!session) {
      return;
    }

    setBusyAction(`like-${event.event_id}`);
    try {
      if (boolFlag(event.liked)) {
        await unlikeEvent(event.event_id, session.token);
      } else {
        await likeEvent(event.event_id, session.token);
      }
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "いいね更新", message: "イベントいいね状態を保存しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "いいね更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCheckIn() {
    if (!session || !checkInCode) {
      setNotice({ kind: "error", title: "入力不足", message: "QR 読み取り結果または check-in code を入力してください。" });
      return;
    }

    setBusyAction("check-in");
    try {
      const result = await checkInEvent(checkInCode, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "QR チェックイン完了", message: `付与: ${result.granted_points}pt / 残高: ${result.current_points}pt` });
      setCheckInCode("");
    } catch (error) {
      setNotice({ kind: "error", title: "QR チェックイン失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExchange(service: ServiceItem) {
    if (!session || currentPoints < service.required_points) {
      return;
    }

    setBusyAction(`service-${service.service_id}`);
    try {
      const result = await exchangePoints(service.service_id, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "ポイント交換完了", message: `現在のポイント: ${result.current_points}pt` });
    } catch (error) {
      setNotice({ kind: "error", title: "ポイント交換失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleFavorite(service: ServiceItem) {
    if (!session) {
      return;
    }

    setBusyAction(`favorite-${service.service_id}`);
    try {
      if (boolFlag(service.favorited)) {
        await unfavoriteService(service.service_id, session.token);
      } else {
        await favoriteService(service.service_id, session.token);
      }
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "お気に入り更新", message: "交換サービスのお気に入りを保存しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "お気に入り更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handlePurchase() {
    if (!session) {
      return;
    }

    const amount = Number(purchasePointAmount);
    if (!Number.isInteger(amount) || amount <= 0) {
      setNotice({ kind: "error", title: "入力不正", message: "購入ポイントは正の整数で入力してください。" });
      return;
    }

    setBusyAction("purchase");
    try {
      const result = await purchasePoints(
        {
          points: amount,
          payment_method_id: purchasePaymentMethodId ? Number(purchasePaymentMethodId) : null,
          simulate_status: purchaseStatus,
        },
        session.token,
      );
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "ポイント購入処理完了", message: `${result.status} / 残高: ${result.current_points}pt` });
    } catch (error) {
      setNotice({ kind: "error", title: "ポイント購入失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddPaymentMethod() {
    if (!session || !paymentLabel) {
      setNotice({ kind: "error", title: "入力不足", message: "支払方法名を入力してください。" });
      return;
    }

    setBusyAction("payment-add");
    try {
      await addPaymentMethod(
        session.user.user_id,
        { label: paymentLabel, brand: paymentBrand, last4: paymentLast4, is_default: paymentMethods.length === 0 },
        session.token,
      );
      await reloadUserData(session, true);
      setPaymentLabel("");
      setNotice({ kind: "success", title: "支払方法追加", message: "mock 支払方法を保存しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "支払方法追加失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeletePaymentMethod(paymentMethodId: number) {
    if (!session) {
      return;
    }

    setBusyAction(`payment-delete-${paymentMethodId}`);
    try {
      await deletePaymentMethod(session.user.user_id, paymentMethodId, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "支払方法削除", message: "mock 支払方法を削除しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "支払方法削除失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateEmail() {
    if (!session || !emailDraft) {
      return;
    }

    setBusyAction("email-update");
    try {
      await updateUserEmail(session.user.user_id, emailDraft, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "メール更新", message: "メールアドレスを更新しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "メール更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleChangePassword() {
    if (!session || !currentPassword || !newPassword) {
      setNotice({ kind: "error", title: "入力不足", message: "現在パスワードと新パスワードを入力してください。" });
      return;
    }

    setBusyAction("password-change");
    try {
      await changePassword(currentPassword, newPassword, session.token);
      setCurrentPassword("");
      setNewPassword("");
      setNotice({ kind: "success", title: "パスワード変更", message: "パスワードを更新しました。セッションは継続しています。" });
    } catch (error) {
      setNotice({ kind: "error", title: "パスワード変更失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateSettings(nextSettings: Partial<UserSettings>) {
    if (!session) {
      return;
    }

    setBusyAction("settings-update");
    try {
      const updated = await updateUserSettings(session.user.user_id, nextSettings, session.token);
      setSettings(updated);
      setNotice({ kind: "success", title: "設定更新", message: "ユーザー設定を保存しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "設定更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteAccount() {
    if (!session) {
      return;
    }

    setBusyAction("account-delete");
    try {
      await deleteUser(session.user.user_id, session.token);
      setSession(null);
      setScreen("login");
      setNotice({ kind: "success", title: "アカウント削除", message: "ユーザーを削除し、ローカルセッションを破棄しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "アカウント削除失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleMarkNotificationRead(notificationId: number) {
    if (!session) {
      return;
    }

    setBusyAction(`notification-${notificationId}`);
    try {
      await markNotificationRead(notificationId, session.token);
      await reloadUserData(session, true);
      setNotice({ kind: "success", title: "通知既読化", message: "通知を既読にしました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "通知既読化失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateSupportTicket() {
    if (!session || !supportSubject || !supportBody) {
      setNotice({ kind: "error", title: "入力不足", message: "件名と本文を入力してください。" });
      return;
    }

    setBusyAction("support-create");
    try {
      await createSupportTicket({ category: supportCategory, subject: supportSubject, body: supportBody }, session.token);
      await reloadUserData(session, true);
      setSupportSubject("");
      setSupportBody("");
      setNotice({ kind: "success", title: "問い合わせ送信", message: "support_tickets に記録しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "問い合わせ送信失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateAdminEvent() {
    if (!adminSession || !adminEventName || !adminEventDatetime) {
      setNotice({ kind: "error", title: "入力不足", message: "イベント名と日時を入力してください。" });
      return;
    }

    setBusyAction("admin-event-create");
    try {
      const result = await adminCreateEvent(
        {
          event_name: adminEventName,
          event_datetime: adminEventDatetime,
          location: adminEventLocation,
          grant_points: Number(adminEventPoints || 0),
          status: "active",
        },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setAdminEventName("");
      setAdminEventLocation("");
      setNotice({ kind: "success", title: "イベント作成", message: `event_id=${result.event_id} / QR=${result.check_in_code}` });
    } catch (error) {
      setNotice({ kind: "error", title: "イベント作成失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleAdminEventStatus(event: EventItem) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-event-${event.event_id}`);
    try {
      await adminUpdateEvent(
        event.event_id,
        {
          event_name: event.event_name,
          event_datetime: event.event_datetime,
          location: event.location,
          grant_points: event.grant_points,
          status: event.status === "paused" ? "active" : "paused",
        },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "イベント公開状態更新", message: "status を切り替えました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "イベント更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteAdminEvent(eventId: number) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-event-delete-${eventId}`);
    try {
      await adminDeleteEvent(eventId, adminSession.token);
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "イベント削除", message: "イベントを削除しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "イベント削除失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateAdminStore() {
    if (!adminSession || !adminStoreName) {
      setNotice({ kind: "error", title: "入力不足", message: "店舗名を入力してください。" });
      return;
    }

    setBusyAction("admin-store-create");
    try {
      await adminCreateStore({ store_name: adminStoreName, status: "active" }, adminSession.token);
      await reloadAdminData(adminSession, true);
      setAdminStoreName("");
      setNotice({ kind: "success", title: "店舗作成", message: "stores に店舗を追加しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "店舗作成失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleAdminStoreStatus(store: StoreItem) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-store-${store.store_id}`);
    try {
      await adminUpdateStore(
        store.store_id,
        { store_name: store.store_name, status: store.status === "paused" ? "active" : "paused" },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "店舗公開状態更新", message: "status を切り替えました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "店舗更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteAdminStore(storeId: number) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-store-delete-${storeId}`);
    try {
      await adminDeleteStore(storeId, adminSession.token);
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "店舗削除", message: "店舗を削除しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "店舗削除失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateAdminService() {
    if (!adminSession || !adminServiceStoreId || !adminServiceName) {
      setNotice({ kind: "error", title: "入力不足", message: "店舗、サービス名、必要ポイントを入力してください。" });
      return;
    }

    setBusyAction("admin-service-create");
    try {
      await adminCreateService(
        {
          store_id: Number(adminServiceStoreId),
          service_name: adminServiceName,
          required_points: Number(adminServicePoints || 0),
          status: "active",
        },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setAdminServiceName("");
      setNotice({ kind: "success", title: "サービス作成", message: "交換サービスを追加しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "サービス作成失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleToggleAdminServiceStatus(service: ServiceItem) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-service-${service.service_id}`);
    try {
      await adminUpdateService(
        service.service_id,
        {
          store_id: service.store_id,
          service_name: service.service_name,
          required_points: service.required_points,
          status: service.status === "paused" ? "active" : "paused",
        },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "サービス公開状態更新", message: "status を切り替えました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "サービス更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDeleteAdminService(serviceId: number) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-service-delete-${serviceId}`);
    try {
      await adminDeleteService(serviceId, adminSession.token);
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "サービス削除", message: "交換サービスを削除しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "サービス削除失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAdminUserSearch() {
    if (!adminSession) {
      return;
    }

    setBusyAction("admin-user-search");
    try {
      const users = await adminGetUsers(adminSession.token, adminUserSearch);
      setAdminUsers(users);
      setNotice({ kind: "info", title: "ユーザー検索", message: `${users.length}件を表示しています。` });
    } catch (error) {
      setNotice({ kind: "error", title: "ユーザー検索失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleLoadAdminUserDetail(userId: number) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-user-detail-${userId}`);
    try {
      const detail = await adminGetUser(userId, adminSession.token);
      setAdminUserDetail(detail);
      setNotice({ kind: "info", title: "ユーザー詳細取得", message: `${detail.user.email} の履歴を取得しました。` });
    } catch (error) {
      setNotice({ kind: "error", title: "ユーザー詳細取得失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateAdminUserPoints(user: ManagedUser) {
    if (!adminSession) {
      return;
    }

    const points = Number(adminUserPointDrafts[user.user_id] ?? user.points);
    if (!Number.isInteger(points) || points < 0) {
      setNotice({ kind: "error", title: "入力不正", message: "ポイントは0以上の整数で入力してください。" });
      return;
    }

    setBusyAction(`admin-user-update-${user.user_id}`);
    try {
      await adminUpdateUser(user.user_id, { points }, adminSession.token);
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "ユーザー更新", message: `${user.email} のポイントを更新しました。` });
    } catch (error) {
      setNotice({ kind: "error", title: "ユーザー更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateAdminNotification() {
    if (!adminSession || !adminNotificationTitle || !adminNotificationBody) {
      setNotice({ kind: "error", title: "入力不足", message: "通知タイトルと本文を入力してください。" });
      return;
    }

    setBusyAction("admin-notification-create");
    try {
      const result = await adminCreateNotification(
        {
          user_id: adminNotificationUserId ? Number(adminNotificationUserId) : undefined,
          title: adminNotificationTitle,
          body: adminNotificationBody,
        },
        adminSession.token,
      );
      await reloadAdminData(adminSession, true);
      setAdminNotificationTitle("");
      setAdminNotificationBody("");
      setNotice({ kind: "success", title: "通知配信", message: `${result.delivered_count}件に配信しました。` });
    } catch (error) {
      setNotice({ kind: "error", title: "通知配信失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleUpdateAdminTicket(ticket: SupportTicket, status: SupportTicket["status"]) {
    if (!adminSession) {
      return;
    }

    setBusyAction(`admin-ticket-${ticket.ticket_id}`);
    try {
      await adminUpdateSupportTicket(ticket.ticket_id, { status, admin_note: ticket.admin_note || "仮管理画面で更新" }, adminSession.token);
      await reloadAdminData(adminSession, true);
      setNotice({ kind: "success", title: "問い合わせ更新", message: "ticket status を更新しました。" });
    } catch (error) {
      setNotice({ kind: "error", title: "問い合わせ更新失敗", message: getErrorMessage(error) });
    } finally {
      setBusyAction(null);
    }
  }

  function handleLogout() {
    setSession(null);
    setScreen("login");
    setLoginPassword("");
    setNotice({ kind: "info", title: "ログアウト", message: "一般ユーザーのローカルセッションを破棄しました。" });
  }

  function handleAdminLogout() {
    setAdminSession(null);
    setScreen("login");
    setNotice({ kind: "info", title: "管理者ログアウト", message: "管理者のローカルセッションを破棄しました。" });
  }

  return (
    <main className="app-viewport app-viewport--provisional">
      <section className="phone-shell phone-shell--provisional">
        <div className="provisional-banner">
          <span>TEMP BUILD</span>
          <small>backend 機能検証用 / 正式UI差し替え前</small>
        </div>
        {notice ? <NoticeBar notice={notice} onClose={() => setNotice(null)} /> : null}
        <div className={`phone-scroll ${session && screen !== "login" && screen !== "admin" ? "phone-scroll--nav" : ""}`}>
          {screen === "login" ? (
            <LoginScreen
              adminId={adminId}
              adminPassword={adminPassword}
              authMode={authMode}
              busyAction={busyAction}
              loginEmail={loginEmail}
              loginPassword={loginPassword}
              onAdminIdChange={setAdminId}
              onAdminLogin={() => void handleAdminLogin()}
              onAdminPasswordChange={setAdminPassword}
              onAuthModeChange={setAuthMode}
              onLogin={() => void handleLogin()}
              onLoginEmailChange={setLoginEmail}
              onLoginPasswordChange={setLoginPassword}
              onRegister={() => void handleRegister()}
              onRegisterAgeGroupChange={setRegisterAgeGroup}
              onRegisterEmailChange={setRegisterEmail}
              onRegisterNameChange={setRegisterName}
              onRegisterPasswordChange={setRegisterPassword}
              onRegisterUserTypeChange={setRegisterUserType}
              onResetEmailChange={setResetEmail}
              onResetNewPasswordChange={setResetNewPassword}
              onResetPassword={() => void handlePasswordReset()}
              onResetRequest={() => void handlePasswordResetRequest()}
              onResetTokenChange={setResetToken}
              registerAgeGroup={registerAgeGroup}
              registerEmail={registerEmail}
              registerName={registerName}
              registerPassword={registerPassword}
              registerUserType={registerUserType}
              resetEmail={resetEmail}
              resetNewPassword={resetNewPassword}
              resetToken={resetToken}
            />
          ) : null}
          {session && screen === "home" ? (
            <HomeScreen
              eventCount={events.length}
              exchangeCount={history.transactions.filter((item) => item.type === "exchange").length}
              isLoading={isLoading}
              likedCount={likedEvents.length}
              notificationCount={unreadNotificationCount}
              onNavigate={setScreen}
              onRefresh={() => void refreshUser()}
              participatedCount={participatedEventIds.size}
              points={currentPoints}
              profile={profile}
              recentTransactions={history.transactions.slice(0, 4)}
            />
          ) : null}
          {session && screen === "events" ? (
            <EventsScreen
              busyAction={busyAction}
              events={visibleEvents}
              isLoading={isLoading}
              onLike={handleToggleEventLike}
              onParticipate={handleParticipate}
              participatedEventIds={participatedEventIds}
              tab={eventTab}
              onTabChange={setEventTab}
            />
          ) : null}
          {session && screen === "scan" ? (
            <ScanScreen
              busyAction={busyAction}
              checkInCode={checkInCode}
              onCheckIn={() => void handleCheckIn()}
              onCheckInCodeChange={setCheckInCode}
              onHome={() => setScreen("home")}
            />
          ) : null}
          {session && screen === "wallet" ? (
            <WalletScreen
              busyAction={busyAction}
              currentPoints={currentPoints}
              exchangeHistory={history.transactions.filter((item) => item.type === "exchange")}
              groups={groupServicesByStore(visibleServices)}
              isLoading={isLoading}
              onExchange={handleExchange}
              onFavorite={handleToggleFavorite}
              onPurchase={() => setScreen("purchase")}
              tab={exchangeTab}
              onTabChange={setExchangeTab}
            />
          ) : null}
          {session && screen === "purchase" ? (
            <PurchaseScreen
              busyAction={busyAction}
              paymentBrand={paymentBrand}
              paymentLabel={paymentLabel}
              paymentLast4={paymentLast4}
              paymentMethodId={purchasePaymentMethodId}
              paymentMethods={paymentMethods}
              points={currentPoints}
              purchasePointAmount={purchasePointAmount}
              purchaseStatus={purchaseStatus}
              purchases={purchases}
              onAddPaymentMethod={() => void handleAddPaymentMethod()}
              onDeletePaymentMethod={(id) => void handleDeletePaymentMethod(id)}
              onPaymentBrandChange={setPaymentBrand}
              onPaymentLabelChange={setPaymentLabel}
              onPaymentLast4Change={setPaymentLast4}
              onPaymentMethodIdChange={setPurchasePaymentMethodId}
              onPurchase={() => void handlePurchase()}
              onPurchasePointAmountChange={setPurchasePointAmount}
              onPurchaseStatusChange={setPurchaseStatus}
            />
          ) : null}
          {session && screen === "notifications" ? (
            <NotificationsScreen
              busyAction={busyAction}
              notifications={notifications}
              onMarkRead={(id) => void handleMarkNotificationRead(id)}
            />
          ) : null}
          {session && screen === "support" ? (
            <SupportScreen
              busyAction={busyAction}
              category={supportCategory}
              body={supportBody}
              subject={supportSubject}
              tickets={supportTickets}
              onBodyChange={setSupportBody}
              onCategoryChange={setSupportCategory}
              onCreate={() => void handleCreateSupportTicket()}
              onSubjectChange={setSupportSubject}
            />
          ) : null}
          {session && screen === "account" ? (
            <AccountScreen
              busyAction={busyAction}
              currentPassword={currentPassword}
              emailDraft={emailDraft}
              newPassword={newPassword}
              onChangePassword={() => void handleChangePassword()}
              onCurrentPasswordChange={setCurrentPassword}
              onDeleteAccount={() => void handleDeleteAccount()}
              onEmailDraftChange={setEmailDraft}
              onLogout={handleLogout}
              onNewPasswordChange={setNewPassword}
              onUpdateEmail={() => void handleUpdateEmail()}
              onUpdateSettings={(next) => void handleUpdateSettings(next)}
              profile={profile}
              session={session}
              settings={settings}
            />
          ) : null}
          {adminSession && screen === "admin" ? (
            <AdminScreen
              adminEvents={adminEvents}
              adminId={adminSession.admin.admin_id}
              adminNotificationBody={adminNotificationBody}
              adminNotificationTitle={adminNotificationTitle}
              adminNotificationUserId={adminNotificationUserId}
              adminServiceName={adminServiceName}
              adminServicePoints={adminServicePoints}
              adminServiceStoreId={adminServiceStoreId}
              adminStats={adminStats}
              adminStoreName={adminStoreName}
              adminTab={adminTab}
              adminTickets={adminTickets}
              adminUserDetail={adminUserDetail}
              adminUserPointDrafts={adminUserPointDrafts}
              adminUserSearch={adminUserSearch}
              adminUsers={adminUsers}
              busyAction={busyAction}
              eventDatetime={adminEventDatetime}
              eventLocation={adminEventLocation}
              eventName={adminEventName}
              eventPoints={adminEventPoints}
              isLoading={isLoading}
              services={adminServices}
              stores={adminStores}
              onAdminNotificationBodyChange={setAdminNotificationBody}
              onAdminNotificationTitleChange={setAdminNotificationTitle}
              onAdminNotificationUserIdChange={setAdminNotificationUserId}
              onCreateEvent={() => void handleCreateAdminEvent()}
              onCreateNotification={() => void handleCreateAdminNotification()}
              onCreateService={() => void handleCreateAdminService()}
              onCreateStore={() => void handleCreateAdminStore()}
              onDeleteEvent={(id) => void handleDeleteAdminEvent(id)}
              onDeleteService={(id) => void handleDeleteAdminService(id)}
              onDeleteStore={(id) => void handleDeleteAdminStore(id)}
              onEventDatetimeChange={setAdminEventDatetime}
              onEventLocationChange={setAdminEventLocation}
              onEventNameChange={setAdminEventName}
              onEventPointsChange={setAdminEventPoints}
              onLoadUserDetail={(id) => void handleLoadAdminUserDetail(id)}
              onLogout={handleAdminLogout}
              onRefresh={() => void refreshAdmin()}
              onSearchUsers={() => void handleAdminUserSearch()}
              onServiceNameChange={setAdminServiceName}
              onServicePointsChange={setAdminServicePoints}
              onServiceStoreIdChange={setAdminServiceStoreId}
              onStoreNameChange={setAdminStoreName}
              onTabChange={setAdminTab}
              onToggleEventStatus={handleToggleAdminEventStatus}
              onToggleServiceStatus={handleToggleAdminServiceStatus}
              onToggleStoreStatus={handleToggleAdminStoreStatus}
              onUpdateTicket={(ticket, status) => void handleUpdateAdminTicket(ticket, status)}
              onUpdateUserPoints={(user) => void handleUpdateAdminUserPoints(user)}
              onUserPointDraftChange={(userId, value) =>
                setAdminUserPointDrafts((current) => ({
                  ...current,
                  [userId]: value,
                }))
              }
              onUserSearchChange={setAdminUserSearch}
            />
          ) : null}
        </div>
        {session && screen !== "login" && screen !== "admin" ? <BottomNav current={screen} onNavigate={setScreen} /> : null}
      </section>
    </main>
  );
}

function Header({
  help = false,
  notificationCount = 0,
  onNotifications,
}: {
  help?: boolean;
  notificationCount?: number;
  onNotifications?: () => void;
}) {
  return (
    <header className="app-header">
      <Logo />
      <div className="header-actions">
        <span className="draft-chip">仮</span>
        <button type="button" className="icon-button icon-button--with-count" aria-label={help ? "ヘルプ" : "通知"} onClick={onNotifications}>
          {help ? <HelpIcon /> : <MailIcon />}
          {notificationCount > 0 ? <small>{notificationCount}</small> : null}
        </button>
      </div>
    </header>
  );
}

function LoginScreen({
  adminId,
  adminPassword,
  authMode,
  busyAction,
  loginEmail,
  loginPassword,
  onAdminIdChange,
  onAdminLogin,
  onAdminPasswordChange,
  onAuthModeChange,
  onLogin,
  onLoginEmailChange,
  onLoginPasswordChange,
  onRegister,
  onRegisterAgeGroupChange,
  onRegisterEmailChange,
  onRegisterNameChange,
  onRegisterPasswordChange,
  onRegisterUserTypeChange,
  onResetEmailChange,
  onResetNewPasswordChange,
  onResetPassword,
  onResetRequest,
  onResetTokenChange,
  registerAgeGroup,
  registerEmail,
  registerName,
  registerPassword,
  registerUserType,
  resetEmail,
  resetNewPassword,
  resetToken,
}: {
  adminId: string;
  adminPassword: string;
  authMode: AuthMode;
  busyAction: string | null;
  loginEmail: string;
  loginPassword: string;
  onAdminIdChange: (value: string) => void;
  onAdminLogin: () => void;
  onAdminPasswordChange: (value: string) => void;
  onAuthModeChange: (value: AuthMode) => void;
  onLogin: () => void;
  onLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onRegister: () => void;
  onRegisterAgeGroupChange: (value: string) => void;
  onRegisterEmailChange: (value: string) => void;
  onRegisterNameChange: (value: string) => void;
  onRegisterPasswordChange: (value: string) => void;
  onRegisterUserTypeChange: (value: string) => void;
  onResetEmailChange: (value: string) => void;
  onResetNewPasswordChange: (value: string) => void;
  onResetPassword: () => void;
  onResetRequest: () => void;
  onResetTokenChange: (value: string) => void;
  registerAgeGroup: string;
  registerEmail: string;
  registerName: string;
  registerPassword: string;
  registerUserType: string;
  resetEmail: string;
  resetNewPassword: string;
  resetToken: string;
}) {
  return (
    <section className="login-screen">
      <form
        className="login-card login-card--provisional"
        onSubmit={(event) => {
          event.preventDefault();
          if (authMode === "login") {
            onLogin();
          } else if (authMode === "register") {
            onRegister();
          } else {
            onAdminLogin();
          }
        }}
      >
        <Logo small />
        <div className="panel-note">
          <strong>検証用認証UI</strong>
          <span>一般ユーザー、管理者、パスワード再発行を backend に接続しています。</span>
        </div>
        <div className="auth-toggle auth-toggle--three">
          <button className={authMode === "login" ? "auth-toggle__button auth-toggle__button--active" : "auth-toggle__button"} type="button" onClick={() => onAuthModeChange("login")}>
            ログイン
          </button>
          <button className={authMode === "register" ? "auth-toggle__button auth-toggle__button--active" : "auth-toggle__button"} type="button" onClick={() => onAuthModeChange("register")}>
            新規登録
          </button>
          <button className={authMode === "admin" ? "auth-toggle__button auth-toggle__button--active" : "auth-toggle__button"} type="button" onClick={() => onAuthModeChange("admin")}>
            管理者
          </button>
        </div>

        {authMode === "login" ? (
          <>
            <h1>ログイン</h1>
            <input aria-label="メールアドレス" placeholder="メールアドレス" value={loginEmail} onChange={(event) => onLoginEmailChange(event.target.value)} />
            <input aria-label="パスワード" type="password" placeholder="パスワード" value={loginPassword} onChange={(event) => onLoginPasswordChange(event.target.value)} />
            <div className="demo-credential">
              <span>検証用</span>
              <code>demo@example.com / password123</code>
            </div>
            <button className="primary-button primary-button--provisional" type="submit" disabled={busyAction === "login"}>
              {busyAction === "login" ? "ログイン中..." : "backend にログイン"}
            </button>
            <details className="temporary-details">
              <summary>パスワード再発行を検証する</summary>
              <input placeholder="対象メールアドレス" value={resetEmail} onChange={(event) => onResetEmailChange(event.target.value)} />
              <button className="secondary-button" type="button" onClick={onResetRequest} disabled={busyAction === "reset-request"}>
                reset token 発行
              </button>
              <input placeholder="reset token" value={resetToken} onChange={(event) => onResetTokenChange(event.target.value)} />
              <input type="password" placeholder="新パスワード" value={resetNewPassword} onChange={(event) => onResetNewPasswordChange(event.target.value)} />
              <button className="secondary-button" type="button" onClick={onResetPassword} disabled={busyAction === "reset-password"}>
                パスワード再設定
              </button>
            </details>
          </>
        ) : null}

        {authMode === "register" ? (
          <>
            <h1>新規登録</h1>
            <input aria-label="名前" placeholder="名前" value={registerName} onChange={(event) => onRegisterNameChange(event.target.value)} />
            <input aria-label="メールアドレス" placeholder="メールアドレス" value={registerEmail} onChange={(event) => onRegisterEmailChange(event.target.value)} />
            <input aria-label="パスワード" type="password" placeholder="パスワード 8文字以上" value={registerPassword} onChange={(event) => onRegisterPasswordChange(event.target.value)} />
            <input aria-label="年代" placeholder="年代 例: 30s" value={registerAgeGroup} onChange={(event) => onRegisterAgeGroupChange(event.target.value)} />
            <select aria-label="ユーザー区分" value={registerUserType} onChange={(event) => onRegisterUserTypeChange(event.target.value)}>
              <option value="general">general</option>
              <option value="resident">resident</option>
              <option value="volunteer">volunteer</option>
            </select>
            <button className="primary-button primary-button--provisional" type="submit" disabled={busyAction === "register"}>
              {busyAction === "register" ? "登録中..." : "backend にユーザー登録"}
            </button>
          </>
        ) : null}

        {authMode === "admin" ? (
          <>
            <h1>管理者ログイン</h1>
            <input aria-label="管理者ID" placeholder="管理者ID" value={adminId} onChange={(event) => onAdminIdChange(event.target.value)} />
            <input aria-label="管理者パスワード" type="password" placeholder="管理者パスワード" value={adminPassword} onChange={(event) => onAdminPasswordChange(event.target.value)} />
            <div className="demo-credential">
              <span>検証用</span>
              <code>admin / admin123</code>
            </div>
            <button className="primary-button primary-button--provisional" type="submit" disabled={busyAction === "admin-login"}>
              {busyAction === "admin-login" ? "ログイン中..." : "管理者 API にログイン"}
            </button>
          </>
        ) : null}
      </form>
    </section>
  );
}

function HomeScreen({
  eventCount,
  exchangeCount,
  isLoading,
  likedCount,
  notificationCount,
  onNavigate,
  onRefresh,
  participatedCount,
  points,
  profile,
  recentTransactions,
}: {
  eventCount: number;
  exchangeCount: number;
  isLoading: boolean;
  likedCount: number;
  notificationCount: number;
  onNavigate: (screen: Screen) => void;
  onRefresh: () => void;
  participatedCount: number;
  points: number;
  profile: UserProfile | null;
  recentTransactions: Transaction[];
}) {
  return (
    <section>
      <Header notificationCount={notificationCount} onNotifications={() => onNavigate("notifications")} />
      <section className="section section--tight">
        <div className="status-panel">
          <div>
            <strong>backend 連携状況</strong>
            <p>追加 API を含む主要データを DB から取得しています。</p>
          </div>
          <button className="secondary-button" type="button" onClick={onRefresh}>
            再取得
          </button>
        </div>
      </section>

      <article className="points-card points-card--home points-card--provisional">
        <div className="points-card__row">
          <span>ポイント残高</span>
          <strong>
            {points}
            <small>pt</small>
          </strong>
          <ArrowIcon />
        </div>
        <div className="points-card__actions points-card__actions--wrap">
          <button type="button" onClick={() => onNavigate("events")}>
            イベント
          </button>
          <button type="button" onClick={() => onNavigate("scan")}>
            QR
          </button>
          <button type="button" onClick={() => onNavigate("wallet")}>
            交換
          </button>
          <button type="button" onClick={() => onNavigate("purchase")}>
            購入
          </button>
          <button type="button" onClick={() => onNavigate("support")}>
            問合せ
          </button>
          <button type="button" onClick={() => onNavigate("account")}>
            設定
          </button>
        </div>
      </article>

      <section className="section">
        <div className="summary-grid">
          <SummaryCard label="参加済み" value={`${participatedCount}件`} />
          <SummaryCard label="交換済み" value={`${exchangeCount}件`} />
          <SummaryCard label="いいね" value={`${likedCount}件`} />
          <SummaryCard label="公開イベント" value={`${eventCount}件`} />
          <SummaryCard label="未読通知" value={`${notificationCount}件`} />
          <SummaryCard label="読込" value={isLoading ? "中" : "完了"} />
        </div>
      </section>

      <section className="section">
        <SectionHeading>直近の取引ログ</SectionHeading>
        <div className="activity-list">
          {recentTransactions.length > 0 ? recentTransactions.map((item) => <ActivityItem key={item.transaction_id} text={mapTransactionToText(item)} />) : <EmptyState text="まだポイント取引がありません。" />}
        </div>
      </section>

      <section className="section section--last">
        <div className="profile-box">
          <strong>現在のユーザー</strong>
          <p>{profile ? `${profile.name} / ${formatUserType(profile.user_type)} / ${profile.email}` : "未取得"}</p>
        </div>
      </section>
    </section>
  );
}

function EventsScreen({
  busyAction,
  events,
  isLoading,
  onLike,
  onParticipate,
  participatedEventIds,
  tab,
  onTabChange,
}: {
  busyAction: string | null;
  events: EventItem[];
  isLoading: boolean;
  onLike: (event: EventItem) => void;
  onParticipate: (eventId: number) => void;
  participatedEventIds: Set<number>;
  tab: EventTab;
  onTabChange: (tab: EventTab) => void;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>イベント検証UI</strong>
          <span>参加、いいね、参加履歴を backend に接続しています。</span>
        </div>
      </section>
      <Tabs
        value={tab}
        items={[
          ["all", "イベント一覧"],
          ["liked", "いいね"],
          ["history", "参加履歴"],
        ]}
        onChange={onTabChange}
      />
      <AdFrame />
      <div className="event-list">
        {events.length > 0 ? (
          events.map((event) => {
            const participated = participatedEventIds.has(event.event_id);
            return (
              <EventCard
                key={`${tab}-${event.event_id}`}
                busyAction={busyAction}
                event={event}
                isHistory={tab === "history"}
                onLike={onLike}
                onParticipate={onParticipate}
                participated={participated}
              />
            );
          })
        ) : (
          <EmptyState text="表示できるイベントがありません。" />
        )}
        {isLoading ? <p className="status-text">イベントを読み込んでいます。</p> : null}
      </div>
    </section>
  );
}

function EventCard({
  busyAction,
  event,
  isHistory,
  onLike,
  onParticipate,
  participated,
}: {
  busyAction: string | null;
  event: EventItem;
  isHistory?: boolean;
  onLike: (event: EventItem) => void;
  onParticipate: (eventId: number) => void;
  participated: boolean;
}) {
  const parts = formatDateTimeParts(event.event_datetime);
  const likeBusy = busyAction === `like-${event.event_id}`;
  const participateBusy = busyAction === `event-${event.event_id}`;

  return (
    <article className="event-card event-card--interactive">
      <p className="event-card__date">{parts.date}</p>
      <div className="event-card__image" />
      <div>
        <h3>{event.event_name}</h3>
        <strong>{event.grant_points}pt</strong>
        <p>集合場所: {event.location ?? "未設定"} / 時間: {parts.time}</p>
        <small className="card-helper">いいね数: {event.like_count ?? 0} / 状態: {participated ? "参加済み" : "未参加"}</small>
        {!isHistory ? (
          <div className="card-actions-inline">
            <button className="card-action" type="button" onClick={() => onLike(event)} disabled={likeBusy}>
              {likeBusy ? "処理中..." : boolFlag(event.liked) ? "いいね解除" : "いいね"}
            </button>
            <button className="card-action" type="button" onClick={() => onParticipate(event.event_id)} disabled={participated || participateBusy}>
              {participateBusy ? "処理中..." : participated ? "参加済み" : "参加登録"}
            </button>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function ScanScreen({
  busyAction,
  checkInCode,
  onCheckIn,
  onCheckInCodeChange,
  onHome,
}: {
  busyAction: string | null;
  checkInCode: string;
  onCheckIn: () => void;
  onCheckInCodeChange: (value: string) => void;
  onHome: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [cameraStatus, setCameraStatus] = useState("手入力 fallback が有効です。");

  function stopCamera() {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("このブラウザではカメラ起動に対応していません。手入力で検証してください。");
      return;
    }

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      if (!window.BarcodeDetector) {
        setCameraStatus("カメラは起動しましたが BarcodeDetector 非対応です。読み取った値は手入力してください。");
        return;
      }

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      setCameraStatus("QR を検出中です。検出できない場合は手入力してください。");

      const scanFrame = async () => {
        if (!videoRef.current || !streamRef.current) {
          return;
        }

        try {
          const results = await detector.detect(videoRef.current);
          const rawValue = results[0]?.rawValue;
          if (rawValue) {
            onCheckInCodeChange(rawValue);
            setCameraStatus(`QR を読み取りました: ${rawValue}`);
            stopCamera();
            return;
          }
        } catch {
          setCameraStatus("QR 検出でエラーが出ました。手入力 fallback を使ってください。");
        }

        frameRef.current = window.requestAnimationFrame(scanFrame);
      };

      frameRef.current = window.requestAnimationFrame(scanFrame);
    } catch (error) {
      setCameraStatus(getErrorMessage(error));
    }
  }

  useEffect(() => stopCamera, []);

  return (
    <section className="scan-screen">
      <div className="scan-screen__center">
        <span className="scan-check scan-check--provisional">
          <CheckIcon />
        </span>
        <h1>QR チェックイン仮実装</h1>
        <p className="scan-note">対応ブラウザではカメラで QR を読み取り、非対応時は管理者画面の check-in code を手入力して DB 更新を検証します。</p>
        <video ref={videoRef} className="scan-video" muted playsInline aria-label="QR読み取りカメラプレビュー" />
        <small className="scan-note">{cameraStatus}</small>
        <input className="wide-input" placeholder="例: EVENT-1" value={checkInCode} onChange={(event) => onCheckInCodeChange(event.target.value)} />
      </div>
      <button className="secondary-button scan-screen__button" type="button" onClick={() => void startCamera()}>
        カメラを起動
      </button>
      <button className="secondary-button scan-screen__button" type="button" onClick={stopCamera}>
        カメラ停止
      </button>
      <button className="primary-button primary-button--provisional scan-screen__button" type="button" onClick={onCheckIn} disabled={busyAction === "check-in"}>
        {busyAction === "check-in" ? "送信中..." : "check-in code を送信"}
      </button>
      <button className="secondary-button scan-screen__button" type="button" onClick={onHome}>
        ホームに戻る
      </button>
    </section>
  );
}

function WalletScreen({
  busyAction,
  currentPoints,
  exchangeHistory,
  groups,
  isLoading,
  onExchange,
  onFavorite,
  onPurchase,
  tab,
  onTabChange,
}: {
  busyAction: string | null;
  currentPoints: number;
  exchangeHistory: Transaction[];
  groups: ServiceGroup[];
  isLoading: boolean;
  onExchange: (service: ServiceItem) => void;
  onFavorite: (service: ServiceItem) => void;
  onPurchase: () => void;
  tab: ExchangeTab;
  onTabChange: (tab: ExchangeTab) => void;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>交換検証UI</strong>
          <span>交換、お気に入り、交換履歴を backend に接続しています。</span>
        </div>
        <article className="points-card points-card--wallet points-card--provisional">
          <span>現在の利用可能ポイント</span>
          <strong>{currentPoints}pt</strong>
          <button type="button" onClick={onPurchase}>
            ポイント購入へ
          </button>
        </article>
      </section>
      <section className="section">
        <h2 className="screen-title">ポイント交換</h2>
        <Tabs
          value={tab}
          items={[
            ["services", "交換候補"],
            ["favorites", "お気に入り"],
            ["history", "交換履歴"],
          ]}
          onChange={onTabChange}
        />
        {tab === "history" ? (
          <div className="activity-list">
            {exchangeHistory.length > 0 ? exchangeHistory.map((item) => <ActivityItem key={item.transaction_id} text={mapTransactionToText(item)} />) : <EmptyState text="交換履歴はまだありません。" />}
          </div>
        ) : (
          <div className="product-stack">
            {groups.length > 0 ? (
              groups.map((group) => (
                <section key={group.id}>
                  <SectionHeading>{group.name}</SectionHeading>
                  <div className="product-rail">
                    {group.services.map((service) => (
                      <ProductCard
                        key={service.service_id}
                        currentPoints={currentPoints}
                        isBusy={busyAction === `service-${service.service_id}` || busyAction === `favorite-${service.service_id}`}
                        service={service}
                        onExchange={onExchange}
                        onFavorite={onFavorite}
                      />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <EmptyState text="交換対象サービスがありません。" />
            )}
            {isLoading ? <p className="status-text">交換対象を読み込んでいます。</p> : null}
          </div>
        )}
      </section>
    </section>
  );
}

function ProductCard({
  currentPoints,
  isBusy,
  service,
  onExchange,
  onFavorite,
}: {
  currentPoints: number;
  isBusy: boolean;
  service: ServiceItem;
  onExchange: (service: ServiceItem) => void;
  onFavorite: (service: ServiceItem) => void;
}) {
  const insufficient = currentPoints < service.required_points;

  return (
    <article className="product-card product-card--interactive">
      <div />
      <span>{service.service_name}</span>
      <strong>{service.required_points}pt</strong>
      <button className="card-action" type="button" onClick={() => onFavorite(service)} disabled={isBusy}>
        {boolFlag(service.favorited) ? "お気に入り解除" : "お気に入り"}
      </button>
      <button className="card-action" type="button" onClick={() => onExchange(service)} disabled={isBusy || insufficient}>
        {insufficient ? "ポイント不足" : isBusy ? "処理中..." : "交換する"}
      </button>
    </article>
  );
}

function PurchaseScreen({
  busyAction,
  paymentBrand,
  paymentLabel,
  paymentLast4,
  paymentMethodId,
  paymentMethods,
  points,
  purchasePointAmount,
  purchaseStatus,
  purchases,
  onAddPaymentMethod,
  onDeletePaymentMethod,
  onPaymentBrandChange,
  onPaymentLabelChange,
  onPaymentLast4Change,
  onPaymentMethodIdChange,
  onPurchase,
  onPurchasePointAmountChange,
  onPurchaseStatusChange,
}: {
  busyAction: string | null;
  paymentBrand: string;
  paymentLabel: string;
  paymentLast4: string;
  paymentMethodId: string;
  paymentMethods: PaymentMethod[];
  points: number;
  purchasePointAmount: string;
  purchaseStatus: Purchase["status"];
  purchases: Purchase[];
  onAddPaymentMethod: () => void;
  onDeletePaymentMethod: (id: number) => void;
  onPaymentBrandChange: (value: string) => void;
  onPaymentLabelChange: (value: string) => void;
  onPaymentLast4Change: (value: string) => void;
  onPaymentMethodIdChange: (value: string) => void;
  onPurchase: () => void;
  onPurchasePointAmountChange: (value: string) => void;
  onPurchaseStatusChange: (value: Purchase["status"]) => void;
}) {
  return (
    <section>
      <Header help />
      <section className="section section--tight">
        <article className="placeholder-panel">
          <span className="placeholder-panel__badge">TEMP PAYMENT</span>
          <h1>ポイント購入 mock</h1>
          <p>本番決済ではなく、DB 更新確認用の mock 購入です。`paid` の場合だけ残高が増えます。</p>
          <dl>
            <div>
              <dt>現在ポイント</dt>
              <dd>{points} pt</dd>
            </div>
          </dl>
        </article>
      </section>
      <section className="section form-stack">
        <SectionHeading>購入実行</SectionHeading>
        <input value={purchasePointAmount} onChange={(event) => onPurchasePointAmountChange(event.target.value)} placeholder="購入ポイント" />
        <select value={paymentMethodId} onChange={(event) => onPaymentMethodIdChange(event.target.value)}>
          <option value="">支払方法なし</option>
          {paymentMethods.map((method) => (
            <option key={method.payment_method_id} value={method.payment_method_id}>
              {method.label} / {method.brand} ****{method.last4}
            </option>
          ))}
        </select>
        <select value={purchaseStatus} onChange={(event) => onPurchaseStatusChange(event.target.value as Purchase["status"])}>
          <option value="paid">paid</option>
          <option value="pending">pending</option>
          <option value="failed">failed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <button className="primary-button primary-button--provisional" type="button" onClick={onPurchase} disabled={busyAction === "purchase"}>
          {busyAction === "purchase" ? "購入中..." : "mock 購入する"}
        </button>
      </section>
      <section className="section form-stack">
        <SectionHeading>支払方法</SectionHeading>
        <input value={paymentLabel} onChange={(event) => onPaymentLabelChange(event.target.value)} placeholder="支払方法名" />
        <input value={paymentBrand} onChange={(event) => onPaymentBrandChange(event.target.value)} placeholder="brand" />
        <input value={paymentLast4} onChange={(event) => onPaymentLast4Change(event.target.value)} placeholder="last4" />
        <button className="secondary-button" type="button" onClick={onAddPaymentMethod} disabled={busyAction === "payment-add"}>
          支払方法を追加
        </button>
        {paymentMethods.map((method) => (
          <div key={method.payment_method_id} className="settings-row settings-row--static">
            <span>{method.label}</span>
            <strong>
              {method.brand} ****{method.last4}
            </strong>
            <button type="button" onClick={() => onDeletePaymentMethod(method.payment_method_id)} disabled={busyAction === `payment-delete-${method.payment_method_id}`}>
              削除
            </button>
          </div>
        ))}
      </section>
      <section className="section section--last">
        <SectionHeading>購入履歴</SectionHeading>
        <div className="activity-list">
          {purchases.length > 0 ? purchases.map((purchase) => <ActivityItem key={purchase.purchase_id} text={`${purchase.status}: ${purchase.points}pt / ${formatDateTime(purchase.created_at)}`} />) : <EmptyState text="購入履歴はまだありません。" />}
        </div>
      </section>
    </section>
  );
}

function NotificationsScreen({
  busyAction,
  notifications,
  onMarkRead,
}: {
  busyAction: string | null;
  notifications: NotificationItem[];
  onMarkRead: (id: number) => void;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>通知検証UI</strong>
          <span>管理者配信と既読化を backend に接続しています。</span>
        </div>
      </section>
      <section className="section section--last">
        <div className="activity-list">
          {notifications.length > 0 ? (
            notifications.map((item) => (
              <article key={item.notification_id} className={`activity-item ${item.read_at ? "" : "activity-item--warning"}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                  <small>{formatDateTime(item.created_at)}</small>
                </div>
                <button className="secondary-button" type="button" onClick={() => onMarkRead(item.notification_id)} disabled={Boolean(item.read_at) || busyAction === `notification-${item.notification_id}`}>
                  {item.read_at ? "既読" : "既読にする"}
                </button>
              </article>
            ))
          ) : (
            <EmptyState text="通知はありません。" />
          )}
        </div>
      </section>
    </section>
  );
}

function SupportScreen({
  busyAction,
  category,
  body,
  subject,
  tickets,
  onBodyChange,
  onCategoryChange,
  onCreate,
  onSubjectChange,
}: {
  busyAction: string | null;
  category: "support" | "bug";
  body: string;
  subject: string;
  tickets: SupportTicket[];
  onBodyChange: (value: string) => void;
  onCategoryChange: (value: "support" | "bug") => void;
  onCreate: () => void;
  onSubjectChange: (value: string) => void;
}) {
  return (
    <section>
      <Header help />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>問い合わせ検証UI</strong>
          <span>問い合わせと不具合報告を support_tickets に保存します。</span>
        </div>
      </section>
      <section className="section form-stack">
        <select value={category} onChange={(event) => onCategoryChange(event.target.value as "support" | "bug")}>
          <option value="support">問い合わせ</option>
          <option value="bug">不具合報告</option>
        </select>
        <input value={subject} onChange={(event) => onSubjectChange(event.target.value)} placeholder="件名" />
        <textarea value={body} onChange={(event) => onBodyChange(event.target.value)} placeholder="本文または再現手順" />
        <button className="primary-button primary-button--provisional" type="button" onClick={onCreate} disabled={busyAction === "support-create"}>
          送信
        </button>
      </section>
      <section className="section section--last">
        <SectionHeading>送信履歴</SectionHeading>
        <div className="activity-list">
          {tickets.length > 0 ? tickets.map((ticket) => <ActivityItem key={ticket.ticket_id} text={`${ticket.status}: ${ticket.subject} / ${formatDateTime(ticket.created_at)}`} />) : <EmptyState text="問い合わせ履歴はまだありません。" />}
        </div>
      </section>
    </section>
  );
}

function AccountScreen({
  busyAction,
  currentPassword,
  emailDraft,
  newPassword,
  onChangePassword,
  onCurrentPasswordChange,
  onDeleteAccount,
  onEmailDraftChange,
  onLogout,
  onNewPasswordChange,
  onUpdateEmail,
  onUpdateSettings,
  profile,
  session,
  settings,
}: {
  busyAction: string | null;
  currentPassword: string;
  emailDraft: string;
  newPassword: string;
  onChangePassword: () => void;
  onCurrentPasswordChange: (value: string) => void;
  onDeleteAccount: () => void;
  onEmailDraftChange: (value: string) => void;
  onLogout: () => void;
  onNewPasswordChange: (value: string) => void;
  onUpdateEmail: () => void;
  onUpdateSettings: (settings: Partial<UserSettings>) => void;
  profile: UserProfile | null;
  session: Session | null;
  settings: UserSettings | null;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>アカウント検証UI</strong>
          <span>メール、パスワード、設定、アカウント削除を backend に接続しています。</span>
        </div>
      </section>
      <div className="settings-list">
        <section className="settings-section">
          <h2>backend 取得情報</h2>
          <StaticRow label="ユーザーID" value={profile ? String(profile.user_id) : "未取得"} />
          <StaticRow label="名前" value={profile?.name ?? "未取得"} />
          <StaticRow label="メール" value={profile?.email ?? "未取得"} />
          <StaticRow label="年代" value={profile?.age_group ?? "未設定"} />
          <StaticRow label="ロール" value={session?.user.role ?? "未取得"} />
        </section>
        <section className="settings-section settings-section--form">
          <h2>メール変更</h2>
          <input value={emailDraft} onChange={(event) => onEmailDraftChange(event.target.value)} />
          <button className="settings-row settings-row--action" type="button" onClick={onUpdateEmail} disabled={busyAction === "email-update"}>
            <span>メールを更新</span>
          </button>
        </section>
        <section className="settings-section settings-section--form">
          <h2>パスワード変更</h2>
          <input type="password" placeholder="現在パスワード" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} />
          <input type="password" placeholder="新パスワード 8文字以上" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} />
          <button className="settings-row settings-row--action" type="button" onClick={onChangePassword} disabled={busyAction === "password-change"}>
            <span>パスワードを更新</span>
          </button>
        </section>
        <section className="settings-section settings-section--form">
          <h2>ユーザー設定</h2>
          <select value={settings?.notification_enabled ? "1" : "0"} onChange={(event) => onUpdateSettings({ notification_enabled: event.target.value === "1" })}>
            <option value="1">通知ON</option>
            <option value="0">通知OFF</option>
          </select>
          <select value={settings?.language ?? "ja"} onChange={(event) => onUpdateSettings({ language: event.target.value })}>
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
          <select value={settings?.font_size ?? "medium"} onChange={(event) => onUpdateSettings({ font_size: event.target.value as UserSettings["font_size"] })}>
            <option value="small">文字小</option>
            <option value="medium">文字中</option>
            <option value="large">文字大</option>
          </select>
        </section>
        <section className="settings-section">
          <h2>セッション</h2>
          <button className="settings-row settings-row--action" type="button" onClick={onLogout}>
            <span>ログアウト</span>
          </button>
          <button className="settings-row settings-row--danger" type="button" onClick={onDeleteAccount} disabled={busyAction === "account-delete"}>
            <span>アカウント削除</span>
          </button>
        </section>
      </div>
    </section>
  );
}

function AdminScreen({
  adminEvents,
  adminId,
  adminNotificationBody,
  adminNotificationTitle,
  adminNotificationUserId,
  adminServiceName,
  adminServicePoints,
  adminServiceStoreId,
  adminStats,
  adminStoreName,
  adminTab,
  adminTickets,
  adminUserDetail,
  adminUserPointDrafts,
  adminUserSearch,
  adminUsers,
  busyAction,
  eventDatetime,
  eventLocation,
  eventName,
  eventPoints,
  isLoading,
  services,
  stores,
  onAdminNotificationBodyChange,
  onAdminNotificationTitleChange,
  onAdminNotificationUserIdChange,
  onCreateEvent,
  onCreateNotification,
  onCreateService,
  onCreateStore,
  onDeleteEvent,
  onDeleteService,
  onDeleteStore,
  onEventDatetimeChange,
  onEventLocationChange,
  onEventNameChange,
  onEventPointsChange,
  onLoadUserDetail,
  onLogout,
  onRefresh,
  onSearchUsers,
  onServiceNameChange,
  onServicePointsChange,
  onServiceStoreIdChange,
  onStoreNameChange,
  onTabChange,
  onToggleEventStatus,
  onToggleServiceStatus,
  onToggleStoreStatus,
  onUpdateTicket,
  onUpdateUserPoints,
  onUserPointDraftChange,
  onUserSearchChange,
}: {
  adminEvents: EventItem[];
  adminId: string;
  adminNotificationBody: string;
  adminNotificationTitle: string;
  adminNotificationUserId: string;
  adminServiceName: string;
  adminServicePoints: string;
  adminServiceStoreId: string;
  adminStats: AdminStats | null;
  adminStoreName: string;
  adminTab: AdminTab;
  adminTickets: SupportTicket[];
  adminUserDetail: AdminUserDetail | null;
  adminUserPointDrafts: Record<number, string>;
  adminUserSearch: string;
  adminUsers: ManagedUser[];
  busyAction: string | null;
  eventDatetime: string;
  eventLocation: string;
  eventName: string;
  eventPoints: string;
  isLoading: boolean;
  services: ServiceItem[];
  stores: StoreItem[];
  onAdminNotificationBodyChange: (value: string) => void;
  onAdminNotificationTitleChange: (value: string) => void;
  onAdminNotificationUserIdChange: (value: string) => void;
  onCreateEvent: () => void;
  onCreateNotification: () => void;
  onCreateService: () => void;
  onCreateStore: () => void;
  onDeleteEvent: (id: number) => void;
  onDeleteService: (id: number) => void;
  onDeleteStore: (id: number) => void;
  onEventDatetimeChange: (value: string) => void;
  onEventLocationChange: (value: string) => void;
  onEventNameChange: (value: string) => void;
  onEventPointsChange: (value: string) => void;
  onLoadUserDetail: (id: number) => void;
  onLogout: () => void;
  onRefresh: () => void;
  onSearchUsers: () => void;
  onServiceNameChange: (value: string) => void;
  onServicePointsChange: (value: string) => void;
  onServiceStoreIdChange: (value: string) => void;
  onStoreNameChange: (value: string) => void;
  onTabChange: (tab: AdminTab) => void;
  onToggleEventStatus: (event: EventItem) => void;
  onToggleServiceStatus: (service: ServiceItem) => void;
  onToggleStoreStatus: (store: StoreItem) => void;
  onUpdateTicket: (ticket: SupportTicket, status: SupportTicket["status"]) => void;
  onUpdateUserPoints: (user: ManagedUser) => void;
  onUserPointDraftChange: (userId: number, value: string) => void;
  onUserSearchChange: (value: string) => void;
}) {
  return (
    <section>
      <header className="admin-header">
        <Logo />
        <div>
          <small>ADMIN TEMP</small>
          <strong>{adminId}</strong>
        </div>
        <button className="secondary-button" type="button" onClick={onLogout}>
          ログアウト
        </button>
      </header>
      <section className="section section--tight">
        <div className="status-panel">
          <div>
            <strong>管理者 API 操作盤</strong>
            <p>正式管理画面ではなく、backend 機能検証用の仮実装です。</p>
          </div>
          <button className="secondary-button" type="button" onClick={onRefresh}>
            再取得
          </button>
        </div>
      </section>
      <Tabs
        value={adminTab}
        items={[
          ["dashboard", "集計"],
          ["events", "イベント"],
          ["stores", "店舗"],
          ["services", "サービス"],
          ["users", "ユーザー"],
          ["support", "問合せ"],
        ]}
        onChange={onTabChange}
      />
      {adminTab === "dashboard" ? (
        <section className="section">
          <div className="summary-grid">
            <SummaryCard label="ユーザー" value={`${adminStats?.total_users ?? 0}`} />
            <SummaryCard label="公開イベント" value={`${adminStats?.active_events ?? 0}`} />
            <SummaryCard label="未解決Ticket" value={`${adminStats?.open_tickets ?? 0}`} />
            <SummaryCard label="参加" value={`${adminStats?.total_participations ?? 0}`} />
            <SummaryCard label="付与pt" value={`${adminStats?.total_granted_points ?? 0}`} />
            <SummaryCard label="購入pt" value={`${adminStats?.total_purchased_points ?? 0}`} />
          </div>
          <SectionHeading>イベント別参加</SectionHeading>
          <div className="activity-list">
            {adminStats?.event_participants.map((row) => (
              <ActivityItem key={row.event_id} text={`${row.event_name}: ${row.participation_count}件 / ${row.granted_points}pt`} />
            ))}
          </div>
          <SectionHeading>サービス別交換</SectionHeading>
          <div className="activity-list">
            {adminStats?.service_exchanges.map((row) => (
              <ActivityItem key={row.service_id} text={`${row.service_name}: ${row.exchange_count}件 / ${row.exchanged_points}pt`} />
            ))}
          </div>
        </section>
      ) : null}
      {adminTab === "events" ? (
        <section className="section form-stack">
          <SectionHeading>イベント作成</SectionHeading>
          <input value={eventName} onChange={(event) => onEventNameChange(event.target.value)} placeholder="イベント名" />
          <input value={eventDatetime} onChange={(event) => onEventDatetimeChange(event.target.value)} placeholder="YYYY-MM-DD HH:mm:ss" />
          <input value={eventLocation} onChange={(event) => onEventLocationChange(event.target.value)} placeholder="場所" />
          <input value={eventPoints} onChange={(event) => onEventPointsChange(event.target.value)} placeholder="付与ポイント" />
          <button className="primary-button primary-button--provisional" type="button" onClick={onCreateEvent} disabled={busyAction === "admin-event-create"}>
            イベント作成
          </button>
          <SectionHeading>イベント一覧</SectionHeading>
          {adminEvents.map((event) => (
            <AdminRow key={event.event_id} title={event.event_name} meta={`${event.status ?? "active"} / ${event.check_in_code ?? "QR未発行"} / ${formatDateTime(event.event_datetime)}`}>
              <button type="button" onClick={() => onToggleEventStatus(event)} disabled={busyAction === `admin-event-${event.event_id}`}>
                {event.status === "paused" ? "公開" : "停止"}
              </button>
              <button type="button" onClick={() => onDeleteEvent(event.event_id)} disabled={busyAction === `admin-event-delete-${event.event_id}`}>
                削除
              </button>
            </AdminRow>
          ))}
        </section>
      ) : null}
      {adminTab === "stores" ? (
        <section className="section form-stack">
          <SectionHeading>店舗作成</SectionHeading>
          <input value={adminStoreName} onChange={(event) => onStoreNameChange(event.target.value)} placeholder="店舗名" />
          <button className="primary-button primary-button--provisional" type="button" onClick={onCreateStore} disabled={busyAction === "admin-store-create"}>
            店舗作成
          </button>
          <SectionHeading>店舗一覧</SectionHeading>
          {stores.map((store) => (
            <AdminRow key={store.store_id} title={store.store_name} meta={store.status}>
              <button type="button" onClick={() => onToggleStoreStatus(store)} disabled={busyAction === `admin-store-${store.store_id}`}>
                {store.status === "paused" ? "公開" : "停止"}
              </button>
              <button type="button" onClick={() => onDeleteStore(store.store_id)} disabled={busyAction === `admin-store-delete-${store.store_id}`}>
                削除
              </button>
            </AdminRow>
          ))}
        </section>
      ) : null}
      {adminTab === "services" ? (
        <section className="section form-stack">
          <SectionHeading>サービス作成</SectionHeading>
          <select value={adminServiceStoreId} onChange={(event) => onServiceStoreIdChange(event.target.value)}>
            {stores.map((store) => (
              <option key={store.store_id} value={store.store_id}>
                {store.store_name}
              </option>
            ))}
          </select>
          <input value={adminServiceName} onChange={(event) => onServiceNameChange(event.target.value)} placeholder="サービス名" />
          <input value={adminServicePoints} onChange={(event) => onServicePointsChange(event.target.value)} placeholder="必要ポイント" />
          <button className="primary-button primary-button--provisional" type="button" onClick={onCreateService} disabled={busyAction === "admin-service-create"}>
            サービス作成
          </button>
          <SectionHeading>サービス一覧</SectionHeading>
          {services.map((service) => (
            <AdminRow key={service.service_id} title={service.service_name} meta={`${service.store_name} / ${service.required_points}pt / ${service.status ?? "active"}`}>
              <button type="button" onClick={() => onToggleServiceStatus(service)} disabled={busyAction === `admin-service-${service.service_id}`}>
                {service.status === "paused" ? "公開" : "停止"}
              </button>
              <button type="button" onClick={() => onDeleteService(service.service_id)} disabled={busyAction === `admin-service-delete-${service.service_id}`}>
                削除
              </button>
            </AdminRow>
          ))}
        </section>
      ) : null}
      {adminTab === "users" ? (
        <section className="section form-stack">
          <SectionHeading>ユーザー検索</SectionHeading>
          <input value={adminUserSearch} onChange={(event) => onUserSearchChange(event.target.value)} placeholder="name or email" />
          <button className="secondary-button" type="button" onClick={onSearchUsers} disabled={busyAction === "admin-user-search"}>
            検索
          </button>
          {adminUsers.map((user) => (
            <AdminRow key={user.user_id} title={`${user.name} / ${user.email}`} meta={`${user.points}pt / ${formatUserType(user.user_type)}`}>
              <input className="inline-number" value={adminUserPointDrafts[user.user_id] ?? String(user.points)} onChange={(event) => onUserPointDraftChange(user.user_id, event.target.value)} />
              <button type="button" onClick={() => onUpdateUserPoints(user)} disabled={busyAction === `admin-user-update-${user.user_id}`}>
                pt更新
              </button>
              <button type="button" onClick={() => onLoadUserDetail(user.user_id)} disabled={busyAction === `admin-user-detail-${user.user_id}`}>
                詳細
              </button>
            </AdminRow>
          ))}
          {adminUserDetail ? (
            <div className="profile-box">
              <strong>{adminUserDetail.user.email}</strong>
              <p>参加 {adminUserDetail.participations.length}件 / 取引 {adminUserDetail.transactions.length}件 / 購入 {adminUserDetail.purchases.length}件</p>
            </div>
          ) : null}
        </section>
      ) : null}
      {adminTab === "support" ? (
        <section className="section form-stack section--last">
          <SectionHeading>通知配信</SectionHeading>
          <input value={adminNotificationUserId} onChange={(event) => onAdminNotificationUserIdChange(event.target.value)} placeholder="user_id 空なら全員" />
          <input value={adminNotificationTitle} onChange={(event) => onAdminNotificationTitleChange(event.target.value)} placeholder="通知タイトル" />
          <textarea value={adminNotificationBody} onChange={(event) => onAdminNotificationBodyChange(event.target.value)} placeholder="通知本文" />
          <button className="primary-button primary-button--provisional" type="button" onClick={onCreateNotification} disabled={busyAction === "admin-notification-create"}>
            通知配信
          </button>
          <SectionHeading>問い合わせ一覧</SectionHeading>
          {adminTickets.length > 0 ? (
            adminTickets.map((ticket) => (
              <AdminRow key={ticket.ticket_id} title={`${ticket.subject} / ${ticket.user_email ?? "deleted"}`} meta={`${ticket.category} / ${ticket.status} / ${formatDateTime(ticket.created_at)}`}>
                <button type="button" onClick={() => onUpdateTicket(ticket, "in_progress")} disabled={busyAction === `admin-ticket-${ticket.ticket_id}`}>
                  対応中
                </button>
                <button type="button" onClick={() => onUpdateTicket(ticket, "resolved")} disabled={busyAction === `admin-ticket-${ticket.ticket_id}`}>
                  解決
                </button>
              </AdminRow>
            ))
          ) : (
            <EmptyState text="問い合わせはありません。" />
          )}
        </section>
      ) : null}
      {isLoading ? <p className="status-text">管理者データを読み込んでいます。</p> : null}
    </section>
  );
}

function AdminRow({ title, meta, children }: { title: string; meta: string; children: React.ReactNode }) {
  return (
    <article className="admin-row">
      <div>
        <strong>{title}</strong>
        <small>{meta}</small>
      </div>
      <div className="admin-row__actions">{children}</div>
    </article>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="summary-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function ActivityItem({ text }: { text: string }) {
  return (
    <article className="activity-item">
      <div>
        <strong>{text}</strong>
      </div>
    </article>
  );
}

function StaticRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row settings-row--static">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function NoticeBar({ notice, onClose }: { notice: NonNullable<NoticeState>; onClose: () => void }) {
  return (
    <aside className={`notice-bar notice-bar--${notice.kind}`}>
      <div>
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
      </div>
      <button type="button" className="notice-bar__close" onClick={onClose}>
        閉じる
      </button>
    </aside>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{children}</h2>
      <ArrowIcon />
    </div>
  );
}

function Tabs<T extends string>({
  value,
  items,
  onChange,
}: {
  value: T;
  items: Array<[T, string]>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tabs">
      {items.map(([itemValue, label]) => (
        <button
          key={itemValue}
          className={itemValue === value ? "tabs__item tabs__item--active" : "tabs__item"}
          type="button"
          onClick={() => onChange(itemValue)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AdFrame() {
  return <div className="ad-frame">仮UI プレースホルダー</div>;
}

function BottomNav({ current, onNavigate }: { current: Screen; onNavigate: (screen: Screen) => void }) {
  const items = [
    ["home", "ホーム", <HomeIcon />],
    ["events", "イベント", <EventIcon />],
    ["scan", "QR仮", <QrIcon />],
    ["wallet", "交換", <WalletIcon />],
    ["account", "アカウント", <AccountIcon />],
  ] as const;

  return (
    <nav className="bottom-nav" aria-label="アプリメニュー">
      {items.map(([target, label, icon]) => (
        <button
          key={target}
          className={`bottom-nav__item ${current === target ? "bottom-nav__item--active" : ""} ${
            target === "scan" ? "bottom-nav__item--scan" : ""
          }`}
          type="button"
          onClick={() => onNavigate(target)}
        >
          <span>{icon}</span>
          <small>{label}</small>
        </button>
      ))}
    </nav>
  );
}
