import * as React from "react";
import { clinicalRecordService } from "@services/clinicalRecordService";
import type { DietHistory } from "../domain/DietHistory";

function useList<T>(patientId: string | null, listFn: (pid: string) => Promise<T[]>) {
  const [data, setData] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const reload = React.useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try { setData(await listFn(patientId)); }
    catch (err) { setError(err instanceof Error ? err : new Error(String(err))); }
    finally { setLoading(false); }
  }, [patientId, listFn]);

  React.useEffect(() => { reload(); }, [reload]);

  return { data, loading, error, reload };
}

function useCreate<TCreate>(
  reload: () => Promise<void>,
  createFn: (input: TCreate) => Promise<unknown>,
) {
  return React.useCallback(async (input: TCreate) => {
    const result = await createFn(input);
    await reload();
    return result;
  }, [reload, createFn]);
}

function useRemove(reload: () => Promise<void>, removeFn: (id: string) => Promise<void>) {
  return React.useCallback(async (id: string) => {
    await removeFn(id);
    await reload();
  }, [reload, removeFn]);
}

export function useAllergies(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.allergies.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.allergies.create>[0]) =>
    clinicalRecordService.allergies.create(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.allergies.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useMedications(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.medications.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.medications.create.execute>[0]) =>
    clinicalRecordService.medications.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.medications.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useClinicalEvents(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.clinicalEvents.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.clinicalEvents.create.execute>[0]) =>
    clinicalRecordService.clinicalEvents.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.clinicalEvents.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useFamilyHistories(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.familyHistories.list.execute(pid));
  const save = useCreate(
    reload,
    (input: Parameters<typeof clinicalRecordService.familyHistories.create>[0]) =>
      clinicalRecordService.familyHistories.create(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.familyHistories.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function usePersonalHistories(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.personalHistories.list.execute(pid));
  const save = useCreate(
    reload,
    (input: Parameters<typeof clinicalRecordService.personalHistories.create>[0]) =>
      clinicalRecordService.personalHistories.create(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.personalHistories.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useHabits(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.habits.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.habits.create.execute>[0]) =>
    clinicalRecordService.habits.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.habits.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function usePhysicalActivities(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.physicalActivities.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.physicalActivities.create.execute>[0]) =>
    clinicalRecordService.physicalActivities.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.physicalActivities.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useDietHistory(patientId: string | null) {
  const [data, setData] = React.useState<DietHistory | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  const reload = React.useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    setError(null);
    try { setData(await clinicalRecordService.dietHistory.get.execute(patientId)); }
    catch (err) { setError(err instanceof Error ? err : new Error(String(err))); }
    finally { setLoading(false); }
  }, [patientId]);

  React.useEffect(() => { reload(); }, [reload]);

  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.dietHistory.save.execute>[0]) =>
    clinicalRecordService.dietHistory.save.execute(input),
  );

  return { data, loading, error, reload, save };
}

export function useIntolerances(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.intolerances.list.execute(pid));
  const save = useCreate(
    reload,
    (input: Parameters<typeof clinicalRecordService.intolerances.create>[0]) =>
      clinicalRecordService.intolerances.create(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.intolerances.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useSurgeries(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.surgeries.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.surgeries.create.execute>[0]) =>
    clinicalRecordService.surgeries.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.surgeries.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useHospitalizations(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.hospitalizations.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.hospitalizations.create.execute>[0]) =>
    clinicalRecordService.hospitalizations.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.hospitalizations.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useSupplements(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.supplements.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.supplements.create.execute>[0]) =>
    clinicalRecordService.supplements.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.supplements.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useFoodFrequencies(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.foodFrequencies.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.foodFrequencies.create.execute>[0]) =>
    clinicalRecordService.foodFrequencies.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.foodFrequencies.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}

export function useGiSymptoms(patientId: string | null) {
  const { data, loading, error, reload } = useList(patientId, (pid) => clinicalRecordService.giSymptoms.list.execute(pid));
  const save = useCreate(reload, (input: Parameters<typeof clinicalRecordService.giSymptoms.create.execute>[0]) =>
    clinicalRecordService.giSymptoms.create.execute(input),
  );
  const remove = useRemove(reload, (id) => clinicalRecordService.giSymptoms.remove.execute(id));
  return { data, loading, error, reload, save, remove };
}
