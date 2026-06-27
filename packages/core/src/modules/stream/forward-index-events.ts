import type { Redis } from "ioredis";
import { publishStatusEvent } from "./status-events.js";

type IndexEventEmitter = {
  on(event: "active" | "progress" | "completed" | "failed", listener: (...args: any[]) => void): unknown;
};

const progressThrottleMs = 1000;

export function forwardIndexEvents(redis: Redis, workers: IndexEventEmitter[]): void {
  let lastProgressAt = 0;

  const notify = () => publishStatusEvent(redis, { type: "index" });

  for (const worker of workers) {
    worker.on("active", notify);
    worker.on("progress", () => {
      const now = Date.now();

      if (now - lastProgressAt >= progressThrottleMs) {
        lastProgressAt = now;
        notify();
      }
    });
  }
}
