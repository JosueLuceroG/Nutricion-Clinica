import { describe, it, expect } from 'vitest';
import { validatePasswordStrength } from './passwordPolicy.js';
import { WeakPasswordError } from './errors.js';

describe('passwordPolicy.validatePasswordStrength', () => {
  it('acepta contraseña fuerte', () => {
    expect(() => validatePasswordStrength('S3gura!MuyFuerte#2024')).not.toThrow();
  });

  it('rechaza menos de 12 caracteres', () => {
    expect(() => validatePasswordStrength('Aa1!abcd')).toThrow(WeakPasswordError);
  });

  it('rechaza sin minúscula', () => {
    expect(() => validatePasswordStrength('ALLUPPER123!@#')).toThrow(/minúscula/);
  });

  it('rechaza sin mayúscula', () => {
    expect(() => validatePasswordStrength('alllower123!@#')).toThrow(/mayúscula/);
  });

  it('rechaza sin dígito', () => {
    expect(() => validatePasswordStrength('SoloLetras!@#ABC')).toThrow(/dígito/);
  });

  it('rechaza sin símbolo', () => {
    expect(() => validatePasswordStrength('SoloLetrasyNumero1')).toThrow(/símbolo/);
  });

  it('rechaza entrada no string', () => {
    expect(() => validatePasswordStrength(null as unknown as string)).toThrow(WeakPasswordError);
    expect(() => validatePasswordStrength(undefined as unknown as string)).toThrow(WeakPasswordError);
    expect(() => validatePasswordStrength(12345 as unknown as string)).toThrow(WeakPasswordError);
  });
});
