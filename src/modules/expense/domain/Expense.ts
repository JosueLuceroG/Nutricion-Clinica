import { ExpenseId } from "./ExpenseId";
import type { ExpenseCategory } from "./ExpenseCategory";

export class Expense {
  private constructor(
    public readonly id: ExpenseId,
    public readonly fecha: Date,
    public readonly concept: string,
    public readonly amount: number,
    public readonly currency: string,
    public readonly category: ExpenseCategory,
    public readonly notes: string | null,
    public readonly sucursalId: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date,
    public readonly deletedAt: Date | null,
  ) {}

  static create(input: ExpenseCreate): Expense {
    if (input.amount < 0 || !Number.isFinite(input.amount)) {
      throw new Error("El monto debe ser un número >= 0.");
    }
    const conceptTrimmed = input.concept?.trim();
    if (!conceptTrimmed || conceptTrimmed.length < 2) {
      throw new Error("El concepto debe tener al menos 2 caracteres.");
    }
    const now = new Date();
    return new Expense(
      input.id ?? ExpenseId.generate(),
      input.fecha,
      conceptTrimmed.slice(0, 200),
      input.amount,
      input.currency ?? "MXN",
      input.category,
      input.notes?.trim()?.slice(0, 500) ?? null,
      input.sucursalId ?? null,
      now,
      now,
      null,
    );
  }

  static reconstitute(props: ExpenseProps): Expense {
    return new Expense(
      props.id,
      props.fecha,
      props.concept,
      props.amount,
      props.currency,
      props.category,
      props.notes,
      props.sucursalId,
      props.createdAt,
      props.updatedAt,
      props.deletedAt,
    );
  }

  withDetails(input: {
    fecha?: Date;
    concept?: string;
    amount?: number;
    currency?: string;
    category?: ExpenseCategory;
    notes?: string | null;
  }): Expense {
    if (this.deletedAt) {
      throw new Error("No se puede modificar un gasto eliminado.");
    }
    return Expense.reconstitute({
      ...this.toProps(),
      fecha: input.fecha ?? this.fecha,
      concept: input.concept?.trim()?.slice(0, 200) ?? this.concept,
      amount: input.amount ?? this.amount,
      currency: input.currency ?? this.currency,
      category: input.category ?? this.category,
      notes: input.notes !== undefined ? (input.notes?.trim()?.slice(0, 500) ?? null) : this.notes,
      updatedAt: new Date(),
    });
  }

  softDelete(now: Date = new Date()): Expense {
    if (this.deletedAt) return this;
    return Expense.reconstitute({
      ...this.toProps(),
      deletedAt: now,
      updatedAt: now,
    });
  }

  toProps(): ExpenseProps {
    return {
      id: this.id,
      fecha: this.fecha,
      concept: this.concept,
      amount: this.amount,
      currency: this.currency,
      category: this.category,
      notes: this.notes,
      sucursalId: this.sucursalId,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}

export interface ExpenseProps {
  id: ExpenseId;
  fecha: Date;
  concept: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  notes: string | null;
  sucursalId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface ExpenseCreate {
  id?: ExpenseId;
  fecha: Date;
  concept: string;
  amount: number;
  currency?: string;
  category: ExpenseCategory;
  notes?: string | null;
  sucursalId?: string | null;
}
