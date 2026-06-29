import type { FastifyInstance } from "fastify";
import type { createStreamer } from "../../modules/stream/streamer.js";

type Dependencies = {
  streamer: ReturnType<typeof createStreamer>;
};

export function registerStreamStatusRoute(app: FastifyInstance, deps: Dependencies): void {
  const { streamer } = deps;

  app.get("/api/stream/status", async (request, reply) => {
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    });
    reply.raw.write(": connected\n\n");

    request.raw.on("close", () => streamer.removeClient(reply.raw));

    await streamer.addClient(reply.raw);
  });
}
