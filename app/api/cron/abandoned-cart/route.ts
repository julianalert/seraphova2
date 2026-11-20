import type { NextRequest } from "next/server";
import { runCartSequence } from "@/lib/cart";

export const maxDuration = 120;

// Runs every 15 minutes (vercel.json). Reminds people who cast a chart but did not pay.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await runCartSequence());
  } catch (error) {
    console.error("Cart sequence failed", error);
    return Response.json({ error: "failed" }, { status: 500 });
  }
}
