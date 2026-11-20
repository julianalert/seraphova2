"use client";

import { useActionState } from "react";
import { adminLogin, type AdminLoginState } from "../actions";

const initial: AdminLoginState = {};

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(adminLogin, initial);
  return (
    <form action={action} className="ob-fields" style={{ textAlign: "left" }}>
      <div className="ob-field">
        <label className="label" htmlFor="admin-password">
          Password
        </label>
        <input id="admin-password" className="input" type="password" name="password" autoComplete="current-password" required />
        {state.error && (
          <span className="ob-error" role="alert">
            {state.error}
          </span>
        )}
      </div>
      <button
        type="submit"
        className="btn btn-gold btn-full"
        style={{ padding: "16px 24px", fontSize: "15px", borderRadius: "var(--r2)" }}
        disabled={pending}
      >
        {pending ? "Checking…" : "Open the dashboard →"}
      </button>
    </form>
  );
}
