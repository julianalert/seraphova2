// Timezone helpers built on Intl only (no date library).

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(tz: string) {
  let dtf = dtfCache.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, dtf);
  }
  return dtf;
}

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

/** Wall-clock time in `tz` at the given instant. */
export function localParts(date: Date, tz: string): LocalParts {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as unknown as LocalParts;
}

function offsetMs(date: Date, tz: string) {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The UTC instant at which the wall clock in `tz` shows the given local time. */
export function zonedTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  tz: string,
): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const first = wall - offsetMs(new Date(wall), tz);
  return new Date(wall - offsetMs(new Date(first), tz));
}

/** YYYY-MM-DD of the given instant in `tz`. */
export function localDateString(date: Date, tz: string): string {
  const p = localParts(date, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function parseDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

/** The instant a YYYY-MM-DD local date reaches `hour`:00 in `tz`. */
export function instantOn(dateString: string, hour: number, tz: string): Date {
  const { year, month, day } = parseDateString(dateString);
  return zonedTimeToUtc(year, month, day, hour, 0, tz);
}

/** Calendar date `days` after a YYYY-MM-DD date. */
export function addDays(dateString: string, days: number): string {
  const { year, month, day } = parseDateString(dateString);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The first time the clock in `tz` shows `hour`:00 on a local day after `after`'s local day. */
export function nextDeliveryAfterToday(hour: number, tz: string, after: Date): Date {
  return instantOn(addDays(localDateString(after, tz), 1), hour, tz);
}

/** The next time the clock in `tz` shows `hour`:00 strictly after `after`. */
export function nextDelivery(hour: number, tz: string, after: Date): Date {
  const today = instantOn(localDateString(after, tz), hour, tz);
  return today > after ? today : nextDeliveryAfterToday(hour, tz, after);
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** "Friday, November 20, 2026" for a YYYY-MM-DD date. */
export function formatLongDate(dateString: string): string {
  const { year, month, day } = parseDateString(dateString);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function formatShortDate(dateString: string) {
  const { year, month, day } = parseDateString(dateString);
  const d = new Date(Date.UTC(year, month - 1, day));
  const f = (o: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(d);
  return { weekday: f({ weekday: "short" }), month: f({ month: "short" }), day: String(day), year: String(year) };
}
