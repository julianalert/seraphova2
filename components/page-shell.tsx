import type { ReactNode } from "react";
import { Sky } from "./sky";
import { Wordmark } from "./wordmark";

/** Centered single-column page with the site bar, used for sign-in and notices. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Sky />
      <div className="start-page">
        <nav className="start-nav" aria-label="Site">
          <Wordmark />
          <p className="start-nav-tagline">Daily personalized horoscope, based on your natal chart.</p>
        </nav>
        <main className="onboarding">
          <div className="onboarding-inner ob-center" style={{ maxWidth: 440 }}>
            <div className="screen">{children}</div>
          </div>
        </main>
      </div>
    </>
  );
}
