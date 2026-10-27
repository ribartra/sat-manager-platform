import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { practiceSetEditorIssues } from "@/contracts/practice-set";
import { ForbiddenError, ValidationError, withApiErrors } from "@/lib/api-error";
import { contentProgramFor, sameProgramQuestionsIssue } from "@/lib/program-scope";

export const POST = withApiErrors(async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return new ForbiddenError("Forbidden").toResponse();
  }

  const { name, topicId, difficulty, status, explanationVisibility, questionIds, programId: requestedProgramId } = await req.json();
  const validationErrors = practiceSetEditorIssues({ name, topicId, difficulty, status, explanationVisibility, questionIds });
  // The set goes to the bank of a program the author teaches, with questions of that same bank.
  const programId = await contentProgramFor(session.user, typeof requestedProgramId === "string" ? requestedProgramId : null);
  const programIssue = await sameProgramQuestionsIssue(Array.isArray(questionIds) ? questionIds : [], programId);
  if (programIssue) validationErrors.push(programIssue);
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
    return new ValidationError("Validation failed.", validationErrors).toResponse();
  }

  const practiceSet = await prisma.practiceSet.create({
    data: {
      programId,
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
});
