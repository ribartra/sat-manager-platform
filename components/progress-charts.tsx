import { scoreBandTextClass } from "@/lib/score-band";
import { metricAccuracy, type MockSectionMetric, type ProgressMetric, DIFFICULTY_ORDER } from "@/lib/progress-analytics";
import type { AreaTabKey } from "@/lib/practice-area";

function difficultyLabel(value: string) {
  return value === "EASY" ? "Easy" : value === "MEDIUM" ? "Medium" : value === "HARD" ? "Hard" : "Unspecified";
}

const AREA_COLORS: Record<AreaTabKey, string> = {
  math: "var(--sat-area-math)",
  reading: "var(--sat-area-reading)",
  writing: "var(--sat-area-writing)",
  mocks: "var(--sat-area-mocks)",
};

export function DifficultyAccuracyChart({ metrics, area = "math" }: { metrics: ProgressMetric[]; area?: AreaTabKey }) {
  const visible = [
    ...DIFFICULTY_ORDER.map((difficulty) => metrics.find((metric) => metric.difficulty === difficulty)).filter(
      (metric): metric is ProgressMetric => Boolean(metric),
    ),
    ...metrics.filter((metric) => !DIFFICULTY_ORDER.includes(metric.difficulty as (typeof DIFFICULTY_ORDER)[number])),
  ];
  return (
    <ChartFrame title="Average by difficulty" description="Question-weighted accuracy from answered questions">
      {visible.length === 0 ? (
        <EmptyChart />
      ) : (
        <div>
          <div className="flex gap-2">
            {/* y-axis scale 0–100% */}
            <div className="flex h-44 w-8 shrink-0 flex-col justify-between py-0.5 text-right text-[10px] text-gray-500">
              <span>100%</span>
              <span>50%</span>
              <span>0%</span>
            </div>
            {/* plot area with reference gridlines */}
            <div className="relative h-44 flex-1 border-b border-l border-gray-200">
              <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-gray-100" />
              <div className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-gray-100" />
              <div className="flex h-full items-end justify-around gap-4 px-3">
                {visible.map((metric) => {
                  const accuracy = metricAccuracy(metric);
                  return (
                    <div key={metric.difficulty} className="flex h-full min-w-16 flex-1 flex-col items-center justify-end">
                      <div
                        className="relative w-full max-w-16 rounded-t"
                        style={{ height: `${Math.max(accuracy, 2)}%`, backgroundColor: AREA_COLORS[area] }}
                      >
                        <span className={`absolute -top-4 left-1/2 -translate-x-1/2 text-xs font-semibold ${scoreBandTextClass(accuracy)}`}>
                          {accuracy}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          {/* x-axis labels aligned under bars */}
          <div className="mt-2 flex gap-2">
            <div className="w-8 shrink-0" />
            <div className="flex flex-1 items-start justify-around gap-4 px-3">
              {visible.map((metric) => (
                <div key={metric.difficulty} className="flex min-w-16 flex-1 flex-col items-center text-center">
                  <span className="text-xs font-medium text-gray-600">{difficultyLabel(metric.difficulty)}</span>
                  <span className="text-[11px] text-gray-500">{metric.correct}/{metric.total} · {metric.attempts} attempt{metric.attempts === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </ChartFrame>
  );
}

export function TopicDifficultyChart({ metrics, area = "math" }: { metrics: ProgressMetric[]; area?: AreaTabKey }) {
  const topics = [...new Set(metrics.map((metric) => metric.label))];
  const difficulties = metrics.some((metric) => !DIFFICULTY_ORDER.includes(metric.difficulty as (typeof DIFFICULTY_ORDER)[number]))
    ? [...DIFFICULTY_ORDER, "UNSPECIFIED"]
    : DIFFICULTY_ORDER;
  const difficultyGridClass = difficulties.length === 4
    ? "sm:grid-cols-[minmax(11rem,1.3fr)_repeat(4,minmax(5rem,1fr))]"
    : "sm:grid-cols-[minmax(11rem,1.3fr)_repeat(3,minmax(5rem,1fr))]";
  return (
    <ChartFrame title="Progress by topic and difficulty" description="Accuracy, answered questions, and distinct attempts">
      {topics.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="overflow-x-auto">
        <div className="space-y-4 sm:min-w-[34rem]">
          <div className={`hidden ${difficultyGridClass} gap-3 text-[11px] font-medium uppercase tracking-wide text-gray-500 sm:grid`}>
            <span>Topic</span>
            {difficulties.map((difficulty) => <span key={difficulty}>{difficultyLabel(difficulty)}</span>)}
          </div>
          {topics.map((topic) => (
            <div key={topic} className={`grid gap-2 ${difficultyGridClass} sm:items-center sm:gap-3`}>
              <span className="truncate text-sm font-medium text-gray-700" title={topic}>{topic}</span>
              {difficulties.map((difficulty) => {
                const metric = metrics.find((item) => item.label === topic && item.difficulty === difficulty);
                const accuracy = metric ? metricAccuracy(metric) : null;
                return (
                  <div key={difficulty} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 sm:block">
                    <span className="text-[11px] text-gray-500 sm:hidden">{difficultyLabel(difficulty)}</span>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                        <span>{accuracy === null ? "No data" : `${accuracy}%`}</span>
                        {metric ? <span>{metric.correct}/{metric.total} · {metric.attempts} attempt{metric.attempts === 1 ? "" : "s"}</span> : null}
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className="h-2 rounded-full" style={{ width: `${accuracy ?? 0}%`, backgroundColor: accuracy === null ? "var(--sat-gray-200)" : AREA_COLORS[area] }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        </div>
      )}
    </ChartFrame>
  );
}

export function MockSectionChart({ metrics }: { metrics: MockSectionMetric[] }) {
  return (
    <ChartFrame title="Full Practice Test progress" description="SAT score by exam attempt and section">
      {metrics.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={`${metric.label}-${metric.submittedAt ?? "pending"}`}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-gray-700" title={metric.label}>{metric.label}</span>
                <span className="shrink-0 text-gray-500">Total {metric.totalScore ?? "-"} · {metric.attempts} attempt{metric.attempts === 1 ? "" : "s"}</span>
              </div>
              <ScoreBar label="Math" value={metric.mathScore} color={AREA_COLORS.math} />
              <ScoreBar label="Reading & Writing" value={metric.rwScore} color={AREA_COLORS.mocks} />
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number | null; color: string }) {
  return (
    <div className="mb-1 grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-[11px] last:mb-0">
      <span className="text-gray-500">{label}</span>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full" style={{ width: `${value === null ? 0 : Math.min(100, (value / 800) * 100)}%`, backgroundColor: color }} />
      </div>
      <span className="text-right font-medium text-gray-600">{value ?? "-"}</span>
    </div>
  );
}

function ChartFrame({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-md border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="mt-1 text-xs text-gray-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyChart() {
  return <p className="flex min-h-32 items-center justify-center text-sm text-gray-500">No submitted data yet.</p>;
}
