import "server-only";
import { CART_DELAYS_MINUTES } from "./email";
import { appUrl } from "./env";
import { FUNNEL_STEPS, type FunnelEvent } from "./funnel";
import { supabaseAdmin } from "./supabase/admin";
import { DELIVERY_HOURS, FOCUS_AREAS, focusLabel } from "./types";

export const RANGES = [
  { id: "7d", label: "7 days", days: 7 },
  { id: "30d", label: "30 days", days: 30 },
  { id: "90d", label: "90 days", days: 90 },
  { id: "all", label: "All time", days: null },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

const PAGE = 1000;
const MAX_ROWS = 50_000;
const DAY_MS = 86_400_000;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/** Reads every row of a query, a page at a time. */
async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<Page<T>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

type EventRow = { event: FunnelEvent; created_at: string };
type ProfileRow = {
  id: string;
  first_name: string;
  email: string;
  focus: string;
  status: "lead" | "active" | "expired";
  birth_time: string | null;
  delivery_hour: number;
  cart_emails_sent: number;
  email_paused: boolean;
  created_at: string;
};
type PaymentRow = {
  id: string;
  profile_id: string | null;
  amount_cents: number;
  cart_emails_before: number;
  created_at: string;
};

const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : null);
const dayKey = (iso: string | number) => new Date(iso).toISOString().slice(0, 10);

function weekKey(iso: string | number) {
  const d = new Date(iso);
  const monday = d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY_MS;
  return dayKey(monday);
}

