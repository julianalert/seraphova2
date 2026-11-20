import Link from "next/link";
import { NatalWheel } from "@/components/natal-wheel";
import { placementOf } from "@/lib/astro/chart";
import { BODY_GLYPH, SIGN_LINES } from "@/lib/astro/signs";
import { computeDailySky, describeTransit } from "@/lib/astro/transits";
import { PRICE_CENTS } from "@/lib/env";
import { formatLongDate } from "@/lib/time";
import { focusLabel, type Profile, type Reading } from "@/lib/types";
import { startCheckout } from "./actions";
import { PayButton } from "./pay-button";

const capital = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

export function OrderView({ profile, reading, now }: { profile: Profile; reading: Reading | null; now: Date }) {
  const chart = profile.chart;
  const sun = placementOf(chart, "Sun");
  const moon = placementOf(chart, "Moon");
  const sky = computeDailySky(chart, now);
  const lead = sky.transits.find((t) => t.planet !== "Moon") ?? sky.transits[0];
  const hour = `${profile.delivery_hour}AM`;

  const bigThree = [
    { label: `Sun in ${sun.sign}`, line: SIGN_LINES[sun.sign].sun },
    ...(chart.moonSignUncertain ? [] : [{ label: `Moon in ${moon.sign}`, line: SIGN_LINES[moon.sign].moon }]),
    ...(chart.ascendant
      ? [{ label: `${chart.ascendant.sign} rising`, line: SIGN_LINES[chart.ascendant.sign].rising }]
      : []),
  ];
  const tags = [
    `${BODY_GLYPH.Sun} ${sun.sign} Sun`,
    ...(chart.moonSignUncertain ? [] : [`${BODY_GLYPH.Moon} ${moon.sign} Moon`]),
    ...(chart.ascendant ? [`${chart.ascendant.sign} Rising`] : []),
    ...sky.transits.slice(0, 2).map((t) => `${BODY_GLYPH[t.planet]} ${t.planet} ${t.aspect} ${t.natal}`),
  ];

  return (
    <div className="order-page" id="mainPage">
      <nav className="order-nav">
        <Link href="/" className="nav-logo">
          ✦ Seraphova
        </Link>
        <span className="nav-secure">
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="2" y="6" width="10" height="7" rx="1.5" />
            <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" />
          </svg>
          Secured by Stripe
        </span>
      </nav>

      <div id="orderPage" className="visible">
        <div className="order-wrap">
          <div className="two-col">
            {/* ─── LEFT COLUMN ─── */}
            <div className="col-left">
              <div className="order-header">
                <h1 className="order-title">
                  Your {reading ? "reading" : "chart"} is <em>ready.</em>
                </h1>
              </div>

              {/* First reading preview */}
              {reading && (
                <div className="horoscope-preview">
                  <div className="horo-top-bar">
                    <div className="horo-dots">
                      <div className="horo-dot" />
                      <div className="horo-dot" />
                      <div className="horo-dot" />
                    </div>
                    <span className="horo-bar-title">Seraphova · Today&apos;s Reading</span>
                    <span className="horo-bar-badge">Generated for you</span>
                  </div>
                  <div className="horo-body">
                    <div className="horo-date-row">
                      <span className="horo-date">{formatLongDate(reading.reading_date)}</span>
                      <div className="horo-divider-line" />
                    </div>
                    <div className="horo-greeting">{reading.headline}</div>
                    {reading.opening.split(/\n\s*\n/).map((text, i) => (
                      <p key={i} className="horo-text">
                        {text}
                      </p>
                    ))}
                    {reading.sections[0] && (
                      <div className="horo-locked" aria-hidden="true">
                        <div className="horo-greeting" style={{ fontSize: 20, marginBottom: 8 }}>
                          {reading.sections[0].heading}
                        </div>
                        <p className="horo-text" style={{ marginBottom: 0 }}>
                          {reading.sections[0].body.slice(0, 260)}
                        </p>
                      </div>
                    )}
                  </div>
                  <div style={{ height: 48, position: "relative" }}>
                    <div className="horo-blur-overlay">
                      <p className="horo-unlock-note">✦ &nbsp; Unlock the full reading — and every morning after</p>
                    </div>
                  </div>
                  {(reading.sky.notes ?? []).length > 0 && (
                    <div className="horo-basis">
                      <span>Written from</span>
                      {(reading.sky.notes ?? []).map((note) => (
                        <span key={note.transit} className="horo-tag">
                          {note.transit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {reading && <p className="section-label">The chart it was written from</p>}

              {/* Chart preview */}
              <div className="horoscope-preview">
                <div className="horo-top-bar">
                  <div className="horo-dots">
                    <div className="horo-dot" />
                    <div className="horo-dot" />
                    <div className="horo-dot" />
                  </div>
                  <span className="horo-bar-title">Seraphova · Your birth chart</span>
                  <span className="horo-bar-badge">Cast for you</span>
                </div>
                <div className="horo-body">
                  <div className="horo-date-row">
                    <span className="horo-date">
                      {profile.birth_city}
                      {profile.birth_time ? ` · ${profile.birth_time.slice(0, 5)}` : ""}
                    </span>
                    <div className="horo-divider-line" />
                  </div>
                  <div className="horo-greeting">{profile.first_name}, this is the sky you were born under.</div>
                  <NatalWheel chart={chart} className="order-wheel" />
                  {bigThree.map((item) => (
                    <p key={item.label} className="horo-text">
                      <strong>{item.label}.</strong> {item.line}
                    </p>
                  ))}
                  {!chart.ascendant && (
                    <p className="horo-text" style={{ fontStyle: "italic" }}>
                      Without a birth time, your chart is cast for midday and leaves out the rising sign.
                    </p>
                  )}
                  {lead && (
                    <div className="horo-insight">
                      <p className="horo-insight-label">In the sky right now</p>
                      <p className="horo-insight-text">{capital(describeTransit(lead))}.</p>
                    </div>
                  )}
                  <div className="horo-blur-wrap">
                    <div className="horo-tags">
                      {tags.map((tag) => (
                        <span key={tag} className="horo-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div style={{ height: 48, position: "relative" }}>
                  <div className="horo-blur-overlay">
                    <p className="horo-unlock-note">
                      {reading
                        ? "✦ \u00a0 Every reading is written from this chart"
                        : `✦ \u00a0 Unlock what it means for ${focusLabel(profile.focus).toLowerCase()} — and every morning after`}
                    </p>
                  </div>
                </div>
              </div>

              {/* What's included */}
              <p className="section-label">What you get every morning</p>
              <ul className="includes-list">
                {[
                  { icon: "🌙", text: <><strong>A reading built from your full natal chart</strong> — not your sun sign. Every planet, every house, every placement shapes what you receive.</> },
                  { icon: "🌍", text: <><strong>Real-time transits, mapped to your chart</strong> — what Venus stationing direct means for you specifically, not for Libras in general.</> },
                  { icon: "💫", text: <><strong>One clear, actionable insight</strong> — not a wall of cosmic theory. Something specific to carry into your day.</> },
                  { icon: "🗓", text: <><strong>Dates, not just moods</strong> — when a stretch began, when it peaks and when it eases, worked out for your chart.</> },
                  { icon: "📬", text: <><strong>Delivered at {hour}, every morning</strong> — the whole reading in your inbox before your day starts. No app to open, nothing to remember.</> },
                  { icon: "🧭", text: <><strong>Readings that remember</strong> — each one builds on the last, and on whatever you tell us is going on in your life.</> },
                  { icon: "🔮", text: <><strong>New moon &amp; full moon callouts</strong> — flagged in advance, always interpreted through your personal chart.</> },
                ].map((item, i) => (
                  <li key={i}>
                    <div className="inc-icon">{item.icon}</div>
                    <div>{item.text}</div>
                  </li>
                ))}
              </ul>

              {/* Comparison */}
              <p className="section-label" style={{ marginTop: 8 }}>
                How Seraphova compares
              </p>
              <div className="comparison-block">
                <div className="comparison-header">
                  <span>Feature</span>
                  <span>Most apps</span>
                  <span>Seraphova</span>
                </div>
                {[
                  { label: "Says what to do today, in plain words", genericLabel: "Often cryptic" },
                  { label: "Tells you when a phase eases", genericLabel: "Rarely" },
                  { label: "Remembers what it told you last week", genericLabel: "✕" },
                  { label: "Arrives by email, no app to open", genericLabel: "Push alerts" },
                  { label: "One payment, nothing to cancel", genericLabel: "Subscription" },
                ].map((f) => (
                  <div className="comparison-row" key={f.label}>
                    <span className="cr-feature">{f.label}</span>
                    <span className={f.genericLabel === "✕" ? "cr-no" : "cr-no cr-no-text"}>{f.genericLabel}</span>
                    <span className="cr-yes">✦</span>
                  </div>
                ))}
              </div>

              {/* How it is made */}
              <div className="mini-testi">
                <p className="section-label" style={{ marginTop: 0 }}>
                  How your reading is made
                </p>
                <p className="horo-text" style={{ marginBottom: 0 }}>
                  The sky is calculated, not guessed: where every planet was when you were born, and where
                  it is each morning. The writing is done by an AI model working from those exact positions,
                  and every reading is checked against them before it is sent. The transits behind it are
                  listed at the end, so you can check them yourself.
                </p>
              </div>
            </div>

            {/* ─── RIGHT COLUMN — sticky panel ─── */}
            <div className="col-right">
              <div className="order-panel">
                <div className="panel-header">
                  <p className="panel-eyebrow">Daily Personalized Horoscope</p>
                  <div className="panel-price-row">
                    <span className="panel-currency">$</span>
                    <span className="panel-amount">{PRICE_CENTS / 100}</span>
                  </div>
                  <p className="panel-period">
                    one-time · 365 daily readings · about {Math.round(PRICE_CENTS / 365)}¢ a day
                  </p>
                  <div className="panel-launch-badge">
                    <span className="panel-badge-dot" />
                    One payment — no renewal
                  </div>
                </div>

                <div className="panel-body">
                  <ul className="panel-includes">
                    <li>Full natal chart reading (every planet)</li>
                    <li>365 daily emails — one every morning</li>
                    <li>Real-time transits on your chart</li>
                    <li>Readings that build on each other</li>
                    <li>No subscription — one payment, one year</li>
                  </ul>

                  <div className="panel-divider" />

                  <form action={startCheckout}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <PayButton />
                  </form>

                  <div className="card-logos">
                    <span className="card-logo visa">VISA</span>
                    <span className="card-logo mc">MC</span>
                    <span className="card-logo amex">AMEX</span>
                    <span className="card-logo apple">&#63743; Pay</span>
                  </div>

                  <div className="trust-signals">
                    <div className="trust-sig">
                      <span className="trust-sig-icon">🔒</span> Secured by Stripe · 256-bit SSL
                    </div>
                    <div className="trust-sig">
                      <span className="trust-sig-icon">📧</span> First reading arrives within minutes, then daily at {hour}
                    </div>
                    <div className="trust-sig">
                      <span className="trust-sig-icon">🚫</span> One payment — no recurring charges, ever
                    </div>
                    <div className="trust-sig">
                      <span className="trust-sig-icon">🛡</span> Your chart data is private, never shared
                    </div>
                  </div>

                  <div className="panel-divider" />

                  <div className="order-guarantee">
                    <span className="og-icon">↩</span>
                    <div>
                      <div className="og-title">7-day money-back guarantee</div>
                      <div className="og-desc">
                        If the readings don&apos;t feel genuinely personal to you, email us within 7 days for a
                        full refund. No questions, no hoops.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="order-footer">
        <p className="footer-note">Your reading will be sent to {profile.email}</p>
      </footer>
    </div>
  );
}
