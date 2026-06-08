import { NextRequest, NextResponse } from "next/server";
import { requireTeacherOrAdmin } from "@/lib/rbac";
import prisma from "@/lib/prisma";

const MODULES = [
  { name: "Reading & Writing Module 1", section: "RW", timeLimit: 32 * 60 },
  { name: "Reading & Writing Module 2", section: "RW", timeLimit: 32 * 60 },
  { name: "Math Module 1", section: "MATH", timeLimit: 35 * 60 },
  { name: "Math Module 2", section: "MATH", timeLimit: 35 * 60 },
];

export async function POST(req: NextRequest) {
  const session = await requireTeacherOrAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { name, status, moduleQuestionIds } = await req.json();
  const test = await prisma.fullPracticeTest.create({
    data: {
      name,
      status: status ?? "DRAFT",
      modules: {
        create: MODULES.map((module, order) => ({
          ...module,
          order,
          questions: {
            create: ((moduleQuestionIds?.[order] ?? []) as string[]).map((questionId, qOrder) => ({ questionId, order: qOrder })),
          },
        })),
      },
    },
  });

  return NextResponse.json(test);
}
