import type { Redis } from "ioredis";

export const statusEventsChannel = "magentic:status-events";

export type StatusEventType = "index";

export type StatusEvent = { type: StatusEventType };

export function publishStatusEvent(redis: Redis, event: StatusEvent): void {
  void redis.publish(statusEventsChannel, JSON.stringify(event));
}
