import { useState, useEffect, useCallback } from "react";
import type { Indicator, IndicatorProps } from "../domain/Indicator";
import type { IndicatorId } from "../domain/IndicatorId";
import type { IndicatorValue } from "../domain/IndicatorValue";
import type { GeneratedReport } from "../domain/GeneratedReport";

export interface ReportService {
  listIndicators(): Promise<Indicator[]>;
  getIndicatorValues(indicatorId: IndicatorId): Promise<IndicatorValue[]>;
  createIndicator(input: Omit<IndicatorProps, "id" | "createdAt" | "updatedAt" | "isActive"> & { isActive?: boolean }): Promise<Indicator>;
  updateIndicator(id: IndicatorId, input: Partial<IndicatorProps>): Promise<Indicator>;
  deleteIndicator(id: IndicatorId): Promise<void>;
  generateReport(params: {
    title: string;
    type: "operativo" | "financiero" | "kpi" | "regulatorio";
    generatedBy: string;
    contentHtml: string;
  }): Promise<GeneratedReport>;
}

export function useIndicators(service: ReportService) {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setIndicators(await service.listIndicators()); }
    catch { setIndicators([]); }
    finally { setLoading(false); }
  }, [service]);

  useEffect(() => { refresh(); }, [refresh]);

  return { indicators, loading, refresh };
}

export function useIndicatorValues(service: ReportService, indicatorId: IndicatorId | undefined) {
  const [values, setValues] = useState<IndicatorValue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!indicatorId) { setLoading(false); return; }
    setLoading(true);
    service.getIndicatorValues(indicatorId).then(setValues).finally(() => setLoading(false));
  }, [indicatorId, service]);

  return { values, loading };
}

export function useGenerateReport(service: ReportService) {
  const [loading, setLoading] = useState(false);

  const generate = async (params: {
    title: string;
    type: "operativo" | "financiero" | "kpi" | "regulatorio";
    generatedBy: string;
    contentHtml: string;
  }) => {
    setLoading(true);
    try { return await service.generateReport(params); }
    finally { setLoading(false); }
  };

  return { generate, loading };
}
