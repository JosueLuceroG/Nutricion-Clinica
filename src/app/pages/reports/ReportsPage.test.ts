import { describe, expect, it } from "vitest";
import type { DashboardMetrics } from "@services/api/dashboardApi";
import { buildPathologyDistribution, buildReportKpis } from "./ReportsPage";

const metrics: DashboardMetrics = {
  pacientes: {
    total: 20,
    activos: 15,
    inactivos: 3,
    archivados: 2,
    nuevosEsteMes: 4,
  },
  sexoDistribucion: [],
  consultas: {
    total: 42,
    esteMes: 7,
    pendientesPago: 5,
  },
  planesAlimenticios: {
    activos: 10,
    porVencer: 2,
  },
  adherencia: {
    promedioGlobal: 86.456,
    totalRegistros: 9,
  },
  patologias: [
    { tag: "Diabetes", count: 6 },
    { tag: "Hipertension", count: 4 },
  ],
};

describe("ReportsPage metric builders", () => {
  it("buildReportKpis maps aggregated backend metrics", () => {
    expect(buildReportKpis(metrics)).toEqual({
      consultationsPerWeek: 42,
      averageAdherence: 86.46,
      activePatients: 15,
      consultationsThisMonth: 7,
      pendingPayments: 5,
    });
  });

  it("buildReportKpis returns safe zero defaults without backend metrics", () => {
    expect(buildReportKpis(null)).toEqual({
      consultationsPerWeek: 0,
      averageAdherence: 0,
      activePatients: 0,
      consultationsThisMonth: 0,
      pendingPayments: 0,
    });
  });

  it("buildPathologyDistribution maps backend pathology counts", () => {
    expect(buildPathologyDistribution(metrics)).toEqual([
      { name: "Diabetes", value: 6 },
      { name: "Hipertension", value: 4 },
    ]);
  });
});
