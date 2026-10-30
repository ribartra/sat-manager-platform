// The one teacher History view (every practice and Test try) is driven by its URL:
//   /teacher/history?student=<id>&type=practice|tests&area=math|reading|writing&skill=<topicId>
//                   &difficulty=EASY|MEDIUM|HARD&set=<practiceSetId>&test=<testId>
//                   &status=completed|progress|invalidated|all&period=…&from=…&to=…&q=…&page=…
// The filter bar sends type and area as one select, `what` (read here as type + area). No status =
// Completed (the counted tries, like the Question Bank's Published); `status=all` = every try.
// Links from a student, an attempt or a set carry their context so the list opens filtered. Parsing
// is tolerant: unknown or empty values are dropped. `skill`, `difficulty`, `set` and `area` mean
// practice; `test` means Tests.

export type HistoryType = "practice" | "tests";
export type HistoryArea = "math" | "reading" | "writing";
export type HistoryStatus = "completed" | "progress" | "invalidated" | "all";

/** The status the History shows when the URL has none. */
export const HISTORY_STATUS_DEFAULT = "completed";

export interface HistoryParams {
  student?: string;
  type?: HistoryType;
  area?: HistoryArea;
  skill?: string;
  difficulty?: string;
  set?: string;
  test?: string;
  status?: HistoryStatus;
  q?: string;
}

type RawParams = Record<string, string | string[] | undefined | null>;

const ID = /^[A-Za-z0-9_:-]{1,64}$/;
const first = (value: string | string[] | undefined | null) => (Array.isArray(value) ? value[0] : value) ?? undefined;
const id = (value: string | string[] | undefined | null) => {
  const v = first(value)?.trim();
  return v && ID.test(v) ? v : undefined;
};

export function parseHistoryParams(raw: RawParams): HistoryParams {
  // The filter bar sends type + area as one select (`what`: tests | practice | math | reading | writing).
  const what = first(raw.what);
  if (what) raw = { ...raw, type: what === "tests" || what === "practice" ? what : "practice", area: what === "tests" || what === "practice" ? undefined : what };
  const areaRaw = first(raw.area);
  const area = areaRaw === "math" || areaRaw === "reading" || areaRaw === "writing" ? areaRaw : areaRaw === "rw" ? "reading" : undefined;
  const difficultyRaw = first(raw.difficulty)?.toUpperCase();
  const difficulty = difficultyRaw && ["EASY", "MEDIUM", "HARD"].includes(difficultyRaw) ? difficultyRaw : undefined;
  const statusRaw = first(raw.status);
  const status = statusRaw === "completed" || statusRaw === "progress" || statusRaw === "invalidated" || statusRaw === "all" ? statusRaw : undefined;
  const skill = id(raw.skill ?? raw.topic);
  const set = id(raw.set);
  const test = id(raw.test);
  const typeRaw = first(raw.type);
  // Practice context wins over a stale type; a Test means the Tests list.
  const type: HistoryType | undefined = test ? "tests" : area || skill || difficulty || set ? "practice" : typeRaw === "tests" || typeRaw === "practice" ? typeRaw : undefined;
  const q = first(raw.q)?.trim().slice(0, 100) || undefined;
  return {
    student: id(raw.student),
    type,
    area: type === "tests" ? undefined : area,
    skill: type === "tests" ? undefined : skill,
    difficulty: type === "tests" ? undefined : difficulty,
    set: type === "tests" ? undefined : set,
    test: type === "practice" ? undefined : test,
    status,
    q,
  };
}

/** URL of the History view with these filters (plus any extra params, e.g. the period). */
export function historyHref(params: HistoryParams, extra: Record<string, string | undefined> = {}): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...params, ...extra })) {
    if (value) query.set(key, value);
  }
  const qs = query.toString();
  return qs ? `/teacher/history?${qs}` : "/teacher/history";
}
