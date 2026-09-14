import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { practiceSetEditorIssues } from "@/contracts/practice-set";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, topicId, difficulty, status, explanationVisibility, questionIds } = await req.json();
  const validationErrors = practiceSetEditorIssues({ name, topicId, difficulty, status, explanationVisibility, questionIds });
  if ((status || "DRAFT") === "PUBLISHED" && Array.isArray(questionIds) && questionIds.length > 0) {
    const questions = await prisma.question.findMany({
      where: { id: { in: questionIds } },
      select: { id: true, status: true, topicId: true },
    });
    if (questions.length !== questionIds.length) validationErrors.push("All selected questions must exist.");
    if (questions.some((question) => question.status !== "PUBLISHED")) {
      validationErrors.push("All questions must be published before publishing a Practice Set.");
    }
    if (questions.some((question) => question.topicId !== topicId)) {
      validationErrors.push("All questions in a Practice Set must belong to the selected topic.");
    }
  }
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validationErrors }, { status: 400 });
  }

  const practiceSet = await prisma.practiceSet.create({
    data: {
      name,
      topicId,
      difficulty,
      status,
      explanationVisibility,
      questions: {
        create: (questionIds as string[]).map((questionId, order) => ({ questionId, order })),
      },
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: status === "PUBLISHED" ? "PUBLISH_PRACTICE_SET" : "CREATE_PRACTICE_SET",
      targetType: "PracticeSet",
      targetId: practiceSet.id,
      metadata: JSON.stringify({
        topicId,
        difficulty,
        status,
        explanationVisibility,
        questionCount: Array.isArray(questionIds) ? questionIds.length : 0,
      }),
    },
  });

  return NextResponse.json(practiceSet);
}
