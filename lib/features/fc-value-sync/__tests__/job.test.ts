import { describe, it, expect, beforeEach, vi } from "vitest";

// redash-fetch 와 supabase cron-client 를 module 레벨에서 mock
vi.mock("../redash-fetch", () => ({
  fetchDwFcMap: vi.fn(),
  fetchDwSnapshot: vi.fn(),
}));
vi.mock("@/lib/supabase/cron-client", () => ({
  createCronSupabase: vi.fn(),
}));

import { runFcValueSyncJob } from "../job";
import { fetchDwFcMap, fetchDwSnapshot } from "../redash-fetch";
import { createCronSupabase } from "@/lib/supabase/cron-client";

type MockFn = ReturnType<typeof vi.fn>;

/**
 * createCronSupabase() 가 반환하는 supabase client 를 mock.
 * - from("external_mapping").select().not() 체인 → widgetIds
 * - from("external_value").select().eq().is().order().limit() → latest row
 * - from("external_value").insert() → insert result
 */
function makeSupabaseMock(opts: {
  widgetIds: string[];
  latestByWidget: Record<string, unknown | null>;
}) {
  const insertCalls: Array<Record<string, unknown>> = [];

  const fromMapping = () => ({
    select: () => ({
      not: () =>
        Promise.resolve({
          data: opts.widgetIds.map((widget_id) => ({ widget_id })),
          error: null,
        }),
    }),
  });

  const fromExternalValue = () => {
    const chain = {
      // select 체인
      select: () => ({
        eq: (_: string, widgetId: string) => ({
          is: () => ({
            order: () => ({
              limit: () =>
                Promise.resolve({
                  data: opts.latestByWidget[widgetId]
                    ? [{ value: opts.latestByWidget[widgetId] }]
                    : [],
                  error: null,
                }),
            }),
          }),
        }),
      }),
      // insert 체인
      insert: (row: Record<string, unknown>) => {
        insertCalls.push(row);
        return Promise.resolve({ error: null });
      },
    };
    return chain;
  };

  const client = {
    from: (table: string) => {
      if (table === "external_mapping") return fromMapping();
      if (table === "external_value") return fromExternalValue();
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  return { client, insertCalls };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.REDASH_API_KEY = "test-key";
});

describe("runFcValueSyncJob — prefetch 통합", () => {
  it("prefetch 성공 + fc 값 변경 시 new row insert 에 fc 포함", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A"],
      latestByWidget: { A: { internal: 1300 } }, // 기존 row 에 fc 없음
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockResolvedValue({
      internal: 1300,
      syncmedia: 1200,
    });
    (fetchDwFcMap as unknown as MockFn).mockResolvedValue(
      new Map([["A", 230]]),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    expect(result.fcPrefetched).toBe(1);
    expect(result.fcResolved).toBe(1);
    expect(result.widgetsInserted).toBe(1);
    expect(insertCalls).toHaveLength(1);
    expect((insertCalls[0].value as Record<string, unknown>).fc).toBe(230);
  });

  it("fetchDwFcMap 이 throw 해도 S/T diff 는 정상 수행 (fail-open)", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A"],
      latestByWidget: { A: { internal: 1000 } }, // S 가 달라져서 diff 유발
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockResolvedValue({
      internal: 1300,
    });
    (fetchDwFcMap as unknown as MockFn).mockRejectedValue(
      new Error("mysql rds down"),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    expect(result.fcPrefetched).toBe(0);
    expect(result.fcResolved).toBe(0);
    expect(result.failures).toBe(0); // widget 루프 실패 아님
    expect(result.widgetsInserted).toBe(1);
    expect((insertCalls[0].value as Record<string, unknown>).fc).toBeUndefined();
  });

  it("widget 이 fcMap 에 없으면 snap.fc 주입 skip (기존 fc 유지)", async () => {
    const { client, insertCalls } = makeSupabaseMock({
      widgetIds: ["A", "B"],
      latestByWidget: {
        A: { internal: 1300, fc: 999 },
        B: { internal: 1000 }, // B 는 latest 에 fc 없음
      },
    });
    (createCronSupabase as unknown as MockFn).mockReturnValue(client);
    (fetchDwSnapshot as unknown as MockFn).mockImplementation(
      async ({ widgetId }: { widgetId: string }) =>
        widgetId === "A"
          ? { internal: 1400 } // S 가 변해서 insert 유발
          : { internal: 1000 }, // B 는 변경 없음
    );
    // fcMap 에 B 만 있음, A 는 누락
    (fetchDwFcMap as unknown as MockFn).mockResolvedValue(
      new Map([["B", 230]]),
    );

    const result = await runFcValueSyncJob(new Date("2026-04-17T22:00:00Z"));

    // A 는 fc 주입 안 됨 → merged.fc 는 기존 latest 값 999 유지
    const aInsert = insertCalls.find(
      (r) => (r as { widget_id: string }).widget_id === "A",
    );
    expect(aInsert).toBeDefined();
    expect((aInsert!.value as Record<string, unknown>).fc).toBe(999);
    // B 는 fc 변경 있지만 S/T 동일 → insert 됨 (fc=230)
    const bInsert = insertCalls.find(
      (r) => (r as { widget_id: string }).widget_id === "B",
    );
    expect(bInsert).toBeDefined();
    expect((bInsert!.value as Record<string, unknown>).fc).toBe(230);
  });
});
