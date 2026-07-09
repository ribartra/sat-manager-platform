import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";
import { validateQuestionPayload } from "@/lib/content-validation";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { topicId, subskillId, difficulty, type, stem, stimulus, explanation, imageUrl, supportsGraph, correctAnswer, status, options } = data;
  const validationErrors = validateQuestionPayload({ topicId, difficulty, type, stem, explanation, correctAnswer, status, options });
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: "Validation failed.", errors: validationErrors }, { status: 400 });
  }

  const question = await prisma.question.create({
    data: {
      topicId,
      subskillId: subskillId || null,
      difficulty,
      type,
      stem,
      stimulus: stimulus || null,
      explanation: explanation || null,
      imageUrl: imageUrl || null,
      supportsGraph: Boolean(supportsGraph),
      correctAnswer,
      status,
      options: type === "MC" ? {
        create: options.filter((o: { text: string }) => o.text).map((o: { label: string; text: string }) => ({
          label: o.label,
          text: o.text,
        })),
      } : undefined,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: status === "PUBLISHED" ? "PUBLISH_QUESTION" : "CREATE_QUESTION",
      targetType: "Question",
      targetId: question.id,
      metadata: JSON.stringify({ topicId, difficulty, type, status, supportsGraph: Boolean(supportsGraph) }),
    },
  });

  return NextResponse.json(question);
}
