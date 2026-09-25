export interface Scd2CurrentVersion {
  validFrom: Date;
  sourceUpdatedAt: Date | null;
  sourceVersion: Buffer | null;
}

export interface Scd2IncomingVersion {
  sourceUpdatedAt: Date;
  sourceVersion: Buffer;
}

export type Scd2Transition = "INSERT" | "APPEND" | "REFRESH_SOURCE" | "NOOP";

function assertValidDate(value: Date, name: string): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error(`${name} must be a valid Date`);
  }
}

function assertSourceVersion(value: Buffer, name: string): void {
  if (!Buffer.isBuffer(value) || value.length !== 8) {
    throw new Error(`${name} must be an 8-byte OLTP rowversion`);
  }
}

export function compareScd2SourceOrder(
  left: Scd2IncomingVersion,
  right: Scd2IncomingVersion,
): number {
  assertValidDate(left.sourceUpdatedAt, "left.sourceUpdatedAt");
  assertValidDate(right.sourceUpdatedAt, "right.sourceUpdatedAt");
  assertSourceVersion(left.sourceVersion, "left.sourceVersion");
  assertSourceVersion(right.sourceVersion, "right.sourceVersion");
  const timestampOrder =
    left.sourceUpdatedAt.getTime() - right.sourceUpdatedAt.getTime();
  return timestampOrder === 0
    ? Buffer.compare(left.sourceVersion, right.sourceVersion)
    : timestampOrder;
}

export function decideScd2Transition(input: {
  current: Scd2CurrentVersion | null;
  incoming: Scd2IncomingVersion;
  attributesEqual: boolean;
}): Scd2Transition {
  assertValidDate(input.incoming.sourceUpdatedAt, "incoming.sourceUpdatedAt");
  assertSourceVersion(input.incoming.sourceVersion, "incoming.sourceVersion");
  if (!input.current) return "INSERT";

  assertValidDate(input.current.validFrom, "current.validFrom");
  const hasSourceUpdatedAt = input.current.sourceUpdatedAt !== null;
  const hasSourceVersion = input.current.sourceVersion !== null;
  if (hasSourceUpdatedAt !== hasSourceVersion) {
    throw new Error("SCD2_CURRENT_SOURCE_METADATA_INCOMPLETE");
  }

  if (!hasSourceUpdatedAt || !hasSourceVersion) {
    if (input.attributesEqual) return "REFRESH_SOURCE";
    if (
      input.incoming.sourceUpdatedAt.getTime() <=
      input.current.validFrom.getTime()
    ) {
      throw new Error("SCD2_OUT_OF_ORDER_UNSUPPORTED");
    }
    return "APPEND";
  }

  const order = compareScd2SourceOrder(input.incoming, {
    sourceUpdatedAt: input.current.sourceUpdatedAt!,
    sourceVersion: input.current.sourceVersion!,
  });
  if (input.attributesEqual) {
    return order > 0 ? "REFRESH_SOURCE" : "NOOP";
  }
  if (order === 0) throw new Error("SCD2_SOURCE_ORDER_NOT_DISTINGUISHABLE");
  if (order < 0) throw new Error("SCD2_OUT_OF_ORDER_UNSUPPORTED");
  return "APPEND";
}
