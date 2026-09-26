#!/bin/sh
# Preview entrypoint: starts the Postgres API server, then Vite in the
# foreground. Vite proxies /api to the local API (see vite.config.ts), which
# mirrors the Vercel production layout (SPA + /api function).
bun tsx api/dev.ts &
API_PID=$!
trap 'kill $API_PID 2>/dev/null' INT TERM
bun run dev
