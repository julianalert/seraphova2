import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <PageShell>
      <p className="ob-eyebrow">Members</p>
      <h1 className="ob-title">
        Return to <em>your readings.</em>
      </h1>
      <p className="ob-sub">No password to remember. We email you a link.</p>
      <LoginForm />
      <div className="ob-footer">
        Not a member yet? <Link href="/begin">Begin your reading</Link>
      </div>
    </PageShell>
  );
}
