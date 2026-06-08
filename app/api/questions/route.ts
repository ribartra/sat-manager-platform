import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await req.json();
  const { topicId, subskillId, difficulty, type, stem, stimulus, explanation, correctAnswer, status, options } = data;

  const question = await prisma.question.create({
    data: {
      topicId,
      subskillId: subskillId || null,
      difficulty,
      type,
      stem,
      stimulus: stimulus || null,
      explanation: explanation || null,
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

  return NextResponse.json(question);
}
