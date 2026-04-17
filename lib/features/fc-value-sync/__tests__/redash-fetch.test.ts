import { describe, it, expect, afterEach, vi } from "vitest";
import {
  fetchDwFcMetrics,
  fetchDwSnapshot,
  fetchDwFcMap,
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

describe("fetchDwSnapshot — cron 용 S/T 조회", () => {
  it("S internal / T per-vendor 를 UnitPriceValue 로 합성", async () => {
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

describe("fetchDwFcMap — 가드", () => {
  it("widgetIds=[] 시 Trino 호출 없이 빈 Map 반환", async () => {
    const mockFetch = vi.fn();
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({ widgetIds: [], apiKey: "test-key" });

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("widget_id 가 [A-Za-z0-9_-]{1,32} 를 벗어나면 throw + fetch 호출 없음", async () => {
    const mockFetch = vi.fn();
    __setFetchForTesting(mockFetch as typeof fetch);

    await expect(
      fetchDwFcMap({ widgetIds: ["'; DROP TABLE"], apiKey: "test-key" }),
    ).rejects.toThrow(/Invalid widget_id/);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("fetchDwFcMap — 정상 경로", () => {
  it("Redash 결과를 Map<widget_id, fc> 로 변환", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: {
          data: {
            rows: [
              { widget_id: "A", fc: 230 },
              { widget_id: "B", fc: 500 },
            ],
          },
        },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({
      widgetIds: ["A", "B"],
      apiKey: "test-key",
    });
    expect(result.size).toBe(2);
    expect(result.get("A")).toBe(230);
    expect(result.get("B")).toBe(500);
  });

  it("DW 에 widget row 가 없으면 Map 에 key 없음", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: { data: { rows: [{ widget_id: "A", fc: 230 }] } },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({
      widgetIds: ["A", "MISSING"],
      apiKey: "test-key",
    });
    expect(result.has("A")).toBe(true);
    expect(result.has("MISSING")).toBe(false);
  });

  it("fc 가 null 이면 Map 에 key 있지만 value=null", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        query_result: { data: { rows: [{ widget_id: "A", fc: null }] } },
      }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    const result = await fetchDwFcMap({ widgetIds: ["A"], apiKey: "test-key" });
    expect(result.has("A")).toBe(true);
    expect(result.get("A")).toBeNull();
  });

  it("data_source_id=307 + mysql_reco_re.dable.WIDGET 포함 SQL 로 POST", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ query_result: { data: { rows: [] } } }),
    });
    __setFetchForTesting(mockFetch as typeof fetch);

    await fetchDwFcMap({ widgetIds: ["A"], apiKey: "test-key" });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/query_results");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string) as {
      query: string;
      data_source_id: number;
    };
    expect(body.data_source_id).toBe(307);
    expect(body.query).toContain("mysql_reco_re.dable.WIDGET");
    expect(body.query).toContain("ad_low_rpm_passback");
  });
});
