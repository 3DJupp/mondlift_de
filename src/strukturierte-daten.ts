/**
 * Strukturierte Daten (JSON-LD) für die Inhaltsseiten.
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
 * Geräts) sowie aus glossar.ts und fragen.ts - denselben Listen, aus denen
 * auch der sichtbare Text entsteht. Deshalb kann die ausgezeichnete Fassung
 * nicht von der sichtbaren abweichen; bei FAQ-Daten verlangt Google das
 * ausdrücklich.
 */

import config from "../site.config.json";
import { BEGRIFFE } from "./glossar";
import { FRAGEN } from "./fragen";
import { slug } from "./html";

const SITE = config.site;
const OWNER = config.owner;
const RIDE = config.ride;

/** Absolute Adresse zu einem Pfad der eigenen Seite. */
function abs(path: string): string {
  return new URL(path, SITE.url).toString();
}

const WEBSITE_ID = `${abs("/")}#website`;
const PERSON_ID = `${abs("/")}#person`;
const RIDE_ID = `${abs("/mondlift")}#mondlift`;
const TYPE_ID = `${abs("/enterprise")}#enterprise`;

/** Quellen, auf die die Seite verweist - auch für Maschinen lesbar. */
const WIKIPEDIA_TYP_DE =
  "https://de.wikipedia.org/wiki/Enterprise_(Fahrgesch%C3%A4ft)";
const WIKIPEDIA_TYP_EN = "https://en.wikipedia.org/wiki/Enterprise_(ride)";
const WIKIPEDIA_HUSS = "https://en.wikipedia.org/wiki/HUSS_Park_Attractions";
const HERSTELLER_URL = "https://hussrides.com/";

/** Der Herausgeber: eine Privatperson, keine Firma. */
const PERSON = {
  "@type": "Person",
  "@id": PERSON_ID,
  name: OWNER.name,
  url: abs("/impressum"),
};

const WEBSITE = {
  "@type": "WebSite",
  "@id": WEBSITE_ID,
  url: abs("/"),
  name: SITE.name,
  description: SITE.tagline,
  inLanguage: "de-DE",
  publisher: { "@id": PERSON_ID },
  isAccessibleForFree: true,
};

/** Der Hersteller als eigene Einheit, mit Verweis nach außen. */
const HERSTELLER = {
  "@type": "Organization",
  name: "Huss",
  url: HERSTELLER_URL,
  sameAs: [WIKIPEDIA_HUSS],
};

/**
 * Das Gerät selbst. `Thing` und nicht `Product`: verkauft wird hier nichts,
 * und die Produkt-Auszeichnung verlangt Angaben (Preis, Bewertung), die es
 * nicht gibt und die zu erfinden wäre das Gegenteil des Zwecks.
 */
const RIDE_NODE = {
  "@type": "Thing",
  "@id": RIDE_ID,
  name: RIDE.name,
  alternateName: RIDE.firstName,
  description: `Reisendes Überkopffahrgeschäft vom Typ ${RIDE.type} des Herstellers ${RIDE.manufacturer}; ${RIDE.gondolas} Gondeln, ${RIDE.seats} Plätze, rund ${RIDE.height} hoch.`,
  url: abs("/mondlift"),
  additionalType: TYPE_ID,
  subjectOf: { "@id": WEBSITE_ID },
  additionalProperty: steckbrief(),
};

/** Der Steckbrief als Liste von Merkmalen, direkt aus der Config. */
function steckbrief(): unknown[] {
  const felder: Array<[string, string]> = [
    ["Hersteller", RIDE.manufacturer],
    ["Typ", RIDE.type],
    ["Baujahr", RIDE.built],
    ["Seriennummer", RIDE.serial],
    ["Höhe", RIDE.height],
    ["Raddurchmesser", RIDE.diameter],
    ["Gondeln", RIDE.gondolas],
    ["Plätze", RIDE.seats],
    ["Kapazität", RIDE.capacity],
    ["Drehzahl", RIDE.rpm],
    ["Anschlusswert", RIDE.power],
    ["Betreiber", RIDE.operator],
  ];
  return felder.map(([name, value]) => ({
    "@type": "PropertyValue",
    name,
    value,
  }));
}

/** Die Bauform als eigene Einheit, verknüpft mit Wikipedia. */
const TYPE_NODE = {
  "@type": "Thing",
  "@id": TYPE_ID,
  name: "Enterprise (Fahrgeschäft)",
  description:
    "Bauform eines Überkopffahrgeschäfts: ein Rad mit frei schwenkenden Gondeln, das sich aus der Waagerechten in die Senkrechte aufrichtet. Zuerst 1972 von Anton Schwarzkopf gebaut, ab 1975 von Huss überarbeitet.",
  url: abs("/enterprise"),
  sameAs: [WIKIPEDIA_TYP_DE, WIKIPEDIA_TYP_EN],
  manufacturer: HERSTELLER,
};

interface Seite {
  path: string;
  title: string;
  summary: string;
  lastmod?: string;
}

