// Server-side PDF for the student progress report (no browser involved): @react-pdf/renderer
// lays out the same data the teacher student page shows (lib/student-report.ts) and renders
// it to a PDF buffer. One section per selected area, each starting on a new page, so several
// areas come out as a single concatenated file.
// Only WinAnsi characters are used (built-in Helvetica): no arrows or ≤/≥ symbols.
import { Document, Font, G, Page, Rect, StyleSheet, Svg, Text, View, Line, renderToBuffer } from "@react-pdf/renderer";
import type { MockReport, PracticeReport } from "@/lib/student-report";
import { moduleTableOf, shortSetName } from "@/lib/student-report";
import type { ProgressMetric } from "@/lib/progress-analytics";
import { assignmentStatusLabel, difficultyLabel } from "@/lib/domain-meta";
import { formatDate, formatDuration } from "@/lib/utils";

export type ReportAreaKey = "math" | "reading" | "writing" | "mocks";

export type StudentReportData = {
  student: { name: string; email: string; programs: string[]; startDate: Date | null };
  generatedAt: Date;
  filterSummary: string;
  sections: Array<
    | { area: "math" | "reading" | "writing"; practice: PracticeReport }
    | { area: "mocks"; mock: MockReport }
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

const GRAY = { 900: "#111827", 700: "#374151", 500: "#6b7280", 400: "#9ca3af", 200: "#e5e7eb", 100: "#f3f4f6", 50: "#f9fafb" };

/** Same traffic light as lib/score-band.ts: <60 red, 60–79 yellow, 80+ green. */
function band(pct: number | null) {
  if (pct === null || Number.isNaN(pct)) return { text: GRAY[500], bar: GRAY[200] };
  if (pct >= 80) return { text: "#16a34a", bar: "#4ade80" };
  if (pct >= 60) return { text: "#ca8a04", bar: "#facc15" };
  return { text: "#ef4444", bar: "#f87171" };
}

const pct = (m: Pick<ProgressMetric, "correct" | "total"> | undefined) => (m && m.total > 0 ? Math.round((m.correct / m.total) * 100) : null);
const time = (seconds: number) => formatDuration(seconds);
const date = (d: Date | string | null | undefined) => (d ? formatDate(d) : "-");

const s = StyleSheet.create({
  page: { paddingTop: 34, paddingBottom: 46, paddingHorizontal: 36, fontFamily: "Helvetica", fontSize: 9, color: GRAY[900] },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", fontSize: 7.5, color: GRAY[400] },
  band: { borderRadius: 6, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 12 },
  bandTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  eyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1, textTransform: "uppercase" },
  name: { fontSize: 18, fontFamily: "Helvetica-Bold", marginTop: 3 },
  meta: { fontSize: 8, color: GRAY[700], marginTop: 3 },
  areaPill: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#ffffff", paddingVertical: 4, paddingHorizontal: 9, borderRadius: 10 },
  kpis: { flexDirection: "row", borderWidth: 1, borderColor: GRAY[200], borderRadius: 6, marginBottom: 14 },
  kpi: { flex: 1, paddingVertical: 8, paddingHorizontal: 9 },
  kpiLabel: { fontSize: 6.8, color: GRAY[500], fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 0.4 },
  kpiValue: { fontSize: 15, fontFamily: "Helvetica-Bold", marginTop: 3 },
  kpiSub: { fontSize: 7, color: GRAY[400], marginTop: 2 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  hint: { fontSize: 7.5, color: GRAY[500], marginBottom: 6 },
  section: { marginBottom: 14 },
  table: { borderWidth: 1, borderColor: GRAY[200], borderRadius: 5 },
  th: { flexDirection: "row", backgroundColor: GRAY[50], borderBottomWidth: 1, borderBottomColor: GRAY[200] },
  thCell: { fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY[500], textTransform: "uppercase", paddingVertical: 5, paddingHorizontal: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: GRAY[100] },
  td: { paddingVertical: 5, paddingHorizontal: 6, fontSize: 8.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  muted: { color: GRAY[500] },
  tiny: { fontSize: 7, color: GRAY[500] },
  empty: { fontSize: 8.5, color: GRAY[400], paddingVertical: 10, paddingHorizontal: 8 },
  chip: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: GRAY[700], backgroundColor: GRAY[100], paddingVertical: 1.5, paddingHorizontal: 4, borderRadius: 3 },
  twoCol: { flexDirection: "row", gap: 12 },
});

function Bar({ value, width = 70 }: { value: number | null; width?: number }) {
  const colors = band(value);
  const fill = value !== null && value > 0 ? Math.max(3, (width * value) / 100) : 0;
  return (
    <View style={{ width, height: 5, borderRadius: 2.5, backgroundColor: GRAY[100], marginTop: 2, marginBottom: 2 }}>
      {fill > 0 ? <View style={{ width: fill, height: 5, borderRadius: 2.5, backgroundColor: colors.bar }} /> : null}
    </View>
  );
}

function SectionHeader({ area, data }: { area: ReportAreaKey; data: StudentReportData }) {
  const cfg = AREA[area];
  return (
    <View style={[s.band, { backgroundColor: cfg.tint }]}>
      <View style={s.bandTop}>
        <View style={{ flex: 1 }}>
          <Text style={[s.eyebrow, { color: cfg.color }]}>SAT Practice Report</Text>
          <Text style={s.name}>{data.student.name}</Text>
          <Text style={s.meta}>
            {[
              data.student.email,
              data.student.programs.length ? `Program: ${data.student.programs.join(", ")}` : null,
              data.student.startDate ? `Started ${date(data.student.startDate)}` : null,
            ].filter(Boolean).join(" · ")}
          </Text>
          <Text style={s.meta}>
            {data.filterSummary ? `Showing: ${data.filterSummary}` : "Showing: all practice"} · Created {date(data.generatedAt)}
          </Text>
        </View>
        <Text style={[s.areaPill, { backgroundColor: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

function Kpis({ items }: { items: Array<{ label: string; value: string; color?: string; sub?: string }> }) {
  return (
    <View style={s.kpis}>
      {items.map((item, index) => (
        <View key={item.label} style={[s.kpi, index > 0 ? { borderLeftWidth: 1, borderLeftColor: GRAY[100] } : {}]}>
          <Text style={s.kpiLabel}>{item.label}</Text>
          <Text style={[s.kpiValue, item.color ? { color: item.color } : {}]}>{item.value}</Text>
          {item.sub ? <Text style={s.kpiSub}>{item.sub}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/** Matrix like the UI's PerformanceBreakdown: one row per label, one column per dimension. */
function Matrix({ title, hint, rowLabel, dimensions, dimensionLabel = (d) => d, summary, detail, groups }: { title: string; hint: string; rowLabel: string; dimensions: string[]; dimensionLabel?: (dimension: string) => string; summary?: ProgressMetric[]; detail: ProgressMetric[]; groups?: Array<{ label: string; rows: string[] }> }) {
  const present = new Set(detail.map((m) => m.label));
  // Same grouping as the UI: Domain header rows with skills in official order; else alphabetical.
  const sections = groups
    ? groups.map((g) => ({ label: g.label as string | null, rows: g.rows.filter((row) => present.has(row)) })).filter((g) => g.rows.length > 0)
    : [{ label: null as string | null, rows: [...present].sort((a, b) => a.localeCompare(b)) }];
  const leftovers = [...present].filter((row) => !sections.some((section) => section.rows.includes(row)));
  if (leftovers.length) sections.push({ label: groups ? "Other" : null, rows: leftovers.sort((a, b) => a.localeCompare(b)) });
  const cell = (key: string, metric: ProgressMetric | undefined) => {
    const value = pct(metric);
    return (
      <View key={key} style={[s.td, { flex: 1 }]}>
        {metric ? (
          <>
            <Text style={[s.bold, { color: band(value).text }]}>{value}%</Text>
            <Bar value={value} />
            <Text style={s.tiny}>{metric.correct} of {metric.total}</Text>
          </>
        ) : (
          <Text style={s.tiny}>-</Text>
        )}
      </View>
    );
  };
  return (
    <View style={s.section}>
      <Text style={s.h2} minPresenceAhead={80}>{title}</Text>
      <Text style={s.hint}>{hint}</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.thCell, { flex: 1.6 }]}>{rowLabel}</Text>
          {dimensions.map((d) => <Text key={d} style={[s.thCell, { flex: 1 }]}>{dimensionLabel(d)}</Text>)}
        </View>
        {summary ? (
          <View style={[s.tr, { backgroundColor: GRAY[50] }]}>
            <Text style={[s.td, s.bold, { flex: 1.6 }]}>All questions</Text>
            {dimensions.map((d) => cell(d, summary.find((m) => m.difficulty === d)))}
          </View>
        ) : null}
        {sections.map((section) => (
          <View key={section.label ?? "rows"}>
            {section.label ? (
              <View style={[s.tr, { backgroundColor: "#ffffff" }]} wrap={false}>
                <Text style={[s.td, { flex: 1, fontSize: 7, fontFamily: "Helvetica-Bold", color: GRAY[500], textTransform: "uppercase", letterSpacing: 0.5, paddingTop: 7, paddingBottom: 3 }]}>{section.label}</Text>
              </View>
            ) : null}
            {section.rows.map((label) => (
              <View key={label} style={s.tr} wrap={false}>
                <Text style={[s.td, { flex: 1.6 }]}>{label}</Text>
                {dimensions.map((d) => cell(d, detail.find((m) => m.label === label && m.difficulty === d)))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusText({ status }: { status: string }) {
  const color = status === "OVERDUE" ? "#dc2626" : status === "IN_PROGRESS" ? "#ca8a04" : "#2563eb";
  return <Text style={[s.bold, { color, fontSize: 7.5 }]}>{assignmentStatusLabel(status)}</Text>;
}

function PracticeSection({ report }: { report: PracticeReport }) {
  const k = report.kpis;
  const dims = ["EASY", "MEDIUM", "HARD"].filter((d) => report.difficultyMetrics.some((m) => m.difficulty === d));
  return (
    <>
      <Kpis
        items={[
          { label: "Practice sets completed", value: String(k.attempts) },
          { label: "Questions correct", value: k.overall.percent !== null ? `${k.overall.percent}%` : "-", color: band(k.overall.percent).text, sub: k.overall.total ? `${k.overall.correct} of ${k.overall.total} correct` : undefined },
          { label: "Time practiced", value: time(k.totalTime) },
          { label: "Average time per question", value: k.avgQuestionTime !== null ? time(k.avgQuestionTime) : "-" },
          { label: "Assignments to do", value: String(k.pending) },
        ]}
      />
      {k.attempts === 0 ? (
        <View style={[s.table, s.section]}><Text style={s.empty}>No {report.areaLabel} practice finished yet.</Text></View>
      ) : (
        <>
          <Matrix
            title="Performance by skill and difficulty"
            hint="Percent of questions answered correctly. Skipped questions count as wrong."
            rowLabel="Skill"
            dimensions={dims.length ? dims : ["EASY", "MEDIUM", "HARD"]}
            dimensionLabel={difficultyLabel}
            summary={report.difficultyMetrics}
            detail={report.topicDifficultyMetrics}
            groups={report.skillGroups}
          />
          <View style={s.section}>
            <Text style={s.h2}>Skills to work on next</Text>
            <Text style={s.hint}>Weakest skills first, with what to do next.</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { flex: 2.2 }]}>Skill (level)</Text>
                <Text style={[s.thCell, { flex: 1.3 }]}>Correct</Text>
                <Text style={[s.thCell, { flex: 0.8, textAlign: "right" }]}>Time per question</Text>
                <Text style={[s.thCell, { flex: 2.6 }]}>Suggested next step</Text>
              </View>
              {report.weakSkills.map((w) => (
                <View key={w.key} style={s.tr} wrap={false}>
                  <View style={[s.td, { flex: 2.2, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <Text style={s.bold}>{w.label}</Text>
                    <Text style={s.chip}>{difficultyLabel(w.difficulty)}</Text>
                  </View>
                  <View style={[s.td, { flex: 1.3 }]}>
                    <Text style={[s.bold, { color: band(w.percent).text }]}>{w.percent}% <Text style={[s.tiny, { fontFamily: "Helvetica" }]}>({w.correct} of {w.total})</Text></Text>
                    <Bar value={w.percent} width={60} />
                  </View>
                  <Text style={[s.td, s.muted, { flex: 0.8, textAlign: "right" }]}>{w.avgTime !== null ? time(w.avgTime) : "-"}</Text>
                  <Text style={[s.td, { flex: 2.6, color: GRAY[700] }]}>{w.recommendation}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {/* Side-by-side lists move to the next page as a block (flex rows do not split across pages). */}
      <View style={s.twoCol} wrap={false}>
        <View style={[s.section, { flex: 1 }]}>
          <Text style={s.h2}>Assigned practice ({report.assignments.length})</Text>
          <View style={s.table}>
            {report.assignments.length === 0 ? <Text style={s.empty}>No {report.areaLabel} practice assigned right now.</Text> : report.assignments.map((a) => (
              <View key={a.id} style={s.tr} wrap={false}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.bold}>{shortSetName(a.name)}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 1 }}>
                    <StatusText status={a.status} />
                    {a.locked ? <Text style={[s.tiny, { color: "#dc2626" }]}>Not open yet</Text> : null}
                    {a.dueDate ? <Text style={s.tiny}>Due {date(a.dueDate)}</Text> : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={[s.section, { flex: 1.25 }]}>
          <Text style={s.h2}>Recent practice ({report.attempts.length})</Text>
          <View style={s.table}>
            {report.attempts.length === 0 ? <Text style={s.empty}>No {report.areaLabel} practice finished yet.</Text> : report.attempts.slice(0, 10).map((a) => (
              <View key={a.id} style={s.tr} wrap={false}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.bold}>{shortSetName(a.name)}</Text>
                  <Text style={s.tiny}>{date(a.submittedAt)} · {time(a.totalTime)} spent</Text>
                </View>
                <Text style={[s.td, s.bold, { width: 44, textAlign: "right", color: band(a.percent).text }]}>{a.percent !== null ? `${a.percent}%` : "-"}</Text>
              </View>
            ))}
          </View>
          {report.attempts.length > 10 ? <Text style={[s.tiny, { marginTop: 3 }]}>+{report.attempts.length - 10} earlier sets not shown</Text> : null}
        </View>
      </View>

      {report.comments.length > 0 && (
        <View style={s.section}>
          <Text style={s.h2}>Teacher comments</Text>
          <View style={s.table}>
            {report.comments.map((c) => (
              <View key={c.id} style={[s.tr, { flexDirection: "column" }]} wrap={false}>
                <Text style={[s.td, s.tiny, { paddingBottom: 0 }]}>{shortSetName(c.name)} · {date(c.submittedAt)}</Text>
                <Text style={[s.td, { paddingTop: 2 }]}>{c.teacherComment}</Text>
              </View>
            ))}
          </View>
        </View>
      )}
    </>
  );
}

/**
 * One stacked bar per exam on the SAT total scale (0–1600): R&W at the bottom, Math on top, each
 * segment as tall as its section score (200–800), so the top of the bar IS the total printed above it.
 */
function ScoreChart({ series }: { series: MockReport["scoreSeries"] }) {
  const width = 523;
  const height = 168;
  const left = 30;
  const top = 14;
  const bottom = 22;
  const plotH = height - bottom - top;
  const baseY = top + plotH;
  const groupW = (width - left) / Math.max(series.length, 1);
  const barW = Math.min(26, groupW * 0.5);
  const h = (score: number) => (Math.max(0, score) / 1600) * plotH;
  const ticks = [0, 400, 800, 1200, 1600];
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.h2}>Scores by Test</Text>
      <Text style={s.hint}>
        {"Each bar is one Test. The number on top is the total score (out of 1600). Inside: Reading & Writing (bottom) and Math (top), each out of 800."}
      </Text>
      <Svg width={width} height={height}>
        {ticks.map((tick) => (
          <Line key={tick} x1={left} x2={width} y1={baseY - h(tick)} y2={baseY - h(tick)} stroke={GRAY[200]} strokeWidth={0.6} />
        ))}
        {ticks.map((tick) => (
          <Text key={`t${tick}`} x={0} y={baseY - h(tick) + 2.5} style={{ fontSize: 6.5 }} fill={GRAY[400]}>{String(tick)}</Text>
        ))}
        {series.map((exam, index) => {
          const cx = left + groupW * index + groupW / 2;
          const x = cx - barW / 2;
          const rwH = exam.rwScore !== null ? h(exam.rwScore) : 0;
          const mathH = exam.mathScore !== null ? h(exam.mathScore) : 0;
          const topY = baseY - rwH - mathH;
          const total = exam.totalScore ?? (exam.rwScore !== null && exam.mathScore !== null ? exam.rwScore + exam.mathScore : null);
          const totalText = total !== null ? String(total) : "-";
          const examLabel = exam.label.slice(0, Math.max(6, Math.floor(groupW / 4)));
          return (
            <G key={`${exam.label}-${index}`}>
              {exam.rwScore !== null ? <Rect x={x} y={baseY - rwH} width={barW} height={rwH} fill={AREA.reading.color} /> : null}
              {exam.mathScore !== null ? <Rect x={x} y={baseY - rwH - mathH} width={barW} height={mathH} fill={AREA.math.color} /> : null}
              {exam.rwScore !== null && rwH >= 10 ? (
                <Text x={cx - String(exam.rwScore).length * 1.7} y={baseY - rwH / 2 + 2.2} style={{ fontSize: 6.5 }} fill="#ffffff">{String(exam.rwScore)}</Text>
              ) : null}
              {exam.mathScore !== null && mathH >= 10 ? (
                <Text x={cx - String(exam.mathScore).length * 1.7} y={baseY - rwH - mathH / 2 + 2.2} style={{ fontSize: 6.5 }} fill="#ffffff">{String(exam.mathScore)}</Text>
              ) : null}
              <Text x={cx - totalText.length * 2.1} y={topY - 4} style={{ fontSize: 7.5, fontFamily: "Helvetica-Bold" }}>{totalText}</Text>
              <Text x={cx - examLabel.length * 1.6} y={height - 8} style={{ fontSize: 6.5 }} fill={GRAY[500]}>{examLabel}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 2, alignItems: "center" }}>
        {[
          { label: "Reading & Writing (out of 800)", color: AREA.reading.color },
          { label: "Math (out of 800)", color: AREA.math.color },
        ].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Svg width={7} height={7}><Rect x={0} y={0} width={7} height={7} fill={item.color} /></Svg>
            <Text style={s.tiny}>{item.label}</Text>
          </View>
        ))}
        <Text style={s.tiny}>Number on top = total score</Text>
      </View>
    </View>
  );
}

const SECTION_ROWS = ["Reading & Writing", "Math"];

/** "Reading & Writing Module 1" -> "Module 1" (the row already names the section). */
function MockSection({ report }: { report: MockReport }) {
  const k = report.kpis;
  const moduleTable = moduleTableOf(report.sectionModuleMetrics);
  return (
    <>
      <Kpis
        items={[
          { label: "Tests completed", value: String(k.exams) },
          { label: "Latest total score", value: k.latestTotal !== null ? String(k.latestTotal) : "-", color: AREA.mocks.color },
          { label: "Latest Reading & Writing", value: k.latestRw !== null ? String(k.latestRw) : "-" },
          { label: "Latest Math", value: k.latestMath !== null ? String(k.latestMath) : "-" },
          { label: "Tests to do", value: String(k.pending) },
        ]}
      />
      {report.exams.length === 0 ? (
        <View style={[s.table, s.section]}><Text style={s.empty}>No Tests finished yet.</Text></View>
      ) : (
        <>
          <ScoreChart series={report.scoreSeries} />
          <Matrix
            title="Performance by section and module"
            hint="Percent correct in each module. Skipped questions count as wrong."
            rowLabel="Section"
            dimensions={moduleTable.columns}
            detail={moduleTable.detail}
            groups={[{ label: "", rows: SECTION_ROWS }]}
          />
          <View style={s.section}>
            <Text style={s.h2}>Test history</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { flex: 1 }]}>Date</Text>
                <Text style={[s.thCell, { flex: 2.2 }]}>Test</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: "right" }]}>Total score</Text>
                <Text style={[s.thCell, { flex: 1.3, textAlign: "right" }]}>Reading & Writing</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: "right" }]}>Math</Text>
              </View>
              {report.exams.map((exam) => (
                <View key={exam.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.muted, { flex: 1 }]}>{date(exam.submittedAt)}</Text>
                  <Text style={[s.td, s.bold, { flex: 2.2 }]}>{exam.name}</Text>
                  <Text style={[s.td, s.bold, { flex: 1, textAlign: "right" }]}>{exam.totalScore ?? "-"}</Text>
                  <Text style={[s.td, { flex: 1.3, textAlign: "right" }]}>{exam.rwScore ?? "-"}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{exam.mathScore ?? "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
      <View style={s.section}>
        <Text style={s.h2}>Assigned Tests ({report.activeExams.length})</Text>
        <View style={s.table}>
          {report.activeExams.length === 0 ? <Text style={s.empty}>No Tests assigned right now.</Text> : report.activeExams.map((a) => (
            <View key={a.id} style={s.tr} wrap={false}>
              <Text style={[s.td, s.bold, { flex: 3 }]}>{a.name}</Text>
              <View style={[s.td, { flex: 1 }]}><StatusText status={a.status} /></View>
              <Text style={[s.td, s.muted, { flex: 1.2, textAlign: "right" }]}>{a.dueDate ? `Due ${date(a.dueDate)}` : "No due date"}</Text>
            </View>
          ))}
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
          {section.area === "mocks" ? <MockSection report={section.mock} /> : <PracticeSection report={section.practice} />}
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
