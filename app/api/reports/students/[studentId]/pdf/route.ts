import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { scorePercent } from "@/lib/utils";
import { parseSnapshot, PracticeSetSnapshot, QuestionSnapshot } from "@/lib/attempt-snapshots";
import { teacherProgramEnrollmentScope } from "@/lib/program-scope";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

type PdfLine = { text: string; size?: number; bold?: boolean; gapBefore?: number };

function pdfEscape(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function wrapText(value: string, maxChars = 92) {
  if (value.length <= maxChars) return [value];
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function makeReportPdf(lines: PdfLine[]) {
  const pages: PdfLine[][] = [];
  let currentPage: PdfLine[] = [];
  let y = 748;

  for (const line of lines) {
    const wrapped = wrapText(line.text).map((text, index) => ({
      ...line,
      text,
      gapBefore: index === 0 ? line.gapBefore : 0,
    }));
    for (const wrappedLine of wrapped) {
      const size = wrappedLine.size ?? 10;
      y -= wrappedLine.gapBefore ?? 0;
      if (y < 54) {
        pages.push(currentPage);
        currentPage = [];
        y = 748;
      }
      currentPage.push(wrappedLine);
      y -= size + 7;
    }
  }
  if (currentPage.length > 0) pages.push(currentPage);

  const objects: string[] = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    `2 0 obj << /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 2} 0 R`).join(" ")}] /Count ${pages.length} >> endobj`,
  ];

  pages.forEach((pageLines, pageIndex) => {
    let cursorY = 748;
    const commands = [
      `BT /F2 9 Tf 50 775 Td (${pdfEscape("SAT Practice Report")}) Tj ET`,
      `BT /F1 8 Tf 520 775 Td (${pageIndex + 1}/${pages.length}) Tj ET`,
    ];
    for (const line of pageLines) {
      cursorY -= line.gapBefore ?? 0;
      const font = line.bold ? "F2" : "F1";
      const size = line.size ?? 10;
      commands.push(`BT /${font} ${size} Tf 50 ${cursorY} Td (${pdfEscape(line.text)}) Tj ET`);
      cursorY -= size + 7;
    }
    const content = commands.join("\n");
    const pageObjectId = 3 + pageIndex * 2;
    const contentObjectId = pageObjectId + 1;
    objects.push(`${pageObjectId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${3 + pages.length * 2} 0 R /F2 ${4 + pages.length * 2} 0 R >> >> /Contents ${contentObjectId} 0 R >> endobj`);
    objects.push(`${contentObjectId} 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj`);
  });

  objects.push(`${3 + pages.length * 2} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj`);
  objects.push(`${4 + pages.length * 2} 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj`);

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += `${object}\n`;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => { pdf += `${String(offset).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { studentId } = await params;
  const programScope =
    session.user.role === "TEACHER"
      ? teacherProgramEnrollmentScope(session.user.id)
      : undefined;
  const student = await prisma.user.findFirst({
    where: {
      id: studentId,
      role: "STUDENT",
      ...(programScope ? { programEnrollments: programScope } : {}),
    },
  });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attempts = await prisma.attempt.findMany({
    where: { studentId, status: "SUBMITTED" },
    include: { answers: { include: { question: { include: { topic: true } } } }, assignment: { include: { practiceSet: true } } },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });
  const totalTime = attempts.reduce((sum, attempt) => sum + (attempt.totalTime ?? 0), 0);
  const scores = attempts.map((attempt) => {
    const correct = attempt.answers.filter((a) => a.isCorrect).length;
    return scorePercent(correct, attempt.answers.length);
  });
  const avgScore = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null;
  const topicStats = new Map<string, { correct: number; total: number }>();
  const difficultyStats = new Map<string, { correct: number; total: number }>();
  const mediaUrls = new Set<string>();

  for (const attempt of attempts) {
    for (const answer of attempt.answers) {
      const snapshot = parseSnapshot<QuestionSnapshot>(answer.questionSnapshot);
      const topic = snapshot?.topic?.name ?? answer.question.topic.name;
      const difficulty = snapshot?.difficulty ?? answer.question.difficulty;
      const topicStat = topicStats.get(topic) ?? { correct: 0, total: 0 };
      const difficultyStat = difficultyStats.get(difficulty) ?? { correct: 0, total: 0 };
      topicStat.total += 1;
      difficultyStat.total += 1;
      if (answer.isCorrect) {
        topicStat.correct += 1;
        difficultyStat.correct += 1;
      }
      topicStats.set(topic, topicStat);
      difficultyStats.set(difficulty, difficultyStat);
      const imageUrl = snapshot?.imageUrl ?? answer.question.imageUrl;
      if (imageUrl) mediaUrls.add(imageUrl);
    }
  }

  const lines: PdfLine[] = [
    { text: "SAT Practice Report", size: 20, bold: true },
    { text: `Student: ${student.name}`, size: 12, bold: true, gapBefore: 14 },
    { text: `Completed attempts: ${attempts.length}` },
    { text: `Average score: ${avgScore !== null ? `${avgScore}%` : "N/A"}` },
    { text: `Practice time: ${Math.round(totalTime / 60)} minutes` },
    { text: "Recent Attempts", size: 13, bold: true, gapBefore: 18 },
  ];
  attempts.forEach((attempt) => {
    const correct = attempt.answers.filter((a) => a.isCorrect).length;
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    lines.push({ text: `${snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set"}: ${correct}/${attempt.answers.length} (${scorePercent(correct, attempt.answers.length)}%)` });
  });
  lines.push({ text: "Score Progress Over Time", size: 13, bold: true, gapBefore: 18 });
  [...attempts].reverse().forEach((attempt, index) => {
    const correct = attempt.answers.filter((a) => a.isCorrect).length;
    const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
    const label = snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set";
    const date = attempt.submittedAt ? attempt.submittedAt.toISOString().slice(0, 10) : "No date";
    lines.push({ text: `#${index + 1} ${date} - ${label}: ${scorePercent(correct, attempt.answers.length)}%` });
  });
  lines.push({ text: "Progress by Topic", size: 13, bold: true, gapBefore: 18 });
  for (const [topic, stat] of topicStats.entries()) {
    lines.push({ text: `${topic}: ${stat.correct}/${stat.total} (${scorePercent(stat.correct, stat.total)}%)` });
  }
  lines.push({ text: "Progress by Difficulty", size: 13, bold: true, gapBefore: 18 });
  for (const [difficulty, stat] of difficultyStats.entries()) {
    lines.push({ text: `${difficulty}: ${stat.correct}/${stat.total} (${scorePercent(stat.correct, stat.total)}%)` });
  }
  if (mediaUrls.size > 0) {
    lines.push({ text: "Question Media URLs", size: 13, bold: true, gapBefore: 18 });
    for (const url of [...mediaUrls].slice(0, 8)) lines.push({ text: url });
  }
  const weakTopics = [...topicStats.entries()]
    .map(([topic, stat]) => ({ topic, ...stat, score: scorePercent(stat.correct, stat.total) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  if (weakTopics.length > 0) {
    lines.push({ text: "Weak Topics", size: 13, bold: true, gapBefore: 18 });
    for (const topic of weakTopics) {
      lines.push({ text: `${topic.topic}: ${topic.correct}/${topic.total} (${topic.score}%) - assign targeted practice` });
    }
  }
  const teacherComments = attempts.filter((attempt) => attempt.teacherComment);
  if (teacherComments.length > 0) {
    lines.push({ text: "Teacher Comments", size: 13, bold: true, gapBefore: 18 });
    for (const attempt of teacherComments.slice(0, 8)) {
      const snapshot = parseSnapshot<PracticeSetSnapshot>(attempt.practiceSetSnapshot);
      const label = snapshot?.name ?? attempt.assignment?.practiceSet.name ?? "Practice Set";
      lines.push({ text: `${label}: ${attempt.teacherComment}` });
    }
  }

  return new NextResponse(makeReportPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${student.name.replace(/\\s+/g, "-")}-report.pdf\"`,
    },
  });
}
