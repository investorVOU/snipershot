type Task<T> = () => Promise<T>;

class AIRequestQueue {
  private queue: Array<{ task: Task<unknown>; resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];
  private running = 0;
  private readonly concurrency: number;
  private readonly minDelayMs: number;
  private lastRunTime = 0;

  constructor(concurrency = 2, minDelayMs = 500) {
    this.concurrency = concurrency;
    this.minDelayMs = minDelayMs;
  }

  enqueue<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task: task as Task<unknown>, resolve: resolve as (v: unknown) => void, reject });
      this.drain();
    });
  }

  private async drain() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    const item = this.queue.shift();
    if (!item) return;
    this.running++;
    const now = Date.now();
    const elapsed = now - this.lastRunTime;
    if (elapsed < this.minDelayMs) {
      await new Promise((r) => setTimeout(r, this.minDelayMs - elapsed));
    }
    this.lastRunTime = Date.now();
    try {
      const result = await item.task();
      item.resolve(result);
    } catch (e) {
      item.reject(e);
    } finally {
      this.running--;
      this.drain();
    }
  }
}

export const aiQueue = new AIRequestQueue(2, 600);
