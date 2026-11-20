import "server-only";
import type { FunnelEvent } from "./funnel";
import { supabaseAdmin } from "./supabase/admin";

/**
 * Records that a visitor reached a funnel step. Each visitor counts once per step.
 * Without a browser id (for example a buyer returning from an email on another
 * device) the profile id stands in for it. Never throws.
 */
export async function recordEvent(visitor: string | null, event: FunnelEvent, profileId?: string) {
  const visitorId = visitor || (profileId ? `profile:${profileId}` : null);
  if (!visitorId) return;
  try {
    await supabaseAdmin()
      .from("seraphova_funnel_events")
      .upsert(
        { visitor_id: visitorId, event, profile_id: profileId ?? null },
        { onConflict: "visitor_id,event", ignoreDuplicates: true },
      );
  } catch (error) {
    console.error("recordEvent failed", event, error);
  }
}
