import { useCallback, useEffect, useState } from "react";
import { Sidebar, type NavKey } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { FeedbackBanner, type Feedback } from "./components/FeedbackBanner";
import { Login } from "./screens/Login";
import { Home } from "./screens/Home";
import { EventsList } from "./screens/EventsList";
import { StoresList } from "./screens/StoresList";
import { ServicesList } from "./screens/ServicesList";
import { UsersList } from "./screens/UsersList";
import { NotificationsList } from "./screens/NotificationsList";
import { Analysis } from "./screens/Analysis";
import { readSession, writeSession, type AdminSession } from "./session";
import {
  ApiError,
  getApiTargetLabel,
  getEvents,
  getEventSubmissions,
  getServices,
  getStats,
  getStores,
  getSupportTickets,
  getSystemConnection,
  getUsers,
  getErrorMessage,
} from "./api";
import type {
  AdminServiceItem,
  AdminStats,
  EventItem,
  EventSubmission,
  ManagedUser,
  StoreItem,
  SupportTicket,
  SystemConnection,
} from "./types";

export function App() {
  const [session, setSession] = useState<AdminSession | null>(readSession);

  if (!session) {
    return (
      <Login
        onLogin={(next) => {
          writeSession(next);
          setSession(next);
        }}
      />
    );
  }

  return (
    <AdminShell
      session={session}
      onLogout={() => {
        writeSession(null);
        setSession(null);
      }}
    />
  );
}

function AdminShell({ session, onLogout }: { session: AdminSession; onLogout: () => void }) {
  const [current, setCurrent] = useState<NavKey>("home");
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [eventSubmissions, setEventSubmissions] = useState<EventSubmission[]>([]);
  const [stores, setStores] = useState<StoreItem[]>([]);
  const [services, setServices] = useState<AdminServiceItem[]>([]);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [connection, setConnection] = useState<SystemConnection | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "connected" | "error">("checking");

  const notify = useCallback((ok: boolean, message: string) => setFeedback({ ok, message }), []);

  const reloadAll = useCallback(
    async (search = userSearch) => {
      setConnectionStatus("checking");
      const results = await Promise.allSettled([
        getSystemConnection(session.token),
        getStats(session.token),
        getEvents(session.token),
        getEventSubmissions(session.token),
        getStores(session.token),
        getServices(session.token),
        getUsers(session.token, search),
        getSupportTickets(session.token),
      ]);

      const authError = results.find(
        (result) =>
          result.status === "rejected" &&
          result.reason instanceof ApiError &&
          (result.reason.status === 401 || result.reason.status === 403),
      );
      if (authError) {
        onLogout();
        return;
      }

      const failures: string[] = [];
      function applyResult<T>(
        label: string,
        result: PromiseSettledResult<T>,
        apply: (value: T) => void,
      ) {
        if (result.status === "fulfilled") {
          apply(result.value);
        } else {
          failures.push(`${label}: ${getErrorMessage(result.reason)}`);
        }
      }

      applyResult("DB接続", results[0], (value) => {
        setConnection(value);
        setConnectionStatus("connected");
      });
      applyResult("集計", results[1], setStats);
      applyResult("イベント", results[2], setEvents);
      applyResult("イベント申請", results[3], setEventSubmissions);
      applyResult("加盟店", results[4], setStores);
      applyResult("サービス", results[5], setServices);
      applyResult("利用者", results[6], setUsers);
      applyResult("お問い合わせ", results[7], setTickets);

      if (results[0].status === "rejected") {
        setConnectionStatus("error");
      }
      if (failures.length > 0) {
        notify(false, `データを取得できませんでした。${failures.join(" / ")}`);
      }
    },
    [notify, onLogout, session.token, userSearch],
  );

  useEffect(() => {
    void reloadAll(userSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  useEffect(() => {
    if (current === "events-list") {
      void reloadAll(userSearch);
    }
    // reloadAll intentionally changes with the current search term.
  }, [current]);

  useEffect(() => {
    function refreshOnFocus() {
      if (document.visibilityState === "visible") {
        void reloadAll(userSearch);
      }
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [reloadAll, userSearch]);

  return (
    <div className="admin-shell">
      <Sidebar current={current} onNavigate={setCurrent} />
      <div className="admin-main">
        <TopBar
          onLogout={onLogout}
          connection={connection}
          connectionStatus={connectionStatus}
          apiTarget={getApiTargetLabel()}
          onRefresh={() => void reloadAll(userSearch)}
        />
        <main className="admin-content">
          <FeedbackBanner feedback={feedback} onClose={() => setFeedback(null)} />
          {current === "home" ? <Home stats={stats} /> : null}
          {current === "events-list" ? (
            <EventsList
              events={events}
              submissions={eventSubmissions}
              token={session.token}
              onReload={reloadAll}
              notify={notify}
            />
          ) : null}
          {current === "events-analysis" ? <Analysis variant="events" stats={stats} /> : null}
          {current === "stores-list" ? (
            <StoresList stores={stores} services={services} token={session.token} onReload={reloadAll} notify={notify} />
          ) : null}
          {current === "stores-analysis" ? <Analysis variant="stores" stats={stats} /> : null}
          {current === "services-list" ? (
            <ServicesList services={services} stores={stores} token={session.token} onReload={reloadAll} notify={notify} />
          ) : null}
          {current === "services-analysis" ? <Analysis variant="services" stats={stats} /> : null}
          {current === "users-list" ? (
            <UsersList
              users={users}
              token={session.token}
              searchValue={userSearch}
              onSearch={(value) => {
                setUserSearch(value);
                void reloadAll(value);
              }}
              onReload={reloadAll}
              notify={notify}
            />
          ) : null}
          {current === "notifications-list" ? (
            <NotificationsList tickets={tickets} users={users} token={session.token} onReload={reloadAll} notify={notify} />
          ) : null}
        </main>
      </div>
    </div>
  );
}
