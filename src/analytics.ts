/**
 * Google Analytics 4 - vorbereitet, aber aus, solange keine Mess-ID gesetzt
 * ist.
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
 *  - Blöcke mit `data-analytics="an"` bleiben stehen, solche mit
 *    `data-analytics="aus"` fallen weg (Datenschutzerklärung).
 *
 * Geladen wird gtag.js erst im Browser und erst nach einem Klick auf
 * „Zulassen", siehe public/assets/js/einwilligung.js.
 */

/** Format einer GA4-Mess-ID, etwa G-AB12CD34EF. */
const MESS_ID = /^G-[A-Z0-9]{4,16}$/;

/**
 * Die gültige Mess-ID oder null. Ein Tippfehler in der Konfiguration soll
 * nicht halb einschalten - Banner ohne funktionierende Messung -, sondern
 * gar nicht, und das im Log sichtbar.
 */
export function analyticsId(env: Env): string | null {
  const raw = (env.GA_MEASUREMENT_ID ?? "").trim();
  if (raw === "") return null;
  if (MESS_ID.test(raw)) return raw;
  console.warn(
    JSON.stringify({ event: "analytics_id_invalid", value: raw.slice(0, 32) }),
  );
  return null;
}
