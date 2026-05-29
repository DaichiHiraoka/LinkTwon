import { useEffect, useState } from "react";
import {
  ApiError,
  exchangePoints,
  getEvents,
  getServices,
  getUserHistory,
  getUserProfile,
  login,
  participateInEvent,
  register,
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
  AuthResponse,
  EventItem as ApiEventItem,
  EventTab,
  ExchangeTab,
  Participation,
  Screen,
  ServiceItem,
  Transaction,
  UserHistory,
  UserProfile,
} from "./types";

const SESSION_STORAGE_KEY = "link-town-session";

type AuthMode = "login" | "register";
type Session = Pick<AuthResponse, "token" | "user">;

type NoticeState = {
  kind: "info" | "success" | "error";
  title: string;
  message: string;
} | null;

type EventCardModel = {
  id: string;
  date: string;
  title: string;
  points: number;
  location: string;
  time: string;
  actionLabel?: string;
  helperText?: string;
  onAction?: () => void;
  isBusy?: boolean;
};

type ServiceGroup = {
  id: string;
  name: string;
  services: ServiceItem[];
};

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  meta: string;
  tone?: "default" | "success" | "warning";
};

function readStoredSession(): Session | null {
  const rawValue = window.localStorage.getItem(SESSION_STORAGE_KEY);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as Session;
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

function mapEventToCard(event: ApiEventItem, onAction?: () => void, isBusy = false): EventCardModel {
  const parts = formatDateTimeParts(event.event_datetime);
  return {
    id: `event-${event.event_id}`,
    date: parts.date,
    title: event.event_name,
    points: event.grant_points,
    location: event.location ?? "未設定",
    time: parts.time,
    actionLabel: onAction ? "参加登録" : undefined,
    helperText: onAction ? "仮実装: カード操作で backend に参加登録" : undefined,
    onAction,
    isBusy,
  };
}

function mapParticipationToCard(participation: Participation): EventCardModel {
  const parts = formatDateTimeParts(participation.event_datetime);
  return {
    id: `participation-${participation.participation_id}`,
    date: parts.date,
    title: participation.event_name,
    points: participation.granted_points,
    location: participation.location ?? "未設定",
    time: parts.time,
    helperText: `参加記録: ${formatDateTime(participation.participated_at)}`,
  };
}

function mapTransactionToActivity(transaction: Transaction): ActivityItem {
  return {
    id: `transaction-${transaction.transaction_id}`,
    label: transaction.service_name ?? transaction.type,
    detail: transaction.description ?? "説明なし",
    meta: `${transaction.points}pt / ${formatDateTime(transaction.created_at)}`,
    tone: transaction.type === "exchange" ? "warning" : "success",
  };
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

export function App() {
  const [screen, setScreen] = useState<Screen>(() => (readStoredSession() ? "home" : "login"));
  const [eventTab, setEventTab] = useState<EventTab>("recommended");
  const [exchangeTab, setExchangeTab] = useState<ExchangeTab>("services");
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [events, setEvents] = useState<ApiEventItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [history, setHistory] = useState<UserHistory>({ participations: [], transactions: [] });
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerAgeGroup, setRegisterAgeGroup] = useState("");
  const [registerUserType, setRegisterUserType] = useState("general");
  const [isLoading, setIsLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeState>({
    kind: "info",
    title: "仮実装フロントエンド",
    message: "後続のUI設計図に差し替える前提で、機能確認用の暫定画面を表示しています。",
  });

  async function reloadData(activeSession: Session, silent = false) {
    if (!silent) {
      setIsLoading(true);
    }

    try {
      const [nextProfile, nextEvents, nextServices, nextHistory] = await Promise.all([
        getUserProfile(activeSession.user.user_id, activeSession.token),
        getEvents(activeSession.token),
        getServices(activeSession.token),
        getUserHistory(activeSession.user.user_id, activeSession.token),
      ]);

      setProfile(nextProfile);
      setEvents(nextEvents);
      setServices(nextServices);
      setHistory(nextHistory);
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!session) {
      writeStoredSession(null);
      setProfile(null);
      setEvents([]);
      setServices([]);
      setHistory({ participations: [], transactions: [] });
      return;
    }

    writeStoredSession(session);
    let cancelled = false;

    reloadData(session)
      .catch((error) => {
        if (!cancelled) {
          setNotice({
            kind: "error",
            title: "データ取得に失敗しました",
            message: getErrorMessage(error),
          });

          if (error instanceof ApiError && error.status === 401) {
            writeStoredSession(null);
            setSession(null);
            setScreen("login");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  const currentPoints = profile?.points ?? session?.user.points ?? 0;
  const recommendedEventCards = events
    .slice(0, 3)
    .map((event) => mapEventToCard(event, () => setScreen("events"), false));
  const nextParticipation = history.participations[0] ? mapParticipationToCard(history.participations[0]) : null;
  const participatedEventIds = new Set(history.participations.map((item) => item.event_id));
  const visibleEventCards =
    eventTab === "recommended"
      ? events.map((event) =>
          mapEventToCard(event, () => void handleParticipate(event.event_id), busyAction === `event-${event.event_id}`),
        )
      : history.participations.map(mapParticipationToCard);
  const visibleServices =
    exchangeTab === "services"
      ? services
      : services.filter((service) =>
          history.transactions.some((item) => item.type === "exchange" && item.service_id === service.service_id),
        );
  const serviceGroups = groupServicesByStore(visibleServices);
  const exchangeHistory = history.transactions.filter((item) => item.type === "exchange");
  const activityFeed = history.transactions.slice(0, 4).map(mapTransactionToActivity);

  async function handleLogin() {
    if (!loginEmail || !loginPassword) {
      setNotice({
        kind: "error",
        title: "入力不足",
        message: "メールアドレスとパスワードを入力してください。",
      });
      return;
    }

    setBusyAction("login");

    try {
      const auth = await login(loginEmail, loginPassword);
      setSession({ token: auth.token, user: auth.user });
      setScreen("home");
      setNotice({
        kind: "success",
        title: "ログイン完了",
        message: "backend からユーザー情報を取得し、暫定UIを有効化しました。",
      });
      setLoginPassword("");
    } catch (error) {
      setNotice({
        kind: "error",
        title: "ログイン失敗",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRegister() {
    if (!registerName || !registerEmail || !registerPassword) {
      setNotice({
        kind: "error",
        title: "入力不足",
        message: "登録には名前、メールアドレス、パスワードが必要です。",
      });
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
      setSession({ token: auth.token, user: auth.user });
      setScreen("home");
      setAuthMode("login");
      setRegisterName("");
      setRegisterEmail("");
      setRegisterPassword("");
      setRegisterAgeGroup("");
      setRegisterUserType("general");
      setNotice({
        kind: "success",
        title: "ユーザー登録完了",
        message: "登録後に自動ログインし、backend 連携済みの暫定画面へ遷移しました。",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        title: "ユーザー登録失敗",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleParticipate(eventId: number) {
    if (!session) {
      return;
    }

    setBusyAction(`event-${eventId}`);

    try {
      const result = await participateInEvent(eventId, session.token);
      await reloadData(session, true);
      setNotice({
        kind: "success",
        title: "参加登録完了",
        message: `${result.message} 現在のポイント: ${result.current_points}pt`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        title: "参加登録失敗",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleExchange(serviceId: number) {
    if (!session) {
      return;
    }

    setBusyAction(`service-${serviceId}`);

    try {
      const result = await exchangePoints(serviceId, session.token);
      await reloadData(session, true);
      setNotice({
        kind: "success",
        title: "ポイント交換完了",
        message: `${result.message} 現在のポイント: ${result.current_points}pt`,
      });
    } catch (error) {
      setNotice({
        kind: "error",
        title: "ポイント交換失敗",
        message: getErrorMessage(error),
      });
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRefresh() {
    if (!session) {
      return;
    }

    try {
      await reloadData(session);
      setNotice({
        kind: "info",
        title: "データ再取得",
        message: "backend から最新データを再読み込みしました。",
      });
    } catch (error) {
      setNotice({
        kind: "error",
        title: "再取得失敗",
        message: getErrorMessage(error),
      });
    }
  }

  function handleLogout() {
    setSession(null);
    setScreen("login");
    setLoginPassword("");
    setNotice({
      kind: "info",
      title: "ログアウト",
      message: "ローカルセッションを破棄しました。",
    });
  }

  return (
    <main className="app-viewport app-viewport--provisional">
      <section className="phone-shell phone-shell--provisional">
        <div className="provisional-banner">
          <span>TEMP BUILD</span>
          <small>backend 接続確認用 / 正式UI差し替え前</small>
        </div>
        {notice ? <NoticeBar notice={notice} onClose={() => setNotice(null)} /> : null}
        <div className={`phone-scroll ${screen !== "login" ? "phone-scroll--nav" : ""}`}>
          {screen === "login" ? (
            <LoginScreen
              authMode={authMode}
              busyAction={busyAction}
              loginEmail={loginEmail}
              loginPassword={loginPassword}
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
              registerAgeGroup={registerAgeGroup}
              registerEmail={registerEmail}
              registerName={registerName}
              registerPassword={registerPassword}
              registerUserType={registerUserType}
            />
          ) : null}
          {screen === "home" ? (
            <HomeScreen
              activityFeed={activityFeed}
              eventCount={events.length}
              exchangeCount={exchangeHistory.length}
              isLoading={isLoading}
              nextParticipation={nextParticipation}
              onNavigate={setScreen}
              onRefresh={() => void handleRefresh()}
              participatedCount={participatedEventIds.size}
              points={currentPoints}
              profile={profile}
              recommendedEvents={recommendedEventCards}
            />
          ) : null}
          {screen === "events" ? (
            <EventsScreen
              events={visibleEventCards}
              isLoading={isLoading}
              tab={eventTab}
              onTabChange={setEventTab}
            />
          ) : null}
          {screen === "scan" ? <ScanScreen onHome={() => setScreen("home")} /> : null}
          {screen === "wallet" ? (
            <WalletScreen
              busyAction={busyAction}
              exchangeHistory={exchangeHistory}
              groups={serviceGroups}
              isLoading={isLoading}
              onExchange={(serviceId) => void handleExchange(serviceId)}
              onPurchase={() => setScreen("purchase")}
              points={currentPoints}
              tab={exchangeTab}
              onTabChange={setExchangeTab}
            />
          ) : null}
          {screen === "purchase" ? <PurchaseScreen points={currentPoints} /> : null}
          {screen === "account" ? <AccountScreen onLogout={handleLogout} profile={profile} session={session} /> : null}
        </div>
        {screen !== "login" ? <BottomNav current={screen} onNavigate={setScreen} /> : null}
      </section>
    </main>
  );
}

function Header({ help = false }: { help?: boolean }) {
  return (
    <header className="app-header">
      <Logo />
      <div className="header-actions">
        <span className="draft-chip">仮</span>
        <button type="button" className="icon-button" aria-label={help ? "ヘルプ" : "メール"}>
          {help ? <HelpIcon /> : <MailIcon />}
        </button>
      </div>
    </header>
  );
}

function LoginScreen({
  authMode,
  busyAction,
  loginEmail,
  loginPassword,
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
  registerAgeGroup,
  registerEmail,
  registerName,
  registerPassword,
  registerUserType,
}: {
  authMode: AuthMode;
  busyAction: string | null;
  loginEmail: string;
  loginPassword: string;
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
  registerAgeGroup: string;
  registerEmail: string;
  registerName: string;
  registerPassword: string;
  registerUserType: string;
}) {
  const isLogin = authMode === "login";

  return (
    <section className="login-screen">
      <form
        className="login-card login-card--provisional"
        onSubmit={(event) => {
          event.preventDefault();
          if (isLogin) {
            onLogin();
          } else {
            onRegister();
          }
        }}
      >
        <Logo small />
        <div className="panel-note">
          <strong>検証用認証UI</strong>
          <span>正式UI前のため、フォーム項目と文言は仮です。</span>
        </div>
        <div className="auth-toggle">
          <button
            className={isLogin ? "auth-toggle__button auth-toggle__button--active" : "auth-toggle__button"}
            type="button"
            onClick={() => onAuthModeChange("login")}
          >
            ログイン
          </button>
          <button
            className={!isLogin ? "auth-toggle__button auth-toggle__button--active" : "auth-toggle__button"}
            type="button"
            onClick={() => onAuthModeChange("register")}
          >
            新規登録
          </button>
        </div>

        {isLogin ? (
          <>
            <h1>ログイン</h1>
            <input aria-label="メールアドレス" placeholder="メールアドレス" value={loginEmail} onChange={(event) => onLoginEmailChange(event.target.value)} />
            <input
              aria-label="パスワード"
              type="password"
              placeholder="パスワード"
              value={loginPassword}
              onChange={(event) => onLoginPasswordChange(event.target.value)}
            />
            <div className="demo-credential">
              <span>検証用</span>
              <code>demo@example.com / password123</code>
            </div>
            <button className="primary-button primary-button--provisional" type="submit" disabled={busyAction === "login"}>
              {busyAction === "login" ? "ログイン中..." : "backend にログイン"}
            </button>
          </>
        ) : (
          <>
            <h1>新規登録</h1>
            <input aria-label="名前" placeholder="名前" value={registerName} onChange={(event) => onRegisterNameChange(event.target.value)} />
            <input aria-label="メールアドレス" placeholder="メールアドレス" value={registerEmail} onChange={(event) => onRegisterEmailChange(event.target.value)} />
            <input
              aria-label="パスワード"
              type="password"
              placeholder="パスワード"
              value={registerPassword}
              onChange={(event) => onRegisterPasswordChange(event.target.value)}
            />
            <input
              aria-label="年代"
              placeholder="年代 例: 30s"
              value={registerAgeGroup}
              onChange={(event) => onRegisterAgeGroupChange(event.target.value)}
            />
            <select aria-label="ユーザー区分" value={registerUserType} onChange={(event) => onRegisterUserTypeChange(event.target.value)}>
              <option value="general">general</option>
              <option value="resident">resident</option>
              <option value="volunteer">volunteer</option>
            </select>
            <button className="primary-button primary-button--provisional" type="submit" disabled={busyAction === "register"}>
              {busyAction === "register" ? "登録中..." : "backend にユーザー登録"}
            </button>
          </>
        )}
      </form>
      <footer className="login-footer login-footer--provisional">
        <a href="#">プライバシーポリシー</a>
        <a href="#">利用規約</a>
        <a href="#">会員規約</a>
      </footer>
    </section>
  );
}

function HomeScreen({
  activityFeed,
  eventCount,
  exchangeCount,
  isLoading,
  nextParticipation,
  onNavigate,
  onRefresh,
  participatedCount,
  points,
  profile,
  recommendedEvents,
}: {
  activityFeed: ActivityItem[];
  eventCount: number;
  exchangeCount: number;
  isLoading: boolean;
  nextParticipation: EventCardModel | null;
  onNavigate: (screen: Screen) => void;
  onRefresh: () => void;
  participatedCount: number;
  points: number;
  profile: UserProfile | null;
  recommendedEvents: EventCardModel[];
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="status-panel">
          <div>
            <strong>backend 連携状況</strong>
            <p>ポイント・履歴・交換候補を API から取得しています。</p>
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
        <div className="points-card__actions">
          <button type="button" onClick={() => onNavigate("events")}>
            イベント
          </button>
          <button type="button" onClick={() => onNavigate("purchase")}>
            未対応機能
          </button>
          <button type="button" onClick={() => onNavigate("wallet")}>
            ポイント交換
          </button>
        </div>
      </article>

      <section className="section">
        <div className="summary-grid">
          <article className="summary-card">
            <span>参加済み</span>
            <strong>{participatedCount}件</strong>
          </article>
          <article className="summary-card">
            <span>交換済み</span>
            <strong>{exchangeCount}件</strong>
          </article>
          <article className="summary-card">
            <span>公開イベント</span>
            <strong>{eventCount}件</strong>
          </article>
        </div>
      </section>

      <section className="section">
        <SectionHeading>直近の参加イベント</SectionHeading>
        {nextParticipation ? <EventCard event={nextParticipation} compact /> : <EmptyState text="まだ参加履歴がありません。" />}
      </section>

      <section className="section">
        <SectionHeading>おすすめイベント</SectionHeading>
        <div className="event-rail">
          {recommendedEvents.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>

      <section className="section">
        <SectionHeading>直近の取引ログ</SectionHeading>
        <ActivityList items={activityFeed} emptyText="まだポイント取引がありません。" />
      </section>

      <section className="section section--last">
        <div className="profile-box">
          <strong>現在のユーザー</strong>
          <p>{profile ? `${profile.name} / ${formatUserType(profile.user_type)} / ${profile.email}` : "未取得"}</p>
          {isLoading ? <small>データを読み込んでいます。</small> : null}
        </div>
      </section>
    </section>
  );
}

function EventsScreen({
  events,
  isLoading,
  tab,
  onTabChange,
}: {
  events: EventCardModel[];
  isLoading: boolean;
  tab: EventTab;
  onTabChange: (tab: EventTab) => void;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>イベント検証UI</strong>
          <span>イベント一覧と参加履歴を暫定表示しています。</span>
        </div>
      </section>
      <Tabs
        value={tab}
        items={[
          ["recommended", "イベント一覧"],
          ["history", "参加履歴"],
        ]}
        onChange={onTabChange}
      />
      <AdFrame />
      <div className="event-list">
        {events.length > 0 ? events.map((event) => <EventCard key={event.id} event={event} />) : <EmptyState text="表示できるイベントがありません。" />}
        {isLoading ? <p className="status-text">イベントを読み込んでいます。</p> : null}
      </div>
    </section>
  );
}

function WalletScreen({
  busyAction,
  exchangeHistory,
  groups,
  isLoading,
  onExchange,
  onPurchase,
  points,
  tab,
  onTabChange,
}: {
  busyAction: string | null;
  exchangeHistory: Transaction[];
  groups: ServiceGroup[];
  isLoading: boolean;
  onExchange: (serviceId: number) => void;
  onPurchase: () => void;
  points: number;
  tab: ExchangeTab;
  onTabChange: (tab: ExchangeTab) => void;
}) {
  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>交換検証UI</strong>
          <span>正式な商品UIの前段として、交換対象と交換履歴を暫定表示しています。</span>
        </div>
        <article className="points-card points-card--wallet points-card--provisional">
          <span>現在の利用可能ポイント</span>
          <strong>{points}pt</strong>
          <button type="button" onClick={onPurchase}>
            未対応機能を確認
          </button>
        </article>
      </section>
      <section className="section">
        <h2 className="screen-title">ポイント交換</h2>
        <Tabs
          value={tab}
          items={[
            ["services", "交換候補"],
            ["history", "交換履歴"],
          ]}
          onChange={onTabChange}
        />
        {tab === "services" ? (
          <div className="product-stack">
            {groups.length > 0 ? (
              groups.map((group) => (
                <section key={group.id}>
                  <SectionHeading>{group.name}</SectionHeading>
                  <div className="product-rail">
                    {group.services.map((service) => (
                      <ProductCard
                        key={service.service_id}
                        isBusy={busyAction === `service-${service.service_id}`}
                        label={service.service_name}
                        points={service.required_points}
                        onSelect={() => onExchange(service.service_id)}
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
        ) : (
          <section className="activity-section">
            <ActivityList items={exchangeHistory.map(mapTransactionToActivity)} emptyText="交換履歴はまだありません。" />
          </section>
        )}
      </section>
    </section>
  );
}

function PurchaseScreen({ points }: { points: number }) {
  return (
    <section>
      <Header help />
      <section className="section section--tight">
        <article className="placeholder-panel">
          <span className="placeholder-panel__badge">UNSUPPORTED</span>
          <h1>ポイント購入は未接続です</h1>
          <p>backend に購入 API がないため、この画面は仕様確認用の仮置きです。</p>
          <dl>
            <div>
              <dt>現在ポイント</dt>
              <dd>{points} pt</dd>
            </div>
            <div>
              <dt>状態</dt>
              <dd>frontend 仮表示のみ</dd>
            </div>
          </dl>
        </article>
      </section>
    </section>
  );
}

function AccountScreen({
  onLogout,
  profile,
  session,
}: {
  onLogout: () => void;
  profile: UserProfile | null;
  session: Session | null;
}) {
  const sections = [
    {
      title: "backend 取得情報",
      rows: [
        ["アカウント区分", formatUserType(profile?.user_type)],
        ["ユーザーID", profile ? String(profile.user_id) : "未取得"],
        ["メールアドレス", profile?.email ?? "未取得"],
        ["年代", profile?.age_group ?? "未設定"],
        ["ロール", session?.user.role ?? "未取得"],
      ],
    },
    {
      title: "未実装メニュー",
      rows: [
        ["パスワード変更", "backend 未対応"],
        ["通知設定", "backend 未対応"],
        ["お問い合わせ", "backend 未対応"],
      ],
    },
  ] as const;

  return (
    <section>
      <Header />
      <section className="section section--tight">
        <div className="panel-note">
          <strong>アカウント検証UI</strong>
          <span>取得済み情報と未対応機能を分けて表示しています。</span>
        </div>
      </section>
      <div className="settings-list">
        {sections.map((section) => (
          <section key={section.title} className="settings-section">
            <h2>{section.title}</h2>
            {section.rows.map(([label, value]) => (
              <div key={label} className="settings-row settings-row--static">
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </section>
        ))}
        <section className="settings-section">
          <h2>セッション</h2>
          <button className="settings-row settings-row--action" type="button" onClick={onLogout}>
            <span>ログアウト</span>
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
        <span className="scan-check scan-check--provisional">
          <CheckIcon />
        </span>
        <h1>QR連携は未接続です</h1>
        <p className="scan-note">この画面は導線確認用の仮画面です。backend とは連動していません。</p>
      </div>
      <button className="primary-button primary-button--provisional scan-screen__button" type="button" onClick={onHome}>
        ホームに戻る
      </button>
    </section>
  );
}

function EventCard({ event, compact = false }: { event: EventCardModel; compact?: boolean }) {
  return (
    <article className={`event-card ${compact ? "event-card--compact" : ""} ${event.onAction ? "event-card--interactive" : ""}`}>
      <p className="event-card__date">{event.date}</p>
      <div className="event-card__image" />
      <div>
        <h3>{event.title}</h3>
        <strong>{event.points}pt</strong>
        <p>集合場所：{event.location}　集合時間：{event.time}</p>
        {event.helperText ? <small className="card-helper">{event.helperText}</small> : null}
        {event.onAction ? (
          <button className="card-action" type="button" onClick={event.onAction} disabled={event.isBusy}>
            {event.isBusy ? "処理中..." : event.actionLabel}
          </button>
        ) : null}
      </div>
    </article>
  );
}

function ProductCard({
  isBusy,
  label,
  points,
  onSelect,
}: {
  isBusy: boolean;
  label: string;
  points: number;
  onSelect: () => void;
}) {
  return (
    <article className="product-card product-card--interactive">
      <div />
      <span>{label}</span>
      <strong>{points}pt</strong>
      <button className="card-action" type="button" onClick={onSelect} disabled={isBusy}>
        {isBusy ? "処理中..." : "交換する"}
      </button>
    </article>
  );
}

function ActivityList({ items, emptyText }: { items: ActivityItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <EmptyState text={emptyText} />;
  }

  return (
    <div className="activity-list">
      {items.map((item) => (
        <article key={item.id} className={`activity-item ${item.tone ? `activity-item--${item.tone}` : ""}`}>
          <div>
            <strong>{item.label}</strong>
            <p>{item.detail}</p>
          </div>
          <small>{item.meta}</small>
        </article>
      ))}
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
