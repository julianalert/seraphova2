// Birth chart computation (tropical zodiac, geocentric, whole-sign houses).
import * as Astronomy from "astronomy-engine";
import { zonedTimeToUtc } from "../time";

export const SIGNS = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
] as const;
export type Sign = (typeof SIGNS)[number];

export const BODIES = [
  "Sun",
  "Moon",
  "Mercury",
  "Venus",
  "Mars",
  "Jupiter",
  "Saturn",
  "Uranus",
  "Neptune",
  "Pluto",
] as const;
export type BodyName = (typeof BODIES)[number];

export type Point = {
  /** Ecliptic longitude of date, 0–360. */
  lon: number;
  sign: Sign;
  /** Degrees into the sign, 0–30. */
  degree: number;
};

export type Placement = Point & {
  body: BodyName | "North Node";
  retrograde: boolean;
  /** Whole-sign house, only when the birth time is known. */
  house?: number;
};

export type AspectName = "conjunction" | "sextile" | "square" | "trine" | "opposition";

export type NatalAspect = {
  a: string;
  b: string;
  aspect: AspectName;
  orb: number;
};

export type NatalChart = {
  /** UTC instant the chart was cast for. */
  moment: string;
  hasBirthTime: boolean;
  /** True when the birth time is unknown and the Moon changed sign that day. */
  moonSignUncertain: boolean;
  placements: Placement[];
  ascendant?: Point;
  midheaven?: Point;
  aspects: NatalAspect[];
};

export type BirthData = {
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (24h) or null when unknown */
  time: string | null;
  lat: number;
  lon: number;
  tz: string;
};

export const ASPECT_ANGLES: Record<AspectName, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  opposition: 180,
};

export function norm360(deg: number) {
  return ((deg % 360) + 360) % 360;
}

/** Signed shortest angular distance a→b, in (-180, 180]. */
export function angleDiff(a: number, b: number) {
  const d = norm360(b - a);
  return d > 180 ? d - 360 : d;
}

export function toPoint(lon: number): Point {
  const l = norm360(lon);
  return { lon: l, sign: SIGNS[Math.floor(l / 30) % 12], degree: l % 30 };
}

export function bodyLongitude(body: BodyName, date: Date): number {
  const vector = Astronomy.GeoVector(Astronomy.Body[body], date, true);
  return Astronomy.Ecliptic(vector).elon;
}

export function isRetrograde(body: BodyName, date: Date): boolean {
  if (body === "Sun" || body === "Moon") return false;
  const later = new Date(date.getTime() + 6 * 3600 * 1000);
  return angleDiff(bodyLongitude(body, date), bodyLongitude(body, later)) < 0;
}

function julianCenturies(date: Date) {
  return Astronomy.MakeTime(date).tt / 36525;
}

/** Mean lunar north node. */
export function northNodeLongitude(date: Date) {
  const T = julianCenturies(date);
  return norm360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Ascendant and Midheaven for a place and instant. */
export function angles(date: Date, lat: number, lonEast: number) {
  const T = julianCenturies(date);
  const eps = rad(23.4392911 - 0.0130042 * T);
  const ramc = rad(norm360(Astronomy.SiderealTime(date) * 15 + lonEast));
  const mc = norm360(deg(Math.atan2(Math.sin(ramc), Math.cos(ramc) * Math.cos(eps))));
  const asc = norm360(
    deg(
      Math.atan2(
        Math.cos(ramc),
        -(Math.sin(ramc) * Math.cos(eps) + Math.tan(rad(lat)) * Math.sin(eps)),
      ),
    ),
  );
  return { ascendant: toPoint(asc), midheaven: toPoint(mc) };
}

export function wholeSignHouse(lon: number, ascendantLon: number) {
  const signOf = (l: number) => Math.floor(norm360(l) / 30);
  return ((signOf(lon) - signOf(ascendantLon) + 12) % 12) + 1;
}

/** The aspect two longitudes form within `maxOrb`, if any. */
export function findAspect(
  lonA: number,
  lonB: number,
  maxOrb: (aspect: AspectName) => number,
): { aspect: AspectName; orb: number } | null {
  const separation = Math.abs(angleDiff(lonA, lonB));
  for (const aspect of Object.keys(ASPECT_ANGLES) as AspectName[]) {
    const orb = Math.abs(separation - ASPECT_ANGLES[aspect]);
    if (orb <= maxOrb(aspect)) return { aspect, orb };
  }
  return null;
}

export function birthMoment(birth: BirthData): Date {
  const [year, month, day] = birth.date.split("-").map(Number);
  // Without a birth time we cast for local noon, the least-wrong moment of the day.
  const [hour, minute] = birth.time ? birth.time.split(":").map(Number) : [12, 0];
  return zonedTimeToUtc(year, month, day, hour, minute, birth.tz);
}

export function computeNatalChart(birth: BirthData): NatalChart {
  const moment = birthMoment(birth);
  const hasBirthTime = Boolean(birth.time);
  const houses = hasBirthTime ? angles(moment, birth.lat, birth.lon) : null;

  const placements: Placement[] = BODIES.map((body) => {
    const point = toPoint(bodyLongitude(body, moment));
    return {
      body,
      ...point,
      retrograde: isRetrograde(body, moment),
      ...(houses ? { house: wholeSignHouse(point.lon, houses.ascendant.lon) } : {}),
    };
  });

  const node = toPoint(northNodeLongitude(moment));
  placements.push({
    body: "North Node",
    ...node,
    retrograde: true,
    ...(houses ? { house: wholeSignHouse(node.lon, houses.ascendant.lon) } : {}),
  });

  let moonSignUncertain = false;
  if (!hasBirthTime) {
    const [year, month, day] = birth.date.split("-").map(Number);
    const start = zonedTimeToUtc(year, month, day, 0, 0, birth.tz);
    const end = zonedTimeToUtc(year, month, day, 23, 59, birth.tz);
    moonSignUncertain =
      toPoint(bodyLongitude("Moon", start)).sign !== toPoint(bodyLongitude("Moon", end)).sign;
  }

  const aspects: NatalAspect[] = [];
  const planets = placements.filter((p) => p.body !== "North Node");
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      const luminary = [a.body, b.body].some((x) => x === "Sun" || x === "Moon");
      const found = findAspect(a.lon, b.lon, (aspect) =>
        aspect === "sextile" ? (luminary ? 5 : 4) : luminary ? 8 : 6,
      );
      if (found) aspects.push({ a: a.body, b: b.body, aspect: found.aspect, orb: round(found.orb) });
    }
  }
  aspects.sort((x, y) => x.orb - y.orb);

  return {
    moment: moment.toISOString(),
    hasBirthTime,
    moonSignUncertain,
    placements: placements.map((p) => ({ ...p, lon: round(p.lon), degree: round(p.degree) })),
    ...(houses
      ? {
          ascendant: roundPoint(houses.ascendant),
          midheaven: roundPoint(houses.midheaven),
        }
      : {}),
    aspects,
  };
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function roundPoint(p: Point): Point {
  return { ...p, lon: round(p.lon), degree: round(p.degree) };
}

export function placementOf(chart: NatalChart, body: Placement["body"]) {
  return chart.placements.find((p) => p.body === body)!;
}

/** "5°12′ Leo" */
export function formatPoint(p: Point) {
  const d = Math.floor(p.degree);
  const m = Math.floor((p.degree - d) * 60);
  return `${d}°${String(m).padStart(2, "0")}′ ${p.sign}`;
}
