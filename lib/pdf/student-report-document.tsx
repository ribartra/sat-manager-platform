// Server-side PDF for the student progress report (no browser involved): @react-pdf/renderer
// lays out the same data the teacher student page shows (lib/student-report.ts) and renders
// it to a PDF buffer. One section per selected area, each starting on a new page, so several
// areas come out as a single concatenated file.
// Only WinAnsi characters are used (built-in Helvetica): no arrows or ≤/≥ symbols.
import { Document, G, Page, Rect, StyleSheet, Svg, Text, View, Line, renderToBuffer } from "@react-pdf/renderer";
import type { MockReport, PracticeReport } from "@/lib/student-report";
import { shortSetName } from "@/lib/student-report";
import type { ProgressMetric } from "@/lib/progress-analytics";

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

const AREA = {
  math: { label: "Math", color: "#0ea5e9", tint: "#e0f2fe" },
  reading: { label: "Reading", color: "#c4a035", tint: "#fbf3dc" },
  writing: { label: "Writing", color: "#16a34a", tint: "#dcfce7" },
  mocks: { label: "Full Practice Tests", color: "#ea580c", tint: "#ffedd5" },
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
const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const date = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "-";

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
            {data.student.email}
            {data.student.programs.length ? `  ·  Programs: ${data.student.programs.join(", ")}` : ""}
            {data.student.startDate ? `  ·  Since ${date(data.student.startDate)}` : ""}
          </Text>
          <Text style={s.meta}>
            {data.filterSummary ? `Filters: ${data.filterSummary}` : "All activity (no filters)"}  ·  Generated {date(data.generatedAt)}
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
function Matrix({ title, hint, rowLabel, dimensions, summary, detail }: { title: string; hint: string; rowLabel: string; dimensions: string[]; summary: ProgressMetric[]; detail: ProgressMetric[] }) {
  const labels = [...new Set(detail.map((m) => m.label))].sort((a, b) => a.localeCompare(b));
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
    <View style={s.section} wrap={false}>
      <Text style={s.h2}>{title}</Text>
      <Text style={s.hint}>{hint}</Text>
      <View style={s.table}>
        <View style={s.th}>
          <Text style={[s.thCell, { flex: 1.6 }]}>{rowLabel}</Text>
          {dimensions.map((d) => <Text key={d} style={[s.thCell, { flex: 1 }]}>{d}</Text>)}
        </View>
        <View style={[s.tr, { backgroundColor: GRAY[50] }]}>
          <Text style={[s.td, s.bold, { flex: 1.6 }]}>All selected questions</Text>
          {dimensions.map((d) => cell(d, summary.find((m) => m.difficulty === d)))}
        </View>
        {labels.map((label) => (
          <View key={label} style={s.tr} wrap={false}>
            <Text style={[s.td, { flex: 1.6 }]}>{label}</Text>
            {dimensions.map((d) => cell(d, detail.find((m) => m.label === label && m.difficulty === d)))}
          </View>
        ))}
      </View>
    </View>
  );
}

function StatusText({ status }: { status: string }) {
  const color = status === "OVERDUE" ? "#dc2626" : status === "IN_PROGRESS" ? "#ca8a04" : "#2563eb";
  return <Text style={[s.bold, { color, fontSize: 7.5 }]}>{status.replace("_", " ")}</Text>;
}

