import { AssignView } from "../../../assign/assign-view";

interface PageProps {
  params: Promise<{ studentId: string }>;
  /** See lib/assign-params.ts: area, set, test, topic, difficulty, source, edit (older: sets). */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Assign practice sets or Tests to this student (the one Assign view, student chosen). */
export default async function AssignPage({ params, searchParams }: PageProps) {
  const [{ studentId }, query] = await Promise.all([params, searchParams]);
  return <AssignView studentId={studentId} query={query} />;
}
