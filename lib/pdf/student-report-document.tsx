// Server-side PDF for the student progress report (no browser involved): @react-pdf/renderer
// lays out the same blocks the teacher's student page shows for each section — Practice (Math /
// Reading / Writing) and Tests — with the same data (lib/student-report.ts, lib/attempt-groups.ts,
// lib/test-assignments.ts) and renders it to a PDF buffer. Every block takes the full page width,
// stacked one under the other (never side by side). One section per selected area, each starting on
// a new page, so several areas come out as a single file.
// Only WinAnsi characters are used (built-in Helvetica): no arrows or ≤/≥ symbols.
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { MockReport, PracticeReport } from "@/lib/student-report";
import { moduleTableOf, shortSetName } from "@/lib/student-report";
import type { ModuleView } from "@/lib/test-view";
import type { StudentTestItem, TestAttemptRow } from "@/lib/test-assignments";
import { assignmentStatusLabel, difficultyLabel } from "@/lib/domain-meta";
import { formatDate, formatDuration } from "@/lib/utils";

export type ReportAreaKey = "math" | "reading" | "writing" | "mocks";

/** One try of a practice set (as in the practice-attempts accordion). */
export interface PdfPracticeTry {
  id: string;
  tryNumber: number;
  submittedAt: Date | null;
  correct: number;
  total: number;
  pct: number | null;
  time: number | null;
  status?: string;
  /** % points vs. the previous counted try of the same set. */
  change?: number | null;
}

/** One practice set row: its last counted try and its last 3 tries (lib/attempt-groups.ts). */
export interface PdfPracticeSet {
  key: string;
  title: string;
  skillName: string | null;
  sourceName: string | null;
  sourceOrder: number | null;
  tryCount: number;
  last: PdfPracticeTry;
  recent: PdfPracticeTry[];
}

/** One try of a Test (the fields the Test attempts accordion shows). */
export type PdfTestTry = Pick<TestAttemptRow, "id" | "status" | "startedAt" | "submittedAt" | "rwScore" | "mathScore" | "totalScore" | "view" | "tryNumber">;

/** One Test row: its last counted try and every try (lib/attempt-groups.ts testGroups). */
export interface PdfTestGroup {
  key: string;
  title: string;
  number: number | null;
  sourceName: string;
  sourceOrder: number;
  /** Every try of the Test (the list can be narrowed to one, e.g. the single-Test report). */
  tryCount: number;
  last: PdfTestTry;
  tries: PdfTestTry[];
}

export type StudentReportData = {
  student: { name: string; email: string; programs: string[]; startDate: Date | null };
  generatedAt: Date;
  filterSummary: string;
  sections: Array<
    | { area: "math" | "reading" | "writing"; practice: PracticeReport; groups: PdfPracticeSet[] }
    | { area: "mocks"; mock: MockReport; tests: StudentTestItem[]; groups: PdfTestGroup[] }
  >;
};

// Wrap whole words only: no "COM-PLETED" style hyphen breaks in labels and sentences.
Font.registerHyphenationCallback((word) => [word]);

const AREA = {
  math: { label: "Math", color: "#305bab", tint: "#eaf0fa" },
  reading: { label: "Reading", color: "#e89600", tint: "#fdf4e3" },
  writing: { label: "Writing", color: "#09a63b", tint: "#e6f6ec" },
  mocks: { label: "Tests", color: "#6b7280", tint: "#f2f2f2" },
} as const;

const GRAY = { 900: "#111827", 700: "#374151", 600: "#4b5563", 500: "#6b7280", 400: "#9ca3af", 200: "#e5e7eb", 100: "#f3f4f6", 50: "#f9fafb" };
const TESTS_BAR = "#cbd5e1";

/** Same traffic light as lib/score-band.ts: <60 red, 60–79 yellow, 80+ green. */
function band(pct: number | null) {
  if (pct === null || Number.isNaN(pct)) return { text: GRAY[500], bar: GRAY[200] };
  if (pct >= 80) return { text: "#16a34a", bar: "#4ade80" };
  if (pct >= 60) return { text: "#ca8a04", bar: "#facc15" };
  return { text: "#ef4444", bar: "#f87171" };
}