function PracticeSection({ report }: { report: PracticeReport }) {
  const k = report.kpis;
  const dims = ["EASY", "MEDIUM", "HARD"].filter((d) => report.difficultyMetrics.some((m) => m.difficulty === d));
  return (
    <>
      <Kpis
        items={[
          { label: `Attempts · ${report.areaLabel}`, value: String(k.attempts) },
          { label: "Average score", value: k.overall.percent !== null ? `${k.overall.percent}%` : "-", color: band(k.overall.percent).text, sub: k.overall.total ? `${k.overall.correct} of ${k.overall.total} correct` : undefined },
          { label: "Total time", value: time(k.totalTime) },
          { label: "Avg question time", value: k.avgQuestionTime !== null ? time(k.avgQuestionTime) : "-" },
          { label: "Pending sets", value: String(k.pending) },
        ]}
      />
      {k.attempts === 0 ? (
        <View style={[s.table, s.section]}><Text style={s.empty}>No submitted {report.areaLabel} practice for this student yet.</Text></View>
      ) : (
        <>
          <Matrix
            title="Performance by skill and difficulty"
            hint="Correct answers / all questions in the selected filters; blank answers count as incorrect."
            rowLabel="Skill"
            dimensions={dims.length ? dims : ["EASY", "MEDIUM", "HARD"]}
            summary={report.difficultyMetrics}
            detail={report.topicDifficultyMetrics}
          />
          <View style={s.section}>
            <Text style={s.h2}>Skill performance by difficulty</Text>
            <Text style={s.hint}>Lowest accuracy first, with the suggested next step.</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { flex: 2.2 }]}>Skill · difficulty</Text>
                <Text style={[s.thCell, { flex: 1.3 }]}>Accuracy</Text>
                <Text style={[s.thCell, { flex: 0.8, textAlign: "right" }]}>Avg time</Text>
                <Text style={[s.thCell, { flex: 2.6 }]}>Suggested next step</Text>
              </View>
              {report.weakSkills.map((w) => (
                <View key={w.key} style={s.tr} wrap={false}>
                  <View style={[s.td, { flex: 2.2, flexDirection: "row", alignItems: "center", gap: 4 }]}>
                    <Text style={s.bold}>{w.label}</Text>
                    <Text style={s.chip}>{w.difficulty}</Text>
                  </View>
                  <View style={[s.td, { flex: 1.3 }]}>
                    <Text style={[s.bold, { color: band(w.percent).text }]}>{w.percent}%  <Text style={[s.tiny, { fontFamily: "Helvetica" }]}>({w.correct}/{w.total})</Text></Text>
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
          <Text style={s.h2}>Active practice sets ({report.assignments.length})</Text>
          <View style={s.table}>
            {report.assignments.length === 0 ? <Text style={s.empty}>No active {report.areaLabel} practice sets.</Text> : report.assignments.map((a) => (
              <View key={a.id} style={s.tr} wrap={false}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.bold}>{shortSetName(a.name)}</Text>
                  <View style={{ flexDirection: "row", gap: 6, marginTop: 1 }}>
                    <StatusText status={a.status} />
                    {a.locked ? <Text style={[s.tiny, { color: "#dc2626" }]}>Locked</Text> : null}
                    {a.dueDate ? <Text style={s.tiny}>Due {date(a.dueDate)}</Text> : null}
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
        <View style={[s.section, { flex: 1.25 }]}>
          <Text style={s.h2}>Recent attempts ({report.attempts.length})</Text>
          <View style={s.table}>
            {report.attempts.length === 0 ? <Text style={s.empty}>No completed {report.areaLabel} attempts yet.</Text> : report.attempts.slice(0, 10).map((a) => (
              <View key={a.id} style={s.tr} wrap={false}>
                <View style={[s.td, { flex: 1 }]}>
                  <Text style={s.bold}>{shortSetName(a.name)}</Text>
                  <Text style={s.tiny}>{date(a.submittedAt)} · {time(a.totalTime)} spent</Text>
                </View>
                <Text style={[s.td, s.bold, { width: 44, textAlign: "right", color: band(a.percent).text }]}>{a.percent !== null ? `${a.percent}%` : "-"}</Text>
              </View>
            ))}
          </View>
          {report.attempts.length > 10 ? <Text style={[s.tiny, { marginTop: 3 }]}>+{report.attempts.length - 10} older attempts</Text> : null}
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

/** Grouped bars per exam: R&W and Math (200–800), SAT total printed above. */
function ScoreChart({ series }: { series: MockReport["scoreSeries"] }) {
  const width = 523;
  const height = 150;
  const left = 26;
  const bottom = 22;
  const plotH = height - bottom - 16;
  const groupW = (width - left) / Math.max(series.length, 1);
  const barW = Math.min(18, groupW / 3);
  const y = (score: number) => 16 + plotH - (Math.max(0, score - 200) / 600) * plotH;
  return (
    <View style={s.section} wrap={false}>
      <Text style={s.h2}>Scores by exam</Text>
      <Text style={s.hint}>Section scores (200-800); the SAT total (400-1600) is shown above each exam.</Text>
      <Svg width={width} height={height}>
        {[200, 400, 600, 800].map((tick) => (
          <Line key={tick} x1={left} x2={width} y1={y(tick)} y2={y(tick)} stroke={GRAY[200]} strokeWidth={0.6} />
        ))}
        {[200, 400, 600, 800].map((tick) => (
          <Text key={`t${tick}`} x={0} y={y(tick) + 2.5} style={{ fontSize: 6.5 }} fill={GRAY[400]}>{String(tick)}</Text>
        ))}
        {series.map((exam, index) => {
          const cx = left + groupW * index + groupW / 2;
          return (
            <G key={`${exam.label}-${index}`}>
              {exam.rwScore !== null ? <Rect x={cx - barW - 1} y={y(exam.rwScore)} width={barW} height={16 + plotH - y(exam.rwScore)} fill={AREA.reading.color} /> : null}
              {exam.mathScore !== null ? <Rect x={cx + 1} y={y(exam.mathScore)} width={barW} height={16 + plotH - y(exam.mathScore)} fill={AREA.math.color} /> : null}
              <Text x={cx - 9} y={Math.min(y(exam.rwScore ?? 200), y(exam.mathScore ?? 200)) - 4} style={{ fontSize: 7, fontFamily: "Helvetica-Bold" }}>{exam.totalScore !== null ? String(exam.totalScore) : "-"}</Text>
              <Text x={cx - groupW / 2 + 2} y={height - 8} style={{ fontSize: 6.5 }} fill={GRAY[500]}>{exam.label.slice(0, Math.max(6, Math.floor(groupW / 4)))}</Text>
            </G>
          );
        })}
      </Svg>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 2, alignItems: "center" }}>
        {[{ label: "Reading & Writing", color: AREA.reading.color }, { label: "Math", color: AREA.math.color }].map((item) => (
          <View key={item.label} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
            <Svg width={7} height={7}><Rect x={0} y={0} width={7} height={7} fill={item.color} /></Svg>
            <Text style={s.tiny}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MockSection({ report }: { report: MockReport }) {
  const k = report.kpis;
  return (
    <>
      <Kpis
        items={[
          { label: "Exams completed", value: String(k.exams) },
          { label: "Latest total", value: k.latestTotal !== null ? String(k.latestTotal) : "-", color: AREA.mocks.color },
          { label: "Latest R&W", value: k.latestRw !== null ? String(k.latestRw) : "-" },
          { label: "Latest Math", value: k.latestMath !== null ? String(k.latestMath) : "-" },
          { label: "Pending exams", value: String(k.pending) },
        ]}
      />
      {report.exams.length === 0 ? (
        <View style={[s.table, s.section]}><Text style={s.empty}>No submitted Full Practice Tests for this student yet.</Text></View>
      ) : (
        <>
          <ScoreChart series={report.scoreSeries} />
          <Matrix
            title="Performance by section and module"
            hint="Correct answers / all questions of each module; blank answers count as incorrect."
            rowLabel="Section"
            dimensions={report.modules}
            summary={report.moduleMetrics}
            detail={report.sectionModuleMetrics}
          />
          <View style={s.section}>
            <Text style={s.h2}>Exam history</Text>
            <View style={s.table}>
              <View style={s.th}>
                <Text style={[s.thCell, { flex: 1 }]}>Date</Text>
                <Text style={[s.thCell, { flex: 2.5 }]}>Exam</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: "right" }]}>SAT total</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: "right" }]}>R&W</Text>
                <Text style={[s.thCell, { flex: 1, textAlign: "right" }]}>Math</Text>
              </View>
              {report.exams.map((exam) => (
                <View key={exam.id} style={s.tr} wrap={false}>
                  <Text style={[s.td, s.muted, { flex: 1 }]}>{date(exam.submittedAt)}</Text>
                  <Text style={[s.td, s.bold, { flex: 2.5 }]}>{exam.name}</Text>
                  <Text style={[s.td, s.bold, { flex: 1, textAlign: "right" }]}>{exam.totalScore ?? "-"}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{exam.rwScore ?? "-"}</Text>
                  <Text style={[s.td, { flex: 1, textAlign: "right" }]}>{exam.mathScore ?? "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
      <View style={s.section}>
        <Text style={s.h2}>Active Full Practice Tests ({report.activeExams.length})</Text>
        <View style={s.table}>
          {report.activeExams.length === 0 ? <Text style={s.empty}>No active Full Practice Tests.</Text> : report.activeExams.map((a) => (
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
