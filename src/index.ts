/**
 * mondlift.de - Worker vor den Static Assets.
 *
 * Aufgaben:
 *  - www.* auf die Apex-Domain umleiten
 *  - POST /api/contact entgegennehmen
 *  - sitemap.xml aus site.config.json erzeugen
 *  - die IndexNow-Schluesseldatei ausliefern
 *  - die Anschrift als Bild zeichnen
 *  - Daten aus site.config.json in die HTML-Seiten einsetzen
 *  - Security-Header auf jede Antwort legen
 *
 * Alles andere ist statisch und kommt aus ./public via Asset-Binding.
 */

import { withSecurityHeaders } from "./headers";
import { injectSiteConfig, isHtml } from "./site-config";
import { handleContact, contactJson, contactRedirect } from "./contact";
import { handleSitemap } from "./sitemap";
import { INDEXNOW_KEY_PATH, handleIndexNowKey } from "./indexnow";
import { handleAnschrift } from "./anschrift";

const CONTACT_ENDPOINT = "/api/contact";
const SITEMAP_PATH = "/sitemap.xml";
const ANSCHRIFT_PATH = "/anschrift.svg";

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

    // --- Erzeugte Dateien ------------------------------------------------
    // Alle drei kommen aus site.config.json statt aus public/, damit
    // Seitenliste, Schluessel und Anschrift nur an einer Stelle stehen.
    if (url.pathname === SITEMAP_PATH) {
      return withSecurityHeaders(handleSitemap(), url);
    }

    if (url.pathname === ANSCHRIFT_PATH) {
      return withSecurityHeaders(handleAnschrift(), url);
    }

    if (INDEXNOW_KEY_PATH !== null && url.pathname === INDEXNOW_KEY_PATH) {
      return withSecurityHeaders(handleIndexNowKey(), url);
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
