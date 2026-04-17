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
function fmtWon(n: number): string {
  if (!Number.isFinite(n)) return "—";
  return formatNumberForDisplay(Math.round(n));
}

// 섹션별 바탕색 (아주 연한 alpha). 요청·응답 은 흰색 유지 → 얼룩말이 그대로 보임.
const BG_BASIC = "bg-slate-50/60";
const BG_REQ_RESP = "";
const BG_RPM_MFR = "bg-amber-50/60";
const BG_DABLE = "bg-blue-50/60";
const BG_PASSBACK = "bg-orange-50/60";
const BG_MARGIN = "bg-emerald-50/60";

// 본문 td 공통 — 텍스트는 검은 계열(text-gray-900), 섹션 bg 만 덮어 사용.
const CELL = cn(TABLE_TD_CLASS, "text-right tabular-nums text-gray-900");

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
      <table className="w-max min-w-full border-collapse text-xs text-gray-900">
        <thead className={TABLE_THEAD_CLASS}>
          {/* group row */}
          <tr className="border-b border-gray-100">
            <th
              colSpan={2}
              className={cn(
                "py-2 px-2 text-center text-[10px] font-semibold text-gray-700",
                BG_BASIC,
              )}
            >
              기본
            </th>
            <th
              colSpan={6}
              className="py-2 px-2 text-center text-[10px] font-semibold text-gray-700 bg-white"
            >
              요청·응답
            </th>
            <th
              colSpan={4}
              className={cn(
                "py-2 px-2 text-center text-[10px] font-semibold text-gray-700",
                BG_RPM_MFR,
              )}
            >
              RPM·MFR
            </th>
            <th
              colSpan={9}
              className={cn(
                "py-2 px-2 text-center text-[10px] font-semibold text-gray-700",
                BG_DABLE,
              )}
            >
              데이블 블록
            </th>
            <th
              colSpan={7}
              className={cn(
                "py-2 px-2 text-center text-[10px] font-semibold text-gray-700",
                BG_PASSBACK,
              )}
            >
              패스백 블록
            </th>
            <th
              colSpan={2}
              className={cn(
                "py-2 px-2 text-center text-[10px] font-semibold text-gray-700",
                BG_MARGIN,
              )}
            >
              공헌이익
            </th>
          </tr>
          {/* header row */}
          <tr className="border-b border-gray-200">
            <th className={cn(TABLE_TH_CLASS, BG_BASIC)}>날짜</th>
            <th className={cn(TABLE_TH_CLASS, BG_BASIC)}>FC</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>요청</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>응답</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>응답률</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>패스백</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>패스백률</th>
            <th className={cn(TABLE_TH_CLASS, BG_REQ_RESP)}>패스백 노출</th>
            <th className={cn(TABLE_TH_CLASS, BG_RPM_MFR)}>RPM</th>
            <th className={cn(TABLE_TH_CLASS, BG_RPM_MFR)}>RPM(OBI)</th>
            <th className={cn(TABLE_TH_CLASS, BG_RPM_MFR)}>전체MFR</th>
            <th className={cn(TABLE_TH_CLASS, BG_RPM_MFR)}>데이블MFR</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>FN매출</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>매체비</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>APC</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>서버비</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>매체매출</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>광고매출</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>CPM</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>공헌이익</th>
            <th className={cn(TABLE_TH_CLASS, BG_DABLE)}>유실분</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>싱크MFR</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>PB FN</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>PB 매체비</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>PB 서버비</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>PB 매체매출</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>PB 광고매출</th>
            <th className={cn(TABLE_TH_CLASS, BG_PASSBACK)}>싱크 공헌</th>
            <th className={cn(TABLE_TH_CLASS, BG_MARGIN)}>전체 공헌</th>
            <th className={cn(TABLE_TH_CLASS, BG_MARGIN)}>전체 RPM</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.date}
              className="border-b border-gray-100 odd:bg-gray-50/50 hover:bg-slate-100/50"
            >
              <td
                className={cn(
                  TABLE_TD_CLASS,
                  "text-center font-mono whitespace-nowrap text-gray-900",
                  BG_BASIC,
                )}
              >
                {r.date}
              </td>
              <td className={cn(CELL, BG_BASIC)}>
                {r.fc_amount != null ? fmtWon(r.fc_amount) : "—"}
              </td>
              <td className={cn(CELL, BG_REQ_RESP)}>{fmt(r.requests)}</td>
              <td className={cn(CELL, BG_REQ_RESP)}>{fmt(r.dable_response)}</td>
              <td className={cn(CELL, BG_REQ_RESP)}>{fmtPct(r.response_rate)}</td>
              <td className={cn(CELL, BG_REQ_RESP)}>
                {fmt(r.passback_requests)}
              </td>
              <td className={cn(CELL, BG_REQ_RESP)}>{fmtPct(r.passback_rate)}</td>
              <td className={cn(CELL, BG_REQ_RESP)}>{fmt(r.vendor_imp)}</td>
              <td className={cn(CELL, BG_RPM_MFR)}>{fmt(r.rpm_dashboard)}</td>
              <td className={cn(CELL, BG_RPM_MFR)}>{fmt(r.rpm_obi)}</td>
              <td className={cn(CELL, BG_RPM_MFR)}>{fmtPct(r.total_mfr)}</td>
              <td className={cn(CELL, BG_RPM_MFR)}>{fmtPct(r.dable_mfr)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_fn_revenue)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_media_cost)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_apc)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_server_cost)}</td>
              <td className={cn(CELL, BG_DABLE)}>
                {fmtWon(r.dable_media_revenue)}
              </td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_ad_revenue)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmt(r.dable_cpm, 1)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmtWon(r.dable_margin)}</td>
              <td className={cn(CELL, BG_DABLE)}>{fmt(r.lost_imp)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtPct(r.vendor_mfr)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtWon(r.pb_fn_revenue)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtWon(r.pb_media_cost)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtWon(r.pb_server_cost)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>
                {fmtWon(r.pb_media_revenue)}
              </td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtWon(r.pb_ad_revenue)}</td>
              <td className={cn(CELL, BG_PASSBACK)}>{fmtWon(r.vendor_margin)}</td>
              <td className={cn(CELL, "font-medium", BG_MARGIN)}>
                {fmtWon(r.contribution_margin)}
              </td>
              <td className={cn(CELL, "font-medium", BG_MARGIN)}>
                {fmt(r.total_rpm_margin, 1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
