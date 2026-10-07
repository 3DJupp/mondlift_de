/**
 * Secrets ergänzen.
 *
 * `wrangler types` erzeugt die Bindings aus wrangler.jsonc. Secrets stehen
 * dort absichtlich nicht drin, also kann Wrangler sie nicht kennen - sie
 * werden hier zum generierten Env ergänzt. Bewusst optional typisiert:
 * ein nicht gesetztes Secret ist zur Laufzeit undefined, und der Code muss
 * damit umgehen können.
 *
 * Gesetzt werden sie mit `wrangler secret put <NAME>`, lokal über .dev.vars.
 */

declare global {
  interface Env {
    /** Turnstile Secret Key. Fehlt er, kann kein Token geprüft werden. */
    TURNSTILE_SECRET_KEY?: string;
    /** Verifizierte Zieladresse für das Kontaktformular. */
    CONTACT_TO_EMAIL?: string;
    /** Absenderadresse auf der eigenen Domain. */
    CONTACT_FROM_EMAIL?: string;
  }
}

export {};
