import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCascadeDeletePatient } from "@modules/patient/ui/useCascadeDeletePatient";
import { patientService } from "@services/patientService";
import { PatientId } from "@modules/patient/domain/PatientId";

const P1 = PatientId.fromUnsafe("p-1");

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useCascadeDeletePatient", () => {
  it("borra directo cuando el paciente no tiene entidades vinculadas", async () => {
    const deleteSpy = vi
      .spyOn(patientService.delete, "execute")
      .mockResolvedValue(undefined);
    const cascadeSpy = vi
      .spyOn(patientService.deleteCascade, "execute")
      .mockResolvedValue(undefined);
    const archiveSpy = vi
      .spyOn(patientService.archive, "execute")
      .mockResolvedValue({} as never);
    vi.spyOn(patientService.countLinked, "execute").mockResolvedValue({
      consultations: 0,
      mealPlans: 0,
      labPanels: 0,
      anthropometry: 0,
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useCascadeDeletePatient({ onComplete }));

    await act(async () => {
      await result.current.requestDelete(P1);
    });

    expect(deleteSpy).toHaveBeenCalledWith(P1, true);
    expect(cascadeSpy).not.toHaveBeenCalled();
    expect(archiveSpy).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(false);
    expect(onComplete).toHaveBeenCalledWith("deleted");
  });

  it("abre el modal cuando hay entidades vinculadas", async () => {
    const deleteSpy = vi
      .spyOn(patientService.delete, "execute")
      .mockResolvedValue(undefined);
    const cascadeSpy = vi
      .spyOn(patientService.deleteCascade, "execute")
      .mockResolvedValue(undefined);
    const archiveSpy = vi
      .spyOn(patientService.archive, "execute")
      .mockResolvedValue({} as never);
    vi.spyOn(patientService.countLinked, "execute").mockResolvedValue({
      consultations: 2,
      mealPlans: 1,
      labPanels: 0,
      anthropometry: 0,
    });

    const onComplete = vi.fn();
    const { result } = renderHook(() => useCascadeDeletePatient({ onComplete }));

    await act(async () => {
      await result.current.requestDelete(P1);
    });

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(cascadeSpy).not.toHaveBeenCalled();
    expect(archiveSpy).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(true);
    expect(result.current.counts).toEqual({
      consultations: 2,
      mealPlans: 1,
      labPanels: 0,
      anthropometry: 0,
    });
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("archive() archiva y cierra el modal", async () => {
    vi.spyOn(patientService.countLinked, "execute").mockResolvedValue({
      consultations: 1,
      mealPlans: 0,
      labPanels: 0,
      anthropometry: 0,
    });
    const archiveSpy = vi
      .spyOn(patientService.archive, "execute")
      .mockResolvedValue({} as never);
    const cascadeSpy = vi
      .spyOn(patientService.deleteCascade, "execute")
      .mockResolvedValue(undefined);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useCascadeDeletePatient({ onComplete }));

    await act(async () => {
      await result.current.requestDelete(P1);
    });
    expect(result.current.dialogOpen).toBe(true);

    await act(async () => {
      await result.current.archive();
    });

    expect(archiveSpy).toHaveBeenCalledWith(P1);
    expect(cascadeSpy).not.toHaveBeenCalled();
    expect(result.current.dialogOpen).toBe(false);
    expect(onComplete).toHaveBeenCalledWith("archived");
  });

  it("deleteAll() llama al cascade use case", async () => {
    vi.spyOn(patientService.countLinked, "execute").mockResolvedValue({
      consultations: 1,
      mealPlans: 0,
      labPanels: 0,
      anthropometry: 0,
    });
    vi.spyOn(patientService.archive, "execute").mockResolvedValue({} as never);
    const cascadeSpy = vi
      .spyOn(patientService.deleteCascade, "execute")
      .mockResolvedValue(undefined);

    const onComplete = vi.fn();
    const { result } = renderHook(() => useCascadeDeletePatient({ onComplete }));

    await act(async () => {
      await result.current.requestDelete(P1);
    });

    await act(async () => {
      await result.current.deleteAll();
    });

    expect(cascadeSpy).toHaveBeenCalledWith(P1);
    expect(result.current.dialogOpen).toBe(false);
    expect(onComplete).toHaveBeenCalledWith("deleted");
  });

  it("cancel() cierra el modal y resetea pendingPatientId", async () => {
    vi.spyOn(patientService.countLinked, "execute").mockResolvedValue({
      consultations: 1,
      mealPlans: 0,
      labPanels: 0,
      anthropometry: 0,
    });
    vi.spyOn(patientService.archive, "execute").mockResolvedValue({} as never);
    vi.spyOn(patientService.deleteCascade, "execute").mockResolvedValue(undefined);

    const { result } = renderHook(() => useCascadeDeletePatient());

    await act(async () => {
      await result.current.requestDelete(P1);
    });
    expect(result.current.dialogOpen).toBe(true);

    act(() => {
      result.current.cancel();
    });

    expect(result.current.dialogOpen).toBe(false);

    // archive()/deleteAll() sin modal no debe ejecutar nada
    await act(async () => {
      await result.current.archive();
      await result.current.deleteAll();
    });
  });

  it("reporta error y deja el modal cerrado si countLinked falla", async () => {
    const onError = vi.fn();
    vi.spyOn(patientService.countLinked, "execute").mockRejectedValue(
      new Error("count failed"),
    );

    const { result } = renderHook(() => useCascadeDeletePatient({ onError }));

    await act(async () => {
      await result.current.requestDelete(P1);
    });

    expect(result.current.dialogOpen).toBe(false);
    expect(result.current.errorMessage).toBe("count failed");
    expect(onError).toHaveBeenCalled();
  });
});
