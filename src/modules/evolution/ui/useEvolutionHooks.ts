import * as React from "react";
import { evolutionService } from "@services/evolutionService";
import type { EvolutionRecordProps, EvolutionIndicatorProps, StagnationAlertProps } from "@modules/evolution/domain";

export function useEvolutionRecords(patientId: string) {
  const [records, setRecords] = React.useState<EvolutionRecordProps[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await evolutionService.findRecordsByPatient(patientId);
      setRecords(result.map((r) => r.props));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  return { records, loading, refresh };
}

export function useEvolutionIndicators(patientId: string) {
  const [indicators, setIndicators] = React.useState<EvolutionIndicatorProps[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await evolutionService.findIndicatorsByPatient(patientId);
      setIndicators(result.map((i) => i.props));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  return { indicators, loading, refresh };
}

export function useStagnationAlerts(patientId: string) {
  const [alerts, setAlerts] = React.useState<StagnationAlertProps[]>([]);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      const result = await evolutionService.findActiveAlertsByPatient(patientId);
      setAlerts(result.map((a) => a.props));
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  React.useEffect(() => { refresh(); }, [refresh]);

  return { alerts, loading, refresh };
}

export function useCreateEvolutionRecord() {
  return React.useCallback(async (props: EvolutionRecordProps) => {
    await evolutionService.createRecord(props);
  }, []);
}

export function useCalculateIndicator() {
  return React.useCallback(async (props: Omit<EvolutionIndicatorProps, "id" | "absoluteChange" | "percentChange" | "status" | "calculatedAt">) => {
    await evolutionService.calculateIndicator(props as EvolutionIndicatorProps);
  }, []);
}
