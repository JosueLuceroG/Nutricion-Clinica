/**
 * Parser CSV minimalista sin dependencias externas.
 *
 * Soporta:
 *  - Comillas dobles para escapar campos que contengan comas, saltos de línea o comillas.
 *  - Comillas escapadas como `""` dentro de un campo entrecomillado.
 *  - Separador configurable (por defecto `,`).
 *  - Líneas vacías ignoradas.
 *  - Detección básica de BOM UTF-8 al inicio.
 *
 * NO soporta:
 *  - Comentarios (`#`...).
 *  - Encabezados multi-línea.
 *  - Conversión automática de tipos (lo hace la capa de importador).
 *
 * Para archivos muy grandes (>10k filas) se recomienda `importer.worker.ts`
 * (Fase 3, spec §20.2.8) — esta implementación corre en main thread.
 */
export interface ParsedCsv {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

export class CsvParseError extends Error {
  constructor(message: string, public readonly line: number) {
    super(`${message} (línea ${line})`);
    this.name = "CsvParseError";
  }
}

export function parseCsv(input: string, options: { separator?: string } = {}): ParsedCsv {
  const separator = options.separator ?? ",";
  const text = input.startsWith("\uFEFF") ? input.slice(1) : input;

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;
  let line = 1;
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          currentField += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      if (ch === "\n") {
        line++;
      }
      currentField += ch;
      i++;
      continue;
    }

    if (ch === '"') {
      if (currentField.length > 0) {
        throw new CsvParseError("Comilla doble no abre un campo vacío", line);
      }
      inQuotes = true;
      i++;
      continue;
    }

    if (ch === separator) {
      currentRow.push(currentField);
      currentField = "";
      i++;
      continue;
    }

    if (ch === "\r") {
      i++;
      continue;
    }

    if (ch === "\n") {
      currentRow.push(currentField);
      rows.push(currentRow);
      currentRow = [];
      currentField = "";
      line++;
      i++;
      continue;
    }

    currentField += ch;
    i++;
  }

  if (inQuotes) {
    throw new CsvParseError("Comilla doble sin cerrar al final del archivo", line);
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  const cleaned = rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));

  if (cleaned.length === 0) {
    return { headers: [], rows: [], totalRows: 0 };
  }

  const [headers, ...dataRows] = cleaned;
  const normalizedHeaders = headers.map((h) => h.trim());
  return {
    headers: normalizedHeaders,
    rows: dataRows,
    totalRows: dataRows.length,
  };
}
