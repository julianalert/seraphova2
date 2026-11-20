import "server-only";
import { CART_DELAYS_MINUTES, sendCartEmail } from "./email";
import { supabaseAdmin } from "./supabase/admin";
import type { Profile } from "./types";

const BATCH = 200;
/** Leads older than this are left alone, even if the sequence never finished. */
const MAX_AGE_DAYS = 14;

/**
 * Sends the next abandoned-cart reminder to every lead who is due one.
 * A lead is someone who finished the quiz (we have their email) but has not paid.
 * The sequence stops when they pay, unsubscribe, or have received all reminders.
 */
export async function runCartSequence(now = new Date()) {
  const db = supabaseAdmin();
  const firstDelayMs = CART_DELAYS_MINUTES[0] * 60_000;

  const found = await db
    .from("seraphova_profiles")
    .select("*")
    .eq("status", "lead")
    .eq("email_paused", false)
    .lt("cart_emails_sent", CART_DELAYS_MINUTES.length)
    .lte("created_at", new Date(now.getTime() - firstDelayMs).toISOString())
    .gte("created_at", new Date(now.getTime() - MAX_AGE_DAYS * 86_400_000).toISOString())
    .order("created_at")
    .limit(BATCH);
  if (found.error) throw new Error(found.error.message);

  const result = { considered: found.data?.length ?? 0, sent: 0, failed: 0 };

  for (const profile of (found.data ?? []) as Profile[]) {
    const index = profile.cart_emails_sent;
    const dueAt = new Date(profile.created_at).getTime() + CART_DELAYS_MINUTES[index] * 60_000;
    if (now.getTime() < dueAt) continue;

    // Claim this reminder first, so an overlapping run cannot send it twice.
    const claim = await db
      .from("seraphova_profiles")
      .update({ cart_emails_sent: index + 1, cart_last_email_at: now.toISOString() })
      .eq("id", profile.id)
      .eq("status", "lead")
      .eq("cart_emails_sent", index)
      .select("id")
      .maybeSingle();
    if (!claim.data) continue;

    try {
      await sendCartEmail(profile, index, now);
      result.sent++;
    } catch (error) {
      result.failed++;
      console.error("Cart email failed", profile.id, index, error);
      // Give it back so the next run tries again.
      await db
        .from("seraphova_profiles")
        .update({ cart_emails_sent: index, cart_last_email_at: profile.cart_last_email_at })
        .eq("id", profile.id)
        .eq("cart_emails_sent", index + 1);
    }
  }
  return result;
}
