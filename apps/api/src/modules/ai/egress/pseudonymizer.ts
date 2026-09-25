import { createHash } from 'node:crypto';

const REF_PREFIX = 'PATIENT_REF_';

export function pseudonymizePatientRef(patientId: string, executionId: string): string {
  const digest = createHash('sha256').update(`${executionId}:${patientId}`).digest('hex');
  return `${REF_PREFIX}${digest.slice(0, 8)}`;
}
