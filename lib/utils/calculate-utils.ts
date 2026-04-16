/**
 * Pure calculation utilities shared across the app.
 * Usable in both server and client contexts (no Next.js / Supabase dependencies).
 */

// ---------------------------------------------------------------------------
// CVR Level
// ---------------------------------------------------------------------------

/** Audience level tier computed from CMR and CVR rate. */
export type CvrLevel = "A" | "B" | "C" | "D" | "E" | "F";

/**
 * Computes the CVR audience level based on CMR and CVR rate.
 *
 * Level matrix:
 *   A — cmr >= 10  AND  cvr >= 100  (CMR good + CVR excellent)
 *   B — cmr >= 10  AND  cvr <  90   (CMR good + CVR insufficient)
 *   C — cmr <  0   AND  cvr >= 100  (CMR negative + CVR excellent)
 *   D — cmr <  0   AND  cvr <  90   (CMR negative + CVR insufficient)
 *   E — 0 <= cmr < 10               (CMR mid-range, catch-all)
 *   F — both null                    (no data)
 *
 * Used at import time to populate media.cvr.level.
 * cmr source : contribution_margin_rate_pct column
 * cvr source : normalized_cvr_pct column
 *
 * @param cmr - Contribution margin rate value from CSV (contribution_margin_rate_pct)
 * @param cvr - Normalized CVR value from CSV (normalized_cvr_pct)
 * @returns One of "A" | "B" | "C" | "D" | "E" | "F"
 */
export function calcLevel(
  cmr: number | null,
  cvr: number | null,
): CvrLevel {
  if (cmr === null && cvr === null) return "F";
  const c = cmr ?? 0;
  const v = cvr ?? 0;
  if (c >= 10 && v >= 100) return "A";
  if (c >= 10 && v < 90) return "B";
  if (c < 0 && v >= 100) return "C";
  if (c < 0 && v < 90) return "D";
  return "E";
}
