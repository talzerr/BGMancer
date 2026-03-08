/**
 * Process `items` with at most `limit` concurrent invocations of `fn`.
 * Uses a work-queue so the pool stays full until all items are consumed.
 * Any rejection propagates immediately (like Promise.all).
 */
export async function runConcurrent<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  const queue = [...items];
  async function worker() {
    let item: T | undefined;
    while ((item = queue.shift()) !== undefined) {
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
