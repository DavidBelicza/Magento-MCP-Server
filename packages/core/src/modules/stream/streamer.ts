import type { ServerResponse } from "node:http";
import type { Redis } from "ioredis";
import { logger } from "../../logger.js";
import { statusEventsChannel } from "./status-events.js";

type Dependencies = {
  redis: Redis;
  snapshot: () => Promise<unknown>;
};

const debounceMs = 80;
const heartbeatMs = 20000;
const eventName = "status";

export function createStreamer(deps: Dependencies) {
  const { redis, snapshot } = deps;
  const subscriber = redis.duplicate();
  const clients = new Set<ServerResponse>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  void subscriber.subscribe(statusEventsChannel);

  subscriber.on("message", () => scheduleDispatch());

  function scheduleDispatch(): void {
    if (timer) {
      clearTimeout(timer);
    }

    timer = setTimeout(() => {
      timer = null;
      void dispatch();
    }, debounceMs);
  }

  async function dispatch(): Promise<void> {
    try {
      const data = await snapshot();
      const text = frame(data);

      for (const client of clients) {
        safeWrite(client, text);
      }
    } catch (error) {
      logger.error({ event: "status_stream_dispatch_failed", err: error }, "Failed to dispatch status snapshot");
    }
  }

  function frame(data: unknown): string {
    return `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  function safeWrite(client: ServerResponse, text: string): void {
    try {
      client.write(text);
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

      try {
        safeWrite(response, frame(await snapshot()));
      } catch (error) {
        logger.error({ event: "status_stream_initial_failed", err: error }, "Failed to send the initial snapshot");
      }
    },
    removeClient: (response: ServerResponse): void => {
      clients.delete(response);
    },
    close: async (): Promise<void> => {
      clearInterval(heartbeat);

      if (timer) {
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
