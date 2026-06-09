import { z } from "zod";
import { ScheduleIdSchema, type ScheduleId } from "./ScheduleId";

export const DayOfWeekSchema = z.number().int().min(0).max(6);
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DayOfWeekLabel: Record<DayOfWeek, string> = {
  0: "Domingo",
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
};

export const ScheduleSchema = z.object({
  id: ScheduleIdSchema,
  professionalId: z.string().uuid(),
  dayOfWeek: DayOfWeekSchema,
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM"),
  active: z.boolean().default(true),
  createdAt: z.number().int().positive(),
  updatedAt: z.number().int().positive(),
});

export type ScheduleProps = z.infer<typeof ScheduleSchema>;

export class Schedule {
  private constructor(private readonly props: ScheduleProps) {}

  get id(): ScheduleId { return this.props.id as ScheduleId; }
  get professionalId(): string { return this.props.professionalId; }
  get dayOfWeek(): DayOfWeek { return this.props.dayOfWeek as DayOfWeek; }
  get startTime(): string { return this.props.startTime; }
  get endTime(): string { return this.props.endTime; }
  get active(): boolean { return this.props.active; }
  get createdAt(): number { return this.props.createdAt; }
  get updatedAt(): number { return this.props.updatedAt; }

  toProps(): ScheduleProps { return { ...this.props }; }

  static create(props: Omit<ScheduleProps, "createdAt" | "updatedAt" | "active"> & { active?: boolean }): Schedule {
    return new Schedule({
      ...props,
      active: props.active ?? true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  static reconstitute(props: ScheduleProps): Schedule {
    return new Schedule(props);
  }
}
