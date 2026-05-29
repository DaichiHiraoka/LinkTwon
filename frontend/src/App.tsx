import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import {
  ApiError,
  cancelEventParticipation,
  changePassword,
  deleteUser,
  getEvents,
  getLikedEvents,
  getServices,
  getUserHistory,
  getUserProfile,
  getUserSettings,
  likeEvent,
  login,
  participateInEvent,
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
import {
  events as fallbackEvents,
  productCategories as fallbackProductCategories,
  scheduledEvent as fallbackScheduledEvent,
  user as fallbackUser,
  type EventItem,
  type ProductCategory,
  type Screen,
} from "./data/mockData";
import type { AuthResponse, EventItem as ApiEventItem, Participation, ServiceItem, UserProfile, UserSettings } from "./types";

const SESSION_STORAGE_KEY = "link-town-session";

type Session = Pick<AuthResponse, "token" | "user">;
type DisplayEvent = EventItem & {
  rawEventId?: number;
  liked?: boolean;
  likeCount?: number;
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

function mapEvent(event: ApiEventItem, displayDate: string): DisplayEvent {
  const parts = formatDateTimeParts(event.event_datetime, displayDate);
  return {
    id: String(event.event_id),
    date: parts.date,
    title: event.event_name,
    points: event.grant_points,
    location: event.location ?? "未設定",
    time: parts.time,
    rawEventId: event.event_id,
    liked: toBoolean(event.liked),
    likeCount: event.like_count,
  };
}

function mapParticipation(participation: Participation, displayDate: string): DisplayEvent {
  const parts = formatDateTimeParts(participation.event_datetime, displayDate);
  return {
    id: String(participation.event_id),
    date: parts.date,
    title: participation.event_name,
    points: participation.granted_points,
    location: participation.location ?? "未設定",
    time: parts.time,
    rawEventId: participation.event_id,
  };
}

function mapServices(services: ServiceItem[]): ProductCategory[] {
  const grouped = new Map<number, ProductCategory>();

  for (const service of services) {
    const existing = grouped.get(service.store_id);

    if (existing) {
      existing.products.push(service.service_name);
      continue;
    }

    grouped.set(service.store_id, {
      id: String(service.store_id),
      name: service.store_name,
      products: [service.service_name],
    });
  }

  return [...grouped.values()];
}

function getErrorMessage(error: unknown) {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return "処理に失敗しました。";
}

function toBoolean(value: boolean | number | undefined | null) {
  return value === true || value === 1;
}

export function App() {
  const initialSession = readStoredSession();
  const [eventDisplayDate] = useState(getEventDisplayDate);
  const [screen, setScreen] = useState<Screen>(initialSession ? "home" : "login");
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
  const [participatedEventIds, setParticipatedEventIds] = useState<Set<number>>(new Set());
  const [productCategories, setProductCategories] = useState<ProductCategory[]>(fallbackProductCategories);
  const [accountEmail, setAccountEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  useEffect(() => {
    if (session) {
      void loadApplicationData(session);
    }
  }, [session?.token]);

  async function loadApplicationData(currentSession: Session) {
    try {
      const [nextProfile, nextEvents, nextLikedEvents, nextServices, nextSettings, nextHistory] = await Promise.all([
        getUserProfile(currentSession.user.user_id, currentSession.token),
        getEvents(currentSession.token),
        getLikedEvents(currentSession.user.user_id, currentSession.token),
        getServices(currentSession.token),
        getUserSettings(currentSession.user.user_id, currentSession.token),
        getUserHistory(currentSession.user.user_id, currentSession.token),
      ]);

      const mappedEvents = nextEvents.map((event) => mapEvent(event, eventDisplayDate));
      const mappedEventsById = new Map(mappedEvents.flatMap((event) => (event.rawEventId ? [[event.rawEventId, event] as const] : [])));
      const mappedLikedEvents = nextLikedEvents.map((event) => mapEvent(event, eventDisplayDate));
      const mappedLikedEventsById = new Map(mappedLikedEvents.flatMap((event) => (event.rawEventId ? [[event.rawEventId, event] as const] : [])));
      const mappedParticipatedEvents = nextHistory.participations.map((participation) => {
        return mappedEventsById.get(participation.event_id) ?? mappedLikedEventsById.get(participation.event_id) ?? mapParticipation(participation, eventDisplayDate);
      });
      setProfile(nextProfile);
      setSettings(nextSettings);
      setAccountEmail(nextProfile.email);
      setRecommendedEvents(mappedEvents.length > 0 ? mappedEvents : fallbackEvents.map((event) => withEventDisplayDate(event, eventDisplayDate)));
      setLikedEvents(mappedLikedEvents);
      setParticipatedEvents(mappedParticipatedEvents);
      setScheduledEvent(mappedParticipatedEvents[0] ?? mappedEvents[0] ?? withEventDisplayDate(fallbackScheduledEvent, eventDisplayDate));
      setParticipatedEventIds(new Set(nextHistory.participations.map((participation) => participation.event_id)));
      setProductCategories(nextServices.length > 0 ? mapServices(nextServices) : fallbackProductCategories);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        setSession(null);
        writeStoredSession(null);
        setScreen("login");
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
    try {
      const response = await login(email || "demo@example.com", password || "password123");
      const nextSession = { token: response.token, user: response.user };
      handleSession(nextSession);
      setScreen("home");
      await loadApplicationData(nextSession);
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  }

  function handleLogout() {
    handleSession(null);
    setProfile(null);
    setScreen("login");
  }

  function openEventDetail(event: DisplayEvent) {
    setSelectedEvent(event);
  }

  async function handleApplyToEvent(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      window.alert("このイベントは現在応募できません。");
      return;
    }

    if (participatedEventIds.has(event.rawEventId)) {
      return;
    }

    try {
      await participateInEvent(event.rawEventId, session.token);
      setParticipatedEventIds((current) => new Set(current).add(event.rawEventId!));
      await loadApplicationData(session);
      window.alert("イベントに応募しました。");
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  }

  async function handleCancelParticipation(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      window.alert("このイベントは現在キャンセルできません。");
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
    } catch (error) {
      window.alert(getErrorMessage(error));
    }
  }

  async function handleToggleEventLike(event: DisplayEvent) {
    if (!session || !event.rawEventId) {
      window.alert("このイベントは現在いいねできません。");
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
      window.alert(getErrorMessage(error));
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

      setAccountMessage("アカウント設定を保存しました。");
      await loadApplicationData(session);
    } catch (error) {
      setAccountMessage(getErrorMessage(error));
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
      setAccountMessage("パスワードを変更しました。");
    } catch (error) {
      setAccountMessage(getErrorMessage(error));
    }
  }

  async function handleDeleteAccount() {
    if (!session || !profile || !window.confirm("アカウントを削除します。よろしいですか？")) {
      return;
    }

    try {
      await deleteUser(profile.user_id, session.token);
      handleLogout();
    } catch (error) {
      setAccountMessage(getErrorMessage(error));
    }
  }

  const displayUser = {
    accountType: profile?.user_type || fallbackUser.accountType,
    userId: profile ? String(profile.user_id) : fallbackUser.userId,
    email: profile?.email || fallbackUser.email,
    homePoints: profile?.points ?? fallbackUser.homePoints,
    walletPoints: profile?.points ?? fallbackUser.walletPoints,
  };

  return (
    <main className="app-viewport">
      <section className="phone-shell">
        <div className={`phone-scroll ${screen !== "login" ? "phone-scroll--nav" : ""}`}>
          {screen === "login" ? <LoginScreen onLogin={handleLogin} /> : null}
          {screen === "home" ? (
            <HomeScreen
              user={displayUser}
              events={recommendedEvents}
              scheduledEvent={scheduledEvent}
              onNavigate={setScreen}
              onEventSelect={openEventDetail}
            />
          ) : null}
          {screen === "events" ? (
            <EventsScreen
              tab={eventTab}
              events={recommendedEvents}
              likedEvents={likedEvents}
              participatedEvents={participatedEvents}
              onTabChange={setEventTab}
              onEventSelect={openEventDetail}
              onCancelParticipation={handleCancelParticipation}
            />
          ) : null}
          {screen === "scan" ? <ScanScreen onHome={() => setScreen("home")} /> : null}
          {screen === "wallet" ? (
            <WalletScreen
              tab={exchangeTab}
              user={displayUser}
              productCategories={productCategories}
              onTabChange={setExchangeTab}
              onPurchase={() => setScreen("purchase")}
            />
          ) : null}
          {screen === "purchase" ? <PurchaseScreen points={displayUser.walletPoints} /> : null}
          {screen === "account" ? (
            <AccountScreen
              user={displayUser}
              settings={settings}
              accountEmail={accountEmail}
              currentPassword={currentPassword}
              newPassword={newPassword}
              message={accountMessage}
              onEmailChange={setAccountEmail}
              onCurrentPasswordChange={setCurrentPassword}
              onNewPasswordChange={setNewPassword}
              onSettingsChange={setSettings}
              onSaveAccount={handleSaveAccount}
              onChangePassword={handleChangePassword}
              onDeleteAccount={handleDeleteAccount}
              onLogout={handleLogout}
            />
          ) : null}
        </div>
        {screen !== "login" ? <BottomNav current={screen} onNavigate={setScreen} /> : null}
        {selectedEvent ? (
          <EventDetailScreen
            event={selectedEvent}
            isParticipated={selectedEvent.rawEventId ? participatedEventIds.has(selectedEvent.rawEventId) : false}
            onApply={handleApplyToEvent}
            onLike={handleToggleEventLike}
            onClose={() => setSelectedEvent(null)}
          />
        ) : null}
      </section>
    </main>
  );
}

function Header({ help = false }: { help?: boolean }) {
  return (
    <header className="app-header">
      <Logo />
      <button type="button" className="icon-button" aria-label={help ? "ヘルプ" : "メール"}>
        {help ? <HelpIcon /> : <MailIcon />}
      </button>
    </header>
  );
}

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const emailRef = useRef<HTMLInputElement | null>(null);
  const passwordRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="login-screen">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin(emailRef.current?.value.trim() ?? "", passwordRef.current?.value ?? "");
        }}
      >
        <Logo small />
        <h1>ログイン</h1>
        <input ref={emailRef} aria-label="IDまたはメールアドレス" />
        <input ref={passwordRef} aria-label="パスワード" type="password" placeholder="パスワード" />
        <button className="text-link" type="button">
          パスワードを忘れた場合
        </button>
        <button className="primary-button" type="submit">
          続ける
        </button>
      </form>
      <footer className="login-footer">
        <a href="#">プライバシーポリシー</a>
        <a href="#">利用規約</a>
        <a href="#">会員規約</a>
      </footer>
    </section>
  );
}

