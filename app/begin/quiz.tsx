"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoadingScreen } from "@/components/loading-screen";
import { Sky } from "@/components/sky";
import type { FunnelEvent } from "@/lib/funnel";
import { track, visitorId } from "@/lib/track-client";
import { DELIVERY_HOURS, FOCUS_AREAS, MIN_AGE, RECOMMENDED_HOUR, type FocusId } from "@/lib/types";
import { createProfile } from "./actions";

type City = { label: string; lat: number; lon: number; tz: string };

const THIS_YEAR = new Date().getFullYear();
const STEP_COUNT = 7;
// The funnel event recorded when each step is completed. The last step is recorded
// by the server, when the profile is saved.
const STEP_EVENTS: (FunnelEvent | null)[] = ["birth_date", "birth_time", "birth_city", "focus", "situation", "delivery_time", null];
const LOADING_STEPS = ["Mapping your natal chart", "Reading today's planetary transits", "Preparing your reading"];
const WIDE = { marginTop: 32, padding: "16px 24px", fontSize: "15px", borderRadius: "var(--r2)" } as const;

const pad = (n: number | string) => String(n).padStart(2, "0");
const noSubscription = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function Step({
  number,
  label,
  title,
  sub,
  children,
}: {
  number: number;
  label: string;
  title: ReactNode;
  sub?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="screen">
      <p className="ob-eyebrow">
        Step {number} of {STEP_COUNT} · {label}
      </p>
      <h1 className="ob-title">{title}</h1>
      {sub ? <p className="ob-sub">{sub}</p> : <div style={{ height: 24 }} />}
      <div className="ob-fields">{children}</div>
    </div>
  );
}

