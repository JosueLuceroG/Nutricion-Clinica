/**
 * Cálculos especializados de laboratorio.
 *
 *  1. **eGFR — CKD-EPI 2021 (race-free)**
 *     Estimación de la tasa de filtración glomerular sin factor de raza.
 *     Referencia: Inker LA et al. NEJM 2021;385(19):1737-1749.
 *
 *  2. **HOMA-IR**
 *     (Insulina ayuno × Glucosa ayuno) / 405
 *     Punto de corte ≥2.5 sugiere resistencia a la insulina (Matthews 1985).
 *
 *  3. **LDL calculado (Friedewald)**
 *     LDL = CT − HDL − (TG/5)
 *     Válido solo si TG < 400 mg/dL.
 *
 *  4. **Relación CT/HDL y TG/HDL** — índices de riesgo cardiovascular.
 */

export interface CKDepiInput {
  creatinineMgDl: number;
  ageYears: number;
  sex: "male" | "female";
}

export const calculateCKDepi2021 = ({ creatinineMgDl, ageYears, sex }: CKDepiInput): number => {
  if (!Number.isFinite(creatinineMgDl) || creatinineMgDl <= 0) {
    throw new RangeError("Creatinina inválida.");
  }
  if (ageYears < 18 || ageYears > 120) {
    throw new RangeError("Edad fuera de rango (18-120).");
  }
  const kappa: Record<"male" | "female", number> = { male: 0.9, female: 0.7 };
  const alpha: Record<"male" | "female", number> = {
    male: -0.302,
    female: -0.241,
  };
  const sexFactor = sex === "female" ? 1.012 : 1.0;
  const k = kappa[sex];
  const a = alpha[sex];
  const scr = creatinineMgDl;
  const scrK = scr / k;
  const f = scrK < 1 ? scrK ** a : scrK ** -1.2;
  const ageFactor = 0.9938 ** ageYears;
  const egfr = 142 * f * ageFactor * sexFactor;
  return Math.round(egfr * 10) / 10;
};

export type GFRCategory = "G1" | "G2" | "G3a" | "G3b" | "G4" | "G5";

export const classifyGFR = (egfr: number): GFRCategory => {
  if (egfr >= 90) return "G1";
  if (egfr >= 60) return "G2";
  if (egfr >= 45) return "G3a";
  if (egfr >= 30) return "G3b";
  if (egfr >= 15) return "G4";
  return "G5";
};

export const GFRCategoryLabel: Record<GFRCategory, string> = {
  G1: "G1 — Normal o alto (≥90)",
  G2: "G2 — Levemente disminuido (60-89)",
  G3a: "G3a — Leve a moderadamente disminuido (45-59)",
  G3b: "G3b — Moderado a gravemente disminuido (30-44)",
  G4: "G4 — Gravemente disminuido (15-29)",
  G5: "G5 — Falla renal (<15)",
};

export interface HOMAInput {
  insulinUUiMl: number;
  glucoseMgDl: number;
}

export const calculateHOMA = ({ insulinUUiMl, glucoseMgDl }: HOMAInput): number => {
  if (insulinUUiMl <= 0 || glucoseMgDl <= 0) {
    throw new RangeError("Insulina y glucosa deben ser positivas.");
  }
  return Math.round(((insulinUUiMl * glucoseMgDl) / 405) * 100) / 100;
};

export const HOMAThreshold = 2.5;

export const interpretHOMA = (homa: number): "sensible" | "borderline" | "resistente" => {
  if (homa < 1.5) return "sensible";
  if (homa < HOMAThreshold) return "borderline";
  return "resistente";
};

export interface FriedewaldInput {
  totalCholesterolMgDl: number;
  hdlMgDl: number;
  triglyceridesMgDl: number;
}

export const calculateLDL = ({ totalCholesterolMgDl, hdlMgDl, triglyceridesMgDl }: FriedewaldInput): number | null => {
  if (triglyceridesMgDl >= 400) return null;
  if (totalCholesterolMgDl <= 0 || hdlMgDl <= 0 || triglyceridesMgDl <= 0) {
    throw new RangeError("Valores de lipídos deben ser positivos.");
  }
  const ldl = totalCholesterolMgDl - hdlMgDl - triglyceridesMgDl / 5;
  return Math.round(ldl * 10) / 10;
};

export const calculateCholHDLRatio = (totalCholesterolMgDl: number, hdlMgDl: number): number => {
  if (hdlMgDl <= 0) throw new RangeError("HDL debe ser positivo.");
  return Math.round((totalCholesterolMgDl / hdlMgDl) * 100) / 100;
};

export const calculateTGHDLRatio = (triglyceridesMgDl: number, hdlMgDl: number): number => {
  if (hdlMgDl <= 0) throw new RangeError("HDL debe ser positivo.");
  return Math.round((triglyceridesMgDl / hdlMgDl) * 100) / 100;
};
