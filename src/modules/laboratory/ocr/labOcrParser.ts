import type { LabResultInput } from "../domain/LabResult";
import type { LabTestCode } from "../domain/LabTest";

export interface ParsedLabValue {
  test: LabTestCode;
  value: number;
  rawMatch: string;
  confidence: "high" | "medium" | "low";
}

const LABEL_PATTERNS: [RegExp, LabTestCode][] = [
  [/glucosa(?!.*hb)/i, "GLUCOSA"],
  [/insulina/i, "INSULINA"],
  [/hemoglobina\s*glucosi|hb\s*a1c|hba1c|a1c/i, "HBA1C"],
  [/colesterol\s*total/i, "COLESTEROL_TOTAL"],
  [/colesterol\s*ldl|ldl\s*colesterol/i, "LDL"],
  [/colesterol\s*hdl|hdl\s*colesterol/i, "HDL"],
  [/trigli(?:c|c)eridos?/i, "TRIGLICERIDOS"],
  [/creatinina/i, "CREATININA"],
  [/bun|nitrogeno ureico|urea nitrogen/i, "BUN"],
  [/acido urico/i, "ACIDO_URICO"],
  [/tgo|ast(?!.*alt)/i, "TGO_AST"],
  [/tgp|alt(?!.*ast)/i, "TGP_ALT"],
  [/ggt|gamma glutamil/i, "GGT"],
  [/bilirrubina total/i, "BILIRRUBINA_TOTAL"],
  [/albumina/i, "ALBUMINA"],
  [/proteinas totales/i, "PROTEINAS_TOTALES"],
  [/hemoglobina(?!.*glucosi)/i, "HEMOGLOBINA"],
  [/hematocrito/i, "HEMATOCRITO"],
  [/hierro serico|hierro/i, "HIERRO_SERICO"],
  [/ferritina/i, "FERRITINA"],
  [/vitamina d|25 oh|calcifediol/i, "VITAMINA_D"],
  [/vitamina b12|b12|cianocobalamina/i, "VITAMINA_B12"],
  [/folato|acido folico/i, "FOLATO"],
  [/tsh|tiroestimulante|tireotropina/i, "TSH"],
];

function extractNumericValue(text: string): number | null {
  const patterns = [
    /[:=]\s*([<>]?\s*[\d,.]+)/,
    /\s+([<>]?\s*[\d,.]+)\s*(?:mg\/dL|ng\/mL|pg\/mL|µUI\/mL|U\/L|%|g\/dL|µg\/dL)/i,
    /\s+([<>]?\s*[\d,.]+)\s*$/,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[1]!.replace(/[<>=]/g, "").trim().replace(",", ".");
      const num = parseFloat(raw);
      if (!isNaN(num) && isFinite(num)) return num;
    }
  }
  return null;
}

function normalizeText(text: string): string {
  return text
    .replace(/[•·∙●○\t]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

const REASONABLE_MAX: Partial<Record<LabTestCode, number>> = {
  GLUCOSA: 800,
  INSULINA: 200,
  HBA1C: 20,
  COLESTEROL_TOTAL: 600,
  LDL: 400,
  HDL: 200,
  TRIGLICERIDOS: 2000,
  CREATININA: 20,
  BUN: 150,
  ACIDO_URICO: 20,
  TGO_AST: 500,
  TGP_ALT: 500,
  GGT: 500,
  BILIRRUBINA_TOTAL: 30,
  ALBUMINA: 7,
  PROTEINAS_TOTALES: 12,
  HEMOGLOBINA: 25,
  HEMATOCRITO: 70,
  HIERRO_SERICO: 400,
  FERRITINA: 3000,
  VITAMINA_D: 200,
  VITAMINA_B12: 2000,
  FOLATO: 50,
  TSH: 200,
};

function evaluateConfidence(code: LabTestCode, value: number): "high" | "medium" | "low" {
  const max = REASONABLE_MAX[code];
  if (max && value > max) return "low";
  if (value <= 0) return "low";
  return "high";
}

export interface ParseResult {
  results: ParsedLabValue[];
  unrecognizedLines: string[];
  rawText: string;
}

export function parseLabOcrText(rawText: string): ParseResult {
  const parsed: ParsedLabValue[] = [];
  const unrecognizedLines: string[] = [];
  const foundCodes = new Set<LabTestCode>();

  const lines = rawText
    .split(/\n/)
    .map(normalizeText)
    .filter((l) => l.length > 2);

  for (const line of lines) {
    let matched = false;

    for (const [pattern, code] of LABEL_PATTERNS) {
      if (pattern.test(line)) {
        if (foundCodes.has(code)) continue;

        const value = extractNumericValue(line);
        if (value !== null) {
          const confidence = evaluateConfidence(code, value);

          parsed.push({ test: code, value, rawMatch: line, confidence });
          foundCodes.add(code);
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      const hasNumber = /[\d,.]+\s*(?:mg\/dL|ng\/mL|pg\/mL|U\/L|%|g\/dL|µg\/dL)/i.test(line);
      if (hasNumber) {
        unrecognizedLines.push(line);
      }
    }
  }

  return { results: parsed, unrecognizedLines, rawText };
}

export function parsedToLabResults(parsed: ParsedLabValue[]): LabResultInput[] {
  return parsed.map((p) => ({
    test: p.test,
    value: p.value,
  }));
}
