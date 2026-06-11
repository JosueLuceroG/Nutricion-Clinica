import { v7 as uuidv7 } from "uuid";

export class ExpenseId {
  private constructor(public readonly value: string) {}

  static generate(): ExpenseId {
    return new ExpenseId(uuidv7());
  }

  static fromUnsafe(s: string): ExpenseId {
    return new ExpenseId(s);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ExpenseId): boolean {
    return this.value === other.value;
  }
}
