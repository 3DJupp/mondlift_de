/**
 * 410 Gone fuer die Adressen des Vorbesitzers.
 *
 * Vor dieser Seite lief auf der Domain ein WordPress mit voellig anderem
 * Inhalt. Google kennt diese Adressen noch und ruft sie weiter ab - in der
 * Search Console tauchen sie als Beispiele auf, etwa /page/2/,
 * /wp-content/plugins/... oder Beitragsadressen mit Schraegstrich am Ende.
 * Mit dieser Seite haben sie nichts zu tun.
 *
 * Was dagegen *nicht* hilft:
 *
 *  - Weiterleiten auf die Startseite. Google wertet eine Weiterleitung auf
 *    etwas thematisch Fremdes als "Soft 404" und behandelt sie schlechter
 *    als einen klaren Fehler. Ausserdem verschwindet die Adresse dann nicht
 *    aus dem Index, sie zeigt nur woanders hin.
 *  - In robots.txt sperren. Eine gesperrte Adresse darf nicht abgerufen
 *    werden, also erfaehrt die Suchmaschine nie, dass es sie nicht mehr
 *    gibt. Gesperrte Altlasten bleiben deshalb laenger in der Liste als
 *    offene. Sie muessen abrufbar bleiben, um sterben zu koennen.
 *  - Das Entfernen-Werkzeug der Search Console. Das blendet eine Adresse
 *    ein halbes Jahr aus und loescht nichts.
 *
 * Was hilft, ist die richtige Antwort: **410 Gone** statt 404 Not Found.
 * Beides nimmt die Adresse mit der Zeit aus dem Index, 410 sagt dabei
 * "endgueltig weg" statt "gerade nicht da" und wird merklich schneller
 * verarbeitet. Fuer Adressen, die auf dieser Domain nie wieder existieren
 * werden, ist das die genauere Auskunft.
 *
 * Zwei Gruppen von Mustern, beides eindeutig:
 *
 *  1. WordPress-Spuren: /wp-*, /xmlrpc.php, /feed/, /category/..., Query-
 *     Parameter wie ?p=123. Die kann es hier nie geben - dieses Projekt ist
 *     ein Worker mit acht statischen Seiten.
 *  2. Adressen mit Schraegstrich am Ende. Keine Adresse dieser Seite endet
 *     so (ausser der Startseite), WordPress-Permalinks dagegen immer. Fuer
 *     eine Adresse, die sonst eine echte Seite waere, ist der Schraegstrich
 *     kein Grund fuer 410 - die wird auf die kanonische Form umgeleitet,
 *     siehe `altlast()`.
 *
 * Alles andere bleibt 404: ein Tippfehler in einem fremden Link soll ein
 * weicher Fehler bleiben, kein Grabstein.
 *
 * Nebeneffekt, nicht der Zweck: ein Grossteil der Angriffsversuche auf
 * fremde Server sucht genau diese Pfade. Die bekommen jetzt eine kurze
 * Antwort, ohne das Asset-Binding zu beschaeftigen.
 */

import config from "../site.config.json";

/** Pfade dieser Seite, ohne Schraegstrich am Ende. */
const BEKANNT = new Set<string>(
  (config.pages as Array<{ path: string }>).map((page) => page.path),
);

/**
 * Pfadmuster, die es auf dieser Domain nie gegeben hat und nie geben wird.
 * Ohne Beruecksichtigung der Gross- und Kleinschreibung, weil Crawler und
 * Scanner beides schicken.
 */
const PFAD_MUSTER: RegExp[] = [
  /^\/wp-/, //                      wp-admin, wp-content, wp-includes, wp-json, wp-login.php
  /^\/xmlrpc\.php$/,
  /^\/wlwmanifest\.xml$/,
  /^\/page\/\d+\/?$/, //            Blog-Blaetterung
  /^\/(category|tag|author|comments)\//,
  /^\/\d{4}\/\d{2}(\/|$)/, //       Datumsarchive: /2021/07/
  /(^|\/)feed\/?$/, //              /feed/, /beitrag/feed/
  /(^|\/)trackback\/?$/,
  /(^|\/)amp\/?$/,
  /\.php$/, //                      diese Seite hat kein PHP
];

/** Query-Parameter, die nur ein WordPress kennt. */
const QUERY_SCHLUESSEL = ["p", "page_id", "cat", "tag_id", "attachment_id", "m", "feed"];

/** Was mit einer Anfrage zu tun ist, die keine Seite dieser Liste trifft. */
export type Altlast =
  | { art: "gone" }
  | { art: "redirect"; ziel: string }
  | null;

/**
 * Prueft eine Adresse gegen die Muster.
 *
 *  `{ art: "gone" }`     410 - Adresse des Vorbesitzers.
 *  `{ art: "redirect" }` 301 - echte Seite, nur mit Schraegstrich am Ende.
 *  `null`                nichts zu tun, normal weiterreichen.
 */
export function altlast(url: URL): Altlast {
  const pfad = url.pathname;
  const wpQuery = QUERY_SCHLUESSEL.some((name) => url.searchParams.has(name));

  // Die Startseite mit einem WordPress-Parameter: /?p=123 war die Adressform
  // eines WordPress ohne sprechende Permalinks. Nur auf der Startseite ist
  // das eindeutig - dort erzeugt diese Seite selbst keine Query. Auf einer
  // Unterseite waere `?p=` eher ein Zaehlparameter aus einem fremden Link,
  // und ein 410 auf eine Seite, die es gibt, waere der schlimmere Fehler.
  if (pfad === "/") return wpQuery ? { art: "gone" } : null;

  // Dann die eigenen Seiten, vor allen Mustern: eine echte Seite soll nie
  // 410 bekommen, auch nicht wegen eines Parameters, den irgendein Dienst
  // an den Link gehaengt hat.
  const ohneSlash = pfad.replace(/\/+$/, "");
  if (BEKANNT.has(ohneSlash)) {
    if (ohneSlash === pfad) return null;
    const ziel = new URL(url);
    ziel.pathname = ohneSlash;
    return { art: "redirect", ziel: ziel.toString() };
  }

  const klein = pfad.toLowerCase();

  for (const muster of PFAD_MUSTER) {
    if (muster.test(klein)) return { art: "gone" };
  }

  // Ein WordPress-Parameter an einer Adresse, die es hier nicht gibt.
  if (wpQuery) return { art: "gone" };

  // Schraegstrich am Ende und keine eigene Seite: WordPress-Permalink.
  if (pfad.endsWith("/")) return { art: "gone" };

  return null;
}

/**
 * Die Antwort auf eine Altlast. Kurzer Text statt der 404-Seite: wer das
 * abruft, ist ein Crawler oder ein Scanner, und ein Mensch, der zufaellig
 * hier landet, braucht einen Satz und einen Link, keine gestaltete Seite.
 */
export function goneResponse(): Response {
  const body = [
    "410 Gone",
    "",
    "Diese Adresse gehoerte zu einer anderen Seite, die vor mondlift.de",
    "unter dieser Domain lief. Sie ist endgueltig verschwunden und kommt",
    "nicht zurueck.",
    "",
    `Was es hier gibt: ${config.site.url}/sitemap`,
    "",
  ].join("\n");

  return new Response(body, {
    status: 410,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      // Crawler duerfen das lange im Gedaechtnis behalten.
      "cache-control": "public, max-age=86400",
      // Falls eine dieser Adressen doch irgendwo verlinkt ist: nicht
      // indexieren, auch nicht als Fehlerseite.
      "x-robots-tag": "noindex",
    },
  });
}
