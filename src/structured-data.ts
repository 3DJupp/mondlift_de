/**
 * Strukturierte Daten (JSON-LD) für die Inhaltsseiten, in beiden Sprachen.
 *
 * Im BACKLOG stand, dass das nicht geht: `script-src 'self'` erlaubt keine
 * Inline-Skripte, und das gilt auch für JSON-LD. Ein sha256-Hash in der CSP
 * wäre der Ausweg, müsste aber bei jeder Änderung des Blocks von Hand
 * nachgezogen werden - sonst verschwinden die Daten stillschweigend.
 *
 * Der Einwand war richtig, der Schluss nicht nötig. Hier erzeugt der Worker
 * den Block **und** rechnet den Hash über genau die Zeichenkette, die er
 * ausliefert. Beide kommen aus derselben Quelle, also kann der Hash nicht
 * veralten, und von Hand steht er nirgends. Die CSP bleibt eng: kein
 * `'unsafe-inline'`, nur dieser eine Hash, und nur auf den Seiten, die auch
 * einen Block bekommen.
 *
 * Die Inhalte kommen aus site.config.json (Seitenliste, Steckbrief des
 * Geräts) sowie aus glossary.ts und faq.ts - denselben Listen, aus denen
 * auch der sichtbare Text entsteht. Deshalb kann die ausgezeichnete Fassung
 * nicht von der sichtbaren abweichen; bei FAQ-Daten verlangt Google das
 * ausdrücklich.
 *
 * Zu den Sprachen: Gerät, Bauform, Herausgeber und Website sind dieselben
 * Dinge, egal in welcher Sprache man über sie liest. Sie behalten deshalb
 * auf beiden Fassungen dieselbe @id und bekommen nur Name und Beschreibung
 * in der Sprache der Seite. Eigene @ids haben die Seiten selbst, ihre
 * Glossare und ihre Fragenlisten.
 */

import config from "../site.config.json";
import { GLOSSARY } from "./glossary";
import { FAQ } from "./faq";
import { slug } from "./html";
import {
  LOCALE,
  absoluteUrl,
  findPage,
  homePath,
  pageById,
  type Lang,
  type Page,
} from "./pages";

const SITE = config.site;
const OWNER = config.owner;

/** Steckbrief des Geräts in einer Sprache: gemeinsame und übersetzte Werte. */
function rideFor(lang: Lang) {
  return { ...config.ride, ...config.ride[lang] };
}

const WEBSITE_ID = `${absoluteUrl("/")}#website`;
const PERSON_ID = `${absoluteUrl("/")}#person`;
const RIDE_ID = `${absoluteUrl("/mondlift")}#mondlift`;
const TYPE_ID = `${absoluteUrl("/enterprise")}#enterprise`;

/** Quellen, auf die die Seite verweist - auch für Maschinen lesbar. */
const WIKIPEDIA_TYPE_DE =
  "https://de.wikipedia.org/wiki/Enterprise_(Fahrgesch%C3%A4ft)";
const WIKIPEDIA_TYPE_EN = "https://en.wikipedia.org/wiki/Enterprise_(ride)";
const WIKIPEDIA_HUSS = "https://en.wikipedia.org/wiki/HUSS_Park_Attractions";
const MANUFACTURER_URL = "https://hussrides.com/";

/** Pfad einer Seite in einer Sprache; fällt auf die Startseite zurück. */
function pathOf(id: string, lang: Lang): string {
  return pageById(id, lang)?.path ?? homePath(lang);
}

/** Der Herausgeber: eine Privatperson, keine Firma. */
function person(lang: Lang) {
  return {
    "@type": "Person",
    "@id": PERSON_ID,
    name: OWNER.name,
    url: absoluteUrl(pathOf("legal-notice", lang)),
  };
}

function website(lang: Lang) {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    url: absoluteUrl("/"),
    name: SITE.name,
    description: SITE.tagline[lang],
    inLanguage: [LOCALE.de, LOCALE.en],
    publisher: { "@id": PERSON_ID },
    about: { "@id": RIDE_ID },
    isAccessibleForFree: true,
  };
}

/** Der Hersteller als eigene Einheit, mit Verweis nach außen. */
const MANUFACTURER = {
  "@type": "Organization",
  name: "Huss",
  url: MANUFACTURER_URL,
  sameAs: [WIKIPEDIA_HUSS],
};

