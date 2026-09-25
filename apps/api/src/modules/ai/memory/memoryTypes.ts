export type MemoryVisibility = 'private' | 'shared';

export type MemorySource = 'ai_conversation' | 'professional_note' | 'system_observation';

export interface MemoryEntry {
  id: string;
  pacienteId: string;
  sucursalId: string;
  actorId: string;
  content: string;
  visibility: MemoryVisibility;
  source: MemorySource;
  createdAt: string;
  expiresAt: string;
}

export function buildMemoryEntry(input: {
  id: string;
  pacienteId: string;
  sucursalId: string;
  actorId: string;
  content: string;
  visibility: MemoryVisibility;
  source: MemorySource;
  now: Date;
  retentionDays: number;
}): MemoryEntry {
  const createdAt = input.now.toISOString();
  const expiresAt = new Date(input.now.getTime() + input.retentionDays * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: input.id,
    pacienteId: input.pacienteId,
    sucursalId: input.sucursalId,
    actorId: input.actorId,
    content: input.content,
    visibility: input.visibility,
    source: input.source,
    createdAt,
    expiresAt,
  };
}