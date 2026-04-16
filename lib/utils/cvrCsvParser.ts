/**
 * CVR CSV parser.
 *
 * Parses the Google Sheets CVR export CSV into typed row objects
 * ready for upsert into media.cvr.
 *
 * Column mapping (CSV header → DB column):
 *   date                          → date          (YYYY-MM-DD, stored as-is)
 *   client_id                     → client_id     (TEXT)
 *   client_name                   → client_name
 *   service_id                    → service_id    (TEXT)
 *   service_name                  → service_name
 *   service_type                  → service_type
 *   revenue                       → revenue       (BIGINT)
 *   vimp                          → vimp          (BIGINT)
 *   rpm                           → rpm           (INTEGER)
 *   vctr_pct                      → vctr_pct      (NUMERIC, raw decimal)
 *   cpc                           → cpc           (INTEGER)
 *   click                         → click         (BIGINT)
 *   campaign_count                → campaign_count (INTEGER)
 *   normalized_cvr_pct            → normalized_cvr_pct      (NUMERIC, raw decimal)
 *   invalid_revenue_ratio_pct     → invalid_revenue_ratio_pct (NUMERIC, raw decimal)
 *   contribution_margin_rate_pct  → contribution_margin_rate_pct (NUMERIC, raw decimal)
 *
 * Excluded from DB (보조지표):
 *   normalized_ctr_pct, normalized_vctr_pct, server_fee_rate_pct,
 *   media_fee, media_fee_rate_pct, rms, contribution_margin
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed row ready to be inserted into media.cvr (before calcLevel). */
export interface CvrParsedRow {
  date: string;
  client_id: string;
  client_name: string | null;
  service_id: string;
  service_name: string | null;
  service_type: string | null;
  revenue: number | null;
  vimp: number | null;
  rpm: number | null;
  vctr_pct: number | null;
  cpc: number | null;
  click: number | null;
  campaign_count: number | null;
  normalized_cvr_pct: number | null;
  invalid_revenue_ratio_pct: number | null;
  contribution_margin_rate_pct: number | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseStr(v: string): string | null {
  const s = v.trim();
  return s === "" ? null : s;
}

function parseInt_(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const n = parseInt(s.replace(/,/g, ""), 10);
  return isNaN(n) ? null : n;
}

function parseBigInt(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) ? null : Math.round(n);
}

function parseFloat_(v: string): number | null {
  const s = v.trim();
  if (s === "") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// ---------------------------------------------------------------------------
// parseCvrCSV
// ---------------------------------------------------------------------------

/**
 * Parses a raw CVR CSV string into an array of typed row objects.
 * Skips the header row and any row missing date, client_id, or service_id.
 *
 * @param csvText - Raw CSV string from Google Sheets
 * @returns Array of parsed CVR rows
 */
export function parseCvrCSV(csvText: string): CvrParsedRow[] {
  const lines = csvText.trim().split("\n");
  if (lines.length < 2) return [];

  // Parse header to build column index map
  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const idx = (name: string): number => headers.indexOf(name);

  const iDate       = idx("date");
  const iClient     = idx("client_id");
  const iClientName = idx("client_name");
  const iService    = idx("service_id");
  const iSvcName    = idx("service_name");
  const iSvcType = idx("service_type");
  const iRevenue = idx("revenue");
  const iVimp    = idx("vimp");
  const iRpm     = idx("rpm");
  const iVctr    = idx("vctr_pct");
  const iCpc     = idx("cpc");
  const iClick   = idx("click");
  const iCamp    = idx("campaign_count");
  const iCvr     = idx("normalized_cvr_pct");
  const iInvalid = idx("invalid_revenue_ratio_pct");
  const iCmr     = idx("contribution_margin_rate_pct");

  const rows: CvrParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(",");

    const date      = iDate    >= 0 ? cols[iDate]?.trim().replace(/^"|"$/g, "") ?? "" : "";
    const client_id = iClient  >= 0 ? cols[iClient]?.trim().replace(/^"|"$/g, "") ?? "" : "";
    const service_id = iService >= 0 ? cols[iService]?.trim().replace(/^"|"$/g, "") ?? "" : "";

    // Skip rows missing primary key fields
    if (!date || !client_id || !service_id) continue;

    rows.push({
      date,
      client_id: String(client_id),
      client_name:                  iClientName >= 0 ? parseStr(cols[iClientName] ?? "") : null,
      service_id: String(service_id),
      service_name:                 iSvcName >= 0 ? parseStr(cols[iSvcName] ?? "")   : null,
      service_type:                 iSvcType >= 0 ? parseStr(cols[iSvcType] ?? "")   : null,
      revenue:                      iRevenue >= 0 ? parseBigInt(cols[iRevenue] ?? "") : null,
      vimp:                         iVimp    >= 0 ? parseBigInt(cols[iVimp] ?? "")    : null,
      rpm:                          iRpm     >= 0 ? parseInt_(cols[iRpm] ?? "")       : null,
      vctr_pct:                     iVctr    >= 0 ? parseFloat_(cols[iVctr] ?? "")   : null,
      cpc:                          iCpc     >= 0 ? parseInt_(cols[iCpc] ?? "")       : null,
      click:                        iClick   >= 0 ? parseBigInt(cols[iClick] ?? "")  : null,
      campaign_count:               iCamp    >= 0 ? parseInt_(cols[iCamp] ?? "")     : null,
      normalized_cvr_pct:           iCvr     >= 0 ? parseFloat_(cols[iCvr] ?? "")   : null,
      invalid_revenue_ratio_pct:    iInvalid >= 0 ? parseFloat_(cols[iInvalid] ?? "") : null,
      contribution_margin_rate_pct: iCmr     >= 0 ? parseFloat_(cols[iCmr] ?? "")   : null,
    });
  }

  return rows;
}
