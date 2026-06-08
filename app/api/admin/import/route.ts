import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...rows] = lines;
  const headers = headerLine.split(",").map((h) => h.trim());
  return rows.map((row) => {
    const values = row.split(",").map((v) => v.trim());
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  });
}

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { csv } = await req.json();
  if (!csv) return NextResponse.json({ error: "CSV content is required." }, { status: 400 });

  const rows = parseCsv(csv);
  let created = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      if (!row.topicId || !row.stem || !row.correctAnswer) {
        errors.push(`Row ${index + 2}: topicId, stem and correctAnswer are required.`);
        continue;
      }
      const options = ["A", "B", "C", "D"]
        .map((label) => ({ label, text: row[`option${label}`] }))
        .filter((option) => option.text);
      await prisma.question.create({
        data: {
          topicId: row.topicId,
          difficulty: row.difficulty || "EASY",
          type: row.type || "MC",
          status: row.status || "DRAFT",
          stem: row.stem,
          stimulus: row.stimulus || null,
          explanation: row.explanation || null,
          correctAnswer: row.correctAnswer,
          options: (row.type || "MC") === "MC" ? { create: options } : undefined,
        },
      });
      created += 1;
    } catch (error) {
      errors.push(`Row ${index + 2}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  return NextResponse.json({ created, errors });
}
