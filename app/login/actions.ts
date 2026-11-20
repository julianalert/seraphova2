"use server";

import { createLoginToken } from "@/lib/auth";
import { sendLoginEmail } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

export async function requestLoginLink(_previous: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: "error", message: "Please enter the email you joined with." };
  }

  try {
    const found = await supabaseAdmin()
      .from("seraphova_profiles")
      .select("first_name, status")
      .eq("email", email)
      .maybeSingle();
    // Only members get a link, but the reply is the same either way.
    if (found.data && found.data.status !== "lead") {
      const token = await createLoginToken(email);
      if (token) {
        await sendLoginEmail(email, found.data.first_name, `${appUrl()}/auth/confirm?token_hash=${token}`);
      }
    }
  } catch (error) {
    console.error("requestLoginLink failed", error);
    return { status: "error", message: "We could not send the link just now. Please try again." };
  }
  return { status: "sent" };
}
