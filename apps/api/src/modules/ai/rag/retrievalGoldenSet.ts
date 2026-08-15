import { ALL_TIERS, type EvidenceTier, type KnowledgeDoc, type KnowledgeDocStatus } from './knowledgeGovernance.js';

export interface GoldenDocSeed {
  id: string;
  title: string;
  tier: EvidenceTier;
  category: string;
  content: string;
}

export const RETRIEVAL_GOLDEN_DOCS: readonly GoldenDocSeed[] = [
  {
    id: '00000000-0000-4000-8000-000000000101',
    title: 'Guia de hidratacion en adultos',
    tier: 'clinical_guideline',
    category: 'hidratacion',
    content: 'La hidratacion diaria recomendada en adultos sanos es de aproximadamente 30 ml por kilogramo de peso. En clima calido o actividad fisica intensa el requerimiento puede aumentar. El agua es la principal fuente de hidratacion.',
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    title: 'Calculo de requerimientos caloricos',
    tier: 'institutional_protocol',
    category: 'calorias',
    content: 'El requerimiento calorico se estima con Mifflin-St Jeor y se ajusta por el factor de actividad. Nunca recomendar dietas por debajo de 1200 kcal sin supervision profesional.',
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    title: 'Proteina en paciente adulto',
    tier: 'peer_reviewed',
    category: 'macronutrientes',
    content: 'La ingesta proteica de referencia para adultos es de 0.8 a 1.2 g por kg de peso. En pacientes con sarcopenia puede requerirse un aporte mayor bajo supervision.',
  },
  {
    id: '00000000-0000-4000-8000-000000000104',
    title: 'Educacion sobre fibra',
    tier: 'educational',
    category: 'fibra',
    content: 'La fibra favorece la salud digestiva. Se recomienda incorporar frutas, verduras, legumbres y cereales integrales de forma gradual.',
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    title: 'Apunte no verificado sobre ayuno',
    tier: 'unverified',
    category: 'ayuno',
    content: 'El ayuno intermitente puede ayudar a bajar de peso. Sin evidencia revisada en este sistema.',
  },
];

export function buildGoldenDocs(role: 'nutriologa' | 'admin' | 'asistente' = 'nutriologa', approved = true): KnowledgeDoc[] {
  return RETRIEVAL_GOLDEN_DOCS.map((seed) => {
    const status: KnowledgeDocStatus = seed.tier === 'unverified' ? 'draft' : approved ? 'approved' : 'draft';
    const expiresAt = seed.tier === 'educational' ? '2026-12-31T00:00:00.000Z' : undefined;
    return {
      id: seed.id,
      sucursalId: null,
      title: seed.title,
      category: seed.category,
      tier: seed.tier,
      content: seed.content,
      status,
      approvedBy: status === 'approved' ? 'admin-1' : undefined,
      approvedAt: status === 'approved' ? '2026-08-01T00:00:00.000Z' : undefined,
      expiresAt,
      allowedRoles: [role],
      createdAt: '2026-07-01T00:00:00.000Z',
    };
  });
}

export const RETRIEVAL_GOLDEN_QUERIES = [
  { id: 'q-hidratacion', query: 'hidratacion agua recomendada adultos', expectedDocIds: ['00000000-0000-4000-8000-000000000101'] },
  { id: 'q-calorias', query: 'calorias requerimiento Mifflin', expectedDocIds: ['00000000-0000-4000-8000-000000000102'] },
  { id: 'q-proteina', query: 'proteina gramos por kilogramo', expectedDocIds: ['00000000-0000-4000-8000-000000000103'] },
  { id: 'q-fibra', query: 'fibra frutas verduras digestiva', expectedDocIds: ['00000000-0000-4000-8000-000000000104'] },
];

export const GOLDEN_TIERS = ALL_TIERS;