const date = (d: Date | string | null | undefined) => (d ? formatDate(d) : "-");
const time = (seconds: number | null | undefined) => (seconds ? formatDuration(seconds) : "-");
/** "+5%" / "-5%" (the web uses arrows; Helvetica here has none). */
const change = (value: number | null | undefined) => (value === null || value === undefined ? "" : `${value >= 0 ? "+" : "-"}${Math.abs(value)}%`);
const byName = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: GRAY[900] },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: GRAY[400] },
  band: { borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 3 },
  meta: { fontSize: 8, color: GRAY[700], marginTop: 3 },
  areaPill: { alignSelf: "flex-start", marginTop: 7, fontSize: 9, fontFamily: "Helvetica-Bold", color: "#ffffff", paddingVertical: 3, paddingHorizontal: 9, borderRadius: 10 },
  kpis: { flexDirection: "row", borderWidth: 1, borderColor: GRAY[200], borderRadius: 6, marginBottom: 14 },
  kpi: { flex: 1, paddingVertical: 8, paddingHorizontal: 9 },
  kpiLabel: { fontSize: 6.8, color: GRAY[500], fontFamily: "Helvetica-Bold", letterSpacing: 0.2 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  h2: { fontSize: 11.5, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  hint: { fontSize: 7.5, color: GRAY[500], marginBottom: 6 },
  section: { marginBottom: 16 },
  note: { fontSize: 8, color: GRAY[600], backgroundColor: GRAY[50], borderWidth: 1, borderColor: GRAY[200], borderRadius: 5, paddingVertical: 6, paddingHorizontal: 8, marginBottom: 12 },
  table: { borderWidth: 1, borderColor: GRAY[200], borderRadius: 5 },
  /** Long lists: no outer box (it breaks page flow); each unbreakable block draws its own sides. */
  openHead: { borderWidth: 1, borderColor: GRAY[200], borderTopLeftRadius: 5, borderTopRightRadius: 5 },
  block: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderColor: GRAY[200] },
  th: { flexDirection: "row", backgroundColor: GRAY[50], borderBottomWidth: 1, borderBottomColor: GRAY[200] },
  thCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY[500], paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GRAY[100], alignItems: "center" },
  td: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.5 },
  groupRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: GRAY[100], paddingVertical: 5, paddingHorizontal: 6, borderBottomWidth: 1, borderBottomColor: GRAY[200] },
  groupTitle: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  sourceRow: { paddingVertical: 4, paddingHorizontal: 6, fontSize: 8, fontFamily: "Helvetica-Bold", color: GRAY[600], borderBottomWidth: 1, borderBottomColor: GRAY[100] },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: GRAY[500] },
  tiny: { fontSize: 7, color: GRAY[500] },
  empty: { fontSize: 8.5, color: GRAY[400], paddingVertical: 10, paddingHorizontal: 8 },
  card: { borderWidth: 1, borderColor: GRAY[200], borderRadius: 6, marginBottom: 8 },
  cardBar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", backgroundColor: TESTS_BAR, paddingVertical: 6, paddingHorizontal: 9, borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  tiles: { flexDirection: "row", gap: 6, paddingHorizontal: 9, paddingTop: 7 },
  tile: { flex: 1, borderWidth: 1, borderColor: GRAY[200], borderTopWidth: 3, borderRadius: 4, paddingVertical: 5, paddingHorizontal: 6 },
  scores: { flexDirection: "row", gap: 14, paddingHorizontal: 9, paddingVertical: 7, fontSize: 8.5, color: GRAY[600] },
});

function Bar({ value, width = 60 }: { value: number | null; width?: number }) {
  const colors = band(value);
  const fill = value !== null && value > 0 ? Math.max(3, (width * value) / 100) : 0;
  return (
    <View style={{ width, height: 4, borderRadius: 2, backgroundColor: GRAY[100], marginTop: 2 }}>
      {fill > 0 ? <View style={{ width: fill, height: 4, borderRadius: 2, backgroundColor: colors.bar }} /> : null}
    </View>
  );
}

/** Header band: the student, then the report line, then the section (stacked, full width). */
function SectionHeader({ area, data }: { area: ReportAreaKey; data: StudentReportData }) {
  const cfg = AREA[area];
  return (
    <View style={[s.band, { backgroundColor: cfg.tint }]}>
      <Text style={[s.eyebrow, { color: cfg.color }]}>SAT Practice Report</Text>
      <Text style={s.name}>{data.student.name}</Text>
      <Text style={s.meta}>
        {[
          data.student.email,
          data.student.programs.length ? `Program: ${data.student.programs.join(", ")}` : null,
          data.student.startDate ? `Started ${date(data.student.startDate)}` : null,
        ].filter(Boolean).join(" · ")}
      </Text>
      <Text style={s.meta}>Showing: {data.filterSummary || "All results"} · Created {date(data.generatedAt)}</Text>
      <Text style={[s.areaPill, { backgroundColor: cfg.color }]}>{area === "mocks" ? "Tests" : `${cfg.label} practice`}</Text>
    </View>
  );
}

