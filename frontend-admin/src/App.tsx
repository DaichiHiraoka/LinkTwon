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
  getEvents,
  getEventSubmissions,
  getServices,
  getStats,
  getStores,
  getSupportTickets,
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

  const notify = useCallback((ok: boolean, message: string) => setFeedback({ ok, message }), []);

  const reloadAll = useCallback(
    async (search = userSearch) => {
      try {
        const [s, e, es, st, sv, u, t] = await Promise.all([
          getStats(session.token).catch(() => null),
          getEvents(session.token).catch(() => [] as EventItem[]),
          getEventSubmissions(session.token).catch(() => [] as EventSubmission[]),
          getStores(session.token).catch(() => [] as StoreItem[]),
          getServices(session.token).catch(() => [] as AdminServiceItem[]),
          getUsers(session.token, search).catch((error) => {
            notify(false, `利用者一覧を取得できませんでした: ${getErrorMessage(error)}`);
            return [] as ManagedUser[];
          }),
          getSupportTickets(session.token).catch(() => [] as SupportTicket[]),
        ]);
        setStats(s);
        setEvents(e);
        setEventSubmissions(es);
        setStores(st);
        setServices(sv);
        setUsers(u);
        setTickets(t);
      } catch (error) {
        notify(false, getErrorMessage(error));
      }
    },
    [notify, session.token, userSearch],
  );

  useEffect(() => {
    void reloadAll(userSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);

  return (
    <div className="admin-shell">
      <Sidebar current={current} onNavigate={setCurrent} />
      <div className="admin-main">
        <TopBar onLogout={onLogout} />
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
