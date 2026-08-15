import { beforeEach, describe, expect, it } from "vitest";
import {
  PATIENT_REGISTRATION_DRAFT_KEY,
  clearPatientRegistrationDraft,
  readPatientRegistrationDraft,
  savePatientRegistrationDraft,
} from "./patientRegistrationDraft";

const scope = { userId: "user-1", sucursalId: "branch-1" };
const navigation = {
  step: 2,
  medicalSection: "personal",
  nutritionSection: "routine",
  physicalActivitySection: "activity",
};

describe("patient registration draft", () => {
  beforeEach(() => localStorage.clear());

  it("stores and restores the singleton draft", () => {
    expect(
      savePatientRegistrationDraft({
        scope,
        values: { firstName: "Ana" },
        navigation,
        photoNeedsReselection: false,
      }),
    ).toBe(true);

    expect(readPatientRegistrationDraft(scope)).toMatchObject({
      version: 1,
      values: { firstName: "Ana" },
      navigation,
    });
    expect(localStorage).toHaveLength(1);
  });

  it("overwrites the same draft instead of creating another", () => {
    savePatientRegistrationDraft({
      scope,
      values: { firstName: "Ana" },
      navigation,
      photoNeedsReselection: false,
    });
    savePatientRegistrationDraft({
      scope,
      values: { firstName: "Beatriz" },
      navigation: { ...navigation, step: 4 },
      photoNeedsReselection: true,
    });

    expect(localStorage).toHaveLength(1);
    expect(readPatientRegistrationDraft(scope)).toMatchObject({
      values: { firstName: "Beatriz" },
      navigation: { step: 4 },
      photoNeedsReselection: true,
    });
  });

  it("does not expose another user or branch draft", () => {
    savePatientRegistrationDraft({
      scope,
      values: { firstName: "Ana" },
      navigation,
      photoNeedsReselection: false,
    });

    expect(
      readPatientRegistrationDraft({ ...scope, userId: "user-2" }),
    ).toBeNull();
    expect(
      readPatientRegistrationDraft({ ...scope, sucursalId: "branch-2" }),
    ).toBeNull();
  });

  it("clears the draft", () => {
    localStorage.setItem(PATIENT_REGISTRATION_DRAFT_KEY, "{}");
    clearPatientRegistrationDraft();
    expect(localStorage.getItem(PATIENT_REGISTRATION_DRAFT_KEY)).toBeNull();
  });
});
