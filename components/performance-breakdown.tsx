"use client";

import { metricAccuracy, type ProgressMetric } from "@/lib/progress-analytics";
import { difficultyLabel } from "@/lib/domain-meta";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PerformanceBreakdownProps = {
  title: string;
  rowLabel: string;
  dimensionLabel: string;
  dimensions: string[];
  /** "All questions" row; omit it when the rows already cover everything (e.g. section x module). */
  summaryMetrics?: ProgressMetric[];
  detailMetrics: ProgressMetric[];
  /** Optional ordered grouping (e.g. Domain → Skills in official order). Without it rows are alphabetical. */
  groups?: Array<{ label: string; rows: string[] }>;
};

export function PerformanceBreakdown({
  title,
  rowLabel,
  dimensionLabel,
  dimensions,
  summaryMetrics,
  detailMetrics,
  groups,
}: PerformanceBreakdownProps) {
  const present = new Set(detailMetrics.map((metric) => metric.label));
  const sections: Array<{ label: string | null; rows: string[] }> = groups
    ? groups.map((group) => ({ label: group.label, rows: group.rows.filter((row) => present.has(row)) })).filter((group) => group.rows.length > 0)
    : [{ label: null, rows: [...present].sort((a, b) => a.localeCompare(b)) }];
  const grouped = new Set(sections.flatMap((section) => section.rows));
  const leftovers = [...present].filter((row) => !grouped.has(row)).sort((a, b) => a.localeCompare(b));
  if (leftovers.length) sections.push({ label: groups ? "Other" : null, rows: leftovers });
  const rows = sections.flatMap((section) => section.rows);

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">% correct for each {rowLabel.toLowerCase()} and {dimensionLabel.toLowerCase() === "difficulty" ? "level" : dimensionLabel.toLowerCase()}. Blank answers count as wrong.</p>
      </div>

      {rows.length === 0 ? (
        <p className="flex min-h-32 items-center justify-center text-sm text-gray-500">No submitted data yet.</p>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  <th className="border-b border-gray-200 px-3 py-2">{rowLabel}</th>
                  {dimensions.map((dimension) => (
                    <th key={dimension} className="border-b border-gray-200 px-3 py-2">{difficultyLabel(dimension)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {summaryMetrics ? (
                  <MetricRow
                    label="All questions"
                    dimensions={dimensions}
                    metrics={summaryMetrics}
                    className="bg-gray-50"
                  />
                ) : null}
                {sections.map((section) => [
                  section.label ? (
                    <tr key={`group-${section.label}`}>
                      <td colSpan={dimensions.length + 1} className="border-b border-gray-200 bg-white px-3 pb-1 pt-3 text-xs font-semibold text-gray-600">
                        {section.label}
                      </td>
                    </tr>
                  ) : null,
                  ...section.rows.map((row) => (
                    <MetricRow
                      key={row}
                      label={row}
                      dimensions={dimensions}
                      metrics={detailMetrics.filter((metric) => metric.label === row)}
                    />
                  )),
                ])}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {summaryMetrics ? <MobileMetricCard label="All questions" dimensions={dimensions} metrics={summaryMetrics} /> : null}
            {rows.map((row) => (
              <MobileMetricCard
                key={row}
                label={row}
                dimensions={dimensions}
                metrics={detailMetrics.filter((metric) => metric.label === row)}
              />
            ))}
          </div>
        </TooltipProvider>
      )}
    </section>
  );
}

function MetricRow({
  label,
  dimensions,
  metrics,
  className,
}: {
  label: string;
  dimensions: string[];
  metrics: ProgressMetric[];
  className?: string;
}) {
  return (
    <tr className={className}>
      <th scope="row" className="border-b border-gray-100 px-3 py-3 align-top font-medium text-gray-800">{label}</th>
      {dimensions.map((dimension) => (
        <td key={dimension} className="border-b border-gray-100 px-3 py-3 align-top">
          <MetricCell metric={metrics.find((item) => item.difficulty === dimension) ?? null} />
        </td>
      ))}
    </tr>
  );
}

function MobileMetricCard({ label, dimensions, metrics }: { label: string; dimensions: string[]; metrics: ProgressMetric[] }) {
  return (
    <article className="rounded-md border border-gray-100 p-3">
      <h4 className="mb-3 text-sm font-medium text-gray-800">{label}</h4>
      <div className="space-y-3">
        {dimensions.map((dimension) => (
          <div key={dimension} className="grid grid-cols-[5.5rem_1fr] gap-3">
            <p className="pt-0.5 text-xs font-medium text-gray-500">{difficultyLabel(dimension)}</p>
            <MetricCell metric={metrics.find((item) => item.difficulty === dimension) ?? null} />
          </div>
        ))}
      </div>
    </article>
  );
}

function MetricCell({ metric }: { metric: ProgressMetric | null }) {
  if (!metric || metric.total === 0) return <span className="text-xs text-gray-400">No questions answered</span>;
  const accuracy = metricAccuracy(metric);
  const detail = metric.attemptDetails;
  const label = `${accuracy}% correct. ${metric.correct} of ${metric.total} correct. Show details.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="block max-w-full rounded text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-600">
          <span className="block text-sm font-semibold text-gray-900">{accuracy}% correct</span>
          <span className="mt-0.5 block text-xs text-gray-600">{metric.correct} of {metric.total} correct</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs p-3 leading-relaxed">
        <p className="font-semibold">{metric.correct} of {metric.total} correct ({accuracy}%)</p>
        <p className="mt-1 text-gray-300">Blank answers count as wrong.</p>
        {detail.length > 0 && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <p className="font-medium text-white">Based on:</p>
            <ul className="mt-1 space-y-1 text-gray-200">
              {detail.map((attempt, index) => {
                const attemptAccuracy = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
                return (
                  <li key={attempt.attemptId}>
                    {attempt.label || `Try ${index + 1}`}: {attempt.correct} of {attempt.total} correct · {attemptAccuracy}%
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
