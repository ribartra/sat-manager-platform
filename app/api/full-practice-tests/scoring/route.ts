import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows } = await req.json();
  let saved = 0;
  for (const row of rows as { section: string; rawCorrect: number; score: number }[]) {
    if (!row.section || row.rawCorrect === undefined || !row.score) continue;
    await prisma.fullPracticeTestScoreConversion.upsert({
      where: { section_rawCorrect: { section: row.section, rawCorrect: Number(row.rawCorrect) } },
      update: { score: Number(row.score) },
      create: { section: row.section, rawCorrect: Number(row.rawCorrect), score: Number(row.score) },
    });
    saved += 1;
  }
  return NextResponse.json({ saved });
}
