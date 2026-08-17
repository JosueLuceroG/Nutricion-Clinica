import { adherenceSummaryTool, anthropometryTool, labResultsTool, mealPlanTool, patientProfileTool, recentConsultationsTool } from '../tools/erpToolExecutors.js';

export interface Anthropometry {
  weightKg: number;
  heightM: number;
  measuredAt: string;
}

export interface ActivePlan {
  name: string;
  startDate?: string;
  endDate?: string;
  kcalTarget?: number;
  proteinTargetG?: number;
  carbsTargetG?: number;
  fatTargetG?: number;
}

export interface PatientContext {
  pacienteId: string;
  sucursalId: string;
  profileMissing: boolean;
  genero?: 'femenino' | 'masculino' | 'otro';
  ageYears?: number;
  fechaNacimiento?: string;
  conditions: string[];
  anthropometry?: Anthropometry;
  activePlan?: ActivePlan;
  recentLabs: Array<Record<string, unknown>>;
  adherence: Array<Record<string, unknown>>;
  recentConsultations: Array<Record<string, unknown>>;
  recentConsultationsCount?: number;
}

export interface ContextDataSources {
  getProfile(pacienteId: string, sucursalId: string): Promise<Record<string, unknown> | null>;
  getAnthropometry(pacienteId: string, sucursalId: string): Promise<Anthropometry | null>;
  getActivePlan(pacienteId: string, sucursalId: string): Promise<ActivePlan | null>;
  getRecentLabs(pacienteId: string, sucursalId: string): Promise<Array<Record<string, unknown>>>;
  getAdherence(pacienteId: string, sucursalId: string): Promise<Array<Record<string, unknown>>>;
  getRecentConsultations(pacienteId: string, sucursalId: string): Promise<Array<Record<string, unknown>>>;
}

async function safeFetch<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[expert] ${label} fetch failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

export const erpContextDataSources: ContextDataSources = {
  async getProfile(pacienteId, sucursalId) {
    return (await safeFetch('profile', () =>
      patientProfileTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    )) as Record<string, unknown> | null;
  },
  async getAnthropometry(pacienteId, sucursalId) {
    return (await safeFetch('anthropometry', () =>
      anthropometryTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    )) as Anthropometry | null;
  },
  async getActivePlan(pacienteId, sucursalId) {
    const plan = await safeFetch('plan', () =>
      mealPlanTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    );
    if (!plan || Array.isArray(plan)) return null;
    return plan as ActivePlan;
  },
  async getRecentLabs(pacienteId, sucursalId) {
    return (await safeFetch('labs', () =>
      labResultsTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    )) as Array<Record<string, unknown>>;
  },
  async getAdherence(pacienteId, sucursalId) {
    return (await safeFetch('adherence', () =>
      adherenceSummaryTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    )) as Array<Record<string, unknown>>;
  },
  async getRecentConsultations(pacienteId, sucursalId) {
    return (await safeFetch('consultations', () =>
      recentConsultationsTool.execute({ args: { pacienteId }, ctx: { sucursalId, profesionalId: '', role: 'nutriologa' } }),
    )) as Array<Record<string, unknown>>;
  },
};

function parseNumber(value: unknown): number | undefined {
  const num = typeof value === 'string' ? Number(value) : typeof value === 'number' ? value : undefined;
  return num !== undefined && !Number.isNaN(num) ? num : undefined;
}

function ageYearsFrom(birthDate: string | undefined, now: Date): number | undefined {
  if (!birthDate) return undefined;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return undefined;
  const age = now.getFullYear() - birth.getFullYear();
  const beforeBirthday = now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  return beforeBirthday ? age - 1 : age;
}

function generoOf(value: unknown): 'femenino' | 'masculino' | 'otro' | undefined {
  const raw = String(value ?? '').toLowerCase();
  if (raw.startsWith('f')) return 'femenino';
  if (raw.startsWith('m')) return 'masculino';
  return raw ? 'otro' : undefined;
}

