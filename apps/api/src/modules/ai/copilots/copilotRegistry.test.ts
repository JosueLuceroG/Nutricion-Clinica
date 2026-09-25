import { describe, expect, it } from 'vitest';
import { copilotAvailability, getCopilot, listCopilots } from './copilotRegistry.js';

describe('registro de copilotos', () => {
  it('lists nutrition as the only active copilot sharing the common AI infra', () => {
    const copilots = listCopilots();
    expect(copilots.map((c) => c.id)).toEqual(['nutrition', 'clinical', 'medical', 'nursing']);
    const nutrition = copilots.find((c) => c.id === 'nutrition');
    expect(nutrition?.status).toBe('active');
    expect(nutrition?.requiredRole).toBe('nutriologa');
    expect(nutrition?.capabilities).toContain('nutrition_reasoning');
    expect(nutrition?.consentTypes).toEqual(['ai_opt_in', 'ai_memory']);
    expect(nutrition?.gate).toBe('expert_clinical');
  });

  it('marks clinical, medical and nursing as planned without an existing role', () => {
    for (const id of ['clinical', 'medical', 'nursing']) {
      const copilot = getCopilot(id);
      expect(copilot?.status).toBe('planned');
      expect(copilot?.requiredRole).toBeNull();
      expect(copilot?.plannedNote).toBeTruthy();
    }
  });

  it('resolves unknown ids to undefined', () => {
    expect(getCopilot('no_existe')).toBeUndefined();
  });

  it('grants availability to a nutriologa for nutrition only', () => {
    const nutrition = getCopilot('nutrition')!;
    expect(copilotAvailability(nutrition, 'nutriologa')).toEqual({ available: true, requiredRole: 'nutriologa' });
    expect(copilotAvailability(nutrition, 'asistente').available).toBe(false);
    expect(copilotAvailability(nutrition, 'asistente').reason).toBe('Rol sin permiso para este copiloto');
  });

  it('fail-closes planned copilots for every role', () => {
    for (const id of ['clinical', 'medical', 'nursing']) {
      const copilot = getCopilot(id)!;
      expect(copilotAvailability(copilot, 'admin').available).toBe(false);
      expect(copilotAvailability(copilot, 'nutriologa').available).toBe(false);
    }
  });
});