function Kpis({ items }: { items: Array<{ label: string; value: string; color?: string }> }) {
  return (
    <View style={s.kpis} wrap={false}>
      {items.map((item, index) => (
        <View key={item.label} style={[s.kpi, index > 0 ? { borderLeftWidth: 1, borderLeftColor: GRAY[100] } : {}]}>
          <Text style={s.kpiLabel}>{item.label}</Text>
          <Text style={[s.kpiValue, item.color ? { color: item.color } : {}]}>{item.value}</Text>
        </View>
      ))}
    </View>
  );
}

function Heading({ title, hint }: { title: string; hint?: string }) {
  return (
    <View minPresenceAhead={70}>
      <Text style={s.h2}>{title}</Text>
      {hint ? <Text style={s.hint}>{hint}</Text> : null}
    </View>
  );
}

function Head({ cols, open = false }: { cols: Array<{ label: string; flex: number; right?: boolean }>; open?: boolean }) {
  return (
    <View style={open ? [s.th, s.openHead] : s.th}>
      {cols.map((c) => <Text key={c.label} style={[s.thCell, { flex: c.flex }, c.right ? { textAlign: "right" } : {}]}>{c.label}</Text>)}
    </View>
  );
}

/** "Pending" / "In progress" / "Overdue" in its colour. */
function StatusText({ status }: { status: string }) {
  const color = status === "OVERDUE" ? "#dc2626" : status === "IN_PROGRESS" ? "#ca8a04" : status === "COMPLETED" || status === "SUBMITTED" ? "#16a34a" : "#2563eb";
  return <Text style={[s.bold, { color, fontSize: 7.5 }]}>{assignmentStatusLabel(status)}</Text>;
}

// ------------------------------------------------------------------ Practice (one area)

const LEVELS = ["EASY", "MEDIUM", "HARD"] as const;
const SKILL_COLS = [
  { label: "Skill", flex: 2.4 },
  { label: "Easy", flex: 1 },
  { label: "Medium", flex: 1 },
  { label: "Hard", flex: 1 },
];
const SET_COLS = [
  { label: "Practice set", flex: 2.6 },
  { label: "Last attempt", flex: 1.1 },
  { label: "Correct", flex: 0.9 },
  { label: "Time", flex: 0.8 },
  { label: "Completed", flex: 1.1 },
];

/**
 * A long list as a flat run of unbreakable blocks (react-pdf moves a whole block to the next page;
 * nested wrappers or an outer box break that). The section heading and the column header travel with
 * the first block, so they are never left alone at the bottom of a page.
 */
function BlockList({ title, hint, intro, cols, blocks, empty }: { title: string; hint?: string; intro?: React.ReactNode; cols: Array<{ label: string; flex: number; right?: boolean }>; blocks: React.ReactNode[]; empty: string }) {
  if (blocks.length === 0) {
    return (
      <View style={s.section} wrap={false}>
        <Heading title={title} hint={hint} />
        {intro}
        <View style={s.table}><Text style={s.empty}>{empty}</Text></View>
      </View>
    );
  }
  return (
    <View style={s.section}>
      {blocks.map((block, index) => (
        <View key={index} wrap={false}>
          {index === 0 ? (
            <>
              <Heading title={title} hint={hint} />
              {intro}
              <Head cols={cols} open />
            </>
          ) : null}
          <View style={s.block}>{block}</View>
        </View>
      ))}
    </View>
  );
}

