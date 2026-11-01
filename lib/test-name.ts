/**
 * Default name of a Full Practice Test: its source and number, "Innovator Test 1" (meeting with
 * Soledad, T01). The catalogue still groups the versions of a number in "TEST N" accordions.
 */
export function defaultTestName(sourceName: string | null | undefined, number: number | string | null | undefined): string {
  const n = number === null || number === undefined || number === "" ? "" : String(number);
  if (!n) return "";
  return sourceName ? `${sourceName} Test ${n}` : `TEST ${n}`;
}

/** "TEST 1 · Innovator", or just the name when it already says the source ("Innovator Test 1"). */
export function nameWithSource(name: string, sourceName: string | null | undefined): string {
  return !sourceName || name.includes(sourceName) ? name : `${name} · ${sourceName}`;
}
