/**
 * Markdown-Fassungen der Inhaltsseiten: /mondlift.md, /enterprise.md usw.,
 * auf Englisch /en/mondlift.md usw., dazu /llms-full.txt mit allen
 * zusammen.
 *
 * Warum: Sprachmodelle, die eine Antwort belegen wollen, holen eine Seite
 * oft zur Laufzeit ab und müssen aus dem HTML erst den Text schälen - mit
 * Navigation, Fußzeile und allem. Die Konvention von llmstxt.org sieht dafür
 * eine Fassung unter derselben Adresse mit `.md` vor. Kürzer, eindeutig
 * gegliedert, mit Adresse und Stand im Kopf, damit ein Zitat beides trägt.
 *
 * Woher: aus dem ausgelieferten HTML selbst, nach dem Einsetzen der
 * Config-Werte, Glossar und FAQ. Eine zweite Textfassung im Repo würde
 * auseinanderlaufen; so ist die Markdown-Seite immer genau das, was im
 * Browser steht. Gelesen wird nur `<main>`, ohne Navigation.
 *
 * Für Suchmaschinen ist die HTML-Seite die maßgebliche: jede Markdown-
 * Antwort trägt `Link: <...>; rel="canonical"` auf sie. So entsteht kein
 * doppelter Inhalt, und Google fasst beide zusammen.
 *
 * Der Umwandler ist bewusst klein. Er kennt genau die Elemente, die in
 * public/ vorkommen, und muss kein beliebiges HTML verstehen.
 */

import config from "../site.config.json";
import { respondText } from "./cache";
import { injectSiteConfig } from "./site-config";
import {
  LANGS,
  PAGES,
  absoluteUrl,
  findPage,
  formatDate,
  type Lang,
  type Page,
} from "./pages";

/** Eine Stunde, wie bei llms.txt: ändert sich nur mit einem Deploy. */
const MAX_AGE = 3600;

/** Die Seiten mit Markdown-Fassung, in der Reihenfolge für llms-full.txt. */
const MARKDOWN_IDS = ["home", "mondlift", "enterprise", "faq", "glossary"];

/** Alle Fassungen mit Markdown, erst Deutsch, dann Englisch. */
export const MARKDOWN_PAGES: Page[] = LANGS.flatMap((lang) =>
  MARKDOWN_IDS.flatMap((id) =>
    PAGES.filter((page) => page.id === id && page.lang === lang),
  ),
);

export const LLMS_FULL_PATH = "/llms-full.txt";

/** Pfad der Markdown-Fassung zu einer Seite: "/" wird zu "/index.md". */
export function markdownPath(path: string): string {
  return path === "/" ? "/index.md" : `${path}.md`;
}

/** Umkehrung: zu "/mondlift.md" die Seite "/mondlift", sonst null. */
function pageForMarkdown(pathname: string): Page | null {
  return MARKDOWN_PAGES.find((page) => markdownPath(page.path) === pathname) ?? null;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  shy: "",
};

function decode(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, name: string) => {
    if (name.startsWith("#x") || name.startsWith("#X")) {
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    }
    if (name.startsWith("#")) return String.fromCodePoint(parseInt(name.slice(1), 10));
    return ENTITIES[name.toLowerCase()] ?? match;
  });
}

/** Wert eines Attributs aus dem Rohtext eines Tags. */
function attr(raw: string, name: string): string | null {
  const match = new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(raw);
  return match ? decode(match[1] ?? "") : null;
}

/** Elemente, deren Inhalt nicht in den Text gehört. */
const SKIP = new Set(["script", "style", "nav", "form", "svg", "noscript", "template"]);

/**
 * `<main>` als Markdown. Überschriften, Absätze, Listen, Definitionslisten,
 * Tabellen, Hervorhebungen und Links - mehr kommt in public/ nicht vor.
 */
