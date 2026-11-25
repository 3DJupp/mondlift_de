/**
 * Seiten und Sprachen - die eine Stelle, an der der Worker nachschlägt,
 * welche Seite es unter welcher Adresse in welcher Sprache gibt.
 *
 * Die Seite ist zweisprachig: Deutsch ist die Hauptsprache und liegt an der
 * Wurzel (/mondlift, /glossar ...), Englisch liegt unter /en mit englischen
 * Adressen (/en/mondlift, /en/glossary ...). In site.config.json steht jede
 * Seite einmal, mit je einem Block pro Sprache. Daraus entsteht hier eine
 * flache Liste, in der jede Fassung ihre Gegenstücke kennt - für hreflang,
 * den Sprachumschalter, die Sitemap und die strukturierten Daten.
 */

import config from "../site.config.json";

export type Lang = "de" | "en";

/** Alle Sprachen, Hauptsprache zuerst. */
export const LANGS: readonly Lang[] = ["de", "en"];

/** Die Hauptsprache, auch für hreflang="x-default". */
export const DEFAULT_LANG: Lang = "de";

/** Präfix der englischen Fassung. */
export const EN_PREFIX = "/en";

/** BCP-47-Kennung für `lang`, `inLanguage` und hreflang. */
export const LOCALE: Record<Lang, string> = { de: "de-DE", en: "en" };

/** Eine Fassung einer Seite in einer Sprache. */
export interface Page {
  /** Sprachunabhängige Kennung, etwa "glossary". */
  id: string;
  lang: Lang;
  path: string;
  title: string;
  summary: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  /** Pfade aller Fassungen dieser Seite, die eigene eingeschlossen. */
  alternates: Partial<Record<Lang, string>>;
}

interface LocalisedEntry {
  path: string;
  title: string;
  summary: string;
  lastmod?: string;
}

interface PageGroup {
  id: string;
  changefreq: string;
  priority: string;
  de?: LocalisedEntry;
  en?: LocalisedEntry;
}

/** Alle Seiten, erst alle deutschen, dann alle englischen. */
export const PAGES: Page[] = LANGS.flatMap((lang) =>
  (config.pages as PageGroup[]).flatMap((group) => {
    const entry = group[lang];
    if (!entry) return [];
    const alternates: Partial<Record<Lang, string>> = {};
    for (const other of LANGS) {
      const path = group[other]?.path;
      if (path) alternates[other] = path;
    }
    return [
      {
        id: group.id,
        lang,
        path: entry.path,
        title: entry.title,
        summary: entry.summary,
        lastmod: entry.lastmod ?? config.site.lastUpdated,
        changefreq: group.changefreq,
        priority: group.priority,
        alternates,
      },
    ];
  }),
);

const BY_PATH = new Map<string, Page>(PAGES.map((page) => [page.path, page]));

/**
 * Pfad auf die Form der Seitenliste bringen: ohne .html, ohne /index und
 * ohne Schrägstrich am Ende.
 */
export function normalisePath(pathname: string): string {
  const stripped = pathname
    .replace(/\.html$/, "")
    .replace(/\/index$/, "")
    .replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

/** Die Seite zu einer Adresse, oder undefined. */
export function findPage(pathname: string): Page | undefined {
  return BY_PATH.get(normalisePath(pathname));
}

/** Die Fassung einer Seite in einer Sprache. */
export function pageById(id: string, lang: Lang): Page | undefined {
  return PAGES.find((page) => page.id === id && page.lang === lang);
}

/** Die Sprache einer Adresse: alles unter /en ist Englisch. */
export function langOf(pathname: string): Lang {
  return pathname === EN_PREFIX || pathname.startsWith(`${EN_PREFIX}/`)
    ? "en"
    : "de";
}

/** Die Startseite einer Sprache. */
export function homePath(lang: Lang): string {
  return lang === "en" ? EN_PREFIX : "/";
}

/** Absolute Adresse zu einem Pfad der eigenen Seite. */
export function absoluteUrl(path: string): string {
  return new URL(path, config.site.url).toString();
}

const MONTHS_EN = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** ISO-Datum als 18.10.2026 bzw. 18 October 2026. */
export function formatDate(iso: string, lang: Lang): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  if (lang === "en") {
    const name = MONTHS_EN[Number(month) - 1];
    return name ? `${Number(day)} ${name} ${year}` : iso;
  }
  return `${day}.${month}.${year}`;
}
