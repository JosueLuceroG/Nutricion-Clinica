import { describe, expect, it } from "vitest";
import type { DashboardMetrics } from "@services/api/dashboardApi";
import { buildLocalReportDashboardData, buildPathologyDistribution, buildReportKpis, type LocalReportSource } from "./ReportsPage";

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

  it("buildLocalReportDashboardData aggregates offline fallback data", () => {
    const local = buildLocalReportDashboardData({
      now: new Date("2026-06-12T12:00:00.000Z"),
      patients: [
        { id: "p1", sucursal_id: "s1", status: "active", deleted_at: null, created_at: "2026-06-02T00:00:00.000Z", clinical_tags: JSON.stringify(["Diabetes", "Hipertension"]) },
        { id: "p2", sucursal_id: "s1", status: "active", deleted_at: null, created_at: "2026-05-15T00:00:00.000Z", clinical_tags: JSON.stringify(["Diabetes"]) },
        { id: "p3", sucursal_id: "s1", status: "inactive", deleted_at: null, created_at: "2026-06-03T00:00:00.000Z", clinical_tags: JSON.stringify(["No cuenta"]) },
        { id: "p4", sucursal_id: "s1", status: "active", deleted_at: "2026-06-04T00:00:00.000Z", created_at: "2026-06-01T00:00:00.000Z", clinical_tags: "[invalid" },
      ],
      totalConsultations: 12,
      monthConsultations: [
        { sucursal_id: "s1", patient_id: "p1", consultation_date: "2026-06-01T10:00:00.000Z", paid: true, deleted_at: null },
        { sucursal_id: "s1", patient_id: "p2", consultation_date: "2026-06-02T10:00:00.000Z", paid: false, deleted_at: null },
        { sucursal_id: "s1", patient_id: "p2", consultation_date: "2026-06-03T10:00:00.000Z", paid: false, deleted_at: "2026-06-04T00:00:00.000Z" },
      ],
      pendingPayments: 3,
      adherenceIndexes: [{ sucursal_id: "s1", patient_id: "p1", score_global: 80 }, { sucursal_id: "s1", patient_id: "p2", score_global: 90 }],
      trendConsultations: [
        { sucursal_id: "s1", patient_id: "p1", consultation_date: "2026-05-20T10:00:00.000Z", paid: true, deleted_at: null },
        { sucursal_id: "s1", patient_id: "p2", consultation_date: "2026-06-02T10:00:00.000Z", paid: false, deleted_at: null },
      ],
    } satisfies LocalReportSource);

    expect(buildReportKpis(local.metrics)).toEqual({
      consultationsPerWeek: 12,
      averageAdherence: 85,
      activePatients: 2,
      consultationsThisMonth: 2,
      pendingPayments: 3,
    });
    expect(local.metrics.patologias).toEqual([
      { tag: "Diabetes", count: 2 },
      { tag: "Hipertension", count: 1 },
    ]);
    expect(local.consultationTrends).toEqual([
      { month: "May 2026", consultations: 1, payments: 1 },
      { month: "Jun 2026", consultations: 1, payments: 0 },
    ]);
  });

  it("buildLocalReportDashboardData filters offline fallback by sucursal", () => {
    const local = buildLocalReportDashboardData({
      sucursalId: "s1",
      now: new Date("2026-06-12T12:00:00.000Z"),
      patients: [
        { id: "p1", sucursal_id: "s1", status: "active", deleted_at: null, created_at: "2026-06-02T00:00:00.000Z", clinical_tags: JSON.stringify(["Diabetes"]) },
        { id: "p2", sucursal_id: "s2", status: "active", deleted_at: null, created_at: "2026-06-02T00:00:00.000Z", clinical_tags: JSON.stringify(["Hipertension"]) },
      ],
      totalConsultations: 1,
      monthConsultations: [
        { sucursal_id: "s1", patient_id: "p1", consultation_date: "2026-06-01T10:00:00.000Z", paid: true, deleted_at: null },
        { sucursal_id: "s2", patient_id: "p2", consultation_date: "2026-06-02T10:00:00.000Z", paid: true, deleted_at: null },
      ],
      pendingPayments: 0,
      adherenceIndexes: [
        { sucursal_id: "s1", patient_id: "p1", score_global: 90 },
        { sucursal_id: "s2", patient_id: "p2", score_global: 50 },
      ],
      trendConsultations: [
        { sucursal_id: "s1", patient_id: "p1", consultation_date: "2026-06-01T10:00:00.000Z", paid: true, deleted_at: null },
        { sucursal_id: "s2", patient_id: "p2", consultation_date: "2026-06-02T10:00:00.000Z", paid: true, deleted_at: null },
      ],
    } satisfies LocalReportSource);

    expect(buildReportKpis(local.metrics)).toEqual({
      consultationsPerWeek: 1,
      averageAdherence: 90,
      activePatients: 1,
      consultationsThisMonth: 1,
      pendingPayments: 0,
    });
    expect(local.metrics.patologias).toEqual([{ tag: "Diabetes", count: 1 }]);
    expect(local.consultationTrends).toEqual([{ month: "Jun 2026", consultations: 1, payments: 1 }]);
  });
});
