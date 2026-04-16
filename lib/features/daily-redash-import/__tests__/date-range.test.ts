import { describe, it, expect } from "vitest";
import { computeSyncRange } from "../date-range";

describe("computeSyncRange", () => {
  // KST 2026-04-16 03:00 = UTC 2026-04-15 18:00
  const nowKst0316Utc = new Date("2026-04-15T18:00:00Z");

  it("incremental: latestDate null → 어제 하루치만", () => {
    const decision = computeSyncRange(null, nowKst0316Utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-15", end: "2026-04-15" } });
  });

  it("incremental: latestDate < D-1 → latestDate+1 ~ D-1 (gap recovery)", () => {
    const decision = computeSyncRange("2026-04-10", nowKst0316Utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-11", end: "2026-04-15" } });
  });

  it("incremental: latestDate === D-1 → skip", () => {
    const decision = computeSyncRange("2026-04-15", nowKst0316Utc);
    expect(decision.skip).toBe(true);
    expect(decision.skip && decision.reason).toContain("already up to date");
  });

  it("incremental: latestDate > D-1 (미래 데이터) → skip", () => {
    const decision = computeSyncRange("2026-04-16", nowKst0316Utc);
    expect(decision.skip).toBe(true);
  });

  it("force: 지정 범위 그대로 반환 (검증은 호출자)", () => {
    const decision = computeSyncRange("2026-04-10", nowKst0316Utc, {
      start: "2026-03-01",
      end: "2026-03-31",
    });
    expect(decision).toEqual({ skip: false, range: { start: "2026-03-01", end: "2026-03-31" } });
  });

  it("KST 경계: UTC 2026-04-16 14:59 (KST 23:59) → end = 2026-04-15", () => {
    const utc = new Date("2026-04-16T14:59:00Z");
    const decision = computeSyncRange(null, utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-15", end: "2026-04-15" } });
  });

  it("KST 경계: UTC 2026-04-16 15:00 (KST 다음날 00:00) → end = 2026-04-16", () => {
    const utc = new Date("2026-04-16T15:00:00Z");
    const decision = computeSyncRange(null, utc);
    expect(decision).toEqual({ skip: false, range: { start: "2026-04-16", end: "2026-04-16" } });
  });
});
