// Builds data/cities.json from the GeoNames-derived `all-the-cities` package.
// Run: node scripts/build-cities.mjs   (data © GeoNames, CC BY 4.0)
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const cities = require("all-the-cities");

const rows = cities
  .filter((c) => c.population >= 3000)
  .sort((a, b) => b.population - a.population)
  .map((c) => [
    c.name,
    /^[A-Z]{2,3}$/.test(c.adminCode ?? "") ? c.adminCode : "",
    c.country,
    Math.round(c.loc.coordinates[1] * 1e4) / 1e4,
    Math.round(c.loc.coordinates[0] * 1e4) / 1e4,
  ]);

writeFileSync(new URL("../data/cities.json", import.meta.url), JSON.stringify(rows));
console.log(`wrote ${rows.length} cities`);
