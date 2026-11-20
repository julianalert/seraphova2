"use client";

import { useFormStatus } from "react-dom";
import { PRICE_LABEL } from "@/lib/env";

export function PayButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-order">
      {pending ? (
        "Redirecting to payment…"
      ) : (
        <>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="1" y="4" width="22" height="16" rx="2" />
            <path d="M1 10h22" />
          </svg>
          Get my year of readings — {PRICE_LABEL}
        </>
      )}
    </button>
  );
}
