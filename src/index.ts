/**
 * mondlift.de - Worker vor den Static Assets.
 *
 * Aufgaben:
 *  - www.* auf die Apex-Domain umleiten
 *  - Daten aus site.config.json in die HTML-Seiten einsetzen
 *  - Security-Header auf jede Antwort legen
 *
 * Alles andere ist statisch und kommt aus ./public via Asset-Binding.
 */

import { withSecurityHeaders } from "./headers";
import { injectSiteConfig, isHtml } from "./site-config";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);

    // www.mondlift.de -> mondlift.de, Pfad und Query bleiben erhalten.
    if (url.hostname.startsWith("www.")) {
      const target = new URL(url);
      target.hostname = url.hostname.slice(4);
      return Response.redirect(target.toString(), 301);
    }

    // Phase 1 ist reines Ausliefern. POST /api/contact kommt in Phase 2.
    if (!ALLOWED_METHODS.has(request.method)) {
      return withSecurityHeaders(
        new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "GET, HEAD", "content-type": "text/plain; charset=utf-8" },
        }),
        url,
      );
    }

    try {
      const asset = await env.ASSETS.fetch(request);
      const body = isHtml(asset) ? injectSiteConfig(asset) : asset;
      return withSecurityHeaders(body, url);
    } catch (error) {
      // Strukturiert loggen, nach aussen nichts Internes preisgeben.
      console.error(
        JSON.stringify({
          event: "asset_fetch_failed",
          path: url.pathname,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return withSecurityHeaders(
        new Response("Interner Fehler", {
          status: 500,
          headers: { "content-type": "text/plain; charset=utf-8" },
        }),
        url,
      );
    }
  },
} satisfies ExportedHandler<Env>;
