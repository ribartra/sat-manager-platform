import Link from "next/link";
import { SectionHeader } from "@/components/sat/section-header";
import { SkillsSourceMap, DIFFICULTIES, type SkillsMapChip } from "@/components/sat/skills-map";
import { Pct } from "@/components/sat/work-status";
import { difficultyLabel } from "@/lib/domain-meta";
import { formatDate } from "@/lib/utils";
import type { LevelResult, PracticeReport, SkillResultRow } from "@/lib/student-report";

/**
 * Practice results by skill (teacher, student and parent views): the By-skill cards (domains in
 * official order, skills A–Z). Each chip is the skill × level result — the last attempt of each set,
 * weighted by questions; opening a skill shows the same per source with date and tries. The weakest
 * skill sits on one line right under the title. No assign actions here (results only).
 */
export function SkillResults({
  report,
  attemptHref,
  title,
  description = "Each level adds up the last attempt of every set (by questions) · open a skill to see each source",
  id = "skills-results",
}: {
  report: Pick<PracticeReport, "skillResults" | "weakestSkill" | "areaLabel">;
  /** Opens an attempt; omitted where the viewer can't open attempts (parent). */
  attemptHref?: (attemptId: string) => string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  id?: string;
}) {
  const weakest = report.weakestSkill;
  return (
    <section id={id} className="min-w-0">
      <SectionHeader title={title ?? `${report.areaLabel} skills by difficulty`} description={description} />
      {weakest ? (
        <p className="-mt-1 mb-3 text-sm text-gray-700">
          Weakest skill: <b>{weakest.label}</b> · {difficultyLabel(weakest.difficulty)} ·{" "}
          {attemptHref ? (
            <Link href={attemptHref(weakest.attemptId)} className="hover:underline">
              <Pct value={weakest.percent} className="font-semibold" />
            </Link>
          ) : (
            <Pct value={weakest.percent} className="font-semibold" />
          )}{" "}
          <span className="text-xs text-gray-500">({weakest.correct} of {weakest.total})</span>
        </p>
      ) : null}
      <SkillsSourceMap
        emptyText={`No ${report.areaLabel} practice results yet.`}
        emptySourcesText="No results yet."
        domains={groupByDomain(report.skillResults).map((domain) => ({
          ...domain,
          skills: domain.rows.map((row) => {
            const tries = Object.values(row.levels).reduce((sum, level) => sum + (level?.tries ?? 0), 0);
            return {
              id: row.topicId,
              name: row.label,
              sub: `${tries} ${tries === 1 ? "try" : "tries"}`,
              chips: DIFFICULTIES.map((level) => resultChip(level, row.levels[level], attemptHref)),
              rows: row.bySource.map((source) => ({
                id: source.sourceId,
                name: source.sourceName,
                chips: DIFFICULTIES.map((level) => resultChip(level, source.levels[level], attemptHref, true)),
              })),
            };
          }),
        }))}
      />
    </section>
  );
}

function resultChip(level: string, result: LevelResult | undefined, attemptHref: ((id: string) => string) | undefined, detail = false): SkillsMapChip {
  if (!result) return { difficulty: level, state: "none", title: `${difficultyLabel(level)}: no attempt yet` };
  const date = result.lastAt ? formatDate(result.lastAt) : "";
  return {
    difficulty: level,
    state: "available",
    href: attemptHref?.(result.latestAttemptId),
    title: `${difficultyLabel(level)}: ${result.correct} of ${result.total} (${result.sets} set${result.sets === 1 ? "" : "s"}, last attempt of each) · ${result.tries} ${result.tries === 1 ? "try" : "tries"}${date ? ` · last ${date}` : ""}`,
    extra: (
      <span className="text-[var(--sat-muted)]">
        <Pct value={result.percent} className="font-semibold" /> · {result.correct}/{result.total}
        {detail ? ` · ${date ? `${date} · ` : ""}${result.tries} ${result.tries === 1 ? "try" : "tries"}` : ""}
      </span>
    ),
  };
}

function groupByDomain(rows: SkillResultRow[]) {
  const domains = new Map<string, { id: string; name: string; rows: SkillResultRow[] }>();
  for (const row of rows) {
    const key = row.domainId || "other";
    const entry = domains.get(key) ?? { id: key, name: row.domainName || "Other", rows: [] };
    entry.rows.push(row);
    domains.set(key, entry);
  }
  return [...domains.values()];
}
