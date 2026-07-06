import type { AdminStats } from "../types";

type Variant = "events" | "stores" | "services";

export function Analysis({ variant, stats }: { variant: Variant; stats: AdminStats | null }) {
  const title =
    variant === "events" ? "イベント分析" : variant === "stores" ? "加盟店分析" : "サービス分析";

  if (!stats) {
    return (
      <section className="page">
        <h1 className="page__title">{title}</h1>
        <p className="empty-note">集計データを取得できませんでした。</p>
      </section>
    );
  }

  const rows =
    variant === "events"
      ? stats.event_participants.map((entry) => ({
          key: entry.event_id,
          label: entry.event_name,
          count: entry.participation_count,
          unitCount: "件",
          points: entry.granted_points,
        }))
      : stats.service_exchanges.map((entry) => ({
          key: entry.service_id,
          label: entry.service_name,
          count: entry.exchange_count,
          unitCount: "件",
          points: entry.exchanged_points,
        }));

  const summary =
    variant === "events"
      ? [
          ["総参加件数", stats.total_participations],
          ["付与済ポイント", stats.total_granted_points],
        ]
      : variant === "stores"
        ? [
            ["登録加盟店", "-"],
            ["交換件数", stats.total_exchanges],
          ]
        : [
            ["交換件数", stats.total_exchanges],
            ["消費ポイント", stats.total_exchanged_points],
          ];

  return (
    <section className="page">
      <h1 className="page__title">{title}</h1>
      <div className="kpi-grid">
        {summary.map(([label, value]) => (
          <article className="kpi" key={String(label)}>
            <span>{label}</span>
            <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
          </article>
        ))}
      </div>
      <article className="ranking">
        <h2>{variant === "events" ? "参加者数 上位" : "交換数 上位"}</h2>
        <ol>
          {rows.length === 0 ? <li className="ranking__empty">データなし</li> : null}
          {rows.map((row) => (
            <li key={row.key}>
              <span>{row.label}</span>
              <strong>
                {row.count}
                {row.unitCount}
              </strong>
              <small>{row.points}pt</small>
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}
