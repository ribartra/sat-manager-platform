import type { ModuleView } from "@/lib/test-view";

/**
 * The 4 module boxes of a Test (mockup `mejorada/teacher/tests.html` `.mods4`): section-coloured
 * top border, short name and "questions · minutes · level". 4 columns, 2 on small screens.
 */
export function TestModuleTiles({ modules }: { modules: ModuleView[] }) {
  if (modules.length === 0) return <p className="text-xs text-gray-400">No modules yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {modules.map((m) => {
        const color = m.section === "MATH" ? "var(--sat-area-math)" : "var(--sat-area-reading)";
        return (
          <div key={m.key} className="rounded-lg border border-gray-200 border-t-[3px] px-3 py-2" style={{ borderTopColor: color }}>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color }}>{m.short}</p>
            <p className="text-xs text-gray-500">{m.questionCount} questions · {m.minutes} min · {m.tier}</p>
          </div>
        );
      })}
    </div>
  );
}