/** Skills by difficulty (teacher page SkillResults): domains in official order, one row per skill. */
function SkillsByDifficulty({ report }: { report: PracticeReport }) {
  const weakest = report.weakestSkill;
  const domains = new Map<string, { name: string; rows: PracticeReport["skillResults"] }>();
  for (const row of report.skillResults) {
    const key = row.domainId || "other";
    const entry = domains.get(key) ?? domains.set(key, { name: row.domainName || "Other", rows: [] }).get(key)!;
    entry.rows.push(row);
  }
  // One block per skill; the domain heading travels with its first skill.
  const blocks = [...domains.values()].flatMap((domain) =>
    domain.rows.map((row, index) => {
      const tries = Object.values(row.levels).reduce((sum, level) => sum + (level?.tries ?? 0), 0);
      return (
        <>
          {index === 0 ? (
            <View style={s.groupRow}>
              <Text style={s.groupTitle}>{domain.name}</Text>
              <Text style={s.tiny}>{domain.rows.length} skill{domain.rows.length === 1 ? "" : "s"}</Text>
            </View>
          ) : null}
          <View style={s.tr}>
            <View style={[s.td, { flex: SKILL_COLS[0].flex }]}>
              <Text style={s.bold}>{row.label}</Text>
              <Text style={s.tiny}>{tries} {tries === 1 ? "try" : "tries"}</Text>
            </View>
            {LEVELS.map((level) => {
              const cell = row.levels[level];
              return (
                <View key={level} style={[s.td, { flex: 1 }]}>
                  {cell ? (
                    <>
                      <Text>
                        <Text style={[s.bold, { color: band(cell.percent).text }]}>{cell.percent}%</Text>
                        <Text style={s.muted}> · {cell.correct}/{cell.total}</Text>
                      </Text>
                      <Bar value={cell.percent} />
                    </>
                  ) : (
                    <Text style={s.muted}>-</Text>
                  )}
                </View>
              );
            })}
          </View>
        </>
      );
    }),
  );
  return (
    <BlockList
      title={`${report.areaLabel} skills by difficulty`}
      hint="Each level adds up the last attempt of every set, across all sources (by questions). Skipped questions count as wrong."
      intro={
        weakest ? (
          <Text style={{ fontSize: 8.5, marginBottom: 6 }}>
            Weakest skill: <Text style={s.bold}>{weakest.label}</Text> · {difficultyLabel(weakest.difficulty)} ·{" "}
            <Text style={[s.bold, { color: band(weakest.percent).text }]}>{weakest.percent}%</Text> <Text style={s.tiny}>({weakest.correct} of {weakest.total})</Text>
          </Text>
        ) : null
      }
      cols={SKILL_COLS}
      blocks={blocks}
      empty={`No ${report.areaLabel} practice results yet.`}
    />
  );
}

/** One practice try as a table row under its set (indented). */
function TryRow({ t, tryCount }: { t: PdfPracticeTry; tryCount: number }) {
  return (
    <View style={[s.tr, { backgroundColor: GRAY[50] }]}>
      <Text style={[s.td, s.muted, { flex: SET_COLS[0].flex, paddingLeft: 18, fontSize: 8 }]}>
        Try {t.tryNumber} of {tryCount}
        {t.status === "INVALIDATED" ? " · not counted" : ""}
      </Text>
      <Text style={[s.td, { flex: SET_COLS[1].flex, fontSize: 8 }]}>
        <Text style={{ color: band(t.pct).text }}>{t.pct !== null ? `${t.pct}%` : "-"}</Text>
        {t.change !== null && t.change !== undefined ? <Text style={[s.tiny, { color: t.change >= 0 ? "#16a34a" : "#dc2626" }]}> {change(t.change)}</Text> : null}
      </Text>
      <Text style={[s.td, { flex: SET_COLS[2].flex, fontSize: 8 }]}>{t.correct} of {t.total}</Text>
      <Text style={[s.td, s.muted, { flex: SET_COLS[3].flex, fontSize: 8 }]}>{time(t.time)}</Text>
      <Text style={[s.td, s.muted, { flex: SET_COLS[4].flex, fontSize: 8 }]}>{date(t.submittedAt)}</Text>
    </View>
  );
}

