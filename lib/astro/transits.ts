// The sky on a given day, measured against one person's birth chart.
import * as Astronomy from "astronomy-engine";
import {
  ASPECT_ANGLES,
  BODIES,
  angleDiff,
  bodyLongitude,
  findAspect,
  formatPoint,
  isRetrograde,
  toPoint,
  wholeSignHouse,
  type AspectName,
  type BodyName,
  type NatalChart,
  type Sign,
} from "./chart";
import { isTimed, mergePasses, nearestTarget, passAt, scanPasses, aspectTargets, type TimedBody } from "./timing";

export type Transit = {
  planet: BodyName;
  aspect: AspectName;
  /** Natal point being touched: a planet, "Ascendant" or "Midheaven". */
  natal: string;
  orb: number;
  applying: boolean;
  /** Higher = more worth writing about. */
  weight: number;
  // Timing, as UTC instants. Only present when the sky was computed with `timing`.
  /** When it came into range. */
  since?: string;
  /** The next time it is exact, if that is still ahead in this pass. */
  exact?: string;
  /** When this pass moves out of range. */
  ends?: string;
  /** When it comes back into range for another pass, if the planet turns around. */
  returns?: string;
  /** True when the same transit is listed, with its dates, in `phases`. */
  inPhases?: boolean;
};

/** A slow planet working on one point of the chart over months or years. */
export type LongPhase = {
  planet: TimedBody;
  aspect: AspectName;
  natal: string;
  /** The name people know it by, when it has one. */
  name?: string;
  /** Degrees from exact today. */
  orb: number;
  /** False in the lull between two passes of the same chapter. */
  inRange: boolean;
  /** When the chapter began; undefined when that is further back than was scanned. */
  since?: string;
  /** When it is over for good; undefined when that is further ahead than was scanned. */
  ends?: string;
  /** Every time it is exact during the chapter, past and to come. */
  exact: string[];
  stage: "building" | "peaking" | "easing";
  weight: number;
};

export type SkyPosition = {
  body: BodyName;
  sign: Sign;
  degree: number;
  retrograde: boolean;
  /** House of the natal chart this planet is passing through (birth time known). */
  house?: number;
};

/** A new or full moon within the next few days. */
export type Lunation = {
  kind: "New Moon" | "Full Moon";
  /** Days from the measured moment, to one decimal. */
  inDays: number;
  /** UTC instant it happens. */
  at?: string;
  sign: Sign;
  /** House of the natal chart it falls in (birth time known). */
  house?: number;
};

/** One line of the "where this comes from" block at the end of a reading. */
export type SkyNote = {
  /** The transit or placement, named simply: "Venus square your Uranus". */
  transit: string;
  /** What in the reading it is behind, in everyday words. */
  meaning: string;
};

export type DailySky = {
  /** UTC instant the sky was measured at. */
  moment: string;
  moon: {
    sign: Sign;
    /** Sign the Moon enters later in the day, if it changes. */
    entering?: Sign;
    phase: string;
    illumination: number;
  };
  positions: SkyPosition[];
  retrogrades: BodyName[];
  /** Written with the reading: the astrology behind it, kept out of the reading's own text. */
  notes?: SkyNote[];
  /** The next new or full moon, when one is at most a few days away. */
  lunation?: Lunation;
  /** Planets (other than the Moon) changing sign within a day of this moment. */
  ingresses: { body: BodyName; sign: Sign }[];
  transits: Transit[];
  /** The slow chapters in the background. Only present when computed with `timing`. */
  phases?: LongPhase[];
};

// Slower planets mark longer, deeper chapters; the Moon colours a few hours.
const PLANET_WEIGHT: Record<BodyName, number> = {
  Pluto: 10,
  Neptune: 9,
  Uranus: 9,
  Saturn: 8,
  Jupiter: 7,
  Mars: 5,
  Sun: 4,
  Venus: 4,
  Mercury: 3,
  Moon: 2,
};

const TRANSIT_ORB: Record<BodyName, number> = {
  Pluto: 2,
  Neptune: 2,
  Uranus: 2,
  Saturn: 2.5,
  Jupiter: 2.5,
  Mars: 2,
  Sun: 2,
  Venus: 2,
  Mercury: 2,
  Moon: 4,
};

// What is touched matters as much as what touches it. The Sun, Moon and angles are the
// person; Uranus, Neptune and Pluto sit in the same place for everyone born within a few
// years, so a transit to them says little about one person in particular.
const NATAL_WEIGHT: Record<string, number> = {
  Sun: 1.2,
  Moon: 1.2,
  Ascendant: 1.2,
  Midheaven: 1.1,
  Jupiter: 0.8,
  Saturn: 0.8,
  Uranus: 0.5,
  Neptune: 0.5,
  Pluto: 0.5,
};

