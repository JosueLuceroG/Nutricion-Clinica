import { z } from "zod";
import { httpRequest } from "./httpClient.js";

const PortalMealExchangeSchema = z.object({
  foodId: z.string(),
  count: z.number(),
});

const PortalMealSchema = z.object({
  slot: z.string(),
  exchanges: z.array(PortalMealExchangeSchema),
});

const PatientPortalPayloadSchema = z.object({
  portal: z.object({
    tokenId: z.string(),
    sucursalId: z.string(),
    expiresAt: z.string().nullable(),
    scopes: z.array(z.string()),
  }),
  patient: z.object({
    id: z.string(),
    fullName: z.string(),
    birthDate: z.string().nullable(),
    sex: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    updatedAt: z.string().nullable(),
  }),
  summary: z
    .object({
      activePlanName: z.string().nullable(),
      nextAppointmentAt: z.string().nullable(),
      documentsCount: z.number(),
    })
    .nullable(),
  activePlan: z
    .object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      startDate: z.string().nullable(),
      endDate: z.string().nullable(),
      kcalTarget: z.number(),
      proteinTargetG: z.number(),
      carbsTargetG: z.number(),
      fatTargetG: z.number(),
      meals: z.array(PortalMealSchema),
      notes: z.string().nullable(),
      status: z.string(),
      updatedAt: z.string().nullable(),
    })
    .nullable(),
  upcomingAppointments: z.array(
    z.object({
      id: z.string(),
      consultationDate: z.string().nullable(),
      status: z.string(),
      reason: z.string(),
      nextVisitDate: z.string().nullable(),
    }),
  ),
  documents: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      fileName: z.string(),
      mimeType: z.string(),
      sizeBytes: z.number(),
      url: z.string(),
      sha256: z.string(),
      documentDate: z.string().nullable(),
      notes: z.string().nullable(),
      createdAt: z.string().nullable(),
    }),
  ),
});

const PortalAuditEventSchema = z.object({
  id: z.string(),
  tokenId: z.string(),
  sucursalId: z.string(),
  pacienteId: z.string(),
  profesionalId: z.string().nullable(),
  type: z.enum(["created", "revoked", "accessed", "adherence_submitted"]),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  details: z.record(z.unknown()).nullable(),
  occurredAt: z.string().nullable(),
});

const PortalLinkSchema = z.object({
  id: z.string(),
  sucursalId: z.string(),
  pacienteId: z.string(),
  label: z.string().nullable(),
  scopes: z.array(z.string()),
  expiresAt: z.string().nullable(),
  revokedAt: z.string().nullable(),
  lastAccessedAt: z.string().nullable(),
  createdByProfesionalId: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
  status: z.enum(["active", "expired", "revoked"]),
  recentEvents: z.array(PortalAuditEventSchema).default([]),
});

const PortalLinksResponseSchema = z.object({
  tokens: z.array(PortalLinkSchema),
});

const PortalAdherenceRecordSchema = z.object({
  id: z.string(),
  sucursalId: z.string().optional(),
  pacienteId: z.string().optional(),
  consultationId: z.string().nullable().optional(),
  source: z.string().optional(),
  date: z.string().nullable().optional(),
  adherenceMenu: z.number().optional(),
  adherenceWater: z.number().optional(),
  adherenceActivity: z.number().optional(),
  adherenceSupplements: z.number().optional(),
  adherenceSleep: z.number().optional(),
  hungerAvg: z.number().nullable().optional(),
  satietyAvg: z.number().nullable().optional(),
  moodAvg: z.number().nullable().optional(),
  energyAvg: z.number().nullable().optional(),
  intercurrentEvents: z.string().optional(),
  barriers: z.string().optional(),
  facilitators: z.string().optional(),
  mealsLogged: z.string().optional(),
  notes: z.string().optional(),
  submittedByTokenId: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

const SubmitPortalAdherenceResponseSchema = z.object({
  record: PortalAdherenceRecordSchema,
});

const CreatePortalLinkResponseSchema = z.object({
  token: z.string(),
  portalPath: z.string(),
  link: PortalLinkSchema,
});

const RevokePortalLinkResponseSchema = z.object({
  token: PortalLinkSchema,
});

export type PatientPortalPayload = z.infer<typeof PatientPortalPayloadSchema>;
export type PatientPortalPlan = NonNullable<PatientPortalPayload["activePlan"]>;
export type PatientPortalMeal = PatientPortalPlan["meals"][number];
export type PortalLink = z.infer<typeof PortalLinkSchema>;
export type PortalAuditEvent = z.infer<typeof PortalAuditEventSchema>;
export type PortalAdherenceRecord = z.infer<typeof PortalAdherenceRecordSchema>;
export type CreatePortalLinkResponse = z.infer<typeof CreatePortalLinkResponseSchema>;

export interface CreatePortalLinkInput {
  pacienteId: string;
  label?: string | null;
  expiresInDays?: number;
  scopes?: string[];
}

export interface SubmitPortalAdherenceInput {
  date?: string;
  adherenceMenu: number;
  adherenceWater: number;
  adherenceActivity: number;
  adherenceSupplements: number;
  adherenceSleep: number;
  hungerAvg?: number | null;
  satietyAvg?: number | null;
  moodAvg?: number | null;
  energyAvg?: number | null;
  intercurrentEvents?: string;
  barriers?: string;
  facilitators?: string;
  mealsLogged?: string;
  notes?: string;
}

export async function getPatientPortalPayload(token: string, signal?: AbortSignal): Promise<PatientPortalPayload> {
  const response = await httpRequest<unknown>(`/patient-portal/${encodeURIComponent(token)}`, {
    skipAuth: true,
    skipSucursalHeader: true,
    signal,
  });
  return PatientPortalPayloadSchema.parse(response);
}

export async function listPatientPortalLinks(pacienteId: string, signal?: AbortSignal): Promise<PortalLink[]> {
  const response = await httpRequest<unknown>("/patient-portal/tokens", {
    query: { pacienteId },
    signal,
  });
  return PortalLinksResponseSchema.parse(response).tokens;
}

export async function createPatientPortalLink(input: CreatePortalLinkInput): Promise<CreatePortalLinkResponse> {
  const response = await httpRequest<unknown>("/patient-portal/tokens", {
    method: "POST",
    body: input,
  });
  return CreatePortalLinkResponseSchema.parse(response);
}

export async function revokePatientPortalLink(id: string): Promise<PortalLink> {
  const response = await httpRequest<unknown>(`/patient-portal/tokens/${encodeURIComponent(id)}/revoke`, {
    method: "PATCH",
  });
  return RevokePortalLinkResponseSchema.parse(response).token;
}

export async function listPatientPortalAdherence(
  pacienteId: string,
  signal?: AbortSignal,
): Promise<PortalAdherenceRecord[]> {
  const response = await httpRequest<unknown>("/patient-portal/adherence", {
    query: { pacienteId },
    signal,
  });
  return z.object({ records: z.array(PortalAdherenceRecordSchema) }).parse(response).records;
}

export async function submitPatientPortalAdherence(
  token: string,
  input: SubmitPortalAdherenceInput,
): Promise<PortalAdherenceRecord> {
  const response = await httpRequest<unknown>(`/patient-portal/${encodeURIComponent(token)}/adherence`, {
    method: "POST",
    body: input,
    skipAuth: true,
    skipSucursalHeader: true,
  });
  return SubmitPortalAdherenceResponseSchema.parse(response).record;
}
