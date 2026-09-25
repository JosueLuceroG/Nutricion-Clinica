export interface RedactionResult {
  output: string;
  redacted: string[];
}

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const E164_PHONE_RE = /\+\d[\d\s.-]{9,17}\b/g;
const LONG_DIGITS_RE = /\b\d{10,12}\b/g;
const PAREN_PHONE_RE = /\(\d{2,4}\)\s?\d{3,4}[\s.-]\d{4}\b/g;
const DASH_PHONE_RE = /\b\d{3}[\s.-]\d{3}[\s.-]\d{4}\b/g;
const CURP_RE = /\b[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{2}[A-Z0-9]{4,5}\b/i;
const RFC_RE = /\b[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{2,3}\b/i;
const NSS_RE = /\b\d{11}\b/g;

const REDACTED_TOKEN = '[REDACTADO]';

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

function redactCards(text: string): string {
  return text.replace(/\b\d{13,16}\b/g, (token) => (luhnValid(token) ? REDACTED_TOKEN : token));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function redactFreeText(input: string, names: readonly string[] = []): RedactionResult {
  let output = input;
  const redacted = new Set<string>();

  const apply = (label: string, fn: (text: string) => string): void => {
    const before = output;
    output = fn(output);
    if (output !== before) redacted.add(label);
  };

  apply('email', (t) => t.replace(EMAIL_RE, REDACTED_TOKEN));
  apply('phone', (t) => t
    .replace(E164_PHONE_RE, REDACTED_TOKEN)
    .replace(PAREN_PHONE_RE, REDACTED_TOKEN)
    .replace(DASH_PHONE_RE, REDACTED_TOKEN)
    .replace(LONG_DIGITS_RE, REDACTED_TOKEN));
  apply('curp', (t) => t.replace(CURP_RE, REDACTED_TOKEN));
  apply('rfc', (t) => t.replace(RFC_RE, REDACTED_TOKEN));
  apply('nss', (t) => t.replace(NSS_RE, REDACTED_TOKEN));
  apply('card', (t) => redactCards(t));

  for (const name of names) {
    const tokens = name.split(/\s+/).filter((token) => token.trim().length >= 3);
    const sequences = [name, ...tokens];
    for (const seq of sequences) {
      const pattern = new RegExp(`\\b${escapeRegExp(seq).replace(/\s+/g, '[\\s]+')}\\b`, 'gi');
      const before = output;
      output = output.replace(pattern, REDACTED_TOKEN);
      if (output !== before) redacted.add('name');
    }
  }

  return { output, redacted: Array.from(redacted) };
}
