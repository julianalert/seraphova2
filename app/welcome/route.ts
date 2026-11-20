import { after, type NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { activateProfile, deliverFirstReading } from "@/lib/activate";
import { createLoginToken, signInWithToken } from "@/lib/auth";
import { stripe } from "@/lib/stripe";

export const maxDuration = 300;

// Stripe sends the buyer here after paying.
export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("session_id");
  if (!sessionId) redirect("/");

  const session = await stripe().checkout.sessions.retrieve(sessionId);
  const profileId = session.client_reference_id;
  if (!profileId) redirect("/");
  if (session.payment_status !== "paid") redirect(`/order?p=${profileId}`);

  const { profile, activated } = await activateProfile(profileId, {
    sessionId: session.id,
    customerId: typeof session.customer === "string" ? session.customer : null,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? "usd",
  });
  if (!profile) redirect("/");

  if (activated) {
    after(() =>
      deliverFirstReading(profile).catch((error) =>
        console.error("First reading failed", profile.id, error),
      ),
    );
  }

  // The checkout session id is known only to the buyer, so it can sign them in,
  // but only shortly after the purchase: afterwards the link is just a link.
  const fresh = Date.now() - session.created * 1000 < 2 * 3600 * 1000;
  const token = fresh ? await createLoginToken(profile.email) : null;
  if (token && (await signInWithToken(token))) redirect("/timeline");
  redirect("/login");
}
