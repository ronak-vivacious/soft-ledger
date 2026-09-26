// Frontend shim: Convex-compatible API over the Hono/Postgres backend.
//
// Pages keep their existing code shape:
//   const data = useQuery(api.module.function, args)  // undefined while loading
//   const mutate = useMutation(api.module.function)
//   await mutate(args)
//
// A tiny pub/sub cache re-runs active queries after mutations, mirroring
// Convex's reactive behavior for this app's needs.
import { useEffect, useState, useCallback, useRef } from "react";

type Token = { module: string; fn: string };

function parse(token: unknown): Token {
  if (typeof token !== "object" || token === null) {
    throw new Error("Invalid api token");
  }
  const t = token as { __ref?: string; module?: string; fn?: string };
  if (t.__ref) {
    const [module, fn] = t.__ref.split(".");
    return { module, fn };
  }
  return { module: t.module!, fn: t.fn! };
}

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "/api";

async function callFn(fnPath: string, args: unknown): Promise<unknown> {
  const res = await fetch(`${API_BASE}/fn`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ fn: fnPath, args }),
  });
  const json = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.result;
}

// ------------------------------------------------------------------ pub/sub

type Listener = () => void;
const listeners = new Set<Listener>();

/** Bump after any mutation so active useQuery hooks refetch. */
export function invalidateAll() {
  listeners.forEach((l) => l());
}

// Deliberately loose typing: the Convex backend provided generated types via
// its api tokens. This shim keeps page code unchanged by returning `any` from
// queries/mutations — call sites keep their existing property access patterns.
let querySeq = 0;

export function useQuery(token: unknown, args?: unknown): any {
  const key = JSON.stringify([token, args ?? {}]);
  const [state, setState] = useState<{ data?: unknown; error?: string; loading: boolean }>({
    loading: true,
  });
  const keyRef = useRef(key);
  keyRef.current = key;

  useEffect(() => {
    const queryId = ++querySeq;
    let cancelled = false;

    const run = async () => {
      try {
        const { module, fn } = parse(token);
        const result = await callFn(`${module}.${fn}`, args ?? {});
        if (!cancelled && keyRef.current === key) setState({ data: result, loading: false });
      } catch (err) {
        if (!cancelled && keyRef.current === key) {
          setState({ error: err instanceof Error ? err.message : "Failed", loading: false });
        }
      }
    };

    run();
    const listener = () => {
      run();
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (state.error) {
    console.warn(`[api] query error (${key.slice(0, 60)}):`, state.error);
  }
  return state.data; // undefined while loading or on error
}

export function useMutation(token: unknown): (args?: any) => Promise<any> {
  return useCallback(
    async (args?: unknown) => {
      const { module, fn } = parse(token);
      const result = await callFn(`${module}.${fn}`, args ?? {});
      invalidateAll();
      return result;
    },
    [token],
  );
}

// ------------------------------------------------------------------ api tree

// Mirrors the Convex `api` object: api.module.function — a lazy token that the
// hooks resolve into a "module.function" RPC path. Built with nested Proxies so
// `api.businesses.getByUser` etc. keep working unchanged.
function makeModule(moduleName: string): any {
  return new Proxy({ __module: moduleName } as Record<string, unknown>, {
    get(_target, prop: string) {
      if (typeof prop !== "string") return undefined;
      return { __ref: `${moduleName}.${prop}` };
    },
  });
}

export const api: any = new Proxy({} as Record<string, unknown>, {
  get(_target, module: string) {
    if (typeof module !== "string") return undefined;
    return makeModule(module);
  },
});

// ------------------------------------------------------------------ auth API

export async function signInEmailOtp(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/request-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Couldn't send the verification code.");
}

export async function verifyEmailOtp(email: string, code: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, code }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "That code didn't work.");
  invalidateAll();
}

export async function signOut(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: "POST",
    credentials: "include",
  });
  invalidateAll();
}

type SessionUserShape = {
  id: string;
  email: string;
  name?: string | null;
  phone?: string | null;
  username?: string | null;
  role?: string | null;
} | null;

export async function fetchMe(): Promise<SessionUserShape> {
  const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
  const json = (await res.json().catch(() => ({}))) as { user?: any };
  return (json.user as SessionUserShape) ?? null;
}