export async function buildContext(
  sources: ContextDataSources,
  input: { pacienteId: string; sucursalId: string },
  now: Date = new Date(),
): Promise<PatientContext> {
  const [profile, anthropometry, activePlan, labs, adherence, consultations] = await Promise.all([
    safeFetch('profile', () => sources.getProfile(input.pacienteId, input.sucursalId)),
    safeFetch('anthropometry', () => sources.getAnthropometry(input.pacienteId, input.sucursalId)),
    safeFetch('plan', () => sources.getActivePlan(input.pacienteId, input.sucursalId)),
    safeFetch('labs', () => sources.getRecentLabs(input.pacienteId, input.sucursalId)),
    safeFetch('adherence', () => sources.getAdherence(input.pacienteId, input.sucursalId)),
    safeFetch('consultations', () => sources.getRecentConsultations(input.pacienteId, input.sucursalId)),
  ]);

  return {
    pacienteId: input.pacienteId,
    sucursalId: input.sucursalId,
    profileMissing: profile === null,
    genero: generoOf(profile?.genero),
    ageYears: ageYearsFrom(profile?.fecha_nacimiento as string | undefined, now),
    fechaNacimiento: profile?.fecha_nacimiento as string | undefined,
    conditions: Array.isArray(profile?.conditions) ? (profile?.conditions as string[]) : [],
    anthropometry: anthropometry ?? undefined,
    activePlan: activePlan ?? undefined,
    recentLabs: labs ?? [],
    adherence: adherence ?? [],
    recentConsultations: consultations ?? [],
    recentConsultationsCount: consultations?.length ?? 0,
  };
}

export function hasValidAnthropometry(ctx: PatientContext): boolean {
  return Boolean(ctx.anthropometry && ctx.anthropometry.weightKg > 0 && ctx.anthropometry.heightM > 0);
}

export function renderContextForPrompt(ctx: PatientContext): string {
  const lines: string[] = ['## Datos del paciente (contexto)', `- Paciente: ${ctx.profileMissing ? 'sin perfil disponible' : 'perfil encontrado'}`];
  if (ctx.genero) lines.push(`- Genero: ${ctx.genero}`);
  if (ctx.ageYears !== undefined) lines.push(`- Edad: ${ctx.ageYears} anos`);
  if (ctx.conditions.length > 0) lines.push(`- Condiciones declaradas: ${ctx.conditions.join(', ')}`);
  if (ctx.anthropometry) {
    lines.push(`- Antropometria reciente (${ctx.anthropometry.measuredAt}): peso ${ctx.anthropometry.weightKg} kg, talla ${ctx.anthropometry.heightM} m`);
  } else {
    lines.push('- Antropometria: NO DISPONIBLE');
  }
  if (ctx.activePlan) {
    lines.push(`- Plan activo: ${ctx.activePlan.name}${ctx.activePlan.kcalTarget ? ` (kcal objetivo ${ctx.activePlan.kcalTarget})` : ''}`);
  }
  if (ctx.recentLabs.length > 0) {
    lines.push('- Laboratorios recientes:');
    for (const lab of ctx.recentLabs.slice(0, 5)) {
      lines.push(`  * ${String(lab.lab_name ?? 'sin nombre')} (${String(lab.taken_at ?? 'fecha no disponible')}): ${JSON.stringify(lab.results_json ?? lab)}`);
    }
  }
  if ((ctx.recentConsultationsCount ?? ctx.recentConsultations.length) > 0) {
    lines.push(`- Consultas recientes: ${ctx.recentConsultationsCount ?? ctx.recentConsultations.length}`);
  }
  return lines.join('\n');
}

export function numericTokensFromContext(ctx: PatientContext): number[] {
  const tokens = new Set<number>();
  if (ctx.anthropometry) {
    tokens.add(ctx.anthropometry.weightKg);
    tokens.add(ctx.anthropometry.heightM);
  }
  if (ctx.activePlan) {
    for (const v of [ctx.activePlan.kcalTarget, ctx.activePlan.proteinTargetG, ctx.activePlan.carbsTargetG, ctx.activePlan.fatTargetG]) {
      if (v !== undefined) tokens.add(v);
    }
  }
  const collect = (value: unknown): void => {
    if (typeof value === 'number') {
      tokens.add(value);
      return;
    }
    if (typeof value === 'string') {
      const parsed = parseNumber(value);
      if (parsed !== undefined) tokens.add(parsed);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (value && typeof value === 'object') {
      for (const item of Object.values(value as Record<string, unknown>)) collect(item);
    }
  };
  for (const lab of ctx.recentLabs) collect(lab);
  for (const row of ctx.adherence) collect(row);
  for (const row of ctx.recentConsultations) collect(row);
  return Array.from(tokens);
}