export function mainToMarkdown(html: string): string {
  const start = html.search(/<main[\s>]/i);
  const end = html.search(/<\/main>/i);
  if (start < 0 || end < start) return "";
  const main = html.slice(start, end).replace(/<!--[\s\S]*?-->/g, "");

  let out = "";
  let skipDepth = 0;
  let skipTag = "";
  let inH1 = false;
  const lists: Array<{ ordered: boolean; n: number }> = [];
  const links: string[] = [];
  let rowHasHeader = false;
  let rowCells = 0;

  const token = /<(\/?)([a-zA-Z0-9]+)((?:"[^"]*"|'[^']*'|[^'">])*)>|([^<]+)/g;
  for (const match of main.matchAll(token)) {
    const [, slash, rawName, rawAttrs = "", text] = match;

    if (text !== undefined) {
      if (skipDepth > 0 || inH1) continue;
      out += decode(text).replace(/\s+/g, " ");
      continue;
    }

    const name = (rawName ?? "").toLowerCase();
    const closing = slash === "/";

    if (skipDepth > 0) {
      if (name === skipTag) skipDepth += closing ? -1 : 1;
      continue;
    }
    if (!closing && (SKIP.has(name) || /\shidden(\s|=|$)/i.test(rawAttrs))) {
      if (!/\/\s*$/.test(rawAttrs)) {
        skipTag = name;
        skipDepth = 1;
      }
      continue;
    }

    switch (name) {
      case "h1":
        // Der Titel steht schon im Kopf der Datei.
        inH1 = !closing;
        break;
      case "h2":
      case "h3":
      case "h4":
        out += closing ? "\n\n" : `\n\n${"#".repeat(Number(name[1]))} `;
        break;
      case "p":
      case "div":
        // Ein Absatz in einem Listeneintrag gehoert zum Eintrag: eingerueckt
        // weiter statt als neuer Absatz ausserhalb der Liste.
        if (lists.length > 0) {
          if (!closing) out += `\n${"  ".repeat(lists.length)}`;
        } else {
          out += "\n\n";
        }
        break;
      case "ul":
      case "ol":
      case "dl":
        if (closing) lists.pop();
        else lists.push({ ordered: name === "ol", n: 0 });
        out += "\n\n";
        break;
      case "li": {
        if (closing) break;
        const list = lists[lists.length - 1];
        const indent = "  ".repeat(Math.max(0, lists.length - 1));
        if (list) list.n += 1;
        out += `\n${indent}${list?.ordered ? `${list.n}.` : "-"} `;
        break;
      }
      case "dt":
        out += closing ? ":** " : "\n- **";
        break;
      case "dd":
        break;
      case "strong":
      case "b":
        out += "**";
        break;
      case "em":
      case "i":
        out += "*";
        break;
      case "a":
        if (closing) {
          const href = links.pop();
          out += href ? `](${href})` : "";
        } else {
          const href = attr(rawAttrs, "href");
          const target = href && !href.startsWith("mailto:") ? absoluteUrl(href) : null;
          links.push(target ?? "");
          if (target) out += "[";
        }
        break;
      case "br":
        out += "  \n";
        break;
      case "table":
        out += "\n\n";
        break;
      case "tr":
        if (closing) {
          out += "\n";
          if (rowHasHeader) out += `|${" --- |".repeat(rowCells)}\n`;
        } else {
          out += "|";
          rowHasHeader = false;
          rowCells = 0;
        }
        break;
      case "th":
      case "td":
        if (closing) {
          out += " |";
          rowCells += 1;
          if (name === "th") rowHasHeader = true;
        } else {
          out += " ";
        }
        break;
      default:
        break;
    }
  }

  return out
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/^ (?=[^ ])/, ""))
    .join("\n")
    .replace(/(\S) {2,}(?=\S)/g, "$1 ")
    .replace(/\[ /g, "[")
    .replace(/ \]\(/g, "](")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Titel und Beschreibung aus dem Kopf der Seite. */
function readHead(html: string): { title: string; description: string } {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? config.site.name;
  const meta = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1] ?? "";
  return {
    title: decode(title).replace(/\s+/g, " ").trim(),
    description: decode(meta).replace(/\s+/g, " ").trim(),
  };
}

/** Die Kopfzeilen einer Markdown-Datei, je Sprache. */
const FILE_LABELS: Record<Lang, { address: string; updated: string; publisher: string }> = {
  de: {
    address: "Adresse",
    updated: "Stand",
    publisher: `Herausgeber: ${config.site.domain}, private und inoffizielle Fan-Seite ohne Verbindung zu Betreiber oder Hersteller`,
  },
  en: {
    address: "Address",
    updated: "Last updated",
    publisher: `Publisher: ${config.site.domain}, a private and unofficial fan site with no connection to the operator or the manufacturer`,
  },
};

