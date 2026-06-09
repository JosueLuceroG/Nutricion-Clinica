import { z } from "zod";

export const ShoppingListSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  weeklyPlanId: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  numberOfPeople: z.number().int().positive().default(1),
  currency: z.string().default("MXN"),
  items: z.string().default("[]"),
  generatedAt: z.number().int().positive(),
  note: z.string().max(500).default(""),
});
export type ShoppingListProps = z.infer<typeof ShoppingListSchema>;

export class ShoppingList {
  private constructor(private readonly props: ShoppingListProps) {}

  get id(): string { return this.props.id; }
  get patientId(): string { return this.props.patientId; }
  get weeklyPlanId(): string | undefined { return this.props.weeklyPlanId; }
  get name(): string { return this.props.name; }
  get numberOfPeople(): number { return this.props.numberOfPeople; }
  get currency(): string { return this.props.currency; }
  get items(): string { return this.props.items; }
  get generatedAt(): number { return this.props.generatedAt; }
  get note(): string { return this.props.note; }

  toProps(): ShoppingListProps { return { ...this.props }; }

  static create(props: Omit<ShoppingListProps, "id" | "generatedAt">): ShoppingList {
    return new ShoppingList({
      ...props,
      id: crypto.randomUUID(),
      generatedAt: Date.now(),
    });
  }

  static reconstitute(props: ShoppingListProps): ShoppingList {
    return new ShoppingList(props);
  }
}
