import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import tzLookup from "tz-lookup";

export type City = { label: string; lat: number; lon: number; tz: string };

// [name, admin code, country code, lat, lon], sorted by population (largest first).
type Row = [string, string, string, number, number];

let rows: Row[] | null = null;
let keys: string[] | null = null;

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

function load() {
  if (!rows) {
    rows = JSON.parse(readFileSync(path.join(process.cwd(), "data", "cities.json"), "utf8")) as Row[];
    keys = rows.map((r) => fold(r[0]));
  }
  return { rows, keys: keys! };
}

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function toCity([name, admin, country, lat, lon]: Row): City {
  let countryName = country;
  try {
    countryName = countryNames.of(country) ?? country;
  } catch {}
  return {
    label: [name, admin, countryName].filter(Boolean).join(", "),
    lat,
    lon,
    tz: tzLookup(lat, lon),
  };
}

export function searchCities(query: string, limit = 7): City[] {
  const q = fold(query);
  if (q.length < 2) return [];
  const { rows, keys } = load();
  const starts: Row[] = [];
  const contains: Row[] = [];
  for (let i = 0; i < rows.length && starts.length < limit; i++) {
    if (keys[i].startsWith(q)) starts.push(rows[i]);
    else if (contains.length < limit && keys[i].includes(` ${q}`)) contains.push(rows[i]);
  }
  return [...starts, ...contains].slice(0, limit).map(toCity);
}
