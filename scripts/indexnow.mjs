#!/usr/bin/env node
/**
 * Reicht die Seiten aus site.config.json bei IndexNow ein.
 *
 *   npm run indexnow                      alle Seiten aus der Config
 *   npm run indexnow -- /kontakt          nur diese, Pfad oder vollstaendige URL
 *   npm run indexnow -- --dry-run         nur zeigen, was gesendet wuerde
 *   npm run indexnow -- --endpoint=<url>  andere Suchmaschine direkt
 *
 * Der richtige Zeitpunkt ist nach einem Deploy, der Inhalte geaendert hat -
 * nicht nach jedem. IndexNow ist dafuer gedacht, Aenderungen zu melden; eine
 * unveraenderte Seite erneut zu melden bringt nichts.
 *
 * Warum ein Skript und kein Cron im Worker: ein Cron ohne Gedaechtnis kann
 * nicht wissen, ob sich seit dem letzten Lauf etwas geaendert hat. Er wuerde
 * entweder immer melden oder nie. Der Deploy weiss es, also haengt die
 * Meldung daran.
 *
 * Ohne Abhaengigkeiten, laeuft mit dem fetch() von Node 20 und neuer.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(HERE, "..", "site.config.json");

/**
 * Der gemeinsame Endpunkt verteilt an alle teilnehmenden Suchmaschinen
 * (Bing, Yandex, Seznam, Naver und weitere). Google nimmt nicht teil und
 * laesst sich hier nicht erreichen - fuer Google zaehlt die Sitemap.
 */
const DEFAULT_ENDPOINT = "https://api.indexnow.org/indexnow";

/** Was die Antwortcodes des Protokolls bedeuten. */
const MEANINGS = {
  200: "angenommen",
  202: "angenommen, der Schluessel wird noch geprueft",
  400: "fehlerhafte Anfrage",
  403: "Schluessel abgelehnt - liegt die Schluesseldatei live?",
  422: "URLs passen nicht zum Host oder zum Schluessel",
  429: "zu viele Anfragen - spaeter erneut versuchen",
};

const KEY_PATTERN = /^[A-Za-z0-9-]{8,128}$/;

function fail(message) {
  console.error(`indexnow: ${message}`);
  process.exit(1);
}

/** Trennt --flags von den uebrigen Argumenten. */
function parseArgs(argv) {
  const flags = {};
  const rest = [];
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      rest.push(arg);
      continue;
    }
    const [name, value] = arg.slice(2).split("=", 2);
    flags[name] = value ?? true;
  }
  return { flags, rest };
}

const { flags, rest } = parseArgs(process.argv.slice(2));

// --- Config ---------------------------------------------------------------

let config;
try {
  config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));
} catch (error) {
  fail(`site.config.json nicht lesbar: ${error.message}`);
}

const siteUrl = config.site?.url;
const key = config.indexNow?.key;

if (!siteUrl) fail("site.url fehlt in site.config.json");
if (!key) fail("indexNow.key fehlt in site.config.json");
if (!KEY_PATTERN.test(key)) {
  fail(
    "indexNow.key passt nicht zur Spezifikation: 8 bis 128 Zeichen aus " +
      "a-z, A-Z, 0-9 und Bindestrich",
  );
}

const host = new URL(siteUrl).hostname;
const keyLocation = new URL(`/${key}.txt`, siteUrl).toString();

// Argumente duerfen Pfade sein (/kontakt) oder vollstaendige URLs. Ohne
// Argumente wird die Seitenliste aus der Config genommen.
const paths = rest.length > 0 ? rest : (config.pages ?? []).map((p) => p.path);
if (paths.length === 0) fail("keine Seiten angegeben und pages ist leer");

const urlList = paths.map((path) => new URL(path, siteUrl).toString());

const fremd = urlList.filter((u) => new URL(u).hostname !== host);
if (fremd.length > 0) {
  fail(`diese URLs liegen nicht auf ${host}: ${fremd.join(", ")}`);
}

const endpoint = typeof flags.endpoint === "string" ? flags.endpoint : DEFAULT_ENDPOINT;
const payload = { host, key, keyLocation, urlList };

// --- Trockenlauf ----------------------------------------------------------

if (flags["dry-run"]) {
  console.log(`POST ${endpoint}`);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
}

// --- Schluesseldatei pruefen ---------------------------------------------

// Der haeufigste Fehlschlag ist eine Schluesseldatei, die noch nicht live
// ist. Das vorher zu pruefen kostet eine Anfrage und erspart ein 403, das
// man sonst erst bei der Suchmaschine sieht.
if (!flags["skip-check"]) {
  let served;
  try {
    const response = await fetch(keyLocation, { redirect: "follow" });
    if (!response.ok) {
      fail(`${keyLocation} antwortet mit ${response.status} - erst deployen`);
    }
    served = (await response.text()).trim();
  } catch (error) {
    fail(`${keyLocation} nicht erreichbar: ${error.message}`);
  }
  if (served !== key) {
    fail(`${keyLocation} enthaelt einen anderen Schluessel als die Config`);
  }
  console.log(`Schluesseldatei geprueft: ${keyLocation}`);
}

// --- Einreichen -----------------------------------------------------------

let response;
try {
  response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
} catch (error) {
  fail(`${endpoint} nicht erreichbar: ${error.message}`);
}

const meaning = MEANINGS[response.status] ?? "unbekannte Antwort";
console.log(`${endpoint}: ${response.status} ${response.statusText} (${meaning})`);
for (const url of urlList) console.log(`  ${url}`);

// 200 und 202 sind beide Erfolg: 202 heisst nur, dass der Schluessel beim
// ersten Mal noch geprueft wird.
if (response.status !== 200 && response.status !== 202) {
  const body = (await response.text()).trim();
  if (body) console.error(body.slice(0, 500));
  process.exit(1);
}
