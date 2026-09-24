"use client";

import { useMemo, useState } from "react";
import type { TopicTrendPoint } from "@/lib/progress-analytics";

const SERIES = [
  { key: "easy", label: "Easy", color: "#16a34a" },
  { key: "medium", label: "Medium", color: "#d97706" },
  { key: "hard", label: "Hard", color: "#dc2626" },
] as const;

export function TopicDifficultyTrend({ topics, pointsByTopic }: {
  topics: string[];
  pointsByTopic: Record<string, TopicTrendPoint[]>;
}) {
  const [topic, setTopic] = useState(topics[0] ?? "");
  const points = useMemo(() => pointsByTopic[topic] ?? [], [pointsByTopic, topic]);
  const width = 640;
  const height = 240;
  const left = 42;
  const right = 12;
  const top = 16;
  const bottom = 36;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const x = (index: number) => left + (points.length <= 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const y = (value: number) => top + ((100 - value) / 100) * plotHeight;

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Score progress by topic and difficulty</h3>
          <p className="mt-1 text-xs text-gray-500">Question-weighted accuracy for each submitted attempt</p>
        </div>
        <label className="text-xs font-medium text-gray-600">
          Topic
          <select value={topic} onChange={(event) => setTopic(event.target.value)} className="ml-2 max-w-56 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-800">
            {topics.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
      </div>
      {points.length === 0 ? (
        <p className="flex min-h-40 items-center justify-center text-sm text-gray-400">No submitted attempts yet.</p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1">
            {SERIES.map((series) => (
              <span key={series.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: series.color }} />{series.label}
              </span>
            ))}
          </div>
          <div className="overflow-x-auto">
            <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Accuracy over attempts for ${topic}`} className="h-56 min-w-[34rem] w-full">
              {[0, 25, 50, 75, 100].map((value) => (
                <g key={value}>
                  <line x1={left} x2={width - right} y1={y(value)} y2={y(value)} stroke="#e5e7eb" />
                  <text x={left - 8} y={y(value) + 4} textAnchor="end" fontSize="10" fill="#6b7280">{value}%</text>
                </g>
              ))}
              {SERIES.map((series) => {
                const segments: { index: number; value: number }[][] = [];
                points.forEach((point, index) => {
                  const value = point[series.key];
                  if (value === null) return;
                  const last = segments[segments.length - 1];
                  if (last && last[last.length - 1].index === index - 1) last.push({ index, value });
                  else segments.push([{ index, value }]);
                });
                return (
                  <g key={series.key}>
                    {segments.filter((segment) => segment.length > 1).map((segment) => <polyline key={segment[0].index} fill="none" stroke={series.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" points={segment.map((point) => `${x(point.index)},${y(point.value)}`).join(" ")} />)}
                    {segments.flat().map((point) => <circle key={point.index} cx={x(point.index)} cy={y(point.value)} r="4" fill={series.color}><title>{`${series.label}: ${point.value}% — ${points[point.index].attemptLabel}`}</title></circle>)}
                  </g>
                );
              })}
              {points.map((point, index) => (
                <text key={`${point.attemptLabel}-${index}`} x={x(index)} y={height - 10} textAnchor="middle" fontSize="10" fill="#6b7280" aria-label={point.attemptLabel}>
                  {point.submittedAt ? new Date(point.submittedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : `#${index + 1}`}
                </text>
              ))}
            </svg>
          </div>
          <p className="mt-1 text-right text-[11px] text-gray-400">Attempts in chronological order</p>
        </>
      )}
    </section>
  );
}