/** Beschriftungen der Merkmale im Steckbrief. */
const FACT_LABELS: Record<Lang, Record<string, string>> = {
  de: {
    manufacturer: "Hersteller",
    type: "Typ",
    built: "Baujahr",
    serial: "Seriennummer",
    height: "Höhe",
    diameter: "Raddurchmesser",
    gondolas: "Gondeln",
    seats: "Plätze",
    capacity: "Kapazität",
    rpm: "Drehzahl",
    power: "Anschlusswert",
    operator: "Betreiber",
  },
  en: {
    manufacturer: "Manufacturer",
    type: "Type",
    built: "Year built",
    serial: "Serial number",
    height: "Height",
    diameter: "Wheel diameter",
    gondolas: "Gondolas",
    seats: "Seats",
    capacity: "Capacity",
    rpm: "Speed",
    power: "Connected load",
    operator: "Operator",
  },
};

/** Der Steckbrief als Liste von Merkmalen, direkt aus der Config. */
function factSheet(lang: Lang): unknown[] {
  const ride = rideFor(lang) as unknown as Record<string, string>;
  return Object.entries(FACT_LABELS[lang]).map(([key, name]) => ({
    "@type": "PropertyValue",
    name,
    value: ride[key],
  }));
}

/**
 * Das Gerät selbst. `Thing` und nicht `Product`: verkauft wird hier nichts,
 * und die Produkt-Auszeichnung verlangt Angaben (Preis, Bewertung), die es
 * nicht gibt und die zu erfinden wäre das Gegenteil des Zwecks.
 */
function rideNode(lang: Lang) {
  const ride = rideFor(lang);
  const description =
    lang === "en"
      ? `Travelling inverting fairground ride of the ${ride.type} type made by ${ride.manufacturer}; ${ride.gondolas} gondolas, ${ride.seats} seats, ${ride.height} high.`
      : `Reisendes Überkopffahrgeschäft vom Typ ${ride.type} des Herstellers ${ride.manufacturer}; ${ride.gondolas} Gondeln, ${ride.seats} Plätze, rund ${ride.height} hoch.`;
  return {
    "@type": "Thing",
    "@id": RIDE_ID,
    name: ride.name,
    alternateName: ride.firstName,
    description,
    url: absoluteUrl(pathOf("mondlift", lang)),
    additionalType: TYPE_ID,
    subjectOf: { "@id": WEBSITE_ID },
    additionalProperty: factSheet(lang),
  };
}

/** Die Bauform als eigene Einheit, verknüpft mit Wikipedia. */
function typeNode(lang: Lang) {
  return {
    "@type": "Thing",
    "@id": TYPE_ID,
    name: lang === "en" ? "Enterprise (ride)" : "Enterprise (Fahrgeschäft)",
    description:
      lang === "en"
        ? "Design of an inverting fairground ride: a wheel with freely swinging gondolas that tilts from horizontal to vertical. First built by Anton Schwarzkopf in 1972, revised by Huss from 1975."
        : "Bauform eines Überkopffahrgeschäfts: ein Rad mit frei schwenkenden Gondeln, das sich aus der Waagerechten in die Senkrechte aufrichtet. Zuerst 1972 von Anton Schwarzkopf gebaut, ab 1975 von Huss überarbeitet.",
    url: absoluteUrl(pathOf("enterprise", lang)),
    sameAs: [WIKIPEDIA_TYPE_DE, WIKIPEDIA_TYPE_EN],
    manufacturer: MANUFACTURER,
  };
}

const HOME_LABEL: Record<Lang, string> = { de: "Start", en: "Home" };

/** Brotkrumen: Start, dann die Seite selbst. Mehr Ebenen gibt es nicht. */
function breadcrumb(page: Page): unknown {
  const home = homePath(page.lang);
  const items = [
    {
      "@type": "ListItem",
      position: 1,
      name: HOME_LABEL[page.lang],
      item: absoluteUrl(home),
    },
  ];
  if (page.path !== home) {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: page.title,
      item: absoluteUrl(page.path),
    });
  }
  return { "@type": "BreadcrumbList", itemListElement: items };
}

/** Der WebPage-Knoten, den jede Seite bekommt. */
function webPage(page: Page, extra: Record<string, unknown> = {}): unknown {
  // Die übersetzte Fassung zeigt auf die andere als Übersetzung bzw.
  // Vorlage - so können Suchmaschinen beide Seiten zusammenführen.
  const original = page.alternates.de;
  const translations = page.alternates.en;
  const relation =
    page.lang === "en" && original
      ? { translationOfWork: { "@id": `${absoluteUrl(original)}#webpage` } }
      : page.lang === "de" && translations
        ? { workTranslation: { "@id": `${absoluteUrl(translations)}#webpage` } }
        : {};
  return {
    "@type": "WebPage",
    "@id": `${absoluteUrl(page.path)}#webpage`,
    url: absoluteUrl(page.path),
    name: page.title,
    description: page.summary,
    inLanguage: LOCALE[page.lang],
    isPartOf: { "@id": WEBSITE_ID },
    breadcrumb: breadcrumb(page),
    publisher: { "@id": PERSON_ID },
    // Wer den Text verantwortet - fuer ein Zitat so wichtig wie das Datum.
    author: { "@id": PERSON_ID },
    datePublished: SITE.published,
    dateModified: page.lastmod,
    ...relation,
    ...extra,
  };
}

