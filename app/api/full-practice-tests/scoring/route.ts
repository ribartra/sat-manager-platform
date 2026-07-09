import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateScoreConversions } from "@/lib/full-test-scoring";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { rows, dryRun } = await req.json();
  const validation = validateScoreConversions(rows ?? []);
  if (dryRun) {
    return NextResponse.json({
      valid: validation.errors.length === 0,
      rows: validation.rows,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  }
  if (validation.errors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validation.errors, warnings: validation.warnings }, { status: 400 });
  }

  let saved = 0;
  for (const row of validation.rows) {
    await prisma.fullPracticeTestScoreConversion.upsert({
      where: { section_rawCorrect: { section: row.section, rawCorrect: row.rawCorrect } },
      update: { score: row.score },
      create: { section: row.section, rawCorrect: row.rawCorrect, score: row.score },
    });
    saved += 1;
  }
  return NextResponse.json({ saved, warnings: validation.warnings });
}
