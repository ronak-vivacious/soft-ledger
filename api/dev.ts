// Dev API server: runs the shared Hono app at /api on a local port.
// Vite proxies /api here during preview. (The Vercel handler lives in index.ts.)
import { serve } from "@hono/node-server";
import { honoApp } from "./app";

const port = Number(process.env.API_PORT) || 8787;
serve({ fetch: honoApp.fetch, port }, (info) => {
  console.log(`[api] listening on http://127.0.0.1:${info.port}`);
});
