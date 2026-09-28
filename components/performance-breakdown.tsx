"use client";

import { metricAccuracy, type ProgressMetric } from "@/lib/progress-analytics";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type PerformanceBreakdownProps = {
  title: string;
  rowLabel: string;
  dimensionLabel: string;
  dimensions: string[];
  summaryMetrics: ProgressMetric[];
  detailMetrics: ProgressMetric[];
};

export function PerformanceBreakdown({
  title,
  rowLabel,
  dimensionLabel,
  dimensions,
  summaryMetrics,
  detailMetrics,
}: PerformanceBreakdownProps) {
  const rows = [...new Set(detailMetrics.map((metric) => metric.label))].sort((a, b) => a.localeCompare(b));

  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">By {dimensionLabel.toLowerCase()}. Correct answers ÷ all questions in the selected filters; blank questions are included.</p>
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
                    <th key={dimension} className="border-b border-gray-200 px-3 py-2">{dimension}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <MetricRow
                  label="All selected questions"
                  dimensions={dimensions}
                  metrics={summaryMetrics}
                  className="bg-gray-50"
                />
                {rows.map((row) => (
                  <MetricRow
                    key={row}
                    label={row}
                    dimensions={dimensions}
                    metrics={detailMetrics.filter((metric) => metric.label === row)}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            <MobileMetricCard label="All selected questions" dimensions={dimensions} metrics={summaryMetrics} />
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
            <p className="pt-0.5 text-xs font-medium text-gray-500">{dimension}</p>
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
  const label = `${accuracy}% accuracy. ${metric.correct} correct of ${metric.total} questions. Show attempt details.`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" aria-label={label} className="block max-w-full rounded text-left outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-blue-600">
          <span className="block text-sm font-semibold text-gray-900">{accuracy}% accuracy</span>
          <span className="mt-0.5 block text-xs text-gray-600">{metric.correct} correct of {metric.total} questions</span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs p-3 leading-relaxed">
        <p className="font-semibold">{metric.correct} correct ÷ {metric.total} total questions = {accuracy}%</p>
        <p className="mt-1 text-gray-300">Blank questions are included in the total.</p>
        {detail.length > 0 && (
          <div className="mt-2 border-t border-gray-700 pt-2">
            <p className="font-medium text-white">Included submissions</p>
            <ul className="mt-1 space-y-1 text-gray-200">
              {detail.map((attempt, index) => {
                const attemptAccuracy = attempt.total ? Math.round((attempt.correct / attempt.total) * 100) : 0;
                return (
                  <li key={attempt.attemptId}>
                    {attempt.label || `Attempt ${index + 1}`}: {attempt.correct} correct of {attempt.total} questions · {attemptAccuracy}%
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
