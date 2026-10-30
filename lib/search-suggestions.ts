// Values offered while typing in an entity list's search (LiveSearch): taken from the whole list the
// viewer can see (not the filtered rows), so the suggestions don't shrink as the search narrows.
import prisma from "@/lib/prisma";
import type { Prisma } from "@/app/generated/prisma/client";

const MAX = 500;

/** Distinct, non-empty values, A–Z. */
export function suggestionValues(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => v?.trim()).filter((v): v is string => Boolean(v)))].sort((a, b) => a.localeCompare(b)).slice(0, MAX);
}

/** Names and emails of the people matching `where` (students in scope, teachers, users…). */
export async function personSuggestions(where: Prisma.UserWhereInput): Promise<string[]> {
  const people = await prisma.user.findMany({ where, select: { name: true, email: true }, take: MAX });
  return suggestionValues(people.flatMap((p) => [p.name, p.email]));
}
