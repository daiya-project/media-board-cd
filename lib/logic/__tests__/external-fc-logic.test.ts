import { describe, it, expect } from "vitest";
import { deriveFcRow, deriveFcRows } from "../external-fc-logic";
import { DEFAULT_FC_CONSTANTS } from "../external-fc-defaults";
import type { ExternalFcAutoInputs } from "@/types/fc";
import type { ExternalValueRow } from "@/types/external";

// widget V7a1pGx7 2026-04-15 검증 케이스 (spec §4 표)
const AUTO_20260415: ExternalFcAutoInputs = {
  date: "2026-04-15",
  requests: 100729,
  passback_imp: 37806,
  vendor_imp: 0,
  dable_media_cost: 81799,
  dable_revenue: 256280,
  pb_media_cost: 49147,
  pb_revenue: 45367,
  rpm_dashboard: 1319,
  vendor_source: "syncmedia",
};

const PRICES_20260415: ExternalValueRow[] = [
  {
    id: 1,
    widget_id: "V7a1pGx7",
    value: { internal: 1300, syncmedia: 1200, fc: 230 },
    start_date: "2026-04-08",
    end_date: null,
    created_at: "2026-04-08T00:00:00Z",
  },
];

describe("deriveFcRow — widget V7a1pGx7 2026-04-15", () => {
  const row = deriveFcRow(AUTO_20260415, PRICES_20260415, DEFAULT_FC_CONSTANTS, "V7a1pGx7");

  it("기본 입력 필드", () => {
    expect(row.date).toBe("2026-04-15");
    expect(row.widget_id).toBe("V7a1pGx7");
    expect(row.requests).toBe(100729);
    expect(row.passback_requests).toBe(37806);
    expect(row.dable_response).toBe(100729 - 37806);  // E = D - G
    expect(row.fc_amount).toBe(230);
  });

  it("F/H 비율", () => {
    expect(row.response_rate).toBeCloseTo(62923 / 100729, 4);
    expect(row.passback_rate).toBeCloseTo(37806 / 100729, 4);
  });

  it("MFR 3종 (자동 계산)", () => {
    expect(row.dable_mfr).toBeCloseTo(81799 / 256280, 2);      // O ≈ 0.32
    expect(row.vendor_mfr).toBeCloseTo(49147 / 45367, 2);      // P ≈ 1.08
    expect(row.total_mfr).toBeCloseTo((81799 + 49147) / (256280 + 45367), 2); // N ≈ 0.43
  });

  it("엑셀 PB 매체 매출 AF = G/1000 * T", () => {
    // G=37806, T=1200 → 45367.2
    expect(row.pb_media_revenue).toBeCloseTo(45367.2, 1);
  });

  it("엑셀 데이블 매체비 V = E/1000 * S", () => {
    // E=62923, S=1300 → 81799.9
    expect(row.dable_media_cost).toBeCloseTo(81799.9, 1);
  });

  it("엑셀 데이블 CPM AA = S / O (manual)", () => {
    // S=1300, O=0.31 (엑셀 하드코딩) → AA ≈ 4193.5
    // 단 우리는 O 를 자동 계산(0.32)으로 사용 → AA 약간 달라짐
    const expected_AA = 1300 / row.dable_mfr_ref;
    expect(row.dable_cpm).toBeCloseTo(expected_AA, 2);
  });
});

describe("deriveFcRow — unit price 없을 때", () => {
  it("price 없으면 S=T=FC=0 으로 계산, 공식은 깨지지 않는다", () => {
    const row = deriveFcRow(AUTO_20260415, [], DEFAULT_FC_CONSTANTS, "V7a1pGx7");
    expect(row.fc_amount).toBeNull();
    expect(row.pb_media_revenue).toBe(0);    // G/1000 * 0
    expect(row.dable_media_cost).toBe(0);
  });
});

describe("deriveFcRow — vendor_source null", () => {
  it("vendor_source 없으면 T=0", () => {
    const row = deriveFcRow(
      { ...AUTO_20260415, vendor_source: null, passback_imp: 37806, pb_revenue: 0 },
      PRICES_20260415,
      DEFAULT_FC_CONSTANTS,
      "V7a1pGx7",
    );
    expect(row.pb_media_revenue).toBe(0);
  });
});

describe("deriveFcRow — dable_revenue=0 (divide by zero 방어)", () => {
  it("b=0 이면 O=0", () => {
    const row = deriveFcRow(
      { ...AUTO_20260415, dable_revenue: 0 },
      PRICES_20260415,
      DEFAULT_FC_CONSTANTS,
      "V7a1pGx7",
    );
    expect(row.dable_mfr).toBe(0);
  });
});

describe("deriveFcRows — 날짜 정렬", () => {
  it("결과는 date DESC", () => {
    const auto1 = { ...AUTO_20260415, date: "2026-04-10" };
    const auto2 = { ...AUTO_20260415, date: "2026-04-15" };
    const rows = deriveFcRows([auto1, auto2], PRICES_20260415, DEFAULT_FC_CONSTANTS, "V7a1pGx7");
    expect(rows[0].date).toBe("2026-04-15");
    expect(rows[1].date).toBe("2026-04-10");
  });
});
