import { z } from "zod";

export const WeightKgSchema = z
  .number({ invalid_type_error: "Peso inválido" })
  .positive("El peso debe ser positivo")
  .max(500, "El peso no puede exceder 500 kg")
  .finite();

export const HeightMSchema = z
  .number({ invalid_type_error: "Altura inválida" })
  .positive("La altura debe ser positiva")
  .min(0.5, "La altura mínima es 0.5 m")
  .max(2.5, "La altura máxima es 2.5 m")
  .finite();

export const HeightCmSchema = z
  .number({ invalid_type_error: "Altura inválida" })
  .positive()
  .min(50, "La altura mínima es 50 cm")
  .max(250, "La altura máxima es 250 cm")
  .finite();

export const CircumferenceCmSchema = z
  .number({ invalid_type_error: "Circunferencia inválida" })
  .positive("Debe ser positivo")
  .min(5, "Valor demasiado bajo")
  .max(300, "Valor demasiado alto")
  .finite();

export const SkinfoldMmSchema = z
  .number({ invalid_type_error: "Pliegue inválido" })
  .nonnegative("No puede ser negativo")
  .max(80, "Valor demasiado alto")
  .finite();

export const BodyFatPctSchema = z
  .number()
  .nonnegative()
  .max(80, "Porcentaje fuera de rango")
  .finite();

export const LeanMassKgSchema = z
  .number()
  .nonnegative()
  .max(300, "Valor fuera de rango")
  .finite();

export class Weight {
  private constructor(public readonly kg: number) {}

  static fromKg(kg: number): Weight {
    return new Weight(WeightKgSchema.parse(kg));
  }

  toKg(): number {
    return this.kg;
  }

  toGrams(): number {
    return Math.round(this.kg * 1000);
  }

  equals(other: Weight): boolean {
    return this.kg === other.kg;
  }
}

export class Height {
  private constructor(public readonly meters: number) {}

  static fromMeters(m: number): Height {
    return new Height(HeightMSchema.parse(m));
  }

  static fromCentimeters(cm: number): Height {
    const m = HeightCmSchema.parse(cm) / 100;
    return new Height(m);
  }

  toMeters(): number {
    return this.meters;
  }

  toCentimeters(): number {
    return Math.round(this.meters * 100);
  }

  equals(other: Height): boolean {
    return this.meters === other.meters;
  }
}

export class Circumference {
  private constructor(public readonly cm: number) {}

  static fromCm(cm: number): Circumference {
    return new Circumference(CircumferenceCmSchema.parse(cm));
  }

  toCm(): number {
    return this.cm;
  }

  equals(other: Circumference): boolean {
    return this.cm === other.cm;
  }
}

export class Skinfold {
  private constructor(public readonly mm: number) {}

  static fromMm(mm: number): Skinfold {
    return new Skinfold(SkinfoldMmSchema.parse(mm));
  }

  toMm(): number {
    return this.mm;
  }

  equals(other: Skinfold): boolean {
    return this.mm === other.mm;
  }
}
