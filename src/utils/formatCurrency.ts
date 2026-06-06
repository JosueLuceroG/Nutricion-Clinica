/**
 * Formatea un número como moneda con Intl.NumberFormat.
 *
 * Por default usa el locale `es-MX` y moneda `MXN` (caso de uso típico
 * de la clínica). Si el valor no es finito, devuelve un placeholder
 * "—" para no romper la UI.
 */
export function formatCurrency(
  value: number,
  currency: string = "MXN",
  locale: string = "es-MX",
): string {
  if (!Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback: si el locale o currency no son válidos, mostrar
    // formato manual con el símbolo genérico.
    return `$${value.toFixed(2)}`;
  }
}
