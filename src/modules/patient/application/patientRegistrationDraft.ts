export const PATIENT_REGISTRATION_DRAFT_KEY = "draft:new-patient";
const PATIENT_REGISTRATION_DRAFT_VERSION = 1;

export interface PatientRegistrationDraftScope {
  readonly userId: string | null;
  readonly sucursalId: string | null;
}

export interface PatientRegistrationDraftNavigation {
  readonly step: number;
  readonly medicalSection: string;
  readonly nutritionSection: string;
  readonly physicalActivitySection: string;
}

export interface PatientRegistrationDraft<
  Values extends Record<string, unknown>,
> {
  readonly version: number;
  readonly scope: PatientRegistrationDraftScope;
  readonly updatedAt: string;
  readonly values: Values;
  readonly navigation: PatientRegistrationDraftNavigation;
  readonly photoNeedsReselection: boolean;
}

interface SavePatientRegistrationDraftInput<
  Values extends Record<string, unknown>,
> {
  readonly scope: PatientRegistrationDraftScope;
  readonly values: Values;
  readonly navigation: PatientRegistrationDraftNavigation;
  readonly photoNeedsReselection: boolean;
}

export function savePatientRegistrationDraft<
  Values extends Record<string, unknown>,
>(input: SavePatientRegistrationDraftInput<Values>): boolean {
  const draft: PatientRegistrationDraft<Values> = {
    version: PATIENT_REGISTRATION_DRAFT_VERSION,
    scope: input.scope,
    updatedAt: new Date().toISOString(),
    values: input.values,
    navigation: input.navigation,
    photoNeedsReselection: input.photoNeedsReselection,
  };

  try {
    localStorage.setItem(PATIENT_REGISTRATION_DRAFT_KEY, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function readPatientRegistrationDraft<
  Values extends Record<string, unknown>,
>(
  scope: PatientRegistrationDraftScope,
): PatientRegistrationDraft<Values> | null {
  try {
    const raw = localStorage.getItem(PATIENT_REGISTRATION_DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as unknown;
    if (!isDraft(draft) || !sameScope(draft.scope, scope)) return null;
    return draft as PatientRegistrationDraft<Values>;
  } catch {
    return null;
  }
}

export function clearPatientRegistrationDraft(): void {
  try {
    localStorage.removeItem(PATIENT_REGISTRATION_DRAFT_KEY);
  } catch {
    // Storage may be unavailable; there is nothing else to clear locally.
  }
}

function isDraft(
  value: unknown,
): value is PatientRegistrationDraft<Record<string, unknown>> {
  if (!isRecord(value)) return false;
  return (
    value.version === PATIENT_REGISTRATION_DRAFT_VERSION &&
    isScope(value.scope) &&
    typeof value.updatedAt === "string" &&
    isRecord(value.values) &&
    isNavigation(value.navigation) &&
    typeof value.photoNeedsReselection === "boolean"
  );
}

function isScope(value: unknown): value is PatientRegistrationDraftScope {
  return (
    isRecord(value) &&
    (typeof value.userId === "string" || value.userId === null) &&
    (typeof value.sucursalId === "string" || value.sucursalId === null)
  );
}

function isNavigation(
  value: unknown,
): value is PatientRegistrationDraftNavigation {
  return (
    isRecord(value) &&
    typeof value.step === "number" &&
    typeof value.medicalSection === "string" &&
    typeof value.nutritionSection === "string" &&
    typeof value.physicalActivitySection === "string"
  );
}

function sameScope(
  left: PatientRegistrationDraftScope,
  right: PatientRegistrationDraftScope,
): boolean {
  return left.userId === right.userId && left.sucursalId === right.sucursalId;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
