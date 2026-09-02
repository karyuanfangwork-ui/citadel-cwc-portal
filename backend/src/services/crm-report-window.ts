/** All Asia/Kuala_Lumpur day arithmetic for CRM reports. */
export const REPORT_TIMEZONE = 'Asia/Kuala_Lumpur';
export const REPORT_UTC_OFFSET = '+08:00';
export const MAX_REPORT_DAYS = 366;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function assertDay(value: string): string {
  if (!DAY_PATTERN.test(value)) throw new Error(`Expected a YYYY-MM-DD date, received "${value}"`);
  const parsed = new Date(`${value}T00:00:00.000${REPORT_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime()) || dateKey(parsed) !== value) {
    throw new Error(`Expected a valid YYYY-MM-DD date, received "${value}"`);
  }
  return value;
}

export function dateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dayStart(day: string): Date {
  return new Date(`${assertDay(day)}T00:00:00.000${REPORT_UTC_OFFSET}`);
}
function dayEnd(day: string): Date {
  return new Date(`${assertDay(day)}T23:59:59.999${REPORT_UTC_OFFSET}`);
}
function assertRange(fromDay: string, toDay: string): number {
  const from = dayStart(fromDay);
  const to = dayStart(toDay);
  if (from > to) throw new Error('from must not be after to');
  const days = Math.round((to.getTime() - from.getTime()) / MS_PER_DAY) + 1;
  if (days > MAX_REPORT_DAYS) throw new Error(`Range exceeds ${MAX_REPORT_DAYS} days`);
  return days;
}
export function dayWindow(fromDay: string, toDay: string): { from: Date; to: Date } {
  assertRange(fromDay, toDay);
  return { from: dayStart(fromDay), to: dayEnd(toDay) };
}
export function dateKeys(fromDay: string, toDay: string): string[] {
  const days = assertRange(fromDay, toDay);
  const start = dayStart(fromDay);
  return Array.from({ length: days }, (_, index) => dateKey(new Date(start.getTime() + index * MS_PER_DAY)));
}
export function normalizeDayInput(value: string | undefined, fallback: Date): string {
  if (value) return assertDay(value);
  return dateKey(fallback);
}
