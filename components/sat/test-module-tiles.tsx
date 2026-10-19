import Link from "next/link";
import type { ModuleView } from "@/lib/test-view";
import { cn } from "@/lib/utils";

/**
 * The 4 module boxes of a Test (mockup `mejorada/teacher/tests.html` `.mods4`): section-coloured
 * top border, short name and "questions · minutes · level". 4 columns, 2 on small screens.
 * With `hrefFor` each box opens that module (e.g. its questions on the Test page).
 */
export function TestModuleTiles({ modules, hrefFor }: { modules: ModuleView[]; hrefFor?: (module: ModuleView) => string }) {
  if (modules.length === 0) return <p className="text-xs text-gray-400">No modules yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {modules.map((m) => {
        const color = m.section === "MATH" ? "var(--sat-area-math)" : "var(--sat-area-reading)";
        const className = cn(
          "block rounded-lg border border-[var(--sat-border)] border-t-[3px] bg-white px-3 py-2",
          hrefFor && "transition-[border-color,box-shadow] hover:shadow-[0_4px_14px_rgba(37,99,235,.1)]",
        );
        const body = (
          <>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{m.short}</p>
            <p className="text-xs text-[var(--sat-muted)]">{m.questionCount} questions · {m.minutes} min · {m.tier}</p>
          </>
        );
        return hrefFor ? (
          <Link key={m.key} href={hrefFor(m)} className={className} style={{ borderTopColor: color }} title={`Open ${m.short}`}>
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
