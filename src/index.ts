/**
 * mondlift.de - Worker vor den Static Assets.
 *
 * Aufgaben:
 *  - www.* auf die Apex-Domain umleiten
 *  - POST /api/contact entgegennehmen
 *  - Daten aus site.config.json in die HTML-Seiten einsetzen
 *  - Security-Header auf jede Antwort legen
 *
 * Alles andere ist statisch und kommt aus ./public via Asset-Binding.
 */

import { withSecurityHeaders } from "./headers";
import { injectSiteConfig, isHtml } from "./site-config";
import { handleContact, contactJson, contactRedirect } from "./contact";

const CONTACT_ENDPOINT = "/api/contact";

/** Erkennt den Weg mit JavaScript: fetch() schickt diesen Accept-Kopf. */
function wantsJson(request: Request): boolean {
  return (request.headers.get("accept") ?? "").includes("application/json");
}

export default {
  async fetch(request, env, _ctx): Promise<Response> {
    const url = new URL(request.url);

    // www.mondlift.de -> mondlift.de, Pfad und Query bleiben erhalten.
    if (url.hostname.startsWith("www.")) {
      const target = new URL(url);
      target.hostname = url.hostname.slice(4);
      return Response.redirect(target.toString(), 301);
    }

    // --- Kontaktformular -------------------------------------------------
    if (url.pathname === CONTACT_ENDPOINT) {
      if (request.method !== "POST") {
        return withSecurityHeaders(
          new Response("Method Not Allowed", {
            status: 405,
            headers: {
              allow: "POST",
              "content-type": "text/plain; charset=utf-8",
            },
          }),
          url,
        );
      }
      const status = await handleContact(request, env);
      const response = wantsJson(request)
        ? contactJson(status)
        : contactRedirect(status, url);
      return withSecurityHeaders(response, url);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return withSecurityHeaders(
        new Response("Method Not Allowed", {
          status: 405,
          headers: {
            allow: "GET, HEAD",
            "content-type": "text/plain; charset=utf-8",
          },
        }),
        url,
      );
    }

    // --- Auslieferung ----------------------------------------------------
    try {
      // Das Asset-Binding soll die Query nicht sehen: ?status=... gehört
      // zur Seitenlogik, nicht zum Dateinamen, und würde sonst den Cache
      // unnötig aufteilen.
      const assetUrl = new URL(url);
      assetUrl.search = "";
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));

      const body = isHtml(asset)
        ? injectSiteConfig(asset, {
            turnstileSiteKey: env.TURNSTILE_SITE_KEY,
            status: url.searchParams.get("status"),
          })
        : asset;
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
