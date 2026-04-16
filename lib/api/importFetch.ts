/**
 * CSV fetch from Google Sheets — pure HTTP, no DB dependency.
 *
 * Based on _reference/src/shared/api/importService/fetch.ts.
 */

/**
 * Fetches a public Google Sheets CSV export URL and returns the raw CSV text.
 * Normalises the URL to add `output=csv` if not already present.
 *
 * @param url - Google Sheets /pub or /pubhtml URL
 * @returns Raw CSV string
 * @throws Error if the fetch fails or returns HTML instead of CSV
 */
export async function fetchCSVFromGoogleSheets(url: string): Promise<string> {
  // Support two URL formats:
  //  1. Published: /spreadsheets/d/e/PUBLISHED_ID/pub[html]  → append output=csv
  //  2. Regular:   /spreadsheets/d/SHEET_ID/edit             → use /export?format=csv
  const publishedIdMatch = url.match(/\/spreadsheets\/d\/e\/([a-zA-Z0-9_-]+)/);
  const regularIdMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = url.match(/[?&]gid=(\d+)/);

  if (!publishedIdMatch && !regularIdMatch) {
    throw new Error(
      "Google Sheets URL 형식이 올바르지 않습니다. spreadsheet ID를 찾을 수 없습니다."
    );
  }

  const gid = gidMatch ? gidMatch[1] : "0";

  let csvUrl: string;
  if (publishedIdMatch) {
    // Published URL: replace /pubhtml → /pub, add output=csv
    csvUrl = url.replace("/pubhtml", "/pub");
    if (!csvUrl.includes("output=csv")) {
      csvUrl += csvUrl.includes("?") ? "&output=csv" : "?output=csv";
    }
    // Only append gid= if the original URL explicitly contained one.
    // Do NOT default to gid=0 — Google returns 400 when gid doesn't match an actual tab.
    if (!csvUrl.includes("gid=") && gidMatch) {
      csvUrl += `&gid=${gid}`;
    }
  } else {
    // Regular sheet URL: build /export URL
    // Requires the sheet to be at least "Anyone with the link can view".
    const sheetId = regularIdMatch![1];
    csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
  }

  const response = await fetch(csvUrl, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`CSV 파일을 찾을 수 없습니다 (404). URL을 확인해주세요.`);
    }
    throw new Error(`HTTP 오류: ${response.status} - ${response.statusText}`);
  }

  const csvText = await response.text();

  if (!csvText || csvText.trim().length === 0) {
    throw new Error("CSV 데이터가 비어있습니다.");
  }
  if (
    csvText.trim().startsWith("<!DOCTYPE") ||
    csvText.trim().startsWith("<html")
  ) {
    throw new Error(
      "CSV 대신 HTML이 반환되었습니다. Google Sheets가 공개 설정되어 있는지 확인해주세요."
    );
  }

  return csvText;
}