/** Practice attempts (teacher page accordion, every level open): skill → source → set → last 3 tries. */
function PracticeAttempts({ report, groups }: { report: PracticeReport; groups: PdfPracticeSet[] }) {
  const skills = new Map<string, PdfPracticeSet[]>();
  for (const set of groups) {
    const key = set.skillName ?? "Other";
    skills.set(key, [...(skills.get(key) ?? []), set]);
  }
  const ordered = [...skills.entries()].sort(([a], [b]) => (a === "Other" ? 1 : b === "Other" ? -1 : byName(a, b)));
  // One block per set; the skill and source headings travel with their first set.
  const blocks = ordered.flatMap(([skill, sets]) => {
    const sources = new Map<string, { order: number; sets: PdfPracticeSet[] }>();
    for (const set of sets) {
      const name = set.sourceName ?? "College Board";
      const entry = sources.get(name) ?? sources.set(name, { order: set.sourceOrder ?? 0, sets: [] }).get(name)!;
      entry.sets.push(set);
    }
    const lastAt = sets.map((set) => set.last.submittedAt).filter((d): d is Date => Boolean(d)).sort((a, b) => b.getTime() - a.getTime())[0];
    return [...sources.entries()]
      .sort(([a, x], [b, y]) => x.order - y.order || byName(a, b))
      .flatMap(([source, entry], sourceIndex) =>
        entry.sets.map((set, setIndex) => (
          <>
            {sourceIndex === 0 && setIndex === 0 ? (
              <View style={s.groupRow}>
                <Text style={s.groupTitle}>{skill}</Text>
                <Text style={s.tiny}>
                  {sets.length} set{sets.length === 1 ? "" : "s"} · {[...sources.keys()].join(" · ")}
                  {lastAt ? ` · last ${date(lastAt)}` : ""}
                </Text>
              </View>
            ) : null}
            {setIndex === 0 ? <Text style={s.sourceRow}>{source}</Text> : null}
            <View style={s.tr}>
              <View style={[s.td, { flex: SET_COLS[0].flex }]}>
                <Text style={s.bold}>{set.title}</Text>
                <Text style={s.tiny}>{set.tryCount} {set.tryCount === 1 ? "try" : "tries"}</Text>
              </View>
              <Text style={[s.td, { flex: SET_COLS[1].flex }]}>
                <Text style={[s.bold, { color: band(set.last.pct).text }]}>{set.last.pct !== null ? `${set.last.pct}%` : "-"}</Text>
                {set.last.change !== null && set.last.change !== undefined ? (
                  <Text style={[s.tiny, { color: set.last.change >= 0 ? "#16a34a" : "#dc2626" }]}> {change(set.last.change)}</Text>
                ) : null}
              </Text>
              <Text style={[s.td, { flex: SET_COLS[2].flex }]}>{set.last.correct} of {set.last.total}</Text>
              <Text style={[s.td, s.muted, { flex: SET_COLS[3].flex }]}>{time(set.last.time)}</Text>
              <Text style={[s.td, s.muted, { flex: SET_COLS[4].flex }]}>{date(set.last.submittedAt)}</Text>
            </View>
            {set.recent.map((t) => <TryRow key={t.id} t={t} tryCount={set.tryCount} />)}
          </>
        )),
      );
  });
  return (
    <BlockList
      title={`${report.areaLabel} practice attempts`}
      hint={`${groups.length} practice set${groups.length === 1 ? "" : "s"} · Last attempt is the most recent try; under each set, its last 3 tries (newest first).`}
      cols={SET_COLS}
      blocks={blocks}
      empty={`No ${report.areaLabel} practice finished yet.`}
    />
  );
}

