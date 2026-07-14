import { describe, expect, it } from "vitest";
import { parseResponse } from "./AIResponseParser";

describe("parseResponse generateDashboardKpi", () => {
  it("acepta una propuesta declarativa con campos conocidos", () => {
    const response = parseResponse("generateDashboardKpi", JSON.stringify({
      name: "Citas por confirmar",
      description: "Porcentaje de citas que aún requieren confirmación.",
      source: "agenda",
      valueField: "agenda.unconfirmed",
      metric: "percentage",
      comparison: "none",
      visualization: "progress",
      tone: "blue",
      iconKey: "calendar",
      category: "agenda",
      size: "wide",
      precision: 1,
      notation: "standard",
      prefix: "",
      suffix: "",
      trendDirection: "increaseIsPositive",
      reasoning: "El porcentaje permite leer rápidamente la proporción pendiente.",
    }));

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({ source: "agenda", valueField: "agenda.unconfirmed" });
  });

  it("rechaza campos inventados por el modelo", () => {
    const response = parseResponse("generateDashboardKpi", JSON.stringify({
      name: "KPI arbitrario",
      description: "No debe aceptarse.",
      source: "agenda",
      valueField: "agenda.privateSqlQuery",
      metric: "count",
      comparison: "none",
      visualization: "largeNumber",
      tone: "blue",
      iconKey: "calendar",
      category: "agenda",
      size: "small",
      precision: 0,
      notation: "standard",
      prefix: "",
      suffix: "",
      trendDirection: "neutral",
      reasoning: "Campo inventado.",
    }));

    expect(response.success).toBe(false);
  });

  it("normaliza alias seguros producidos por modelos locales", () => {
    const response = parseResponse<{ visualization: string; tone: string; precision: number }>("generateDashboardKpi", JSON.stringify({
      name: "Citas sin confirmar",
      description: "Porcentaje pendiente de confirmación.",
      source: "agenda",
      valueField: "agenda.unconfirmed",
      metric: "porcentaje",
      comparison: "ninguno",
      visualization: "simpleCard (barra)",
      tone: "azul",
      iconKey: "calendario",
      category: "agenda",
      size: "ancho",
      precision: 0.1,
      notation: "completa",
      prefix: "",
      suffix: "",
      trendDirection: "neutro",
      reasoning: "Una barra facilita leer el avance.",
    }));

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({ visualization: "progress", tone: "blue", precision: 1 });
  });

  it("completa opciones avanzadas omitidas sin relajar campos esenciales", () => {
    const response = parseResponse<{ precision: number; notation: string; prefix: string; suffix: string; trendDirection: string }>("generateDashboardKpi", JSON.stringify({
      name: "Citas sin confirmar",
      description: "Porcentaje pendiente de confirmación.",
      source: "agenda",
      valueField: "agenda.unconfirmed",
      metric: "percentage",
      comparison: "none",
      visualization: "progress",
      tone: "blue",
      iconKey: "calendar",
      category: "agenda",
      size: "wide",
    }));

    expect(response.success).toBe(true);
    expect(response.data).toMatchObject({
      precision: 1,
      notation: "standard",
      prefix: "",
      suffix: "",
      trendDirection: "neutral",
      reasoning: expect.stringContaining("indicadores permitidos"),
    });
  });
});
