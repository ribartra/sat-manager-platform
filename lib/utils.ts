import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { difficultyChipClass } from "@/lib/domain-meta";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Durations for totals and averages, in words: 65 → "1 min 5 s", 18760 → "5 h 13 min". */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return m > 0 ? `${h} h ${m} min` : `${h} h`;
  if (m > 0) return s > 0 ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Time of day, "3:42 PM". */
export function formatClock(date: Date | string): string {
  return new Date(date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export function scorePercent(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}

export function difficultyColor(difficulty: string): string {
  return difficultyChipClass(difficulty);
}

export function statusColor(status: string): string {
  switch (status) {
    case "PENDING": return "text-blue-600 bg-blue-50";
    case "IN_PROGRESS": return "text-yellow-600 bg-yellow-50";
    case "COMPLETED": return "text-green-600 bg-green-50";
    case "OVERDUE": return "text-red-600 bg-red-50";
    default: return "text-gray-600 bg-gray-50";
  }
}

/** Today's date in the browser's time zone as YYYY-MM-DD (value for <input type="date">). */
export function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** Relative day in plain words: "today", "tomorrow", "in 3 days", "2 weeks ago", "3 months ago". */
export function relativeDay(date: Date | string, now: Date = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((day(new Date(date)) - day(now)) / 86_400_000);
  if (diff === 0) return "today";
  if (diff === 1) return "tomorrow";
  if (diff === -1) return "yesterday";
  const n = Math.abs(diff);
  const text = n < 14 ? `${n} days` : n < 60 ? `${Math.round(n / 7)} weeks` : `${Math.round(n / 30)} months`;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}
