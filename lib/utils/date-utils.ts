/**
 * Pure date utility functions.
 * Usable in both server and client contexts (no Next.js / Supabase dependencies).
 */

/**
 * Returns true if the given date is a weekday (Mon–Fri) and not a holiday.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param holidays - Set of holiday date strings (YYYY-MM-DD)
 */
export function isWeekday(dateStr: string, holidays: Set<string>): boolean {
  if (holidays.has(dateStr)) return false;
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day !== 0 && day !== 6;
}

/**
 * Returns true if the given date is a weekend (Sat/Sun) or a public holiday.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param holidays - Set of holiday date strings (YYYY-MM-DD)
 */
export function isHolidayOrWeekend(
  dateStr: string,
  holidays: Set<string>,
): boolean {
  if (holidays.has(dateStr)) return true;
  const day = new Date(dateStr + "T00:00:00").getDay();
  return day === 0 || day === 6;
}

/**
 * Extracts the year-month portion from a full date string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Year-month string in YYYY-MM format
 * @example toYearMonth("2026-02-27") // → "2026-02"
 */
export function toYearMonth(dateStr: string): string {
  return dateStr.slice(0, 7);
}

/**
 * Formats a date string as "MM. DD." for display in table column headers.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @returns Formatted string in "MM. DD." format
 * @example formatDateHeader("2026-02-27") // → "02. 27."
 */
export function formatDateHeader(dateStr: string): string {
  return dateStr.slice(5).replace("-", ". ") + "."; // "YYYY-MM-DD" → "MM. DD."
}

/** Day type used for color-coding date columns in tables. */
export type DayType = "weekday" | "saturday" | "sunday_or_holiday";

/**
 * Returns the day type for color-coding table date columns.
 * Saturday check takes priority over the holidays set to ensure
 * Saturdays are always shown in blue, not red.
 *
 * @param dateStr  - Date string in YYYY-MM-DD format
 * @param holidays - Set containing public holidays AND weekends from DB
 */
export function getDayType(dateStr: string, holidays: Set<string>): DayType {
  const day = new Date(dateStr + "T00:00:00").getDay();
  if (day === 6) return "saturday";
  if (day === 0 || holidays.has(dateStr)) return "sunday_or_holiday";
  return "weekday";
}

/**
 * Parses a YYYY-MM string into [year, month] tuple.
 *
 * @param yearMonth - String in YYYY-MM format
 * @returns Tuple of [year, month] as numbers (month is 1-indexed)
 * @example parseYearMonth("2026-03") // → [2026, 3]
 */
export function parseYearMonth(yearMonth: string): [number, number] {
  const [y, m] = yearMonth.split("-").map(Number);
  return [y, m];
}

/**
 * Adds or subtracts months from a YYYY-MM string.
 * Handles year boundaries correctly.
 *
 * @param yearMonth - String in YYYY-MM format
 * @param offset - Number of months to add (positive) or subtract (negative)
 * @returns New YYYY-MM string
 * @example addMonths("2026-01", -2) // → "2025-11"
 */
export function addMonths(yearMonth: string, offset: number): string {
  const [y, m] = parseYearMonth(yearMonth);
  const d = new Date(y, m - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the number of days in the given month.
 *
 * @param year - Full year (e.g., 2026)
 * @param month - Month number 1-12
 * @returns Number of days in the month
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Returns the last day of a month as YYYY-MM-DD.
 *
 * @param yearMonth - String in YYYY-MM format
 * @returns Last day date string in YYYY-MM-DD format
 * @example getLastDayOfMonth("2026-02") // → "2026-02-28"
 */
export function getLastDayOfMonth(yearMonth: string): string {
  const [y, m] = parseYearMonth(yearMonth);
  const lastDay = getDaysInMonth(y, m);
  return `${yearMonth}-${String(lastDay).padStart(2, "0")}`;
}

/**
 * Extracts the first word from a full name for display.
 * Follows the project rule: "홍길동 Hong" → "홍길동".
 *
 * @param fullName - Full name string
 * @returns First word of the name
 */
export function getDisplayName(fullName: string): string {
  return fullName.split(" ")[0];
}

/**
 * Returns today's date as a YYYY-MM-DD string (system local time).
 * Use for default form values — NOT for "latest data date" (use dateService instead).
 */
export function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Adds or subtracts days from a YYYY-MM-DD date string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param days - Number of days to add (positive) or subtract (negative)
 * @returns New YYYY-MM-DD string
 * @example addDays("2026-03-01", 1)  // → "2026-03-02"
 * @example addDays("2026-03-01", -1) // → "2026-02-28"
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
