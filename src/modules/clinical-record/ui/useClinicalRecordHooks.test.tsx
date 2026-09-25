import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { listAllergies } = vi.hoisted(() => ({
  listAllergies: vi.fn(),
}));

vi.mock("@services/clinicalRecordService", () => ({
  clinicalRecordService: {
    allergies: {
      list: { execute: listAllergies },
      create: vi.fn(),
      remove: { execute: vi.fn() },
    },
  },
}));

import { useAllergies } from "./useClinicalRecordHooks";

describe("useClinicalRecordHooks", () => {
  beforeEach(() => {
    listAllergies.mockReset();
    listAllergies.mockResolvedValue([]);
  });

  it("loads once per patient even though the wrapper creates an inline callback", async () => {
    const { result, rerender } = renderHook(
      ({ patientId }) => useAllergies(patientId),
      { initialProps: { patientId: "patient-1" } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(listAllergies).toHaveBeenCalledTimes(1);

    rerender({ patientId: "patient-1" });
    await act(async () => Promise.resolve());
    expect(listAllergies).toHaveBeenCalledTimes(1);

    await act(async () => {
      await result.current.reload();
    });
    expect(listAllergies).toHaveBeenCalledTimes(2);
  });

  it("reloads only when the patient changes", async () => {
    const { rerender } = renderHook(
      ({ patientId }) => useAllergies(patientId),
      { initialProps: { patientId: "patient-1" } },
    );
    await waitFor(() => expect(listAllergies).toHaveBeenCalledTimes(1));

    rerender({ patientId: "patient-2" });
    await waitFor(() => expect(listAllergies).toHaveBeenCalledTimes(2));
    expect(listAllergies).toHaveBeenLastCalledWith("patient-2");
  });
});
