import type { NextRequest } from "next/server";
import { sendDailyEmail } from "@/lib/email";
import { refreshMemoryIfDue } from "@/lib/memory";
import { ensureReading } from "@/lib/reading";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { localDateString, nextDelivery } from "@/lib/time";
import type { Profile } from "@/lib/types";

export const maxDuration = 300;

const BATCH = 120;
const CONCURRENCY = 8;
/** Readings are written up to this long before their delivery hour, so sending is instant. */
const PREPARE_AHEAD_MS = 2 * 3600 * 1000;
const BUDGET_MS = 240_000;
const RETRY_WINDOW_MS = 3 * 3600 * 1000;

// Runs every 15 minutes (vercel.json). Sends each member their reading once their
// chosen local hour has arrived.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const started = Date.now();
  const db = supabaseAdmin();
  const due = await db
    .from("seraphova_profiles")
    .select("*")
    .eq("status", "active")
    .lte("next_send_at", new Date().toISOString())
    .order("next_send_at")
    .limit(BATCH);
  if (due.error) return Response.json({ error: due.error.message }, { status: 500 });

  const queue = (due.data ?? []) as Profile[];
  const result = { due: queue.length, sent: 0, written: 0, expired: 0, failed: 0, prepared: 0 };

  async function handle(profile: Profile) {
    const now = new Date();
    const scheduled = profile.next_send_at!;

    if (!profile.access_until || new Date(profile.access_until) <= now) {
      await db.from("seraphova_profiles").update({ status: "expired", next_send_at: null }).eq("id", profile.id);
      result.expired++;
      return;
    }

    // Claim this delivery by moving the schedule forward; an overlapping run then skips it.
    const claim = await db
      .from("seraphova_profiles")
      .update({ next_send_at: nextDelivery(profile.delivery_hour, profile.timezone, now).toISOString() })
      .eq("id", profile.id)
      .eq("next_send_at", scheduled)
      .select("id")
      .maybeSingle();
    if (!claim.data) return;

    try {
      const reading = await ensureReading(profile, localDateString(now, profile.timezone));
      result.written++;
      if (!reading.sent_at && !profile.email_paused) {
        await sendDailyEmail(profile, reading);
        await db.from("seraphova_readings").update({ sent_at: new Date().toISOString() }).eq("id", reading.id);
        result.sent++;
      }
      // Once a week's worth of readings has built up, fold them into the member's memory.
      await refreshMemoryIfDue(profile.id).catch((error) =>
        console.error("Memory update failed", profile.id, error),
      );
    } catch (error) {
      result.failed++;
      console.error("Daily reading failed", profile.id, error);
      // Put it back so the next run retries, unless it is already hours late.
      if (now.getTime() - new Date(scheduled).getTime() < RETRY_WINDOW_MS) {
        await db.from("seraphova_profiles").update({ next_send_at: scheduled }).eq("id", profile.id);
      }
    }
  }

  async function worker() {
    while (queue.length && Date.now() - started < BUDGET_MS) {
      await handle(queue.shift()!);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // With the time left, write ahead the readings that are due in the next two hours.
  // A reading takes the model around half a minute, so this is what keeps a busy
  // delivery hour on time: when the hour arrives the reading is already there.
  const soon = await db
    .from("seraphova_profiles")
    .select("*")
    .eq("status", "active")
    .gt("next_send_at", new Date().toISOString())
    .lte("next_send_at", new Date(Date.now() + PREPARE_AHEAD_MS).toISOString())
    .order("next_send_at")
    .limit(BATCH);
  const upcoming = ((soon.data ?? []) as Profile[]).filter(
    (p) => p.access_until && new Date(p.access_until) > new Date(p.next_send_at!),
  );
  async function prepare() {
    while (upcoming.length && Date.now() - started < BUDGET_MS) {
      const profile = upcoming.shift()!;
      const date = localDateString(new Date(profile.next_send_at!), profile.timezone);
      const existing = await db
        .from("seraphova_readings")
        .select("id")
        .eq("user_id", profile.id)
        .eq("reading_date", date)
        .maybeSingle();
      if (existing.data) continue;
      try {
        await ensureReading(profile, date);
        result.prepared++;
      } catch (error) {
        console.error("Preparing a reading failed", profile.id, error);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, prepare));

  return Response.json(result);
}
