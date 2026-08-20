import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";

export async function qrRoute(app: FastifyInstance) {
  app.get("/qr", async (request, reply) => {
    const { url } = request.query as { url?: string };
    if (!url || typeof url !== "string" || url.length > 2048) {
      return reply.status(400).send("Missing or invalid url parameter");
    }
    const svg = await QRCode.toString(url, { type: "svg", margin: 2 });
    reply.header("Content-Type", "image/svg+xml");
    reply.header("Cache-Control", "no-store");
    return reply.send(svg);
  });
}
