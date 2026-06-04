import { Request, Response, NextFunction } from "express";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error("[nutriclinica-api] unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
}
