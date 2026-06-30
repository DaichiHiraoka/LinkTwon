import type { AdminStats } from "../types";

export function Home({ stats }: { stats: AdminStats | null }) {
  if (!stats) {
    return (
      <section className="page">
        <h1 className="page__title">ホーム</h1>
        <p className="empty-note">集計データを取得できませんでした。/admin/stats を確認してください。</p>
      </section>
    );
  }

  const kpis: Array<[string, number]> = [
    ["利用者数", stats.total_users],
    ["公開中イベント", stats.active_events],
    ["未対応問い合わせ", stats.open_tickets],
    ["総参加件数", stats.total_participations],
    ["付与済ポイント", stats.total_granted_points],
    ["交換件数", stats.total_exchanges],
    ["交換済ポイント", stats.total_exchanged_points],
    ["購入件数", stats.total_purchases],
    ["購入済ポイント", stats.total_purchased_points],
  ];

  return (
    <section className="page">
      <h1 className="page__title">ホーム</h1>
      <div className="kpi-grid">
        {kpis.map(([label, value]) => (
          <article className="kpi" key={label}>
            <span>{label}</span>
            <strong>{value.toLocaleString()}</strong>
          </article>
        ))}
      </div>
      <div className="ranking-grid">
        <article className="ranking">
          <h2>イベント参加数 上位</h2>
          <ol>
            {stats.event_participants.length === 0 ? <li className="ranking__empty">データなし</li> : null}
            {stats.event_participants.map((entry) => (
              <li key={entry.event_id}>
                <span>{entry.event_name}</span>
                <strong>{entry.participation_count}</strong>
              </li>
            ))}
          </ol>
        </article>
        <article className="ranking">
          <h2>交換サービス 上位</h2>
          <ol>
            {stats.service_exchanges.length === 0 ? <li className="ranking__empty">データなし</li> : null}
            {stats.service_exchanges.map((entry) => (
              <li key={entry.service_id}>
                <span>{entry.service_name}</span>
                <strong>{entry.exchange_count}</strong>
              </li>
            ))}
          </ol>
        </article>
      </div>
    </section>
  );
}
