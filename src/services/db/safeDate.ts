/**
 * Helpers defensivos para serializar/deserializar fechas entre
 * mappers de Dexie y objetos de dominio.
 *
 * Por qué existen:
 *  - Filas en IndexedDB pueden contener `Date` objects (vía pull del
 *    servidor) o strings vacíos (vía una mutación interrumpida, un
 *    crash a medio put, o un campo opcional nunca seteado). En ambos
 *    casos, `new Date(valorInesperado)` produce `Invalid Date`, y
 *    cualquier llamada posterior a `.toISOString()` lanza
 *    `RangeError: Invalid time value` que rompe toda la operación
 *    (e.g. un soft-delete) sin manera limpia de recuperar.
 *  - Estos helpers hacen que los mappers NUNCA exploten por datos
 *    sucios: si la fecha de entrada es inválida, usan un fallback
 *    razonable (por defecto, `new Date()` para campos requeridos,
 *    `null` para opcionales) y dejan un `console.warn` para que
 *    el problema sea visible.
 *
 * Uso:
 *   // Lectura: row → domain
 *   birthDate: safeDate(row.birth_date)             // required → fallback a `new Date()`
 *   fechaFirma: safeDate(row.fecha_firma, null)     // optional → fallback a `null`
 *
 *   // Escritura: domain → row
 *   birth_date: toIsoStringSafe(patient.birthDate)  // required → fallback a `new Date().toISOString()`
 *   deleted_at: toIsoStringSafe(patient.deletedAt, null)
 */

const warnedKeys = new Set<string>();

function warnOnce(key: string, received: unknown, fallback: "now" | "null"): void {
  // Solo advertimos una vez por clave para no spammear en producción.
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
   
  console.warn(
    `[safeDate] Dato de fecha inválido en "${key}":`,
    received,
    `→ usando fallback (${fallback}). Repara con el botón "Reparar fechas corruptas" del modal de diagnóstico.`,
  );
}

/**
 * Convierte un valor arbitrario (string ISO, number, Date, null, undefined,
 * o cualquier cosa) en una `Date` válida, usando `fallback` si el valor
 * no se puede parsear o si es nullish.
 *
 * - Si `value` ya es un `Date` válido, se clona.
 * - Si `value` es string/number parseable, se usa `new Date(value)`.
 * - Si `value` es `null`/`undefined`/`""` o produce `Invalid Date`,
 *   se devuelve `fallback ?? new Date()` (o `null` si `fallback === null`).
 */
export function safeDate(value: unknown, fallback?: Date | null, key?: string): Date | null {
  // Resolver el fallback por adelantado para distinguir:
  //   - fallback === null  → explícitamente null (campo opcional)
  //   - fallback === undefined → no se pasó, default a `new Date()` (campo requerido)
  const resolveFallback = (): Date | null => {
    if (fallback === null) return null;
    if (fallback === undefined) return new Date();
    return fallback;
  };

  // `null` y `undefined` NO son "datos corruptos" — son el sentinel
  // legítimo para "sin valor" (campos opcionales, soft-delete, etc.).
  // Advertir aquí es spam falso-positivo. Solo advertimos cuando el
  // valor está presente pero es inválido (string vacío, fecha inválida,
  // tipo inesperado).
  if (value == null) {
    return resolveFallback();
  }
  if (value === "") {
    if (key) warnOnce(key, value, fallback === null ? "null" : "now");
    return resolveFallback();
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      if (key) warnOnce(key, value, fallback === null ? "null" : "now");
      return resolveFallback();
    }
    return new Date(value.getTime());
  }
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      if (key) warnOnce(key, value, fallback === null ? "null" : "now");
      return resolveFallback();
    }
    return d;
  }
  if (key) warnOnce(key, value, fallback === null ? "null" : "now");
  return resolveFallback();
}

/**
 * Serializa una `Date` a string ISO, o devuelve `null` si es null/undefined
 * o si la fecha es inválida. Con `fallback` explícito se usa ese valor
 * cuando la fecha es inválida (útil para campos requeridos: `new Date()`).
 */
export function toIsoStringSafe(
  value: Date | null | undefined,
  fallback?: string | null,
  key?: string,
): string | null {
  if (value == null) {
    return fallback === undefined ? null : fallback;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    if (key) warnOnce(key, value, fallback === undefined ? "null" : "now");
    if (fallback === undefined) return null;
    if (fallback === null) return null;
    return fallback;
  }
  return value.toISOString();
}

/**
 * Devuelve `true` si el valor, al ser pasado por `safeDate`, produciría
 * una fecha inválida. Útil para escanear tablas y reparar datos corruptos
 * sin tocar filas sanas.
 */
export function isInvalidDateValue(value: unknown): boolean {
  if (value == null || value === "") return true;
  if (value instanceof Date) return Number.isNaN(value.getTime());
  if (typeof value === "string" || typeof value === "number") {
    return Number.isNaN(new Date(value).getTime());
  }
  return true;
}
