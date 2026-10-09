/**
 * Setzt die Werte aus site.config.json serverseitig in die HTML-Seiten ein
 * und erledigt nebenbei zwei Dinge für das Kontaktformular.
 *
 * Grund für den HTMLRewriter statt Client-JavaScript: Name, Anschrift und
 * E-Mail stehen an genau einer Stelle im Repo, und das Impressum ist auch
 * ohne aktives JavaScript vollständig. Aus demselben Grund wird hier die
 * Rückmeldung des Formulars eingesetzt - wer kein JavaScript hat, bekommt
 * nach dem Absenden trotzdem einen lesbaren Satz zu sehen.
 *
 * Platzhalter in den HTML-Dateien:
 *   <span data-site="owner.name"></span>      Textinhalt
 *   <a data-site-href="contact.mailto">        href-Attribut
 *   <div data-turnstile>                       bekommt data-sitekey
 *   <script data-turnstile-script>             entfällt ohne Site Key
 *   <p data-status="ok" hidden>                sichtbar bei ?status=ok
 *   <div data-glossar>                         bekommt die Begriffsliste
 *   <div data-fragen>                          bekommt die Fragenliste
 *
 * Glossar und Fragen stehen als Daten in src/, weil es von beiden zwei
 * Fassungen gibt - die sichtbare und die strukturierte. Eine Quelle, zwei
 * Ausgaben; siehe src/glossar.ts und src/strukturierte-daten.ts.
 */

import config from "../site.config.json";
import { MESSAGES } from "./contact";
import { glossarHtml } from "./glossar";
import { fragenHtml } from "./fragen";

/** Flache Nachschlagetabelle inklusive abgeleiteter Werte. */
const VALUES: Record<string, string> = {
  "site.name": config.site.name,
  "site.domain": config.site.domain,
  "site.url": config.site.url,
  "site.tagline": config.site.tagline,
  "site.lastUpdated": formatGermanDate(config.site.lastUpdated),
  "owner.name": config.owner.name,
  "owner.street": config.owner.street,
  "owner.postalCode": config.owner.postalCode,
  "owner.city": config.owner.city,
  "owner.country": config.owner.country,
  "owner.cityLine": `${config.owner.postalCode} ${config.owner.city}`,
  "contact.email": config.contact.email,
  "contact.mailto": `mailto:${config.contact.email}`,
  // Der Steckbrief des Geräts. Flach eingehängt als ride.*, damit die
  // Tabelle im HTML und die strukturierten Daten dieselbe Zahl benutzen.
  ...Object.fromEntries(
    Object.entries(config.ride).map(([key, value]) => [`ride.${key}`, value]),
  ),
};

export interface PageContext {
  /** Öffentlicher Turnstile Site Key, leer wenn kein Widget gewünscht. */
  turnstileSiteKey?: string;
  /** Wert von ?status= nach dem Absenden ohne JavaScript. */
  status?: string | null;
  /**
   * JSON-LD für diese Seite. Kommt aus strukturierte-daten.ts, zusammen
   * mit dem sha256-Hash, den die CSP dafür braucht.
   */
  jsonLd?: string;
}

/** ISO-Datum (YYYY-MM-DD) als TT.MM.JJJJ. */
function formatGermanDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/** Schiebt eine HTML-Antwort durch den HTMLRewriter. */
export function injectSiteConfig(
  response: Response,
  context: PageContext = {},
): Response {
  const status = context.status;
  // Nur bekannte Status durchlassen. Sonst stünde der Inhalt der URL-Query
  // im Weg, über den ein Fremder die Seite falsch beschriften könnte.
  const knownStatus =
    status && Object.prototype.hasOwnProperty.call(MESSAGES, status)
      ? status
      : null;

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        // Als rohes HTML angehängt, nicht als Text: der Inhalt eines
        // script-Elements wird nicht maskiert, und der Hash in der CSP gilt
        // für genau diese Zeichenkette. Dass darin kein `<` vorkommt,
        // stellt strukturierte-daten.ts sicher.
        if (context.jsonLd) {
          element.append(
            `<script type="application/ld+json">${context.jsonLd}</script>`,
            { html: true },
          );
        }
      },
    })
    .on("[data-glossar]", {
      element(element) {
        element.setInnerContent(glossarHtml(), { html: true });
        element.removeAttribute("data-glossar");
      },
    })
    .on("[data-fragen]", {
      element(element) {
        element.setInnerContent(fragenHtml(), { html: true });
        element.removeAttribute("data-fragen");
      },
    })
    .on("[data-site]", {
      element(element) {
        const key = element.getAttribute("data-site");
        const value = key ? VALUES[key] : undefined;
        // setInnerContent escapt per Default als Text, nicht als HTML.
        if (value !== undefined) element.setInnerContent(value);
        element.removeAttribute("data-site");
      },
    })
    .on("[data-site-href]", {
      element(element) {
        const key = element.getAttribute("data-site-href");
        const value = key ? VALUES[key] : undefined;
        if (value !== undefined) element.setAttribute("href", value);
        element.removeAttribute("data-site-href");
      },
    })
    .on("[data-turnstile]", {
      element(element) {
        const key = context.turnstileSiteKey;
        if (key) {
          element.setAttribute("data-sitekey", key);
        } else {
          // Ohne Site Key kein Widget - sonst stünde dort ein leerer Kasten.
          element.remove();
        }
      },
    })
    .on("[data-turnstile-script]", {
      element(element) {
        // Ohne Site Key gar nicht erst laden: spart einen Fremdabruf und
        // hält die Seite frei von Verbindungen zu Dritten.
        if (!context.turnstileSiteKey) element.remove();
      },
    })
    .on("[data-status]", {
      element(element) {
        if (element.getAttribute("data-status") === knownStatus) {
          element.removeAttribute("hidden");
        }
      },
    })
    .transform(response);
}

/** Erkennt HTML-Antworten, die umgeschrieben werden sollen. */
export function isHtml(response: Response): boolean {
  return (
    response.headers.get("content-type")?.toLowerCase().includes("text/html") ??
    false
  );
}
