import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("API", () => {
  const app = createApp();
  it("GET /health", async () => {
    const res = await request(app).get("/health").expect(200);
    expect(res.body.status).toBe("ok");
  });
  it("GET /api/rate/6204", async () => {
    const res = await request(app).get("/api/rate/6204").expect(200);
    expect(res.body.matched).toBe(true);
    expect(res.body.gst.below_1000.rate).toBe(5);
    expect(res.body.gst.above_1000.rate).toBe(12);
  });
  it("POST /api/rate selects rate by price", async () => {
    const res = await request(app).post("/api/rate").send({ query: "6204", price: 1200 }).expect(200);
    expect(res.body.gst.selected_rate.rate).toBe(12);
  });

  it("GET /api/search returns exact and child HSN rate options", async () => {
    const res = await request(app).get("/api/search?q=9401").expect(200);
    const codes = res.body.rate_matches.map((match: { code: string }) => match.code);
    expect(codes).toContain("9401");
    expect(codes).toContain("940110");
    expect(codes).toContain("94011000");
    expect(codes.indexOf("94011000")).toBe(codes.indexOf("940110") + 1);
    const general = res.body.rate_matches.find((match: { code: string }) => match.code === "9401");
    const aircraft = res.body.rate_matches.find((match: { code: string }) => match.code === "940110");
    expect(general.gst.below_1000.rate).toBe(18);
    expect(aircraft.gst.below_1000.rate).toBe(5);
    const fuzzyCodes = res.body.fuzzy_matches.map((match: { code?: string; hsn?: { code?: string } }) => match.code || match.hsn?.code);
    expect(fuzzyCodes).toContain("9401");
    expect(fuzzyCodes).toContain("94011000");
    expect(fuzzyCodes).toContain("94012000");
  });

  it("requires an API key when API_KEYS is configured", async () => {
    process.env.API_KEYS = "test_key";
    const protectedApp = createApp();
    await request(protectedApp).get("/health").expect(200);
    await request(protectedApp).get("/api/rate/6204").expect(401);
    delete process.env.API_KEYS;
  });

  it("accepts x-api-key and bearer tokens", async () => {
    process.env.API_KEYS = "test_key";
    const protectedApp = createApp();
    await request(protectedApp).get("/api/rate/6204").set("x-api-key", "test_key").expect(200);
    await request(protectedApp).get("/api/rate/6204").set("authorization", "Bearer test_key").expect(200);
    delete process.env.API_KEYS;
  });
});
