/**
 * mondlift.de - Worker vor den Static Assets.
 *
 * Aufgaben:
 *  - www.* auf die Apex-Domain umleiten
 *  - POST /api/contact entgegennehmen
 *  - sitemap.xml und llms.txt aus site.config.json erzeugen
 *  - die IndexNow-Schluesseldatei ausliefern
 *  - die Anschrift als Bild zeichnen
 *  - Daten aus site.config.json in die HTML-Seiten einsetzen
 *  - strukturierte Daten einsetzen und ihren Hash in die CSP schreiben
 *  - Security-Header auf jede Antwort legen
 *
 * Alles andere ist statisch und kommt aus ./public via Asset-Binding.
 */

import { withSecurityHeaders } from "./headers";
import { injectSiteConfig, isHtml } from "./site-config";
import { handleContact, contactJson, contactRedirect } from "./contact";
import { handleSitemap } from "./sitemap";
import { LLMS_PATH, handleLlms } from "./llms";
import { strukturierteDaten } from "./strukturierte-daten";
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
    // Auch diese Antwort bekommt die Security-Header: HSTS gehoert gerade an
    // die Weiterleitung, denn sie ist bei einem Aufruf von www oft die erste
    // und einzige Antwort, die der Browser von dieser Domain sieht.
    if (url.hostname.startsWith("www.")) {
      const target = new URL(url);
      target.hostname = url.hostname.slice(4);
      return withSecurityHeaders(
        new Response(null, {
          status: 301,
          headers: { location: target.toString() },
        }),
        url,
      );
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
    // Seitenliste, Schluessel und Anschrift nur an einer Stelle stehen. Sie
    // bekommen den ganzen Request, weil sie ein passendes If-None-Match mit
    // 304 beantworten - siehe src/cache.ts.
    if (url.pathname === SITEMAP_PATH) {
      return withSecurityHeaders(handleSitemap(request), url);
    }

    if (url.pathname === LLMS_PATH) {
      return withSecurityHeaders(handleLlms(request), url);
    }

    if (url.pathname === ANSCHRIFT_PATH) {
      return withSecurityHeaders(handleAnschrift(request), url);
    }

    if (INDEXNOW_KEY_PATH !== null && url.pathname === INDEXNOW_KEY_PATH) {
      return withSecurityHeaders(handleIndexNowKey(request), url);
    }

    // --- Auslieferung ----------------------------------------------------
    try {
      // Das Asset-Binding soll die Query nicht sehen: ?status=... gehört
      // zur Seitenlogik, nicht zum Dateinamen, und würde sonst den Cache
      // unnötig aufteilen.
      const assetUrl = new URL(url);
      assetUrl.search = "";
      const asset = await env.ASSETS.fetch(new Request(assetUrl, request));

      if (!isHtml(asset)) return withSecurityHeaders(asset, url);

      // Die strukturierten Daten und der Hash dafuer gehoeren zusammen:
      // der Block kommt in den Kopf der Seite, der Hash in die CSP. Beide
      // aus derselben Zeichenkette, siehe src/strukturierte-daten.ts.
      const daten = await strukturierteDaten(url.pathname);
      const body = injectSiteConfig(asset, {
        turnstileSiteKey: env.TURNSTILE_SITE_KEY,
        status: url.searchParams.get("status"),
        jsonLd: daten?.json,
      });
      return withSecurityHeaders(body, url, daten ? [daten.hash] : []);
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
