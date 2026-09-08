export function calendarDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '2100-12-31') return fallback;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value ? value : fallback;
}
export function monthDays(day: string): (string | null)[] {
  const start = new Date(`${day.slice(0, 7)}-01T12:00:00Z`);
  const count = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array((start.getUTCDay() + 6) % 7).fill(null), ...Array.from({length: count}, (_, i) => `${day.slice(0, 7)}-${String(i + 1).padStart(2, '0')}`)];
}