const ASPECT_WEIGHT: Record<AspectName, number> = {
  conjunction: 1.25,
  opposition: 1.1,
  square: 1.1,
  trine: 0.9,
  sextile: 0.7,
};

export function moonPhaseName(angle: number) {
  if (angle < 12 || angle >= 348) return "New Moon";
  if (angle < 78) return "Waxing Crescent";
  if (angle < 102) return "First Quarter";
  if (angle < 168) return "Waxing Gibbous";
  if (angle < 192) return "Full Moon";
  if (angle < 258) return "Waning Gibbous";
  if (angle < 282) return "Last Quarter";
  return "Waning Crescent";
}

const LUNATION_WINDOW_DAYS = 3.5;

function nextLunation(chart: NatalChart, moment: Date): Lunation | undefined {
  const candidates = (
    [
      ["New Moon", 0],
      ["Full Moon", 180],
    ] as const
  )
    .map(([kind, angle]) => ({ kind, time: Astronomy.SearchMoonPhase(angle, moment, LUNATION_WINDOW_DAYS) }))
    .filter((c) => c.time)
    .sort((a, b) => a.time!.date.getTime() - b.time!.date.getTime());
  const next = candidates[0];
  if (!next?.time) return undefined;

  const when = next.time.date;
  const lon = bodyLongitude("Moon", when);
  return {
    kind: next.kind,
    inDays: Math.round(((when.getTime() - moment.getTime()) / 86_400_000) * 10) / 10,
    at: when.toISOString(),
    sign: toPoint(lon).sign,
    ...(chart.ascendant ? { house: wholeSignHouse(lon, chart.ascendant.lon) } : {}),
  };
}

// ─── Long chapters ───────────────────────────────────────────────────────────

const SLOW: TimedBody[] = ["Saturn", "Uranus", "Neptune", "Pluto"];
/** A chapter is counted from the moment the planet comes this close, in degrees. */
const PHASE_ORB: Record<string, number> = { Saturn: 5, Uranus: 3, Neptune: 3, Pluto: 3 };
/** Passes closer together than this belong to the same chapter (one retrograde loop). */
const PHASE_GAP_DAYS = 400;
/** A planet further than this from a point, in degrees, cannot be in a chapter with it. */
const PHASE_REACH: Record<string, number> = { Saturn: 20, Uranus: 12, Neptune: 12, Pluto: 12 };
const PEAK_DAYS = 45;
const PERSONAL = ["Sun", "Moon", "Mercury", "Venus", "Mars", "Ascendant", "Midheaven"];
const MAX_PHASES = 4;

const iso = (ms: number | undefined) => (ms === undefined ? undefined : new Date(ms).toISOString());

/**
 * The slow chapters in play: Saturn, Uranus, Neptune or Pluto within a few degrees of a
 * personal point of the chart, with the dates they began, are exact and end. A planet's
 * meeting with its own birth position (the Saturn return) counts too.
 */
