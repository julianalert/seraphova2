"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { currentProfile } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { FOCUS_AREAS } from "@/lib/types";

export async function signOut() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}

export type MindState = { status: "idle" | "saved" | "error"; message?: string };

/** Saves what the member says is on their mind. Every later reading is written with it. */
export async function updateMind(_previous: MindState, formData: FormData): Promise<MindState> {
  const profile = await currentProfile();
  if (!profile) redirect("/login");

  const focus = FOCUS_AREAS.find((area) => area.id === formData.get("focus"))?.id;
  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, 600);
  if (!focus) return { status: "error", message: "Please choose what is most on your mind." };
  if (focus === profile.focus && note === (profile.context ?? "")) return { status: "saved" };

  const db = supabaseAdmin();
  const updated = await db
    .from("seraphova_profiles")
    .update({ focus, context: note || null, context_updated_at: new Date().toISOString() })
    .eq("id", profile.id);
  if (updated.error) {
    console.error("updateMind failed", profile.id, updated.error);
    return { status: "error", message: "We could not save that just now. Please try again." };
  }
  // Keep every version, so the member's memory can follow how things changed.
  await db.from("seraphova_notes").insert({ user_id: profile.id, focus, note: note || null });

  refresh();
  return { status: "saved" };
}
