// When a transit began, when it is exact and when it ends.
// A planet's path is sampled on a fixed grid of instants, then scanned for the stretches
// where it sits within range of a point in the birth chart. Planets turn retrograde, so one
// transit often comes in two or three passes: all of them are found.
import { ASPECT_ANGLES, angleDiff, bodyLongitude, norm360, type AspectName, type BodyName } from "./chart";

const DAY = 86_400_000;

export type TimedBody = Exclude<BodyName, "Moon">;

/** Sampling step and how far to look each way, in days. The Moon is left out: its transits last hours. */
const SCAN: Record<TimedBody, { step: number; reach: number }> = {
  Sun: { step: 0.25, reach: 12 },
  Mercury: { step: 0.25, reach: 75 },
  Venus: { step: 0.25, reach: 90 },
  Mars: { step: 0.5, reach: 200 },
  Jupiter: { step: 1, reach: 420 },
  Saturn: { step: 1, reach: 900 },
  Uranus: { step: 3, reach: 1500 },
  Neptune: { step: 3, reach: 1500 },
  Pluto: { step: 3, reach: 1500 },
};

export const isTimed = (body: BodyName): body is TimedBody => body !== "Moon";

// Where a planet is at a grid instant does not depend on whose chart is being read, so
// the samples are shared by every reading written in the same run.
const grid = new Map<TimedBody, Map<number, number>>();
function gridLongitude(body: TimedBody, index: number) {
  let samples = grid.get(body);
  if (!samples) grid.set(body, (samples = new Map()));
  let lon = samples.get(index);
  if (lon === undefined) {
    lon = bodyLongitude(body, new Date(index * SCAN[body].step * DAY));
    samples.set(index, lon);
  }
  return lon;
}

/** One stretch during which a planet stays within range of a point. Times are in ms. */
export type Pass = {
  /** Undefined when the pass began before the scanned period. */
  start?: number;
  /** Undefined when the pass runs on past the scanned period. */
  end?: number;
  /** The instants at which the transit is exact during this pass. */
  exact: number[];
};

/** The point(s) of the zodiac a planet must reach to form `aspect` with a birth-chart point. */
export function aspectTargets(natalLon: number, aspect: AspectName) {
  const angle = ASPECT_ANGLES[aspect];
  return angle === 0 || angle === 180 ? [norm360(natalLon + angle)] : [norm360(natalLon + angle), norm360(natalLon - angle)];
}

/** Of the points that form `aspect`, the one the planet is nearest to right now. */
export function nearestTarget(lon: number, natalLon: number, aspect: AspectName) {
  return aspectTargets(natalLon, aspect).reduce((best, target) =>
    Math.abs(angleDiff(target, lon)) < Math.abs(angleDiff(best, lon)) ? target : best,
  );
}

/**
 * Every pass of `body` within `orb` degrees of `target`, over the scanned period around
 * `moment`, in time order.
 */
export function scanPasses(body: TimedBody, target: number, orb: number, moment: Date): Pass[] {
  const { step, reach } = SCAN[body];
  const stepMs = step * DAY;
  const center = Math.round(moment.getTime() / stepMs);
  const count = Math.round(reach / step);

  const passes: Pass[] = [];
  let open: Pass | null = null;
  let previousTime = 0;
  let previousOff = 0;

  for (let i = center - count; i <= center + count; i++) {
    const time = i * stepMs;
    // Signed distance from the exact point: negative before it, positive after, for a planet moving forward.
    const off = angleDiff(target, gridLongitude(body, i));
    const inside = Math.abs(off) <= orb;
    const first = i === center - count;

    if (first) {
      if (inside) open = { exact: [] };
    } else {
      const wasInside = Math.abs(previousOff) <= orb;
      // Where, between the two samples, the planet crossed the edge of the range.
      const edge = () =>
        previousTime + ((orb - Math.abs(previousOff)) / (Math.abs(off) - Math.abs(previousOff))) * (time - previousTime);
      if (!wasInside && inside) open = { start: edge(), exact: [] };
      if (open && wasInside && Math.sign(off) !== Math.sign(previousOff) && Math.abs(off - previousOff) < 30) {
        open.exact.push(previousTime + (previousOff / (previousOff - off)) * (time - previousTime));
      }
      if (open && wasInside && !inside) {
        passes.push({ ...open, end: edge() });
        open = null;
      }
    }
    previousTime = time;
    previousOff = off;
  }
  if (open) passes.push(open);
  return passes;
}

/** Joins passes separated by less than `gapDays` into one stretch: the passes of a single retrograde loop. */
export function mergePasses(passes: Pass[], gapDays: number): Pass[] {
  const merged: Pass[] = [];
  for (const pass of passes) {
    const last = merged[merged.length - 1];
    if (last && last.end !== undefined && pass.start !== undefined && pass.start - last.end <= gapDays * DAY) {
      last.end = pass.end;
      last.exact.push(...pass.exact);
    } else {
      merged.push({ ...pass, exact: [...pass.exact] });
    }
  }
  return merged;
}

/** The pass that contains `time`, if any. */
export function passAt(passes: Pass[], time: number) {
  return passes.find((p) => (p.start === undefined || p.start <= time) && (p.end === undefined || p.end >= time));
}
