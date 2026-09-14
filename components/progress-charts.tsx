import { scoreBandBarClass, scoreBandTextClass } from "@/lib/score-band";
import { metricAccuracy, type MockSectionMetric, type ProgressMetric, DIFFICULTY_ORDER } from "@/lib/progress-analytics";

function difficultyLabel(value: string) {
  return value === "EASY" ? "Easy" : value === "MEDIUM" ? "Medium" : value === "HARD" ? "Hard" : "Unspecified";
}

export function DifficultyAccuracyChart({ metrics }: { metrics: ProgressMetric[] }) {
  const visible = DIFFICULTY_ORDER.map((difficulty) => metrics.find((metric) => metric.difficulty === difficulty)).filter(
    (metric): metric is ProgressMetric => Boolean(metric),
  );
  return (
    <ChartFrame title="Average accuracy by difficulty" description="Submitted answers only">
      {visible.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="flex h-48 items-end justify-around gap-4 border-b border-l border-gray-200 px-4 pb-2 pt-4">
          {visible.map((metric) => {
            const accuracy = metricAccuracy(metric);
            return (
              <div key={metric.difficulty} className="flex h-full min-w-20 flex-1 flex-col items-center justify-end gap-2">
                <span className={`text-xs font-semibold ${scoreBandTextClass(accuracy)}`}>{accuracy}%</span>
                <div className="flex h-full w-full max-w-16 items-end rounded-t bg-gray-100">
                  <div className={`w-full rounded-t ${scoreBandBarClass(accuracy)}`} style={{ height: `${Math.max(accuracy, 4)}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-600">{difficultyLabel(metric.difficulty)}</span>
                <span className="text-[11px] text-gray-400">{metric.correct}/{metric.total}</span>
              </div>
            );
          })}
        </div>
      )}
    </ChartFrame>
  );
}

export function TopicDifficultyChart({ metrics }: { metrics: ProgressMetric[] }) {
  const topics = [...new Set(metrics.map((metric) => metric.label))];
  return (
    <ChartFrame title="Exercise progress by topic" description="Accuracy grouped by topic and difficulty">
      {topics.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-4">
          <div className="hidden grid-cols-[minmax(9rem,1.3fr)_repeat(3,minmax(5rem,1fr))] gap-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 sm:grid">
            <span>Topic</span>
            {DIFFICULTY_ORDER.map((difficulty) => <span key={difficulty}>{difficultyLabel(difficulty)}</span>)}
          </div>
          {topics.map((topic) => (
            <div key={topic} className="grid gap-2 sm:grid-cols-[minmax(9rem,1.3fr)_repeat(3,minmax(5rem,1fr))] sm:items-center sm:gap-3">
              <span className="truncate text-sm font-medium text-gray-700" title={topic}>{topic}</span>
              {DIFFICULTY_ORDER.map((difficulty) => {
                const metric = metrics.find((item) => item.label === topic && item.difficulty === difficulty);
                const accuracy = metric ? metricAccuracy(metric) : null;
                return (
                  <div key={difficulty} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 sm:block">
                    <span className="text-[11px] text-gray-400 sm:hidden">{difficultyLabel(difficulty)}</span>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] text-gray-500">
                        <span>{accuracy === null ? "No data" : `${accuracy}%`}</span>
                        {metric ? <span>{metric.correct}/{metric.total}</span> : null}
                      </div>
                      <div className="h-2 rounded-full bg-gray-100">
                        <div className={`h-2 rounded-full ${accuracy === null ? "bg-gray-200" : scoreBandBarClass(accuracy)}`} style={{ width: `${accuracy ?? 0}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

export function MockSectionChart({ metrics }: { metrics: MockSectionMetric[] }) {
  return (
    <ChartFrame title="Full Practice Test progress" description="SAT score by test and section">
      {metrics.length === 0 ? (
        <EmptyChart />
      ) : (
        <div className="space-y-4">
          {metrics.map((metric) => (
            <div key={`${metric.label}-${metric.submittedAt ?? "pending"}`}>
              <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                <span className="truncate font-medium text-gray-700" title={metric.label}>{metric.label}</span>
                <span className="shrink-0 text-gray-500">Total {metric.totalScore ?? "-"}</span>
              </div>
              <ScoreBar label="Math" value={metric.mathScore} />
              <ScoreBar label="Reading & Writing" value={metric.rwScore} />
            </div>
          ))}
        </div>
      )}
    </ChartFrame>
  );
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="mb-1 grid grid-cols-[6.5rem_1fr_3rem] items-center gap-2 text-[11px] last:mb-0">
      <span className="text-gray-400">{label}</span>
      <div className="h-2 rounded-full bg-gray-100">
        <div className="h-2 rounded-full bg-blue-500" style={{ width: `${value === null ? 0 : Math.min(100, (value / 800) * 100)}%` }} />
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
  return <p className="flex min-h-32 items-center justify-center text-sm text-gray-400">No submitted data yet.</p>;
}
