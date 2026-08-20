export interface EtlCounts {
  extracted: number;
  inserted: number;
  updated: number;
  rejected: number;
}

export interface EtlRunResult {
  loadRunId: number;
  pipelineId: string;
  status: 'succeeded' | 'failed';
  transformationVersion: string;
  sourceWatermark: Date | null;
  counts: EtlCounts;
  reconciliation: {
    sourceExpected: number;
    loaded: number;
    filtered: number;
    rejected: number;
    unexpectedLoss: number;
  };
  error: string | null;
}

export interface EtlReject {
  entity: string;
  sourceReference: string;
  reasonCode: string;
  reasonDetail?: string;
}

export const DWH_CODE_VERSION = 'dwh-etl-b08';
export const DWH_TRANSFORMATION_VERSION = 'dwh-transform-v1';