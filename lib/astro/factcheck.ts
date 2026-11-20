// Checks what a written reading says about the sky against the computed data.
// The writer is a language model: it is given the right positions, but nothing stops
// it from misstating one. This catches the checkable claims (a planet's sign, a
// rising sign, an aspect between two bodies) so a wrong reading can be rewritten.
import { ASPECT_ANGLES, BODIES, SIGNS, angleDiff, type AspectName, type NatalChart, type Sign } from "./chart";
import type { DailySky } from "./transits";

const BODY = BODIES.join("|");
const SIGN = SIGNS.join("|");
const POINT = `${BODY}|Ascendant|Midheaven`;

// "Moon in Aries", "Venus, now in Libra": a body, then "in <sign>" before any other body is named.
const BODY_IN_SIGN = new RegExp(`\\b(${BODY})\\b((?:(?!\\b(?:${BODY})\\b)[^.?!\\n]){0,24}?)\\bin\\s+(${SIGN})\\b`, "g");
// "Leo Sun", "Virgo rising", "Gemini Midheaven"
const SIGN_THEN_POINT = new RegExp(`\\b(${SIGN})\\s+(${BODY}|rising|Rising|Ascendant|ascendant|Midheaven|midheaven)\\b`, "g");
// "Venus squaring your natal Uranus", "Jupiter is trine your Midheaven"
const ASPECT_WORDS: [RegExp, AspectName][] = [
  [/^conj/i, "conjunction"],
  [/^squar/i, "square"],
  [/^trin/i, "trine"],
  [/^sextil/i, "sextile"],
  [/^oppos/i, "opposition"],
];
const ASPECT = new RegExp(
  `\\b(${BODY})\\s+(?:is\\s+|are\\s+|now\\s+|still\\s+)*(conjunct\\w*|conjoin\\w*|squar\\w*|trin\\w*|sextil\\w*|oppos\\w*)\\s+(?:to\\s+|with\\s+)?(?:your\\s+|the\\s+)?(?:natal\\s+|own\\s+)?(${POINT})\\b`,
  "gi",
);

const TRANSIT_TOLERANCE = 6;
const NATAL_TOLERANCE = 9;
const signLon = (sign: Sign, degree: number) => SIGNS.indexOf(sign) * 30 + degree;
const canonical = (name: string) =>
  [...BODIES, "Ascendant", "Midheaven"].find((b) => b.toLowerCase() === name.toLowerCase()) ?? name;

export function findSkyErrors(text: string, chart: NatalChart, sky: DailySky): string[] {
  const errors = new Set<string>();

  const natalLon = new Map<string, number>(chart.placements.map((p) => [p.body, p.lon]));
  if (chart.ascendant) natalLon.set("Ascendant", chart.ascendant.lon);
  if (chart.midheaven) natalLon.set("Midheaven", chart.midheaven.lon);
  const transitLon = new Map<string, number>(sky.positions.map((p) => [p.body, signLon(p.sign, p.degree)]));

  // Every sign a body may truthfully be said to be in: at birth, today, or entering.
  const signsOf = (body: string): Set<Sign> => {
    const signs = new Set<Sign>();
    const natal = chart.placements.find((p) => p.body === body);
    if (natal && !(body === "Moon" && chart.moonSignUncertain)) signs.add(natal.sign);
    const today = sky.positions.find((p) => p.body === body);
    if (today) signs.add(today.sign);
    for (const ingress of sky.ingresses) if (ingress.body === body) signs.add(ingress.sign);
    if (body === "Moon") {
      if (sky.moon.entering) signs.add(sky.moon.entering);
      if (sky.lunation) signs.add(sky.lunation.sign);
    }
    return signs;
  };

  for (const match of text.matchAll(BODY_IN_SIGN)) {
    const [, body, , sign] = match;
    if (!signsOf(body).has(sign as Sign)) errors.add(`"${match[0]}": the ${body} is not in ${sign}, at birth or today`);
  }

  for (const match of text.matchAll(SIGN_THEN_POINT)) {
    const [, sign, raw] = match;
    const point = /rising|ascendant/i.test(raw) ? "Ascendant" : /midheaven/i.test(raw) ? "Midheaven" : raw;
    if (point === "Ascendant" || point === "Midheaven") {
      const actual = point === "Ascendant" ? chart.ascendant?.sign : chart.midheaven?.sign;
      if (actual && actual !== sign) errors.add(`"${match[0]}": their ${point} is in ${actual}`);
    } else if (!signsOf(point).has(sign as Sign)) {
      errors.add(`"${match[0]}": the ${point} is not in ${sign}, at birth or today`);
    }
  }

  if (!chart.hasBirthTime && /\b(rising sign|ascendant|midheaven|\d+(?:st|nd|rd|th) house)\b/i.test(text)) {
    errors.add("The birth time is unknown, so the reading must not mention a rising sign, Midheaven or houses");
  }

  // A slow chapter stays true in the lull between two passes, when the planet has drifted out of range.
  const chapters = new Set((sky.phases ?? []).map((p) => `${p.planet}|${p.aspect}|${p.natal}`));

  for (const match of text.matchAll(ASPECT)) {
    const a = canonical(match[1]);
    const b = canonical(match[3]);
    const aspect = ASPECT_WORDS.find(([pattern]) => pattern.test(match[2]))?.[1];
    if (!aspect || a === b) continue;
    const within = (lonA: number | undefined, lonB: number | undefined, tolerance: number) =>
      lonA !== undefined &&
      lonB !== undefined &&
      Math.abs(Math.abs(angleDiff(lonA, lonB)) - ASPECT_ANGLES[aspect]) <= tolerance;
    const holds =
      chapters.has(`${a}|${aspect}|${b}`) ||
      within(transitLon.get(a), natalLon.get(b), TRANSIT_TOLERANCE) || // today's planet to the birth chart
      within(transitLon.get(a), transitLon.get(b), TRANSIT_TOLERANCE) || // two planets in today's sky
      within(natalLon.get(a), natalLon.get(b), NATAL_TOLERANCE) || // inside the birth chart
      within(natalLon.get(a), transitLon.get(b), TRANSIT_TOLERANCE);
    if (!holds) errors.add(`"${match[0]}": no ${aspect} between ${a} and ${b} in the data`);
  }

  return [...errors];
}

