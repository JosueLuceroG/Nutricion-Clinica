import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases de Tailwind de forma inteligente, resolviendo conflictos.
 * shadcn/ui helper estándar.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
