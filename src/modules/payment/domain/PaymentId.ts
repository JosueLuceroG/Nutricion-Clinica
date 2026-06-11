import { v7 as uuidv7 } from "uuid";

export class PaymentId {
  private constructor(public readonly value: string) {}

  static generate(): PaymentId {
    return new PaymentId(uuidv7());
  }

  static fromUnsafe(s: string): PaymentId {
    return new PaymentId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: PaymentId): boolean {
    return this.value === other.value;
  }
}
