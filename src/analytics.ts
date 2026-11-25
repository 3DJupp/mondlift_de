/**
 * Google Analytics 4 - aus, solange keine Mess-ID gesetzt ist.
 *
 * Zwei Formen werden angenommen: eine GA4-Mess-ID (`G-...`), dann lädt die
 * Seite gtag.js direkt, oder eine Container-ID des Google Tag Managers
 * (`GTM-...`), dann lädt sie gtm.js, und welche Tags laufen, steht im
 * Container. Beides erst nach Einwilligung.
 *
 * Die ID steht in wrangler.jsonc unter `vars.GA_MEASUREMENT_ID` (sie ist
 * öffentlich, sie steht ohnehin im HTML). Leer heißt: kein Banner, kein
 * Skript, keine zusätzliche CSP-Quelle, Datenschutzerklärung in der Fassung
 * ohne Tracking. Alles hängt an dieser einen Stelle.
 *
 * Mit ID passiert serverseitig nur dreierlei:
 *  - `<meta name="ga-measurement-id">` und das Einwilligungsskript kommen
 *    in den Kopf jeder HTML-Seite,
 *  - die CSP erlaubt die Quellen von Google, siehe src/headers.ts,
 *  - Blöcke mit `data-analytics="on"` bleiben stehen, solche mit
 *    `data-analytics="off"` fallen weg (Datenschutzerklärung).
 *
 * Geladen wird gtag.js bzw. gtm.js erst im Browser und erst nach einem Klick auf
 * „Zulassen", siehe public/assets/js/consent.js.
 */

/** GA4-Mess-ID (G-AB12CD34EF) oder GTM-Container-ID (GTM-AB12CD3). */
const MEASUREMENT_ID = /^(G|GTM)-[A-Z0-9]{4,16}$/;

/**
 * Die gültige Mess-ID oder null. Ein Tippfehler in der Konfiguration soll
 * nicht halb einschalten - Banner ohne funktionierende Messung -, sondern
 * gar nicht, und das im Log sichtbar.
 */
export function analyticsId(env: Env): string | null {
  const raw = (env.GA_MEASUREMENT_ID ?? "").trim();
  if (raw === "") return null;
  if (MEASUREMENT_ID.test(raw)) return raw;
  console.warn(
    JSON.stringify({ event: "analytics_id_invalid", value: raw.slice(0, 32) }),
  );
  return null;
}
