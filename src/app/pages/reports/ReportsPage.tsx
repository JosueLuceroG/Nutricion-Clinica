import * as React from "react";
import { ReportsPage as ReportsView } from "@modules/reports/ui/ReportsPage";
import { useIndicators } from "@modules/reports/ui/useReportHooks";
import { reportService } from "@services/reportService";
import { calculateConsultationsPerWeek, calculateAverageAdherence, calculateActivePatientCount, calculateConsultationsThisMonth, calculatePendingPayments } from "@modules/reports/application/kpiEngine";
import { db } from "@services/db/dexieSchema";
import { useLiveQuery } from "dexie-react-hooks";

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

  const indicatorValues = React.useMemo(() => new Map(), []);

  const loading = indicatorsLoading || !consultations || !adherenceIndexes || !patients;

  return (
    <ReportsView
      service={reportService}
      kpis={kpis}
      indicators={indicators}
      indicatorValues={indicatorValues}
      loading={loading}
      onRefresh={refresh}
    />
  );
}
