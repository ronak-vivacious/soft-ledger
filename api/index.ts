// Vercel serverless function entrypoint (mounted at /api via vercel.json).
import { vercelHandler } from "./app";

export const config = { runtime: "nodejs" };

export default vercelHandler;
