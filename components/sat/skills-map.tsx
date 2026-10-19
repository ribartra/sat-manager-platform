import Link from "next/link";
import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Pct } from "@/components/sat/work-status";
import { Badge } from "@/components/ui/badge";
import { difficultyBadgeVariant, difficultyLabel } from "@/lib/domain-meta";
import { cn } from "@/lib/utils";

/**
 * Skills map (mockup content-map.html): one card per domain, one row per skill, an Easy / Medium /
 * Hard chip per level. A chip is a link with a status dot, or a dashed "locked" chip when the level
 * has nothing yet. Also the skill × difficulty matrix of results (history / teacher student page).
 */

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
/** Student status of the level's sets; "available" = sets exist (teacher catalogue, no student status). */
export type ChipState = "todo" | "progress" | "done" | "overdue" | "available";

const STATE_DOT: Record<ChipState, string> = {
  todo: "bg-blue-500",
  progress: "bg-amber-500",
  done: "bg-green-500",
  overdue: "bg-red-500",
  available: "bg-gray-400",
};

export interface SkillsMapChip {
  difficulty: string;
  /** null = nothing at this level (locked chip). */
  state: ChipState | null;
  href?: string;
  title?: string;
  /** Extra text after the level, e.g. "×2" or "· 80%". */
  extra?: React.ReactNode;
}

export interface SkillsMapSkill {
  id: string;
  name: string;
  sub: React.ReactNode;
  chips: SkillsMapChip[];
  action?: React.ReactNode;
}

export function SkillsMap({ domains }: { domains: { id: string; name: string; skills: SkillsMapSkill[] }[] }) {
  if (domains.length === 0) return <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">No skills in this area yet.</p>;
  return (
    <div className="space-y-4">
      {domains.map((d) => (
        <Card key={d.id} padding="md">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{d.name}</h3>
            <span className="text-xs text-gray-400">{d.skills.length} skill{d.skills.length === 1 ? "" : "s"}</span>
          </div>
          <div className="divide-y divide-gray-100">
            {d.skills.map((skill) => (
              <div key={skill.id} className="grid items-center gap-2 py-2 sm:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{skill.name}</p>
                  <p className="text-xs text-gray-500">{skill.sub}</p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {skill.chips.map((chip) => <SkillChip key={chip.difficulty} chip={chip} />)}
                  {skill.action}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/** Mockup `.chip`: 5px 10px, radius 8, 12px/600, slate border. */
const CHIP = "inline-flex items-center gap-1.5 rounded-lg border border-[var(--sat-border)] px-2.5 py-[5px] text-xs font-semibold";

function SkillChip({ chip }: { chip: SkillsMapChip }) {
  if (chip.state === null) {
    const locked = (
      <>
        <Lock size={11} aria-hidden /> {difficultyLabel(chip.difficulty)}
        {chip.extra}
      </>
    );
    return chip.href ? (
      <Link href={chip.href} title={chip.title} className={cn(CHIP, "border-dashed text-[var(--sat-muted)] hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)]")}>
        {locked}
      </Link>
    ) : (
      <span title={chip.title} className={cn(CHIP, "cursor-help bg-[var(--sat-surface-2)] text-[var(--sat-blank)]")}>
        {locked}
      </span>
    );
  }
  // Teacher catalogue (mockup teacher/content.html): the difficulty badge in its colour; student map:
  // status dot + level (mockup content-map.html).
  const body =
    chip.state === "available" ? (
      <>
        <Badge variant={difficultyBadgeVariant(chip.difficulty)}>{difficultyLabel(chip.difficulty)}</Badge>
        {chip.extra}
      </>
    ) : (
      <>
        <span className={cn("inline-block h-2 w-2 rounded-full", STATE_DOT[chip.state])} aria-hidden />
        {difficultyLabel(chip.difficulty)}
        {chip.extra}
      </>
    );
  const cls = cn(CHIP, "bg-white text-[var(--sat-text)]");
  return chip.href ? (
    <Link href={chip.href} title={chip.title} className={cn(cls, "hover:border-[var(--sat-primary)] hover:bg-[var(--sat-primary-soft)]")}>{body}</Link>
  ) : (
    <span title={chip.title} className={cls}>{body}</span>
  );
}

export function SkillsMapLegend({ lockedLabel = "Not assigned yet" }: { lockedLabel?: string }) {
  return (
    <p className="mb-3 mt-1 flex flex-wrap gap-3 text-xs text-gray-500">
      <LegendDot className={STATE_DOT.todo} label="Not started" />
      <LegendDot className={STATE_DOT.progress} label="In progress" />
      <LegendDot className={STATE_DOT.done} label="Completed" />
      <LegendDot className={STATE_DOT.overdue} label="Overdue" />
      <span className="flex items-center gap-1"><Lock size={11} aria-hidden /> {lockedLabel}</span>
    </p>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn("inline-block h-2 w-2 rounded-full", className)} aria-hidden /> {label}
    </span>
  );
}

export interface MatrixCell {
  pct: number | null;
  right: number;
  total: number;
  tries: number;
  href?: string;
}

/**
 * Skill × difficulty results (practice only): each cell is % correct, "r of n · k tries" and, with
 * `href`, a link that filters the history below to that skill and level.
 */
export function SkillDifficultyMatrix({
  rows,
  selected,
  actionHeader,
  emptyText = "No results yet.",
}: {
  rows: { id: string; label: string; cells: Partial<Record<string, MatrixCell | null>>; action?: React.ReactNode }[];
  selected?: { skill?: string; difficulty?: string };
  actionHeader?: string;
  emptyText?: string;
}) {
  if (rows.length === 0) return <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">{emptyText}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full min-w-[32rem] text-sm">
        <thead className="bg-gray-50 text-left text-xs text-gray-500">
          <tr>
            <th className="px-3 py-2 font-medium">Skill</th>
            {DIFFICULTIES.map((d) => <th key={d} className="px-3 py-2 text-center font-medium">{difficultyLabel(d)}</th>)}
            {actionHeader !== undefined ? <th className="px-3 py-2 font-medium">{actionHeader}</th> : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="px-3 py-2 font-medium text-gray-800">{row.label}</td>
              {DIFFICULTIES.map((d) => {
                const cell = row.cells[d];
                const on = selected?.skill === row.id && selected?.difficulty === d;
                if (!cell || cell.total === 0) return <td key={d} className="px-3 py-2 text-center text-xs text-gray-300">—</td>;
                const body = (
                  <>
                    <Pct value={cell.pct} className="block text-sm font-semibold" />
                    <span className="block text-[11px] text-gray-500">{cell.right} of {cell.total} · {cell.tries} {cell.tries === 1 ? "try" : "tries"}</span>
                  </>
                );
                return (
                  <td key={d} className="px-1 py-1 text-center">
                    {cell.href ? (
                      <Link href={cell.href} aria-current={on ? "true" : undefined} className={cn("block rounded-md px-2 py-1 hover:bg-gray-50", on && "bg-blue-50 ring-1 ring-blue-300")}>
                        {body}
                      </Link>
                    ) : (
                      <span className="block px-2 py-1">{body}</span>
                    )}
                  </td>
                );
              })}
              {actionHeader !== undefined ? <td className="px-3 py-2 text-xs">{row.action}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
