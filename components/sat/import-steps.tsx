import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const IMPORT_STEP_LABELS = ["What & PDF", "AI file", "Review & Draft"] as const;

/**
 * Import with AI stepper (steps 1–3, also on its Review & crop page): done and reachable steps are
 * links, the current one is highlighted.
 */
export function ImportSteps({ current, hrefs = {} }: { current: 1 | 2 | 3; hrefs?: Partial<Record<1 | 2 | 3, string>> }) {
  return (
    <nav aria-label="Import steps" className="mb-5">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {IMPORT_STEP_LABELS.map((label, index) => {
          const step = (index + 1) as 1 | 2 | 3;
          const done = step < current;
          const active = step === current;
          const body = (
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-medium",
                active && "border-[var(--sat-primary)] bg-[var(--sat-primary-soft)] text-[var(--sat-primary)]",
                done && "border-[var(--sat-border)] bg-white text-gray-700",
                !active && !done && "border-dashed border-[var(--sat-border)] text-gray-400",
              )}
            >
              <span
                className={cn(
                  "grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold",
                  active ? "bg-[var(--sat-primary)] text-white" : done ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500",
                )}
              >
                {done ? <Check size={12} aria-hidden /> : step}
              </span>
              {label}
            </span>
          );
          const href = hrefs[step];
          return (
            <li key={label} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
              {href && !active ? (
                <Link href={href} className="rounded-full hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
              {step < 3 ? <span aria-hidden className="h-px w-6 bg-[var(--sat-border)]" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Same card header in every step: number badge, title and one line of help. */
export function ImportStepHeader({ step, title, help, aside }: { step: 1 | 2 | 3; title: string; help?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-3">
      <div className="flex items-start gap-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--sat-primary)] text-sm font-bold text-white">{step}</span>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {help ? <p className="mt-0.5 text-sm text-gray-500">{help}</p> : null}
        </div>
      </div>
      {aside ? <div className="text-sm text-gray-500">{aside}</div> : null}
    </div>
  );
}
