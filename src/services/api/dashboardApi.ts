import { z } from "zod";
import { httpRequest } from "./httpClient.js";

const DashboardMetricsSchema = z.object({
  pacientes: z.object({
    total: z.number(),
    activos: z.number(),
    inactivos: z.number(),
    archivados: z.number(),
    nuevosEsteMes: z.number(),
  }),
  sexoDistribucion: z.array(z.object({ sexo: z.string(), count: z.number() })),
  consultas: z.object({
    total: z.number(),
    esteMes: z.number(),
    pendientesPago: z.number(),
  }),
  planesAlimenticios: z.object({
    activos: z.number(),
    porVencer: z.number(),
  }),
  adherencia: z.object({
    promedioGlobal: z.number().nullable(),
    totalRegistros: z.number(),
  }),
  patologias: z.array(z.object({ tag: z.string(), count: z.number() })),
});

export type DashboardMetrics = z.infer<typeof DashboardMetricsSchema>;

export async function fetchDashboardMetrics(signal?: AbortSignal): Promise<DashboardMetrics> {
  const response = await httpRequest<unknown>("/dashboard/metrics", { signal });
  return DashboardMetricsSchema.parse(response);
}
