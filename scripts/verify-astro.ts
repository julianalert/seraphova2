// Checks the chart engine against astronomical facts that do not come from this code:
// published equinox and solstice times, new and full moons (eclipses), the 2020 great
// conjunction, Mercury retrograde periods, and timezone history.
// Run: npm run verify:astro
import * as Astronomy from "astronomy-engine";
import { angleDiff, angles, bodyLongitude, computeNatalChart, isRetrograde, norm360 } from "../lib/astro/chart";
import { findDateErrors } from "../lib/astro/factcheck";
import { scanPasses } from "../lib/astro/timing";
import { computeDailySky } from "../lib/astro/transits";
import { zonedTimeToUtc } from "../lib/time";

let failed = 0;
function check(name: string, actual: number, expected: number, tolerance: number, unit = "°") {
  const off = Math.abs(unit === "°" ? angleDiff(expected, actual) : actual - expected);
  const ok = off <= tolerance;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name.padEnd(58)} off by ${off.toFixed(4)}${unit} (allowed ${tolerance}${unit})`);
}
function checkTrue(name: string, value: boolean) {
  if (!value) failed++;
  console.log(`${value ? "PASS" : "FAIL"}  ${name}`);
}
const utc = (iso: string) => new Date(`${iso}Z`);

console.log("\nSun at published equinoxes and solstices (US Naval Observatory times, UTC)");
for (const [iso, lon, label] of [
  ["2024-03-20T03:06", 0, "March equinox 2024"],
  ["2024-06-20T20:51", 90, "June solstice 2024"],
  ["2024-09-22T12:44", 180, "September equinox 2024"],
  ["2024-12-21T09:21", 270, "December solstice 2024"],
  ["2025-03-20T09:01", 0, "March equinox 2025"],
  ["2025-06-21T02:42", 90, "June solstice 2025"],
] as const) {
  check(`${label}: Sun at ${lon}°`, bodyLongitude("Sun", utc(iso)), lon, 0.01);
}

console.log("\nMoon against the Sun at published new and full moons");
for (const [iso, separation, label] of [
  ["2024-04-08T18:21", 0, "New Moon, total solar eclipse of 8 Apr 2024"],
  ["2024-09-18T02:34", 180, "Full Moon, lunar eclipse of 18 Sep 2024"],
  ["2025-01-29T12:36", 0, "New Moon of 29 Jan 2025"],
  ["2025-03-14T06:55", 180, "Full Moon, total lunar eclipse of 14 Mar 2025"],
] as const) {
  const at = utc(iso);
  check(label, norm360(bodyLongitude("Moon", at) - bodyLongitude("Sun", at)), separation, 0.03);
}

console.log("\nPlanets");
const conjunction = utc("2020-12-21T18:20");
check("Great conjunction 2020: Jupiter meets Saturn", bodyLongitude("Jupiter", conjunction), bodyLongitude("Saturn", conjunction), 0.02);
check("Great conjunction 2020: at 0°29′ Aquarius", bodyLongitude("Jupiter", conjunction), 300 + 29 / 60, 0.03);
checkTrue("Pluto still in Capricorn on 15 Nov 2024", bodyLongitude("Pluto", utc("2024-11-15T12:00")) < 300);
checkTrue("Pluto in Aquarius on 25 Nov 2024", bodyLongitude("Pluto", utc("2024-11-25T12:00")) > 300);
checkTrue("Mercury retrograde on 10 Apr 2024", isRetrograde("Mercury", utc("2024-04-10T12:00")));
checkTrue("Mercury direct on 10 May 2024", !isRetrograde("Mercury", utc("2024-05-10T12:00")));
checkTrue("Mercury retrograde on 15 Aug 2024", isRetrograde("Mercury", utc("2024-08-15T12:00")));
checkTrue("Mercury retrograde on 1 Dec 2024", isRetrograde("Mercury", utc("2024-12-01T12:00")));
checkTrue("Mercury direct on 20 Dec 2024", !isRetrograde("Mercury", utc("2024-12-20T12:00")));

console.log("\nAscendant and Midheaven (geometry: the rising Sun is on the Ascendant, the noon Sun on the Midheaven)");
for (const [label, lat, lon] of [
  ["San Francisco", 37.7749, -122.4194],
  ["Paris", 48.8566, 2.3522],
  ["Sydney", -33.8688, 151.2093],
  ["Reykjavik", 64.1466, -21.9426],
] as const) {
  const observer = new Astronomy.Observer(lat, lon, 0);
  const day = utc("2025-04-10T00:00");
  // Geometric sunrise: the centre of the Sun exactly on the horizon, no refraction.
  const altitude = (t: Date) => {
    const eq = Astronomy.Equator(Astronomy.Body.Sun, t, observer, true, true);
    return Astronomy.Horizon(t, observer, eq.ra, eq.dec).altitude;
  };
  let rise: Date | null = null;
  for (let m = 0; m < 24 * 60 && !rise; m += 5) {
    const a = new Date(day.getTime() + m * 60_000);
    const b = new Date(a.getTime() + 5 * 60_000);
    if (altitude(a) < 0 && altitude(b) >= 0) {
      let lo = a.getTime();
      let hi = b.getTime();
      for (let i = 0; i < 40; i++) {
        const mid = (lo + hi) / 2;
        if (altitude(new Date(mid)) < 0) lo = mid;
        else hi = mid;
      }
      rise = new Date(hi);
    }
  }
  if (rise) check(`${label}: Ascendant at sunrise equals the Sun`, angles(rise, lat, lon).ascendant.lon, bodyLongitude("Sun", rise), 0.05);
  const noon = Astronomy.SearchHourAngle(Astronomy.Body.Sun, observer, 0, day).time.date;
  check(`${label}: Midheaven at solar noon equals the Sun`, angles(noon, lat, lon).midheaven.lon, bodyLongitude("Sun", noon), 0.05);
}

console.log("\nBirth time to UTC, including historical daylight-saving rules");
for (const [label, args, expected] of [
  ["28 Jul 1994 10:18 San Francisco (PDT)", [1994, 7, 28, 10, 18, "America/Los_Angeles"], "1994-07-28T17:18:00.000Z"],
  ["15 Jan 1990 12:00 Paris (winter)", [1990, 1, 15, 12, 0, "Europe/Paris"], "1990-01-15T11:00:00.000Z"],
  ["1 Jul 1975 12:00 Paris (no summer time that year)", [1975, 7, 1, 12, 0, "Europe/Paris"], "1975-07-01T11:00:00.000Z"],
  ["1 Jul 1985 08:00 Kolkata (+5:30)", [1985, 7, 1, 8, 0, "Asia/Kolkata"], "1985-07-01T02:30:00.000Z"],
  ["10 Jan 2001 09:00 Sydney (summer time)", [2001, 1, 10, 9, 0, "Australia/Sydney"], "2001-01-09T22:00:00.000Z"],
] as const) {
  const [y, mo, d, h, mi, tz] = args;
  checkTrue(`${label} → ${expected}`, zonedTimeToUtc(y, mo, d, h, mi, tz).toISOString() === expected);
}

console.log("\nDaily sky");
const chart = computeNatalChart({ date: "1994-07-28", time: "10:18", lat: 37.7749, lon: -122.4194, tz: "America/Los_Angeles" });
const sky = computeDailySky(chart, utc("2024-04-08T12:00"));
checkTrue("8 Apr 2024: a New Moon in Aries is announced within the day", sky.lunation?.kind === "New Moon" && sky.lunation.sign === "Aries" && sky.lunation.inDays < 1);
checkTrue("8 Apr 2024: Mercury is listed as retrograde", sky.retrogrades.includes("Mercury"));
checkTrue("Every listed transit is within its orb", sky.transits.every((t) => t.orb <= 4));

console.log("\nTransit dates (published sign changes, UTC)");
const DAY_MS = 86_400_000;
const days = (a: number, iso: string) => Math.abs(a - utc(iso).getTime()) / DAY_MS;
// Pluto crossed 0° Aquarius five times; Saturn crossed 0° Aries three times.
const pluto = scanPasses("Pluto", 300, 3, utc("2024-01-01T00:00")).flatMap((p) => p.exact);
for (const [i, iso, label] of [
  [0, "2023-03-23T12:13", "Pluto enters Aquarius, 23 Mar 2023"],
  [1, "2023-06-11T09:47", "Pluto back into Capricorn, 11 Jun 2023"],
  [2, "2024-01-21T00:50", "Pluto enters Aquarius, 21 Jan 2024"],
  [3, "2024-09-02T00:10", "Pluto back into Capricorn, 2 Sep 2024"],
  [4, "2024-11-19T20:29", "Pluto enters Aquarius for good, 19 Nov 2024"],
] as const) {
  check(label, pluto[i] === undefined ? Infinity : days(pluto[i], iso), 0, 1, " days");
}
checkTrue("Pluto crosses 0° Aquarius exactly five times", pluto.length === 5);
const saturn = scanPasses("Saturn", 0, 5, utc("2025-10-01T00:00")).flatMap((p) => p.exact);
for (const [i, iso, label] of [
  [0, "2025-05-25T03:35", "Saturn enters Aries, 25 May 2025"],
  [1, "2025-09-01T08:07", "Saturn back into Pisces, 1 Sep 2025"],
  [2, "2026-02-14T00:11", "Saturn enters Aries for good, 14 Feb 2026"],
] as const) {
  check(label, saturn[i] === undefined ? Infinity : days(saturn[i], iso), 0, 1, " days");
}

console.log("\nTransit dates (the Sun comes back to its birth position on the birthday)");
const beforeBirthday = utc("2026-07-27T12:00");
const timed = computeDailySky(chart, beforeBirthday, { timing: true, maxTransits: 60 });
const solarReturn = timed.transits.find((t) => t.planet === "Sun" && t.natal === "Sun" && t.aspect === "conjunction");
const natalSun = chart.placements.find((p) => p.body === "Sun")!.lon;
const published = Astronomy.SearchSunLongitude(natalSun, beforeBirthday, 5)!.date.getTime();
check("Solar return 2026 is exact at the computed instant", solarReturn?.exact ? days(new Date(solarReturn.exact).getTime(), new Date(published).toISOString().slice(0, 16)) : Infinity, 0, 0.05, " days");
check("The transit ends when the Sun is 2° past", solarReturn?.ends ? Math.abs(angleDiff(natalSun, bodyLongitude("Sun", new Date(solarReturn.ends)))) : Infinity, 2, 0.02);
check("The transit began when the Sun was 2° short", solarReturn?.since ? Math.abs(angleDiff(natalSun, bodyLongitude("Sun", new Date(solarReturn.since)))) : Infinity, 2, 0.02);
const young = computeNatalChart({ date: "1997-06-15", time: "08:30", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" });
const chapters = computeDailySky(young, utc("2026-11-20T07:00"), { timing: true }).phases ?? [];
const saturnReturn = chapters.find((p) => p.name === "Saturn return");
checkTrue("Born June 1997: a Saturn return is in play in November 2026", Boolean(saturnReturn));
checkTrue("Its exact dates fall inside the chapter", Boolean(saturnReturn?.since && saturnReturn.ends && saturnReturn.exact.every((t) => t > saturnReturn.since! && t < saturnReturn.ends!)));

console.log("\nDates in a reading");
const given = "Reading for Friday, November 20, 2026. Venus exact Sat 21 Nov; in range until Thu 26 Nov. Began around 14 May 2026. Exact around Mar 2027.";
checkTrue("Dates that were given pass", findDateErrors("It eases by November 26, and it began in mid-May, around May 14.", given).length === 0);
checkTrue("A date that was not given is caught", findDateErrors("This lifts on December 3.", given).length === 1);
checkTrue("A month and year is not read as a day", findDateErrors("It eases around March 2027.", given).length === 0);

console.log(failed ? `\n${failed} check(s) FAILED` : "\nAll checks passed");
process.exit(failed ? 1 : 0);
