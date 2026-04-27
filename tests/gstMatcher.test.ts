import { describe, expect, it } from "vitest";
import { GstMatcher } from "../src/services/gstMatcher.js";

const matcher = new GstMatcher();

describe("GstMatcher", () => {
  it("returns apparel slabs for HSN 6204", () => {
    const response = matcher.rate("6204", 1200);
    expect(response.matched).toBe(true);
    if (!response.matched) throw new Error("expected match");
    expect(response.match_type).toBe("chapter_prefix");
    expect(response.gst.below_1000.rate).toBe(5);
    expect(response.gst.above_1000.rate).toBe(12);
    expect(response.gst.selected_rate?.rate).toBe(12);
  });

  it("returns the same chapter-level result for HSN 62", () => {
    const response = matcher.rate("62");
    expect(response.matched).toBe(true);
    if (!response.matched) throw new Error("expected match");
    expect(response.gst.below_1000.rate).toBe(5);
    expect(response.gst.above_1000.rate).toBe(12);
  });

  it("fuzzy search women dress returns apparel related result", () => {
    const response = matcher.rate("women dress");
    expect(response.matched).toBe(true);
    if (!response.matched) throw new Error("expected match");
    expect(JSON.stringify(response).toLowerCase()).toMatch(/apparel|women|dress|clothing|62/);
  });

  it("unknown HSN returns not_found", () => {
    const response = matcher.rate("980199999999");
    expect(response.matched).toBe(false);
    expect(response.match_type).toBe("not_found");
  });

  it("mirrors a single-rate GST row into both slabs", () => {
    const response = matcher.rate("402");
    expect(response.matched).toBe(true);
    if (!response.matched) throw new Error("expected match");
    expect(response.gst.below_1000.rate).toBe(response.gst.above_1000.rate);
  });

  it("does not invent a default 18 percent rate for unknown codes", () => {
    const response = matcher.rate("no-such-product-code");
    expect(response.matched).toBe(false);
    expect(JSON.stringify(response)).not.toContain("\"rate\":18");
  });
});
