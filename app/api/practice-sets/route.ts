import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, topicId, difficulty, status, explanationVisibility, questionIds } = await req.json();
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

  return NextResponse.json(practiceSet);
}
