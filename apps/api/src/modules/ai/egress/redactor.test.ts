import { describe, expect, it } from 'vitest';
import { luhnValid, redactFreeText } from './redactor.js';

describe('redactFreeText', () => {
  it('redacta emails', () => {
    const { output, redacted } = redactFreeText('Contacto: ana@example.com urgente');
    expect(output).toBe('Contacto: [REDACTADO] urgente');
    expect(redacted).toContain('email');
  });

  it('redacta teléfonos E164, parentizados, con guiones y secuencias largas', () => {
    const input = 'tel +52 55 1234 5678 | (55) 1234-5678 | 555-123-4567 | 5512345678';
    const { output } = redactFreeText(input);
    expect(output).not.toContain('+52');
    expect(output).not.toContain('(55)');
    expect(output).not.toContain('555-123-4567');
    expect(output).not.toContain('5512345678');
  });

  it('redacta CURP y RFC', () => {
    const { output, redacted } = redactFreeText('CURP: GARC880101HDFRRN09 RFC: GAAC880101XXX');
    expect(output).toContain('[REDACTADO]');
    expect(redacted).toEqual(expect.arrayContaining(['curp', 'rfc']));
  });

  it('redacta NSS de 11 dígitos', () => {
    const { output, redacted } = redactFreeText('NSS 12345678901');
    expect(output).not.toContain('12345678901');
    expect(redacted).toContain('phone');
  });

  it('redacta tarjetas solo si pasan Luhn', () => {
    const { output } = redactFreeText('tarjeta 4111111111111111 y folio 1234567890123');
    expect(output).toContain('[REDACTADO]');
    expect(output).toContain('1234567890123');
  });

  it('redacta nombres completos y segmentos cuando se proveen', () => {
    const { output, redacted } = redactFreeText('La paciente María López García llegó puntual', ['María López García']);
    expect(output).not.toContain('María López García');
    expect(output).not.toContain('López');
    expect(redacted).toContain('name');
  });

  it('no altera texto sin identificadores', () => {
    const text = 'El paciente debe comer verduras y hacer ejercicio.';
    const { output, redacted } = redactFreeText(text, ['María']);
    expect(output).toBe(text);
    expect(redacted).toEqual([]);
  });

  it('luhnValid distingue números válidos', () => {
    expect(luhnValid('4111111111111111')).toBe(true);
    expect(luhnValid('4111111111111112')).toBe(false);
  });
});