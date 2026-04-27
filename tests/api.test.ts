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
});
