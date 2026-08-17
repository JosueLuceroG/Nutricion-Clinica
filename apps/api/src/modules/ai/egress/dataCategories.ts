export type DataCategoryId =
  | 'DEMOGRAPHICS_MINIMAL'
  | 'CLINICAL_NOTES'
  | 'VITALS'
  | 'ANTHROPOMETRY'
  | 'BODY_COMPOSITION'
  | 'LAB_RESULTS'
  | 'MEDICATIONS'
  | 'ALLERGIES'
  | 'INTOLERANCES'
  | 'DIAGNOSES'
  | 'MEAL_PLAN'
  | 'ADHERENCE'
  | 'GOALS'
  | 'RESTRICTIONS'
  | 'DOCUMENT_EXCERPTS'
  | 'MEMORY'
  | 'APPOINTMENTS'
  | 'FINANCIAL'
  | 'CONTACT_INFORMATION'
  | 'IDENTIFIERS';

export type Sensitivity = 'low' | 'moderate' | 'high' | 'critical';

export interface DataCategoryDef {
  sensitivity: Sensitivity;
  containsPHI: boolean;
  patientBound: boolean;
  externalProviderAllowed: boolean;
  localProviderAllowed: boolean;
  requiresConsent: boolean;
  requiresPurpose: boolean;
  redactionPolicy: 'none' | 'deterministic';
  pseudonymizationPolicy: 'none' | 'execution_scoped_ref';
}

const category = (def: Omit<DataCategoryDef, 'requiresPurpose' | 'redactionPolicy' | 'pseudonymizationPolicy'>): DataCategoryDef => ({
  ...def,
  requiresPurpose: true,
  redactionPolicy: def.containsPHI ? 'deterministic' : 'none',
  pseudonymizationPolicy: def.patientBound ? 'execution_scoped_ref' : 'none',
});

export const DATA_CATEGORIES: Readonly<Record<DataCategoryId, DataCategoryDef>> = {
  DEMOGRAPHICS_MINIMAL: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  CLINICAL_NOTES: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  VITALS: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  ANTHROPOMETRY: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  BODY_COMPOSITION: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  LAB_RESULTS: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  MEDICATIONS: category({ sensitivity: 'critical', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  ALLERGIES: category({ sensitivity: 'critical', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  INTOLERANCES: category({ sensitivity: 'critical', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  DIAGNOSES: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  MEAL_PLAN: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  ADHERENCE: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  GOALS: category({ sensitivity: 'low', containsPHI: false, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  RESTRICTIONS: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  DOCUMENT_EXCERPTS: category({ sensitivity: 'low', containsPHI: false, patientBound: false, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: false }),
  MEMORY: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: true, localProviderAllowed: true, requiresConsent: true }),
  APPOINTMENTS: category({ sensitivity: 'moderate', containsPHI: true, patientBound: true, externalProviderAllowed: false, localProviderAllowed: true, requiresConsent: true }),
  FINANCIAL: category({ sensitivity: 'high', containsPHI: true, patientBound: true, externalProviderAllowed: false, localProviderAllowed: false, requiresConsent: true }),
  CONTACT_INFORMATION: category({ sensitivity: 'critical', containsPHI: true, patientBound: true, externalProviderAllowed: false, localProviderAllowed: true, requiresConsent: true }),
  IDENTIFIERS: category({ sensitivity: 'critical', containsPHI: true, patientBound: true, externalProviderAllowed: false, localProviderAllowed: false, requiresConsent: true }),
};

export function isCategoryDefined(id: string): id is DataCategoryId {
  return id in DATA_CATEGORIES;
}
