"use client";

import { cn } from "@/lib/utils";
import { formatNumberForDisplay } from "@/lib/utils/number-utils";
import {
  TABLE_THEAD_CLASS,
  TABLE_TH_CLASS,
  TABLE_TD_CLASS,
  EMPTY_STATE_CLASS,
} from "@/lib/utils/table-display-utils";
import type { ExternalFcRow } from "@/types/fc";

function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return "—";
  return formatNumberForDisplay(
    Math.round(n * Math.pow(10, digits)) / Math.pow(10, digits),
  );
}
function fmtPct(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtKrw(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return `₩${formatNumberForDisplay(Math.round(n))}`;
}

interface Props {
  rows: ExternalFcRow[];
}

export default function FcTable({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className={EMPTY_STATE_CLASS} style={{ height: 160 }}>
        데이터가 없습니다
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto rounded-xl border border-border shadow-sm">
      <table className="w-max min-w-full border-collapse text-xs">
        <thead className={TABLE_THEAD_CLASS}>
          {/* group row */}
          <tr className="border-b border-gray-100">
            <th
              colSpan={2}
              className="py-2 px-2 text-center text-[10px] font-semibold text-gray-500"
            >
              기본
            </th>
            <th
              colSpan={6}
              className="py-2 px-2 text-center text-[10px] font-semibold bg-sky-50 text-sky-700"
            >
              요청·응답
            </th>
            <th
              colSpan={4}
              className="py-2 px-2 text-center text-[10px] font-semibold bg-amber-50 text-amber-700"
            >
              RPM·MFR
            </th>
            <th
              colSpan={9}
              className="py-2 px-2 text-center text-[10px] font-semibold bg-blue-50 text-blue-700"
            >
              데이블 블록
            </th>
            <th
              colSpan={7}
              className="py-2 px-2 text-center text-[10px] font-semibold bg-orange-50 text-orange-700"
            >
              패스백 블록
            </th>
            <th
              colSpan={2}
              className="py-2 px-2 text-center text-[10px] font-semibold bg-green-50 text-green-700"
            >
              공헌이익
            </th>
          </tr>
          {/* header row */}
          <tr className="border-b border-gray-200">
            <th className={TABLE_TH_CLASS}>날짜</th>
            <th className={TABLE_TH_CLASS}>FC</th>
            <th className={TABLE_TH_CLASS}>요청</th>
            <th className={TABLE_TH_CLASS}>응답</th>
            <th className={TABLE_TH_CLASS}>응답률</th>
            <th className={TABLE_TH_CLASS}>패스백</th>
            <th className={TABLE_TH_CLASS}>패스백률</th>
            <th className={TABLE_TH_CLASS}>싱크노출</th>
            <th className={TABLE_TH_CLASS}>RPM</th>
            <th className={TABLE_TH_CLASS}>RPM(OBI)</th>
            <th className={TABLE_TH_CLASS}>전체MFR</th>
            <th className={TABLE_TH_CLASS}>데이블MFR</th>
            <th className={TABLE_TH_CLASS}>FN매출</th>
            <th className={TABLE_TH_CLASS}>매체비</th>
            <th className={TABLE_TH_CLASS}>APC</th>
            <th className={TABLE_TH_CLASS}>서버비</th>
            <th className={TABLE_TH_CLASS}>매체매출</th>
            <th className={TABLE_TH_CLASS}>광고매출</th>
            <th className={TABLE_TH_CLASS}>CPM</th>
            <th className={TABLE_TH_CLASS}>공헌이익</th>
            <th className={TABLE_TH_CLASS}>유실분</th>
            <th className={TABLE_TH_CLASS}>싱크MFR</th>
            <th className={TABLE_TH_CLASS}>PB FN</th>
            <th className={TABLE_TH_CLASS}>PB 매체비</th>
            <th className={TABLE_TH_CLASS}>PB 서버비</th>
            <th className={TABLE_TH_CLASS}>PB 매체매출</th>
            <th className={TABLE_TH_CLASS}>PB 광고매출</th>
            <th className={TABLE_TH_CLASS}>싱크 공헌</th>
            <th className={TABLE_TH_CLASS}>전체 공헌</th>
            <th className={TABLE_TH_CLASS}>전체 RPM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.date}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-center font-mono whitespace-nowrap",
                )}
              >
                {r.date}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {r.fc_amount != null ? fmtKrw(r.fc_amount) : "—"}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.requests)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.dable_response)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmtPct(r.response_rate)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.passback_requests)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmtPct(r.passback_rate)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.vendor_imp)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.rpm_dashboard)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.rpm_obi)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmtPct(r.total_mfr)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtPct(r.dable_mfr)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_fn_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_media_cost)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_apc)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_server_cost)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_media_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_ad_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmt(r.dable_cpm, 1)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-blue-700",
                )}
              >
                {fmtKrw(r.dable_margin)}
              </td>
              <td className={cn(TABLE_TD_CLASS, "text-right tabular-nums")}>
                {fmt(r.lost_imp)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtPct(r.vendor_mfr)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.pb_fn_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.pb_media_cost)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.pb_server_cost)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.pb_media_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.pb_ad_revenue)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums text-orange-700",
                )}
              >
                {fmtKrw(r.vendor_margin)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums font-medium text-green-700",
                )}
              >
                {fmtKrw(r.contribution_margin)}
              </td>
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-right tabular-nums font-medium text-green-700",
                )}
              >
                {fmt(r.total_rpm_margin, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
