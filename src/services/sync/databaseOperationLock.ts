const DATABASE_OPERATION_LOCK = "nutriclinica.database-operation";

let fallbackTail: Promise<void> = Promise.resolve();

export function withDatabaseOperationLock<T>(
  operation: () => Promise<T>,
): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    const locks = navigator.locks as unknown as {
      request<R>(name: string, callback: () => R | PromiseLike<R>): Promise<R>;
    };
    return locks.request(DATABASE_OPERATION_LOCK, operation);
  }

  const result = fallbackTail.then(operation, operation);
  fallbackTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
