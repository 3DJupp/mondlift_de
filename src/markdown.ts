/**
 * Markdown-Fassungen der Inhaltsseiten: /mondlift.md, /enterprise.md usw.,
 * dazu /llms-full.txt mit allen zusammen.
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

/** Eine Stunde, wie bei llms.txt: ändert sich nur mit einem Deploy. */
const MAX_AGE = 3600;

/** Die Seiten mit Markdown-Fassung, in der Reihenfolge für llms-full.txt. */
export const MARKDOWN_SEITEN = [
  "/",
  "/mondlift",
  "/enterprise",
  "/fragen",
  "/glossar",
] as const;

export const LLMS_FULL_PATH = "/llms-full.txt";

function abs(path: string): string {
  return new URL(path, config.site.url).toString();
}

/** Pfad der Markdown-Fassung zu einer Seite: "/" wird zu "/index.md". */
export function markdownPfad(path: string): string {
  return path === "/" ? "/index.md" : `${path}.md`;
}

/** Umkehrung: zu "/mondlift.md" die Seite "/mondlift", sonst null. */
function seiteZu(pathname: string): string | null {
  for (const path of MARKDOWN_SEITEN) {
    if (markdownPfad(path) === pathname) return path;
  }
  return null;
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
export function mainAlsMarkdown(html: string): string {
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
          const ziel = href && !href.startsWith("mailto:") ? abs(href) : null;
          links.push(ziel ?? "");
          if (ziel) out += "[";
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
function kopf(html: string): { titel: string; beschreibung: string } {
  const titel = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? config.site.name;
  const meta = /<meta\s+name="description"\s+content="([^"]*)"/i.exec(html)?.[1] ?? "";
  return {
    titel: decode(titel).replace(/\s+/g, " ").trim(),
    beschreibung: decode(meta).replace(/\s+/g, " ").trim(),
  };
}

interface PageEntry {
  path: string;
  lastmod?: string;
}

function stand(path: string): string {
  const page = (config.pages as PageEntry[]).find((p) => p.path === path);
  return page?.lastmod ?? config.site.lastUpdated;
}

/** Eine ganze Seite als Markdown-Datei, mit Adresse und Stand im Kopf. */
function alsDatei(path: string, html: string): string {
  const { titel, beschreibung } = kopf(html);
  return [
    `# ${titel}`,
    "",
    beschreibung ? `> ${beschreibung}` : "",
    "",
    `Adresse: ${abs(path)}  `,
    `Stand: ${stand(path)}  `,
    `Herausgeber: ${config.site.domain}, private und inoffizielle Fan-Seite ohne Verbindung zu Betreiber oder Hersteller`,
    "",
    mainAlsMarkdown(html),
    "",
  ].join("\n");
}

/** Je Isolate einmal gebaut; die Seiten ändern sich nur mit einem Deploy. */
const CACHE = new Map<string, Promise<string>>();

function erzeugen(path: string, origin: string, env: Env): Promise<string> {
  const bekannt = CACHE.get(path);
  if (bekannt) return bekannt;
  const laufend = (async () => {
    const asset = await env.ASSETS.fetch(new Request(new URL(path, origin)));
    if (!asset.ok) throw new Error(`Seite ${path}: ${asset.status}`);
    const html = await injectSiteConfig(asset).text();
    return alsDatei(path, html);
  })();
  CACHE.set(path, laufend);
  // Ein Fehlschlag soll nicht für die Lebensdauer des Isolates hängen bleiben.
  laufend.catch(() => CACHE.delete(path));
  return laufend;
}

/** Antwort auf /<seite>.md, oder null, wenn der Pfad keine solche ist. */
export async function handleMarkdown(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  const path = seiteZu(url.pathname);
  if (path === null) return null;
  const body = await erzeugen(path, url.origin, env);
  const response = respondText(request, body, "text/markdown; charset=utf-8", MAX_AGE);
  response.headers.set("link", `<${abs(path)}>; rel="canonical"`);
  return response;
}

/** /llms-full.txt: alle Inhaltsseiten als Markdown hintereinander. */
export async function handleLlmsFull(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const teile = await Promise.all(
    MARKDOWN_SEITEN.map((path) => erzeugen(path, url.origin, env)),
  );
  const body = [
    `# ${config.site.name}: alle Inhaltsseiten`,
    "",
    `> Volltext von ${config.site.domain} in einer Datei, für Sprachmodelle. Das kurze Inhaltsverzeichnis steht unter ${abs("/llms.txt")}. Beim Zitieren bitte die Adresse der jeweiligen Seite angeben, nicht diese Datei.`,
    "",
    ...teile.map((teil) => `---\n\n${teil.replace(/^# /, "## ").replace(/\n(#{1,5}) /g, "\n#$1 ")}`),
  ].join("\n");
  return respondText(request, body, "text/plain; charset=utf-8", MAX_AGE);
}

/** Pfad auf die Form der Seitenliste bringen: ohne .html und ohne Slash. */
function normalise(pathname: string): string {
  const ohne = pathname.replace(/\.html$/, "").replace(/\/+$/, "");
  return ohne === "" || ohne === "/index" ? "/" : ohne;
}

/** Zu einer HTML-Seite die Adresse ihrer Markdown-Fassung, sonst undefined. */
export function markdownFuer(pathname: string): string | undefined {
  const path = normalise(pathname);
  return (MARKDOWN_SEITEN as readonly string[]).includes(path)
    ? markdownPfad(path)
    : undefined;
}

interface TitledPage {
  path: string;
  title?: string;
  lastmod?: string;
}

/**
 * Zitiervorschlag für eine Inhaltsseite: Titel, Seite, Stand, Adresse. Steht
 * sichtbar unter dem Text, damit Menschen wie Modelle eine fertige Angabe
 * vorfinden statt eine zu raten. Ohne Personennamen - Herausgeber ist die
 * Seite, wer dahintersteht, sagt das Impressum.
 */
export function zitiervorschlag(pathname: string): string | undefined {
  const path = normalise(pathname);
  if (path === "/" || !(MARKDOWN_SEITEN as readonly string[]).includes(path)) {
    return undefined;
  }
  const page = (config.pages as TitledPage[]).find((p) => p.path === path);
  if (!page?.title) return undefined;
  const [y, m, d] = (page.lastmod ?? config.site.lastUpdated).split("-");
  return `„${page.title}“. In: ${config.site.domain}, Stand ${d}.${m}.${y}. ${abs(path)}`;
}
