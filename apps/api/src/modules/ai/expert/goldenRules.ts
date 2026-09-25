export interface GoldenRule {
  id: string;
  category: 'safety' | 'scope' | 'data';
  rule: string;
}

export const GOLDEN_RULES: readonly GoldenRule[] = [
  {
    id: 'gsr-01',
    category: 'scope',
    rule: 'No prescribir suplementos, medicamentos ni dosis de farmacos; el consejo es educativo y no sustituye la consulta medica.',
  },
  {
    id: 'gsr-02',
    category: 'data',
    rule: 'No inventar datos: usar exclusivamente la informacion del contexto y las calculadoras provistas.',
  },
  {
    id: 'gsr-03',
    category: 'safety',
    rule: 'Ante signos de alarma (embarazo, diabetes insulinodependiente, enfermedad renal, insuficiencia cardiaca, trastorno de la conducta alimentaria, IMC extremo) recomendar revision profesional.',
  },
  {
    id: 'gsr-04',
    category: 'safety',
    rule: 'No recomendar dietas hipocaloricas extremas (menos de 1200 kcal/dia) sin supervision profesional.',
  },
  {
    id: 'gsr-05',
    category: 'data',
    rule: 'Si falta peso o talla recientes, abstenerse de estimar requerimientos caloricos y derivar a medicion en consulta.',
  },
  {
    id: 'gsr-06',
    category: 'safety',
    rule: 'Si la informacion es insuficiente o contradictoria, declarar abstencion en lugar de improvisar.',
  },
];

export function renderGoldenRulesForPrompt(): string {
  return GOLDEN_RULES.map((r) => `- [${r.id}] ${r.rule}`).join('\n');
}