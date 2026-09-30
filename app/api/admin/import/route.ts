import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateQuestionPayload } from "@/lib/content-validation";
import { captureCaughtError } from "@/lib/audit";
import { BadRequestError, ForbiddenError, withApiErrors } from "@/lib/api-error";

type CsvRow = Record<string, string>;

interface ValidatedRow {
  rowNumber: number;
  row: CsvRow;
  errors: string[];
}

function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === "\"") {
      if (quoted && next === "\"") {
        field += "\"";
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((value) => value.length > 0)) rows.push(row);

  const [headerRow, ...dataRows] = rows;
  if (!headerRow) return [];
  const headers = headerRow.map((header) => header.trim());
  return dataRows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function normalizeRow(row: CsvRow): CsvRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key.trim(), (value ?? "").trim()])
  );
}

function validateRows(rows: CsvRow[]) {
  const validated: ValidatedRow[] = [];

  for (const [index, rawRow] of rows.entries()) {
    const row = normalizeRow(rawRow);
    const rowNumber = index + 2;
    const errors: string[] = [];
    const type = row.type || "MC";
    const status = row.status || "DRAFT";
    const options = ["A", "B", "C", "D"]
      .map((label) => ({ label, text: row[`option${label}`], imageUrl: row[`option${label}ImageUrl`] || null }))
      .filter((option) => option.text);

    if (!row.topicId) errors.push("topicId is required.");
    if (!row.stem) errors.push("stem is required.");
    if (!row.correctAnswer) errors.push("correctAnswer is required.");

    const validationErrors = validateQuestionPayload({
      topicId: row.topicId,
      difficulty: row.difficulty || "EASY",
      type,
      stem: row.stem,
      explanation: row.explanation || null,
      correctAnswer: row.correctAnswer,
      status,
      options,
    });

    validated.push({
      rowNumber,
      row,
      errors: [...errors, ...validationErrors],
    });
  }

  return validated;
}

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { csv, dryRun } = (await req.json()) as { csv?: string; dryRun?: boolean };
  if (!csv) return new BadRequestError("CSV content is required.").toResponse();

  const rows = parseCsv(csv);
  const validatedRows = validateRows(rows);
  const previewRows = validatedRows.map(({ rowNumber, row, errors }) => ({
    rowNumber,
    topicId: row.topicId || "",
    stem: row.stem || "",
    type: row.type || "MC",
    status: row.status || "DRAFT",
    valid: errors.length === 0,
    errors,
  }));

  if (dryRun) {
    return NextResponse.json({
      totalRows: previewRows.length,
      validRows: previewRows.filter((entry) => entry.valid).length,
      invalidRows: previewRows.filter((entry) => !entry.valid).length,
      rows: previewRows,
    });
  }

  let created = 0;
  const errors: string[] = [];

  for (const validated of validatedRows) {
    try {
      const row = validated.row;
      if (validated.errors.length > 0) {
        errors.push(`Row ${validated.rowNumber}: ${validated.errors.join(" ")}`);
        continue;
      }

      const options = ["A", "B", "C", "D"]
        .map((label) => ({ label, text: row[`option${label}`], imageUrl: row[`option${label}ImageUrl`] || null }))
        .filter((option) => option.text);
      const type = row.type || "MC";
      const status = row.status || "DRAFT";

      await prisma.question.create({
        data: {
          topicId: row.topicId,
          difficulty: row.difficulty || "EASY",
          type,
          status,
          stem: row.stem,
          stimulus: row.stimulus || null,
          imageUrl: row.imageUrl || null,
          explanation: row.explanation || null,
          correctAnswer: row.correctAnswer,
          options: type === "MC" ? { create: options } : undefined,
        },
      });
      created += 1;
    } catch (error) {
      await captureCaughtError("admin.import.row", error, {
        userId: session.user.id,
        metadata: { rowNumber: validated.rowNumber },
      });
      errors.push(`Row ${validated.rowNumber}: ${error instanceof Error ? error.message : "Import failed."}`);
    }
  }

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: "IMPORT_QUESTIONS",
      targetType: "Question",
      metadata: JSON.stringify({
        totalRows: validatedRows.length,
        created,
        errorCount: errors.length,
        dryRun: false,
      }),
    },
  });

  return NextResponse.json({ created, errors });
});
