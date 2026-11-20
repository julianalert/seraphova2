// Local preview of the reading page with a sample reading. Not available in production.
import { notFound } from "next/navigation";
import { Sky } from "@/components/sky";
import { Wordmark } from "@/components/wordmark";
import { ReadingArticle } from "@/app/timeline/[date]/reading-article";
import { computeNatalChart } from "@/lib/astro/chart";
import { computeDailySky } from "@/lib/astro/transits";
import type { Reading } from "@/lib/types";

const chart = computeNatalChart({ date: "1994-07-28", time: "10:18", lat: 37.7749, lon: -122.4194, tz: "America/Los_Angeles" });

// A real reading written by the model for this sample chart on 20 November 2026.
const reading = {
  id: "sample",
  user_id: "sample",
  reading_date: "2026-11-20",
  headline: "Choices about leaving work",
  theme: "Measured boldness",
  opening:
    "Maya, the question of whether to leave your job this winter is sitting at the center of your head today, and that’s exactly where it needs to be. You tend to keep your ambitions private and like to test ideas quietly before you make them visible; that style will help you now.\n\nThere’s a restless undercurrent pushing you toward change, but it isn’t a clean shove so much as a series of small shocks—unexpected information, a flattering message, a new sense of what you actually value. Treat those shocks as clues, not orders.",
  sections: [
    {
      heading: "At work",
      body: "If you’re leaning toward leaving, today is more about taking inventory than about dramatic exits. Look for the specifics: which parts of the job drain you every week, which parts you would miss, and where the people you rely on actually stand. You’re good at spotting detail and at communicating clearly when you need to; use that gift to ask one clarifying question of your manager or to schedule a short review with HR rather than announcing anything. Avoid abrupt ultimatums; you’ll want options, not burned bridges.",
    },
    {
      heading: "Offers, money and standing",
      body: "A tempting note or an unexpectedly kind contact could land today, and it will feel like proof that leaving is possible. That impulse to say yes straightaway is believable—your instincts move fast when a clear opening appears—but press for specifics. Get timelines, salary ranges, and the scope of work in writing before you let a shiny possibility steer you. Also run a quick practical check: three months’ living costs, and what would change in your daily schedule. The numbers will steady the impulse.",
    },
    {
      heading: "How you’ll feel and how to move",
      body: "You may feel unusually restless and sharper with people—small annoyances will stand out more than usual. That’s not a sign you must act immediately; it’s a signal to clear small obstacles so your bigger decision becomes visible. Do one low-effort but concrete thing that moves the process forward: update the top third of your résumé, or send a one-paragraph message to one trusted contact asking for an honest read on your options. Those micro-steps will calm the rush and give you leverage.",
    },
  ],
  invitation:
    "Before you reply to any offer or make a decision, write three non-negotiables a new job must meet and compare them with exactly what your current role gives you.",
  sky: {
    ...computeDailySky(chart, new Date("2026-11-20T07:00:00Z")),
    notes: [
      { transit: "Jupiter square your Pluto", meaning: "The background pressure to transform your career or finances is the reason today’s choices feel urgent and consequential." },
      { transit: "Venus square your Uranus", meaning: "The sudden, impatient impulses around money, rewards or relationships at work explain why an unexpected message could feel like a sign to leave right now." },
      { transit: "Venus trine your Midheaven", meaning: "You can make a quietly good impression on people who matter for your reputation today, so small demonstrations of competence may open real options." },
    ],
  },
  model: "sample",
  sent_at: null,
  created_at: "2026-11-20T07:00:00Z",
} as Reading;

export default function ReadingPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <>
      <Sky />
      <div className="inner">
        <nav className="start-nav" aria-label="Site">
          <Wordmark href="/timeline" />
          <span className="nav-action">Sign out</span>
        </nav>
        <main className="inner-main inner-main--narrow">
          <ReadingArticle reading={reading} />
        </main>
      </div>
    </>
  );
}
