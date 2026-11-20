import { after } from "next/server";
import type Stripe from "stripe";
import { activateProfile, deliverFirstReading } from "@/lib/activate";
import { requireEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe";

export const maxDuration = 300;

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      payload,
      signature ?? "",
      requireEnv("STRIPE_WEBHOOK_SECRET"),
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object;
    const profileId = session.client_reference_id;
    if (profileId && session.payment_status === "paid") {
      const { profile, activated } = await activateProfile(profileId, {
        sessionId: session.id,
        customerId: typeof session.customer === "string" ? session.customer : null,
        amountCents: session.amount_total ?? 0,
        currency: session.currency ?? "usd",
      });
      if (profile && activated) {
        after(() =>
          deliverFirstReading(profile).catch((error) =>
            console.error("First reading failed", profile.id, error),
          ),
        );
      }
    }
  }

  return Response.json({ received: true });
}
