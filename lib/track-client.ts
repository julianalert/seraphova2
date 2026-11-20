import type { FunnelEvent } from "./funnel";

const KEY = "seraphova-visitor";

/** A random id that identifies this browser through the funnel. No personal data. */
export function visitorId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Records that this visitor reached a funnel step. Never throws, never blocks. */
export function track(event: FunnelEvent) {
  try {
    const visitor = visitorId();
    if (!visitor) return;
    const body = JSON.stringify({ event, visitor });
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true });
    }
  } catch {}
}
