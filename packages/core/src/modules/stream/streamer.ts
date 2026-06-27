import type { ServerResponse } from "node:http";
import type { Redis } from "ioredis";
import { logger } from "../../logger.js";
import { statusEventsChannel, type StatusEventType } from "./status-events.js";

type SnapshotHandler = () => Promise<unknown>;

type Dependencies = {
  redis: Redis;
  handlers: Record<StatusEventType, SnapshotHandler>;
};

const debounceMs = 80;
const heartbeatMs = 20000;

export function createStreamer(deps: Dependencies) {
  const { redis, handlers } = deps;
  const subscriber = redis.duplicate();
  const clients = new Set<ServerResponse>();
  const timers = new Map<StatusEventType, ReturnType<typeof setTimeout>>();

  void subscriber.subscribe(statusEventsChannel);

  subscriber.on("message", (_channel, payload) => {
    const type = parseType(payload);

    if (type && handlers[type]) {
      scheduleDispatch(type);
    }
  });

  function scheduleDispatch(type: StatusEventType): void {
    const existing = timers.get(type);

    if (existing) {
      clearTimeout(existing);
    }

    timers.set(
      type,
      setTimeout(() => {
        timers.delete(type);
        void dispatch(type);
      }, debounceMs)
    );
  }

  async function dispatch(type: StatusEventType): Promise<void> {
    try {
      const snapshot = await handlers[type]();
      broadcast(type, snapshot);
    } catch (error) {
      logger.error({ event: "status_stream_dispatch_failed", type, err: error }, "Failed to dispatch status snapshot");
    }
  }

  function broadcast(type: StatusEventType, snapshot: unknown): void {
    const frame = `event: ${type}\ndata: ${JSON.stringify(snapshot)}\n\n`;

    for (const client of clients) {
      safeWrite(client, frame);
    }
  }

  function safeWrite(client: ServerResponse, frame: string): void {
    try {
      client.write(frame);
    } catch (error) {
      logger.warn({ event: "status_stream_write_failed", err: error }, "Dropping a disconnected status client");
      clients.delete(client);
    }
  }

  const heartbeat = setInterval(() => {
    for (const client of clients) {
      safeWrite(client, ": ping\n\n");
    }
  }, heartbeatMs);

  return {
    addClient: async (response: ServerResponse): Promise<void> => {
      clients.add(response);

      for (const type of Object.keys(handlers) as StatusEventType[]) {
        try {
          const snapshot = await handlers[type]();
          safeWrite(response, `event: ${type}\ndata: ${JSON.stringify(snapshot)}\n\n`);
        } catch (error) {
          logger.error({ event: "status_stream_initial_failed", type, err: error }, "Failed to send the initial snapshot");
        }
      }
    },
    removeClient: (response: ServerResponse): void => {
      clients.delete(response);
    },
    close: async (): Promise<void> => {
      clearInterval(heartbeat);

      for (const timer of timers.values()) {
        clearTimeout(timer);
      }

      for (const client of clients) {
        client.end();
      }

      clients.clear();
      await subscriber.quit();
    }
  };
}

function parseType(payload: string): StatusEventType | null {
  try {
    const parsed = JSON.parse(payload) as { type?: StatusEventType };

    return parsed.type ?? null;
  } catch {
    return null;
  }
}
