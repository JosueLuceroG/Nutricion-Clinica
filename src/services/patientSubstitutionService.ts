import * as React from "react";
import type { PatientId } from "@modules/patient/domain/PatientId";
import {
  getPatientSubstitutions,
  createPatientSubstitution,
  deletePatientSubstitution,
  type PatientSubstitution,
  type SubstitutionInput,
} from "./api/patientSubstitutionApi";

export function usePatientSubstitutions(patientId: PatientId | string | null) {
  const pid = typeof patientId === "string" ? patientId : patientId?.toString() ?? null;
  const [substitutions, setSubs] = React.useState<PatientSubstitution[]>([]);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!pid) return;
    setLoading(true);
    try {
      const data = await getPatientSubstitutions(pid);
      setSubs(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [pid]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  const saveSubstitution = React.useCallback(async (input: SubstitutionInput) => {
    if (!pid) return;
    await createPatientSubstitution(pid, input);
    await refresh();
  }, [pid, refresh]);

  const removeSubstitution = React.useCallback(async (subId: number) => {
    if (!pid) return;
    await deletePatientSubstitution(pid, subId);
    await refresh();
  }, [pid, refresh]);

  const getSubstitutionMap = React.useCallback((): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const s of substitutions) {
      if (s.originalFoodId) {
        map[s.originalFoodId] = s.substituteFoodId;
      }
    }
    return map;
  }, [substitutions]);

  return { substitutions, loading, refresh, saveSubstitution, removeSubstitution, getSubstitutionMap };
}
