import { auth } from "@/lib/auth";
import { contentScopeFor } from "@/lib/program-scope";

/**
 * Bank scope of the signed-in viewer for server pages: the content of the programs they teach
 * (shared by the program's teachers); ADMIN sees every program. No session → nothing matches.
 */
export async function currentContentScope() {
  const session = await auth();
  if (!session) return { id: "__no_session__" };
  return contentScopeFor(session.user);
}
