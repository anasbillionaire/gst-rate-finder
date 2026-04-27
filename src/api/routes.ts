import { Router } from "express";
import { z } from "zod";
import { GstMatcher } from "../services/gstMatcher.js";

export function createApiRouter(matcher = new GstMatcher()): Router {
  const router = Router();
  router.get("/search", (req, res) => {
    const query = String(req.query.q ?? "").trim();
    if (!query) return res.status(400).json({ error: "q query parameter is required" });
    return res.json(matcher.search(query));
  });
  router.get("/rate/:query", (req, res) => res.json(matcher.rate(req.params.query)));
  router.post("/rate", (req, res) => {
    const parsed = z.object({
      query: z.string().min(1),
      price: z.number().optional(),
      effective_date: z.string().optional(),
      description: z.string().optional()
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return res.json(matcher.rate(parsed.data.query, parsed.data.price));
  });
  return router;
}
