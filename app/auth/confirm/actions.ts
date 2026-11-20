"use server";

import { redirect } from "next/navigation";
import { signInWithToken } from "@/lib/auth";

export async function confirmLogin(formData: FormData) {
  const token = String(formData.get("token_hash") ?? "");
  const ok = token ? await signInWithToken(token) : false;
  redirect(ok ? "/timeline" : "/auth/confirm?expired=1");
}
