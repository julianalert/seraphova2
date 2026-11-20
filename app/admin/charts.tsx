// Small server-rendered charts for the dashboard. One measure per chart, one hue,
// values always available as text; each bar carries its exact value on hover.

export function BarRows({ rows, total }: { rows: { label: string; count: number }[]; total: number }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="adm-bars">
      {rows.map((row) => (
        <div className="adm-bar-row" key={row.label} title={`${row.label}: ${row.count}`}>
          <span className="adm-bar-label">{row.label}</span>
          <span className="adm-bar-track">
            <span className="adm-bar-fill" style={{ width: `${(row.count / max) * 100}%` }} />
          </span>
          <span className="adm-bar-value">
            {row.count}
            <small>{total > 0 ? ` · ${Math.round((row.count / total) * 100)}%` : ""}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

const W = 600;
const H = 96;

export function TrendChart({
  title,
  unit,
  points,
}: {
  title: string;
  unit: string;
  points: { bucket: string; value: number }[];
}) {
  const max = Math.max(1, ...points.map((p) => p.value));
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const step = W / Math.max(1, points.length);
  const gap = step > 6 ? 2 : 0.5;

  return (
    <figure className="adm-trend">
      <figcaption>
        <span className="adm-trend-title">{title}</span>
        <span className="adm-trend-total">
          {total} <small>{unit}</small>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`${title}: ${total} ${unit}, peak ${max}`}>
        {points.map((point, i) => {
          const height = point.value > 0 ? Math.max(2, (point.value / max) * (H - 4)) : 0;
          return (
            <g key={point.bucket} className="adm-trend-bar">
              <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
              <rect x={i * step + gap / 2} y={H - height} width={Math.max(1, step - gap)} height={height} rx={Math.min(3, (step - gap) / 2)} />
              <title>{`${point.bucket}: ${point.value}`}</title>
            </g>
          );
        })}
      </svg>
      <div className="adm-trend-axis">
        <span>{points[0]?.bucket}</span>
        <span>peak {max}</span>
        <span>{points.at(-1)?.bucket}</span>
      </div>
    </figure>
  );
}