export function Quiz() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  const [month, setMonth] = useState("");
  const [day, setDay] = useState("");
  const [year, setYear] = useState("");

  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<City[]>([]);
  const [city, setCity] = useState<City | null>(null);

  const [focus, setFocus] = useState<FocusId | null>(null);
  const [deliveryHour, setDeliveryHour] = useState<number>(RECOMMENDED_HOUR);
  // The visitor's own timezone; "UTC" only while rendering on the server.
  const timezone = useSyncExternalStore(noSubscription, browserTimeZone, () => "UTC");

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [context, setContext] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState<{ message: string; member: boolean } | null>(null);

  useEffect(() => track("quiz_start"), []);

  // City search, debounced, ignoring stale responses.
  const searchId = useRef(0);
  useEffect(() => {
    const query = cityQuery.trim();
    if (city || query.length < 2) return;
    const id = ++searchId.current;
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/cities?q=${encodeURIComponent(query)}`);
        const data = (await response.json()) as { cities: City[] };
        if (id === searchId.current) setCityResults(data.cities);
      } catch {
        if (id === searchId.current) setCityResults([]);
      }
    }, 160);
    return () => clearTimeout(timer);
  }, [cityQuery, city]);

  const visibleCities = city || cityQuery.trim().length < 2 ? [] : cityResults;
  const timezoneName = timezone.split("/").pop()!.replace(/_/g, " ");

  function birthDate(): string | null {
    const m = Number(month);
    const d = Number(day);
    const y = Number(year);
    if (!m || !d || !y || m > 12 || y < 1900 || y > THIS_YEAR) return null;
    const real = new Date(Date.UTC(y, m - 1, d));
    if (real.getUTCMonth() !== m - 1 || real.getUTCDate() !== d) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  }

  /** Seraphova is for adults: the birth date must be at least MIN_AGE years ago. */
  function isAdult(date: string) {
    const now = new Date();
    return date <= `${now.getFullYear() - MIN_AGE}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  const date = birthDate();
  const canContinue = [
    date !== null && isAdult(date),
    timeUnknown || birthTime !== "",
    city !== null,
    focus !== null,
    true,
    true,
    firstName.trim().length > 0 && /^\S+@\S+\.\S+$/.test(email.trim()),
  ][step];

  function advance(from: number) {
    const event = STEP_EVENTS[from];
    if (event) track(event);
    setStep(from + 1);
  }

  async function submit() {
    if (!date || !city || !focus) return;
    setSubmitting(true);
    setApiError(null);

    const [result] = await Promise.all([
      createProfile({
        birthDate: date,
        birthTime: timeUnknown ? null : birthTime || null,
        city,
        focus,
        deliveryHour,
        timezone,
        firstName,
        email: email.trim(),
        context,
        visitor: visitorId(),
      }).catch(() => ({
        ok: false as const,
        reason: "error" as const,
        message: "Network error. Please check your connection and try again.",
      })),
      // Let the chart-building steps play out even when the server is quick.
      new Promise((resolve) => setTimeout(resolve, 3600)),
    ]);

    if (result.ok) {
      router.push(`/order?p=${result.profileId}`);
      return;
    }
    setSubmitting(false);
    setApiError({ message: result.message, member: result.reason === "member" });
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canContinue || submitting) return;
    if (step < STEP_COUNT - 1) advance(step);
    else void submit();
  }

  if (submitting) {
    return (
      <LoadingScreen
        title={
          <>
            Reading the sky
            <br />
            <em>for you…</em>
          </>
        }
        sub="Your chart is being cast"
        steps={LOADING_STEPS}
      />
    );
  }

  return (
    <>
      <Sky />
      <div className="start-page">
        <nav className="start-nav" aria-label="Site">
          <Link href="/" className="start-nav-logo">
            ✦ Seraphova
          </Link>
          <p className="start-nav-tagline">Daily personalized horoscope, based on your natal chart.</p>
        </nav>

        <main className="onboarding">
          <form className="onboarding-inner" onSubmit={onSubmit} noValidate>
            <div
              className="ob-progress"
              role="progressbar"
              aria-label="Quiz progress"
              aria-valuemin={1}
              aria-valuemax={STEP_COUNT}
              aria-valuenow={step + 1}
            >
              {Array.from({ length: STEP_COUNT }, (_, i) => (
                <div key={i} className={`ob-step ${i < step ? "done" : i === step ? "active" : ""}`} />
              ))}
            </div>

            {/* Above the buttons, so the city list can open over them. */}
            <div key={step} style={{ position: "relative", zIndex: 5 }}>
              {step === 0 && (
                <Step
                  number={1}
                  label="Your birth date"
                  title={
                    <>
                      Let&apos;s read <em>your chart.</em>
                    </>
                  }
                  sub="Your natal chart is the foundation of every reading you'll receive. It starts with the day you were born."
                >
                  <div className="ob-field">
                    <label className="label" htmlFor="birth-month">
                      Date of birth <span>*</span>
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 2fr", gap: 8 }}>
                      <input
                        id="birth-month"
                        className="input"
                        type="number"
                        inputMode="numeric"
                        placeholder="MM"
                        aria-label="Month of birth"
                        min={1}
                        max={12}
                        autoFocus
                        value={month}
                        onChange={(e) => setMonth(e.target.value.slice(0, 2))}
                      />
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        placeholder="DD"
                        aria-label="Day of birth"
                        min={1}
                        max={31}
                        value={day}
                        onChange={(e) => setDay(e.target.value.slice(0, 2))}
                      />
                      <input
                        className="input"
                        type="number"
                        inputMode="numeric"
                        placeholder="YYYY"
                        aria-label="Year of birth"
                        min={1900}
                        max={THIS_YEAR}
                        value={year}
                        onChange={(e) => setYear(e.target.value.slice(0, 4))}
                      />
                    </div>
                    {month && day && year.length === 4 && !date && (
                      <span className="ob-error">That date does not look right.</span>
                    )}
                    {date && !isAdult(date) && (
                      <span className="ob-error">Seraphova is for adults: you need to be {MIN_AGE} or older.</span>
                    )}
                  </div>
                </Step>
              )}

              {step === 1 && (
                <Step
                  number={2}
                  label="Your birth time"
                  title={
                    <>
                      What time <em>were you born?</em>
                    </>
                  }
                  sub="It reveals your rising sign and the houses of your chart. It is often written on a birth certificate."
                >
                  <div className="ob-field">
                    <label className="label" htmlFor="birth-time">
                      Time of birth
                    </label>
                    <input
                      id="birth-time"
                      className="input"
                      type="time"
                      autoFocus
                      disabled={timeUnknown}
                      style={timeUnknown ? { opacity: 0.4 } : undefined}
                      value={birthTime}
                      onChange={(e) => setBirthTime(e.target.value)}
                    />
                  </div>
                  <label className="ob-check">
                    <input
                      type="checkbox"
                      checked={timeUnknown}
                      onChange={(e) => setTimeUnknown(e.target.checked)}
                    />
                    I don&apos;t know my birth time
                  </label>
                  {timeUnknown && (
                    <span className="ob-hint">
                      No problem. We cast your chart for midday and leave out the rising sign and houses, rather
                      than guess. A birth certificate or a parent is the best place to look.
                    </span>
                  )}
                </Step>
              )}

              {step === 2 && (
                <Step
                  number={3}
                  label="Your birth place"
                  title={
                    <>
                      Where <em>were you born?</em>
                    </>
                  }
                  sub="The city fixes the horizon your chart is drawn against."
                >
                  <div className="ob-field">
                    <label className="label" htmlFor="birth-city">
                      City of birth <span>*</span>
                    </label>
                    {city ? (
                      <div className="city-picked">
                        <span>{city.label}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCity(null);
                            setCityQuery("");
                          }}
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <div className="city-wrap">
                        <input
                          id="birth-city"
                          className="input"
                          type="text"
                          placeholder="e.g. Paris, France"
                          autoComplete="off"
                          autoFocus
                          value={cityQuery}
                          onChange={(e) => setCityQuery(e.target.value)}
                        />
                        {visibleCities.length > 0 && (
                          <ul className="city-list">
                            {visibleCities.map((result) => (
                              <li key={`${result.label}${result.lat}${result.lon}`}>
                                <button type="button" onClick={() => setCity(result)}>
                                  {result.label}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                    {!city && cityQuery.trim().length >= 3 && visibleCities.length === 0 && (
                      <span className="ob-hint">No match yet. Try the nearest larger town.</span>
                    )}
                  </div>
                </Step>
              )}

              {step === 3 && (
                <Step
                  number={4}
                  label="Your focus"
                  title={
                    <>
                      What&apos;s most <em>on your mind?</em>
                    </>
                  }
                  sub="Your readings are written toward it. You can change it whenever life moves."
                >
                  <div className="choice-grid" role="radiogroup" aria-label="What's most on your mind?">
                    {FOCUS_AREAS.map((area) => (
                      <button
                        key={area.id}
                        type="button"
                        role="radio"
                        aria-checked={focus === area.id}
                        className={`choice-card ${focus === area.id ? "selected" : ""}`}
                        onClick={() => {
                          setFocus(area.id);
                          setTimeout(() => advance(3), 220);
                        }}
                      >
                        <span className="choice-icon">{area.emoji}</span>
                        <span className="choice-label">{area.label}</span>
                      </button>
                    ))}
                  </div>
                </Step>
              )}

              {step === 4 && (
                <Step
                  number={5}
                  label="Your situation"
                  title={
                    <>
                      What keeps <em>repeating?</em>
                    </>
                  }
                  sub="Optional. A pattern, a place you feel stuck, a decision you keep circling. One or two sentences in your own words, and your readings will speak to it."
                >
                  <div className="ob-field">
                    <label className="label" htmlFor="context">
                      In your own words
                    </label>
                    <textarea
                      id="context"
                      className="input"
                      placeholder="e.g. I keep pulling away as soon as someone gets close."
                      maxLength={600}
                      autoFocus
                      value={context}
                      onChange={(e) => setContext(e.target.value)}
                    />
                    <span className="ob-hint">
                      Only used to write your readings. You can change it whenever life moves.
                    </span>
                  </div>
                </Step>
              )}

              {step === 5 && (
                <Step
                  number={6}
                  label="Your morning"
                  title={
                    <>
                      When would you like <em>your reading?</em>
                    </>
                  }
                  sub={`Every morning at this hour, ${timezoneName} time.`}
                >
                  <div className="time-options" role="radiogroup" aria-label="Delivery time">
                    {DELIVERY_HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        role="radio"
                        aria-checked={deliveryHour === h}
                        className={`time-opt ${deliveryHour === h ? "selected" : ""}`}
                        onClick={() => setDeliveryHour(h)}
                      >
                        {h === RECOMMENDED_HOUR ? `${h}am ✦` : `${h}am`}
                      </button>
                    ))}
                  </div>
                </Step>
              )}

              {step === 6 && (
                <Step
                  number={7}
                  label="Your reading"
                  title={
                    <>
                      Where should we send it, <em>every morning?</em>
                    </>
                  }
                  sub="Your personalized horoscope will land in your inbox before you start your day."
                >
                  <div className="ob-field">
                    <label className="label" htmlFor="first-name">
                      Your first name <span>*</span>
                    </label>
                    <input
                      id="first-name"
                      className="input"
                      type="text"
                      placeholder="e.g. Sofia"
                      autoComplete="given-name"
                      autoFocus
                      maxLength={40}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="ob-field">
                    <label className="label" htmlFor="email">
                      Email address <span>*</span>
                    </label>
                    <input
                      id="email"
                      className="input"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div className="ob-trust-box" style={{ marginBottom: 0 }}>
                    <span className="ob-trust-icon">📬</span>
                    <p className="ob-trust-text">
                      <strong>Your reading is written fresh every day</strong> from your natal chart and that
                      day&apos;s planetary transits: the positions are calculated, the writing is AI-assisted. We
                      use your email to send your readings and to let you know your chart is ready — we never
                      share it.
                    </p>
                  </div>
                </Step>
              )}
            </div>

            {apiError && (
              <div className="ob-api-error" role="alert">
                {apiError.message}{" "}
                {apiError.member && (
                  <Link href="/login" style={{ textDecoration: "underline" }}>
                    Sign in
                  </Link>
                )}
              </div>
            )}

            {step !== 3 && (
              <button type="submit" className="btn btn-gold btn-full" style={WIDE} disabled={!canContinue}>
                {step === STEP_COUNT - 1
                  ? "Start my daily reading →"
                  : step === 4 && !context.trim()
                    ? "Skip for now →"
                    : "Continue →"}
              </button>
            )}

            {step > 0 && (
              <button type="button" className="ob-back" onClick={() => setStep(step - 1)}>
                ← Back
              </button>
            )}

            <div className="ob-footer">Your data is used only to generate your daily reading.</div>
          </form>
        </main>
      </div>
    </>
  );
}
