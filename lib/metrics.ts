import type { ActivityDay, RangeKey } from "./types";

export function getRangeStart(range: RangeKey, now = new Date()): Date {
  const start = new Date(now);
  if (range === "30d") start.setDate(start.getDate() - 29);
  else if (range === "90d") start.setDate(start.getDate() - 89);
  else start.setDate(start.getDate() - 364);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

export function countActiveDays(days: ActivityDay[]): number {
  return days.filter((day) => day.count > 0).length;
}

export function getLongestStreak(days: ActivityDay[]): number {
  let longest = 0;
  let current = 0;
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  for (const day of sorted) {
    if (day.count > 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }
  return longest;
}

export function getCurrentStreak(days: ActivityDay[], now = new Date()): number {
  const lookup = new Map(days.map((day) => [day.date, day.count]));
  const cursor = new Date(now);
  cursor.setUTCHours(0, 0, 0, 0);
  const today = cursor.toISOString().slice(0, 10);
  if ((lookup.get(today) ?? 0) === 0) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if ((lookup.get(key) ?? 0) <= 0) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (streak > 366) break;
  }
  return streak;
}

export function toMonthlyActivity(days: ActivityDay[]): Array<{ label: string; total: number }> {
  const months = new Map<string, number>();
  for (const day of days) {
    const key = day.date.slice(0, 7);
    months.set(key, (months.get(key) ?? 0) + day.count);
  }
  return [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([key, total]) => ({
    label: new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en", { month: "short" }),
    total
  }));
}

export function totalActivity(days: ActivityDay[]): number {
  return days.reduce((sum, day) => sum + day.count, 0);
}

export function colorForCount(count: number, max: number): string {
  if (count <= 0) return "var(--heat-0)";
  const ratio = max > 0 ? count / max : 0;
  if (ratio < 0.2) return "var(--heat-1)";
  if (ratio < 0.45) return "var(--heat-2)";
  if (ratio < 0.72) return "var(--heat-3)";
  return "var(--heat-4)";
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}
