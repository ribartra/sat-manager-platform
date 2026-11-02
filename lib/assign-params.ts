// The one Assign view (practice sets and Tests) is driven by its URL:
//   /teacher/students/<studentId>/assign?area=<math|reading|writing|tests>&…   (student chosen)
//   /teacher/assign?area=…&…                                                   (student still to choose)
// Params: `set` (practice set ids to preselect, comma list), `test` (Test to preselect), `topic`
// (skill to open), `difficulty`, `source`, `edit` (already-assigned sets whose dates / settings are
// edited). Older links: `sets=` = `edit`; `assign-test?test=` = area tests. Parsing is tolerant:
// unknown or empty values are dropped and a missing / unknown area falls back to math.
import { activeAreaTab } from "@/lib/practice-area";

export type AssignArea = "math" | "reading" | "writing" | "tests";

export interface AssignParams {
  area: AssignArea;
  set: string[];
  test?: string;
  topic?: string;
  difficulty?: string;
  source?: string;
  edit: string[];
}

type RawParams = Record<string, string | string[] | undefined | null>;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
/** An `edit` entry: the set id, optionally with the assignment's context ("<set>:CLASSROOM"). */
const EDIT_REF = /^[A-Za-z0-9_-]{1,64}(:(CLASSROOM|HOMEWORK))?$/;
const first = (value: string | string[] | undefined | null) => (Array.isArray(value) ? value[0] : value) ?? undefined;
const ids = (...values: Array<string | string[] | undefined | null>) => [
  ...new Set(
    values
      .flatMap((value) => (Array.isArray(value) ? value : [value ?? ""]))
      .flatMap((value) => value.split(","))
      .map((value) => value.trim())
      .filter((value) => ID.test(value)),
  ),
];
const oneId = (value: string | string[] | undefined | null) => ids(first(value))[0];

export function parseAssignParams(raw: RawParams): AssignParams {
  const test = oneId(raw.test);
  const areaRaw = first(raw.area);
  // A Test to preselect means the Tests area, whatever the link said.
  const tab = test ? "tests" : activeAreaTab(areaRaw, "math");
  const area: AssignArea = tab === "reading" || tab === "writing" || tab === "tests" ? tab : "math";
  const difficulty = first(raw.difficulty)?.toUpperCase();
  return {
    area,
    set: ids(raw.set),
    test,
    topic: oneId(raw.topic),
    difficulty: difficulty && ["EASY", "MEDIUM", "HARD"].includes(difficulty) ? difficulty : undefined,
    source: oneId(raw.source),
    edit: [...new Set([raw.edit, raw.sets].flatMap((v) => (Array.isArray(v) ? v : [v ?? ""])).flatMap((v) => v.split(",")).map((v) => v.trim()).filter((v) => EDIT_REF.test(v)))],
  };
}

/** URL of the Assign view; without `studentId` the teacher picks the student there first. */
export function assignHref(params: Partial<AssignParams> & { studentId?: string | null }): string {
  const query = new URLSearchParams();
  const area = params.test ? "tests" : params.area ?? "math";
  query.set("area", area);
  if (params.set?.length) query.set("set", params.set.join(","));
  if (params.test) query.set("test", params.test);
  if (params.topic) query.set("topic", params.topic);
  if (params.difficulty) query.set("difficulty", params.difficulty);
  if (params.source) query.set("source", params.source);
  if (params.edit?.length) query.set("edit", params.edit.join(","));
  const path = params.studentId ? `/teacher/students/${encodeURIComponent(params.studentId)}/assign` : "/teacher/assign";
  return `${path}?${query.toString()}`;
}

/** The query string of these params (to carry them when switching student). */
export function assignQuery(params: Partial<AssignParams>): string {
  return assignHref(params).split("?")[1] ?? "";
}
