import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent,
} from "react";
import QRCode from "qrcode";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ApiError,
  addPaymentMethod,
  cancelEventParticipation,
  changePassword,
  createSupportTicket,
  deletePaymentMethod,
  deleteUser,
  exchangePoints,
  getEvents,
  getLikedEvents,
  getMySupportTickets,
  getNotifications,
  getPaymentMethods,
  getServices,
  getUserHistory,
  getUserProfile,
  getUserSettings,
  likeEvent,
  login,
  markNotificationRead,
  participateInEvent,
  purchasePoints,
  register as registerUser,
  resendEmailVerification,
  requestPasswordReset,
  resetPassword,
  unlikeEvent,
  updateUserEmail,
  updateUserSettings,
  verifyEmail,
} from "./api";
import { Logo } from "./components/Logo";
import {
  AccountIcon,
  ArrowIcon,
  EventIcon,
  HelpIcon,
  HomeIcon,
  MailIcon,
  QrIcon,
  WalletIcon,
} from "./components/Icons";
import {
  events as fallbackEvents,
  productCategories as fallbackProductCategories,
  scheduledEvent as fallbackScheduledEvent,
  user as fallbackUser,
  type EventItem,
  type ProductCategory,
  type ProductItem,
  type Screen,
} from "./data/mockData";
import type {
  AuthResponse,
  EventItem as ApiEventItem,
  NotificationItem,
  Participation,
  PaymentMethod,
  Purchase,
  ServiceItem,
  SupportTicket,
  Transaction,
  UserProfile,
  UserSettings,
} from "./types";

const SESSION_STORAGE_KEY = "link-town-session";
const DUMMY_EVENT_IMAGE_URL = "/dummy-event-image.svg";
const DUMMY_PRODUCT_IMAGE_URL = "/dummy-product-image.svg";

const SCREEN_ROUTES: Record<Screen, string> = {
  login: "/login",
  home: "/app",
  events: "/app/events",
  scan: "/app/scan",
  wallet: "/app/wallet",
  purchase: "/app/wallet/purchase",
  notifications: "/app/notifications",
  support: "/app/support",
  account: "/app/account",
  "payment-methods": "/app/payment-methods",
  history: "/app/history",
};

function getScreenFromPath(pathname: string, hasSession: boolean): Screen {
  if (!hasSession) {
    return "login";
  }

  switch (pathname) {
    case "/":
    case "/home":
    case "/app":
      return "home";
    case "/events":
    case "/app/events":
      return "events";
    case "/scan":
    case "/app/scan":
      return "scan";
    case "/wallet":
    case "/app/wallet":
      return "wallet";
    case "/wallet/purchase":
    case "/purchase":
    case "/app/wallet/purchase":
      return "purchase";
    case "/notifications":
    case "/app/notifications":
      return "notifications";
    case "/support":
    case "/app/support":
      return "support";
    case "/payment-methods":
    case "/app/payment-methods":
      return "payment-methods";
    case "/history":
    case "/app/history":
      return "history";
    case "/account":
    case "/app/account":
      return "account";
    case "/login":
    default:
      return "home";
  }
}

function isKnownAppPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/home" ||
    pathname === "/events" ||
    pathname === "/scan" ||
    pathname === "/wallet" ||
    pathname === "/purchase" ||
    pathname === "/wallet/purchase" ||
    pathname === "/notifications" ||
    pathname === "/support" ||
    pathname === "/payment-methods" ||
    pathname === "/history" ||
    pathname === "/account" ||
    Object.values(SCREEN_ROUTES).includes(pathname)
  );
}

type AppLanguage = "ja" | "en";

const translations = {
  ja: {
    translate: "翻訳",
    home: "ホーム",
    events: "イベント",
    scan: "提示QR",
    wallet: "ウォレット",
    account: "アカウント",
    pointsBalance: "ポイント残高",
    availablePoints: "現在の利用可能ポイント",
    buyPoints: "ポイント購入画面へ",
    exchangePoints: "ポイント交換",
    recommended: "おすすめ",
    favorite: "お気に入り",
    storeMapHint: "商品を選ぶと、提供店舗をGoogle Map上にピン表示します。",
    providedBy: "提供店舗",
    address: "住所",
    requiredPoints: "必要ポイント",
    openInGoogleMaps: "Google Mapで開く",
    close: "閉じる",
    accountType: "アカウント区分",
    userId: "ユーザーID",
    emailSettings: "メールアドレス設定",
    notificationSettings: "通知設定",
    languageSettings: "言語設定",
    fontSizeSettings: "文字サイズの変更",
    saveSettings: "設定を保存",
    security: "セキュリティ",
    currentPassword: "現在のパスワード",
    newPassword: "新しいパスワード",
    changePassword: "パスワード変更",
    other: "その他",
    logout: "ログアウト",
    deleteAccount: "アカウントの削除",
    purchasePoints: "購入ポイント",
    paymentAmount: "支払い金額",
    totalAvailablePoints: "合計利用可能ポイント",
    mapTitle: "店舗マップ",
    userQrTitle: "本人確認QR",
    userQrDescription: "イベント主催者または商店スタッフにこのQRを提示してください。",
    userQrExpires: "有効期限",
    refreshQr: "QRを更新",
    qrPayloadLabel: "QR内容",
    exchangeCta: "この商品を交換する",
    exchangeConfirmTitle: "ポイント交換の確認",
    exchangeConfirmBody: "次の商品を交換します。よろしいですか？",
    exchangeExecute: "交換する",
    cancel: "キャンセル",
    exchanging: "交換中…",
    exchangeSuccess: "交換が完了しました。",
    exchangeFailed: "交換に失敗しました。",
    notEnoughPoints: "ポイントが不足しています。",
    selectPurchaseAmount: "購入ポイントを選択",
    executePurchase: "購入する",
    purchasing: "購入中…",
    purchaseSuccess: "ポイントを購入しました。",
    purchaseFailed: "購入に失敗しました。",
    paymentMethodPlaceholder: "支払方法は次バージョンで設定できます",
    back: "戻る",
    notifications: "通知",
    notificationsEmpty: "通知はありません。",
    markRead: "既読にする",
    paymentMethods: "支払方法",
    paymentMethodsEmpty: "登録されている支払方法はありません。",
    addPaymentMethod: "支払方法を追加",
    paymentLabel: "ラベル",
    paymentBrand: "種別 (例: VISA / 銀行)",
    paymentLast4: "下4桁",
    setAsDefault: "デフォルトにする",
    save: "保存",
    deleteAction: "削除",
    isDefault: "デフォルト",
    support: "問い合わせ・不具合報告",
    supportEmpty: "履歴はありません。",
    supportTabHistory: "履歴",
    supportTabNew: "新規作成",
    supportCategory: "種別",
    supportCategorySupport: "問い合わせ",
    supportCategoryBug: "不具合報告",
    supportSubject: "件名",
    supportBody: "内容",
    submit: "送信",
    history: "履歴",
    historyTabParticipations: "参加履歴",
    historyTabTransactions: "ポイント取引",
    historyTabPurchases: "購入履歴",
    historyEmpty: "履歴はありません。",
    walletHistory: "履歴確認",
    walletHistoryEmpty: "ポイント履歴はありません。",
    apiConnectionError: "APIサーバーに接続できません。しばらく待って再試行するか、公開URLとAPI URLの設定を確認してください。",
    genericError: "処理に失敗しました。",
    closeToast: "通知を閉じる",
    help: "ヘルプ",
    mail: "メール",
    appMenu: "アプリメニュー",
    homeEventList: "開催イベント一覧",
    homePointPurchase: "ポイント購入",
    homePointExchange: "ポイント交換所",
    upcomingEvent: "参加予定のイベント",
    recommendedEventsTitle: "おすすめのイベント",
    likedEvents: "いいねしたイベント",
    participatedEvents: "応募済みイベント",
    eventsEmpty: "表示できるイベントはありません。",
    cancelParticipation: "応募をキャンセル",
    eventImageAlt: "{title}の画像",
    productImageAlt: "{name}の画像",
    meetingPlace: "集合場所",
    meetingTime: "集合時間",
    eventActivityTime: "活動時間",
    eventDeadlinePlaceholder: "あと0時間〇〇分で締め切り",
    eventRecruitmentPlaceholder: "現在の募集人数　〇人",
    activityContent: "活動内容",
    mainActivityContent: "主な活動内容",
    activityItemTrash: "・公園内のゴミ拾い",
    activityItemStones: "・大きな石などの撤去作業",
    activityItemCleaning: "・動物の糞などの清掃作業",
    eventQuestionHint: "不明点がありましたら、管理の方に遠慮なく聞いてください。",
    eventNotes: "注意事項",
    applyEvent: "このイベントに応募する",
    eventAlreadyApplied: "応募済みのイベントです",
    likeAction: "いいね！",
    adFrame: "広告掲載フレーム",
    languageJapanese: "日本語",
    languageEnglish: "英語",
    fontSmall: "小",
    fontMedium: "中",
    fontLarge: "大",
    deleteAccountConfirm: "アカウントを削除します。よろしいですか？この操作は取り消せません。",
    accountSaved: "アカウント設定を保存しました。",
    passwordChanged: "パスワードを変更しました。",
    cannotApplyEvent: "このイベントは現在応募できません。",
    eventApplied: "イベントに応募しました。",
    cannotCancelEvent: "このイベントは現在キャンセルできません。",
    eventCanceled: "応募をキャンセルしました。",
    loginRequired: "ログイン情報が確認できません。",
    invalidServiceId: "サービスIDが不正です。",
    exchangeSuccessMessage: "{serviceName} を {points}pt で交換しました (残高 {balance}pt)",
    notificationMarkedRead: "既読にしました。",
    paymentMethodAdded: "支払方法を追加しました。",
    paymentMethodDeleted: "支払方法を削除しました。",
    supportTicketCreated: "問い合わせを送信しました。",
    purchaseSuccessMessage: "{points}pt を購入しました (残高 {balance}pt)",
    cannotLikeEvent: "このイベントは現在いいねできません。",
    paymentMethodLabelRequired: "ラベルを入力してください。",
    supportSubjectBodyRequired: "件名と内容を入力してください。",
    eventHistoryLabel: "地域イベント",
    chargeHistoryLabel: "チャージ",
    pointChargeTitle: "チャージpt",
    exchangeHistoryLabel: "ポイント交換",
    pointExchangeTitle: "ポイント交換",
    eventPointGrant: "イベントポイント付与",
    purchaseStatusPending: "処理待ち",
    purchaseStatusPaid: "支払済み",
    purchaseStatusFailed: "失敗",
    purchaseStatusCancelled: "キャンセル済み",
    supportStatusOpen: "未対応",
    supportStatusInProgress: "対応中",
    supportStatusResolved: "解決済み",
    supportStatusClosed: "終了",
    accountTypeGeneral: "一般",
    accountTypeResident: "地域住民",
    accountTypeVolunteer: "ボランティア",
    notSet: "未設定",
    localShoppingDistrict: "地域商店街周辺",
  },
  en: {
    translate: "Translate",
    home: "Home",
    events: "Events",
    scan: "My QR",
    wallet: "Wallet",
    account: "Account",
    pointsBalance: "Point Balance",
    availablePoints: "Available points",
    buyPoints: "Buy points",
    exchangePoints: "Exchange Points",
    recommended: "Recommended",
    favorite: "Favorites",
    storeMapHint: "Select a product to pin the shop on Google Maps.",
    providedBy: "Shop",
    address: "Address",
    requiredPoints: "Required points",
    openInGoogleMaps: "Open in Google Maps",
    close: "Close",
    accountType: "Account type",
    userId: "User ID",
    emailSettings: "Email address",
    notificationSettings: "Notifications",
    languageSettings: "Language",
    fontSizeSettings: "Font size",
    saveSettings: "Save settings",
    security: "Security",
    currentPassword: "Current password",
    newPassword: "New password",
    changePassword: "Change password",
    other: "Other",
    logout: "Log out",
    deleteAccount: "Delete account",
    purchasePoints: "Purchase points",
    paymentAmount: "Payment amount",
    totalAvailablePoints: "Total available points",
    mapTitle: "Shop map",
    userQrTitle: "Identity QR",
    userQrDescription: "Show this QR to the event organizer or store staff.",
    userQrExpires: "Expires",
    refreshQr: "Refresh QR",
    qrPayloadLabel: "QR payload",
    exchangeCta: "Exchange this item",
    exchangeConfirmTitle: "Confirm exchange",
    exchangeConfirmBody: "You are about to exchange the following item. Proceed?",
    exchangeExecute: "Exchange",
    cancel: "Cancel",
    exchanging: "Exchanging…",
    exchangeSuccess: "Exchange completed.",
    exchangeFailed: "Exchange failed.",
    notEnoughPoints: "Not enough points.",
    selectPurchaseAmount: "Select amount",
    executePurchase: "Purchase",
    purchasing: "Purchasing…",
    purchaseSuccess: "Points purchased.",
    purchaseFailed: "Purchase failed.",
    paymentMethodPlaceholder: "Payment methods can be set in a future version",
    back: "Back",
    notifications: "Notifications",
    notificationsEmpty: "No notifications.",
    markRead: "Mark as read",
    paymentMethods: "Payment methods",
    paymentMethodsEmpty: "No payment methods registered.",
    addPaymentMethod: "Add payment method",
    paymentLabel: "Label",
    paymentBrand: "Brand (e.g. VISA / Bank)",
    paymentLast4: "Last 4 digits",
    setAsDefault: "Set as default",
    save: "Save",
    deleteAction: "Delete",
    isDefault: "Default",
    support: "Support / Bug report",
    supportEmpty: "No history.",
    supportTabHistory: "History",
    supportTabNew: "New",
    supportCategory: "Category",
    supportCategorySupport: "Support",
    supportCategoryBug: "Bug",
    supportSubject: "Subject",
    supportBody: "Body",
    submit: "Submit",
    history: "History",
    historyTabParticipations: "Participations",
    historyTabTransactions: "Transactions",
    historyTabPurchases: "Purchases",
    historyEmpty: "No history.",
    walletHistory: "History",
    walletHistoryEmpty: "No point history.",
    apiConnectionError: "Could not connect to the API server. Try again later or check the public URL and API URL settings.",
    genericError: "The operation failed.",
    closeToast: "Close notification",
    help: "Help",
    mail: "Mail",
    appMenu: "App menu",
    homeEventList: "Event list",
    homePointPurchase: "Buy points",
    homePointExchange: "Point exchange",
    upcomingEvent: "Upcoming event",
    recommendedEventsTitle: "Recommended events",
    likedEvents: "Liked events",
    participatedEvents: "Applied events",
    eventsEmpty: "No events to display.",
    cancelParticipation: "Cancel application",
    eventImageAlt: "Image for {title}",
    productImageAlt: "Image for {name}",
    meetingPlace: "Meeting place",
    meetingTime: "Meeting time",
    eventActivityTime: "Activity time",
    eventDeadlinePlaceholder: "Closes in 0 hours",
    eventRecruitmentPlaceholder: "Current openings: 0",
    activityContent: "Activity details",
    mainActivityContent: "Main activities",
    activityItemTrash: "- Picking up litter in the park",
    activityItemStones: "- Removing large stones and debris",
    activityItemCleaning: "- Cleaning animal waste and other dirt",
    eventQuestionHint: "If you have questions, ask the organizer.",
    eventNotes: "Notes",
    applyEvent: "Apply for this event",
    eventAlreadyApplied: "You have already applied",
    likeAction: "Like",
    adFrame: "Ad placement",
    languageJapanese: "Japanese",
    languageEnglish: "English",
    fontSmall: "Small",
    fontMedium: "Medium",
    fontLarge: "Large",
    deleteAccountConfirm: "Delete this account? This action cannot be undone.",
    accountSaved: "Account settings saved.",
    passwordChanged: "Password changed.",
    cannotApplyEvent: "This event is not accepting applications.",
    eventApplied: "Applied for the event.",
    cannotCancelEvent: "This event cannot be cancelled now.",
    eventCanceled: "Application cancelled.",
    loginRequired: "Could not confirm your login session.",
    invalidServiceId: "Invalid service ID.",
    exchangeSuccessMessage: "Exchanged {serviceName} for {points}pt (balance {balance}pt)",
    notificationMarkedRead: "Marked as read.",
    paymentMethodAdded: "Payment method added.",
    paymentMethodDeleted: "Payment method deleted.",
    supportTicketCreated: "Support request sent.",
    purchaseSuccessMessage: "Purchased {points}pt (balance {balance}pt)",
    cannotLikeEvent: "This event cannot be liked now.",
    paymentMethodLabelRequired: "Enter a label.",
    supportSubjectBodyRequired: "Enter a subject and body.",
    eventHistoryLabel: "Event",
    chargeHistoryLabel: "Charge",
    pointChargeTitle: "Point charge",
    exchangeHistoryLabel: "Exchange",
    pointExchangeTitle: "Point exchange",
    eventPointGrant: "Event point grant",
    purchaseStatusPending: "Pending",
    purchaseStatusPaid: "Paid",
    purchaseStatusFailed: "Failed",
    purchaseStatusCancelled: "Cancelled",
    supportStatusOpen: "Open",
    supportStatusInProgress: "In progress",
    supportStatusResolved: "Resolved",
    supportStatusClosed: "Closed",
    accountTypeGeneral: "General",
    accountTypeResident: "Resident",
    accountTypeVolunteer: "Volunteer",
    notSet: "Not set",
    localShoppingDistrict: "Local shopping district",
  },
} as const;

