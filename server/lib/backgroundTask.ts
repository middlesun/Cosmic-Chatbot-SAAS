import { AsyncLocalStorage } from 'node:async_hooks';

type WaitUntilFn = (promise: Promise<unknown>) => void;

const waitUntilStorage = new AsyncLocalStorage<WaitUntilFn>();

export function runWithWaitUntil<T>(waitUntil: WaitUntilFn, fn: () => T): T {
  return waitUntilStorage.run(waitUntil, fn);
}

export function scheduleBackgroundTask(task: () => Promise<void>): void {
  const waitUntil = waitUntilStorage.getStore();
  if (waitUntil) {
    waitUntil(
      task().catch((err) => {
        console.error('[backgroundTask] Cloudflare waitUntil task error:', err);
      })
    );
    return;
  }

  queueMicrotask(() => {
    void task().catch((err) => {
      console.error('[backgroundTask] Node background task error:', err);
    });
  });
}
