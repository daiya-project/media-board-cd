import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchDwFcMetrics,
  fetchDwSnapshot,
  __setFetchForTesting,
} from "../redash-fetch";

afterEach(() => {
  __setFetchForTesting(undefined);
});

describe("fetchDwFcMetrics — widget × date 범위", () => {
  it("Redash 쿼리 결과를 ExternalFcAutoInputs[] 로 변환한다", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                date: "2026-04-15",
                requests: 100729,
                passback_imp: 37806,
                dable_media_cost: 81799,
                dable_revenue: 256280,
                pb_media_cost: 49147,
                pb_revenue: 45367,
                rpm_dashboard: 1319,
                primary_vendor_id: 2,
                vendor_imp: 0,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMetrics({
      widgetId: "V7a1pGx7",
      startDate: "2026-04-15",
      endDate: "2026-04-15",
      apiKey: "test-key",
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: "2026-04-15",
      requests: 100729,
      passback_imp: 37806,
      vendor_source: "syncmedia",
    });
  });

  it("허용 밖 vendor_id → vendor_source null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                date: "2026-04-15",
                requests: 1000,
                passback_imp: 100,
                dable_media_cost: 500,
                dable_revenue: 2000,
                pb_media_cost: 100,
                pb_revenue: 0,
                rpm_dashboard: 500,
                primary_vendor_id: -1,
                vendor_imp: 0,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMetrics({
      widgetId: "V7a1pGx7",
      startDate: "2026-04-15",
      endDate: "2026-04-15",
      apiKey: "test-key",
    });
    expect(result[0].vendor_source).toBeNull();
  });
});

describe("fetchDwSnapshot — cron 용 S/T/FC 조회", () => {
  it("S internal / T per-vendor / FC 를 UnitPriceValue 로 합성", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              {
                internal_cpm: 1300,
                vendor_2_cpm: 1200,
                vendor_4_cpm: 300,
                vendor_5_cpm: null,
                fc: 230,
              },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const snap = await fetchDwSnapshot({
      widgetId: "V7a1pGx7",
      date: "2026-04-15",
      apiKey: "test-key",
    });
    expect(snap).toEqual({
      internal: 1300,
      syncmedia: 1200,
      klmedia: 300,
      fc: 230,
    });
  });

  it("Redash 가 빈 rows 반환 → 빈 객체", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ query_result: { data: { rows: [] } } }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const snap = await fetchDwSnapshot({
      widgetId: "UNKNOWN",
      date: "2026-04-15",
      apiKey: "test-key",
    });
    expect(snap).toEqual({});
  });
});
