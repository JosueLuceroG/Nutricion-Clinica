import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .min(1, "El correo no puede estar vacío")
  .max(254, "El correo no puede exceder 254 caracteres")
  .email("Formato de correo inválido");

export const PhoneSchema = z
  .string()
  .trim()
  .min(7, "El teléfono es demasiado corto")
  .max(20, "El teléfono es demasiado largo")
  .regex(/^[\d\s+\-()]+$/, "El teléfono solo puede contener dígitos, espacios y los caracteres + - ( )");

export class Email {
  private constructor(public readonly value: string) {}

  static from(value: string): Email {
    const parsed = EmailSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`Email inválido: ${parsed.error.issues[0]?.message ?? "error desconocido"}`);
    }
    return new Email(parsed.data);
  }

  toString(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value.toLowerCase() === other.value.toLowerCase();
  }
}

export class Phone {
  private constructor(public readonly value: string) {}

  static from(value: string): Phone {
    const parsed = PhoneSchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(`Teléfono inválido: ${parsed.error.issues[0]?.message ?? "error desconocido"}`);
    }
    return new Phone(parsed.data);
  }

  toString(): string {
    return this.value;
  }
}
