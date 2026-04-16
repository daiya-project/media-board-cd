/**
 * CSV-related utilities — 현재는 날짜 정규화만 사용.
 *
 * 과거에는 Google Sheets CSV 파싱(parseCSV) 도 함께 제공했으나
 * Redash 직접 호출 경로로 통일되며 제거됨. 자세한 이력:
 * docs/superpowers/specs/2026-04-16-daily-redash-import-design.md
 */

/**
 * 다양한 형식의 날짜 문자열을 YYYY-MM-DD 로 정규화.
 * 지원: YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD, Date-parseable 문자열.
 * 실패 시 null.
 */
export function normalizeDate(dateStr: string | null): string | null {
  if (!dateStr) return null;

  const cleaned = dateStr.trim();

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) return cleaned;
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) return cleaned.replace(/\//g, "-");
  if (/^\d{4}\.\d{2}\.\d{2}$/.test(cleaned)) return cleaned.replace(/\./g, "-");

  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return null;
}
