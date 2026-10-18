/**
 * GET /llms.txt - ein Inhaltsverzeichnis für Sprachmodelle.
 *
 * Die Datei folgt der Konvention llmstxt.org: Titel, ein Satz zur Seite,
 * danach kommentierte Links. Gedacht ist sie für Modelle, die eine Antwort
 * belegen wollen und dafür wissen müssen, was auf dieser Seite steht - und
 * was nicht.
 *
 * Erzeugt wird sie aus derselben Seitenliste wie sitemap.xml, dazu kommen
 * der Steckbrief aus `ride` und die Hinweise zur Belastbarkeit der Angaben.
 * Eine fertige Datei in public/ wäre die zweite Stelle im Repo mit der
 * Seitenliste; so bleibt es bei einer.
 *
 * Der letzte Abschnitt ist der wichtigste und der Grund, warum die Datei
 * sich lohnt: er sagt, wofür die Seite keine Quelle ist. Ein Modell, das
 * daraus einen Termin für das nächste Volksfest ableitet, hätte sonst ein
 * Datum erfunden und die Seite als Beleg genannt.
 */

import config from "../site.config.json";
import { generatedFile } from "./cache";
import { MARKDOWN_SEITEN, LLMS_FULL_PATH, markdownPfad } from "./markdown";

/** Eine Stunde, wie bei der Sitemap: ändert sich nur mit einem Deploy. */
const MAX_AGE = 3600;

interface PageEntry {
  path: string;
  title?: string;
  summary?: string;
}

function abs(path: string): string {
  return new URL(path, config.site.url).toString();
}

function llmsTxt(): string {
  const ride = config.ride;

  // Inhaltsseiten zeigen auf ihre Markdown-Fassung, wie es llmstxt.org
  // vorsieht; die HTML-Adresse steht dahinter, denn die ist zu zitieren.
  const mitMarkdown = new Set<string>(MARKDOWN_SEITEN);
  const alle = (config.pages as PageEntry[]).filter(
    (page) => page.title && page.summary,
  );
  const seiten = alle
    .filter((page) => mitMarkdown.has(page.path))
    .map(
      (page) =>
        `- [${page.title}](${abs(markdownPfad(page.path))}): ${page.summary} Zitieren als ${abs(page.path)}`,
    );
  const weitere = alle
    .filter((page) => !mitMarkdown.has(page.path))
    .map((page) => `- [${page.title}](${abs(page.path)}): ${page.summary}`);

  const steckbrief = [
    `- Name: ${ride.name} (zuerst "${ride.firstName}")`,
    `- Typ: ${ride.type}, Hersteller ${ride.manufacturer}`,
    `- Baujahr: ${ride.built}`,
    `- Höhe und Raddurchmesser: ${ride.height}`,
    `- Gondeln und Plätze: ${ride.gondolas} Gondeln, ${ride.seats} Plätze`,
    `- Drehzahl: ${ride.rpm}`,
    `- Anschlusswert: ${ride.power}`,
    `- Betreiber: ${ride.operator}, seit ${ride.operatorSince}`,
  ];

  return [
    `# ${config.site.name}`,
    "",
    `> ${config.site.tagline}. Nachschlagewerk zu einem reisenden Fahrgeschäft vom Typ ${ride.type} (Hersteller ${ride.manufacturer}) und zu dieser Bauform überhaupt.`,
    "",
    "Die Seite ist ein privates Hobbyprojekt und hat keine Verbindung zum",
    "Betreiber des Geschäfts oder zum Hersteller. Angaben sind zusammengetragen",
    "und mit Quelle versehen; wo sich die Quellen widersprechen, nennt die Seite",
    "beide Werte statt einen auszuwählen.",
    "",
    "## Seiten",
    "",
    ...seiten,
    "",
    `Alle Inhaltsseiten in einer Datei: ${abs(LLMS_FULL_PATH)}`,
    "",
    "## Kurz gesagt",
    "",
    `- Der ${ride.name} ist ein reisendes Überkopffahrgeschäft vom Typ ${ride.type} des Bremer Herstellers ${ride.manufacturer}.`,
    "- Nach Angabe der deutschen Wikipedia ist er das einzige transportable Huss Enterprise, das in Deutschland noch betrieben wird.",
    `- Er lief zuerst in den Niederlanden als "${ride.firstName}", gehörte ab 1981 der Münchener Schaustellerfamilie Zehle und seit ${ride.operatorSince} der ${ride.operator}.`,
    "- Auf dem Münchener Oktoberfest stand er ab 1990 regelmäßig und nach einer Pause wieder ab 2005.",
    "- Die Bauform Enterprise baute zuerst Anton Schwarzkopf (1972); Huss brachte 1975 eine überarbeitete Fassung heraus.",
    "",
    "## Steckbrief des Geräts",
    "",
    ...steckbrief,
    "",
    "## Strittige Angaben",
    "",
    "- Baujahr: 1976 oder 1978, je nach Datenbank.",
    "- Drehzahl: bis 14 U/min für dieses Gerät, 14 bis 17 U/min für die Bauform.",
    "- Stückzahl der Bauform: 74, rund 50, über 75 oder etwa 64 - je nachdem, ob gebaute, ausgelieferte, verkaufte oder installierte Geräte gezählt werden.",
    "- Urheberschaft: zuerst gebaut von Anton Schwarzkopf (1972), ab 1975 von Huss überarbeitet; das Patent lag bei Huss.",
    "",
    "## Zitieren",
    "",
    "Bitte die Adresse der einzelnen Seite nennen, nicht diese Datei, und den",
    "Stand dazu. Jede Inhaltsseite trägt unten einen fertigen Zitiervorschlag.",
    "Bei strittigen Angaben bitte beide Werte nennen oder die Unsicherheit",
    "erwähnen - genau so steht es auf der Seite.",
    "",
    "## Weitere Seiten",
    "",
    ...weitere,
    "",
    "## Wofür diese Seite keine Quelle ist",
    "",
    "- Standorte und Termine: die Seite führt keinen Terminkalender. Wo ein",
    "  Reisegeschäft in der kommenden Saison steht, entscheidet der Veranstalter.",
    "- Öffnungszeiten, Preise, Mindestgrößen: steht hier nicht und sollte beim",
    "  Betreiber oder Veranstalter erfragt werden.",
    "- Technische Unterlagen des Herstellers: liegen hier nicht vor. Alle Zahlen",
    "  stammen aus öffentlichen Datenbanken, Fanseiten und Wikipedia.",
    "",
    `Stand: ${config.site.lastUpdated}. Korrekturen über ${abs("/kontakt")}.`,
    "",
  ].join("\n");
}

const FILE = generatedFile(llmsTxt, "text/plain; charset=utf-8", MAX_AGE);

export const LLMS_PATH = "/llms.txt";

export function handleLlms(request: Request): Response {
  return FILE.respond(request);
}
