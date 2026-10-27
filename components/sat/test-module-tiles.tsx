import Link from "next/link";
import type { ReactNode } from "react";
import type { ModuleView } from "@/lib/test-view";
import { cn } from "@/lib/utils";

/**
 * The 4 module boxes of a Test (mockup `mejorada/teacher/tests.html` `.mods4`): section-coloured
 * top border, short name and "questions · minutes · level". 4 columns, 2 on small screens (or always
 * 2 with `columns={2}`, e.g. one section per row in a narrow card). With `hrefFor` each box opens that
 * module; with `resultFor` the box shows an attempt's result for the module (e.g. "23/27 correct").
 */
export function TestModuleTiles({
  modules,
  hrefFor,
  resultFor,
  columns = 4,
}: {
  modules: ModuleView[];
  hrefFor?: (module: ModuleView) => string | null;
  resultFor?: (module: ModuleView) => ReactNode;
  columns?: 2 | 4;
}) {
  if (modules.length === 0) return <p className="text-xs text-gray-400">No modules yet.</p>;
  return (
    <div className={cn("grid grid-cols-2 gap-2", columns === 4 && "md:grid-cols-4")}>
      {modules.map((m) => {
        const color = m.section === "MATH" ? "var(--sat-area-math)" : "var(--sat-area-reading)";
        const href = hrefFor?.(m) ?? null;
        const className = cn(
          "block min-w-0 rounded-lg border border-[var(--sat-border)] border-t-[3px] bg-white px-3 py-2",
          href && "transition-[border-color,box-shadow] hover:shadow-[0_4px_14px_rgba(37,99,235,.1)]",
        );
        const body = (
          <>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{m.short}</p>
            {resultFor ? <div className="text-sm font-semibold text-[var(--sat-text)]">{resultFor(m)}</div> : null}
            <p className="truncate text-xs text-[var(--sat-muted)]">{m.questionCount} questions · {m.minutes} min · {m.tier}</p>
          </>
        );
        return href ? (
          <Link key={m.key} href={href} className={className} style={{ borderTopColor: color }} title={`Open ${m.short}`}>
            {body}
          </Link>
        ) : (
          <div key={m.key} className={className} style={{ borderTopColor: color }}>
            {body}
          </div>
        );
      })}
    </div>
  );
}
