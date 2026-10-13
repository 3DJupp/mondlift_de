/**
 * Die Seitenliste als lesbares HTML - der Inhalt von /sitemap.
 *
 * Warum es diese Seite gibt: sitemap.xml ist eine Datei fuer Maschinen und
 * sieht im Browser entsprechend aus. Der uebliche Trick dagegen war ein
 * XSLT-Stylesheet, das der Browser auf das XML legt. Den Weg gibt es nicht
 * mehr: Chrome entfernt XSLT mit Version 158 (17. November 2026), Firefox
 * und WebKit haben dasselbe angekuendigt. Eine Sitemap, die nur mit XSLT
 * schoen aussieht, sieht also ab dieser Version wieder aus wie vorher.
 *
 * Deshalb hier die Trennung, die ohnehin die ehrlichere ist:
 *
 *   /sitemap.xml   Maschinen. Reines XML, kein Stylesheet.
 *   /sitemap       Menschen. Eine normale Seite dieser Seite.
 *
 * Beide kommen aus `pages` in site.config.json, also kann die Uebersicht
 * nicht von der Sitemap abweichen. Nebeneffekt: ein Verzeichnis, das jede
 * Seite mit einem Satz beschreibt, ist auch fuer Suchmaschinen ein
 * brauchbarer Einstieg - vier Zeilen Nutzen mehr als das blosse XML.
 */

import config from "../site.config.json";
import { escapeHtml } from "./html";

interface PageEntry {
  path: string;
  title?: string;
  summary?: string;
  lastmod?: string;
}

const PAGES: PageEntry[] = config.pages;

/** ISO-Datum (YYYY-MM-DD) als TT.MM.JJJJ, wie im Seitenfuss. */
function germanDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/**
 * Eine Beschreibungsliste: Pfad und Titel als Link, darunter der Satz aus
 * der Config und der Stand. `<dl>` und nicht `<ul>`, weil genau das hier
 * steht - ein Begriff und seine Erklaerung.
 */
export function seitenlisteHtml(): string {
  const items = PAGES.filter(
    (page) => page.title !== undefined && page.summary !== undefined,
  ).map((page) => {
    const datum = page.lastmod ?? config.site.lastUpdated;
    return [
      "  <dt>",
      `    <a href="${escapeHtml(page.path)}">${escapeHtml(page.title as string)}</a>`,
      `    <span class="liste__pfad">${escapeHtml(page.path)}</span>`,
      "  </dt>",
      "  <dd>",
      `    ${escapeHtml(page.summary as string)}`,
      `    <span class="liste__stand">Stand: ${escapeHtml(germanDate(datum))}</span>`,
      "  </dd>",
    ].join("\n");
  });

  return ['<dl class="liste">', ...items, "</dl>"].join("\n");
}
