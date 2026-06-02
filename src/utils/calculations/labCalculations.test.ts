import { describe, it, expect } from "vitest";
import {
  calculateCKDepi2021,
  classifyGFR,
  calculateHOMA,
  interpretHOMA,
  calculateLDL,
  calculateCholHDLRatio,
  calculateTGHDLRatio,
} from "./labCalculations";

describe("calculateCKDepi2021", () => {
  it("mujer 40 años creatinina 0.9 → ~92", () => {
    const egfr = calculateCKDepi2021({ creatinineMgDl: 0.9, ageYears: 40, sex: "female" });
    expect(egfr).toBeGreaterThan(80);
    expect(egfr).toBeLessThan(110);
  });

  it("hombre 60 años creatinina 1.2 → ~70 (G2)", () => {
    const egfr = calculateCKDepi2021({ creatinineMgDl: 1.2, ageYears: 60, sex: "male" });
    expect(egfr).toBeGreaterThan(50);
    expect(egfr).toBeLessThan(95);
  });

  it("eGFR es menor en mujeres que en hombres con misma creatinina (umbral k=0.7 vs 0.9)", () => {
    const m = calculateCKDepi2021({ creatinineMgDl: 1.0, ageYears: 50, sex: "male" });
    const f = calculateCKDepi2021({ creatinineMgDl: 1.0, ageYears: 50, sex: "female" });
    expect(f).toBeLessThan(m);
  });

  it("mujer con creatinina 0.7 ≈ hombre con creatinina 0.9 (mismo eGFR esperado)", () => {
    const m = calculateCKDepi2021({ creatinineMgDl: 0.9, ageYears: 50, sex: "male" });
    const f = calculateCKDepi2021({ creatinineMgDl: 0.7, ageYears: 50, sex: "female" });
    expect(Math.abs(f - m)).toBeLessThan(5);
  });

  it("eGFR disminuye con la edad (mismo sexo, misma creatinina)", () => {
    const y = calculateCKDepi2021({ creatinineMgDl: 1.0, ageYears: 30, sex: "male" });
    const o = calculateCKDepi2021({ creatinineMgDl: 1.0, ageYears: 70, sex: "male" });
    expect(o).toBeLessThan(y);
  });

  it("rechaza creatinina inválida", () => {
    expect(() =>
      calculateCKDepi2021({ creatinineMgDl: 0, ageYears: 40, sex: "male" }),
    ).toThrow(RangeError);
    expect(() =>
      calculateCKDepi2021({ creatinineMgDl: -1, ageYears: 40, sex: "male" }),
    ).toThrow(RangeError);
  });

  it("rechaza edad fuera de rango (solo adultos)", () => {
    expect(() =>
      calculateCKDepi2021({ creatinineMgDl: 1, ageYears: 17, sex: "male" }),
    ).toThrow(RangeError);
  });
});

describe("classifyGFR", () => {
  it("categorías KDIGO", () => {
    expect(classifyGFR(95)).toBe("G1");
    expect(classifyGFR(75)).toBe("G2");
    expect(classifyGFR(50)).toBe("G3a");
    expect(classifyGFR(35)).toBe("G3b");
    expect(classifyGFR(20)).toBe("G4");
    expect(classifyGFR(10)).toBe("G5");
  });
});

describe("calculateHOMA", () => {
  it("insulina 10 µUI/mL, glucosa 90 mg/dL → 2.22", () => {
    const homa = calculateHOMA({ insulinUUiMl: 10, glucoseMgDl: 90 });
    expect(homa).toBeCloseTo(2.22, 2);
  });

  it("rechaza valores no positivos", () => {
    expect(() => calculateHOMA({ insulinUUiMl: 0, glucoseMgDl: 90 })).toThrow(RangeError);
    expect(() => calculateHOMA({ insulinUUiMl: 10, glucoseMgDl: 0 })).toThrow(RangeError);
  });
});

describe("interpretHOMA", () => {
  it("clasifica según punto de corte 2.5", () => {
    expect(interpretHOMA(1.0)).toBe("sensible");
    expect(interpretHOMA(2.0)).toBe("borderline");
    expect(interpretHOMA(3.5)).toBe("resistente");
  });
});

describe("calculateLDL (Friedewald)", () => {
  it("CT 200, HDL 50, TG 150 → LDL = 120", () => {
    const ldl = calculateLDL({ totalCholesterolMgDl: 200, hdlMgDl: 50, triglyceridesMgDl: 150 });
    expect(ldl).toBe(120);
  });

  it("retorna null si TG >= 400 (Friedewald no aplica)", () => {
    const ldl = calculateLDL({ totalCholesterolMgDl: 300, hdlMgDl: 50, triglyceridesMgDl: 450 });
    expect(ldl).toBeNull();
  });

  it("rechaza HDL no positivo", () => {
    expect(() =>
      calculateLDL({ totalCholesterolMgDl: 200, hdlMgDl: 0, triglyceridesMgDl: 150 }),
    ).toThrow(RangeError);
  });
});

describe("calculateCholHDLRatio / calculateTGHDLRatio", () => {
  it("CT/HDL: 200/50 = 4.0", () => {
    expect(calculateCholHDLRatio(200, 50)).toBe(4);
  });
  it("TG/HDL: 150/50 = 3.0", () => {
    expect(calculateTGHDLRatio(150, 50)).toBe(3);
  });
});
