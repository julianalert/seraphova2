import type { AdminStats } from "@/lib/admin-data";
import { BarRows, TrendChart } from "./charts";

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
const percent = (value: number | null) => (value === null ? "—" : `${value.toFixed(value < 10 ? 1 : 0)}%`);
const when = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(iso));

function Tile({ label, value, note, hero }: { label: string; value: string; note?: string; hero?: boolean }) {
  return (
    <div className={`adm-tile ${hero ? "is-hero" : ""}`}>
      <p className="adm-tile-label">{label}</p>
      <p className="adm-tile-value">{value}</p>
      {note ? <p className="adm-tile-note">{note}</p> : null}
    </div>
  );
}

export function Report({ stats }: { stats: AdminStats }) {
  const { kpis, funnel, trend, cart, breakdowns } = stats;
  const per = trend.weekly ? "week" : "day";

  return (
    <>
      <section className="adm-tiles">
        <Tile hero label="Revenue" value={money(kpis.revenueCents)} note={`${kpis.orders} order${kpis.orders === 1 ? "" : "s"} · average ${money(kpis.averageOrderCents)}`} />
        <Tile label="Quiz opens" value={String(kpis.quizStarts)} />
        <Tile label="Leads (email captured)" value={String(kpis.leads)} note={`${percent(kpis.leadsOfStarts)} of opens`} />
        <Tile label="Checkouts started" value={String(kpis.checkouts)} note={`${percent(kpis.checkoutsOfLeads)} of leads`} />
        <Tile label="Open → paid" value={percent(kpis.startToPaid)} />
        <Tile label="Lead → paid" value={percent(kpis.leadToPaid)} />
        <Tile label="Active members" value={String(kpis.activeMembers)} note="all time" />
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Funnel, from quiz open to payment</h2>
        <div className="adm-card adm-scroll">
          <table className="adm-table adm-funnel">
            <thead>
              <tr>
                <th>Step</th>
                <th className="num">Visitors</th>
                <th className="num">Of previous</th>
                <th className="num">Of opens</th>
                <th aria-hidden="true" />
              </tr>
            </thead>
            <tbody>
              {funnel.map((step, i) => (
                <tr key={step.id}>
                  <td>
                    <span className="adm-step-n">{String(i + 1).padStart(2, "0")}</span>
                    {step.label}
                  </td>
                  <td className="num strong">{step.count}</td>
                  <td className="num">{percent(step.ofPrevious)}</td>
                  <td className="num">{percent(step.ofTop)}</td>
                  <td className="adm-funnel-bar" title={`${step.label}: ${step.count}`}>
                    <span className="adm-bar-track">
                      <span className="adm-bar-fill" style={{ width: `${Math.min(100, step.ofTop ?? 0)}%` }} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="adm-foot">Each visitor counts once per step. Steps after the email are recorded by the server.</p>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Per {per}</h2>
        <div className="adm-grid-3">
          <div className="adm-card">
            <TrendChart title="Quiz opens" unit="opens" points={trend.points.map((p) => ({ bucket: p.bucket, value: p.starts }))} />
          </div>
          <div className="adm-card">
            <TrendChart title="Leads" unit="leads" points={trend.points.map((p) => ({ bucket: p.bucket, value: p.leads }))} />
          </div>
          <div className="adm-card">
            <TrendChart title="Orders" unit="orders" points={trend.points.map((p) => ({ bucket: p.bucket, value: p.orders }))} />
          </div>
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Abandoned-cart reminders</h2>
        <div className="adm-tiles">
          {cart.sentByEmail.map((email) => (
            <Tile key={email.label} label={`${email.label} · after ${email.delay}`} value={String(email.count)} note="sent" />
          ))}
          <Tile label="Paid after a reminder" value={String(cart.paidAfterEmail)} note={`${percent(cart.leadsEmailed ? (cart.paidAfterEmail / cart.leadsEmailed) * 100 : null)} of leads emailed · ${money(cart.revenueAfterEmailCents)}`} />
          <Tile label="Unsubscribed" value={String(cart.unsubscribed)} note="after a reminder" />
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Who is filling the quiz</h2>
        <div className="adm-grid-3">
          <div className="adm-card">
            <p className="adm-card-title">Most on their mind</p>
            <BarRows rows={breakdowns.focus} total={breakdowns.total} />
          </div>
          <div className="adm-card">
            <p className="adm-card-title">Delivery hour</p>
            <BarRows rows={breakdowns.deliveryHour} total={breakdowns.total} />
          </div>
          <div className="adm-card">
            <p className="adm-card-title">Birth time</p>
            <BarRows rows={breakdowns.birthTime} total={breakdowns.total} />
          </div>
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Recent orders</h2>
        <div className="adm-card adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>When (UTC)</th>
                <th>Name</th>
                <th>Email</th>
                <th className="num">Amount</th>
                <th className="num">Reminders before</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentOrders.map((order) => (
                <tr key={order.id}>
                  <td>{when(order.when)}</td>
                  <td>{order.name}</td>
                  <td>{order.email}</td>
                  <td className="num strong">{money(order.amountCents)}</td>
                  <td className="num">{order.cartEmailsBefore || "—"}</td>
                </tr>
              ))}
              {stats.recentOrders.length === 0 && (
                <tr>
                  <td colSpan={5} className="adm-empty">
                    No orders in this period yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="adm-section">
        <h2 className="adm-h2">Leads who have not paid</h2>
        <div className="adm-card adm-scroll">
          <table className="adm-table">
            <thead>
              <tr>
                <th>When (UTC)</th>
                <th>Name</th>
                <th>Email</th>
                <th>Focus</th>
                <th className="num">Reminders sent</th>
                <th>Order page</th>
              </tr>
            </thead>
            <tbody>
              {stats.unpaidLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>{when(lead.when)}</td>
                  <td>{lead.name}</td>
                  <td>{lead.email}</td>
                  <td>{lead.focus}</td>
                  <td className="num">
                    {lead.emailsSent}
                    {lead.unsubscribed ? " · unsubscribed" : ""}
                  </td>
                  <td>
                    <a href={lead.resumeUrl} className="adm-link">
                      Open
                    </a>
                  </td>
                </tr>
              ))}
              {stats.unpaidLeads.length === 0 && (
                <tr>
                  <td colSpan={6} className="adm-empty">
                    No unpaid leads in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="adm-foot">Latest 25. Revenue counts payments recorded here; refunds made in Stripe are not subtracted.</p>
      </section>
    </>
  );
}
