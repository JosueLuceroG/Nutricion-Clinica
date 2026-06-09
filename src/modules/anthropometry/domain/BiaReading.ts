import { z } from "zod";

export const BiaDeviceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  brand: z.string().max(100).default(""),
  model: z.string().max(100).default(""),
  type: z.enum(["bipolar", "tetrapolar", "segmentario", "multifrecuencia"]),
  lastCalibration: z.string().optional(),
  notes: z.string().max(500).default(""),
  createdAt: z.number().int().positive(),
});
export type BiaDeviceProps = z.infer<typeof BiaDeviceSchema>;

export const BiaReadingSchema = z.object({
  deviceId: z.string().uuid().optional(),
  impedance: z.number().positive().optional(),
  bodyFatPct: z.number().min(3).max(80).optional(),
  muscleMassKg: z.number().positive().optional(),
  boneMassKg: z.number().positive().optional(),
  totalBodyWaterL: z.number().positive().optional(),
  bmrKcal: z.number().positive().optional(),
  visceralFatLevel: z.number().int().min(1).max(20).optional(),
  phaseAngle: z.number().min(1).max(15).optional(),
  notes: z.string().max(500).default(""),
});
export type BiaReading = z.infer<typeof BiaReadingSchema>;

export class BiaDevice {
  private constructor(private readonly props: BiaDeviceProps) {}
  get id(): string { return this.props.id; }
  get name(): string { return this.props.name; }
  get brand(): string { return this.props.brand; }
  get model(): string { return this.props.model; }
  get type(): string { return this.props.type; }
  get lastCalibration(): string | undefined { return this.props.lastCalibration; }
  get notes(): string { return this.props.notes; }
  get createdAt(): number { return this.props.createdAt; }
  toProps(): BiaDeviceProps { return { ...this.props }; }
  static create(props: Omit<BiaDeviceProps, "id" | "createdAt">): BiaDevice {
    return new BiaDevice({ ...props, id: crypto.randomUUID(), createdAt: Date.now() });
  }
  static reconstitute(props: BiaDeviceProps): BiaDevice { return new BiaDevice(props); }
}
