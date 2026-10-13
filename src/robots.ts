/**
 * GET /robots.txt - erzeugt aus site.config.json.
 *
 * Vorher lag die Datei in public/ und trug die Sitemap-Adresse als
 * ausgeschriebenes "https://mondlift.de/sitemap.xml". Damit stand die Domain
 * ein zweites Mal im Repo, an einer Stelle, die niemand anfasst, wenn sich
 * die Domain aendert - und eine robots.txt, die auf die falsche Sitemap
 * zeigt, faellt erst Wochen spaeter auf. Jetzt kommt die Adresse aus
 * derselben Config wie die Sitemap selbst.
 *
 * Inhaltlich: alles offen, fuer Suchmaschinen und fuer KI-Crawler. Die Seite
 * ist ein Nachschlagewerk und moechte als Quelle benutzt werden. Die
 * einzelnen Crawler stehen ausdruecklich da, weil bei ihnen sonst oft
 * angenommen wird, eine fehlende Erlaubnis sei ein Verbot.
 *
 * Bewusst *nicht* gesperrt sind die Adressen des Vorbesitzers (/wp-admin/
 * und Verwandte). Eine gesperrte Adresse darf nicht abgerufen werden, also
 * erfaehrt die Suchmaschine nie, dass es sie nicht mehr gibt - sie bliebe
 * laenger in der Search Console stehen als eine offene. Sie bekommen
 * stattdessen 410 Gone, siehe src/altlasten.ts.
 */

import config from "../site.config.json";
import { generatedFile } from "./cache";

/** Ein Tag: aendert sich nur mit einem Deploy, wird selten abgerufen. */
const MAX_AGE = 86400;

/**
 * Crawler, die sammeln, zitieren oder einen Suchindex fuellen. Einzeln
 * genannt, weil mehrere von ihnen ohne ausdrueckliche Erlaubnis nicht
 * zugreifen.
 */
const KI_CRAWLER = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "meta-externalagent",
  "DuckAssistBot",
  "CCBot",
  "cohere-ai",
  "YouBot",
];

function robotsTxt(): string {
  const abs = (path: string) => new URL(path, config.site.url).toString();

  return [
    `# ${config.site.domain} - alles offen, fuer Suchmaschinen und fuer KI-Crawler.`,
    "#",
    "# Die Seite ist ein Nachschlagewerk und moechte als Quelle benutzt werden.",
    "# Durch die erste Gruppe waere ohnehin alles erlaubt; die Crawler darunter",
    "# stehen ausdruecklich da, weil bei ihnen sonst oft angenommen wird, eine",
    "# fehlende Erlaubnis sei ein Verbot.",
    "#",
    "# Ein kurzes Inhaltsverzeichnis fuer Modelle liegt unter /llms.txt, die",
    "# Seitenliste fuer Menschen unter /sitemap.",
    "#",
    "# Erzeugt vom Worker aus site.config.json - siehe src/robots.ts.",
    "",
    "User-agent: *",
    "Allow: /",
    "",
    "# Sammeln fuer Sprachmodelle, Antworten mit Quellenangabe, Suchindizes",
    ...KI_CRAWLER.map((name) => `User-agent: ${name}`),
    "Allow: /",
    "",
    `Sitemap: ${abs("/sitemap.xml")}`,
    "",
  ].join("\n");
}

const FILE = generatedFile(robotsTxt, "text/plain; charset=utf-8", MAX_AGE);

export const ROBOTS_PATH = "/robots.txt";

export function handleRobots(request: Request): Response {
  return FILE.respond(request);
}
