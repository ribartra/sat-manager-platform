/** Small SVG line chart (scores over time). Markers differ per series so colour is not the only cue. */
export function LineChart({
  series,
  labels,
  min,
  max,
  title,
}: {
  series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[];
  labels: string[];
  min: number;
  max: number;
  title: string;
}) {
  const W = 440;
  const H = 200;
  const pad = { l: 40, r: 12, t: 12, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="h-auto w-full">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#e5e7eb" />
            <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill="#6b7280">{Math.round(t)}</text>
          </g>
        ))}
        {labels.map((label, i) => (
          <text key={`${label}-${i}`} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#6b7280">{label}</text>
        ))}
        {series.map((s, si) => {
          const pts = s.values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter(Boolean) as (readonly [number, number])[];
          return (
            <g key={s.name}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                points={pts.map((p) => p.join(",")).join(" ")}
              />
              {s.values.map((v, i) =>
                v === null ? null : (
                  <g key={i}>
                    {si % 2 === 0 ? (
                      <circle cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />
                    ) : (
                      <rect x={x(i) - 3.5} y={y(v) - 3.5} width={7} height={7} fill={s.color} />
                    )}
                    <text x={x(i)} y={y(v) - 7} textAnchor="middle" fontSize="9" fill="#374151">{v}</text>
                  </g>
                ),
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-4" style={{ backgroundColor: s.color }} /> {s.name}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}
