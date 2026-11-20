"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_MAX_AGE_SECONDS, createAdminToken } from "@/lib/admin-session";

export type AdminLoginState = { error?: string };

const digest = (value: string) => createHash("sha256").update(value).digest();

export async function adminLogin(_previous: AdminLoginState, formData: FormData): Promise<AdminLoginState> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: "The dashboard is closed: ADMIN_PASSWORD is not set." };

  const given = String(formData.get("password") ?? "");
  if (!timingSafeEqual(digest(given), digest(expected))) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 750));
    return { error: "That password is not right." };
  }

  (await cookies()).set(ADMIN_COOKIE, await createAdminToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/admin",
    maxAge: ADMIN_MAX_AGE_SECONDS,
  });
  redirect("/admin");
}

export async function adminLogout() {
  (await cookies()).delete({ name: ADMIN_COOKIE, path: "/admin" });
  redirect("/admin/login");
}
