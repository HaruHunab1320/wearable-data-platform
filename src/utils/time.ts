export async function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
export function exponentialBackoffDelay(
  currentFailureCount: number,
  minDelay: number,
  maxDelay: number,
  maxFailureCount: number
) {
  const maxDelayRet =
    minDelay +
    ((maxDelay - minDelay) / maxFailureCount) *
      Math.max(currentFailureCount, maxFailureCount);
  return Math.round(Math.random() * maxDelayRet);
}

export type BackoffFunc = <T>(callback: () => Promise<T>) => Promise<T>;

export function createBackoff(opts?: {
  onError?: (e: any, failuresCount: number) => void;
  minDelay?: number;
  maxDelay?: number;
  maxFailureCount?: number;
}): BackoffFunc {
  return async <T>(callback: () => Promise<T>): Promise<T> => {
    let currentFailureCount = 0;
    const minDelay = opts && opts.minDelay !== undefined ? opts.minDelay : 250;
    const maxDelay = opts && opts.maxDelay !== undefined ? opts.maxDelay : 1000;
    const maxFailureCount = opts?.maxFailureCount ?? 50;
    let attempts = 0;
    while (attempts < maxFailureCount) {
      try {
        return await callback();
      } catch (e) {
        attempts++;
        if (attempts < maxFailureCount) {
          currentFailureCount++;
        }
        if (opts && opts.onError) {
          opts.onError(e, currentFailureCount);
        }
        const waitForRequest = exponentialBackoffDelay(
          currentFailureCount,
          minDelay,
          maxDelay,
          maxFailureCount
        );
        await delay(waitForRequest);
      }
    }
    throw new Error(`Max failure count (${maxFailureCount}) reached`);
  };
}

export const backoff = createBackoff({
  onError(e) {
    console.warn(e);
  },
});
