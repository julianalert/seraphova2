import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";

export const metadata: Metadata = { title: "Emails paused", robots: { index: false } };

export default function UnsubscribedPage() {
  return (
    <PageShell>
      <p className="ob-eyebrow">Emails stopped</p>
      <h1 className="ob-title">
        You won&rsquo;t hear <em>from us by email.</em>
      </h1>
      <p className="ob-sub">
        If you are a member, your readings are still written every day and wait for you in your personal
        space.
      </p>
      <Link
        href="/timeline"
        className="btn btn-gold btn-full"
        style={{ padding: "16px 24px", fontSize: "15px", borderRadius: "var(--r2)" }}
      >
        Open my readings →
      </Link>
    </PageShell>
  );
}
