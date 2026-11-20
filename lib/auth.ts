import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { supabaseServer } from "./supabase/server";
import type { Profile } from "./types";

/** A one-time sign-in token for an existing member, or null if there is none. */
export async function createLoginToken(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: "magiclink", email });
  if (error || !data.properties?.hashed_token) return null;
  return data.properties.hashed_token;
}

/** Exchanges a one-time token for a session cookie. Call from a Route Handler or Server Action. */
export async function signInWithToken(tokenHash: string): Promise<boolean> {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });
  return !error;
}

/** The signed-in member's profile, or null. */
export async function currentProfile(): Promise<Profile | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const profile = await supabase.from("seraphova_profiles").select("*").eq("id", data.user.id).maybeSingle();
  return (profile.data as Profile | null) ?? null;
}
