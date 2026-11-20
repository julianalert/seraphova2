"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Full-screen "reading the sky" interstitial with steps that tick off. */
export function LoadingScreen({ title, sub, steps }: { title: ReactNode; sub: string; steps: string[] }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = steps.slice(1).map((_, i) => setTimeout(() => setStep(i + 1), 1400 * (i + 1)));
    return () => timers.forEach(clearTimeout);
  }, [steps]);

  return (
    <div id="loadingScreen" role="status">
      <div className="loading-orb" />
      <h2 className="loading-title">{title}</h2>
      <p className="loading-sub">{sub}</p>
      <div className="loading-steps">
        {steps.map((label, i) => (
          <div key={label} className={`loading-step ${i < step ? "done" : i === step ? "active" : ""}`}>
            <div className="step-icon">{i < step ? "✓" : "⟳"}</div>
            <p>{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
