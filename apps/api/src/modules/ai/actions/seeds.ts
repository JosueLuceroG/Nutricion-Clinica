import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { buildMemoryEntry, type MemorySource, type MemoryVisibility } from '../memory/memoryTypes.js';
import { selectMemoryStore, type MemoryStore } from '../memory/memoryStore.js';
import { selectKnowledgeDocStore, type KnowledgeDocStore } from '../rag/knowledgeGovernance.js';
import { ActionRegistry } from './actionRegistry.js';
import type { ConfirmableActionDefinition } from './actionTypes.js';

const MemoryNoteSchema = z
  .object({
    pacienteId: z.string().uuid(),
    content: z.string().trim().min(1).max(500),
    visibility: z.enum(['private', 'shared'] as const).optional(),
  })
  .strict();

const ShareResourceSchema = z
  .object({
    pacienteId: z.string().uuid(),
    docId: z.string().uuid(),
  })
  .strict();

export function createMemoryNoteDefinition(deps: { memoryStore?: MemoryStore; retentionDays?: number } = {}): ConfirmableActionDefinition {
  const memoryStore = deps.memoryStore ?? selectMemoryStore();
  const retentionDays = deps.retentionDays ?? 90;
  return {
    id: 'create_memory_note',
    name: 'Crear nota de memoria (no autoritativa)',
    description: 'Guarda una nota breve en la memoria auxiliar del paciente con consentimiento ai_memory.',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: ['ai_memory'],
    inputSchema: MemoryNoteSchema,
    async preview(input) {
      return {
        summary: 'Guardar nota en la memoria (no autoritativa) del paciente',
        details: { contentPreview: String(input.content).slice(0, 120) },
      };
    },
    async execute(input, ctx) {
      const entry = buildMemoryEntry({
        id: randomUUID(),
        pacienteId: String(input.pacienteId),
        sucursalId: ctx.sucursalId,
        actorId: ctx.actor.profesionalId,
        content: String(input.content),
        visibility: (input.visibility as MemoryVisibility | undefined) ?? 'shared',
        source: 'professional_note' as MemorySource,
        now: ctx.now,
        retentionDays,
      });
      await memoryStore.save(entry);
      return { entryId: entry.id, visibility: entry.visibility, source: entry.source };
    },
    async compensate(execution) {
      const entryId = String(execution.result?.entryId ?? '');
      const deleted = entryId ? await memoryStore.delete(entryId) : false;
      return { deleted };
    },
  };
}

export function createShareEducationalResourceDefinition(deps: { knowledgeStore?: KnowledgeDocStore } = {}): ConfirmableActionDefinition {
  const knowledgeStore = deps.knowledgeStore ?? selectKnowledgeDocStore();
  return {
    id: 'share_educational_resource',
    name: 'Enviar recurso educativo al paciente',
    description: 'Envia un documento educativo aprobado a la mensajeria del portal del paciente.',
    riskLevel: 'low',
    requiredRole: 'nutriologa',
    requiredConsents: [],
    inputSchema: ShareResourceSchema,
    async preview(input) {
      const doc = await knowledgeStore.get(String(input.docId));
      if (!doc || doc.status !== 'approved') throw new Error('Documento educativo no disponible');
      return {
        summary: `Enviar recurso educativo al paciente: "${doc.title}"`,
        details: { docId: doc.id, tier: doc.tier, title: doc.title },
      };
    },
    async execute(input, ctx) {
      const { getPool } = await import('../../../db/connection.js');
      const sql = (await import('mssql')).default;
      const doc = await knowledgeStore.get(String(input.docId));
      if (!doc || doc.status !== 'approved') throw new Error('Documento educativo no disponible');

      const pool = await getPool();
      const tokenResult = await pool
        .request()
        .input('paciente_id', sql.UniqueIdentifier(), String(input.pacienteId))
        .input('sucursal_id', sql.UniqueIdentifier(), ctx.sucursalId)
        .query<{ token_id: string }>(
          `SELECT TOP 1 id AS token_id
             FROM patient_portal_tokens
            WHERE paciente_id = @paciente_id
              AND sucursal_id = @sucursal_id
              AND revoked_at IS NULL
              AND expires_at > SYSUTCDATETIME()
            ORDER BY expires_at DESC`,
        );
      const tokenId = tokenResult.recordset[0]?.token_id;
      if (!tokenId) throw new Error('El paciente no tiene enlace activo del portal');

      const messageId = randomUUID();
      await pool
        .request()
        .input('id', sql.UniqueIdentifier(), messageId)
        .input('token_id', sql.UniqueIdentifier(), tokenId)
        .input('paciente_id', sql.UniqueIdentifier(), String(input.pacienteId))
        .input('sucursal_id', sql.UniqueIdentifier(), ctx.sucursalId)
        .input('profesional_id', sql.UniqueIdentifier(), ctx.actor.profesionalId)
        .input('content', sql.NVarChar(2000), `${doc.title}\n\n${doc.content}`.slice(0, 2000))
        .input('direction', sql.NVarChar(30), 'professional_to_patient')
        .query(
          `INSERT INTO patient_portal_messages (id, token_id, paciente_id, sucursal_id, profesional_id, content, direction)
           VALUES (@id, @token_id, @paciente_id, @sucursal_id, @profesional_id, @content, @direction)`,
        );
      return { messageId };
    },
    async compensate(execution, ctx) {
      const messageId = String(execution.result?.messageId ?? '');
      if (!messageId) return { deleted: false };
      const { getPool } = await import('../../../db/connection.js');
      const sql = (await import('mssql')).default;
      const pool = await getPool();
      const result = await pool
        .request()
        .input('id', sql.UniqueIdentifier(), messageId)
        .input('sucursal_id', sql.UniqueIdentifier(), ctx.sucursalId)
        .query<{ deleted: number }>(
          `DELETE FROM patient_portal_messages WHERE id = @id AND sucursal_id = @sucursal_id;
           SELECT @@ROWCOUNT AS deleted`,
        );
      return { deleted: result.recordset[0].deleted > 0 };
    },
  };
}

export function createDefaultActionRegistry(deps: {
  memoryStore?: MemoryStore;
  knowledgeStore?: KnowledgeDocStore;
} = {}): ActionRegistry {
  const registry = new ActionRegistry();
  registry.register(createMemoryNoteDefinition(deps));
  registry.register(createShareEducationalResourceDefinition(deps));
  return registry;
}

export const defaultActionRegistry = createDefaultActionRegistry();