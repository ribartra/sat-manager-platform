import { redirect } from "next/navigation";
import { PageShell } from "@/components/sat";
import { getStudentViewer } from "@/lib/student-viewer";
import prisma from "@/lib/prisma";
import { refreshAssignmentStates } from "@/lib/assignments";
import { StudentHome } from "./student-home";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ area?: string; skill?: string; difficulty?: string; status?: string; page?: string }>;
}

/** Student Home (see StudentHome). Parents have their own portal (/parent); the layout sends them there. */
export default async function StudentDashboard({ searchParams }: PageProps) {
  // The student shown: the signed-in student, or the teacher's Student view (read only).
  const viewer = await getStudentViewer();
  if (!viewer) redirect("/login");
  const session = viewer.session;
  const userId = viewer.studentId;
  await refreshAssignmentStates();

  // Guard: only students without an active enrollment land on /student/program
  if (session!.user.role === "STUDENT") {
    const now = new Date();
    const activeEnrollment = await prisma.programEnrollment.findFirst({
      where: {
        studentId: userId,
        status: "APPROVED",
        active: true,
        program: {
          active: true,
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    });
    if (!activeEnrollment) redirect("/student/program");
  }

  // Older links to the Home tabs: the area lives on Practice, the Tests on Tests.
  const query = await searchParams;
  if (query.area === "tests" || query.area === "mocks") redirect("/student/tests");
  if (query.area === "math" || query.area === "reading" || query.area === "writing") redirect(`/student/practice?area=${query.area}`);
  return (
    <PageShell>
      <StudentHome studentId={userId} firstName={viewer.studentName.split(" ")[0]} />
    </PageShell>
  );
}
