import { useState, useEffect, useCallback } from "react";
import { medicationService } from "@services/medicationService";
import type { MedicationCatalog } from "../domain/MedicationCatalog";
import type { MedicationCatalogId } from "../domain/MedicationCatalogId";
import type { MedicationCatalogFormInput } from "../application/medicationFormSchema";

export function useMedicationCatalog() {
  const [medications, setMedications] = useState<MedicationCatalog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setMedications(await medicationService.list()); }
    catch { setMedications([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { medications, loading, refresh };
}

export function useMedication(id: MedicationCatalogId | undefined) {
  const [medication, setMedication] = useState<MedicationCatalog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    medicationService.getById(id).then(setMedication).finally(() => setLoading(false));
  }, [id]);

  return { medication, loading };
}

export function useCreateMedication() {
  const [loading, setLoading] = useState(false);
  const create = async (input: MedicationCatalogFormInput) => {
    setLoading(true);
    try { return await medicationService.create(input); }
    finally { setLoading(false); }
  };
  return { create, loading };
}

export function useDeleteMedication() {
  const [loading, setLoading] = useState(false);
  const [confirmId, setConfirmId] = useState<MedicationCatalogId | null>(null);

  const requestDelete = useCallback((id: MedicationCatalogId) => {
    setConfirmId(id);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmId) return;
    setLoading(true);
    try {
      await medicationService.delete(confirmId);
      setConfirmId(null);
    } finally {
      setLoading(false);
    }
  }, [confirmId]);

  const cancelDelete = useCallback(() => {
    setConfirmId(null);
  }, []);

  return { loading, confirmId, requestDelete, confirmDelete, cancelDelete };
}
