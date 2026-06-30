import { Logo } from "./Logo";
import { BellIcon, CalendarIcon, HomeIcon, ServiceIcon, StoreIcon, UserIcon } from "./Icons";

export type NavKey =
  | "home"
  | "events-list"
  | "events-analysis"
  | "stores-list"
  | "stores-analysis"
  | "services-list"
  | "services-analysis"
  | "users-list"
  | "notifications-list";

type SectionDef = {
  icon: React.ReactNode;
  label: string;
  key?: NavKey;
  items?: Array<{ key: NavKey; label: string }>;
};

const SECTIONS: SectionDef[] = [
  { icon: <HomeIcon size={18} />, label: "ホーム", key: "home" },
  {
    icon: <CalendarIcon size={18} />,
    label: "イベント管理",
    items: [
      { key: "events-list", label: "一覧" },
      { key: "events-analysis", label: "分析" },
    ],
  },
  {
    icon: <StoreIcon size={18} />,
    label: "加盟店管理",
    items: [
      { key: "stores-list", label: "一覧" },
      { key: "stores-analysis", label: "分析" },
    ],
  },
  {
    icon: <ServiceIcon size={18} />,
    label: "サービス管理",
    items: [
      { key: "services-list", label: "一覧" },
      { key: "services-analysis", label: "分析" },
    ],
  },
  {
    icon: <UserIcon size={18} />,
    label: "利用者管理",
    items: [{ key: "users-list", label: "一覧" }],
  },
  {
    icon: <BellIcon size={18} />,
    label: "お知らせ管理",
    items: [{ key: "notifications-list", label: "一覧" }],
  },
];

export function Sidebar({ current, onNavigate }: { current: NavKey; onNavigate: (key: NavKey) => void }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <Logo />
      </div>
      <nav className="sidebar__nav">
        {SECTIONS.map((section) => (
          <div className="sidebar__section" key={section.label}>
            {section.key ? (
              <button
                type="button"
                className={`sidebar__item ${current === section.key ? "sidebar__item--active" : ""}`}
                onClick={() => section.key && onNavigate(section.key)}
              >
                <span className="sidebar__icon">{section.icon}</span>
                <span>{section.label}</span>
              </button>
            ) : (
              <div className="sidebar__heading">
                <span className="sidebar__icon">{section.icon}</span>
                <span>{section.label}</span>
              </div>
            )}
            {section.items ? (
              <div className="sidebar__sub">
                {section.items.map((item) => (
                  <button
                    type="button"
                    key={item.key}
                    className={`sidebar__sub-item ${current === item.key ? "sidebar__sub-item--active" : ""}`}
                    onClick={() => onNavigate(item.key)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </nav>
    </aside>
  );
}
