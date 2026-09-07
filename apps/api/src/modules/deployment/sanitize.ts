import type { EnvironmentClass } from "./environmentIdentity.js";

/**
 * Redacción de secretos (Build 09.5A §37): nunca se exponen connection strings,
 * claves, tokens o rutas sensibles al cliente; en STAGING/PRODUCTION tampoco en
 * logs del servidor. LOCAL conserva logs completos para desarrollo.
 */

const SECRET_PATTERNS: Array<{ re: RegExp; label: string }> = [
  {
    re: /["']?(password|pwd|pass)["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
    label: "<secret:password>",
  },
  {
    re: /["']?(api[_-]?key|apikey|secret|token|credential|private[_-]?key)["']?\s*[=:]\s*(?:"[^"]*"|'[^']*'|[^\s,;}]+)/gi,
    label: "<secret:key>",
  },
  { re: /(?<![A-Za-z0-9])sk-[A-Za-z0-9_-]{8,}/g, label: "<secret:sk>" },
  { re: /(Server|Data Source)\s*=\s*[^;]+/gi, label: "<host>" },
  { re: /(User ID|UID)\s*=\s*[^;]+/gi, label: "<user>" },
];

const REDACTED_MARKER = "nutriclinica-REDACTED";

export function redactSecrets(text: string): string {
  let out = text;
  for (const { re, label } of SECRET_PATTERNS) {
    out = out.replace(re, label);
  }
  return out;
}

/** Borra datos sensibles de un mensaje destinado al cliente (nunca datos del sistema). */
export function sanitizeForClientMessage(message: string): string {
  const cleaned = redactSecrets(message)
    .replace(/\\r\\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 500 ? `${cleaned.slice(0, 500)}…` : cleaned;
}

export function buildSanitizer(
  environmentClass: EnvironmentClass,
): (message: string) => string {
  if (environmentClass === "LOCAL" || environmentClass === "TEST") {
    return (message) => sanitizeForClientMessage(message);
  }
  // STAGING/PRODUCTION/UNKNOWN: mensajes genéricos, sin detalles del sistema.
  return () => REDACTED_MARKER;
}

export { REDACTED_MARKER };
