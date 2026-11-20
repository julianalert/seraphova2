"use client";

import { useActionState } from "react";
import { requestLoginLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(requestLoginLink, initial);

  if (state.status === "sent") {
    return (
      <div className="ob-trust-box" role="status" style={{ textAlign: "left" }}>
        <span className="ob-trust-icon">📬</span>
        <p className="ob-trust-text">
          <strong>Check your inbox.</strong> If that email belongs to a member, a sign-in link is on its way.
          It works once and expires in an hour.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="ob-fields" style={{ textAlign: "left" }}>
      <div className="ob-field">
        <label className="label" htmlFor="login-email">
          Email address
        </label>
        <input
          id="login-email"
          className="input"
          type="email"
          name="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
        />
        {state.status === "error" && (
          <span className="ob-error" role="alert">
            {state.message}
          </span>
        )}
      </div>
      <button
        type="submit"
        className="btn btn-gold btn-full"
        style={{ padding: "16px 24px", fontSize: "15px", borderRadius: "var(--r2)" }}
        disabled={pending}
      >
        {pending ? "Sending…" : "Email me a sign-in link →"}
      </button>
    </form>
  );
}
