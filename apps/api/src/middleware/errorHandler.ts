import { type Request, type Response, type NextFunction } from "express";

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export class UnauthorizedError extends HttpError {
  constructor(message = "Unauthorized") {
    super(401, message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Forbidden") {
    super(403, message);
    this.name = "ForbiddenError";
  }
}

const DOMAIN_ERROR_STATUS: Record<string, number> = {
  InvalidCredentialsError: 401,
  InactiveAccountError: 403,
  EmailAlreadyExistsError: 409,
  InvalidTokenError: 401,
  WeakPasswordError: 400,
};

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof Error) {
    const status = DOMAIN_ERROR_STATUS[err.name];
    if (status) {
      res.status(status).json({ error: err.message });
      return;
    }
  }
  console.error("[nutriclinica-api] unhandled error:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  res.status(500).json({ error: "Internal server error" });
}
