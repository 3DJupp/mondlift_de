/**
 * Setzt die Werte aus site.config.json serverseitig in die HTML-Seiten ein
 * und erledigt nebenbei die Dinge, die von der Sprache und vom Formular
 * abhängen.
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
 *   <a data-lang-switch>                       Link auf die andere Sprache
 *   <span data-lang-toggle>                    Schalter DE/EN, aktuelle markiert
 *   <div data-turnstile>                       bekommt data-sitekey
 *   <script data-turnstile-script>             entfällt ohne Site Key
 *   <p data-status="ok" hidden>                sichtbar bei ?status=ok
 *   <div data-glossary>                        bekommt die Begriffsliste
 *   <div data-faq>                             bekommt die Fragenliste
 *   <div data-page-list>                       bekommt die Seitenliste
 *   <p data-citation>                          bekommt den Zitiervorschlag
 *   <section data-analytics="on|off">          bleibt nur, wenn Google
 *                                              Analytics an bzw. aus ist
 *
 * Dazu kommen in den Kopf jeder bekannten Seite die hreflang-Verweise auf
 * alle Sprachfassungen. Sie stehen nicht von Hand in den HTML-Dateien,
 * weil sie dort bei jeder neuen Seite in beiden Sprachen nachzuziehen
 * wären; so kommen sie aus derselben Liste wie die Sitemap.
 *
 * Glossar und Fragen stehen als Daten in src/, weil es von beiden zwei
 * Fassungen gibt - die sichtbare und die strukturierte. Eine Quelle, zwei
 * Ausgaben; siehe src/glossary.ts und src/structured-data.ts.
 */

import config from "../site.config.json";
import { isStatus } from "./contact";
import { glossaryHtml } from "./glossary";
import { faqHtml } from "./faq";
import { pageListHtml } from "./page-list";
import { escapeHtml } from "./html";
import {
  DEFAULT_LANG,
  LANGS,
  LOCALE,
  absoluteUrl,
  formatDate,
  homePath,
  type Lang,
  type Page,
} from "./pages";

/** Flache Nachschlagetabelle für eine Sprache, inklusive abgeleiteter Werte. */
function valuesFor(lang: Lang): Record<string, string> {
  const ride = { ...config.ride, ...config.ride[lang] } as Record<string, unknown>;
  return {
    "site.name": config.site.name,
    "site.domain": config.site.domain,
    "site.url": config.site.url,
    "site.tagline": config.site.tagline[lang],
    "site.lastUpdated": formatDate(config.site.lastUpdated, lang),
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
      Object.entries(ride)
        .filter(([, value]) => typeof value === "string")
        .map(([key, value]) => [`ride.${key}`, value as string]),
    ),
  };
}

const VALUES: Record<Lang, Record<string, string>> = {
  de: valuesFor("de"),
  en: valuesFor("en"),
};

/** Beschriftungen, die der Worker selbst ins HTML schreibt. */
const LABELS: Record<
  Lang,
  { citation: string; switchTo: string; short: string; group: string }
> = {
  // switchTo und short beschriften den Weg in diese Sprache - also immer in
  // der Zielsprache geschrieben. group ist die Beschriftung des Schalters
  // für Screenreader, in der Sprache der Seite.
  de: { citation: "Zitiervorschlag", switchTo: "Deutsch", short: "DE", group: "Sprache" },
  en: { citation: "Suggested citation", switchTo: "English", short: "EN", group: "Language" },
};

export interface PageContext {
  /** Sprache der Seite. Ohne Angabe die Hauptsprache. */
  lang?: Lang;
  /** Die Seite aus site.config.json, wenn es eine bekannte ist. */
  page?: Page;
  /** Öffentlicher Turnstile Site Key, leer wenn kein Widget gewünscht. */
  turnstileSiteKey?: string;
  /** Wert von ?status= nach dem Absenden ohne JavaScript. */
  status?: string | null;
  /**
   * JSON-LD für diese Seite. Kommt aus structured-data.ts, zusammen mit
   * dem sha256-Hash, den die CSP dafür braucht.
   */
  jsonLd?: string;
  /** Adresse der Markdown-Fassung, wenn die Seite eine hat. */
  markdownHref?: string;
  /** Text für den Zitiervorschlag unter `<p data-citation>`. */
  citation?: string;
  /**
   * GA4-Mess-ID, null wenn Analytics aus ist. Siehe src/analytics.ts.
   */
  analyticsId?: string | null;
}

/** Die hreflang-Verweise einer Seite, x-default auf die Hauptsprache. */
function hreflangLinks(page: Page): string {
  const links: string[] = [];
  for (const lang of LANGS) {
    const path = page.alternates[lang];
    if (path) {
      links.push(
        `<link rel="alternate" hreflang="${LOCALE[lang]}" href="${escapeHtml(absoluteUrl(path))}" />`,
      );
    }
  }
  const fallback = page.alternates[DEFAULT_LANG];
  if (links.length > 1 && fallback) {
    links.push(
      `<link rel="alternate" hreflang="x-default" href="${escapeHtml(absoluteUrl(fallback))}" />`,
    );
  }
  return links.length > 1 ? links.join("") : "";
}

/** Die andere Sprache - bei zwei Sprachen eindeutig. */
function otherLang(lang: Lang): Lang {
  return lang === "de" ? "en" : "de";
}

