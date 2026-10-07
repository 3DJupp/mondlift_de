/**
 * Setzt die Werte aus site.config.json serverseitig in die HTML-Seiten ein.
 *
 * Grund: Name, Adresse und E-Mail stehen an genau einer Stelle im Repo. Die
 * HTML-Dateien enthalten nur Platzhalter. Das laeuft im Worker per
 * HTMLRewriter, also ohne Client-JavaScript - das Impressum ist damit auch
 * ohne aktives JS vollstaendig.
 *
 * Platzhalter in den HTML-Dateien:
 *   <span data-site="owner.name"></span>        -> Textinhalt
 *   <a data-site-href="contact.mailto"></a>     -> href-Attribut
 */

import config from "../site.config.json";

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
};

/** ISO-Datum (YYYY-MM-DD) als TT.MM.JJJJ. */
function formatGermanDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/** Schiebt eine HTML-Antwort durch den HTMLRewriter. */
export function injectSiteConfig(response: Response): Response {
  return new HTMLRewriter()
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
    .transform(response);
}

/** Erkennt HTML-Antworten, die umgeschrieben werden sollen. */
export function isHtml(response: Response): boolean {
  return (
    response.headers.get("content-type")?.toLowerCase().includes("text/html") ??
    false
  );
}
