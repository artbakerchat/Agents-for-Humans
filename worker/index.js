export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname.startsWith("/api/")) {
      if (!env.API_WORKER_URL || env.API_WORKER_URL.includes("replace-me")) {
        return Response.json({ error: "API_WORKER_URL_not_configured" }, { status: 503 });
      }

      const upstream = new URL(url.pathname + url.search, env.API_WORKER_URL);
      return fetch(new Request(upstream, request));
    }

    return env.ASSETS.fetch(request);
  },
};