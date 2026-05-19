import { useState } from "react";
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
import { events, productCategories, scheduledEvent, user, type EventItem, type Screen } from "./data/mockData";

export function App() {
  const [screen, setScreen] = useState<Screen>("login");
  const [eventTab, setEventTab] = useState<"recommended" | "liked">("recommended");
  const [exchangeTab, setExchangeTab] = useState<"recommended" | "favorite">("recommended");

  return (
    <main className="app-viewport">
      <section className="phone-shell">
        <div className={`phone-scroll ${screen !== "login" ? "phone-scroll--nav" : ""}`}>
          {screen === "login" ? <LoginScreen onLogin={() => setScreen("home")} /> : null}
          {screen === "home" ? <HomeScreen onNavigate={setScreen} /> : null}
          {screen === "events" ? <EventsScreen tab={eventTab} onTabChange={setEventTab} /> : null}
          {screen === "scan" ? <ScanScreen onHome={() => setScreen("home")} /> : null}
          {screen === "wallet" ? (
            <WalletScreen tab={exchangeTab} onTabChange={setExchangeTab} onPurchase={() => setScreen("purchase")} />
          ) : null}
          {screen === "purchase" ? <PurchaseScreen /> : null}
          {screen === "account" ? <AccountScreen /> : null}
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
      <button type="button" className="icon-button" aria-label={help ? "ヘルプ" : "メール"}>
        {help ? <HelpIcon /> : <MailIcon />}
      </button>
    </header>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  return (
    <section className="login-screen">
      <form
        className="login-card"
        onSubmit={(event) => {
          event.preventDefault();
          onLogin();
        }}
      >
        <Logo small />
        <h1>ログイン</h1>
        <input aria-label="IDまたはメールアドレス" />
        <input aria-label="パスワード" type="password" placeholder="パスワード" />
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

function HomeScreen({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
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
        <EventCard event={scheduledEvent} compact />
      </section>
      <section className="section">
        <SectionHeading>あなたにおすすめのイベント</SectionHeading>
        <div className="event-rail">
          {events.map((event) => (
            <EventCard key={event.id} event={event} compact />
          ))}
        </div>
      </section>
    </section>
  );
}

function EventsScreen({
  tab,
  onTabChange,
}: {
  tab: "recommended" | "liked";
  onTabChange: (tab: "recommended" | "liked") => void;
}) {
  const visibleEvents = tab === "recommended" ? events : events.slice(0, 1);

  return (
    <section>
      <Header />
      <Tabs
        value={tab}
        items={[
          ["recommended", "おすすめ"],
          ["liked", "いいねしたイベント"],
        ]}
        onChange={onTabChange}
      />
      <AdFrame />
      <div className="event-list">
        {visibleEvents.map((event) => (
          <EventCard key={event.id} event={event} />
        ))}
      </div>
    </section>
  );
}

function WalletScreen({
  tab,
  onTabChange,
  onPurchase,
}: {
  tab: "recommended" | "favorite";
  onTabChange: (tab: "recommended" | "favorite") => void;
  onPurchase: () => void;
}) {
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
          {productCategories.map((category) => (
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

function PurchaseScreen() {
  return (
    <section>
      <Header help />
      <article className="purchase-summary">
        <span>現在の利用可能ポイント</span>
        <strong>1200pt</strong>
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
            <dd>1700 pt</dd>
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

function AccountScreen() {
  const sections = [
    {
      title: "アカウント",
      rows: [
        ["アカウント区分", user.accountType],
        ["ユーザーID", user.userId],
        ["メールアドレス設定", user.email],
        ["パスワード変更", ""],
        ["ログアウト", ""],
      ],
    },
    { title: "設定", rows: [["支払方法の管理", ""], ["言語設定", ""], ["文字サイズの変更", ""], ["通知設定", ""], ["セキュリティとプライバシー", ""]] },
    { title: "サポート", rows: [["使い方ガイド", ""], ["ヘルプ・よくある質問", ""], ["お問い合わせ", ""], ["不具合・報告", ""]] },
    { title: "その他", rows: [["プライバシーポリシー", ""], ["規約一覧", ""], ["アカウントの削除", "danger"]] },
  ];

  return (
    <section>
      <Header />
      <div className="settings-list">
        {sections.map((section) => (
          <section key={section.title} className="settings-section">
            <h2>{section.title}</h2>
            {section.rows.map(([label, value]) => (
              <button key={label} className={`settings-row ${value === "danger" ? "settings-row--danger" : ""}`} type="button">
                <span>{label}</span>
                {value && value !== "danger" ? <strong>{value}</strong> : null}
              </button>
            ))}
          </section>
        ))}
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

function EventCard({ event, compact = false }: { event: EventItem; compact?: boolean }) {
  return (
    <article className={`event-card ${compact ? "event-card--compact" : ""}`}>
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
        <button key={itemValue} className={itemValue === value ? "tabs__item tabs__item--active" : "tabs__item"} type="button" onClick={() => onChange(itemValue)}>
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
