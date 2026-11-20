"use server";

import { redirect } from "next/navigation";
import { PRICE_CENTS, appUrl } from "@/lib/env";
import { recordEvent } from "@/lib/funnel-server";
import { stripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function startCheckout(formData: FormData) {
  const profileId = String(formData.get("profileId") ?? "");
  const found = await supabaseAdmin()
    .from("seraphova_profiles")
    .select("id, email, status, visitor_id")
    .eq("id", profileId)
    .maybeSingle();
  const profile = found.data as Pick<Profile, "id" | "email" | "status" | "visitor_id"> | null;
  if (!profile) redirect("/begin");
  if (profile.status === "active") redirect("/login");

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    customer_email: profile.email,
    client_reference_id: profile.id,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PRICE_CENTS,
          product_data: {
            name: "Seraphova: one year of daily readings",
            description: "A personal horoscope every morning for 365 days, written from your birth chart.",
          },
        },
      },
    ],
    success_url: `${appUrl()}/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/order?p=${profile.id}`,
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");
  await recordEvent(profile.visitor_id, "checkout_start", profile.id);
  redirect(session.url);
}
