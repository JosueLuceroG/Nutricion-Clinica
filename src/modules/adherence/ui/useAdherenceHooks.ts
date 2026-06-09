import * as React from "react";
import { adherenceService } from "@services/adherenceService";
import type { AdherenceRecord } from "../domain/AdherenceRecord";
import type { AdherenceFormInput } from "../application/adherenceFormSchema";

export function useAdherence(patientId: string) {
  const [records, setRecords] = React.useState<AdherenceRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await adherenceService.listByPatient(patientId);
      setRecords(data);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { void refresh(); }, [refresh]);

  return { records, loading, refresh };
}

export function useCreateAdherenceRecord() {
  const [creating, setCreating] = React.useState(false);

  const create = React.useCallback(async (input: AdherenceFormInput) => {
    setCreating(true);
    try {
      return await adherenceService.createRecord(input);
    } finally {
      setCreating(false);
    }
  }, []);

  return { create, creating };
}
