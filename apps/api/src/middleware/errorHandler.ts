import { type Request, type Response, type NextFunction } from "express";
import { readEnvironmentClass } from "../modules/deployment/environmentIdentity.js";
import { redactSecrets, sanitizeForClientMessage, buildSanitizer } from "../modules/deployment/sanitize.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
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

const sanitizer = buildSanitizer(readEnvironmentClass(process.env));

/** Detalles estructurados saneados (redacción de secretos) conservando la forma. */
function sanitizeStructuredDetails(details: unknown): unknown {
  const serialized = sanitizeForClientMessage(JSON.stringify(details));
  try {
    return JSON.parse(serialized) as unknown;
  } catch {
    return serialized;
  }
}

/**
 * Error handler con saneamiento (Build 09.5A §37):
 * - NUNCA se exponen al cliente connection strings, claves, tokens ni stacks.
 * - En LOCAL/TEST los mensajes de dominio se sanean (sin secretos, sin datos crudos);
 *   en STAGING/PRODUCTION/UNKNOWN se devuelve un mensaje genérico.
 * - Los logs del servidor se redactan en STAGING/PRODUCTION.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    const message = sanitizer(sanitizeForClientMessage(err.message));
    const details = err.details === undefined ? undefined : sanitizeStructuredDetails(err.details);
    res.status(err.status).json({
      error: message,
      ...(details === undefined ? {} : { details }),
    });
    return;
  }
  if (err instanceof Error) {
    const status = DOMAIN_ERROR_STATUS[err.name];
    if (status) {
      res.status(status).json({ error: sanitizer(sanitizeForClientMessage(err.message)) });
      return;
    }
  }
  const environmentClass = readEnvironmentClass(process.env);
  const logMessage = err instanceof Error ? err.message : String(err);
  if (environmentClass === "LOCAL" || environmentClass === "TEST") {
    console.error(
      "[nutriclinica-api] unhandled error:",
      redactSecrets(logMessage),
    );
    if (err instanceof Error && err.stack) {
      console.error(redactSecrets(err.stack));
    }
  } else {
    console.error("[nutriclinica-api] unhandled error (redactado):", redactSecrets(logMessage));
  }
  res.status(500).json({ error: "Internal server error" });
}