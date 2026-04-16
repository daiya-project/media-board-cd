import { describe, it, expect } from "vitest";
import { redashRowToParsedCSVRow } from "../adapter";

describe("redashRowToParsedCSVRow", () => {
  it("BIGINT 가 number 로 들어와도 string 으로 변환된 client_id/service_id", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      client_name: "테스트클라",
      service_id: 100,
      service_name: "테스트서비스",
      widget_id: "W123",
      widget_name: "위젯A",
      cost_spent: 12345,
      pub_profit: 6789,
      imp: 100000,
      vimp: 80000,
      click: 234,
      service_cv: 12,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed).toEqual({
      date: "2026-04-15",
      client_id: "5",
      service_id: "100",
      service_name: "테스트서비스",
      widget_id: "W123",
      widget_name: "위젯A",
      cost_spent: 12345,
      pub_profit: 6789,
      imp: 100000,
      vimp: 80000,
      cnt_click: 234,
      cnt_cv: 12,
    });
  });

  it("string 숫자도 number 로 정규화", () => {
    const row = {
      date: "2026-04-15",
      client_id: "5",
      service_id: "100",
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: "12345",
      pub_profit: "6789",
      imp: "100000",
      vimp: "80000",
      click: "234",
      service_cv: "12",
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed.cost_spent).toBe(12345);
    expect(parsed.cnt_click).toBe(234);
    expect(parsed.cnt_cv).toBe(12);
  });

  it("null/undefined 숫자 필드 → 0", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      service_id: 100,
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: null,
      pub_profit: undefined,
      imp: 0,
      vimp: 0,
      click: null,
      service_cv: null,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed.cost_spent).toBe(0);
    expect(parsed.pub_profit).toBe(0);
    expect(parsed.cnt_click).toBe(0);
    expect(parsed.cnt_cv).toBe(0);
  });

  it("client_name 은 매핑 대상 아님 (무시)", () => {
    const row = {
      date: "2026-04-15",
      client_id: 5,
      client_name: "이건 무시됨",
      service_id: 100,
      service_name: "S",
      widget_id: "W",
      widget_name: "WN",
      cost_spent: 0,
      pub_profit: 0,
      imp: 0,
      vimp: 0,
      click: 0,
      service_cv: 0,
    };
    const parsed = redashRowToParsedCSVRow(row);
    expect(parsed).not.toHaveProperty("client_name");
  });
});
