/**
 * Die Seitenliste als lesbares HTML - der Inhalt von /sitemap bzw.
 * /en/sitemap.
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
 * nicht von der Sitemap abweichen. Jede Sprache listet ihre eigenen Seiten.
 */

import { escapeHtml } from "./html";
import { PAGES, formatDate, type Lang } from "./pages";

const LABEL_UPDATED: Record<Lang, string> = {
  de: "Stand",
  en: "Last updated",
};

/**
 * Eine Beschreibungsliste: Pfad und Titel als Link, darunter der Satz aus
 * der Config und der Stand. `<dl>` und nicht `<ul>`, weil genau das hier
 * steht - ein Begriff und seine Erklaerung.
 */
export function pageListHtml(lang: Lang): string {
  const items = PAGES.filter((page) => page.lang === lang).map((page) =>
    [
      "  <dt>",
      `    <a href="${escapeHtml(page.path)}">${escapeHtml(page.title)}</a>`,
      `    <span class="page-list__path">${escapeHtml(page.path)}</span>`,
      "  </dt>",
      "  <dd>",
      `    ${escapeHtml(page.summary)}`,
      `    <span class="page-list__date">${LABEL_UPDATED[lang]}: ${escapeHtml(formatDate(page.lastmod, lang))}</span>`,
      "  </dd>",
    ].join("\n"),
  );

  return ['<dl class="page-list">', ...items, "</dl>"].join("\n");
}
