import type { FastifyInstance } from "fastify";
import type { ServerResponse } from "node:http";

// showId (as string key) → set of active SSE response streams
const connections = new Map<string, Set<ServerResponse>>();

/**
 * Broadcast a mics_updated event to all clients watching a given show.
 * Called by mics routes after any write that changes the grid.
 */
export function broadcastShow(showId: number): void {
  const payload = `data: ${JSON.stringify({ type: "mics_updated", showId })}\n\n`;
  const set = connections.get(String(showId));
  if (!set || set.size === 0) return;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      set.delete(res);
    }
  }
}

export async function eventsRoutes(app: FastifyInstance) {
  app.get("/api/events", (request, reply) => {
    const { showId } = request.query as { showId?: string };

    const res = reply.raw;
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // prevent nginx buffering
    res.flushHeaders();
    res.write(": connected\n\n");

    const key = showId ?? "all";
    if (!connections.has(key)) connections.set(key, new Set());
    connections.get(key)!.add(res);

    // Keepalive comment every 25s so proxies don't close idle connections
    const ping = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        clearInterval(ping);
      }
    }, 25000);

    request.raw.on("close", () => {
      clearInterval(ping);
      connections.get(key)?.delete(res);
    });

    // Hand off the raw response to us; tell Fastify not to touch it
    reply.hijack();
  });
}
