/**
 * Contract-related utility functions and constants.
 *
 * Used by ClientOverviewSheet to format contract values and render
 * share type badges with appropriate colors.
 */

// ---------------------------------------------------------------------------
// Contract status
// ---------------------------------------------------------------------------

export type ContractStatus = "active" | "expired" | "future" | "unknown";

/**
 * Determines a contract's status relative to the given reference date.
 *
 * @param dateStart - Contract start date (YYYY-MM-DD) or null
 * @param dateEnd - Contract end date (YYYY-MM-DD) or null
 * @param todayDate - Reference date (YYYY-MM-DD). Defaults to system date for UI contexts.
 * @returns "active" | "expired" | "future" | "unknown"
 */
export function getContractStatus(
  dateStart: string | null,
  dateEnd: string | null,
  todayDate?: string,
): ContractStatus {
  const today = todayDate ?? new Date().toISOString().slice(0, 10);
  if (!dateStart) return "unknown";
  if (dateStart > today) return "future";
  if (dateEnd && dateEnd < today) return "expired";
  return "active";
}

/**
 * Share/contract type badge color mapping.
 * Each type has background, text, and border colors in hex format.
 */
export const SHARE_TYPE_STYLES: Record<
  string,
  { bg: string; text: string; border: string }
> = {
  RS: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  "R/S": { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  CPM: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  MCPM: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  HYBRID: { bg: "#f0fdf4", text: "#16a34a", border: "#bbf7d0" },
  CPC: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
};

/**
 * Formats contract value based on contract type.
 *
 * - RS / R/S / HYBRID: percentage (e.g. "60%")
 * - CPM / MCPM / CPC: KRW amount with comma separator (e.g. "1,500원")
 * - Unknown types: raw number with comma separator
 *
 * @param type - Contract type (RS, CPM, etc.), case-insensitive
 * @param value - Contract value (percentage or KRW amount)
 * @returns Formatted string with appropriate unit
 */
export function formatContractValue(
  type: string | null,
  value: number,
): string {
  if (!type) return value.toLocaleString();

  const upperType = type.toUpperCase();

  switch (upperType) {
    case "RS":
    case "R/S":
    case "HYBRID":
      return `${value}%`;
    case "CPM":
    case "MCPM":
    case "CPC":
      return `${value.toLocaleString()}원`;
    default:
      return value.toLocaleString();
  }
}

/**
 * Formats date range for contract period display.
 *
 * @param startDate - Start date (YYYY-MM-DD) or null
 * @param endDate - End date (YYYY-MM-DD) or null
 * @returns Formatted date range string (e.g. "2024-01-01 ~ 2024-12-31")
 */
export function formatContractPeriod(
  startDate: string | null,
  endDate: string | null,
): string {
  if (!startDate && !endDate) return "-";
  if (startDate && endDate) return `${startDate} ~ ${endDate}`;
  if (startDate) return `${startDate} ~`;
  if (endDate) return `~ ${endDate}`;
  return "-";
}
