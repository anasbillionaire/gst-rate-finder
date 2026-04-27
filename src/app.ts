import fs from "node:fs";
import path from "node:path";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { createApiRouter } from "./api/routes.js";
import { rootDir } from "./utils/paths.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.get("/health", (_req, res) => res.json({ status: "ok" }));
  const openApiPath = path.join(rootDir, "openapi.yaml");
  if (fs.existsSync(openApiPath)) {
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(undefined, { swaggerUrl: "/openapi.yaml" }));
    app.get("/openapi.yaml", (_req, res) => res.sendFile(openApiPath));
  }
  app.use("/api", createApiRouter());
  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  return app;
}
