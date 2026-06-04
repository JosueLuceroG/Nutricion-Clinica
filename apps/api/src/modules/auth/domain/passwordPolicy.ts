import { WeakPasswordError } from './errors.js';

const MIN_LENGTH = 12;
const HAS_LOWER = /[a-z]/;
const HAS_UPPER = /[A-Z]/;
const HAS_DIGIT = /[0-9]/;
const HAS_SYMBOL = /[^A-Za-z0-9]/;

export function validatePasswordStrength(password: string): void {
  if (typeof password !== 'string') {
    throw new WeakPasswordError('La contraseña debe ser una cadena de texto');
  }
  if (password.length < MIN_LENGTH) {
    throw new WeakPasswordError(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres`);
  }
  if (!HAS_LOWER.test(password)) {
    throw new WeakPasswordError('La contraseña debe incluir al menos una minúscula');
  }
  if (!HAS_UPPER.test(password)) {
    throw new WeakPasswordError('La contraseña debe incluir al menos una mayúscula');
  }
  if (!HAS_DIGIT.test(password)) {
    throw new WeakPasswordError('La contraseña debe incluir al menos un dígito');
  }
  if (!HAS_SYMBOL.test(password)) {
    throw new WeakPasswordError('La contraseña debe incluir al menos un símbolo');
  }
}
