import type { ActionRiskLevel, ConfirmableActionDefinition } from './actionTypes.js';

const SUPPORTED_RISK_LEVELS: readonly ActionRiskLevel[] = ['low', 'medium'];

/** Ninguna accion clinica critica puede ser confirmable ni automatica. */
export const CLINICAL_CRITICAL_ACTION_PREFIXES: readonly string[] = [
  'prescribe',
  'medicate',
  'diagnose',
  'modify_plan',
  'modify_lab',
  'modify_consulta',
  'cancel_consulta',
  'update_clinical',
  'refer',
];

export function isClinicalCriticalActionId(actionId: string): boolean {
  return CLINICAL_CRITICAL_ACTION_PREFIXES.some((prefix) => actionId.toLowerCase().startsWith(prefix));
}

export class ActionRegistry {
  private readonly actions = new Map<string, ConfirmableActionDefinition>();

  register(definition: ConfirmableActionDefinition): void {
    if (!SUPPORTED_RISK_LEVELS.includes(definition.riskLevel)) {
      throw new Error(`Accion '${definition.id}' rechazada: riesgo alto no es confirmable`);
    }
    if (isClinicalCriticalActionId(definition.id)) {
      throw new Error(`Accion '${definition.id}' rechazada: acciones clinicas criticas no se automatizan`);
    }
    if (this.actions.has(definition.id)) {
      throw new Error(`Accion '${definition.id}' ya registrada`);
    }
    this.actions.set(definition.id, definition);
  }

  get(actionId: string): ConfirmableActionDefinition | undefined {
    return this.actions.get(actionId);
  }

  list(): ConfirmableActionDefinition[] {
    return Array.from(this.actions.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}