/** Eine ganze Seite als Markdown-Datei, mit Adresse und Stand im Kopf. */
function toFile(page: Page, html: string): string {
  const { title, description } = readHead(html);
  const labels = FILE_LABELS[page.lang];
  return [
    `# ${title}`,
    "",
    description ? `> ${description}` : "",
    "",
    `${labels.address}: ${absoluteUrl(page.path)}  `,
    `${labels.updated}: ${page.lastmod}  `,
    labels.publisher,
    "",
    mainToMarkdown(html),
    "",
  ].join("\n");
}

/** Je Isolate einmal gebaut; die Seiten ändern sich nur mit einem Deploy. */
const CACHE = new Map<string, Promise<string>>();

function render(page: Page, origin: string, env: Env): Promise<string> {
  const known = CACHE.get(page.path);
  if (known) return known;
  const pending = (async () => {
    const asset = await env.ASSETS.fetch(new Request(new URL(page.path, origin)));
    if (!asset.ok) throw new Error(`Seite ${page.path}: ${asset.status}`);
    const html = await injectSiteConfig(asset, { page }).text();
    return toFile(page, html);
  })();
  CACHE.set(page.path, pending);
  // Ein Fehlschlag soll nicht für die Lebensdauer des Isolates hängen bleiben.
  pending.catch(() => CACHE.delete(page.path));
  return pending;
}

/** Antwort auf /<seite>.md, oder null, wenn der Pfad keine solche ist. */
export async function handleMarkdown(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  const page = pageForMarkdown(url.pathname);
  if (page === null) return null;
  const body = await render(page, url.origin, env);
  const response = respondText(request, body, "text/markdown; charset=utf-8", MAX_AGE);
  response.headers.set("link", `<${absoluteUrl(page.path)}>; rel="canonical"`);
  return response;
}

/** /llms-full.txt: alle Inhaltsseiten als Markdown hintereinander. */
export async function handleLlmsFull(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const parts = await Promise.all(
    MARKDOWN_PAGES.map((page) => render(page, url.origin, env)),
  );
  const body = [
    `# ${config.site.name}: alle Inhaltsseiten / all content pages`,
    "",
    `> Volltext von ${config.site.domain} in einer Datei, für Sprachmodelle, erst die deutschen Seiten, dann die englischen. Das kurze Inhaltsverzeichnis steht unter ${absoluteUrl("/llms.txt")}. Beim Zitieren bitte die Adresse der jeweiligen Seite angeben, nicht diese Datei.`,
    ">",
    `> Full text of ${config.site.domain} in one file for language models, German pages first, then English. The short index is at ${absoluteUrl("/llms.txt")}. When citing, please give the address of the individual page, not this file.`,
    "",
    ...parts.map((part) => `---\n\n${part.replace(/^# /, "## ").replace(/\n(#{1,5}) /g, "\n#$1 ")}`),
  ].join("\n");
  return respondText(request, body, "text/plain; charset=utf-8", MAX_AGE);
}

/** Zu einer HTML-Seite die Adresse ihrer Markdown-Fassung, sonst undefined. */
export function markdownFor(pathname: string): string | undefined {
  const page = findPage(pathname);
  return page && MARKDOWN_PAGES.includes(page) ? markdownPath(page.path) : undefined;
}

/**
 * Zitiervorschlag für eine Inhaltsseite: Titel, Seite, Stand, Adresse. Steht
 * sichtbar unter dem Text, damit Menschen wie Modelle eine fertige Angabe
 * vorfinden statt eine zu raten. Ohne Personennamen - Herausgeber ist die
 * Seite, wer dahintersteht, sagt das Impressum.
 */
export function citationFor(pathname: string): string | undefined {
  const page = findPage(pathname);
  if (!page || page.id === "home" || !MARKDOWN_PAGES.includes(page)) {
    return undefined;
  }
  const date = formatDate(page.lastmod, page.lang);
  return page.lang === "en"
    ? `“${page.title}”. In: ${config.site.domain}, last updated ${date}. ${absoluteUrl(page.path)}`
    : `„${page.title}“. In: ${config.site.domain}, Stand ${date}. ${absoluteUrl(page.path)}`;
}