function HomeScreen({
  user,
  events,
  scheduledEvent,
  onNavigate,
  onEventSelect,
}: {
  user: typeof fallbackUser;
  events: DisplayEvent[];
  scheduledEvent: DisplayEvent;
  onNavigate: (screen: Screen) => void;
  onEventSelect: (event: DisplayEvent) => void;
}) {
  return (
    <section>
      <Header />
      <article className="points-card points-card--home">
        <div className="points-card__row">
          <span>ポイント残高</span>
          <strong>
            {user.homePoints}
            <small>pt</small>
          </strong>
          <ArrowIcon />
        </div>
        <div className="points-card__actions">
          <button type="button" onClick={() => onNavigate("events")}>
            開催イベント一覧
          </button>
          <button type="button" onClick={() => onNavigate("purchase")}>
            ポイント購入
          </button>
          <button type="button" onClick={() => onNavigate("wallet")}>
            ポイント交換所
          </button>
        </div>
      </article>

      <section className="section">
        <SectionHeading>参加予定のイベント</SectionHeading>
        <EventCard event={scheduledEvent} compact onSelect={onEventSelect} />
      </section>
      <section className="section">
        <SectionHeading>あなたにおすすめのイベント</SectionHeading>
        <div className="event-rail">
          {events.map((event) => (
            <EventCard key={event.id} event={event} compact onSelect={onEventSelect} />
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
  onTabChange,
  onEventSelect,
  onCancelParticipation,
}: {
  tab: "recommended" | "liked" | "participated";
  events: DisplayEvent[];
  likedEvents: DisplayEvent[];
  participatedEvents: DisplayEvent[];
  onTabChange: (tab: "recommended" | "liked" | "participated") => void;
  onEventSelect: (event: DisplayEvent) => void;
  onCancelParticipation: (event: DisplayEvent) => void;
}) {
  const visibleEvents = tab === "recommended" ? events : tab === "liked" ? likedEvents : participatedEvents;

  return (
    <section>
      <Header />
      <Tabs
        value={tab}
        items={[
          ["recommended", "おすすめ"],
          ["liked", "いいねしたイベント"],
          ["participated", "応募済みイベント"],
        ]}
        onChange={onTabChange}
      />
      <AdFrame />
      <div className="event-list">
        {visibleEvents.length === 0 ? <p className="event-empty-message">表示できるイベントはありません。</p> : null}
        {visibleEvents.map((event) =>
          tab === "participated" ? (
            <div className="event-list__item" key={event.id}>
              <EventCard event={event} onSelect={onEventSelect} />
              <button className="event-cancel-button" type="button" onClick={() => onCancelParticipation(event)}>
                応募をキャンセル
              </button>
            </div>
          ) : (
            <EventCard key={event.id} event={event} onSelect={onEventSelect} />
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
  onTabChange,
  onPurchase,
}: {
  tab: "recommended" | "favorite";
  user: typeof fallbackUser;
  productCategories: ProductCategory[];
  onTabChange: (tab: "recommended" | "favorite") => void;
  onPurchase: () => void;
}) {
  const visibleCategories = tab === "recommended" ? productCategories : productCategories.slice(0, 1);

  return (
    <section>
      <Header />
      <section className="section section--tight">
        <h1 className="screen-title screen-title--center">ポイント残高</h1>
        <article className="points-card points-card--wallet">
          <span>現在の利用可能ポイント</span>
          <strong>{user.walletPoints}pt</strong>
          <button type="button" onClick={onPurchase}>
            ポイント購入画面へ
          </button>
        </article>
      </section>
      <section className="section">
        <h2 className="screen-title">ポイント交換</h2>
        <Tabs
          value={tab}
          items={[
            ["recommended", "おすすめ"],
            ["favorite", "お気に入り"],
          ]}
          onChange={onTabChange}
        />
        <div className="product-stack">
          {visibleCategories.map((category) => (
            <section key={category.id}>
              <SectionHeading>{category.name}</SectionHeading>
              <div className="product-rail">
                {category.products.map((product) => (
                  <article className="product-card" key={product}>
                    <div />
                    <span>{product}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </section>
  );
}

function PurchaseScreen({ points }: { points: number }) {
  return (
    <section>
      <Header help />
      <article className="purchase-summary">
        <span>現在の利用可能ポイント</span>
        <strong>{points}pt</strong>
        <dl>
          <div>
            <dt>購入ポイント</dt>
            <dd>500 pt</dd>
          </div>
          <div>
            <dt>支払い金額</dt>
            <dd>500 円</dd>
          </div>
          <div>
            <dt>合計利用可能ポイント</dt>
            <dd>{points + 500} pt</dd>
          </div>
        </dl>
      </article>
      <section className="section">
        <article className="payment-method">
          <span className="payment-method__avatar" />
          <p>
            〇〇銀行　△△支店
            <br />
            普通預金　XXXXXXX
          </p>
          <ArrowIcon />
        </article>
      </section>
      <div className="purchase-ad">
        <AdFrame />
      </div>
    </section>
  );
}

function AccountScreen({
  user,
  settings,
  accountEmail,
  currentPassword,
  newPassword,
  message,
  onEmailChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onSettingsChange,
  onSaveAccount,
  onChangePassword,
  onDeleteAccount,
  onLogout,
}: {
  user: typeof fallbackUser;
  settings: UserSettings | null;
  accountEmail: string;
  currentPassword: string;
  newPassword: string;
  message: string;
  onEmailChange: (value: string) => void;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onSettingsChange: (settings: UserSettings) => void;
  onSaveAccount: (event: FormEvent) => void;
  onChangePassword: (event: FormEvent) => void;
  onDeleteAccount: () => void;
  onLogout: () => void;
}) {
  return (
    <section>
      <Header />
      <div className="account-form-list">
        {message ? <p className="account-message">{message}</p> : null}
        <section className="account-form-section">
          <h2>アカウント</h2>
          <div className="account-info-row">
            <span>アカウント区分</span>
            <strong>{user.accountType}</strong>
          </div>
          <div className="account-info-row">
            <span>ユーザーID</span>
            <strong>{user.userId}</strong>
          </div>
          <form onSubmit={onSaveAccount}>
            <label className="account-field">
              <span>メールアドレス設定</span>
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
                  <span>通知設定</span>
                </label>
                <label className="account-field">
                  <span>言語設定</span>
                  <select value={settings.language} onChange={(event) => onSettingsChange({ ...settings, language: event.target.value })}>
                    <option value="ja">日本語</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <label className="account-field">
                  <span>文字サイズの変更</span>
                  <select
                    value={settings.font_size}
                    onChange={(event) => onSettingsChange({ ...settings, font_size: event.target.value as UserSettings["font_size"] })}
                  >
                    <option value="small">小</option>
                    <option value="medium">中</option>
                    <option value="large">大</option>
                  </select>
                </label>
              </>
            ) : null}
            <button className="account-action-button" type="submit">
              設定を保存
            </button>
          </form>
        </section>

        <section className="account-form-section">
          <h2>セキュリティ</h2>
          <form onSubmit={onChangePassword}>
            <label className="account-field">
              <span>現在のパスワード</span>
              <input type="password" value={currentPassword} onChange={(event) => onCurrentPasswordChange(event.target.value)} />
            </label>
            <label className="account-field">
              <span>新しいパスワード</span>
              <input type="password" value={newPassword} onChange={(event) => onNewPasswordChange(event.target.value)} />
            </label>
            <button className="account-action-button" type="submit">
              パスワード変更
            </button>
          </form>
        </section>

        <section className="account-form-section">
          <h2>その他</h2>
          <button className="settings-row" type="button" onClick={onLogout}>
            <span>ログアウト</span>
          </button>
          <button className="settings-row settings-row--danger" type="button" onClick={onDeleteAccount}>
            <span>アカウントの削除</span>
          </button>
        </section>
      </div>
    </section>
  );
}

function ScanScreen({ onHome }: { onHome: () => void }) {
  return (
    <section className="scan-screen">
      <div className="scan-screen__center">
        <span className="scan-check">
          <CheckIcon />
        </span>
        <h1>読み取りを完了しました</h1>
      </div>
      <button className="primary-button scan-screen__button" type="button" onClick={onHome}>
        ホームに戻る
      </button>
    </section>
  );
}

function EventDetailScreen({
  event,
  isParticipated,
  onApply,
  onLike,
  onClose,
}: {
  event: DisplayEvent;
  isParticipated: boolean;
  onApply: (event: DisplayEvent) => void;
  onLike: (event: DisplayEvent) => void;
  onClose: () => void;
}) {
  return (
    <div className="event-detail-modal" role="presentation" onClick={onClose}>
      <section className="event-detail-screen" role="dialog" aria-modal="true" aria-label={event.title} onClick={(clickEvent) => clickEvent.stopPropagation()}>
        <Header />
        <p className="event-detail__date">{event.date}</p>
        <div className="event-detail__photo">写真</div>
        <article className="event-detail__body">
          <h1>{event.title}</h1>
          <p className="event-detail__meta">活動時間：{event.time}　　集合場所：{event.location}　　△△係前</p>
          <div className="event-detail__status">
            <span>あと0時間〇〇分で締め切り</span>
            <strong>現在の募集人数　〇人</strong>
          </div>
          <strong className="event-detail__points">{event.points}pt</strong>
          <section>
            <h2>活動内容</h2>
            <h3>主な活動内容</h3>
            <p>
              ・公園内のゴミ拾い
              <br />
              ・大きな石などの撤去作業
              <br />
              ・動物の糞などの清掃作業
            </p>
            <p>不明点がありましたら、管理の方に遠慮なく聞いてください。</p>
          </section>
          <section>
            <h2>注意事項</h2>
          </section>
        </article>
        <footer className="event-detail__footer">
          <button
            className={`event-detail__apply ${isParticipated ? "event-detail__apply--disabled" : ""}`}
            type="button"
            onClick={() => onApply(event)}
            disabled={isParticipated}
          >
            {isParticipated ? "応募済みのイベントです" : "このイベントに応募する"}
          </button>
          <button className="event-detail__like" type="button" onClick={() => onLike(event)} aria-pressed={event.liked}>
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M8 21H4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1h4" />
              <path d="M8 11l4-8 1.5 1.5a3 3 0 0 1 .8 2.7L14 9h5.2a2 2 0 0 1 2 2.3l-1.2 7A3.2 3.2 0 0 1 16.8 21H8V11Z" />
            </svg>
            <small>いいね！</small>
          </button>
        </footer>
      </section>
    </div>
  );
}

function EventCard({
  event,
  compact = false,
  onSelect,
}: {
  event: DisplayEvent;
  compact?: boolean;
  onSelect?: (event: DisplayEvent) => void;
}) {
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
      <div className="event-card__image" />
      <div>
        <h3>{event.title}</h3>
        <strong>{event.points}pt</strong>
        {!compact ? <p>集合場所：{event.location}　集合時間：{event.time}</p> : null}
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

function AdFrame() {
  return <div className="ad-frame">広告掲載フレーム</div>;
}

function BottomNav({ current, onNavigate }: { current: Screen; onNavigate: (screen: Screen) => void }) {
  const items = [
    ["home", "ホーム", <HomeIcon />],
    ["events", "イベント", <EventIcon />],
    ["scan", "読み取る", <QrIcon />],
    ["wallet", "ウォレット", <WalletIcon />],
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
