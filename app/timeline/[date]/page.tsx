import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { Reading } from "@/lib/types";
import { ReadingArticle } from "./reading-article";

export const metadata: Metadata = { title: "Your reading" };

export default function ReadingPage({ params }: PageProps<"/timeline/[date]">) {
  return (
    <main className="inner-main inner-main--narrow">
      <Suspense fallback={<p className="section-eyebrow" style={{ textAlign: "center", padding: "96px 0" }}>Opening your reading</p>}>
        <ReadingView params={params} />
      </Suspense>
    </main>
  );
}

async function ReadingView({ params }: Pick<PageProps<"/timeline/[date]">, "params">) {
  await connection();
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const supabase = await supabaseServer();
  const { data } = await supabase.from("seraphova_readings").select("*").eq("reading_date", date).maybeSingle();
  const reading = data as Reading | null;
  if (!reading) notFound();

  return <ReadingArticle reading={reading} />;
}
