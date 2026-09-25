import { type Request, type Response, type NextFunction } from "express";
import { ZodError } from "zod";
import { readEnvironmentClass } from "../modules/deployment/environmentIdentity.js";
import {
  redactSecrets,
  sanitizeForClientMessage,
  buildSanitizer,
} from "../modules/deployment/sanitize.js";

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
const SENSITIVE_DETAIL_KEY =
  /(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|credential|private[_-]?key)/i;

/** Detalles estructurados saneados (redacción de secretos) conservando la forma. */
function sanitizeStructuredDetails(details: unknown): unknown {
  try {
    const json = JSON.stringify(details, (key, value: unknown) => {
      if (key && SENSITIVE_DETAIL_KEY.test(key)) return "<secret>";
      return typeof value === "string"
        ? sanitizeForClientMessage(value)
        : value;
    });
    if (json === undefined) return "Detalles no serializables";
    return JSON.parse(json) as unknown;
  } catch {
    return "Detalles no serializables";
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
  const environmentClass = readEnvironmentClass(process.env);
  const sanitizer = buildSanitizer(environmentClass);
  if (err instanceof ZodError) {
    res.status(400).json({
      error: sanitizer("Invalid request"),
      ...((environmentClass === "LOCAL" || environmentClass === "TEST") && {
        details: err.issues.map((issue) => ({
          path: issue.path,
          message: sanitizeForClientMessage(issue.message),
        })),
      }),
    });
    return;
  }
  if (err instanceof HttpError) {
    const message = sanitizer(sanitizeForClientMessage(err.message));
    const details =
      (environmentClass === "LOCAL" || environmentClass === "TEST") &&
      err.details !== undefined
        ? sanitizeStructuredDetails(err.details)
        : undefined;
    res.status(err.status).json({
      error: message,
      ...(details === undefined ? {} : { details }),
    });
    return;
  }
  if (err instanceof Error) {
    const explicitStatus = (err as Error & { status?: unknown }).status;
    const status =
      DOMAIN_ERROR_STATUS[err.name] ??
      (Number.isInteger(explicitStatus) &&
      Number(explicitStatus) >= 400 &&
      Number(explicitStatus) <= 599
        ? Number(explicitStatus)
        : undefined);
    if (status) {
      res
        .status(status)
        .json({ error: sanitizer(sanitizeForClientMessage(err.message)) });
      return;
    }
  }
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
    console.error(
      "[nutriclinica-api] unhandled error (redactado):",
      err instanceof Error ? err.name : "UnknownThrownValue",
    );
  }
  res.status(500).json({ error: "Internal server error" });
}
