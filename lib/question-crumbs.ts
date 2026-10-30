import { practiceAreaFromTab, practiceAreaLabel } from "@/lib/practice-area";

/**
 * Breadcrumb of the Question Bank pages on an area: Home › Practice · <area> (or Tests) › Questions.
 * `questionsHref` is the Question Bank on that area (Save of the editor goes back there).
 */
export function questionCrumbs(area: string) {
  const isTests = area === "tests";
  const questionsHref = `/teacher/questions?area=${area}`;
  return {
    questionsHref,
    items: [
      { label: "Home", href: "/teacher" },
      isTests
        ? { label: "Tests", href: "/teacher/tests" }
        : { label: `Practice · ${practiceAreaLabel(practiceAreaFromTab(area as "math" | "reading" | "writing"))}`, href: `/teacher/practice-sets?area=${area}` },
      { label: "Questions", href: questionsHref },
    ],
  };
}
