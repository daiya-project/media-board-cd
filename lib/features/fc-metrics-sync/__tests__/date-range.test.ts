import { describe, it, expect } from "vitest";
import { computeFcSyncRange } from "../date-range";

describe("computeFcSyncRange", () => {
  // KST 2026-04-16 03:00 = UTC 2026-04-15 18:00
  const utc = new Date("2026-04-15T18:00:00Z");

  it("latestDate null → 어제 하루치만", () => {
    const d = computeFcSyncRange(null, utc);
    expect(d).toEqual({ skip: false, range: { start: "2026-04-15", end: "2026-04-15" } });
  });
  it("gap 2일: latestDate=2026-04-12 → 04-13..04-15", () => {
    const d = computeFcSyncRange("2026-04-12", utc);
    expect(d).toEqual({ skip: false, range: { start: "2026-04-13", end: "2026-04-15" } });
  });
  it("already up to date: latestDate === end (2026-04-15)", () => {
    const d = computeFcSyncRange("2026-04-15", utc);
    expect(d.skip).toBe(true);
  });
  it("gap 20일 → 14일 상한: start = end - 13", () => {
    const d = computeFcSyncRange("2026-03-01", utc);
    expect(d).toEqual({ skip: false, range: { start: "2026-04-02", end: "2026-04-15" } });
  });
  it("override: 지정 범위 그대로", () => {
    const d = computeFcSyncRange("2026-04-10", utc, { start: "2026-03-01", end: "2026-03-31" });
    expect(d).toEqual({ skip: false, range: { start: "2026-03-01", end: "2026-03-31" } });
  });
});