// Words that belong in the notes at the end of a reading, never in the reading itself.
// "Sun" and "Moon" are left out on purpose: "full moon" and "the sun" are everyday words.
const JARGON = new RegExp(
  `\\b(Mercury|Venus|Mars|Jupiter|Saturn|Uranus|Neptune|Pluto|${SIGN}|Midheaven|Ascendant|rising sign|natal|transit\\w*|retrograde|sextile|trine\\w*|conjunct\\w*|birth chart|zodiac|horoscope|\\d+(?:st|nd|rd|th) house)\\b`,
  "gi",
);

/** Astrology vocabulary found in text that is meant to be in everyday language. */
export function findJargon(text: string): string[] {
  return [...new Set([...text.matchAll(JARGON)].map((m) => m[0]))];
}

// Astrology terms are allowed only in the notes shown at the end of a reading.

// ─── Dates ───────────────────────────────────────────────────────────────────

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const MONTH = "Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
// "21 Nov", "21st of November" and "November 21", "Nov 21st". A year such as "Nov 2027" is not a day.
const DAY_THEN_MONTH = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH})\\b`, "g");
const MONTH_THEN_DAY = new RegExp(`\\b(${MONTH})\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?\\b`, "g");
const DAYS_BEFORE = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];

/** Every calendar date named in a text, as a day of the year (1 to 365). */
function datesIn(text: string) {
  const found: { label: string; dayOfYear: number }[] = [];
  const add = (label: string, month: string, day: string) => {
    const m = MONTHS.indexOf(month.slice(0, 3).toLowerCase());
    const d = Number(day);
    if (m >= 0 && d >= 1 && d <= 31) found.push({ label, dayOfYear: DAYS_BEFORE[m] + d });
  };
  for (const match of text.matchAll(DAY_THEN_MONTH)) add(match[0], match[2], match[1]);
  for (const match of text.matchAll(MONTH_THEN_DAY)) add(match[0], match[1], match[2]);
  return found;
}

/**
 * Calendar dates in a reading that the writer was never given. Every date it may use is
 * in its instructions (today, the transit dates, what the member wrote), so a date that
 * is not there, give or take a day, was made up.
 */
export function findDateErrors(text: string, given: string): string[] {
  const allowed = datesIn(given).map((d) => d.dayOfYear);
  const near = (day: number) => allowed.some((a) => Math.abs(a - day) <= 1 || Math.abs(a - day) >= 364);
  return [
    ...new Set(
      datesIn(text)
        .filter((d) => !near(d.dayOfYear))
        .map((d) => `"${d.label}": that date is not in the data. Give only dates that are listed, or leave the date out.`),
    ),
  ];
}
