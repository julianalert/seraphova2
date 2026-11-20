import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after, connection } from "next/server";
import { currentProfile } from "@/lib/auth";
import { refreshMemoryIfDue } from "@/lib/memory";
import { ensureReading } from "@/lib/reading";
import { supabaseServer } from "@/lib/supabase/server";
import { localDateString } from "@/lib/time";
import type { Profile, Reading } from "@/lib/types";
import { Refresher } from "./refresher";
import { Featured, TimelineView, Waiting } from "./timeline-view";

export const metadata: Metadata = { title: "Your readings" };
export const maxDuration = 120;

export default function TimelinePage() {
  return (
    <main className="inner-main">
      <Suspense fallback={<Waiting label="Opening your timeline" />}>
        <Timeline />
      </Suspense>
    </main>
  );
}

async function Timeline() {
  // Everything below depends on the current time and the signed-in member.
  await connection();
  const profile = await currentProfile();
  if (!profile) redirect("/login");
  if (profile.status === "lead") redirect(`/order?p=${profile.id}`);

  const supabase = await supabaseServer();
  const { data } = await supabase
    .from("seraphova_readings")
    .select("*")
    .order("reading_date", { ascending: false })
    .limit(400);
  const readings = (data ?? []) as Reading[];

  const now = new Date();
  const today = localDateString(now, profile.timezone);
  const active = profile.status === "active" && !!profile.access_until && new Date(profile.access_until) > now;
  const hasToday = readings[0]?.reading_date === today;
  // Right after payment the first reading is already being written in the background.
  const justJoined = !!profile.paid_at && now.getTime() - new Date(profile.paid_at).getTime() < 3 * 60 * 1000;
  const past = hasToday ? readings.slice(1) : readings;

  const todaySlot = hasToday ? (
    <Featured reading={readings[0]} />
  ) : active ? (
    <Suspense
      fallback={
        <Waiting
          label="Reading this morning's sky"
          note="Your reading is being written. It takes about half a minute."
        />
      }
    >
      <Today profile={profile} today={today} justJoined={justJoined} />
    </Suspense>
  ) : null;

  return <TimelineView profile={profile} today={today} active={active} past={past} todaySlot={todaySlot} />;
}

/** Today's reading does not exist yet: write it now, unless the purchase just happened. */
async function Today({
  profile,
  today,
  justJoined,
}: {
  profile: Profile;
  today: string;
  justJoined: boolean;
}) {
  if (justJoined) {
    return (
      <>
        <Refresher />
        <Waiting
          label="Writing your first reading"
          note="Your chart is cast and your reading is on its way. This page will update by itself."
        />
      </>
    );
  }

  const reading = await ensureReading(profile, today).catch((error) => {
    console.error("On-demand reading failed", profile.id, error);
    return null;
  });
  if (!reading) {
    return (
      <Waiting
        label="The sky is taking its time"
        note="Today's reading is not ready yet. Please look again in a few minutes."
      />
    );
  }
  after(() =>
    refreshMemoryIfDue(profile.id).catch((error) =>
      console.error("Memory update failed", profile.id, error),
    ),
  );
  return <Featured reading={reading} />;
}
