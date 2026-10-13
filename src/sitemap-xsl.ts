/**
 * GET /sitemap.xsl - die Ansicht, die der Browser ueber sitemap.xml legt.
 *
 * Eine sitemap.xml ist eine Datei fuer Maschinen. Oben in der Datei steht
 * `<?xml-stylesheet href="/sitemap.xsl"?>`; damit wandelt der Browser das
 * XML beim Anzeigen in HTML um, waehrend jede Suchmaschine weiterhin das
 * unveraenderte XML liest. Fuer den Crawler aendert sich dadurch nichts -
 * die Verarbeitungsanweisung ist ein Kommentar fuer ihn.
 *
 * Zur Haltbarkeit, damit es spaeter niemanden ueberrascht: Chrome entfernt
 * XSLT mit Version 158 am 17. November 2026, Firefox und WebKit haben
 * dasselbe angekuendigt. Danach zeigt ein Browser wieder das rohe XML. Das
 * ist kein Schaden - es ist der Zustand von vorher, und die Sitemap
 * funktioniert davon unabhaengig weiter. Fuer die Zeit danach gibt es
 * /sitemap: dieselbe Liste als gewoehnliche Seite, die kein XSLT braucht.
 * Beide Fassungen stehen in dieser Ansicht nebeneinander verlinkt.
 *
 * Das Aussehen kommt aus /assets/css/style.css, mit denselben Klassen wie
 * jede andere Seite: `page`, `nav`, `wrap`, `tabelle`, `foot`. Deshalb
 * steht hier kein eigenes Farbschema, das beim naechsten Umbau des
 * Stylesheets zurueckbleiben wuerde - die Ansicht erbt die CI, statt sie
 * nachzubauen.
 *
 * Kein `<style>`-Block aus demselben Grund wie ueberall sonst: die CSP
 * dieser Antwort erlaubt keine Inline-Styles, und sie gilt auch fuer das
 * Ergebnis der Umwandlung.
 */

import config from "../site.config.json";
import { generatedFile } from "./cache";

/** Ein Tag - die Ansicht aendert sich seltener als die Liste darin. */
const MAX_AGE = 86400;

/** Der Namensraum, in dem die Elemente einer Sitemap stehen. */
const NS = "http://www.sitemaps.org/schemas/sitemap/0.9";

function sitemapXsl(): string {
  const name = config.site.name;
  const domain = config.site.domain;

  return `<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sm="${NS}">

  <xsl:output method="html" encoding="UTF-8" indent="yes"
    doctype-system="about:legacy-compat" />

  <!-- Aus 2026-10-08 wird 08.10.2026. XSLT 1.0 kann nicht rechnen, aber
       Zeichen zaehlen genuegt hier. -->
  <xsl:template name="datum">
    <xsl:param name="iso" />
    <xsl:choose>
      <xsl:when test="string-length($iso) &gt;= 10">
        <xsl:value-of select="substring($iso, 9, 2)" />
        <xsl:text>.</xsl:text>
        <xsl:value-of select="substring($iso, 6, 2)" />
        <xsl:text>.</xsl:text>
        <xsl:value-of select="substring($iso, 1, 4)" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="$iso" />
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="/">
    <html lang="de">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>sitemap.xml &#8212; ${name}</title>
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#070a12" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="stylesheet" href="/assets/css/style.css" />
      </head>
      <body class="page">
        <nav class="nav nav--breit" aria-label="Seiten">
          <a href="/">Start</a>
          <a href="/mondlift">Das Ger&#228;t</a>
          <a href="/enterprise">Der Typ</a>
          <a href="/glossar">Glossar</a>
          <a href="/fragen">Fragen</a>
          <a href="/sitemap">&#220;bersicht</a>
        </nav>

        <main class="wrap wrap--breit">
          <h1>sitemap.xml</h1>

          <p class="lead">
            <xsl:value-of select="count(sm:urlset/sm:url)" />
            <xsl:text> Adressen auf ${domain}, so wie Suchmaschinen sie </xsl:text>
            <xsl:text>lesen. Diese Ansicht erzeugt der Browser aus der </xsl:text>
            <xsl:text>XML-Datei; die Datei selbst ist davon unber&#252;hrt.</xsl:text>
          </p>

          <table class="tabelle tabelle--sitemap">
            <thead>
              <tr>
                <th scope="col">Adresse</th>
                <th scope="col">Ge&#228;ndert</th>
                <th scope="col">H&#228;ufigkeit</th>
                <th scope="col" class="zahl">Priorit&#228;t</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sm:urlset/sm:url">
                <xsl:sort select="sm:priority" order="descending" />
                <tr>
                  <td>
                    <a href="{sm:loc}">
                      <xsl:text>/</xsl:text>
                      <xsl:value-of
                        select="substring-after(substring-after(sm:loc, '://'), '/')" />
                    </a>
                  </td>
                  <td class="zelle--schmal">
                    <xsl:call-template name="datum">
                      <xsl:with-param name="iso" select="sm:lastmod" />
                    </xsl:call-template>
                  </td>
                  <td class="zelle--schmal">
                    <xsl:value-of select="sm:changefreq" />
                  </td>
                  <td class="zelle--schmal zahl">
                    <xsl:value-of select="sm:priority" />
                  </td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>

          <h2>Dieselbe Liste anderswo</h2>

          <ul>
            <li>
              <a href="/sitemap">/sitemap</a>
              <xsl:text> &#8212; als gew&#246;hnliche Seite, mit einem Satz </xsl:text>
              <xsl:text>zu jeder Adresse. Braucht kein XSLT und bleibt </xsl:text>
              <xsl:text>deshalb auch dann lesbar, wenn Browser diese </xsl:text>
              <xsl:text>Ansicht hier nicht mehr erzeugen.</xsl:text>
            </li>
            <li>
              <a href="/llms.txt">/llms.txt</a>
              <xsl:text> &#8212; Inhaltsverzeichnis f&#252;r Sprachmodelle.</xsl:text>
            </li>
            <li>
              <a href="/robots.txt">/robots.txt</a>
              <xsl:text> &#8212; was Crawler d&#252;rfen. Alles.</xsl:text>
            </li>
          </ul>

          <p class="meta">
            <xsl:text>Erzeugt aus site.config.json. </xsl:text>
            <a href="/kontakt">Fehlt eine Seite?</a>
          </p>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
`;
}

const FILE = generatedFile(sitemapXsl, "text/xsl; charset=utf-8", MAX_AGE);

export const SITEMAP_XSL_PATH = "/sitemap.xsl";

export function handleSitemapXsl(request: Request): Response {
  return FILE.respond(request);
}
