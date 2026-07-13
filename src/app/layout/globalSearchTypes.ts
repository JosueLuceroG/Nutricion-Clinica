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
  | "patient"
  | "consultation"
  | "appointment"
  | "plan"
  | "laboratory"
  | "recipe"
  | "intent";

export type GlobalSearchDataCategory =
  Exclude<GlobalSearchCategory, "all">;

export type GlobalSearchTone = "blue" | "green" | "purple" | "cyan" | "slate";

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
  filters: Partial<
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