export async function getAdminStats(rangeId: RangeId, now = new Date()) {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1];
  const since = range.days ? new Date(now.getTime() - range.days * DAY_MS).toISOString() : null;
  const db = supabaseAdmin();

  const [events, profiles, payments, active] = await Promise.all([
    fetchAll<EventRow>((from, to) => {
      let q = db.from("seraphova_funnel_events").select("event, created_at");
      if (since) q = q.gte("created_at", since);
      return q.order("created_at").range(from, to);
    }),
    fetchAll<ProfileRow>((from, to) => {
      let q = db
        .from("seraphova_profiles")
        .select("id, first_name, email, focus, status, birth_time, delivery_hour, cart_emails_sent, email_paused, created_at");
      if (since) q = q.gte("created_at", since);
      return q.order("created_at", { ascending: false }).range(from, to);
    }),
    fetchAll<PaymentRow>((from, to) => {
      let q = db.from("seraphova_payments").select("id, profile_id, amount_cents, cart_emails_before, created_at");
      if (since) q = q.gte("created_at", since);
      return q.order("created_at", { ascending: false }).range(from, to);
    }),
    db.from("seraphova_profiles").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  // ── Funnel ──
  const reached = new Map<FunnelEvent, number>();
  for (const e of events) reached.set(e.event, (reached.get(e.event) ?? 0) + 1);
  const top = reached.get("quiz_start") ?? 0;
  const funnel = FUNNEL_STEPS.map((step, i) => {
    const count = reached.get(step.id) ?? 0;
    const previous = i > 0 ? (reached.get(FUNNEL_STEPS[i - 1].id) ?? 0) : count;
    return { id: step.id, label: step.label, count, ofPrevious: i > 0 ? pct(count, previous) : null, ofTop: pct(count, top) };
  });

  // ── Sales ──
  const revenueCents = payments.reduce((sum, p) => sum + p.amount_cents, 0);
  const orders = payments.length;
  const leads = reached.get("lead") ?? 0;
  const paid = reached.get("paid") ?? 0;

  // ── Trend: quiz starts, leads and orders per day (or per week on long ranges) ──
  const earliest = [events[0]?.created_at, profiles.at(-1)?.created_at, payments.at(-1)?.created_at]
    .filter(Boolean)
    .map((iso) => new Date(iso!).getTime());
  const start = since ? new Date(since).getTime() : earliest.length ? Math.min(...earliest) : now.getTime();
  const weekly = (now.getTime() - start) / DAY_MS > 45;
  const keyOf = weekly ? weekKey : dayKey;
  const buckets = new Map<string, { starts: number; leads: number; orders: number }>();
  for (let t = start; t <= now.getTime(); t += DAY_MS) {
    if (!buckets.has(keyOf(t))) buckets.set(keyOf(t), { starts: 0, leads: 0, orders: 0 });
  }
  if (!buckets.has(keyOf(now.getTime()))) buckets.set(keyOf(now.getTime()), { starts: 0, leads: 0, orders: 0 });
  const bump = (iso: string, field: "starts" | "leads" | "orders") => {
    const bucket = buckets.get(keyOf(iso));
    if (bucket) bucket[field]++;
  };
  for (const e of events) {
    if (e.event === "quiz_start") bump(e.created_at, "starts");
    if (e.event === "lead") bump(e.created_at, "leads");
  }
  for (const p of payments) bump(p.created_at, "orders");
  const trend = [...buckets.entries()].map(([bucket, values]) => ({ bucket, ...values }));

  // ── Abandoned-cart reminders ──
  const emailed = profiles.filter((p) => p.cart_emails_sent > 0);
  const cart = {
    sentByEmail: CART_DELAYS_MINUTES.map((minutes, i) => ({
      label: `Email ${i + 1}`,
      delay: minutes < 60 ? `${minutes} min` : `${minutes / 60} h`,
      count: profiles.filter((p) => p.cart_emails_sent > i).length,
    })),
    leadsEmailed: emailed.length,
    paidAfterEmail: payments.filter((p) => p.cart_emails_before > 0).length,
    revenueAfterEmailCents: payments.filter((p) => p.cart_emails_before > 0).reduce((s, p) => s + p.amount_cents, 0),
    unsubscribed: emailed.filter((p) => p.status === "lead" && p.email_paused).length,
  };

  // ── Who is filling the quiz ──
  const tally = <K extends string | number>(keys: readonly K[], of: (p: ProfileRow) => K) =>
    keys.map((key) => ({ key, count: profiles.filter((p) => of(p) === key).length }));
  const breakdowns = {
    total: profiles.length,
    focus: tally(FOCUS_AREAS.map((f) => f.id), (p) => p.focus as (typeof FOCUS_AREAS)[number]["id"]).map((row) => ({
      label: focusLabel(row.key),
      count: row.count,
    })),
    deliveryHour: tally(DELIVERY_HOURS, (p) => p.delivery_hour as (typeof DELIVERY_HOURS)[number]).map((row) => ({
      label: `${row.key}am`,
      count: row.count,
    })),
    birthTime: [
      { label: "Knows birth time", count: profiles.filter((p) => p.birth_time).length },
      { label: "Does not know it", count: profiles.filter((p) => !p.birth_time).length },
    ],
  };

  // ── Tables ──
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const missing = payments.slice(0, 15).map((p) => p.profile_id).filter((id): id is string => !!id && !byId.has(id));
  if (missing.length) {
    const extra = await db.from("seraphova_profiles").select("id, first_name, email").in("id", missing);
    for (const row of (extra.data ?? []) as ProfileRow[]) byId.set(row.id, row);
  }
  const recentOrders = payments.slice(0, 15).map((p) => {
    const profile = p.profile_id ? byId.get(p.profile_id) : undefined;
    return {
      id: p.id,
      when: p.created_at,
      name: profile?.first_name ?? "—",
      email: profile?.email ?? "—",
      amountCents: p.amount_cents,
      cartEmailsBefore: p.cart_emails_before,
    };
  });
  const unpaidLeads = profiles
    .filter((p) => p.status === "lead")
    .slice(0, 25)
    .map((p) => ({
      id: p.id,
      when: p.created_at,
      name: p.first_name,
      email: p.email,
      focus: focusLabel(p.focus),
      emailsSent: p.cart_emails_sent,
      unsubscribed: p.email_paused,
      resumeUrl: `${appUrl()}/order?p=${p.id}`,
    }));

  return {
    range,
    kpis: {
      revenueCents,
      orders,
      averageOrderCents: orders ? Math.round(revenueCents / orders) : 0,
      quizStarts: top,
      leads,
      leadsOfStarts: pct(leads, top),
      checkouts: reached.get("checkout_start") ?? 0,
      checkoutsOfLeads: pct(reached.get("checkout_start") ?? 0, leads),
      startToPaid: pct(paid, top),
      leadToPaid: pct(paid, leads),
      activeMembers: active.count ?? 0,
    },
    funnel,
    trend: { weekly, points: trend },
    cart,
    breakdowns,
    recentOrders,
    unpaidLeads,
  };
}

export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
