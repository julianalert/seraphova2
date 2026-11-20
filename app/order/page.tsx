import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after, connection } from "next/server";
import { LoadingScreen } from "@/components/loading-screen";
import { Sky } from "@/components/sky";
import { recordEvent } from "@/lib/funnel-server";
import { ensureReading } from "@/lib/reading";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { localDateString } from "@/lib/time";
import type { Profile } from "@/lib/types";
import { OrderView } from "./order-view";

export const metadata: Metadata = { title: "Your reading is ready" };
export const maxDuration = 120;

const LOADING_STEPS = ["Mapping your natal chart", "Reading today's planetary transits", "Writing your personal reading"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function OrderPage({ searchParams }: PageProps<"/order">) {
  return (
    <>
      <Sky />
      <Suspense
        fallback={
          <LoadingScreen
            title={
              <>
                Reading the sky
                <br />
                <em>for you…</em>
              </>
            }
            sub="Your chart is being interpreted"
            steps={LOADING_STEPS}
          />
        }
      >
        <Order searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Order({ searchParams }: Pick<PageProps<"/order">, "searchParams">) {
  // The page depends on the current sky, so it is always rendered on request.
  await connection();
  const { p } = await searchParams;
  const profileId = typeof p === "string" && UUID.test(p) ? p : null;
  if (!profileId) redirect("/begin");

  const found = await supabaseAdmin().from("seraphova_profiles").select("*").eq("id", profileId).maybeSingle();
  const profile = found.data as Profile | null;
  if (!profile) redirect("/begin");
  if (profile.status === "active") redirect("/timeline");

  after(() => recordEvent(profile.visitor_id, "order_view", profile.id));

  // Their first reading is written now and shown as a preview. It is saved, so it
  // becomes the reading they receive the moment they join.
  const now = new Date();
  const reading = await ensureReading(profile, localDateString(now, profile.timezone)).catch((error) => {
    console.error("Preview reading failed", profile.id, error);
    return null;
  });
  return <OrderView profile={profile} reading={reading} now={now} />;
}
