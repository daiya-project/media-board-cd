import { describe, it, expect } from "vitest";
import {
  PASSBACK_VENDORS,
  vendorIdToSlug,
  isAllowedVendorId,
  pickPrimaryVendor,
} from "../external-fc-vendors";

describe("PASSBACK_VENDORS", () => {
  it("3개 벤더가 하드코딩되어 있다", () => {
    expect(PASSBACK_VENDORS).toHaveLength(3);
    const slugs = PASSBACK_VENDORS.map((v) => v.slug);
    expect(slugs).toEqual(["syncmedia", "klmedia", "friendplus"]);
  });
});

describe("vendorIdToSlug", () => {
  it("2/4/5 → 해당 slug", () => {
    expect(vendorIdToSlug(2)).toBe("syncmedia");
    expect(vendorIdToSlug(4)).toBe("klmedia");
    expect(vendorIdToSlug(5)).toBe("friendplus");
  });
  it("허용 밖 → null", () => {
    expect(vendorIdToSlug(-1)).toBeNull();
    expect(vendorIdToSlug(3)).toBeNull();
    expect(vendorIdToSlug(99)).toBeNull();
  });
});

describe("isAllowedVendorId", () => {
  it("2/4/5 만 true", () => {
    expect(isAllowedVendorId(2)).toBe(true);
    expect(isAllowedVendorId(4)).toBe(true);
    expect(isAllowedVendorId(5)).toBe(true);
    expect(isAllowedVendorId(-1)).toBe(false);
    expect(isAllowedVendorId(0)).toBe(false);
  });
});

describe("pickPrimaryVendor", () => {
  it("imp 가 최대인 vendor slug 반환", () => {
    const rows = [
      { vendor_id: 2, impressions: 100 },
      { vendor_id: 5, impressions: 500 },
      { vendor_id: 4, impressions: 200 },
    ];
    expect(pickPrimaryVendor(rows)).toBe("friendplus");
  });
  it("빈 배열 → null", () => {
    expect(pickPrimaryVendor([])).toBeNull();
  });
  it("허용 벤더가 없으면 null", () => {
    expect(pickPrimaryVendor([{ vendor_id: -1, impressions: 1000 }])).toBeNull();
  });
  it("동률이면 slug 알파벳 순", () => {
    const rows = [
      { vendor_id: 2, impressions: 100 },
      { vendor_id: 4, impressions: 100 },
    ];
    // friendplus < klmedia < syncmedia 알파벳순 → klmedia 가 먼저
    expect(pickPrimaryVendor(rows)).toBe("klmedia");
  });
});
