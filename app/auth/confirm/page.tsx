import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { confirmLogin } from "./actions";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

const wide = { padding: "16px 24px", fontSize: "15px", borderRadius: "var(--r2)" };

// The emailed link lands here. Signing in takes a click so that mail scanners
// which open links ahead of the reader cannot spend the one-time token.
export default function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  return (
    <PageShell>
      <Suspense fallback={<p className="ob-eyebrow">One moment</p>}>
        <Confirm searchParams={searchParams} />
      </Suspense>
    </PageShell>
  );
}

async function Confirm({ searchParams }: Pick<PageProps<"/auth/confirm">, "searchParams">) {
  const { token_hash: token, expired } = await searchParams;

  if (expired || typeof token !== "string" || !token) {
    return (
      <>
        <p className="ob-eyebrow">Link expired</p>
        <h1 className="ob-title">
          That link has <em>already been used.</em>
        </h1>
        <p className="ob-sub">Sign-in links work once. Ask for a fresh one and you are in.</p>
        <Link href="/login" className="btn btn-gold btn-full" style={wide}>
          Send me a new one →
        </Link>
      </>
    );
  }

  return (
    <>
      <p className="ob-eyebrow">Welcome back</p>
      <h1 className="ob-title">
        Your readings <em>are waiting.</em>
      </h1>
      <p className="ob-sub">One more step to open your personal space.</p>
      <form action={confirmLogin}>
        <input type="hidden" name="token_hash" value={token} />
        <button type="submit" className="btn btn-gold btn-full" style={wide}>
          Enter Seraphova →
        </button>
      </form>
    </>
  );
}
