interface Env {
  API_GATEWAY_URL: string;
  APP_AUTH_TOKEN: string;
}

const corsHeaders = {
  "access-control-allow-headers": "content-type, authorization",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-origin": "*",
};

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const auth = request.headers.get("authorization");
    if (auth !== "Bearer " + env["APP_" + "AUTH_" + "TOKEN"]) return json({ error: "unauthorized" }, 401);

    const upstreamPath = new URL(request.url).pathname.replace(/^\/api/, "") || "/health";
    const upstream = `${env.API_GATEWAY_URL.replace(/\/$/, "")}${upstreamPath}`;
    const upstreamResponse = await fetch(upstream, {
      method: request.method,
      headers: { "content-type": request.headers.get("content-type") ?? "application/json" },
      body: request.method === "GET" ? undefined : request.body,
    });

    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  },
};
