interface Env {
  API_GATEWAY_URL: string;
  APP_AUTH_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
  TURNSTILE_SITE_KEY: string;
  SESSION_SIGNING_SECRET: string;
  SESSION_TTL_SECONDS?: string;
  [key: string]: string;
}

const corsHeaders = {
  "access-control-allow-headers": "content-type, authorization, x-session-id, x-recording-role, x-recording-metadata, x-room-capacity, x-waiting-room-limit-seconds",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

const encoder = new TextEncoder();

function base64url(value: ArrayBuffer | string): string {
  const bytes = typeof value === "string" ? encoder.encode(value) : new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return atob(base64);
}

async function sign(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return base64url(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function verify(value: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = Uint8Array.from(fromBase64url(signature), (character) => character.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(value));
}

async function createSession(env: Env): Promise<{ sessionId: string; sessionToken: string; expiresInSeconds: number }> {
  const expiresInSeconds = Math.max(60, Number(env.SESSION_TTL_SECONDS || 3600));
  const payload = base64url(JSON.stringify({
    sessionId: crypto.randomUUID(),
    expiresAt: Math.floor(Date.now() / 1000) + expiresInSeconds,
  }));
  const sessionToken = `${payload}.${await sign(payload, env.SESSION_SIGNING_SECRET)}`;
  const session = JSON.parse(fromBase64url(payload)) as { sessionId: string };
  return { sessionId: session.sessionId, sessionToken, expiresInSeconds };
}

async function validateSession(request: Request, env: Env): Promise<boolean> {
  const authorization = request.headers.get("authorization") || "";
  const [payload, signature] = authorization.startsWith("Bearer ")
    ? authorization.slice(7).split(".")
    : [];
  if (!payload || !signature || !(await verify(payload, signature, env.SESSION_SIGNING_SECRET))) return false;
  try {
    const session = JSON.parse(fromBase64url(payload)) as { sessionId?: string; expiresAt?: number };
    return Boolean(session.sessionId && session.expiresAt && session.expiresAt > Math.floor(Date.now() / 1000)
      && session.sessionId === request.headers.get("x-session-id"));
  } catch {
    return false;
  }
}

async function verifyTurnstile(request: Request, env: Env, token: unknown): Promise<boolean> {
  if (typeof token !== "string" || !token) return false;
  const form = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) form.set("remoteip", remoteIp);
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!response.ok) return false;
  const result = await response.json() as { success?: boolean; action?: string };
  return result.success === true && (!result.action || result.action === "session");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const pathname = new URL(request.url).pathname;
    if (pathname === "/api/config" && request.method === "GET") {
      return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY });
    }

    if (pathname === "/api/session" && request.method === "POST") {
      const body = await request.json().catch(() => ({})) as { turnstileToken?: unknown };
      if (!(await verifyTurnstile(request, env, body.turnstileToken))) {
        return json({ error: "human_verification_failed" }, 403);
      }
      return json(await createSession(env));
    }

    if (!(await validateSession(request, env))) return json({ error: "unauthorized" }, 401);

    const upstreamPath = pathname.replace(/^\/api/, "") || "/health";
    const upstream = `${env.API_GATEWAY_URL.replace(/\/$/, "")}${upstreamPath}`;
    const upstreamResponse = await fetch(upstream, {
      method: request.method,
      headers: {
        "authorization": `Bearer ${env.APP_AUTH_TOKEN}`,
        "content-type": request.headers.get("content-type") ?? "application/json",
        "x-session-id": request.headers.get("x-session-id") ?? "",
        "x-recording-role": request.headers.get("x-recording-role") ?? "",
        "x-recording-metadata": request.headers.get("x-recording-metadata") ?? "",
        "x-room-capacity": request.headers.get("x-room-capacity") ?? "",
        "x-waiting-room-limit-seconds": request.headers.get("x-waiting-room-limit-seconds") ?? "",
      },
      body: request.method === "GET" ? undefined : request.body,
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  },
};
