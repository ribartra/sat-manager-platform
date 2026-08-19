/** Practice / accuracy traffic light: <60 red, 60–79 yellow, ≥80 green. */

export type ScoreBand = "low" | "mid" | "high";

export function scoreBand(pct: number | null | undefined): ScoreBand | null {
  if (pct === null || pct === undefined || Number.isNaN(pct)) return null;
  if (pct >= 80) return "high";
  if (pct >= 60) return "mid";
  return "low";
}

export function scoreBandTextClass(pct: number | null | undefined): string {
  const band = scoreBand(pct);
  if (band === "high") return "text-green-600";
  if (band === "mid") return "text-yellow-600";
  if (band === "low") return "text-red-500";
  return "text-gray-900";
}

export function scoreBandBarClass(pct: number | null | undefined): string {
  const band = scoreBand(pct);
  if (band === "high") return "bg-green-400";
  if (band === "mid") return "bg-yellow-400";
  if (band === "low") return "bg-red-400";
  return "bg-gray-300";
}