export function computeLongPhases(chart: NatalChart, moment: Date): LongPhase[] {
  const now = moment.getTime();
  const points: { name: string; lon: number }[] = chart.placements
    .filter((p) => PERSONAL.includes(p.body) || p.body === "Saturn" || p.body === "Uranus")
    .filter((p) => chart.hasBirthTime || p.body !== "Moon")
    .map((p) => ({ name: p.body, lon: p.lon }));
  if (chart.ascendant) points.push({ name: "Ascendant", lon: chart.ascendant.lon });
  if (chart.midheaven) points.push({ name: "Midheaven", lon: chart.midheaven.lon });

  const phases: LongPhase[] = [];
  for (const planet of SLOW) {
    const lon = bodyLongitude(planet, moment);
    for (const point of points) {
      // Saturn and Uranus in the birth chart only matter to the same planet coming round again.
      if (!PERSONAL.includes(point.name) && point.name !== planet) continue;
      for (const aspect of Object.keys(ASPECT_ANGLES) as AspectName[]) {
        for (const target of aspectTargets(point.lon, aspect)) {
          if (Math.abs(angleDiff(target, lon)) > PHASE_REACH[planet]) continue;
          const chapter = passAt(mergePasses(scanPasses(planet, target, PHASE_ORB[planet], moment), PHASE_GAP_DAYS), now);
          if (!chapter) continue;
          const orb = Math.abs(angleDiff(target, lon));
          const past = chapter.exact.filter((t) => t <= now);
          const ahead = chapter.exact.filter((t) => t > now);
          const nearPeak = chapter.exact.some((t) => Math.abs(t - now) <= PEAK_DAYS * 86_400_000);
          const stage =
            nearPeak || (past.length && ahead.length)
              ? "peaking"
              : ahead.length
                ? "building"
                : past.length
                  ? "easing"
                  : // Never quite exact: it builds until its midpoint, then eases.
                    chapter.start !== undefined && chapter.end !== undefined && now > (chapter.start + chapter.end) / 2
                    ? "easing"
                    : "building";
          const isReturn = point.name === planet && aspect === "conjunction";
          phases.push({
            planet,
            aspect,
            natal: point.name,
            ...(isReturn ? { name: `${planet} return` } : {}),
            orb: Math.round(orb * 100) / 100,
            inRange: orb <= PHASE_ORB[planet],
            ...(chapter.start !== undefined ? { since: iso(chapter.start) } : {}),
            ...(chapter.end !== undefined ? { ends: iso(chapter.end) } : {}),
            exact: chapter.exact.map((t) => new Date(t).toISOString()),
            stage,
            weight:
              PLANET_WEIGHT[planet] *
              ASPECT_WEIGHT[aspect] *
              (PERSONAL.includes(point.name) ? (NATAL_WEIGHT[point.name] ?? 1) : 1) *
              (isReturn ? 1.5 : 1) *
              (stage === "peaking" ? 1.2 : 1),
          });
        }
      }
    }
  }
  return phases.sort((a, b) => b.weight - a.weight).slice(0, MAX_PHASES);
}

/** Adds to a transit the dates it began, is exact, ends and comes back. */
function timeTransit(transit: Transit, lon: number, natalLon: number, moment: Date): Transit {
  if (!isTimed(transit.planet)) return transit;
  const now = moment.getTime();
  const target = nearestTarget(lon, natalLon, transit.aspect);
  const passes = scanPasses(transit.planet, target, TRANSIT_ORB[transit.planet], moment);
  const current = passAt(passes, now);
  if (!current) return transit;
  const next = passes[passes.indexOf(current) + 1];
  const exact = current.exact.find((t) => t > now);
  return {
    ...transit,
    ...(current.start !== undefined ? { since: iso(current.start) } : {}),
    ...(exact !== undefined ? { exact: iso(exact) } : {}),
    ...(current.end !== undefined ? { ends: iso(current.end) } : {}),
    ...(next?.start !== undefined ? { returns: iso(next.start) } : {}),
  };
}

export type SkyOptions = {
  maxTransits?: number;
  /**
   * Also work out when each transit began and ends, and the slow chapters in the
   * background. Needed to write a reading; skipped where only today's sky is shown.
   */
  timing?: boolean;
};

