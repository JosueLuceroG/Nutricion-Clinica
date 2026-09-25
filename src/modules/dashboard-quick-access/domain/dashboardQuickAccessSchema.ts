import { z } from "zod";
import {
  DASHBOARD_QUICK_ACCESS_ACTION_IDS,
  DASHBOARD_QUICK_ACCESS_ICON_IDS,
  DASHBOARD_QUICK_ACCESS_SCHEMA_VERSION,
  type DashboardQuickAccessConfig,
  type DashboardQuickAccessScope,
  type DashboardQuickAccessSnapshot,
} from "./DashboardQuickAccess";

const isoDateTimeSchema = z.string().datetime({ offset: true });

export const dashboardQuickAccessActionIdSchema = z.enum(
  DASHBOARD_QUICK_ACCESS_ACTION_IDS,
);

export const dashboardQuickAccessIconIdSchema = z.enum(
  DASHBOARD_QUICK_ACCESS_ICON_IDS,
);

export const dashboardQuickAccessScopeSchema = z
  .object({
    userId: z.string().min(1).max(256),
    sucursalId: z.string().min(1).max(256).nullable(),
  })
  .strict();

export const dashboardQuickAccessConfigSchema = z
  .object({
    mode: z.enum(["direct", "menu"]),
    buttonLabel: z.string().trim().min(1).max(40).nullable(),
    buttonIconId: dashboardQuickAccessIconIdSchema.nullable(),
    primaryActionId: dashboardQuickAccessActionIdSchema,
    secondaryActionIds: z.array(dashboardQuickAccessActionIdSchema).max(7),
  })
  .strict()
  .superRefine((config, context) => {
    if (
      new Set(config.secondaryActionIds).size !==
      config.secondaryActionIds.length
    ) {
      context.addIssue({
        code: "custom",
        path: ["secondaryActionIds"],
        message: "Secondary action IDs must be unique",
      });
    }
    if (config.secondaryActionIds.includes(config.primaryActionId)) {
      context.addIssue({
        code: "custom",
        path: ["secondaryActionIds"],
        message: "Secondary actions cannot contain the primary action",
      });
    }
  });

export const dashboardQuickAccessSnapshotSchema = z
  .object({
    schemaVersion: z.literal(DASHBOARD_QUICK_ACCESS_SCHEMA_VERSION),
    scope: dashboardQuickAccessScopeSchema,
    config: dashboardQuickAccessConfigSchema,
    revision: z.number().int().nonnegative(),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const DEFAULT_DASHBOARD_QUICK_ACCESS_CONFIG = {
  mode: "direct",
  buttonLabel: null,
  buttonIconId: null,
  primaryActionId: "dashboard.customize",
  secondaryActionIds: [],
} as const;

export function createDefaultDashboardQuickAccessConfig(): DashboardQuickAccessConfig {
  return {
    ...DEFAULT_DASHBOARD_QUICK_ACCESS_CONFIG,
    secondaryActionIds: [],
  };
}

export function createDefaultDashboardQuickAccessSnapshot(
  scope: DashboardQuickAccessScope,
  now = new Date().toISOString(),
): DashboardQuickAccessSnapshot {
  return dashboardQuickAccessSnapshotSchema.parse({
    schemaVersion: DASHBOARD_QUICK_ACCESS_SCHEMA_VERSION,
    scope,
    config: createDefaultDashboardQuickAccessConfig(),
    revision: 0,
    updatedAt: now,
  }) as DashboardQuickAccessSnapshot;
}

export function parseDashboardQuickAccessScope(
  value: unknown,
): DashboardQuickAccessScope | null {
  const result = dashboardQuickAccessScopeSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseDashboardQuickAccessConfig(
  value: unknown,
): DashboardQuickAccessConfig | null {
  const result = dashboardQuickAccessConfigSchema.safeParse(value);
  return result.success ? result.data : null;
}

export function parseDashboardQuickAccessSnapshot(
  value: unknown,
): DashboardQuickAccessSnapshot | null {
  const result = dashboardQuickAccessSnapshotSchema.safeParse(value);
  return result.success ? (result.data as DashboardQuickAccessSnapshot) : null;
}