type TranslationKey = keyof typeof translations.ja;

function translate(key: TranslationKey, language: AppLanguage) {
  return translations[language][key];
}

function formatTranslation(key: TranslationKey, language: AppLanguage, values: Record<string, string | number>) {
  return translate(key, language).replace(/\{(\w+)\}/g, (_match, name: string) => String(values[name] ?? ""));
}

function formatYen(amount: number, language: AppLanguage) {
  return new Intl.NumberFormat(language === "en" ? "en-US" : "ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

const accountTypeTranslationKeys: Record<string, TranslationKey> = {
  general: "accountTypeGeneral",
  resident: "accountTypeResident",
  volunteer: "accountTypeVolunteer",
  一般: "accountTypeGeneral",
  地域住民: "accountTypeResident",
  ボランティア: "accountTypeVolunteer",
};

function translateAccountType(value: string, language: AppLanguage) {
  const key = accountTypeTranslationKeys[value];
  return key ? translate(key, language) : value;
}

function translatePurchaseStatus(status: Purchase["status"], language: AppLanguage) {
  const keys: Record<Purchase["status"], TranslationKey> = {
    pending: "purchaseStatusPending",
    paid: "purchaseStatusPaid",
    failed: "purchaseStatusFailed",
    cancelled: "purchaseStatusCancelled",
  };
  return translate(keys[status], language);
}

function translateSupportStatus(status: SupportTicket["status"], language: AppLanguage) {
  const keys: Record<SupportTicket["status"], TranslationKey> = {
    open: "supportStatusOpen",
    in_progress: "supportStatusInProgress",
    resolved: "supportStatusResolved",
    closed: "supportStatusClosed",
  };
  return translate(keys[status], language);
}

const localizedContent = [
  { ja: "〇〇市の防災活動　ご家族での参加もOK！", en: "Disaster preparedness activity - families welcome" },
  { ja: "〇〇公園の清掃ボランティア　どなたでも大歓迎！", en: "Park cleanup volunteer activity - everyone welcome" },
  { ja: "手縫いタオル制作　初心者でも大丈夫！", en: "Hand-sewn towel workshop - beginners welcome" },
  { ja: "〇〇イベントの記念スタンプ募集", en: "Commemorative stamp activity" },
  { ja: "地域清掃ボランティア", en: "Demo Community Cleanup" },
  { ja: "見守りパトロール", en: "Demo Watch Patrol" },
  { ja: "子ども食堂サポート", en: "Demo Food Support" },
  { ja: "商店街の人気商品", en: "Popular local shopping street items" },
  { ja: "おみやげ", en: "Souvenirs" },
  { ja: "生活応援商品", en: "Daily life support items" },
  { ja: "人気商品A", en: "Popular item A" },
  { ja: "人気商品B", en: "Popular item B" },
  { ja: "人気商品C", en: "Popular item C" },
  { ja: "人気商品D", en: "Popular item D" },
  { ja: "おみやげA", en: "Souvenir A" },
  { ja: "おみやげB", en: "Souvenir B" },
  { ja: "おみやげC", en: "Souvenir C" },
  { ja: "生活用品A", en: "Daily item A" },
  { ja: "生活用品B", en: "Daily item B" },
  { ja: "生活用品C", en: "Daily item C" },
  { ja: "コーヒー無料券", en: "Demo Coffee Coupon" },
  { ja: "ケーキセット割引", en: "Demo Cake Coupon" },
  { ja: "焼きたてパン引換券", en: "Demo Bread Coupon" },
  { ja: "野菜セット引換券", en: "Demo Vegetable Coupon" },
] as const;

function localizeApiText(value: string, language: AppLanguage) {
  const match = localizedContent.find((entry) => entry.ja === value || entry.en === value);
  return match ? match[language] : value;
}

const legacyDemoLocationMap: Record<string, string> = {
  "Demo Park": "中央公園",
  "Demo Station": "駅前商店街",
  "Demo Community Center": "市民センター",
};

function normalizeLocationText(value: string | null | undefined, language: AppLanguage) {
  if (!value) {
    return translate("notSet", language);
  }

  return legacyDemoLocationMap[value] ?? value;
}

function normalizeLanguage(value: string | undefined | null): AppLanguage {
  return value === "en" ? "en" : "ja";
}

type Session = Pick<AuthResponse, "token" | "user">;
type ActionResult = { ok: boolean; message: string };

type DisplayEvent = EventItem & {
  rawEventId?: number;
  liked?: boolean;
  likeCount?: number;
};
type DisplayUser = typeof fallbackUser & {
  displayName: string;
};

function readStoredSession(): Session | null {
  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as Session;
    return typeof parsed.token === "string" ? parsed : null;
  } catch {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function writeStoredSession(session: Session | null) {
  if (session) {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } else {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
}

function formatDisplayDate(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function getEventDisplayDate() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return formatDisplayDate(date);
}

function formatDateTimeParts(value: string, displayDate?: string) {
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) {
    return { date: displayDate ?? value ?? "YYYY/MM/DD", time: "-" };
  }

  return {
    date: displayDate ?? formatDisplayDate(date),
    time: `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`,
  };
}

function withEventDisplayDate<T extends EventItem>(event: T, displayDate: string): T {
  return { ...event, date: displayDate };
}

function mapEvent(event: ApiEventItem, displayDate: string, language: AppLanguage): DisplayEvent {
  const parts = formatDateTimeParts(event.event_datetime, displayDate);
  const location = normalizeLocationText(event.location, language);
  return {
    id: String(event.event_id),
    date: parts.date,
    title: localizeApiText(event.event_name, language),
    points: event.grant_points,
    location,
    time: parts.time,
    imageUrl: event.image_url || DUMMY_EVENT_IMAGE_URL,
    rawEventId: event.event_id,
    liked: toBoolean(event.liked),
    likeCount: event.like_count,
  };
}

function mapParticipation(participation: Participation, displayDate: string, language: AppLanguage): DisplayEvent {
  const parts = formatDateTimeParts(participation.event_datetime, displayDate);
  const location = normalizeLocationText(participation.location, language);
  return {
    id: String(participation.event_id),
    date: parts.date,
    title: localizeApiText(participation.event_name, language),
    points: participation.granted_points,
    location,
    time: parts.time,
    imageUrl: participation.image_url || DUMMY_EVENT_IMAGE_URL,
    rawEventId: participation.event_id,
  };
}

function mapServices(services: ServiceItem[], language: AppLanguage): ProductCategory[] {
  const grouped = new Map<number, ProductCategory>();

  for (const service of services) {
    const serviceName = localizeApiText(service.service_name, language);
    const storeName = service.store_name;
    const storeAddress = service.store_address || translate("localShoppingDistrict", language);
    const product: ProductItem = {
      id: String(service.service_id),
      name: serviceName,
      storeName,
      storeAddress,
      mapQuery: `${storeName} ${storeAddress}`.trim(),
      requiredPoints: service.required_points,
      imageUrl: service.image_url || DUMMY_PRODUCT_IMAGE_URL,
    };
    const existing = grouped.get(service.store_id);

    if (existing) {
      existing.products.push(product);
      continue;
    }

    grouped.set(service.store_id, {
      id: String(service.store_id),
      name: storeName,
      products: [product],
    });
  }

  return [...grouped.values()];
}

function localizeDisplayEvent(event: DisplayEvent, language: AppLanguage): DisplayEvent {
  return {
    ...event,
    title: localizeApiText(event.title, language),
    location: event.location,
  };
}

function localizeProduct(product: ProductItem, language: AppLanguage): ProductItem {
  const storeName = product.storeName;
  const storeAddress = product.storeAddress;

  return {
    ...product,
    name: localizeApiText(product.name, language),
    storeName,
    storeAddress,
    mapQuery: `${storeName} ${storeAddress}`.trim(),
  };
}

function localizeProductCategories(categories: ProductCategory[], language: AppLanguage): ProductCategory[] {
  return categories.map((category) => ({
    ...category,
    name: localizeApiText(category.name, language),
    products: category.products.map((product) => localizeProduct(product, language)),
  }));
}

const SWIPE_DISMISS_START_PX = 18;
const SWIPE_DISMISS_DISTANCE_PX = 126;
const SWIPE_DISMISS_FAST_DISTANCE_PX = 84;
const SWIPE_DISMISS_FAST_VELOCITY = 0.7;
const SWIPE_DISMISS_DIRECTION_RATIO = 1.35;
const SWIPE_DISMISS_SETTLE_MS = 180;

type SwipeDismissGesture = {
  startX: number;
  startY: number;
  lastY: number;
  startedAt: number;
  dragging: boolean;
  shouldTrack: boolean;
};

type SwipeDismissStyle = CSSProperties & {
  "--modal-swipe-y"?: string;
  "--modal-swipe-scale"?: string;
  "--modal-swipe-opacity"?: string;
};

function getResistedSwipeDistance(distance: number) {
  if (distance <= 180) {
    return distance;
  }

  return 180 + (distance - 180) * 0.28;
}

function useSwipeDownDismiss<T extends HTMLElement>(onClose: () => void) {
  const panelRef = useRef<T | null>(null);
  const gestureRef = useRef<SwipeDismissGesture | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const suppressClickTimerRef = useRef<number | null>(null);
  const suppressNextClickRef = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragPhase, setDragPhase] = useState<"idle" | "dragging" | "settling">("idle");
  const [hasInteracted, setHasInteracted] = useState(false);
  const [mouseTracking, setMouseTracking] = useState(false);

  const clearSettleTimer = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = null;
    }
  }, []);

  const clearSuppressClickTimer = useCallback(() => {
    if (suppressClickTimerRef.current !== null) {
      window.clearTimeout(suppressClickTimerRef.current);
      suppressClickTimerRef.current = null;
    }
  }, []);

  const beginGesture = useCallback(
    (clientX: number, clientY: number) => {
      clearSettleTimer();
      setDragOffset(0);
      setDragPhase("idle");
      gestureRef.current = {
        startX: clientX,
        startY: clientY,
        lastY: clientY,
        startedAt: Date.now(),
        dragging: false,
        shouldTrack: (panelRef.current?.scrollTop ?? 0) <= 0,
      };
    },
    [clearSettleTimer],
  );

  const updateGesture = useCallback((clientX: number, clientY: number, preventNativeScroll: () => void) => {
    const gesture = gestureRef.current;

    if (!gesture?.shouldTrack) {
      return;
    }

    const deltaX = clientX - gesture.startX;
    const deltaY = clientY - gesture.startY;
    gesture.lastY = clientY;

    if (!gesture.dragging) {
      if (deltaY < SWIPE_DISMISS_START_PX) {
        return;
      }

      if (deltaY <= Math.abs(deltaX) * SWIPE_DISMISS_DIRECTION_RATIO) {
        gesture.shouldTrack = false;
        return;
      }

      if ((panelRef.current?.scrollTop ?? 0) > 0) {
        gesture.shouldTrack = false;
        return;
      }

      gesture.dragging = true;
      setHasInteracted(true);
      setDragPhase("dragging");
    }

    preventNativeScroll();
    const nextOffset = getResistedSwipeDistance(Math.max(0, deltaY));
    setDragOffset(nextOffset);
  }, []);

  const finishGesture = useCallback(() => {
    const gesture = gestureRef.current;
    setMouseTracking(false);

    if (!gesture) {
      return;
    }

    gestureRef.current = null;

    if (!gesture.dragging) {
      return;
    }

    const distance = Math.max(0, gesture.lastY - gesture.startY);
    const duration = Math.max(1, Date.now() - gesture.startedAt);
    const velocity = distance / duration;
    const shouldClose =
      distance >= SWIPE_DISMISS_DISTANCE_PX ||
      (distance >= SWIPE_DISMISS_FAST_DISTANCE_PX && velocity >= SWIPE_DISMISS_FAST_VELOCITY);

    if (shouldClose) {
      setDragOffset(0);
      setDragPhase("idle");
      onClose();
      return;
    }

    suppressNextClickRef.current = true;
    clearSuppressClickTimer();
    suppressClickTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 350);
    setDragOffset(0);
    setDragPhase("settling");
    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(() => {
      setDragPhase("idle");
      settleTimerRef.current = null;
    }, SWIPE_DISMISS_SETTLE_MS);
  }, [clearSettleTimer, clearSuppressClickTimer, onClose]);

  const cancelGesture = useCallback(() => {
    setMouseTracking(false);
    gestureRef.current = null;
    setDragOffset(0);
    setDragPhase("settling");
    clearSettleTimer();
    settleTimerRef.current = window.setTimeout(() => {
      setDragPhase("idle");
      settleTimerRef.current = null;
    }, SWIPE_DISMISS_SETTLE_MS);
  }, [clearSettleTimer]);

  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<T>) => {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      beginGesture(touch.clientX, touch.clientY);
    },
    [beginGesture],
  );

  const handleTouchMove = useCallback(
    (event: ReactTouchEvent<T>) => {
      if (event.touches.length !== 1) {
        return;
      }

      const touch = event.touches[0];
      updateGesture(touch.clientX, touch.clientY, () => {
        if (event.cancelable) {
          event.preventDefault();
        }
      });
    },
    [updateGesture],
  );

  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<T>) => {
      if (event.button !== 0) {
        return;
      }

      beginGesture(event.clientX, event.clientY);
      setMouseTracking(true);
    },
    [beginGesture],
  );

  const handleClickCapture = useCallback((event: ReactMouseEvent<T>) => {
    if (!suppressNextClickRef.current) {
      return;
    }

    suppressNextClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  useEffect(() => {
    if (!mouseTracking) {
      return undefined;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      updateGesture(event.clientX, event.clientY, () => event.preventDefault());
    };
    const handleMouseUp = () => finishGesture();

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [finishGesture, mouseTracking, updateGesture]);

  useEffect(() => {
    return () => {
      clearSettleTimer();
      clearSuppressClickTimer();
    };
  }, [clearSettleTimer, clearSuppressClickTimer]);

  const dragScale = Math.max(0.985, 1 - dragOffset / 1800);
  const dragOpacity = Math.max(0.72, 1 - dragOffset / 440);
  const style: SwipeDismissStyle | undefined =
    dragPhase === "idle"
      ? undefined
      : {
          "--modal-swipe-y": `${dragOffset}px`,
          "--modal-swipe-scale": String(dragScale),
          "--modal-swipe-opacity": String(dragOpacity),
        };

  const className = [hasInteracted ? "has-swipe-interacted" : "", dragPhase === "idle" ? "" : `is-swipe-${dragPhase}`]
    .filter(Boolean)
    .join(" ");

  return {
    ref: panelRef,
    className,
    style,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: finishGesture,
      onTouchCancel: cancelGesture,
      onMouseDown: handleMouseDown,
      onClickCapture: handleClickCapture,
    },
  };
}

function getErrorMessage(error: unknown, language: AppLanguage = "ja") {
  if (error instanceof ApiError || error instanceof Error) {
    if (error instanceof TypeError && error.message === "Failed to fetch") {
      return translate("apiConnectionError", language);
    }

    return error.message;
  }

  return translate("genericError", language);
}

function toBoolean(value: boolean | number | undefined | null) {
  return value === true || value === 1;
}

type LoginReason = "session-expired" | null;
type AuthView = "login" | "register" | "register-confirm" | "register-sent" | "email-verified" | "reset-request" | "reset-password" | "reset-sent";
type VerificationStatus = "verifying" | "success" | "error";
type LoginMessageKind = "failed" | "session-expired" | null;

type RegistrationDraft = {
  lastName: string;
  firstName: string;
  ageGroup: string;
  email: string;
  password: string;
  passwordConfirm: string;
  townAssociationId: string;
};

type RegistrationErrors = Partial<Record<"name" | "email" | "password" | "passwordConfirm" | "townAssociationId", string>>;

type RegistrationResult = {
  userId: string;
  name: string;
  ageGroup: string;
  email: string;
  maskedPassword: string;
  townAssociationId: string;
};

const PASSWORD_RULE_MESSAGE = "パスワードは、半角英字・半角数字・記号を組み合わせた8文字以上で入力してください。";

const INITIAL_REGISTRATION_DRAFT: RegistrationDraft = {
  lastName: "",
  firstName: "",
  ageGroup: "",
  email: "",
  password: "",
  passwordConfirm: "",
  townAssociationId: "",
};

const AGE_GROUP_OPTIONS = ["", "10代", "20代", "30代", "40代", "50代", "60代", "70代以上"];

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPassword(value: string) {
  return /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/.test(value);
}

function isValidTownAssociationId(value: string) {
  return value.trim() === "" || /^[A-Za-z0-9_-]{3,32}$/.test(value.trim());
}

function getRegistrationName(draft: RegistrationDraft) {
  return `${draft.lastName.trim()} ${draft.firstName.trim()}`.trim();
}

function maskPassword(password: string) {
  return "●".repeat(Math.max(8, password.length));
}

export function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialSession = readStoredSession();
  const [eventDisplayDate] = useState(getEventDisplayDate);
  const [appLanguage, setAppLanguage] = useState<AppLanguage>("ja");
  const [eventTab, setEventTab] = useState<"recommended" | "liked" | "participated">("recommended");
  const [exchangeTab, setExchangeTab] = useState<"recommended" | "favorite">("recommended");
  const [session, setSession] = useState<Session | null>(initialSession);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [recommendedEvents, setRecommendedEvents] = useState<DisplayEvent[]>(() =>
    fallbackEvents.map((event) => withEventDisplayDate(event, eventDisplayDate)),
  );
  const [likedEvents, setLikedEvents] = useState<DisplayEvent[]>(() =>
    fallbackEvents.slice(0, 1).map((event) => withEventDisplayDate(event, eventDisplayDate)),
  );
  const [participatedEvents, setParticipatedEvents] = useState<DisplayEvent[]>([]);
  const [scheduledEvent, setScheduledEvent] = useState<DisplayEvent>(() => withEventDisplayDate(fallbackScheduledEvent, eventDisplayDate));
  const [selectedEvent, setSelectedEvent] = useState<DisplayEvent | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [participatedEventIds, setParticipatedEventIds] = useState<Set<number>>(new Set());
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(fallbackProductCategories);
  const [accountEmail, setAccountEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");
  const [loginReason, setLoginReason] = useState<LoginReason>(null);
  const [appFeedback, setAppFeedback] = useState<ActionResult | null>(null);
  const [deleteConfirming, setDeleteConfirming] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [participations, setParticipations] = useState<Participation[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const screen = getScreenFromPath(location.pathname, Boolean(session));

  const navigateToScreen = useCallback(
    (nextScreen: Screen, options?: { replace?: boolean }) => {
      navigate(SCREEN_ROUTES[nextScreen], { replace: options?.replace ?? false });
    },
    [navigate],
  );

  useEffect(() => {
    if (!session) {
      if (location.pathname !== SCREEN_ROUTES.login) {
        navigateToScreen("login", { replace: true });
      }
      return;
    }

    if (location.pathname === SCREEN_ROUTES.login || !isKnownAppPath(location.pathname)) {
      navigateToScreen("home", { replace: true });
    }
  }, [location.pathname, navigateToScreen, session]);

  useEffect(() => {
    if (session) {
      void loadApplicationData(session);
    }
  }, [session?.token]);

  useEffect(() => {
    if (!appFeedback) {
      return undefined;
    }

    const timer = window.setTimeout(() => setAppFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [appFeedback]);

  function notifyError(error: unknown) {
    setAppFeedback({ ok: false, message: getErrorMessage(error, appLanguage) });
  }

  function notifySuccess(message: string) {
    setAppFeedback({ ok: true, message });
  }

  async function loadApplicationData(currentSession: Session) {
    try {
      const [nextProfile, nextSettings] = await Promise.all([
        getUserProfile(currentSession.user.user_id, currentSession.token),
        getUserSettings(currentSession.user.user_id, currentSession.token),
      ]);
      const nextLanguage = normalizeLanguage(nextSettings.language);
      const [
        nextEvents,
        nextLikedEvents,
        nextServices,
        nextHistory,
        nextNotifications,
        nextPaymentMethods,
        nextSupportTickets,
      ] = await Promise.all([
        getEvents(currentSession.token, nextLanguage),
        getLikedEvents(currentSession.user.user_id, currentSession.token, nextLanguage),
        getServices(currentSession.token, nextLanguage),
        getUserHistory(currentSession.user.user_id, currentSession.token, nextLanguage),
        getNotifications(currentSession.user.user_id, currentSession.token, nextLanguage).catch(() => []),
        getPaymentMethods(currentSession.user.user_id, currentSession.token).catch(() => []),
        getMySupportTickets(currentSession.token).catch(() => []),
      ]);

      const mappedEvents = nextEvents.map((event) => mapEvent(event, eventDisplayDate, nextLanguage));
      const mappedEventsById = new Map(mappedEvents.flatMap((event) => (event.rawEventId ? [[event.rawEventId, event] as const] : [])));
      const mappedLikedEvents = nextLikedEvents.map((event) => mapEvent(event, eventDisplayDate, nextLanguage));
      const mappedLikedEventsById = new Map(mappedLikedEvents.flatMap((event) => (event.rawEventId ? [[event.rawEventId, event] as const] : [])));
      const mappedParticipatedEvents = nextHistory.participations.map((participation) => {
        return mappedEventsById.get(participation.event_id) ?? mappedLikedEventsById.get(participation.event_id) ?? mapParticipation(participation, eventDisplayDate, nextLanguage);
      });
      const mappedProducts = nextServices.length > 0 ? mapServices(nextServices, nextLanguage) : localizeProductCategories(fallbackProductCategories, nextLanguage);
      const mappedEventsByAnyId = new Map([...mappedEvents, ...mappedLikedEvents, ...mappedParticipatedEvents].flatMap((event) => (event.rawEventId ? [[event.rawEventId, event] as const] : [])));
      const mappedProductsById = new Map(mappedProducts.flatMap((category) => category.products.map((product) => [product.id, product] as const)));
      setProfile(nextProfile);
      setSettings(nextSettings);
      setAppLanguage(nextLanguage);
      setAccountEmail(nextProfile.email);
      setRecommendedEvents(mappedEvents.length > 0 ? mappedEvents : fallbackEvents.map((event) => localizeDisplayEvent(withEventDisplayDate(event, eventDisplayDate), nextLanguage)));
      setLikedEvents(mappedLikedEvents);
      setParticipatedEvents(mappedParticipatedEvents);
      setScheduledEvent(mappedParticipatedEvents[0] ?? mappedEvents[0] ?? localizeDisplayEvent(withEventDisplayDate(fallbackScheduledEvent, eventDisplayDate), nextLanguage));
      setParticipatedEventIds(new Set(nextHistory.participations.map((participation) => participation.event_id)));
      setProductCategories(mappedProducts);
      setSelectedEvent((current) => (current?.rawEventId ? mappedEventsByAnyId.get(current.rawEventId) ?? localizeDisplayEvent(current, nextLanguage) : current ? localizeDisplayEvent(current, nextLanguage) : current));
      setSelectedProduct((current) => (current ? mappedProductsById.get(current.id) ?? localizeProduct(current, nextLanguage) : current));
      setNotifications(nextNotifications);
      setPaymentMethods(nextPaymentMethods);
      setSupportTickets(nextSupportTickets);
      setParticipations(nextHistory.participations ?? []);
      setTransactions(nextHistory.transactions ?? []);
      setPurchases(nextHistory.purchases ?? []);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setSession(null);
        writeStoredSession(null);
        setLoginReason("session-expired");
        navigateToScreen("login", { replace: true });
        return;
      }

      console.error(error);
    }
  }

  function handleSession(nextSession: Session | null) {
    setSession(nextSession);
    writeStoredSession(nextSession);
  }

  async function handleLogin(email: string, password: string) {
    const response = await login(email, password);
    const nextSession = { token: response.token, user: response.user };
    setLoginReason(null);
    handleSession(nextSession);
    navigateToScreen("home", { replace: true });
    await loadApplicationData(nextSession);
  }

  function handleLogout() {
    handleSession(null);
    setProfile(null);
    setLoginReason(null);
    navigateToScreen("login", { replace: true });
  }

  function openEventDetail(event: DisplayEvent) {
    setSelectedEvent(event);
  }

  function applyLanguageToDisplayData(nextLanguage: AppLanguage) {
    setRecommendedEvents((current) => current.map((event) => localizeDisplayEvent(event, nextLanguage)));
    setLikedEvents((current) => current.map((event) => localizeDisplayEvent(event, nextLanguage)));
    setParticipatedEvents((current) => current.map((event) => localizeDisplayEvent(event, nextLanguage)));
    setScheduledEvent((current) => localizeDisplayEvent(current, nextLanguage));
    setSelectedEvent((current) => (current ? localizeDisplayEvent(current, nextLanguage) : current));
    setProductCategories((current) => localizeProductCategories(current, nextLanguage));
    setSelectedProduct((current) => (current ? localizeProduct(current, nextLanguage) : current));
  }

  async function handleToggleLanguage() {
    const nextLanguage: AppLanguage = appLanguage === "ja" ? "en" : "ja";
    setAppLanguage(nextLanguage);
    applyLanguageToDisplayData(nextLanguage);

    if (!session || !profile || !settings) {
      return;
    }

    const nextSettings = { ...settings, language: nextLanguage };
    setSettings(nextSettings);

    try {
      await updateUserSettings(
        profile.user_id,
        {
          notification_enabled: nextSettings.notification_enabled,
          language: nextSettings.language,
          font_size: nextSettings.font_size,
        },
        session.token,
      );
      await loadApplicationData(session);
    } catch (error) {
      console.error(error);
    }
  }

  function handleSettingsChange(nextSettings: UserSettings) {
    const nextLanguage = normalizeLanguage(nextSettings.language);
    setSettings(nextSettings);
    setAppLanguage(nextLanguage);
    applyLanguageToDisplayData(nextLanguage);
  }

  async function handleApplyToEvent(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      setAppFeedback({ ok: false, message: translate("cannotApplyEvent", appLanguage) });
      return;
    }

    if (participatedEventIds.has(event.rawEventId)) {
      return;
    }

    try {
      await participateInEvent(event.rawEventId, session.token);
      setParticipatedEventIds((current) => new Set(current).add(event.rawEventId!));
      await loadApplicationData(session);
      notifySuccess(translate("eventApplied", appLanguage));
    } catch (error) {
      notifyError(error);
    }
  }

  async function handleCancelParticipation(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      setAppFeedback({ ok: false, message: translate("cannotCancelEvent", appLanguage) });
      return;
    }

    try {
      await cancelEventParticipation(event.rawEventId, session.token);
      setParticipatedEventIds((current) => {
        const next = new Set(current);
        next.delete(event.rawEventId!);
        return next;
      });
      setParticipatedEvents((current) => current.filter((participatedEvent) => participatedEvent.rawEventId !== event.rawEventId));
      await loadApplicationData(session);
      notifySuccess(translate("eventCanceled", appLanguage));
    } catch (error) {
      notifyError(error);
    }
  }

  async function handleExchangeService(product: ProductItem): Promise<ActionResult> {
    if (!session) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    const serviceId = Number(product.id);
    if (!Number.isFinite(serviceId)) {
      return { ok: false, message: translate("invalidServiceId", appLanguage) };
    }

    try {
      const response = await exchangePoints(serviceId, session.token);
      await loadApplicationData(session);
      return {
        ok: true,
        message: formatTranslation("exchangeSuccessMessage", appLanguage, {
          serviceName: product.name || localizeApiText(response.service_name, appLanguage),
          points: response.used_points,
          balance: response.current_points,
        }),
      };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handleMarkNotificationRead(notificationId: number): Promise<ActionResult> {
    if (!session) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    try {
      await markNotificationRead(notificationId, session.token);
      await loadApplicationData(session);
      return { ok: true, message: translate("notificationMarkedRead", appLanguage) };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handleAddPaymentMethod(payload: {
    label: string;
    brand?: string;
    last4?: string;
    is_default?: boolean;
  }): Promise<ActionResult> {
    if (!session || !profile) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    try {
      await addPaymentMethod(profile.user_id, payload, session.token);
      await loadApplicationData(session);
      return { ok: true, message: translate("paymentMethodAdded", appLanguage) };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handleDeletePaymentMethod(paymentMethodId: number): Promise<ActionResult> {
    if (!session || !profile) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    try {
      await deletePaymentMethod(profile.user_id, paymentMethodId, session.token);
      await loadApplicationData(session);
      return { ok: true, message: translate("paymentMethodDeleted", appLanguage) };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handleCreateSupportTicket(payload: {
    category: "support" | "bug";
    subject: string;
    body: string;
  }): Promise<ActionResult> {
    if (!session) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    try {
      await createSupportTicket(payload, session.token);
      await loadApplicationData(session);
      return { ok: true, message: translate("supportTicketCreated", appLanguage) };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handlePurchasePoints(points: number): Promise<ActionResult> {
    if (!session) {
      return { ok: false, message: translate("loginRequired", appLanguage) };
    }

    try {
      const response = await purchasePoints({ points }, session.token);
      await loadApplicationData(session);
      return {
        ok: true,
        message: formatTranslation("purchaseSuccessMessage", appLanguage, {
          points: response.points,
          balance: response.current_points,
        }),
      };
    } catch (error) {
      return { ok: false, message: getErrorMessage(error, appLanguage) };
    }
  }

  async function handleToggleEventLike(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      setAppFeedback({ ok: false, message: translate("cannotLikeEvent", appLanguage) });
      return;
    }

    try {
      if (event.liked) {
        await unlikeEvent(event.rawEventId, session.token);
      } else {
        await likeEvent(event.rawEventId, session.token);
      }
      await loadApplicationData(session);
      setSelectedEvent((current) =>
        current?.id === event.id
          ? {
              ...current,
              liked: !event.liked,
              likeCount: Math.max(0, (event.likeCount ?? 0) + (event.liked ? -1 : 1)),
            }
          : current,
      );
    } catch (error) {
      notifyError(error);
    }
  }

  async function handleSaveAccount(event: FormEvent) {
    event.preventDefault();

    if (!session || !profile || !settings) {
      return;
    }

    try {
      await updateUserSettings(
        profile.user_id,
        {
          notification_enabled: settings.notification_enabled,
          language: settings.language,
          font_size: settings.font_size,
        },
        session.token,
      );

      if (accountEmail && accountEmail !== profile.email) {
        await updateUserEmail(profile.user_id, accountEmail, session.token);
      }

      setAccountMessage(translate("accountSaved", appLanguage));
      await loadApplicationData(session);
    } catch (error) {
      setAccountMessage(getErrorMessage(error, appLanguage));
    }
  }

  async function handleChangePassword(event: FormEvent) {
    event.preventDefault();

    if (!session) {
      return;
    }

    try {
      await changePassword(currentPassword, newPassword, session.token);
      setCurrentPassword("");
      setNewPassword("");
      setAccountMessage(translate("passwordChanged", appLanguage));
    } catch (error) {
      setAccountMessage(getErrorMessage(error, appLanguage));
    }
  }

  async function handleDeleteAccount() {
    if (!session || !profile) {
      return;
    }

    if (!deleteConfirming) {
      setDeleteConfirming(true);
      return;
    }

    try {
      await deleteUser(profile.user_id, session.token);
      setDeleteConfirming(false);
      handleLogout();
    } catch (error) {
      setDeleteConfirming(false);
      setAccountMessage(getErrorMessage(error, appLanguage));
    }
  }

  const displayUser = {
    displayName: profile?.name || session?.user.name || fallbackUser.accountType,
    accountType: profile?.user_type ? translateAccountType(profile.user_type, appLanguage) : translateAccountType(fallbackUser.accountType, appLanguage),
    userId: profile ? String(profile.user_id) : fallbackUser.userId,
    email: profile?.email || fallbackUser.email,
    homePoints: profile?.points ?? fallbackUser.homePoints,
    walletPoints: profile?.points ?? fallbackUser.walletPoints,
  };

  return (
    <main className="app-viewport">
      <section className="phone-shell">
        {appFeedback ? (
          <div className={`app-toast app-toast--${appFeedback.ok ? "success" : "error"}`} role={appFeedback.ok ? "status" : "alert"}>
            <span>{appFeedback.message}</span>
            <button type="button" aria-label={translate("closeToast", appLanguage)} onClick={() => setAppFeedback(null)}>
              ×
            </button>
          </div>
        ) : null}
        <div className={`phone-scroll ${screen !== "login" ? "phone-scroll--nav" : ""}`}>
          {screen === "login" ? <LoginScreen loginReason={loginReason} onLogin={handleLogin} /> : null}
          {screen === "home" ? (
            <HomeScreen
              user={displayUser}
              events={recommendedEvents}
              scheduledEvent={scheduledEvent}
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              onNavigate={navigateToScreen}
              onEventSelect={openEventDetail}
            />
          ) : null}
          {screen === "events" ? (
            <EventsScreen
              tab={eventTab}
              events={recommendedEvents}
              likedEvents={likedEvents}
              participatedEvents={participatedEvents}
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              onTabChange={setEventTab}
              onEventSelect={openEventDetail}
              onCancelParticipation={handleCancelParticipation}
            />
          ) : null}
          {screen === "scan" ? <ScanScreen language={appLanguage} user={displayUser} onLanguageToggle={handleToggleLanguage} onHome={() => navigateToScreen("home")} /> : null}
          {screen === "wallet" ? (
            <WalletScreen
              tab={exchangeTab}
              user={displayUser}
              productCategories={productCategories}
              participations={participations}
              transactions={transactions}
              purchases={purchases}
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              onTabChange={setExchangeTab}
              onPurchase={() => navigateToScreen("purchase")}
              onProductSelect={setSelectedProduct}
            />
          ) : null}
          {screen === "purchase" ? (
            <PurchaseScreen
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              points={displayUser.walletPoints}
              onPurchase={handlePurchasePoints}
            />
          ) : null}
          {screen === "account" ? (
            <AccountScreen
              user={displayUser}
              settings={settings}
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              accountEmail={accountEmail}
              currentPassword={currentPassword}
              newPassword={newPassword}
              message={accountMessage}
              unreadNotificationCount={notifications.filter((n) => !n.read_at).length}
              deleteConfirming={deleteConfirming}
              onEmailChange={setAccountEmail}
              onCurrentPasswordChange={setCurrentPassword}
              onNewPasswordChange={setNewPassword}
              onSettingsChange={handleSettingsChange}
              onSaveAccount={handleSaveAccount}
              onChangePassword={handleChangePassword}
              onDeleteAccount={handleDeleteAccount}
              onCancelDelete={() => setDeleteConfirming(false)}
              onLogout={handleLogout}
              onNavigate={navigateToScreen}
            />
          ) : null}
          {screen === "notifications" ? (
            <NotificationsScreen
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              notifications={notifications}
              onMarkRead={handleMarkNotificationRead}
              onBack={() => navigateToScreen("account")}
            />
          ) : null}
          {screen === "payment-methods" ? (
            <PaymentMethodsScreen
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              paymentMethods={paymentMethods}
              onAdd={handleAddPaymentMethod}
              onDelete={handleDeletePaymentMethod}
              onBack={() => navigateToScreen("account")}
            />
          ) : null}
          {screen === "support" ? (
            <SupportScreen
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              tickets={supportTickets}
              onCreate={handleCreateSupportTicket}
              onBack={() => navigateToScreen("account")}
            />
          ) : null}
          {screen === "history" ? (
            <HistoryScreen
              language={appLanguage}
              onLanguageToggle={handleToggleLanguage}
              participations={participations}
              transactions={transactions}
              purchases={purchases}
              onBack={() => navigateToScreen("account")}
            />
          ) : null}
        </div>
        {screen !== "login" ? <BottomNav current={screen} language={appLanguage} onNavigate={navigateToScreen} /> : null}
        {selectedEvent ? (
          <EventDetailScreen
            event={selectedEvent}
            language={appLanguage}
            onLanguageToggle={handleToggleLanguage}
            isParticipated={selectedEvent.rawEventId ? participatedEventIds.has(selectedEvent.rawEventId) : false}
            onApply={handleApplyToEvent}
            onLike={handleToggleEventLike}
            onClose={() => setSelectedEvent(null)}
          />
        ) : null}
        {selectedProduct ? (
          <ProductMapModal
            product={selectedProduct}
            language={appLanguage}
            currentPoints={displayUser.walletPoints}
            onExchange={handleExchangeService}
            onClose={() => setSelectedProduct(null)}
          />
        ) : null}
      </section>
    </main>
  );
}

function Header({
  help = false,
  language = "ja",
  onLanguageToggle,
}: {
  help?: boolean;
  language?: AppLanguage;
  onLanguageToggle?: () => void;
}) {
  return (
    <header className="app-header">
      <Logo />
      <div className="header-actions">
        {onLanguageToggle ? (
          <button type="button" className="translation-button" onClick={onLanguageToggle} aria-label={translate("translate", language)}>
            {language === "ja" ? "EN" : "JA"}
          </button>
        ) : null}
        <button type="button" className="icon-button" aria-label={help ? translate("help", language) : translate("mail", language)}>
          {help ? <HelpIcon /> : <MailIcon />}
        </button>
      </div>
    </header>
  );
}

function LoginScreen({
  loginReason,
  onLogin,
}: {
  loginReason: LoginReason;
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [view, setView] = useState<AuthView>("login");
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessageKind, setLoginMessageKind] = useState<LoginMessageKind>(loginReason === "session-expired" ? "session-expired" : null);
  const [loginPlainError, setLoginPlainError] = useState("");
  const [registration, setRegistration] = useState<RegistrationDraft>(INITIAL_REGISTRATION_DRAFT);
  const [registrationErrors, setRegistrationErrors] = useState<RegistrationErrors>({});
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [noticeEmail, setNoticeEmail] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [verificationUrl, setVerificationUrl] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>("verifying");
  const emailVerificationStartedRef = useRef(false);
  const passwordResetLinkHandledRef = useRef(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (loginReason === "session-expired") {
      setView("login");
      setLoginMessageKind("session-expired");
    }
  }, [loginReason]);

  useEffect(() => {
    if (emailVerificationStartedRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("email_verification_token");

    if (!token) {
      return;
    }

    emailVerificationStartedRef.current = true;
    setView("email-verified");
    setVerificationStatus("verifying");
    setVerificationMessage("メール認証を確認しています。");

    void verifyEmail(token)
      .then(() => {
        setVerificationToken("");
        setVerificationUrl("");
        setVerificationStatus("success");
        setVerificationMessage("メール認証が完了しました。ログインしてください。");
      })
      .catch((error) => {
        setVerificationStatus("error");
        setVerificationMessage(getErrorMessage(error));
      });

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  useEffect(() => {
    if (passwordResetLinkHandledRef.current) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const token = params.get("password_reset_token");

    if (!token) {
      return;
    }

    passwordResetLinkHandledRef.current = true;
    setResetToken(token);
    setResetMessage("");
    setNextPassword("");
    setNextPasswordConfirm("");
    setView("reset-password");

    window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
  }, []);

  function returnToLogin() {
    setView("login");
    setLoginMessageKind(null);
    setLoginPlainError("");
    setRegistrationErrors({});
    setRegistrationMessage("");
    setVerificationMessage("");
    setResetMessage("");
    setNextPassword("");
    setNextPasswordConfirm("");
  }

  function openPasswordReset() {
    setLoginMessageKind(null);
    setLoginPlainError("");
    setResetEmail(loginId.includes("@") ? loginId : "");
    setResetMessage("");
    setView("reset-request");
  }

  function updateRegistrationField(field: keyof RegistrationDraft, value: string) {
    setRegistration((current) => ({ ...current, [field]: value }));
    setRegistrationErrors((current) => {
      const next = { ...current };

      if (field === "lastName" || field === "firstName") {
        delete next.name;
      } else if (field === "email") {
        delete next.email;
      } else if (field === "password") {
        delete next.password;
      } else if (field === "passwordConfirm") {
        delete next.passwordConfirm;
      } else if (field === "townAssociationId") {
        delete next.townAssociationId;
      }

      return next;
    });
  }

  function validateRegistration() {
    const nextErrors: RegistrationErrors = {};

    if (!registration.lastName.trim() || !registration.firstName.trim()) {
      nextErrors.name = "氏名を入力してください。";
    }

    if (!isValidEmail(registration.email.trim())) {
      nextErrors.email = "正しいメールアドレスを入力してください。";
    }

    if (!isValidPassword(registration.password)) {
      nextErrors.password = PASSWORD_RULE_MESSAGE;
    }

    if (!registration.passwordConfirm || registration.password !== registration.passwordConfirm) {
      nextErrors.passwordConfirm = "パスワードが一致しません。";
    }

    if (!isValidTownAssociationId(registration.townAssociationId)) {
      nextErrors.townAssociationId = "正しい町会IDを入力してください。";
    }

    return nextErrors;
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setLoginMessageKind(null);
    setLoginPlainError("");
    setIsSubmitting(true);

    try {
      await onLogin(loginId.trim(), loginPassword);
    } catch (error) {
      const message = getErrorMessage(error);
      if (message.includes("not verified")) {
        setLoginPlainError("メール認証が完了していません。登録確認メールのURLから認証してください。");
      } else {
        setLoginMessageKind("failed");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRegistrationSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors = validateRegistration();
    setRegistrationErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setRegistrationMessage("");
    setIsSubmitting(true);

    try {
      const response = await registerUser({
        name: getRegistrationName(registration),
        email: registration.email.trim(),
        password: registration.password,
        age_group: registration.ageGroup || undefined,
        user_type: "resident",
      });
      setRegistrationResult({
        userId: String(response.user_id),
        name: getRegistrationName(registration),
        ageGroup: registration.ageGroup || "(未設定)",
        email: registration.email.trim(),
        maskedPassword: maskPassword(registration.password),
        townAssociationId: registration.townAssociationId.trim() || "(未入力)",
      });
      setLoginId(registration.email.trim());
      setNoticeEmail(registration.email.trim());
      setVerificationToken(response.verification_token ?? "");
      setVerificationUrl(response.verification_url ?? "");
      setVerificationMessage(
        response.verification_token
          ? "開発環境では下のボタンからメール認証を完了できます。"
          : "登録確認メールを送信しました。メール内のURLから認証を完了してください。",
      );
      setView("register-sent");
    } catch (error) {
      setRegistrationMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyEmail() {
    if (!verificationToken) {
      return;
    }

    setVerificationMessage("");
    setIsSubmitting(true);

    try {
      await verifyEmail(verificationToken);
      setVerificationToken("");
      setVerificationUrl("");
      setVerificationMessage("メール認証が完了しました。ログインしてください。");
    } catch (error) {
      setVerificationMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendVerificationEmail() {
    const email = noticeEmail || registration.email.trim() || loginId.trim();

    if (!isValidEmail(email)) {
      setVerificationMessage("正しいメールアドレスを入力してください。");
      return;
    }

    setVerificationMessage("");
    setIsSubmitting(true);

    try {
      const response = await resendEmailVerification(email);
      setNoticeEmail(email);
      setVerificationToken(response.verification_token ?? "");
      setVerificationUrl(response.verification_url ?? "");
      setVerificationMessage(
        response.verification_token
          ? "認証メールを再送信しました。開発環境では下のボタンから認証を完了できます。"
          : "認証メールを再送信しました。メール内のURLから認証を完了してください。",
      );
    } catch (error) {
      setVerificationMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetRequestSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isValidEmail(resetEmail.trim())) {
      setResetMessage("正しいメールアドレスを入力してください。");
      return;
    }

    setResetMessage("");
    setIsSubmitting(true);

    try {
      const response = await requestPasswordReset(resetEmail.trim());
      setNoticeEmail(resetEmail.trim());

      if (response.reset_token) {
        setResetToken(response.reset_token);
        setView("reset-password");
      } else {
        setView("reset-sent");
      }
    } catch (error) {
      setResetMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetPasswordSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isValidPassword(nextPassword)) {
      setResetMessage(PASSWORD_RULE_MESSAGE);
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setResetMessage("パスワードが一致しません。");
      return;
    }

    if (!resetToken) {
      setResetMessage("再設定用トークンが取得できませんでした。再設定メールを再送信してください。");
      setView("reset-request");
      return;
    }

    setResetMessage("");
    setIsSubmitting(true);

    try {
      await resetPassword(resetToken, nextPassword);
      setLoginId(resetEmail.trim());
      returnToLogin();
    } catch (error) {
      setResetMessage(getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (view === "register") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page">
          <Logo />
          <button className="auth-back-link" type="button" onClick={returnToLogin}>
            ＞ ログイン画面に戻る
          </button>
          <h1 className="auth-page-title">アカウント新規登録</h1>
          <form className="auth-form" onSubmit={handleRegistrationSubmit}>
            <div className="auth-field-group">
              <AuthFieldLabel badge="required">氏名</AuthFieldLabel>
              <div className="auth-two-column">
                <input className="auth-input auth-input--filled" value={registration.lastName} onChange={(event) => updateRegistrationField("lastName", event.target.value)} placeholder="姓" />
                <input className="auth-input auth-input--filled" value={registration.firstName} onChange={(event) => updateRegistrationField("firstName", event.target.value)} placeholder="名" />
              </div>
              <AuthFieldError message={registrationErrors.name} />
            </div>
            <div className="auth-field-group">
              <AuthFieldLabel badge="optional">年代</AuthFieldLabel>
              <select className="auth-input auth-input--filled" value={registration.ageGroup} onChange={(event) => updateRegistrationField("ageGroup", event.target.value)}>
                {AGE_GROUP_OPTIONS.map((option) => (
                  <option key={option || "unset"} value={option}>
                    {option || "(未設定)"}
                  </option>
                ))}
              </select>
            </div>
            <div className="auth-field-group">
              <AuthFieldLabel badge="required">メールアドレス</AuthFieldLabel>
              <input className="auth-input auth-input--filled" value={registration.email} onChange={(event) => updateRegistrationField("email", event.target.value)} inputMode="email" autoComplete="email" />
              <AuthFieldError message={registrationErrors.email} />
            </div>
            <div className="auth-field-group">
              <AuthFieldLabel badge="required">パスワード</AuthFieldLabel>
              <input className="auth-input auth-input--filled" value={registration.password} onChange={(event) => updateRegistrationField("password", event.target.value)} type="password" autoComplete="new-password" />
              <AuthFieldError message={registrationErrors.password} />
            </div>
            <div className="auth-field-group">
              <AuthFieldLabel badge="required">パスワード(確認用)</AuthFieldLabel>
              <input className="auth-input auth-input--filled" value={registration.passwordConfirm} onChange={(event) => updateRegistrationField("passwordConfirm", event.target.value)} type="password" autoComplete="new-password" />
              <AuthFieldError message={registrationErrors.passwordConfirm} />
            </div>
            <div className="auth-field-group">
              <AuthFieldLabel badge="optional">町会ID</AuthFieldLabel>
              <input className="auth-input auth-input--filled" value={registration.townAssociationId} onChange={(event) => updateRegistrationField("townAssociationId", event.target.value)} />
              <AuthFieldError message={registrationErrors.townAssociationId} />
            </div>
            <AuthFieldError message={registrationMessage} />
            <button className="auth-submit auth-submit--primary" type="submit" disabled={isSubmitting}>
              アカウント登録
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (view === "register-confirm") {
    const result =
      registrationResult ??
      ({
        userId: "sample_local_user",
        name: "山田 太郎",
        ageGroup: "(未設定)",
        email: "user@example.com",
        maskedPassword: "●●●●●●●●",
        townAssociationId: "(未入力)",
      } satisfies RegistrationResult);

    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page">
          <Logo />
          <h1 className="auth-page-title">アカウント情報確認画面</h1>
          <dl className="auth-confirm-list">
            <AuthConfirmRow label="ユーザーID" value={result.userId} />
            <AuthConfirmRow label="氏名" value={result.name} />
            <AuthConfirmRow label="年代" value={result.ageGroup} />
            <AuthConfirmRow label="メールアドレス" value={result.email} />
            <AuthConfirmRow label="パスワード(セキュリティ保護のため非表示にしています)" value={result.maskedPassword} />
            <AuthConfirmRow label="町会ID" value={result.townAssociationId} />
          </dl>
          <button className="auth-submit auth-submit--primary" type="button" onClick={returnToLogin}>
            ログイン画面に戻る
          </button>
        </div>
      </section>
    );
  }

  if (view === "register-sent") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page auth-page--notice">
          <Logo />
          <p className="auth-notice-text">
            ご入力いただいたメールアドレス宛に、登録確認メールを送信しました。メール内に記載されているURLをクリックして、登録を完了してください。
          </p>
          <p className="auth-notice-email">送信先: {noticeEmail || registrationResult?.email || "user@example.com"}</p>
          {verificationMessage ? <p className="auth-verification-message">{verificationMessage}</p> : null}
          {verificationUrl ? (
            <p className="auth-dev-note">
              開発用URL: <span>{verificationUrl}</span>
            </p>
          ) : null}
          <div className="auth-notice-actions">
            {verificationToken ? (
              <button className="auth-submit auth-submit--primary" type="button" onClick={handleVerifyEmail} disabled={isSubmitting}>
                開発用: メール認証を完了する
              </button>
            ) : null}
            <button className="auth-submit auth-submit--secondary" type="button" onClick={handleResendVerificationEmail} disabled={isSubmitting}>
              認証メールを再送信する
            </button>
          </div>
          <button className="auth-submit auth-submit--primary" type="button" onClick={returnToLogin}>
            ログイン画面に戻る
          </button>
        </div>
      </section>
    );
  }

  if (view === "email-verified") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page auth-page--notice">
          <Logo />
          {verificationStatus === "verifying" ? (
            <>
              <h1 className="auth-page-title">メール認証を確認中</h1>
              <p className="auth-notice-text">
                メールアドレスの認証を確認しています。しばらくお待ちください。
              </p>
            </>
          ) : null}
          {verificationStatus === "success" ? (
            <>
              <h1 className="auth-page-title">メール認証が完了しました</h1>
              <p className="auth-notice-text">
                ご登録ありがとうございます。下のボタンからログインしてLink Townをご利用ください。
              </p>
              <p className="auth-verification-message">{verificationMessage}</p>
            </>
          ) : null}
          {verificationStatus === "error" ? (
            <>
              <h1 className="auth-page-title">メール認証に失敗しました</h1>
              <p className="auth-notice-text">
                認証リンクが無効か、有効期限が切れている可能性があります。
                ログイン画面から「認証メールを再送信する」をご利用ください。
              </p>
              <p className="auth-verification-message auth-verification-message--error">{verificationMessage}</p>
            </>
          ) : null}
          {verificationStatus !== "verifying" ? (
            <button className="auth-submit auth-submit--primary" type="button" onClick={returnToLogin}>
              ログイン画面へ
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  if (view === "reset-request") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page">
          <Logo />
          <button className="auth-back-link" type="button" onClick={returnToLogin}>
            ＞ ログイン画面に戻る
          </button>
          <h1 className="auth-page-title">パスワードの再設定</h1>
          <p className="auth-description">ご登録いただいているメールアドレスを入力してください。パスワード再設定用のURLをお送りします。</p>
          <form className="auth-form" onSubmit={handleResetRequestSubmit}>
            <div className="auth-field-group">
              <input className="auth-input auth-input--outline" value={resetEmail} onChange={(event) => setResetEmail(event.target.value)} placeholder="メールアドレス" inputMode="email" autoComplete="email" />
            </div>
            <AuthFieldError message={resetMessage} />
            <button className="auth-submit auth-submit--primary" type="submit" disabled={isSubmitting}>
              再設定メールを送信する
            </button>
          </form>
        </div>
      </section>
    );
  }

  if (view === "reset-sent") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page auth-page--notice">
          <Logo />
          <p className="auth-notice-text">パスワード再設定用のURLをメールで送信しました。メール内に記載されているURLからパスワードを再設定してください。</p>
          <p className="auth-notice-email">送信先: {noticeEmail || resetEmail || "user@example.com"}</p>
          <button className="auth-submit auth-submit--primary" type="button" onClick={returnToLogin}>
            ログイン画面に戻る
          </button>
        </div>
      </section>
    );
  }

  if (view === "reset-password") {
    return (
      <section className="login-screen login-screen--form">
        <div className="auth-page">
          <Logo />
          <h1 className="auth-page-title">パスワードの再設定</h1>
          <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
            <div className="auth-field-group">
              <input className="auth-input auth-input--outline" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} placeholder="パスワード" type="password" autoComplete="new-password" />
            </div>
            <div className="auth-field-group">
              <input className="auth-input auth-input--outline" value={nextPasswordConfirm} onChange={(event) => setNextPasswordConfirm(event.target.value)} placeholder="パスワード(確認用)" type="password" autoComplete="new-password" />
            </div>
            <AuthFieldError message={resetMessage} />
            <button className="auth-submit auth-submit--primary" type="submit" disabled={isSubmitting}>
              パスワードを変更する
            </button>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className={`login-screen${loginMessageKind || loginPlainError ? " login-screen--alert" : ""}`}>
      <div className="auth-login-layout">
        <form className="login-card" onSubmit={handleLoginSubmit}>
          <Logo small />
          <h1>ログイン</h1>
          <input className="auth-input auth-input--outline" value={loginId} onChange={(event) => setLoginId(event.target.value)} aria-label="ユーザーID または メールアドレス" placeholder="ユーザーID または メールアドレス" autoComplete="username" />
          <input className="auth-input auth-input--outline" value={loginPassword} onChange={(event) => setLoginPassword(event.target.value)} aria-label="パスワード" type="password" placeholder="パスワード" autoComplete="current-password" />
          {loginMessageKind ? <LoginErrorMessage kind={loginMessageKind} onReset={openPasswordReset} /> : null}
          <AuthFieldError message={loginPlainError} />
          <button className="auth-text-link" type="button" onClick={openPasswordReset}>
            パスワードを忘れた場合
          </button>
          <button className="auth-submit auth-submit--primary" type="submit" disabled={isSubmitting}>
            続ける
          </button>
          <div className="auth-divider">
            <span>アカウント未登録の方はこちらから</span>
          </div>
          <button className="auth-submit auth-submit--secondary" type="button" onClick={() => setView("register")}>
            新規登録
          </button>
        </form>
        <AuthFooter />
      </div>
    </section>
  );
}

function AuthFooter() {
  return (
    <footer className="login-footer">
      <a href="#">プライバシーポリシー</a>
      <a href="#">利用規約</a>
      <a href="#">会員規約</a>
    </footer>
  );
}

function AuthFieldLabel({ badge, children }: { badge: "required" | "optional"; children: string }) {
  return (
    <label className="auth-field-label">
      <span>{children}</span>
      <span className={`auth-badge auth-badge--${badge}`}>{badge === "required" ? "必須" : "任意"}</span>
    </label>
  );
}

function AuthFieldError({ message }: { message?: string }) {
  return message ? <p className="auth-field-error">{message}</p> : null;
}

function AuthConfirmRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="auth-confirm-row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LoginErrorMessage({ kind, onReset }: { kind: Exclude<LoginMessageKind, null>; onReset: () => void }) {
  const prefix =
    kind === "session-expired"
      ? "あなたのセッションがタイムアウトしました。再度ログインしてください。パスワードをお忘れの場合は、"
      : "ログインに失敗しました。入力された情報に誤りがあるか、アカウントが登録されていません。パスワードをお忘れの場合は、";

  return (
    <p className="auth-login-error" aria-live="polite">
      {prefix}
      <button type="button" onClick={onReset}>
        こちら
      </button>
      から再設定してください。
    </p>
  );
}

function HomeScreen({
  user,
  events,
  scheduledEvent,
  language,
  onLanguageToggle,
  onNavigate,
  onEventSelect,
}: {
  user: typeof fallbackUser;
  events: DisplayEvent[];
  scheduledEvent: DisplayEvent;
  language: AppLanguage;
  onLanguageToggle: () => void;
  onNavigate: (screen: Screen) => void;
  onEventSelect: (event: DisplayEvent) => void;
}) {
  return (
    <section>
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <article className="points-card points-card--home">
        <div className="points-card__row">
          <span>{translate("pointsBalance", language)}</span>
          <strong>
            {user.homePoints}
            <small>pt</small>
          </strong>
          <ArrowIcon />
        </div>
        <div className="points-card__actions">
          <button type="button" onClick={() => onNavigate("events")}>
            {translate("homeEventList", language)}
          </button>
          <button type="button" onClick={() => onNavigate("purchase")}>
            {translate("homePointPurchase", language)}
          </button>
          <button type="button" onClick={() => onNavigate("wallet")}>
            {translate("homePointExchange", language)}
          </button>
        </div>
      </article>

      <section className="section">
        <SectionHeading>{translate("upcomingEvent", language)}</SectionHeading>
        <EventCard event={scheduledEvent} compact language={language} onSelect={onEventSelect} />
      </section>
      <section className="section">
        <SectionHeading>{translate("recommendedEventsTitle", language)}</SectionHeading>
        <div className="event-rail">
          {events.map((event) => (
            <EventCard key={event.id} event={event} compact language={language} onSelect={onEventSelect} />
          ))}
        </div>
      </section>
    </section>
  );
}

function EventsScreen({
  tab,
  events,
  likedEvents,
  participatedEvents,
  language,
  onLanguageToggle,
  onTabChange,
  onEventSelect,
  onCancelParticipation,
}: {
  tab: "recommended" | "liked" | "participated";
  events: DisplayEvent[];
  likedEvents: DisplayEvent[];
  participatedEvents: DisplayEvent[];
  language: AppLanguage;
  onLanguageToggle: () => void;
  onTabChange: (tab: "recommended" | "liked" | "participated") => void;
  onEventSelect: (event: DisplayEvent) => void;
  onCancelParticipation: (event: DisplayEvent) => void;
}) {
  const visibleEvents = tab === "recommended" ? events : tab === "liked" ? likedEvents : participatedEvents;

  return (
    <section>
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <Tabs
        value={tab}
        items={[
          ["recommended", translate("recommended", language)],
          ["liked", translate("likedEvents", language)],
          ["participated", translate("participatedEvents", language)],
        ]}
        onChange={onTabChange}
      />
      <AdFrame language={language} />
      <div className="event-list">
        {visibleEvents.length === 0 ? <p className="event-empty-message">{translate("eventsEmpty", language)}</p> : null}
        {visibleEvents.map((event) =>
          tab === "participated" ? (
            <div className="event-list__item" key={event.id}>
              <EventCard event={event} language={language} onSelect={onEventSelect} />
              <button className="event-cancel-button" type="button" onClick={() => onCancelParticipation(event)}>
                {translate("cancelParticipation", language)}
              </button>
            </div>
          ) : (
            <EventCard key={event.id} event={event} language={language} onSelect={onEventSelect} />
          ),
        )}
      </div>
    </section>
  );
}

function WalletScreen({
  tab,
  user,
  productCategories,
  participations,
  transactions,
  purchases,
  language,
  onLanguageToggle,
  onTabChange,
  onPurchase,
  onProductSelect,
}: {
  tab: "recommended" | "favorite";
  user: typeof fallbackUser;
  productCategories: ProductCategory[];
  participations: Participation[];
  transactions: Transaction[];
  purchases: Purchase[];
  language: AppLanguage;
  onLanguageToggle: () => void;
  onTabChange: (tab: "recommended" | "favorite") => void;
  onPurchase: () => void;
  onProductSelect: (product: ProductItem) => void;
}) {
  const visibleCategories = tab === "recommended" ? productCategories : productCategories.slice(0, 1);
  const walletHistory = useMemo(
    () => buildWalletHistoryItems({ participations, transactions, purchases, language }).slice(0, 6),
    [language, participations, purchases, transactions],
  );

  return (
    <section>
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <section className="section section--tight">
        <h1 className="screen-title screen-title--center">{translate("pointsBalance", language)}</h1>
        <article className="points-card points-card--wallet">
          <span>{translate("availablePoints", language)}</span>
          <strong>{user.walletPoints}pt</strong>
          <button type="button" onClick={onPurchase}>
            {translate("buyPoints", language)}
          </button>
        </article>
        <section className="wallet-history-card" aria-labelledby="wallet-history-title">
          <h2 id="wallet-history-title">{translate("walletHistory", language)}</h2>
          {walletHistory.length === 0 ? (
            <p className="wallet-history-empty">{translate("walletHistoryEmpty", language)}</p>
          ) : (
            <div className="wallet-history-list">
              {walletHistory.map((group) => (
                <section className="wallet-history-group" key={group.date}>
                  <time dateTime={group.isoDate}>{group.date}</time>
                  <div>
                    {group.items.map((item) => (
                      <article className="wallet-history-item" key={item.id}>
                        <div className="wallet-history-item__main">
                          <span className={`wallet-history-badge wallet-history-badge--${item.kind}`}>{item.label}</span>
                          <strong>{item.title}</strong>
                          <small>{item.meta}</small>
                        </div>
                        <span className={`wallet-history-delta wallet-history-delta--${item.delta > 0 ? "plus" : "minus"}`}>
                          {item.delta > 0 ? "+" : "-"}
                          {Math.abs(item.delta)}pt
                        </span>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </section>
      <section className="section">
        <h2 className="screen-title">{translate("exchangePoints", language)}</h2>
        <Tabs
          value={tab}
          items={[
            ["recommended", translate("recommended", language)],
            ["favorite", translate("favorite", language)],
          ]}
          onChange={onTabChange}
        />
        <p className="map-hint">{translate("storeMapHint", language)}</p>
        <div className="product-stack">
          {visibleCategories.map((category) => (
            <section key={category.id}>
              <SectionHeading>{category.name}</SectionHeading>
              <div className="product-rail">
                {category.products.map((product) => (
                  <button className="product-card product-card--button" type="button" key={product.id} onClick={() => onProductSelect(product)}>
                    <div>
                      <img src={product.imageUrl || DUMMY_PRODUCT_IMAGE_URL} alt={formatTranslation("productImageAlt", language, { name: product.name })} loading="lazy" />
                    </div>
                    <span>{product.name}</span>
                    <small>{product.storeName}</small>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}

const PURCHASE_AMOUNT_OPTIONS = [100, 500, 1000, 3000, 5000] as const;

function PurchaseScreen({
  points,
  language,
  onLanguageToggle,
  onPurchase,
}: {
  points: number;
  language: AppLanguage;
  onLanguageToggle: () => void;
  onPurchase: (points: number) => Promise<ActionResult>;
}) {
  const [selectedAmount, setSelectedAmount] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    const next = await onPurchase(selectedAmount);
    setResult(next);
    setIsSubmitting(false);
  }

  return (
    <section>
      <Header help language={language} onLanguageToggle={onLanguageToggle} />
      <article className="purchase-summary">
        <span>{translate("availablePoints", language)}</span>
        <strong>{points}pt</strong>
        <dl>
          <div>
            <dt>{translate("purchasePoints", language)}</dt>
            <dd>{selectedAmount} pt</dd>
          </div>
          <div>
            <dt>{translate("paymentAmount", language)}</dt>
            <dd>{formatYen(selectedAmount, language)}</dd>
          </div>
          <div>
            <dt>{translate("totalAvailablePoints", language)}</dt>
            <dd>{points + selectedAmount} pt</dd>
          </div>
        </dl>
      </article>
      <section className="section">
        <h2 className="screen-title">{translate("selectPurchaseAmount", language)}</h2>
        <div className="purchase-amount-grid">
          {PURCHASE_AMOUNT_OPTIONS.map((amount) => (
            <button
              key={amount}
              type="button"
              className={`purchase-amount-option ${selectedAmount === amount ? "purchase-amount-option--active" : ""}`}
              onClick={() => setSelectedAmount(amount)}
              disabled={isSubmitting}
            >
              {amount}pt
            </button>
          ))}
        </div>
        <article className="payment-method">
          <span className="payment-method__avatar" />
          <p>{translate("paymentMethodPlaceholder", language)}</p>
          <ArrowIcon />
        </article>
        {result ? (
          <p className={`action-banner ${result.ok ? "action-banner--success" : "action-banner--error"}`} role={result.ok ? "status" : "alert"}>
            {result.message}
          </p>
        ) : null}
        <button
          type="button"
          className="primary-button purchase-execute-button"
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? translate("purchasing", language) : `${translate("executePurchase", language)} (${selectedAmount}pt)`}
        </button>
      </section>
      <div className="purchase-ad">
      <AdFrame language={language} />
      </div>
    </section>
  );
}

function AccountScreen({
  user,
  settings,
  language,
  onLanguageToggle,
  accountEmail,
  currentPassword,
  newPassword,
  message,
  unreadNotificationCount,
  deleteConfirming,
  onEmailChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSettingsChange,
  onSaveAccount,
  onChangePassword,
  onDeleteAccount,
  onCancelDelete,
  onLogout,
  onNavigate,
}: {
  user: typeof fallbackUser;
  settings: UserSettings | null;
  language: AppLanguage;
  onLanguageToggle: () => void;
  accountEmail: string;
  currentPassword: string;
  newPassword: string;
  message: string;
  unreadNotificationCount: number;
  deleteConfirming: boolean;
  onEmailChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSettingsChange: (settings: UserSettings) => void;
  onSaveAccount: (event: FormEvent) => void;
  onChangePassword: (event: FormEvent) => void;
  onDeleteAccount: () => void;
  onCancelDelete: () => void;
  onLogout: () => void;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <section>
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <div className="account-form-list">
        {message ? <p className="account-message">{message}</p> : null}
        <section className="account-form-section">
          <h2>{translate("account", language)}</h2>
          <div className="account-info-row">
            <span>{translate("accountType", language)}</span>
            <strong>{user.accountType}</strong>
          </div>
          <div className="account-info-row">
            <span>{translate("userId", language)}</span>
            <strong>{user.userId}</strong>
          </div>
          <form onSubmit={onSaveAccount}>
            <label className="account-field">
              <span>{translate("emailSettings", language)}</span>
              <input value={accountEmail} onChange={(event) => onEmailChange(event.target.value)} />
            </label>
            {settings ? (
              <>
                <label className="account-checkbox">
                  <input
                    type="checkbox"
                    checked={toBoolean(settings.notification_enabled)}
                    onChange={(event) => onSettingsChange({ ...settings, notification_enabled: event.target.checked })}
                  />
                  <span>{translate("notificationSettings", language)}</span>
                </label>
                <label className="account-field">
                  <span>{translate("languageSettings", language)}</span>
                  <select value={settings.language} onChange={(event) => onSettingsChange({ ...settings, language: event.target.value })}>
                    <option value="ja">{translate("languageJapanese", language)}</option>
                    <option value="en">{translate("languageEnglish", language)}</option>
                  </select>
                </label>
                <label className="account-field">
                  <span>{translate("fontSizeSettings", language)}</span>
                  <select
                    value={settings.font_size}
                    onChange={(event) => onSettingsChange({ ...settings, font_size: event.target.value as UserSettings["font_size"] })}
                  >
                    <option value="small">{translate("fontSmall", language)}</option>
                    <option value="medium">{translate("fontMedium", language)}</option>
                    <option value="large">{translate("fontLarge", language)}</option>
                  </select>
                </label>
              </>
            ) : null}
            <button className="account-action-button" type="submit">
              {translate("saveSettings", language)}
            </button>
          </form>
        </section>

        <section className="account-form-section">
          <h2>{translate("security", language)}</h2>
          <form onSubmit={onChangePassword}>
            <label className="account-field">
              <span>{translate("currentPassword", language)}</span>
              <input type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} />
            </label>
            <label className="account-field">
              <span>{translate("newPassword", language)}</span>
              <input type="password" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} />
            </label>
            <button className="account-action-button" type="submit">
              {translate("changePassword", language)}
            </button>
          </form>
        </section>

        <section className="account-form-section">
          <h2>{translate("other", language)}</h2>
          <button className="settings-row" type="button" onClick={() => onNavigate("notifications")}>
            <span>
              {translate("notifications", language)}
              {unreadNotificationCount > 0 ? <em className="settings-badge">{unreadNotificationCount}</em> : null}
            </span>
            <ArrowIcon />
          </button>
          <button className="settings-row" type="button" onClick={() => onNavigate("payment-methods")}>
            <span>{translate("paymentMethods", language)}</span>
            <ArrowIcon />
          </button>
          <button className="settings-row" type="button" onClick={() => onNavigate("history")}>
            <span>{translate("history", language)}</span>
            <ArrowIcon />
          </button>
          <button className="settings-row" type="button" onClick={() => onNavigate("support")}>
            <span>{translate("support", language)}</span>
            <ArrowIcon />
          </button>
          <button className="settings-row" type="button" onClick={onLogout}>
            <span>{translate("logout", language)}</span>
          </button>
          {deleteConfirming ? (
            <div className="account-delete-confirm">
              <p>{translate("deleteAccountConfirm", language)}</p>
              <div className="account-delete-confirm__actions">
                <button type="button" className="secondary-button" onClick={onCancelDelete}>
                  {translate("cancel", language)}
                </button>
                <button type="button" className="account-action-button account-action-button--danger" onClick={onDeleteAccount}>
                  {translate("deleteAccount", language)}
                </button>
              </div>
            </div>
          ) : (
            <button className="settings-row settings-row--danger" type="button" onClick={onDeleteAccount}>
              <span>{translate("deleteAccount", language)}</span>
            </button>
          )}
        </section>
      </div>
    </section>
  );
}

function SubScreenHeader({
  title,
  language,
  onLanguageToggle,
  onBack,
}: {
  title: string;
  language: AppLanguage;
  onLanguageToggle: () => void;
  onBack: () => void;
}) {
  return (
    <>
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <div className="sub-screen-bar">
        <button type="button" className="sub-screen-back" onClick={onBack}>
          ＜ {translate("back", language)}
        </button>
        <h1>{title}</h1>
      </div>
    </>
  );
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function NotificationsScreen({
  language,
  onLanguageToggle,
  notifications,
  onMarkRead,
  onBack,
}: {
  language: AppLanguage;
  onLanguageToggle: () => void;
  notifications: NotificationItem[];
  onMarkRead: (notificationId: number) => Promise<ActionResult>;
  onBack: () => void;
}) {
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleMarkRead(notificationId: number) {
    setPendingId(notificationId);
    setResult(null);
    const next = await onMarkRead(notificationId);
    setPendingId(null);
    setResult(next);
  }

  return (
    <section>
      <SubScreenHeader title={translate("notifications", language)} language={language} onLanguageToggle={onLanguageToggle} onBack={onBack} />
      {result ? (
        <p className={`action-banner ${result.ok ? "action-banner--success" : "action-banner--error"}`} role={result.ok ? "status" : "alert"}>
          {result.message}
        </p>
      ) : null}
      {notifications.length === 0 ? (
        <p className="empty-message">{translate("notificationsEmpty", language)}</p>
      ) : (
        <ul className="notification-list">
          {notifications.map((notification) => (
            <li key={notification.notification_id} className={`notification-item ${notification.read_at ? "notification-item--read" : ""}`}>
              <div className="notification-item__head">
                <strong>{notification.title}</strong>
                <small>{formatTimestamp(notification.created_at)}</small>
              </div>
              <p>{notification.body}</p>
              {!notification.read_at ? (
                <button
                  type="button"
                  className="secondary-button notification-item__action"
                  onClick={() => handleMarkRead(notification.notification_id)}
                  disabled={pendingId === notification.notification_id}
                >
                  {translate("markRead", language)}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PaymentMethodsScreen({
  language,
  onLanguageToggle,
  paymentMethods,
  onAdd,
  onDelete,
  onBack,
}: {
  language: AppLanguage;
  onLanguageToggle: () => void;
  paymentMethods: PaymentMethod[];
  onAdd: (payload: { label: string; brand?: string; last4?: string; is_default?: boolean }) => Promise<ActionResult>;
  onDelete: (paymentMethodId: number) => Promise<ActionResult>;
  onBack: () => void;
}) {
  const [label, setLabel] = useState("");
  const [brand, setBrand] = useState("");
  const [last4, setLast4] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!label.trim()) {
      setResult({ ok: false, message: translate("paymentMethodLabelRequired", language) });
      return;
    }
    setSubmitting(true);
    setResult(null);
    const next = await onAdd({
      label: label.trim(),
      brand: brand.trim() || undefined,
      last4: last4.trim() || undefined,
      is_default: isDefault,
    });
    setSubmitting(false);
    setResult(next);
    if (next.ok) {
      setLabel("");
      setBrand("");
      setLast4("");
      setIsDefault(false);
    }
  }

  async function handleDelete(paymentMethodId: number) {
    setResult(null);
    const next = await onDelete(paymentMethodId);
    setResult(next);
  }

  return (
    <section>
      <SubScreenHeader title={translate("paymentMethods", language)} language={language} onLanguageToggle={onLanguageToggle} onBack={onBack} />
      {result ? (
        <p className={`action-banner ${result.ok ? "action-banner--success" : "action-banner--error"}`} role={result.ok ? "status" : "alert"}>
          {result.message}
        </p>
      ) : null}
      {paymentMethods.length === 0 ? (
        <p className="empty-message">{translate("paymentMethodsEmpty", language)}</p>
      ) : (
        <ul className="payment-methods-list">
          {paymentMethods.map((method) => (
            <li key={method.payment_method_id} className="payment-method-row">
              <div>
                <strong>{method.label}</strong>
                <small>
                  {method.brand} {method.last4 ? `•••• ${method.last4}` : ""}
                </small>
                {toBoolean(method.is_default) ? <em className="payment-method-default">{translate("isDefault", language)}</em> : null}
              </div>
              <button type="button" className="secondary-button" onClick={() => handleDelete(method.payment_method_id)}>
                {translate("deleteAction", language)}
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="payment-method-form" onSubmit={handleSubmit}>
        <h2>{translate("addPaymentMethod", language)}</h2>
        <label className="account-field">
          <span>{translate("paymentLabel", language)}</span>
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
        <label className="account-field">
          <span>{translate("paymentBrand", language)}</span>
          <input value={brand} onChange={(event) => setBrand(event.target.value)} />
        </label>
        <label className="account-field">
          <span>{translate("paymentLast4", language)}</span>
          <input value={last4} onChange={(event) => setLast4(event.target.value)} inputMode="numeric" maxLength={4} />
        </label>
        <label className="account-checkbox">
          <input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} />
          <span>{translate("setAsDefault", language)}</span>
        </label>
        <button type="submit" className="account-action-button" disabled={submitting}>
          {translate("save", language)}
        </button>
      </form>
    </section>
  );
}

function SupportScreen({
  language,
  onLanguageToggle,
  tickets,
  onCreate,
  onBack,
}: {
  language: AppLanguage;
  onLanguageToggle: () => void;
  tickets: SupportTicket[];
  onCreate: (payload: { category: "support" | "bug"; subject: string; body: string }) => Promise<ActionResult>;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"history" | "new">("history");
  const [category, setCategory] = useState<"support" | "bug">("support");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (!subject.trim() || !body.trim()) {
      setResult({ ok: false, message: translate("supportSubjectBodyRequired", language) });
      return;
    }
    setSubmitting(true);
    setResult(null);
    const next = await onCreate({ category, subject: subject.trim(), body: body.trim() });
    setSubmitting(false);
    setResult(next);
    if (next.ok) {
      setSubject("");
      setBody("");
      setTab("history");
    }
  }

  return (
    <section>
      <SubScreenHeader title={translate("support", language)} language={language} onLanguageToggle={onLanguageToggle} onBack={onBack} />
      <Tabs
        value={tab}
        items={[
          ["history", translate("supportTabHistory", language)],
          ["new", translate("supportTabNew", language)],
        ]}
        onChange={setTab}
      />
      {result ? (
        <p className={`action-banner ${result.ok ? "action-banner--success" : "action-banner--error"}`} role={result.ok ? "status" : "alert"}>
          {result.message}
        </p>
      ) : null}
      {tab === "history" ? (
        tickets.length === 0 ? (
          <p className="empty-message">{translate("supportEmpty", language)}</p>
        ) : (
          <ul className="support-list">
            {tickets.map((ticket) => (
              <li key={ticket.ticket_id} className="support-item">
                <div className="support-item__head">
                  <span className={`support-item__badge support-item__badge--${ticket.category}`}>
                    {ticket.category === "bug" ? translate("supportCategoryBug", language) : translate("supportCategorySupport", language)}
                  </span>
                  <strong>{ticket.subject}</strong>
                  <small>{translateSupportStatus(ticket.status, language)}</small>
                </div>
                <p>{ticket.body}</p>
                <small className="support-item__date">{formatTimestamp(ticket.created_at)}</small>
              </li>
            ))}
          </ul>
        )
      ) : (
        <form className="support-form" onSubmit={handleSubmit}>
          <label className="account-field">
            <span>{translate("supportCategory", language)}</span>
            <select value={category} onChange={(event) => setCategory(event.target.value as "support" | "bug")}>
              <option value="support">{translate("supportCategorySupport", language)}</option>
              <option value="bug">{translate("supportCategoryBug", language)}</option>
            </select>
          </label>
          <label className="account-field">
            <span>{translate("supportSubject", language)}</span>
            <input value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="account-field">
            <span>{translate("supportBody", language)}</span>
            <textarea value={body} rows={6} onChange={(event) => setBody(event.target.value)} />
          </label>
          <button type="submit" className="account-action-button" disabled={submitting}>
            {translate("submit", language)}
          </button>
        </form>
      )}
    </section>
  );
}

function HistoryScreen({
  language,
  onLanguageToggle,
  participations,
  transactions,
  purchases,
  onBack,
}: {
  language: AppLanguage;
  onLanguageToggle: () => void;
  participations: Participation[];
  transactions: Transaction[];
  purchases: Purchase[];
  onBack: () => void;
}) {
  const [tab, setTab] = useState<"participations" | "transactions" | "purchases">("participations");

  return (
    <section>
      <SubScreenHeader title={translate("history", language)} language={language} onLanguageToggle={onLanguageToggle} onBack={onBack} />
      <Tabs
        value={tab}
        items={[
          ["participations", translate("historyTabParticipations", language)],
          ["transactions", translate("historyTabTransactions", language)],
          ["purchases", translate("historyTabPurchases", language)],
        ]}
        onChange={setTab}
      />
      {tab === "participations" ? (
        participations.length === 0 ? (
          <p className="empty-message">{translate("historyEmpty", language)}</p>
        ) : (
          <ul className="history-list">
            {participations.map((entry) => (
              <li key={entry.participation_id} className="history-row">
                <div>
                  <strong>{entry.event_name}</strong>
                  <small>{formatTimestamp(entry.participated_at)}</small>
                </div>
                <span className="history-row__delta history-row__delta--plus">+{entry.granted_points}pt</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === "transactions" ? (
        transactions.length === 0 ? (
          <p className="empty-message">{translate("historyEmpty", language)}</p>
        ) : (
          <ul className="history-list">
            {transactions.map((entry) => (
              <li key={entry.transaction_id} className="history-row">
                <div>
                  <strong>
                    {entry.type === "grant"
                      ? translate("eventPointGrant", language)
                      : entry.service_name
                        ? localizeApiText(entry.service_name, language)
                        : translate("pointExchangeTitle", language)}
                  </strong>
                  <small>{formatTimestamp(entry.created_at)}</small>
                </div>
                <span className={`history-row__delta ${entry.type === "grant" ? "history-row__delta--plus" : "history-row__delta--minus"}`}>
                  {entry.type === "grant" ? "+" : "-"}
                  {entry.points}pt
                </span>
              </li>
            ))}
          </ul>
        )
      ) : null}
      {tab === "purchases" ? (
        purchases.length === 0 ? (
          <p className="empty-message">{translate("historyEmpty", language)}</p>
        ) : (
          <ul className="history-list">
            {purchases.map((entry) => (
              <li key={entry.purchase_id} className="history-row">
                <div>
                  <strong>
                    {entry.points}pt ({formatYen(entry.amount_yen, language)})
                  </strong>
                  <small>
                    {formatTimestamp(entry.created_at)} {translatePurchaseStatus(entry.status, language)}
                  </small>
                </div>
                <span className="history-row__delta history-row__delta--plus">+{entry.points}pt</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function createUserQrNonce() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildUserQrPayload(user: DisplayUser, issuedAt: Date, expiresAt: Date, nonce: string) {
  const params = new URLSearchParams({
    v: "1",
    type: "user-present",
    user_id: user.userId,
    name: user.displayName,
    issued_at: issuedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
    nonce,
  });

  return `linktown://user-present?${params.toString()}`;
}

function formatQrDateTime(value: Date, language: AppLanguage) {
  return new Intl.DateTimeFormat(language === "en" ? "en-US" : "ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(value);
}

function ScanScreen({
  language,
  user,
  onLanguageToggle,
  onHome,
}: {
  language: AppLanguage;
  user: DisplayUser;
  onLanguageToggle: () => void;
  onHome: () => void;
}) {
  const [nonce, setNonce] = useState(createUserQrNonce);
  const [qrImage, setQrImage] = useState("");
  const qrData = useMemo(() => {
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);

    return {
      issuedAt,
      expiresAt,
      payload: buildUserQrPayload(user, issuedAt, expiresAt, nonce),
    };
  }, [nonce, user.displayName, user.userId]);

  useEffect(() => {
    let isActive = true;

    QRCode.toDataURL(qrData.payload, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
      color: {
        dark: "#111111",
        light: "#ffffff",
      },
    })
      .then((nextImage) => {
        if (isActive) {
          setQrImage(nextImage);
        }
      })
      .catch((error) => {
        console.error(error);
        if (isActive) {
          setQrImage("");
        }
      });

    return () => {
      isActive = false;
    };
  }, [qrData.payload]);

  return (
    <section className="scan-screen">
      <Header language={language} onLanguageToggle={onLanguageToggle} />
      <div className="user-qr-card">
        <p>{translate("userQrTitle", language)}</p>
        <h1>{user.displayName}</h1>
        <span>{user.userId}</span>
        <div className="user-qr-card__image">
          {qrImage ? <img src={qrImage} alt={translate("userQrTitle", language)} /> : <strong>QR</strong>}
        </div>
        <p className="user-qr-card__description">{translate("userQrDescription", language)}</p>
        <dl>
          <div>
            <dt>{translate("userQrExpires", language)}</dt>
            <dd>{formatQrDateTime(qrData.expiresAt, language)}</dd>
          </div>
        </dl>
        <button type="button" onClick={() => setNonce(createUserQrNonce())}>
          {translate("refreshQr", language)}
        </button>
      </div>
      <details className="user-qr-payload">
        <summary>{translate("qrPayloadLabel", language)}</summary>
        <code>{qrData.payload}</code>
      </details>
      <button className="primary-button scan-screen__button" type="button" onClick={onHome}>
        {translate("home", language)}
      </button>
    </section>
  );
}

function EventDetailScreen({
  event,
  language,
  onLanguageToggle,
  isParticipated,
  onApply,
  onLike,
  onClose,
}: {
  event: DisplayEvent;
  language: AppLanguage;
  onLanguageToggle: () => void;
  isParticipated: boolean;
  onApply: (event: DisplayEvent) => void;
  onLike: (event: DisplayEvent) => void;
  onClose: () => void;
}) {
  const swipeDismiss = useSwipeDownDismiss<HTMLElement>(onClose);
  const imageUrl = event.imageUrl || DUMMY_EVENT_IMAGE_URL;

  return (
    <div className="event-detail-modal" role="presentation" onClick={onClose}>
      <section
        ref={swipeDismiss.ref}
        className={`event-detail-screen ${swipeDismiss.className}`.trim()}
        style={swipeDismiss.style}
        role="dialog"
        aria-modal="true"
        aria-label={event.title}
        onClick={(clickEvent) => clickEvent.stopPropagation()}
        {...swipeDismiss.handlers}
      >
        <Header language={language} onLanguageToggle={onLanguageToggle} />
        <p className="event-detail__date">{event.date}</p>
        <div className="event-detail__photo">
          <img src={imageUrl} alt={formatTranslation("eventImageAlt", language, { title: event.title })} loading="lazy" />
        </div>
        <article className="event-detail__body">
          <h1>{event.title}</h1>
          <p className="event-detail__meta">
            {translate("eventActivityTime", language)}: {event.time}　　{translate("meetingPlace", language)}: {event.location}
          </p>
          <div className="event-detail__status">
            <span>{translate("eventDeadlinePlaceholder", language)}</span>
            <strong>{translate("eventRecruitmentPlaceholder", language)}</strong>
          </div>
          <strong className="event-detail__points">{event.points}pt</strong>
          <section>
            <h2>{translate("activityContent", language)}</h2>
            <h3>{translate("mainActivityContent", language)}</h3>
            <p>
              {translate("activityItemTrash", language)}
              <br />
              {translate("activityItemStones", language)}
              <br />
              {translate("activityItemCleaning", language)}
            </p>
            <p>{translate("eventQuestionHint", language)}</p>
          </section>
          <section>
            <h2>{translate("eventNotes", language)}</h2>
          </section>
        </article>
        <footer className="event-detail__footer">
          <button
            className={`event-detail__apply ${isParticipated ? "event-detail__apply--disabled" : ""}`}
            type="button"
            onClick={() => onApply(event)}
            disabled={isParticipated}
          >
            {isParticipated ? translate("eventAlreadyApplied", language) : translate("applyEvent", language)}
          </button>
          <button className="event-detail__like" type="button" onClick={() => onLike(event)} aria-pressed={event.liked}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M8 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h4" />
              <path d="M8 11l4-8 1.5 1.5a3 3 0 0 1 .8 2.7L14 9h5.2a2 2 0 0 1 2 2.3l-1.2 7A3.2 3.2 0 0 1 16.8 21H8V11Z" />
            </svg>
            <small>{translate("likeAction", language)}</small>
          </button>
        </footer>
      </section>
    </div>
  );
}

function EventCard({
  event,
  compact = false,
  language = "ja",
  onSelect,
}: {
  event: DisplayEvent;
  compact?: boolean;
  language?: AppLanguage;
  onSelect?: (event: DisplayEvent) => void;
}) {
  const imageUrl = event.imageUrl || DUMMY_EVENT_IMAGE_URL;

  function handleKeyDown(keyboardEvent: KeyboardEvent<HTMLElement>) {
    if (!onSelect) {
      return;
    }

    if (keyboardEvent.key === "Enter" || keyboardEvent.key === " ") {
      keyboardEvent.preventDefault();
      onSelect(event);
    }
  }

  return (
    <article
      className={`event-card ${compact ? "event-card--compact" : ""}`}
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect ? () => onSelect(event) : undefined}
      onKeyDown={handleKeyDown}
    >
      <p className="event-card__date">{event.date}</p>
      <div className="event-card__image">
        <img src={imageUrl} alt={formatTranslation("eventImageAlt", language, { title: event.title })} loading="lazy" />
      </div>
      <div>
        <h3>{event.title}</h3>
        <strong>{event.points}pt</strong>
        {!compact ? (
          <p>
            {translate("meetingPlace", language)}: {event.location}　{translate("meetingTime", language)}: {event.time}
          </p>
        ) : null}
      </div>
    </article>
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

function AdFrame({ language = "ja" }: { language?: AppLanguage }) {
  return <div className="ad-frame">{translate("adFrame", language)}</div>;
}

type WalletHistoryKind = "event" | "charge" | "exchange";

type WalletHistoryDisplayItem = {
  id: string;
  kind: WalletHistoryKind;
  label: string;
  title: string;
  meta: string;
  delta: number;
  date: Date;
};

type WalletHistoryGroup = {
  date: string;
  isoDate: string;
  items: WalletHistoryDisplayItem[];
};

function formatWalletHistoryDate(date: Date) {
  return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;
}

function formatWalletHistoryTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function parseWalletHistoryDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function buildWalletHistoryItems({
  participations,
  transactions,
  purchases,
  language,
}: {
  participations: Participation[];
  transactions: Transaction[];
  purchases: Purchase[];
  language: AppLanguage;
}): WalletHistoryGroup[] {
  const items: WalletHistoryDisplayItem[] = [
    ...participations.map((entry) => {
      const date = parseWalletHistoryDate(entry.participated_at);
      const eventTime = formatDateTimeParts(entry.event_datetime);
      return {
        id: `participation-${entry.participation_id}`,
        kind: "event" as const,
        label: translate("eventHistoryLabel", language),
        title: localizeApiText(entry.event_name, language),
        meta: `${eventTime.date} ${eventTime.time}`,
        delta: entry.granted_points,
        date,
      };
    }),
    ...purchases.map((entry) => {
      const date = parseWalletHistoryDate(entry.created_at);
      return {
        id: `purchase-${entry.purchase_id}`,
        kind: "charge" as const,
        label: translate("chargeHistoryLabel", language),
        title: translate("pointChargeTitle", language),
        meta: `${formatWalletHistoryDate(date)} ${formatWalletHistoryTime(date)}`,
        delta: entry.points,
        date,
      };
    }),
    ...transactions
      .filter((entry) => entry.type === "exchange")
      .map((entry) => {
        const date = parseWalletHistoryDate(entry.created_at);
        return {
          id: `transaction-${entry.transaction_id}`,
          kind: "exchange" as const,
          label: translate("exchangeHistoryLabel", language),
          title: entry.service_name ? localizeApiText(entry.service_name, language) : translate("pointExchangeTitle", language),
          meta: `${formatWalletHistoryDate(date)} ${formatWalletHistoryTime(date)}`,
          delta: -Math.abs(entry.points),
          date,
        };
      }),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  const groups = new Map<string, WalletHistoryGroup>();

  for (const item of items) {
    const date = formatWalletHistoryDate(item.date);
    const group = groups.get(date);

    if (group) {
      group.items.push(item);
      continue;
    }

    groups.set(date, {
      date,
      isoDate: item.date.toISOString(),
      items: [item],
    });
  }

  return [...groups.values()];
}

function BottomNav({ current, language, onNavigate }: { current: Screen; language: AppLanguage; onNavigate: (screen: Screen) => void }) {
  const items = [
    ["home", translate("home", language), <HomeIcon />],
    ["events", translate("events", language), <EventIcon />],
    ["scan", translate("scan", language), <QrIcon />],
    ["wallet", translate("wallet", language), <WalletIcon />],
    ["account", translate("account", language), <AccountIcon />],
  ] as const;

  return (
    <nav className="bottom-nav" aria-label={translate("appMenu", language)}>
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

function ProductMapModal({
  product,
  language,
  currentPoints,
  onExchange,
  onClose,
}: {
  product: ProductItem;
  language: AppLanguage;
  currentPoints: number;
  onExchange: (product: ProductItem) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(product.mapQuery)}&output=embed`;
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(product.mapQuery)}`;
  const swipeDismiss = useSwipeDownDismiss<HTMLElement>(onClose);
  const [confirming, setConfirming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const requiredPoints = product.requiredPoints ?? 0;
  const insufficient = requiredPoints > 0 && currentPoints < requiredPoints;
  const exchangeDisabled = requiredPoints <= 0 || insufficient;

  async function handleExecute() {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setResult(null);
    const next = await onExchange(product);
    setIsSubmitting(false);
    setConfirming(false);
    setResult(next);
  }

  return (
    <div className="product-map-modal" role="presentation" onClick={onClose}>
      <section
        ref={swipeDismiss.ref}
        className={`product-map-sheet ${swipeDismiss.className}`.trim()}
        style={swipeDismiss.style}
        role="dialog"
        aria-modal="true"
        aria-label={`${product.name} ${translate("mapTitle", language)}`}
        onClick={(event) => event.stopPropagation()}
        {...swipeDismiss.handlers}
      >
        <header className="product-map-header">
          <div>
            <p>{translate("mapTitle", language)}</p>
            <h2>{product.name}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={translate("close", language)}>
            ×
          </button>
        </header>
        <dl className="product-map-details">
          <div>
            <dt>{translate("providedBy", language)}</dt>
            <dd>{product.storeName}</dd>
          </div>
          <div>
            <dt>{translate("address", language)}</dt>
            <dd>{product.storeAddress}</dd>
          </div>
          {product.requiredPoints ? (
            <div>
              <dt>{translate("requiredPoints", language)}</dt>
              <dd>{product.requiredPoints}pt</dd>
            </div>
          ) : null}
        </dl>
        <iframe className="product-map-frame" title={`${product.storeName} Google Map`} src={mapUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
        <a className="product-map-link" href={externalMapUrl} target="_blank" rel="noreferrer">
          {translate("openInGoogleMaps", language)}
        </a>
        {result ? (
          <p className={`action-banner ${result.ok ? "action-banner--success" : "action-banner--error"}`} role={result.ok ? "status" : "alert"}>
            {result.message}
          </p>
        ) : null}
        {insufficient ? (
          <p className="action-banner action-banner--error" role="alert">
            {translate("notEnoughPoints", language)} ({currentPoints}pt / {requiredPoints}pt)
          </p>
        ) : null}
        {confirming ? (
          <div className="exchange-confirm">
            <p className="exchange-confirm__title">{translate("exchangeConfirmTitle", language)}</p>
            <p className="exchange-confirm__body">{translate("exchangeConfirmBody", language)}</p>
            <p className="exchange-confirm__detail">
              {product.name} — {product.requiredPoints}pt
            </p>
            <div className="exchange-confirm__actions">
              <button type="button" className="secondary-button" onClick={() => setConfirming(false)} disabled={isSubmitting}>
                {translate("cancel", language)}
              </button>
              <button type="button" className="primary-button" onClick={handleExecute} disabled={isSubmitting}>
                {isSubmitting ? translate("exchanging", language) : translate("exchangeExecute", language)}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="primary-button exchange-cta"
            onClick={() => {
              setResult(null);
              setConfirming(true);
            }}
            disabled={exchangeDisabled || isSubmitting}
          >
            {translate("exchangeCta", language)}
          </button>
        )}
      </section>
    </div>
  );
}
