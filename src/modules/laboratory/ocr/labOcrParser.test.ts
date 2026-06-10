import { describe, it, expect } from "vitest";
import { parseLabOcrText, parsedToLabResults } from "./labOcrParser";

describe("parseLabOcrText", () => {
  it("parses glucosa with colon separator", () => {
    const result = parseLabOcrText("Glucosa: 95 mg/dL");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.test).toBe("GLUCOSA");
    expect(result.results[0]!.value).toBe(95);
    expect(result.results[0]!.confidence).toBe("high");
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("parses multiple lab results from a typical report", () => {
    const text = `
      Glucosa: 110 mg/dL
      Colesterol Total: 200 mg/dL
      Triglicéridos 150 mg/dL
      Creatinina 0.95 mg/dL
      Ácido Úrico: 6.5 mg/dL
    `;
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(5);
    expect(result.results.map((r) => r.test)).toEqual([
      "GLUCOSA",
      "COLESTEROL_TOTAL",
      "TRIGLICERIDOS",
      "CREATININA",
      "ACIDO_URICO",
    ]);
    expect(result.results.find((r) => r.test === "GLUCOSA")!.value).toBe(110);
    expect(result.results.find((r) => r.test === "CREATININA")!.value).toBe(0.95);
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("parses HbA1c alternative formats", () => {
    const r1 = parseLabOcrText("HbA1c: 7.2 %");
    expect(r1.results).toHaveLength(1);
    expect(r1.results[0]!.test).toBe("HBA1C");
    expect(r1.results[0]!.value).toBe(7.2);

    const r2 = parseLabOcrText("Hemoglobina Glucosilada 6.5 %");
    expect(r2.results).toHaveLength(1);
    expect(r2.results[0]!.test).toBe("HBA1C");
    expect(r2.results[0]!.value).toBe(6.5);
  });

  it("parses lipid profile with LDL/HDL", () => {
    const text = `
      Colesterol LDL: 130 mg/dL
      Colesterol HDL: 45 mg/dL
      Triglicéridos 180 mg/dL
    `;
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(3);
    expect(result.results.find((r) => r.test === "LDL")!.value).toBe(130);
    expect(result.results.find((r) => r.test === "HDL")!.value).toBe(45);
  });

  it("parses liver function tests", () => {
    const text = "TGO (AST): 35 U/L\nTGP (ALT): 40 U/L\nGGT: 25 U/L";
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(3);
    expect(result.results.find((r) => r.test === "TGO_AST")!.value).toBe(35);
    expect(result.results.find((r) => r.test === "TGP_ALT")!.value).toBe(40);
    expect(result.results.find((r) => r.test === "GGT")!.value).toBe(25);
  });

  it("parses vitamins and thyroid", () => {
    const text = "Vitamina D (25-OH): 32.5 ng/mL\nVitamina B12: 450 pg/mL\nTSH: 2.50 µUI/mL";
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(3);
    expect(result.results.find((r) => r.test === "VITAMINA_D")!.value).toBe(32.5);
    expect(result.results.find((r) => r.test === "VITAMINA_B12")!.value).toBe(450);
    expect(result.results.find((r) => r.test === "TSH")!.value).toBe(2.5);
  });

  it("returns low confidence for physiologically impossible values", () => {
    const result = parseLabOcrText("Glucosa: 9999 mg/dL");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.test).toBe("GLUCOSA");
    expect(result.results[0]!.confidence).toBe("low");
  });

  it("collects unrecognized lines that contain measurements", () => {
    const text = `
      Glucosa: 95 mg/dL
      Proteina C Reactiva: 2.5 mg/dL
      Homocisteina: 12.0 µmol/L
    `;
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(1);
    expect(result.unrecognizedLines.length).toBeGreaterThanOrEqual(1);
  });

  it("handles empty text", () => {
    const result = parseLabOcrText("");
    expect(result.results).toHaveLength(0);
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("ignores lines without numbers", () => {
    const text = "Paciente: Juan Pérez\nGlucosa: 95 mg/dL\n";
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(1);
    expect(result.unrecognizedLines).toHaveLength(0);
  });

  it("handles decimal comma (European/South American format)", () => {
    const result = parseLabOcrText("Creatinina: 0,95 mg/dL");
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.value).toBe(0.95);
  });

  it("does not duplicate tests if the same test appears twice", () => {
    const text = "Glucosa: 95 mg/dL\nGlucosa: 100 mg/dL";
    const result = parseLabOcrText(text);
    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.value).toBe(95);
  });
});

describe("parsedToLabResults", () => {
  it("converts ParsedLabValue[] to LabResultInput[]", () => {
    const parsed = [
      { test: "GLUCOSA" as const, value: 95, rawMatch: "", confidence: "high" as const },
      { test: "HDL" as const, value: 55, rawMatch: "", confidence: "high" as const },
    ];
    const results = parsedToLabResults(parsed);
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ test: "GLUCOSA", value: 95 });
    expect(results[1]).toEqual({ test: "HDL", value: 55 });
  });
});