/** Glossar als Begriffssammlung - die Form, die für ein Nachschlagewerk passt. */
function glossaryNode(page: Page): unknown {
  const base = absoluteUrl(page.path);
  const id = `${base}#glossary`;
  return {
    "@type": "DefinedTermSet",
    "@id": id,
    name:
      page.lang === "en"
        ? "Glossary: fairground rides and funfairs"
        : "Glossar: Fahrgeschäft und Volksfest",
    url: base,
    inLanguage: LOCALE[page.lang],
    hasDefinedTerm: GLOSSARY[page.lang].map((entry) => ({
      "@type": "DefinedTerm",
      "@id": `${base}#${slug(entry.term)}`,
      name: entry.term,
      description: entry.definition,
      inDefinedTermSet: { "@id": id },
    })),
  };
}

/** Die Fragen in der Form, die Suchmaschinen dafür erwarten. */
function faqNode(page: Page): unknown {
  const base = absoluteUrl(page.path);
  return {
    "@type": "FAQPage",
    "@id": `${base}#faq`,
    url: base,
    inLanguage: LOCALE[page.lang],
    mainEntity: FAQ[page.lang].map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Welche Seite welche Knoten bekommt. Nicht genannte bekommen keine. */
function graphFor(page: Page): unknown[] {
  const lang = page.lang;
  const common = [website(lang), person(lang)];
  switch (page.id) {
    case "home":
      return [...common, webPage(page, { about: { "@id": RIDE_ID } }), rideNode(lang)];
    case "mondlift":
      return [
        ...common,
        webPage(page, { about: { "@id": RIDE_ID }, mentions: { "@id": TYPE_ID } }),
        rideNode(lang),
        typeNode(lang),
      ];
    case "enterprise":
      return [...common, webPage(page, { about: { "@id": TYPE_ID } }), typeNode(lang)];
    case "glossary":
      return [
        ...common,
        webPage(page, {
          mainEntity: { "@id": `${absoluteUrl(page.path)}#glossary` },
        }),
        glossaryNode(page),
      ];
    case "faq":
      return [
        ...common,
        webPage(page, { about: { "@id": RIDE_ID }, mentions: { "@id": TYPE_ID } }),
        rideNode(lang),
        typeNode(lang),
        faqNode(page),
      ];
    // Die Uebersicht ist eine Sammlung von Verweisen auf die eigenen
    // Seiten - CollectionPage sagt das, WebPage waere ungenauer.
    case "sitemap":
      return [...common, { ...(webPage(page) as object), "@type": "CollectionPage" }];
    case "contact":
      return [...common, { ...(webPage(page) as object), "@type": "ContactPage" }];
    default:
      return [];
  }
}

/**
 * JSON ohne `<`: sonst könnte ein Text im Block die Zeichenfolge
 * `</script>` bilden und das Element vorzeitig schließen. Als
 * `<` bleibt es gültiges JSON und gültiges JSON-LD.
 */
function serialise(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index] as number);
  }
  return btoa(binary);
}

export interface StructuredData {
  /** Der Inhalt des script-Elements. */
  json: string;
  /** Die passende CSP-Quelle, etwa `'sha256-...'`. */
  hash: string;
}

/** Einmal je Isolate und Pfad gerechnet, danach aus dem Gedächtnis. */
const CACHE = new Map<string, Promise<StructuredData | null>>();

async function build(page: Page): Promise<StructuredData | null> {
  const graph = graphFor(page);
  if (graph.length === 0) return null;

  const json = serialise({ "@context": "https://schema.org", "@graph": graph });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(json),
  );
  return { json, hash: `'sha256-${base64(digest)}'` };
}

/**
 * Die strukturierten Daten für einen Pfad, oder `null`, wenn die Seite
 * keine bekommt.
 */
export function structuredData(pathname: string): Promise<StructuredData | null> {
  const page = findPage(pathname);
  if (page === undefined) return Promise.resolve(null);

  const known = CACHE.get(page.path);
  if (known !== undefined) return known;

  const pending = build(page);
  CACHE.set(page.path, pending);
  return pending;
}
