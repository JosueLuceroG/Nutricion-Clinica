export interface MetricSnapshot {
  metricId: string;
  dimensionKey: string;
  value: number;
  loadedAt: string;
  sourceRunId: string;
}

export type LoadRunStatus = 'success' | 'partial' | 'failed';

export interface LoadRun {
  id: string;
  startedAt: string;
  finishedAt: string;
  rowsLoaded: number;
  status: LoadRunStatus;
  error?: string;
  metrics: string[];
  engineVersion: string;
}

export interface DwhStore {
  saveSnapshot(snapshot: MetricSnapshot): Promise<void>;
  listSnapshots(input: { metricId?: string; dimensionKey?: string }): Promise<MetricSnapshot[]>;
  saveLoadRun(run: LoadRun): Promise<void>;
  getLoadRun(id: string): Promise<LoadRun | undefined>;
  listLoadRuns(limit?: number): Promise<LoadRun[]>;
}