function PracticeSection({ report, groups }: { report: PracticeReport; groups: PdfPracticeSet[] }) {
  return (
    <>
      {report.completedExamCount > 0 || report.pendingExamCount > 0 ? (
        <Text style={s.note}>
          Test results are kept apart from practice ({report.completedExamCount} test{report.completedExamCount === 1 ? "" : "s"} finished · {report.pendingExamCount} assigned).
          See the Tests section.
        </Text>
      ) : null}
      <SkillsByDifficulty report={report} />

      <View style={s.section}>
        <Heading title={`Active practice sets (${report.assignments.length})`} />
        <View style={s.table}>
          {report.assignments.length === 0 ? (
            <Text style={s.empty}>No active {report.areaLabel} practice sets.</Text>
          ) : (
            <>
              <Head cols={[{ label: "Practice set", flex: 3 }, { label: "Status", flex: 1 }, { label: "Due date", flex: 1.2 }]} />
              {report.assignments.map((a) => (
                <View key={a.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.bold, { flex: 3 }]}>{shortSetName(a.name)}</Text>
                  <View style={[s.td, { flex: 1 }]}>
                    <StatusText status={a.status} />
                    {a.locked ? <Text style={[s.tiny, { color: "#dc2626" }]}>Locked</Text> : null}
                  </View>
                  <Text style={[s.td, s.muted, { flex: 1.2 }]}>{a.dueDate ? date(a.dueDate) : "No due date"}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>

      {report.comments.length > 0 ? (
        <View style={s.section}>
          <Heading title="Teacher comments" />
          <View style={s.table}>
            {report.comments.map((c) => (
              <View key={c.id} style={[s.tr, { flexDirection: "column", alignItems: "stretch" }]} wrap={false}>
                <Text style={[s.td, s.tiny, { paddingBottom: 0 }]}>{shortSetName(c.name)} · {date(c.submittedAt)}</Text>
                <Text style={[s.td, { paddingTop: 2 }]}>{c.teacherComment}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <PracticeAttempts report={report} groups={groups} />
    </>
  );
}

// ------------------------------------------------------------------ Tests

/** Tests by "TEST N" (other tests last), each version ordered by source. */
function byTestNumber<T extends { number: number | null; sourceOrder: number; sourceName: string }>(items: T[]) {
  const groups = new Map<string, { number: number | null; items: T[] }>();
  for (const item of items) {
    const key = item.number === null ? "other" : String(item.number);
    (groups.get(key) ?? groups.set(key, { number: item.number, items: [] }).get(key)!).items.push(item);
  }
  return [...groups.values()]
    .sort((a, b) => (a.number ?? Number.MAX_SAFE_INTEGER) - (b.number ?? Number.MAX_SAFE_INTEGER))
    .map((g) => ({
      ...g,
      label: g.number === null ? "Other tests" : `TEST ${g.number}`,
      items: g.items.sort((a, b) => a.sourceOrder - b.sourceOrder || byName(a.sourceName, b.sourceName)),
    }));
}

const workLabel = (item: StudentTestItem) => (item.overdue ? "Overdue" : item.state === "done" ? "Completed" : item.state === "progress" ? "In progress" : "Not started");
const workColor = (item: StudentTestItem) => (item.overdue ? "#dc2626" : item.state === "done" ? "#16a34a" : item.state === "progress" ? "#ca8a04" : "#2563eb");

/** Test card (teacher page TestCard): bar, the 4 module tiles in one row, scores. */
function TestCardPdf({ item }: { item: StudentTestItem }) {
  const open = item.openAttempt;
  const last = item.lastSubmitted;
  const done = item.state === "done" && !open && last;
  const view = open?.view ?? item.lastSubmittedView;
  const modules: ModuleView[] = view?.modules ?? item.modules;
  const counted = item.attempts.filter((a) => a.status === "SUBMITTED").length;
  const score = (code: "RW" | "MATH") => (done && last ? (code === "RW" ? last.rwScore : last.mathScore) : view?.sections[code].score ?? null);
  const dateText = done && last?.submittedAt ? `completed ${date(last.submittedAt)}` : item.dueDate ? `due ${date(item.dueDate)}` : "no due date";
  return (
    <View style={s.card} wrap={false}>
      <View style={s.cardBar}>
        <Text style={[s.bold, { fontSize: 9.5 }]}>{item.name}</Text>
        <Text style={{ fontSize: 8.5, color: GRAY[700] }}> · {dateText} · </Text>
        <Text style={[s.bold, { fontSize: 8, color: workColor(item) }]}>{workLabel(item)}</Text>
      </View>
      <View style={s.tiles}>
        {modules.map((m) => {
          const color = m.section === "RW" ? AREA.reading.color : AREA.math.color;
          return (
            <View key={m.key} style={[s.tile, { borderTopColor: color }]}>
              <Text style={[s.bold, { fontSize: 8, color }]}>
                {m.short} <Text style={[s.tiny, { fontFamily: "Helvetica" }]}>· {m.tier}</Text>
              </Text>
              <Text style={{ fontSize: 8.5, marginTop: 2 }}>{m.state === "done" ? `${m.right}/${m.questionCount} correct` : m.state === "progress" ? "In progress" : "Not taken"}</Text>
            </View>
          );
        })}
      </View>
      <View style={s.scores}>
        <Text>
          Total <Text style={[s.bold, { color: GRAY[900], fontSize: 10 }]}>{done && last?.totalScore != null ? last.totalScore : "-"}</Text> / 1600
        </Text>
        <Text>
          <Text style={{ color: AREA.reading.color }}>R&W</Text> <Text style={[s.bold, { color: GRAY[900] }]}>{score("RW") ?? "-"}</Text>
        </Text>
        <Text>
          <Text style={{ color: AREA.math.color }}>Math</Text> <Text style={[s.bold, { color: GRAY[900] }]}>{score("MATH") ?? "-"}</Text>
        </Text>
        {counted > 1 ? <Text style={s.tiny}>{counted} attempts</Text> : null}
      </View>
    </View>
  );
}

const TRY_COLS = [
  { label: "Test", flex: 2.4 },
  { label: "R&W", flex: 0.8, right: true },
  { label: "Math", flex: 0.8, right: true },
  { label: "Total", flex: 1, right: true },
  { label: "Date", flex: 1.3 },
];

/** Scores of one try; an open one shows how many modules are done. */
function tryScores(t: PdfTestTry) {
  if (t.status === "IN_PROGRESS") return { rw: "-", math: "-", total: `${t.view?.modulesDone ?? 0} of 4 modules` };
  return { rw: t.rwScore ?? "-", math: t.mathScore ?? "-", total: t.totalScore ?? "-" };
}

/** Test attempts (teacher page accordion, every level open): TEST N → source → Test → every try. */
function TestAttemptsPdf({ groups }: { groups: PdfTestGroup[] }) {
  const tries = groups.reduce((sum, g) => sum + g.tries.length, 0);
  // One block per Test; the TEST N heading travels with its first version.
  const blocks = byTestNumber(groups).flatMap((number) =>
    number.items.map((group, index) => {
      const last = tryScores(group.last);
      return (
        <>
          {index === 0 ? (
            <View style={s.groupRow}>
              <Text style={s.groupTitle}>{number.label}</Text>
              <Text style={s.tiny}>
                {number.items.length} version{number.items.length === 1 ? "" : "s"} · {number.items.map((g) => g.sourceName).join(" · ")}
              </Text>
            </View>
          ) : null}
          <Text style={s.sourceRow}>{group.sourceName}</Text>
          <View style={s.tr}>
            <View style={[s.td, { flex: TRY_COLS[0].flex }]}>
              <Text style={s.bold}>{group.title}</Text>
              <Text style={s.tiny}>
                {group.tries.length} {group.tries.length === 1 ? "try" : "tries"}
                {group.last.status !== "SUBMITTED" ? ` · ${assignmentStatusLabel(group.last.status)}` : ""}
              </Text>
            </View>
            <Text style={[s.td, s.bold, { flex: TRY_COLS[1].flex, textAlign: "right" }]}>{last.rw}</Text>
            <Text style={[s.td, s.bold, { flex: TRY_COLS[2].flex, textAlign: "right" }]}>{last.math}</Text>
            <Text style={[s.td, s.bold, { flex: TRY_COLS[3].flex, textAlign: "right" }]}>{last.total}</Text>
            <Text style={[s.td, s.muted, { flex: TRY_COLS[4].flex }]}>{date(group.last.submittedAt ?? group.last.startedAt)}</Text>
          </View>
          {group.tries.map((t) => {
            const sc = tryScores(t);
            return (
              <View key={t.id} style={[s.tr, { backgroundColor: GRAY[50] }]}>
                <Text style={[s.td, s.muted, { flex: TRY_COLS[0].flex, paddingLeft: 18, fontSize: 8 }]}>
                  Try {t.tryNumber} of {group.tryCount}
                  {t.status === "INVALIDATED" ? " · not counted" : t.status === "IN_PROGRESS" ? " · in progress" : ""}
                </Text>
                <Text style={[s.td, { flex: TRY_COLS[1].flex, textAlign: "right", fontSize: 8 }]}>{sc.rw}</Text>
                <Text style={[s.td, { flex: TRY_COLS[2].flex, textAlign: "right", fontSize: 8 }]}>{sc.math}</Text>
                <Text style={[s.td, { flex: TRY_COLS[3].flex, textAlign: "right", fontSize: 8 }]}>{sc.total}</Text>
                <Text style={[s.td, s.muted, { flex: TRY_COLS[4].flex, fontSize: 8 }]}>{t.submittedAt ? `Completed ${date(t.submittedAt)}` : `Started ${date(t.startedAt)}`}</Text>
              </View>
            );
          })}
        </>
      );
    }),
  );
  return (
    <BlockList
      title="Test attempts"
      hint={`${groups.length} test${groups.length === 1 ? "" : "s"} · ${tries} attempt${tries === 1 ? "" : "s"} · each Test shows its last try, then every try (newest first). Tries "not counted" don't count toward scores.`}
      cols={TRY_COLS}
      blocks={blocks}
      empty="No test attempts yet."
    />
  );
}

/** One Test attempt's section × module results (single-Test report). */
function ModuleTable({ report }: { report: MockReport }) {
  const table = moduleTableOf(report.sectionModuleMetrics);
  return (
    <View style={s.section} wrap={false}>
      <Heading title="Results by section and module" hint="Percent correct in each module of this Test. Skipped questions count as wrong." />
      <View style={s.table}>
        <Head cols={[{ label: "Section", flex: 1.6 }, ...table.columns.map((c) => ({ label: c, flex: 1 }))]} />
        {["Reading & Writing", "Math"].map((section) => (
          <View key={section} style={s.tr}>
            <Text style={[s.td, s.bold, { flex: 1.6 }]}>{section}</Text>
            {table.columns.map((column) => {
              const m = table.detail.find((d) => d.label === section && d.difficulty === column);
              const value = m && m.total > 0 ? Math.round((m.correct / m.total) * 100) : null;
              return (
                <View key={column} style={[s.td, { flex: 1 }]}>
                  {m ? (
                    <>
                      <Text>
                        <Text style={[s.bold, { color: band(value).text }]}>{value}%</Text>
                        <Text style={s.muted}> · {m.correct}/{m.total}</Text>
                      </Text>
                      <Bar value={value} />
                    </>
                  ) : (
                    <Text style={s.muted}>-</Text>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function TestsSection({ report, tests, groups }: { report: MockReport; tests: StudentTestItem[]; groups: PdfTestGroup[] }) {
  const k = report.kpis;
  return (
    <>
      <Kpis
        items={[
          { label: "Tests completed", value: String(k.exams) },
          { label: "Latest total score", value: k.latestTotal !== null ? String(k.latestTotal) : "-" },
          { label: "Latest Reading & Writing", value: k.latestRw !== null ? String(k.latestRw) : "-", color: AREA.reading.color },
          { label: "Latest Math", value: k.latestMath !== null ? String(k.latestMath) : "-", color: AREA.math.color },
          { label: "Tests to do", value: String(k.pending) },
        ]}
      />
      {/* Modules of ONE Test attempt only (single-test report); across Tests it would be a pooled average. */}
      {report.exams.length === 1 && tests.length === 1 ? <ModuleTable report={report} /> : null}

      <View style={s.section}>
        <Heading title="Tests" hint="One card per Test, grouped by TEST N (one version per source): pending first, then completed." />
        {tests.length === 0 ? (
          <View style={s.table}><Text style={s.empty}>No tests assigned yet.</Text></View>
        ) : (
          byTestNumber(tests).map((number) => (
            <View key={number.label}>
              <Text style={[s.bold, { fontSize: 9.5, marginBottom: 4, marginTop: 2 }]} minPresenceAhead={60}>
                {number.label} <Text style={s.tiny}>· {number.items.map((t) => t.sourceName).join(" · ")}</Text>
              </Text>
              {number.items.map((item) => <TestCardPdf key={item.assignmentId} item={item} />)}
            </View>
          ))
        )}
      </View>

      <TestAttemptsPdf groups={groups} />

      <View style={s.section}>
        <Heading title={`Active tests (${report.activeExams.length})`} />
        <View style={s.table}>
          {report.activeExams.length === 0 ? (
            <Text style={s.empty}>No active tests.</Text>
          ) : (
            <>
              <Head cols={[{ label: "Test", flex: 3 }, { label: "Status", flex: 1 }, { label: "Due date", flex: 1.1 }, { label: "Started", flex: 1.1 }]} />
              {report.activeExams.map((a) => (
                <View key={a.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.bold, { flex: 3 }]}>{a.name}</Text>
                  <View style={[s.td, { flex: 1 }]}><StatusText status={a.status} /></View>
                  <Text style={[s.td, s.muted, { flex: 1.1 }]}>{a.dueDate ? date(a.dueDate) : "No due date"}</Text>
                  <Text style={[s.td, s.muted, { flex: 1.1 }]}>{a.openAttemptStartedAt ? date(a.openAttemptStartedAt) : "-"}</Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </>
  );
}

function StudentReportDocument({ data }: { data: StudentReportData }) {
  return (
    <Document title={`SAT Practice Report - ${data.student.name}`} author="SAT Platform" subject="Student progress report">
      {data.sections.map((section) => (
        <Page key={section.area} size="LETTER" style={s.page}>
          <SectionHeader area={section.area} data={data} />
          {section.area === "mocks" ? (
            <TestsSection report={section.mock} tests={section.tests} groups={section.groups} />
          ) : (
            <PracticeSection report={section.practice} groups={section.groups} />
          )}
          <View style={s.footer} fixed>
            <Text>SAT Practice Report · {data.student.name} · {AREA[section.area].label}</Text>
            <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}

export async function renderStudentReportPdf(data: StudentReportData): Promise<Buffer> {
  return renderToBuffer(<StudentReportDocument data={data} />);
}
