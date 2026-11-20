import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { recordEvent } from "./funnel-server";
import { ensureReading } from "./reading";
import { sendDailyEmail } from "./email";
import { localDateString, nextDeliveryAfterToday } from "./time";
import type { Profile } from "./types";

const YEAR_MS = 365 * 24 * 3600 * 1000;

/**
 * Marks a profile as paid for one year. Safe to call more than once for the same
 * Stripe session (the webhook and the return page both do): only the first call
 * reports `activated: true`.
 */
export async function activateProfile(
  profileId: string,
  payment: { sessionId: string; customerId: string | null; amountCents: number; currency: string },
): Promise<{ profile: Profile | null; activated: boolean }> {
  const db = supabaseAdmin();
  const current = await db.from("seraphova_profiles").select("*").eq("id", profileId).maybeSingle();
  const profile = current.data as Profile | null;
  if (!profile) return { profile: null, activated: false };
  if (profile.stripe_session_id === payment.sessionId) return { profile, activated: false };

  const now = new Date();
  // A renewal while still active extends from the current end date.
  const from =
    profile.status === "active" && profile.access_until && new Date(profile.access_until) > now
      ? new Date(profile.access_until)
      : now;

  let update = db
    .from("seraphova_profiles")
    .update({
      status: "active",
      // Someone who stopped the reminder emails still wants the readings they paid for.
      email_paused: false,
      paid_at: now.toISOString(),
      access_until: new Date(from.getTime() + YEAR_MS).toISOString(),
      next_send_at: nextDeliveryAfterToday(profile.delivery_hour, profile.timezone, now).toISOString(),
      stripe_session_id: payment.sessionId,
      stripe_customer_id: payment.customerId,
    })
    .eq("id", profileId);
  // Guard against the webhook and the return page racing each other.
  update = profile.stripe_session_id
    ? update.eq("stripe_session_id", profile.stripe_session_id)
    : update.is("stripe_session_id", null);

  const updated = await update.select("*").maybeSingle();
  if (!updated.data) return { profile, activated: false };

  await db.from("seraphova_payments").upsert(
    {
      profile_id: profileId,
      stripe_session_id: payment.sessionId,
      amount_cents: payment.amountCents,
      currency: payment.currency,
      cart_emails_before: profile.cart_emails_sent ?? 0,
    },
    { onConflict: "stripe_session_id", ignoreDuplicates: true },
  );
  await recordEvent(profile.visitor_id, "paid", profileId);
  return { profile: updated.data as Profile, activated: true };
}

/** Writes and emails today's reading right after payment. */
export async function deliverFirstReading(profile: Profile) {
  const today = localDateString(new Date(), profile.timezone);
  const reading = await ensureReading(profile, today);
  if (reading.sent_at) return;
  await sendDailyEmail(profile, reading, true);
  await supabaseAdmin()
    .from("seraphova_readings")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", reading.id);
}
