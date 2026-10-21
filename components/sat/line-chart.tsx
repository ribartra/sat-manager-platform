/**
 * Small SVG line chart (scores over time). `notes` adds a second line under each x label (e.g. the
 * time a test took) and goes into each point's tooltip. Edge labels are anchored inward so they are
 * never clipped, and value labels of different series at the same point never overlap.
 */
export function LineChart({
  series,
  labels,
  notes,
  min,
  max,
  title,
}: {
  series: { name: string; color: string; values: (number | null)[]; dashed?: boolean }[];
  labels: string[];
  /** Optional second line per x label, e.g. "1 h 52 min" taken. */
  notes?: (string | null)[];
  min: number;
  max: number;
  title: string;
}) {
  const hasNotes = Boolean(notes?.some(Boolean));
  const W = 440;
  const H = hasNotes ? 214 : 200;
  const pad = { l: 40, r: 14, t: 14, b: hasNotes ? 42 : 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length <= 1 ? iw / 2 : (i * iw) / (labels.length - 1));
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min)) * ih;
  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  // First/last labels hug the plot edges so long labels ("T1 · try 1") are not cut off.
  const anchor = (i: number) => (labels.length <= 1 ? "middle" : i === 0 ? "start" : i === labels.length - 1 ? "end" : "middle");
  const labelX = (i: number) => (labels.length <= 1 ? x(i) : i === 0 ? x(i) - 6 : i === labels.length - 1 ? x(i) + 6 : x(i));

  // Value label above the point, unless another series' point is close above it: then below.
  const below = (si: number, i: number) => {
    const v = series[si].values[i];
    if (v === null) return false;
    return series.some((other, oi) => {
      const ov = other.values[i];
      return oi !== si && ov !== null && Math.abs(y(ov) - y(v)) < 14 && (y(v) > y(ov) || (y(v) === y(ov) && si > oi));
    });
  };

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
          <text key={`${label}-${i}`} x={labelX(i)} y={H - (hasNotes ? 22 : 8)} textAnchor={anchor(i)} fontSize="10" fill="#6b7280">
            {label}
            {notes?.[i] ? (
              <tspan x={labelX(i)} dy="13" fontSize="9" fill="#9ca3af">
                {notes[i]}
              </tspan>
            ) : null}
          </text>
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
                    <title>{`${s.name}: ${v} · ${labels[i]}${notes?.[i] ? ` · ${notes[i]}` : ""}`}</title>
                    {si % 2 === 0 ? (
                      <circle cx={x(i)} cy={y(v)} r={3.5} fill={s.color} />
                    ) : (
                      <rect x={x(i) - 3.5} y={y(v) - 3.5} width={7} height={7} fill={s.color} />
                    )}
                    <text x={x(i)} y={below(si, i) ? y(v) + 14 : y(v) - 7} textAnchor={anchor(i)} fontSize="9" fill="#374151">
                      {v}
                    </text>
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
        {hasNotes ? <span className="text-gray-400">Under each test: time taken</span> : null}
      </figcaption>
    </figure>
  );
}
