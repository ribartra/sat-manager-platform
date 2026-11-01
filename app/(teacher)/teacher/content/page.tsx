import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ area?: string; section?: string }>;
}

/** The Content map was merged into Practice ("By skill"); old links land there. */
export default async function TeacherContentRedirect({ searchParams }: PageProps) {
  const { area, section } = await searchParams;
  const tab = area ?? section;
  redirect(tab ? `/teacher/practice-sets?area=${encodeURIComponent(tab)}` : "/teacher/practice-sets");
}
