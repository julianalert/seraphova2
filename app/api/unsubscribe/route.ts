import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { verifyUserToken } from "@/lib/token";

async function pause(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get("u") ?? "";
  const token = request.nextUrl.searchParams.get("t") ?? "";
  if (!userId || !verifyUserToken(userId, "unsubscribe", token)) return false;
  await supabaseAdmin().from("seraphova_profiles").update({ email_paused: true }).eq("id", userId);
  return true;
}

export async function GET(request: NextRequest) {
  redirect((await pause(request)) ? "/unsubscribed" : "/");
}

// One-click unsubscribe from mail clients (List-Unsubscribe-Post).
export async function POST(request: NextRequest) {
  return new Response(null, { status: (await pause(request)) ? 200 : 400 });
}
