import { describe, it, expect } from "vitest";
import { unitPriceChanged, mergeSnapshot } from "../diff";

describe("unitPriceChanged", () => {
  it("빈 latest + 새 값 → changed", () => {
    expect(unitPriceChanged({}, { fc: 230 })).toBe(true);
  });
  it("동일 snapshot → unchanged", () => {
    expect(unitPriceChanged({ fc: 230, internal: 1300 }, { fc: 230, internal: 1300 })).toBe(false);
  });
  it("값 다르면 changed", () => {
    expect(unitPriceChanged({ fc: 230 }, { fc: 250 })).toBe(true);
  });
  it("snapshot 에 없는 필드는 latest 값 유지 (변경 없음)", () => {
    // snapshot={fc:230}, latest={fc:230, internal:1300} → snapshot 에 internal 없으면 비교 대상에서 제외
    expect(unitPriceChanged({ fc: 230, internal: 1300 }, { fc: 230 })).toBe(false);
  });
  it("snapshot 에 신규 필드 추가 → changed", () => {
    expect(unitPriceChanged({ fc: 230 }, { fc: 230, syncmedia: 1200 })).toBe(true);
  });
});

describe("mergeSnapshot — 기존 값 + 새 snapshot", () => {
  it("snapshot 필드는 덮어쓰고, 없는 필드는 기존 유지", () => {
    const merged = mergeSnapshot({ fc: 230, internal: 1300 }, { fc: 250 });
    expect(merged).toEqual({ fc: 250, internal: 1300 });
  });
  it("빈 base 에 snapshot 전체 반영", () => {
    expect(mergeSnapshot({}, { fc: 230 })).toEqual({ fc: 230 });
  });
});
