import { recordEvent } from "@/lib/funnel-server";
import type { FunnelEvent } from "@/lib/funnel";

// Steps the browser may report. Later steps are recorded by the server itself.
const CLIENT_EVENTS: FunnelEvent[] = ["quiz_start", "birth_date", "birth_time", "birth_city", "focus", "situation", "delivery_time"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { event?: unknown; visitor?: unknown } | null;
  const event = CLIENT_EVENTS.find((e) => e === body?.event);
  const visitor = typeof body?.visitor === "string" && UUID.test(body.visitor) ? body.visitor : null;
  if (!event || !visitor) return new Response(null, { status: 400 });

  await recordEvent(visitor, event);
  return new Response(null, { status: 204 });
}