const SEITEN = new Map<string, Seite>(
  (config.pages as Seite[])
    .filter((page) => typeof page.title === "string")
    .map((page) => [page.path, page]),
);

/** Brotkrumen: Start, dann die Seite selbst. Mehr Ebenen gibt es nicht. */
function breadcrumb(seite: Seite): unknown {
  const items = [
    { "@type": "ListItem", position: 1, name: "Start", item: abs("/") },
  ];
  if (seite.path !== "/") {
    items.push({
      "@type": "ListItem",
      position: 2,
      name: seite.title,
      item: abs(seite.path),
    });
  }
  return { "@type": "BreadcrumbList", itemListElement: items };
}

/** Der WebPage-Knoten, den jede Seite bekommt. */
function webPage(seite: Seite, extra: Record<string, unknown> = {}): unknown {
  return {
    "@type": "WebPage",
    "@id": `${abs(seite.path)}#webpage`,
    url: abs(seite.path),
    name: seite.title,
    description: seite.summary,
    inLanguage: "de-DE",
    isPartOf: { "@id": WEBSITE_ID },
    breadcrumb: breadcrumb(seite),
    publisher: { "@id": PERSON_ID },
    dateModified: seite.lastmod ?? SITE.lastUpdated,
    ...extra,
  };
}

/** Glossar als Begriffssammlung - die Form, die für ein Nachschlagewerk passt. */
function glossarKnoten(): unknown {
  return {
    "@type": "DefinedTermSet",
    "@id": `${abs("/glossar")}#glossar`,
    name: "Glossar: Fahrgeschäft und Volksfest",
    url: abs("/glossar"),
    hasDefinedTerm: BEGRIFFE.map((begriff) => ({
      "@type": "DefinedTerm",
      "@id": `${abs("/glossar")}#${slug(begriff.wort)}`,
      name: begriff.wort,
      description: begriff.erklaerung,
      inDefinedTermSet: { "@id": `${abs("/glossar")}#glossar` },
    })),
  };
}

/** Die Fragen in der Form, die Suchmaschinen dafür erwarten. */
function fragenKnoten(): unknown {
  return {
    "@type": "FAQPage",
    "@id": `${abs("/fragen")}#faq`,
    url: abs("/fragen"),
    mainEntity: FRAGEN.map((eintrag) => ({
      "@type": "Question",
      name: eintrag.frage,
      acceptedAnswer: { "@type": "Answer", text: eintrag.antwort },
    })),
  };
}

/** Welcher Pfad welche Knoten bekommt. Nicht genannte Pfade bekommen keine. */
function graphFor(seite: Seite): unknown[] {
  switch (seite.path) {
    case "/":
      return [
        WEBSITE,
        PERSON,
        webPage(seite, { about: { "@id": RIDE_ID } }),
        RIDE_NODE,
      ];
    case "/mondlift":
      return [
        WEBSITE,
        PERSON,
        webPage(seite, { about: { "@id": RIDE_ID } }),
        RIDE_NODE,
        TYPE_NODE,
      ];
    case "/enterprise":
      return [
        WEBSITE,
        PERSON,
        webPage(seite, { about: { "@id": TYPE_ID } }),
        TYPE_NODE,
      ];
    case "/glossar":
      return [
        WEBSITE,
        PERSON,
        webPage(seite, { mainEntity: { "@id": `${abs("/glossar")}#glossar` } }),
        glossarKnoten(),
      ];
    case "/fragen":
      return [WEBSITE, PERSON, webPage(seite), fragenKnoten()];
    case "/kontakt":
      return [
        WEBSITE,
        PERSON,
        { ...(webPage(seite) as object), "@type": "ContactPage" },
      ];
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

/** Pfad auf die Form bringen, in der die Seitenliste ihn kennt. */
function normalise(pathname: string): string {
  const ohneEndung = pathname.replace(/\.html$/, "");
  const ohneSlash = ohneEndung.replace(/\/+$/, "");
  return ohneSlash === "" ? "/" : ohneSlash;
}

function base64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let binary = "";
  for (let index = 0; index < view.length; index += 1) {
    binary += String.fromCharCode(view[index] as number);
  }
  return btoa(binary);
}

export interface StrukturierteDaten {
  /** Der Inhalt des script-Elements. */
  json: string;
  /** Die passende CSP-Quelle, etwa `'sha256-...'`. */
  hash: string;
}

/** Einmal je Isolate und Pfad gerechnet, danach aus dem Gedächtnis. */
const CACHE = new Map<string, Promise<StrukturierteDaten | null>>();

async function build(path: string): Promise<StrukturierteDaten | null> {
  const seite = SEITEN.get(path);
  if (seite === undefined) return null;

  const graph = graphFor(seite);
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
export function strukturierteDaten(
  pathname: string,
): Promise<StrukturierteDaten | null> {
  const path = normalise(pathname);
  const bekannt = CACHE.get(path);
  if (bekannt !== undefined) return bekannt;

  const laufend = build(path);
  CACHE.set(path, laufend);
  return laufend;
}
