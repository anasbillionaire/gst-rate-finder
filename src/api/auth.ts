import { NextFunction, Request, Response } from "express";

function configuredKeys(): Set<string> {
  return new Set(
    (process.env.API_KEYS ?? "")
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean)
  );
}

function requestKey(req: Request): string | undefined {
  const headerKey = req.header("x-api-key")?.trim();
  if (headerKey) return headerKey;

  const authorization = req.header("authorization")?.trim();
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

export function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const keys = configuredKeys();
  if (keys.size === 0) return next();

  const key = requestKey(req);
  if (key && keys.has(key)) return next();

  return res.status(401).json({
    error: "unauthorized",
    message: "Valid API key required. Send x-api-key or Authorization: Bearer <key>."
  });
}
