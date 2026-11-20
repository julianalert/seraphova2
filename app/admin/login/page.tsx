import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { AdminLoginForm } from "./login-form";

export const metadata: Metadata = { title: "Dashboard sign-in", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <PageShell>
      <p className="ob-eyebrow">Owner</p>
      <h1 className="ob-title">
        Seraphova <em>dashboard.</em>
      </h1>
      <p className="ob-sub">Funnel, sales and reminder emails.</p>
      <AdminLoginForm />
    </PageShell>
  );
}
