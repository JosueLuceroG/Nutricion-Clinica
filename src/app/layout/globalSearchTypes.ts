import type { LucideIcon } from "lucide-react";

export type GlobalSearchCategory =
  | "all"
  | "patients"
  | "consultations"
  | "plans"
  | "laboratory"
  | "recipes"
  | "actions";

export type GlobalSearchResultKind =
  | "action"
  | "setting"
  | "patient"
  | "consultation"
  | "appointment"
  | "plan"
  | "laboratory"
  | "recipe"
  | "intent";

export type GlobalSearchDataCategory = Exclude<GlobalSearchCategory, "all">;

export type GlobalSearchTone = "blue" | "green" | "purple" | "cyan" | "slate";

export type GlobalSearchMealSlot =
  | "breakfast"
  | "morning-snack"
  | "lunch"
  | "afternoon-snack"
  | "dinner";

export interface GlobalSearchNumericFilter {
  min?: number;
  max?: number;
  minExclusive?: boolean;
  maxExclusive?: boolean;
}

export interface GlobalSearchFoodConstraint {
  term: string;
  mealSlots?: GlobalSearchMealSlot[];
  minMealSlots?: number;
  period?: "day" | "week";
}

export interface GlobalSearchPlanFood {
  id: string;
  mealSlot: GlobalSearchMealSlot;
  searchText: string;
}

export interface GlobalSearchPlanMetadata {
  kcalTarget: number;
  proteinTargetG: number;
  carbsTargetG: number;
  fatTargetG: number;
  foods: GlobalSearchPlanFood[];
  freeText: string;
  completeFoodIndex: boolean;
}

export interface ParsedGlobalSearchFilters {
  phone?: string;
  email?: string;
  date?: string;
  status?: string;
  patient?: string;
  kcalTotal?: string;
  kcalPerServing?: string;
  planKcal?: GlobalSearchNumericFilter;
  proteinG?: GlobalSearchNumericFilter;
  carbsG?: GlobalSearchNumericFilter;
  fatG?: GlobalSearchNumericFilter;
  foodIncludes?: GlobalSearchFoodConstraint[];
  foodExcludes?: GlobalSearchFoodConstraint[];
}

export interface GlobalSearchResult {
  id: string;
  kind: GlobalSearchResultKind;
  category: GlobalSearchDataCategory;
  title: string;
  subtitle: string;
  searchableText: string;
  icon: LucideIcon;
  tone: GlobalSearchTone;
  path?: string;
  actionId?: string;
  patientId?: string;
  canCreateForPatient?: boolean;
  avatar?: string;
  avatarUrl?: string | null;
  date?: string;
  planMetadata?: GlobalSearchPlanMetadata;
  fields?: Partial<
    Record<
      | "phone"
      | "email"
      | "date"
      | "status"
      | "patient"
      | "kcalTotal"
      | "kcalPerServing",
      string
    >
  >;
}

export interface ParsedGlobalSearch {
  text: string;
  category: GlobalSearchCategory | null;
  filters: ParsedGlobalSearchFilters;
  errors: string[];
}

export interface GlobalSearchAccess {
  patients: boolean;
  consultations: boolean;
  plans: boolean;
  laboratory: boolean;
  agenda: boolean;
  recipes: boolean;
}

export interface GlobalSearchRecentEntry {
  scope: string;
  resultId: string;
  selectedAt: number;
}
