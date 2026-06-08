import { NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { scorePercent } from "@/lib/utils";

interface RouteContext {
  params: Promise<{ studentId: string }>;
}

function pdfEscape(value: string) {
  return value.replace(/[\\()]/g, "\\$&");
}

function makeSimplePdf(lines: string[]) {
  const text = lines.map((line, index) => `BT /F1 11 Tf 50 ${760 - index * 18} Td (${pdfEscape(line)}) Tj ET`).join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${text.length} >> stream\n${text}\nendstream endobj`,
  ];
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
  const student = await prisma.user.findUnique({ where: { id: studentId } });
  if (!student) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attempts = await prisma.attempt.findMany({
    where: { studentId, status: "SUBMITTED" },
    include: { answers: true, assignment: { include: { practiceSet: true } } },
    orderBy: { submittedAt: "desc" },
    take: 20,
  });
  const lines = [`SAT Practice Report`, `Student: ${student.name}`, `Attempts: ${attempts.length}`, ""];
  attempts.forEach((attempt) => {
    const correct = attempt.answers.filter((a) => a.isCorrect).length;
    lines.push(`${attempt.assignment?.practiceSet.name ?? "Practice Set"}: ${correct}/${attempt.answers.length} (${scorePercent(correct, attempt.answers.length)}%)`);
  });

  return new NextResponse(makeSimplePdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${student.name.replace(/\\s+/g, "-")}-report.pdf\"`,
    },
  });
}
