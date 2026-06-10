import * as React from "react";
import { ReportsPage as ReportsView } from "@modules/reports/ui/ReportsPage";
import { useIndicators } from "@modules/reports/ui/useReportHooks";
import { reportService } from "@services/reportService";
import { calculateConsultationsPerWeek, calculateAverageAdherence, calculateActivePatientCount, calculateConsultationsThisMonth, calculatePendingPayments, calculatePathologyDistribution } from "@modules/reports/application/kpiEngine";
import { db } from "@services/db/dexieSchema";
import { useLiveQuery } from "dexie-react-hooks";

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function ReportsPage() {
  const { indicators, loading: indicatorsLoading, refresh } = useIndicators(reportService);

  const consultations = useLiveQuery(() => db.consultations.toArray(), [], []);
  const adherenceIndexes = useLiveQuery(() => db.adherence_indexes.toArray(), [], []);
  const patients = useLiveQuery(() => db.patients.toArray(), [], []);

  const kpis = React.useMemo(() => ({
    consultationsPerWeek: calculateConsultationsPerWeek(consultations ?? []),
    averageAdherence: calculateAverageAdherence(adherenceIndexes ?? []),
    activePatients: calculateActivePatientCount(patients ?? []),
    consultationsThisMonth: calculateConsultationsThisMonth(consultations ?? []),
    pendingPayments: calculatePendingPayments(consultations ?? []),
  }), [consultations, adherenceIndexes, patients]);

  const pathologyDistribution = React.useMemo(() => {
    if (!patients || patients.length === 0) return undefined;
    const dist = calculatePathologyDistribution((patients ?? []) as Parameters<typeof calculatePathologyDistribution>[0]);
    return Object.entries(dist).map(([name, value]) => ({ name, value }));
  }, [patients]);

  const consultationTrends = React.useMemo(() => {
    if (!consultations || consultations.length === 0) return undefined;
    const byMonth = new Map<string, { consultations: number; payments: number }>();
    for (const c of consultations) {
      const d = new Date(c.consultation_date as string);
      const key = `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
      const entry = byMonth.get(key) ?? { consultations: 0, payments: 0 };
      entry.consultations++;
      if ((c as { paid?: boolean }).paid) entry.payments++;
      byMonth.set(key, entry);
    }
    return Array.from(byMonth.entries()).sort().map(([month, data]) => ({ month, ...data }));
  }, [consultations]);

  const indicatorValues = React.useMemo(() => new Map(), []);

  const loading = indicatorsLoading || !consultations || !adherenceIndexes || !patients;

  return (
    <ReportsView
      service={reportService}
      kpis={kpis}
      indicators={indicators}
      indicatorValues={indicatorValues}
      pathologyDistribution={pathologyDistribution}
      consultationTrends={consultationTrends}
      loading={loading}
      onRefresh={refresh}
    />
  );
}
