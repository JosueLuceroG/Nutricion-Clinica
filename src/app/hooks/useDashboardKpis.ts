import * as React from "react";
import { patientService } from "@services/patientService";
import { consultationService } from "@services/consultationService";
import { mealPlanService } from "@services/mealPlanService";
import type { Patient } from "@modules/patient/domain/Patient";
import type { Consultation } from "@modules/consultation/domain/Consultation";
import type { MealPlan } from "@modules/mealplan/domain/MealPlan";

export interface DashboardKpis {
  totalActivePatients: number;
  totalPatients: number;
  activePlans: number;
  consultationsThisMonth: number;
  upcomingConsultations: Consultation[];
  expiringPlans: MealPlan[];
  recentPatients: Patient[];
  pendingSync: number;
}

interface AsyncState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

const initial: AsyncState<never> = { data: null, error: null, loading: true };

const startOfMonth = (d: Date): Date => {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
};

const endOfMonth = (d: Date): Date => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
};

const withinDays = (d: Date, days: number): boolean => {
  const now = Date.now();
  const target = d.getTime();
  return target >= now && target <= now + days * 24 * 60 * 60 * 1000;
};

export function useDashboardKpis(): AsyncState<DashboardKpis> & { reload: () => void } {
  const [state, setState] = React.useState<AsyncState<DashboardKpis>>(initial);

  const load = React.useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    const now = new Date();
    Promise.all([
      patientService.list.execute({ limit: 200 }),
      patientService.list.execute({ status: "active", limit: 1 }),
      mealPlanService.list.execute({ status: "active", limit: 100 }),
      mealPlanService.list.execute({ status: "active", limit: 100 }),
      consultationService.list.execute({
        from: startOfMonth(now),
        to: endOfMonth(now),
        limit: 200,
      }),
      consultationService.list.execute({
        status: ["scheduled", "in-progress"],
        limit: 50,
      }),
    ])
      .then(
        ([
          patientsAll,
          patientsActive,
          activePlansAll,
          activePlansExpiring,
          consultsThisMonth,
          upcomingConsultations,
        ]) => {
          const expiring = (activePlansExpiring.items as MealPlan[]).filter(
            (p) => p.endDate && withinDays(p.endDate, 30),
          );
          const recent = [...(patientsAll.items as Patient[])]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .slice(0, 5);
          setState({
            data: {
              totalPatients: patientsAll.total,
              totalActivePatients: patientsActive.total,
              activePlans: activePlansAll.total,
              consultationsThisMonth: consultsThisMonth.total,
              upcomingConsultations: upcomingConsultations.items as Consultation[],
              expiringPlans: expiring,
              recentPatients: recent,
              pendingSync: 0,
            },
            error: null,
            loading: false,
          });
        },
      )
      .catch((err) =>
        setState({
          data: null,
          error: err instanceof Error ? err : new Error(String(err)),
          loading: false,
        }),
      );
  }, []);

  React.useEffect(() => {
    load();
  }, [load]);

  return { ...state, reload: load };
}
