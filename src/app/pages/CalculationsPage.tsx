import * as React from "react";
import { useTranslation } from "react-i18next";
import { PageHeader, PageContent } from "@app/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@components/ui/card";
import { Input } from "@components/ui/input";
import { Label } from "@components/ui/label";
import { Button } from "@components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Separator } from "@components/ui/separator";
import { calculateBMI, BMICategoryLabel } from "@utils/calculations/bmi";
import { calculateBMR, calculateBMRBoth, BMRFormulaLabel } from "@utils/calculations/bmr";
import { calculateTDEE, distributionToGrams, type ActivityFactor, ActivityLevel, ActivityLevelLabel, ActivityLevelDescription } from "@utils/calculations/tdee";
import { bodyFatFromBMI } from "@utils/calculations/bodyComposition";
import { calculateCKDepi2021, GFRCategoryLabel, classifyGFR, calculateHOMA, interpretHOMA, calculateLDL } from "@utils/calculations/labCalculations";

const bmiColor = (bmi: number): string => {
  if (bmi < 18.5) return "text-blue-500";
  if (bmi < 25) return "text-green-600";
  if (bmi < 30) return "text-amber-500";
  return "text-destructive";
};

function BMICalculator() {
  const { t } = useTranslation();
  const [weight, setWeight] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [result, setResult] = React.useState<{ bmi: number; category: string } | null>(null);
  const [error, setError] = React.useState("");

  const handleCalculate = () => {
    setError("");
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (!w || !h || h <= 0) { setError("Ingresa valores válidos"); return; }
    try {
      const res = calculateBMI({ weightKg: w, heightM: h / 100 });
      setResult({ bmi: res.value, category: BMICategoryLabel[res.category] });
    } catch (e) { setError((e as Error).message); setResult(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>IMC — Índice de Masa Corporal</CardTitle>
        <CardDescription>Peso (kg) / (talla en m)²</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bmi-weight">{t("calculations.weight_kg")}</Label>
            <Input id="bmi-weight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ej. 70" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bmi-height">{t("calculations.height_cm")}</Label>
            <Input id="bmi-height" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ej. 170" />
          </div>
        </div>
        <Button onClick={handleCalculate}>{t("calculations.calculate")}</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result && (
          <div className="rounded-lg border p-3 space-y-1">
            <p className="text-2xl font-bold">{result.bmi.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">kg/m²</span></p>
            <p className={`text-sm font-medium ${bmiColor(result.bmi)}`}>{result.category}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BMRCalculator() {
  const { t } = useTranslation();
  const [sex, setSex] = React.useState<"male" | "female">("female");
  const [weight, setWeight] = React.useState("");
  const [height, setHeight] = React.useState("");
  const [age, setAge] = React.useState("");
  const [formula, setFormula] = React.useState<"mifflin-st-jeor" | "harris-benedict">("mifflin-st-jeor");
  const [result, setResult] = React.useState<number | null>(null);
  const [bothResults, setBothResults] = React.useState<Record<string, number> | null>(null);
  const [error, setError] = React.useState("");

  const handleCalculate = () => {
    setError("");
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (!w || !h || a === undefined || a < 0) { setError("Ingresa valores válidos"); return; }
    try {
      setBothResults(null);
      const res = calculateBMR({ sex, weightKg: w, heightCm: h, ageYears: a }, formula);
      setResult(res.value);
    } catch (e) { setError((e as Error).message); setResult(null); }
  };

  const handleBoth = () => {
    setError("");
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (!w || !h || a === undefined || a < 0) { setError("Ingresa valores válidos"); return; }
    try {
      const res = calculateBMRBoth({ sex, weightKg: w, heightCm: h, ageYears: a });
      setBothResults({ "Mifflin-St Jeor": res["mifflin-st-jeor"].value, "Harris-Benedict": res["harris-benedict"].value });
      setResult(null);
    } catch (e) { setError((e as Error).message); setBothResults(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>TMB — Tasa Metabólica Basal</CardTitle>
        <CardDescription>Mifflin-St Jeor / Harris-Benedict (kcal/día)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bmr-sex">Sexo</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female")}>
              <SelectTrigger id="bmr-sex"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Femenino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="bmr-formula">{t("calculations.formula")}</Label>
            <Select value={formula} onValueChange={(v) => setFormula(v as "mifflin-st-jeor" | "harris-benedict")}>
              <SelectTrigger id="bmr-formula"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mifflin-st-jeor">{BMRFormulaLabel["mifflin-st-jeor"]}</SelectItem>
                <SelectItem value="harris-benedict">{BMRFormulaLabel["harris-benedict"]}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bmr-weight">{t("calculations.weight_kg")}</Label>
            <Input id="bmr-weight" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="ej. 70" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bmr-height">{t("calculations.height_cm")}</Label>
            <Input id="bmr-height" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="ej. 165" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bmr-age">Edad (años)</Label>
            <Input id="bmr-age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ej. 30" />
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleCalculate}>{t("calculations.calculate")}</Button>
          <Button variant="outline" onClick={handleBoth}>Ambas fórmulas</Button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {result !== null && (
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{result} <span className="text-sm font-normal text-muted-foreground">kcal/día</span></p>
          </div>
        )}
        {bothResults && (
          <div className="rounded-lg border p-3 space-y-1">
            {Object.entries(bothResults).map(([name, val]) => (
              <p key={name} className="flex justify-between"><span>{name}</span><span className="font-bold">{val} kcal</span></p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TDEECalculator() {
  const { t } = useTranslation();
  const [bmr, setBmr] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityFactor>(1.2);
  const [tdee, setTdee] = React.useState<number | null>(null);
  const [macro, setMacro] = React.useState<{ carbs: number; protein: number; fat: number } | null>(null);
  const [error, setError] = React.useState("");

  const handleCalculate = () => {
    setError("");
    const b = parseFloat(bmr);
    if (!b || b <= 0) { setError("Ingresa un BMR válido"); return; }
    try {
      const t = calculateTDEE(b, activity);
      setTdee(t);
      const grams = distributionToGrams(t, { carbsPct: 50, proteinPct: 25, fatPct: 25 });
      setMacro({ carbs: grams.carbsG, protein: grams.proteinG, fat: grams.fatG });
    } catch (e) { setError((e as Error).message); setTdee(null); setMacro(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>GET — Gasto Energético Total</CardTitle>
        <CardDescription>TDEE = TMB × factor de actividad + macronutrientes</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="tdee-bmr">TMB (kcal/día)</Label>
            <Input id="tdee-bmr" type="number" value={bmr} onChange={(e) => setBmr(e.target.value)} placeholder="ej. 1450" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tdee-activity">{t("calculations.activity_factor")}</Label>
            <Select value={String(activity)} onValueChange={(v) => setActivity(parseFloat(v) as ActivityFactor)}>
              <SelectTrigger id="tdee-activity"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ActivityLevel).map(([key, val]) => (
                  <SelectItem key={key} value={String(val)}>{ActivityLevelLabel[key as keyof typeof ActivityLevelLabel]} ({val})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">{tdee !== null && ActivityLevelDescription[Object.entries(ActivityLevel).find(([, v]) => v === activity)?.[0] as keyof typeof ActivityLevelDescription]}</div>
        <Button onClick={handleCalculate}>{t("calculations.calculate")}</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {tdee !== null && macro && (
          <div className="space-y-2">
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{tdee} <span className="text-sm font-normal text-muted-foreground">kcal/día</span></p>
            </div>
            <div className="rounded-lg border p-3 space-y-1 text-sm">
              <p className="font-medium mb-1">{t("calculations.macros_distribution")} (50/25/25)</p>
              <p className="flex justify-between"><span>{t("calculations.carbs_g")}</span><span className="font-bold">{macro.carbs}g</span></p>
              <p className="flex justify-between"><span>{t("calculations.protein_g")}</span><span className="font-bold">{macro.protein}g</span></p>
              <p className="flex justify-between"><span>{t("calculations.fat_g")}</span><span className="font-bold">{macro.fat}g</span></p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BodyCompCalculator() {
  const [bmi, setBmi] = React.useState("");
  const [age, setAge] = React.useState("");
  const [sex, setSex] = React.useState<"male" | "female">("female");
  const [fatPct, setFatPct] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");

  const handleCalculate = () => {
    setError("");
    const b = parseFloat(bmi);
    const a = parseFloat(age);
    if (!b || !a || a < 0) { setError("Ingresa valores válidos"); return; }
    try {
      setFatPct(bodyFatFromBMI({ bmi: b, ageYears: a, sex }));
    } catch (e) { setError((e as Error).message); setFatPct(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Composición corporal (Deurenberg)</CardTitle>
        <CardDescription>% grasa estimado desde IMC, edad y sexo</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bc-bmi">IMC (kg/m²)</Label>
            <Input id="bc-bmi" type="number" step="0.1" value={bmi} onChange={(e) => setBmi(e.target.value)} placeholder="ej. 24.2" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-age">Edad (años)</Label>
            <Input id="bc-age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ej. 35" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bc-sex">Sexo</Label>
            <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female")}>
              <SelectTrigger id="bc-sex"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Femenino</SelectItem>
                <SelectItem value="male">Masculino</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleCalculate}>Calcular % grasa</Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {fatPct !== null && (
          <div className="rounded-lg border p-3">
            <p className="text-2xl font-bold">{fatPct.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">% grasa corporal</span></p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LabCalculator() {
  const [creatinine, setCreatinine] = React.useState("");
  const [age, setAge] = React.useState("");
  const [sex, setSex] = React.useState<"male" | "female">("female");
  const [egfr, setEgfr] = React.useState<{ value: number; category: string } | null>(null);
  const [homaResult, setHomaResult] = React.useState<{ value: number; interpretation: string } | null>(null);
  const [ldlResult, setLdlResult] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");

  const [insulin, setInsulin] = React.useState("");
  const [glucose, setGlucose] = React.useState("");
  const [totalChol, setTotalChol] = React.useState("");
  const [hdl, setHdl] = React.useState("");
  const [tg, setTg] = React.useState("");

  const calcEgfr = () => {
    setError("");
    const cr = parseFloat(creatinine);
    const a = parseFloat(age);
    if (!cr || !a || a < 0) { setError("Ingresa creatinina y edad"); return; }
    try {
      const val = calculateCKDepi2021({ creatinineMgDl: cr, ageYears: a, sex });
      setEgfr({ value: val, category: GFRCategoryLabel[classifyGFR(val)] });
    } catch (e) { setError((e as Error).message); setEgfr(null); }
  };

  const calcHoma = () => {
    setError("");
    const ins = parseFloat(insulin);
    const glu = parseFloat(glucose);
    if (!ins || !glu) { setError("Ingresa insulina y glucosa"); return; }
    try {
      const val = calculateHOMA({ insulinUUiMl: ins, glucoseMgDl: glu });
      const interp = interpretHOMA(val);
      const labels = { sensible: "Sensible", borderline: "Borderline", resistente: "Resistencia" };
      setHomaResult({ value: val, interpretation: labels[interp] });
    } catch (e) { setError((e as Error).message); setHomaResult(null); }
  };

  const calcLdl = () => {
    setError("");
    const tc = parseFloat(totalChol);
    const h = parseFloat(hdl);
    const t = parseFloat(tg);
    if (!tc || !h || !t) { setError("Ingresa CT, HDL y TG"); return; }
    try {
      const val = calculateLDL({ totalCholesterolMgDl: tc, hdlMgDl: h, triglyceridesMgDl: t });
      if (val === null) { setError("TG ≥ 400 mg/dL — Friedewald no es válido"); setLdlResult(null); return; }
      setLdlResult(val);
    } catch (e) { setError((e as Error).message); setLdlResult(null); }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cálculos bioquímicos</CardTitle>
        <CardDescription>eGFR (CKD-EPI 2021), HOMA-IR, LDL (Friedewald)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <h4 className="font-medium">eGFR — Tasa de filtración glomerular</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="egfr-cr">Creatinina (mg/dL)</Label>
              <Input id="egfr-cr" type="number" step="0.01" value={creatinine} onChange={(e) => setCreatinine(e.target.value)} placeholder="ej. 0.9" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="egfr-age">Edad (años)</Label>
              <Input id="egfr-age" type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="ej. 45" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="egfr-sex">Sexo</Label>
              <Select value={sex} onValueChange={(v) => setSex(v as "male" | "female")}>
                <SelectTrigger id="egfr-sex"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">Femenino</SelectItem>
                  <SelectItem value="male">Masculino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button variant="secondary" onClick={calcEgfr}>Calcular eGFR</Button>
          {egfr && (
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{egfr.value} <span className="text-sm font-normal text-muted-foreground">mL/min/1.73m²</span></p>
              <p className="text-sm text-muted-foreground">{egfr.category}</p>
            </div>
          )}
        </div>
        <Separator />
        <div className="space-y-4">
          <h4 className="font-medium">HOMA-IR — Resistencia a la insulina</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="homa-ins">Insulina ayuno (µUI/mL)</Label>
              <Input id="homa-ins" type="number" step="0.1" value={insulin} onChange={(e) => setInsulin(e.target.value)} placeholder="ej. 12" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="homa-glu">Glucosa ayuno (mg/dL)</Label>
              <Input id="homa-glu" type="number" step="0.1" value={glucose} onChange={(e) => setGlucose(e.target.value)} placeholder="ej. 95" />
            </div>
          </div>
          <Button variant="secondary" onClick={calcHoma}>Calcular HOMA-IR</Button>
          {homaResult && (
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{homaResult.value.toFixed(2)}</p>
              <p className={`text-sm font-medium ${homaResult.interpretation === "Resistencia" ? "text-destructive" : homaResult.interpretation === "Borderline" ? "text-amber-500" : "text-green-600"}`}>{homaResult.interpretation}</p>
            </div>
          )}
        </div>
        <Separator />
        <div className="space-y-4">
          <h4 className="font-medium">LDL (Friedewald)</h4>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ldl-ct">Colesterol total (mg/dL)</Label>
              <Input id="ldl-ct" type="number" value={totalChol} onChange={(e) => setTotalChol(e.target.value)} placeholder="ej. 200" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldl-hdl">HDL (mg/dL)</Label>
              <Input id="ldl-hdl" type="number" value={hdl} onChange={(e) => setHdl(e.target.value)} placeholder="ej. 45" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ldl-tg">Triglicéridos (mg/dL)</Label>
              <Input id="ldl-tg" type="number" value={tg} onChange={(e) => setTg(e.target.value)} placeholder="ej. 150" />
            </div>
          </div>
          <Button variant="secondary" onClick={calcLdl}>Calcular LDL</Button>
          {ldlResult !== null && (
            <div className="rounded-lg border p-3">
              <p className="text-2xl font-bold">{ldlResult} <span className="text-sm font-normal text-muted-foreground">mg/dL</span></p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}

export function CalculationsPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("calculations.clinical_title")}
        description={t("calculations.page_description")}
      />
      <PageContent>
        <div className="grid gap-6 md:grid-cols-2">
          <BMICalculator />
          <BMRCalculator />
          <TDEECalculator />
          <BodyCompCalculator />
          <div className="md:col-span-2">
            <LabCalculator />
          </div>
        </div>
      </PageContent>
    </>
  );
}
