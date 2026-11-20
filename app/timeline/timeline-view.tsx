import type { ReactNode } from "react";
import Link from "next/link";
import { placementOf } from "@/lib/astro/chart";
import { BODY_GLYPH } from "@/lib/astro/signs";
import { formatLongDate, formatShortDate } from "@/lib/time";
import type { Profile, Reading } from "@/lib/types";
import { MindEditor } from "./mind-editor";

export function Waiting({ label, note }: { label: string; note?: string }) {
  return (
    <div className="tl-wait" role="status">
      <div className="loading-orb" />
      <h2 className="loading-title">{label}</h2>
      {note ? <p className="loading-sub" style={{ marginBottom: 0 }}>{note}</p> : null}
    </div>
  );
}

export function TimelineView({
  profile,
  today,
  active,
  past,
  todaySlot,
}: {
  profile: Profile;
  today: string;
  active: boolean;
  /** Readings before today, newest first. */
  past: Reading[];
  /** Today's reading, or whatever stands in for it while it is written. */
  todaySlot: ReactNode;
}) {
  const chart = profile.chart;
  const placements = [
    { glyph: BODY_GLYPH.Sun, label: `${placementOf(chart, "Sun").sign} Sun` },
    ...(chart.moonSignUncertain
      ? []
      : [{ glyph: BODY_GLYPH.Moon, label: `${placementOf(chart, "Moon").sign} Moon` }]),
    ...(chart.ascendant ? [{ glyph: "↑", label: `${chart.ascendant.sign} Rising` }] : []),
  ];

  return (
    <div className="screen">
      <div className="tl-head">
        <p className="section-eyebrow">{formatLongDate(today)}</p>
        <h1 className="page-title">
          {profile.first_name}&rsquo;s <em>readings.</em>
        </h1>
        <div className="chips">
          {placements.map((p) => (
            <span key={p.label} className="chip">
              <span className="glyph" aria-hidden="true">
                {p.glyph}
              </span>
              {p.label}
            </span>
          ))}
        </div>
      </div>

      {!active && (
        <div className="tl-notice">
          <p className="mind-focus">Your year of readings has ended.</p>
          <p className="ob-sub" style={{ margin: "6px 0 18px" }}>
            Everything you received stays here. New mornings are one step away.
          </p>
          <Link href={`/order?p=${profile.id}`} className="btn btn-gold">
            Renew for a year →
          </Link>
        </div>
      )}

      {todaySlot}

      <MindEditor focus={profile.focus} note={profile.context ?? ""} />

      {past.length > 0 && (
        <section style={{ marginTop: 64 }}>
          <p className="section-eyebrow">Earlier mornings</p>
          <ol className="problem-list tl-list" style={{ marginTop: 20 }}>
            {past.map((reading) => {
              const d = formatShortDate(reading.reading_date);
              return (
                <li key={reading.id}>
                  <Link href={`/timeline/${reading.reading_date}`} className="problem-item">
                    <div className="problem-left">
                      <span className="problem-num">
                        {d.weekday.toUpperCase()} · {d.month.toUpperCase()} {d.day}
                      </span>
                      <span className="problem-label">{reading.theme}</span>
                    </div>
                    <div className="problem-right">
                      <h2 className="tl-row-title">{reading.headline}</h2>
                      <p className="tl-row-text">{reading.opening}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>
      )}
    </div>
  );
}

export function Featured({ reading }: { reading: Reading }) {
  const [first] = reading.opening.split(/\n\s*\n/);
  return (
    <Link href={`/timeline/${reading.reading_date}`} className="tl-today">
      <div className="horo-top-bar">
        <div className="horo-dots">
          <div className="horo-dot" />
          <div className="horo-dot" />
          <div className="horo-dot" />
        </div>
        <span className="horo-bar-title">Seraphova · Today&rsquo;s reading</span>
        <span className="horo-bar-badge">{reading.theme}</span>
      </div>
      <div className="horo-body">
        <div className="horo-date-row">
          <span className="horo-date">{formatLongDate(reading.reading_date)}</span>
          <div className="horo-divider-line" />
        </div>
        <h2 className="tl-headline">{reading.headline}</h2>
        <p className="horo-text">{first}</p>
        <span className="btn btn-gold tl-cta">Read today&rsquo;s reading →</span>
      </div>
    </Link>
  );
}