export function computeDailySky(chart: NatalChart, moment: Date, options: SkyOptions = {}): DailySky {
  const { maxTransits = 9, timing = false } = options;
  const soon = new Date(moment.getTime() + 6 * 3600 * 1000);
  const dayLater = new Date(moment.getTime() + 18 * 3600 * 1000);

  const natalPoints: { name: string; lon: number }[] = chart.placements
    .filter((p) => p.body !== "North Node")
    .map((p) => ({ name: p.body, lon: p.lon }));
  if (chart.ascendant) natalPoints.push({ name: "Ascendant", lon: chart.ascendant.lon });
  if (chart.midheaven) natalPoints.push({ name: "Midheaven", lon: chart.midheaven.lon });
  // Without a birth time the natal Moon can be off by several degrees.
  const usable = natalPoints.filter((p) => chart.hasBirthTime || p.name !== "Moon");

  const positions: SkyPosition[] = [];
  const ingresses: DailySky["ingresses"] = [];
  const transits: Transit[] = [];

  for (const body of BODIES) {
    const lon = bodyLongitude(body, moment);
    const lonSoon = bodyLongitude(body, soon);
    const point = toPoint(lon);
    positions.push({
      body,
      sign: point.sign,
      degree: Math.round(point.degree * 10) / 10,
      retrograde: isRetrograde(body, moment),
      ...(chart.ascendant ? { house: wholeSignHouse(lon, chart.ascendant.lon) } : {}),
    });

    if (body !== "Moon") {
      const later = toPoint(bodyLongitude(body, new Date(moment.getTime() + 24 * 3600 * 1000)));
      if (later.sign !== point.sign) ingresses.push({ body, sign: later.sign });
    }

    for (const natal of usable) {
      const found = findAspect(lon, natal.lon, () => TRANSIT_ORB[body]);
      if (!found) continue;
      const exact = ASPECT_ANGLES[found.aspect];
      const orbSoon = Math.abs(Math.abs(angleDiff(lonSoon, natal.lon)) - exact);
      const tightness = 1 - found.orb / (TRANSIT_ORB[body] + 0.5);
      transits.push({
        planet: body,
        aspect: found.aspect,
        natal: natal.name,
        orb: Math.round(found.orb * 100) / 100,
        applying: orbSoon < found.orb,
        weight: PLANET_WEIGHT[body] * ASPECT_WEIGHT[found.aspect] * (NATAL_WEIGHT[natal.name] ?? 1) * (0.5 + tightness),
      });
    }
  }

  transits.sort((a, b) => b.weight - a.weight);
  let listed = transits.slice(0, maxTransits);
  let phases: LongPhase[] | undefined;
  if (timing) {
    phases = computeLongPhases(chart, moment);
    const natalLon = new Map(natalPoints.map((p) => [p.name, p.lon]));
    listed = listed.map((t) =>
      phases!.some((p) => p.planet === t.planet && p.aspect === t.aspect && p.natal === t.natal)
        ? { ...t, inPhases: true }
        : timeTransit(t, bodyLongitude(t.planet, moment), natalLon.get(t.natal)!, moment),
    );
  }

  const lunation = nextLunation(chart, moment);
  const moonNow = toPoint(bodyLongitude("Moon", moment));
  const moonLater = toPoint(bodyLongitude("Moon", dayLater));
  const phaseAngle = Astronomy.MoonPhase(moment);

  return {
    moment: moment.toISOString(),
    moon: {
      sign: moonNow.sign,
      ...(moonLater.sign !== moonNow.sign ? { entering: moonLater.sign } : {}),
      phase: moonPhaseName(phaseAngle),
      illumination: Math.round(((1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2) * 100),
    },
    positions,
    ...(lunation ? { lunation } : {}),
    retrogrades: positions.filter((p) => p.retrograde).map((p) => p.body),
    ingresses,
    transits: listed,
    ...(phases ? { phases } : {}),
  };
}

export function describeTransit(t: Transit) {
  return `${t.planet} ${t.aspect} your natal ${t.natal}`;
}

const ordinal = (n: number) => `${n}${["th", "st", "nd", "rd"][n % 10 > 3 || (n % 100) - (n % 10) === 10 ? 0 : n % 10]}`;

/** The birth chart as plain text for the model. */
export function chartToText(chart: NatalChart) {
  const lines: string[] = [];
  if (chart.ascendant && chart.midheaven) {
    lines.push(`Ascendant (rising): ${formatPoint(chart.ascendant)}`);
    lines.push(`Midheaven: ${formatPoint(chart.midheaven)}`);
  } else {
    lines.push(
      "Birth time unknown: no Ascendant, Midheaven or houses. Do not mention a rising sign or houses.",
    );
  }
  for (const p of chart.placements) {
    const notes = [
      p.house ? `${ordinal(p.house)} house` : null,
      p.retrograde && p.body !== "North Node" ? "retrograde" : null,
      p.body === "Moon" && chart.moonSignUncertain
        ? "sign uncertain: the Moon changed sign on the birth day, so speak of the Moon lightly"
        : null,
    ].filter(Boolean);
    lines.push(`${p.body}: ${formatPoint(p)}${notes.length ? ` (${notes.join(", ")})` : ""}`);
  }
  if (chart.aspects.length) {
    lines.push("", "Natal aspects (tightest first):");
    for (const a of chart.aspects.slice(0, 14)) {
      lines.push(`- ${a.a} ${a.aspect} ${a.b} (orb ${a.orb.toFixed(1)}°)`);
    }
  }
  return lines.join("\n");
}

// ─── Dates, as the writer sees them ──────────────────────────────────────────

function dateParts(isoString: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatToParts(new Date(isoString));
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return { weekday: get("weekday"), day: get("day"), month: get("month"), year: get("year") };
}

/** "Sat 21 Nov" within about a week of the reading, "21 Nov" further out, with the year when it differs. */
function formatDay(isoString: string, sky: DailySky, timeZone: string) {
  const d = dateParts(isoString, timeZone);
  const days = Math.abs(new Date(isoString).getTime() - new Date(sky.moment).getTime()) / 86_400_000;
  if (days <= 8) return `${d.weekday} ${d.day} ${d.month}`;
  return `${d.day} ${d.month}${d.year === dateParts(sky.moment, timeZone).year ? "" : ` ${d.year}`}`;
}

/** The slowest planets hover for weeks around a date, so only the month is given. */
function formatPhaseDate(isoString: string, phase: LongPhase, timeZone: string) {
  const d = dateParts(isoString, timeZone);
  return phase.planet === "Saturn" ? `${d.day} ${d.month} ${d.year}` : `${d.month} ${d.year}`;
}

function transitTiming(t: Transit, sky: DailySky, timeZone: string) {
  if (t.planet === "Moon") return "; passes within hours";
  if (t.inPhases) return "; dates under LONGER CHAPTERS";
  const day = (isoString: string) => formatDay(isoString, sky, timeZone);
  return [
    t.exact ? `; exact ${day(t.exact)}` : "",
    t.since || t.ends
      ? `; in range${t.since ? ` since ${day(t.since)}` : ""}${t.ends ? ` until ${day(t.ends)}` : ""}`
      : "",
    t.returns ? `; comes back into range ${day(t.returns)}` : "",
  ].join("");
}

/** One slow chapter in a line: what it is, where it stands, and its dates. */
export function describePhase(phase: LongPhase, moment: string, timeZone: string) {
  const date = (isoString: string) => formatPhaseDate(isoString, phase, timeZone);
  const dates = (list: string[]) => [...new Set(list.map(date))].join(", ");
  const what = `transiting ${phase.planet} ${phase.aspect} natal ${phase.natal}`;
  const past = phase.exact.filter((t) => t <= moment);
  const ahead = phase.exact.filter((t) => t > moment);
  return [
    `${phase.name ? `${phase.name} (${what})` : capitalize(what)}, ${phase.inRange ? `now ${phase.orb.toFixed(1)}° from exact` : "in a lull between two passes"}.`,
    `${capitalize(phase.stage)}.`,
    phase.since ? `Began around ${date(phase.since)}.` : "Began years ago.",
    past.length ? `Was exact around ${dates(past)}.` : "",
    ahead.length ? `Exact${past.length ? " again" : ""} around ${dates(ahead)}.` : "",
    phase.ends ? `Over for good around ${date(phase.ends)}.` : "Has years still to run.",
  ]
    .filter(Boolean)
    .join(" ");
}

const capitalize = (text: string) => text.replace(/^./, (c) => c.toUpperCase());

/** The day's sky, relative to the chart, as plain text for the model. */
export function skyToText(sky: DailySky, timeZone = "UTC") {
  const lines: string[] = [];
  lines.push(
    `Moon: in ${sky.moon.sign}${sky.moon.entering ? `, entering ${sky.moon.entering} later today` : ""}; ${sky.moon.phase}, ${sky.moon.illumination}% lit`,
  );
  lines.push(
    "Planets today: " +
      sky.positions
        .filter((p) => p.body !== "Moon")
        .map(
          (p) =>
            `${p.body} ${Math.floor(p.degree)}° ${p.sign}${p.retrograde ? " (retrograde)" : ""}${p.house ? ` in their ${ordinal(p.house)} house` : ""}`,
        )
        .join("; "),
  );
  if (sky.lunation) {
    const l = sky.lunation;
    const when = l.inDays < 0.6 ? "within the day" : `in about ${Math.round(l.inDays)} day${Math.round(l.inDays) === 1 ? "" : "s"}`;
    lines.push(
      `Coming up: ${l.kind} in ${l.sign} ${when}${l.at ? ` (${formatDay(l.at, sky, timeZone)})` : ""}${l.house ? `, falling in their ${ordinal(l.house)} house` : ""}`,
    );
  }
  if (sky.ingresses.length) {
    lines.push(
      "Sign changes within a day: " + sky.ingresses.map((i) => `${i.body} enters ${i.sign}`).join("; "),
    );
  }
  lines.push("", "Transits to the birth chart (most significant first):");
  if (!sky.transits.length) {
    lines.push("- No tight transits today: a quiet sky. Lean on the Moon and the slower background.");
  }
  for (const t of sky.transits) {
    lines.push(
      `- Transiting ${t.planet} ${t.aspect} natal ${t.natal} (orb ${t.orb.toFixed(1)}°, ${t.applying ? "building" : "fading"}${transitTiming(t, sky, timeZone)})`,
    );
  }
  if (sky.phases?.length) {
    lines.push(
      "",
      'LONGER CHAPTERS (slow planets working on their chart over months or years; these dates are approximate, so say "around")',
    );
    for (const phase of sky.phases) lines.push(`- ${describePhase(phase, sky.moment, timeZone)}`);
  }
  return lines.join("\n");
}
