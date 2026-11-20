import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Sky } from "@/components/sky";
import { Wordmark } from "@/components/wordmark";
import { requireAdmin } from "@/lib/admin-auth";
import { RANGES, getAdminStats, type RangeId } from "@/lib/admin-data";
import { adminLogout } from "./actions";
import { Report } from "./report";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <Sky />
      <div className="inner">
        <nav className="start-nav" aria-label="Site">
          <Wordmark href="/admin" />
          <form action={adminLogout}>
            <button type="submit" className="nav-action">
              Sign out
            </button>
          </form>
        </nav>
        <main className="adm-main">
          <Suspense fallback={<p className="section-eyebrow" style={{ textAlign: "center", padding: "96px 0" }}>Loading the numbers</p>}>
            <Dashboard searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </>
  );
}

async function Dashboard({ searchParams }: Pick<PageProps<"/admin">, "searchParams">) {
  await connection();
  await requireAdmin();
  const { range } = await searchParams;
  const rangeId = (RANGES.find((r) => r.id === range)?.id ?? "30d") as RangeId;

  const result = await getAdminStats(rangeId).then(
    (stats) => ({ stats, error: null }),
    (error: unknown) => ({ stats: null, error: error instanceof Error ? error.message : String(error) }),
  );

  return (
    <div className="screen">
      <header className="adm-head">
        <div>
          <p className="section-eyebrow">Owner dashboard</p>
          <h1 className="page-title">
            Funnel &amp; <em>sales.</em>
          </h1>
        </div>
        <div className="time-options" role="tablist" aria-label="Time range">
          {RANGES.map((r) => (
            <Link key={r.id} href={`/admin?range=${r.id}`} className={`time-opt ${r.id === rangeId ? "selected" : ""}`} role="tab" aria-selected={r.id === rangeId}>
              {r.label}
            </Link>
          ))}
        </div>
      </header>

      {result.stats ? (
        <Report stats={result.stats} />
      ) : (
        <div className="ob-api-error" role="alert">
          The numbers could not be loaded: {result.error}. If the database is new, run supabase/schema.sql in the
          Supabase SQL editor first.
        </div>
      )}
    </div>
  );
}
