import { ASPECT_ANGLES, norm360, type NatalChart } from "@/lib/astro/chart";
import { BODY_GLYPH, SIGN_GLYPH } from "@/lib/astro/signs";
import { SIGNS } from "@/lib/astro/chart";

const R_OUTER = 200;
const R_ZODIAC = 164;
const R_PLANET = 136;
const R_INNER = 108;

/** A drawn birth chart: zodiac ring, planets at their true positions, aspect lines. */
export function NatalWheel({ chart, className = "" }: { chart: NatalChart; className?: string }) {
  const sun = chart.placements.find((p) => p.body === "Sun")!;
  // The Ascendant sits at nine o'clock; without a birth time, the Sun's sign does.
  const anchor = chart.ascendant ? chart.ascendant.lon : Math.floor(sun.lon / 30) * 30;

  const at = (lon: number, r: number) => {
    const a = ((180 + (lon - anchor)) * Math.PI) / 180;
    return { x: +(Math.cos(a) * r).toFixed(2), y: +(-Math.sin(a) * r).toFixed(2) };
  };

  // Nudge glyphs apart when planets crowd together, keeping their order.
  const shown = [...chart.placements]
    .sort((a, b) => norm360(a.lon - anchor) - norm360(b.lon - anchor))
    .map((p) => ({ ...p, display: norm360(p.lon - anchor) }));
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 1; i < shown.length; i++) {
      if (shown[i].display - shown[i - 1].display < 10) shown[i].display = shown[i - 1].display + 10;
    }
  }

  return (
    <svg
      viewBox="-210 -210 420 420"
      className={className}
      role="img"
      aria-label={`Birth chart: ${chart.placements.map((p) => `${p.body} in ${p.sign}`).join(", ")}`}
    >
      <g fill="none" stroke="color-mix(in srgb, var(--goldc) 38%, transparent)" strokeWidth="1">
        <circle r={R_OUTER} stroke="var(--gold)" />
        <circle r={R_ZODIAC} />
        <circle r={R_INNER} />
        {SIGNS.map((_, i) => {
          const a = at(i * 30, R_ZODIAC);
          const b = at(i * 30, R_OUTER);
          return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} />;
        })}
      </g>

      {SIGNS.map((sign, i) => {
        const p = at(i * 30 + 15, (R_OUTER + R_ZODIAC) / 2);
        return (
          <text
            key={sign}
            x={p.x}
            y={p.y}
            className="glyph"
            fontSize="17"
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--gold)"
          >
            {SIGN_GLYPH[sign]}
          </text>
        );
      })}

      <g strokeWidth="0.75" fill="none">
        {chart.aspects.slice(0, 12).map((aspect) => {
          const a = chart.placements.find((p) => p.body === aspect.a)!;
          const b = chart.placements.find((p) => p.body === aspect.b)!;
          if (ASPECT_ANGLES[aspect.aspect] === 0) return null;
          const p1 = at(a.lon, R_INNER);
          const p2 = at(b.lon, R_INNER);
          const hard = aspect.aspect === "square" || aspect.aspect === "opposition";
          return (
            <line
              key={`${aspect.a}${aspect.b}`}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={hard ? "var(--text)" : "var(--gold)"}
              opacity={hard ? 0.22 : 0.55}
            />
          );
        })}
      </g>

      {shown.map((p) => {
        const tickFrom = at(p.lon, R_ZODIAC);
        const tickTo = at(p.lon, R_ZODIAC - 7);
        const glyph = at(p.display + anchor, R_PLANET);
        const dot = at(p.lon, R_INNER);
        return (
          <g key={p.body}>
            <line x1={tickFrom.x} y1={tickFrom.y} x2={tickTo.x} y2={tickTo.y} stroke="var(--text)" strokeWidth="1" />
            <circle cx={dot.x} cy={dot.y} r="1.6" fill="var(--text)" />
            <text
              x={glyph.x}
              y={glyph.y}
              className="glyph"
              fontSize="19"
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--text)"
            >
              {BODY_GLYPH[p.body]}
            </text>
          </g>
        );
      })}

      {chart.ascendant && (
        <g>
          <line x1={-R_OUTER - 8} y1="0" x2={-R_INNER} y2="0" stroke="var(--text)" strokeWidth="1" />
          <text
            x={-R_INNER + 8}
            y="-7"
            fontSize="8"
            letterSpacing="2"
            fill="var(--muted)"
            style={{ fontFamily: "var(--sans)" }}
          >
            ASC
          </text>
        </g>
      )}
    </svg>
  );
}