/** Schiebt eine HTML-Antwort durch den HTMLRewriter. */
export function injectSiteConfig(
  response: Response,
  context: PageContext = {},
): Response {
  const lang = context.lang ?? context.page?.lang ?? DEFAULT_LANG;
  const values = VALUES[lang];
  const status = context.status;
  // Nur bekannte Status durchlassen. Sonst stünde der Inhalt der URL-Query
  // im Weg, über den ein Fremder die Seite falsch beschriften könnte.
  const knownStatus = status && isStatus(status) ? status : null;

  // Wohin der Sprachumschalter führt: auf dieselbe Seite in der anderen
  // Sprache, und wo es die nicht gibt, auf deren Startseite.
  const target = otherLang(lang);
  const switchHref = context.page?.alternates[target] ?? homePath(target);

  return new HTMLRewriter()
    .on("head", {
      element(element) {
        if (context.page) {
          const links = hreflangLinks(context.page);
          if (links) element.append(links, { html: true });
        }
        // Als rohes HTML angehängt, nicht als Text: der Inhalt eines
        // script-Elements wird nicht maskiert, und der Hash in der CSP gilt
        // für genau diese Zeichenkette. Dass darin kein `<` vorkommt,
        // stellt structured-data.ts sicher.
        if (context.jsonLd) {
          element.append(
            `<script type="application/ld+json">${context.jsonLd}</script>`,
            { html: true },
          );
        }
        // Verweis auf die Markdown-Fassung, siehe src/markdown.ts. Modelle
        // und Werkzeuge, die eine Seite fuer ein Zitat abholen, finden so
        // die kurze Fassung ohne Navigation.
        if (context.markdownHref) {
          element.append(
            `<link rel="alternate" type="text/markdown" href="${context.markdownHref}" title="Markdown" />`,
            { html: true },
          );
        }
        // Google Analytics: nur die ID und das Einwilligungsskript. gtag.js
        // selbst lädt erst der Browser, und erst nach „Zulassen". Die ID
        // steht in einem meta-Element statt in einem Inline-Skript, weil die
        // CSP keine Inline-Skripte erlaubt.
        if (context.analyticsId) {
          element.append(
            `<meta name="ga-measurement-id" content="${escapeHtml(context.analyticsId)}" />` +
              `<script src="/assets/js/consent.js" defer></script>`,
            { html: true },
          );
        }
      },
    })
    .on("[data-lang-switch]", {
      element(element) {
        element.setAttribute("href", switchHref);
        element.setAttribute("hreflang", LOCALE[target]);
        element.setAttribute("lang", LOCALE[target]);
        element.setInnerContent(LABELS[target].switchTo);
        element.removeAttribute("data-lang-switch");
      },
    })
    .on("[data-lang-toggle]", {
      element(element) {
        // Beide Sprachen nebeneinander, die aktuelle ist kein Link. So ist
        // auf einen Blick klar, dass es ein Schalter ist und wo man steht.
        const options = LANGS.map((option) => {
          const label = `aria-label="${LABELS[option].switchTo}" lang="${LOCALE[option]}"`;
          if (option === lang) {
            return `<span class="lang__option" aria-current="true" ${label}>${LABELS[option].short}</span>`;
          }
          const href = escapeHtml(context.page?.alternates[option] ?? homePath(option));
          return `<a class="lang__option" href="${href}" hreflang="${LOCALE[option]}" ${label}>${LABELS[option].short}</a>`;
        });
        element.setAttribute("role", "group");
        element.setAttribute("aria-label", LABELS[lang].group);
        element.setInnerContent(options.join(""), { html: true });
        element.removeAttribute("data-lang-toggle");
      },
    })
    .on("[data-analytics]", {
      element(element) {
        const enabled = Boolean(context.analyticsId);
        const wanted = element.getAttribute("data-analytics") === "on";
        if (wanted === enabled) element.removeAttribute("data-analytics");
        else element.remove();
      },
    })
    .on("[data-citation]", {
      element(element) {
        if (context.citation) {
          element.setInnerContent(
            `<span class="citation__label">${LABELS[lang].citation}</span> ${escapeHtml(context.citation)}`,
            { html: true },
          );
          element.removeAttribute("data-citation");
        } else {
          element.remove();
        }
      },
    })
    .on("[data-glossary]", {
      element(element) {
        element.setInnerContent(glossaryHtml(lang), { html: true });
        element.removeAttribute("data-glossary");
      },
    })
    .on("[data-faq]", {
      element(element) {
        element.setInnerContent(faqHtml(lang), { html: true });
        element.removeAttribute("data-faq");
      },
    })
    .on("[data-page-list]", {
      element(element) {
        element.setInnerContent(pageListHtml(lang), { html: true });
        element.removeAttribute("data-page-list");
      },
    })
    .on("[data-site]", {
      element(element) {
        const key = element.getAttribute("data-site");
        const value =
          key === "site.lastUpdated" && context.page
            ? formatDate(context.page.lastmod, lang)
            : key
              ? values[key]
              : undefined;
        // setInnerContent escapt per Default als Text, nicht als HTML.
        if (value !== undefined) element.setInnerContent(value);
        element.removeAttribute("data-site");
      },
    })
    .on("[data-site-href]", {
      element(element) {
        const key = element.getAttribute("data-site-href");
        const value = key ? values[key] : undefined;
        if (value !== undefined) element.setAttribute("href", value);
        element.removeAttribute("data-site-href");
      },
    })
    .on("[data-turnstile]", {
      element(element) {
        const key = context.turnstileSiteKey;
        if (key) {
          element.setAttribute("data-sitekey", key);
          // Das Widget spricht sonst die Sprache des Browsers, nicht die
          // der Seite.
          element.setAttribute("data-language", lang);
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
