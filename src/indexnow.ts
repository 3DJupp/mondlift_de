/**
 * IndexNow - die Schluesseldatei.
 *
 * Das Protokoll verlangt einen Nachweis, dass man die Domain kontrolliert:
 * der Schluessel muss unter https://<domain>/<schluessel>.txt abrufbar sein
 * und genau diesen Schluessel enthalten. Mehr ist im Worker nicht zu tun -
 * eingereicht wird nach dem Deploy mit `npm run indexnow`.
 *
 * Zwei Entscheidungen dazu:
 *
 * 1. **Der Schluessel steht in site.config.json, nicht in `wrangler secret`.**
 *    Er ist oeffentlich, denn jede Suchmaschine laedt die Datei. Als Secret
 *    oder als `vars`-Eintrag stuende derselbe Wert zweimal im Repo: einmal
 *    fuer den Worker, einmal fuer das Einreichungsskript. Geheim ist daran
 *    nichts, einzig zu erraten soll er nicht sein - deshalb Zufall statt
 *    eines sprechenden Namens.
 *
 * 2. **Die Datei wird aus dem Worker beantwortet, nicht aus public/.**
 *    Sonst haette das Repo eine Datei, deren Name der Schluessel ist, und
 *    ein Wechsel des Schluessels waere ein Dateiwechsel statt einer
 *    Zeilenaenderung.
 */

import config from "../site.config.json";

/** Zeichen und Laenge nach IndexNow-Spezifikation. */
const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

const KEY = config.indexNow.key;

/**
 * Pfad der Schluesseldatei - oder null, wenn kein brauchbarer Schluessel
 * eingetragen ist. Dann gibt es die Datei nicht, und die Einreichung
 * schlaegt bei den Suchmaschinen fehl statt stillschweigend ins Leere zu
 * laufen.
 */
export const INDEXNOW_KEY_PATH: string | null = KEY_PATTERN.test(KEY)
  ? `/${KEY}.txt`
  : null;

export function handleIndexNowKey(): Response {
  // Bewusst ohne Zeilenumbruch: die Spezifikation beschreibt den Inhalt als
  // den Schluessel selbst. Die meisten Pruefer schneiden Leerraum ab, aber
  // darauf angewiesen sein muss man nicht.
  return new Response(KEY, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=86400",
    },
  });
}
