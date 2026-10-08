/**
 * GET /sitemap.xml - erzeugt aus site.config.json.
 *
 * Warum kein fertiges XML in public/: Seitenliste, Domain und Datum stuenden
 * dann ein zweites Mal im Repo und laufen mit der Zeit auseinander. So ist
 * site.config.json die einzige Quelle, und dieselbe Liste benutzt auch
 * scripts/indexnow.mjs fuer die Einreichung bei den Suchmaschinen.
 *
 * `lastmod` ist der einzige Hinweis aus dieser Datei, auf den Google noch
 * hoert; `changefreq` und `priority` werden dort seit Jahren ignoriert. Sie
 * stehen trotzdem drin, weil sie andere Suchmaschinen weiterhin lesen und
 * nichts kosten.
 *
 * Deshalb steht das Datum pro Seite in der Config und nicht einmal fuer alle
 * vier. Ein `lastmod`, das sich bei jedem Deploy fuer jede Seite aendert, ist
 * fuer Google kein Signal, sondern Rauschen - und Google traut dem Feld dann
 * gar nicht mehr. `site.lastUpdated` bleibt der Rueckfall fuer Seiten ohne
 * eigenes Datum und bleibt der "Stand" im Seitenfuss.
 */

import config from "../site.config.json";
import { generatedFile } from "./cache";

/** Eine Stunde. Der Inhalt aendert sich nur mit einem Deploy. */
const MAX_AGE = 3600;

/** Ein Eintrag aus `pages`. `lastmod` ist optional. */
interface PageEntry {
  path: string;
  changefreq: string;
  priority: string;
  lastmod?: string;
}

const PAGES: PageEntry[] = config.pages;

const XML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/**
 * Maskiert die fuenf Zeichen, die die Sitemap-Spezifikation in Textknoten
 * verbietet. Die Werte kommen aus der eigenen Config und enthalten davon
 * nichts - das hier ist die Zusicherung, dass es auch morgen noch stimmt.
 */
function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ENTITIES[char] ?? char);
}

/** Die vollstaendige sitemap.xml als Zeichenkette. */
function sitemapXml(): string {
  const entries = PAGES.map((page) => {
    const loc = new URL(page.path, config.site.url).toString();
    const lastmod = page.lastmod ?? config.site.lastUpdated;
    return [
      "  <url>",
      `    <loc>${escapeXml(loc)}</loc>`,
      `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
      `    <changefreq>${escapeXml(page.changefreq)}</changefreq>`,
      `    <priority>${escapeXml(page.priority)}</priority>`,
      "  </url>",
    ].join("\n");
  });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    "</urlset>",
    "",
  ].join("\n");
}

const FILE = generatedFile(
  sitemapXml,
  "application/xml; charset=utf-8",
  MAX_AGE,
);

export function handleSitemap(request: Request): Response {
  return FILE.respond(request);
}
