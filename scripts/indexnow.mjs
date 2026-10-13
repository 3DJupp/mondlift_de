#!/usr/bin/env node
/**
 * Reicht die Seiten aus site.config.json bei IndexNow ein.
 *
 *   npm run indexnow                      alle Seiten aus der Config
 *   npm run indexnow -- /kontakt          nur diese, Pfad oder vollstaendige URL
 *   npm run indexnow -- --recent          nur kuerzlich geaenderte (Standard 7 Tage)
 *   npm run indexnow -- --recent=30       dasselbe mit anderem Fenster
 *   npm run indexnow -- --since=2026-10-01  alles ab diesem Datum
 *   npm run indexnow -- --dry-run         nur zeigen, was gesendet wuerde
 *   npm run indexnow -- --curl            dieselbe Meldung als curl-Befehle
 *   npm run indexnow -- --endpoint=<url>  andere Suchmaschine direkt
 *
 * Das laeuft automatisch mit: `npm run deploy` ruft ueber den npm-Hook
 * `postdeploy` dieses Skript mit `--recent` auf. Zwei Gruende fuer genau
 * diese Form:
 *
 *  1. **Automatisch, weil es sonst vergessen wird.** Ein Deploy, dessen
 *     Meldung an die Suchmaschinen ein zweiter, von Hand zu tippender Schritt
 *     ist, wird irgendwann ohne diesen Schritt gemacht.
 *  2. **Nur die kuerzlich geaenderten Seiten, nicht alle.** IndexNow ist
 *     dafuer gedacht, Aenderungen zu melden. Bei jedem Deploy alle acht
 *     Seiten zu melden - auch nach einer Aenderung, die nur den Worker
 *     betrifft - macht aus dem Signal Rauschen. `--recent` nimmt die Seiten,
 *     deren `lastmod` in site.config.json neu ist; und das Feld muss man
 *     beim Bearbeiten einer Seite ohnehin nachziehen, sonst stimmt die
 *     Sitemap nicht. Aendert sich keine Seite, meldet das Skript nichts und
 *     endet erfolgreich.
 *
 * Warum kein Cron im Worker: ein Cron ohne Gedaechtnis kann nicht wissen, ob
 * sich seit dem letzten Lauf etwas geaendert hat. Er wuerde entweder immer
 * melden oder nie. Der Deploy weiss es, also haengt die Meldung daran.
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

/**
 * Die uebrigen Endpunkte der Spezifikation. Einer genuegt - wer an einen
 * meldet, hat an alle gemeldet. Sie stehen hier, damit `--curl` sie nennen
 * kann, falls api.indexnow.org einmal nicht antwortet.
 */
const ENDPOINTS = [
  ["alle zusammen", DEFAULT_ENDPOINT],
  ["Bing", "https://www.bing.com/indexnow"],
  ["Yandex", "https://yandex.com/indexnow"],
  ["Seznam", "https://search.seznam.cz/indexnow"],
  ["Naver", "https://searchadvisor.naver.com/indexnow"],
];

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

/** Tage in Millisekunden. */
const TAG = 24 * 60 * 60 * 1000;

/** Standardfenster fuer --recent, wenn keine Zahl dabeisteht. */
const RECENT_TAGE = 7;

/**
 * Die Untergrenze fuer `lastmod`, oder null fuer "alle Seiten".
 *
 * `--since=<datum>` nennt sie direkt, `--recent[=tage]` rechnet sie aus.
 * Beides vergleicht nur Datumsangaben in der Form YYYY-MM-DD; die lassen
 * sich als Zeichenketten vergleichen, was hier genau richtig ist, weil in
 * der Config auch nichts anderes steht.
 */
function untergrenze() {
  if (typeof flags.since === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(flags.since)) {
      fail(`--since=${flags.since} ist kein Datum der Form YYYY-MM-DD`);
    }
    return flags.since;
  }
  if (!flags.recent) return null;

  const tage = flags.recent === true ? RECENT_TAGE : Number(flags.recent);
  if (!Number.isFinite(tage) || tage < 0) {
    fail(`--recent=${flags.recent} ist keine Anzahl von Tagen`);
  }
  return new Date(Date.now() - tage * TAG).toISOString().slice(0, 10);
}

// Argumente duerfen Pfade sein (/kontakt) oder vollstaendige URLs. Ohne
// Argumente wird die Seitenliste aus der Config genommen, gegebenenfalls
// eingeschraenkt auf die kuerzlich geaenderten Seiten.
const grenze = untergrenze();
let paths;

if (rest.length > 0) {
  // Ausdruecklich genannte Adressen werden gemeldet, Datum hin oder her.
  paths = rest;
} else {
  const pages = config.pages ?? [];
  const fallback = config.site?.lastUpdated ?? "";
  const gewaehlt =
    grenze === null
      ? pages
      : pages.filter((p) => (p.lastmod ?? fallback) >= grenze);

  // Nichts Neues ist kein Fehler: der haeufigste Deploy aendert Code und
  // keine Inhalte. Dann ist "nichts zu melden" die richtige Antwort, und
  // ein Fehlschlag hier wuerde einen gelungenen Deploy als misslungen
  // ausgeben.
  if (gewaehlt.length === 0) {
    console.log(
      `indexnow: keine Seite mit lastmod ab ${grenze} - nichts zu melden.`,
    );
    process.exit(0);
  }

  paths = gewaehlt.map((p) => p.path);
  if (grenze !== null) {
    console.log(
      `indexnow: ${gewaehlt.length} von ${pages.length} Seiten haben ` +
        `lastmod ab ${grenze}.`,
    );
  }
}

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

// --- Befehle zum Kopieren -------------------------------------------------

// Dasselbe als curl-Aufrufe, fuer eine Shell ohne dieses Repo: von einem
// anderen Rechner aus, aus einer Deploy-Pipeline heraus, oder um nach einer
// abgelehnten Meldung von Hand nachzusehen, was der Endpunkt antwortet.
if (flags.curl) {
  const q = encodeURIComponent;
  const out = [];

  out.push("# 1. Schluesseldatei - muss genau den Schluessel enthalten,");
  out.push("#    sonst lehnt jede Suchmaschine mit 403 ab.");
  out.push(`curl -sS ${keyLocation}; echo`);
  out.push("");

  const menge =
    urlList.length === 1 ? "die Adresse" : `alle ${urlList.length} Adressen`;
  out.push(`# 2. Melden - ${menge} in einer Anfrage.`);
  out.push("#    200 heisst angenommen, 202 angenommen und Schluessel wird geprueft.");
  out.push(`curl -sS -i -X POST ${endpoint} \\`);
  out.push("  -H 'content-type: application/json; charset=utf-8' \\");
  out.push(`  --data '${JSON.stringify(payload)}'`);
  out.push("");

  out.push("# 3. Oder als GET, eine Adresse je Aufruf - ausgegeben wird nur");
  out.push("#    der Statuscode und die gemeldete Adresse.");
  for (const url of urlList) {
    out.push(
      `curl -sS -o /dev/null -w '%{http_code}  ${url}\\n' \\
` +
        `  '${endpoint}?url=${q(url)}&key=${key}&keyLocation=${q(keyLocation)}'`,
    );
  }
  out.push("");

  out.push("# Ein Endpunkt genuegt, er verteilt an die teilnehmenden Suchmaschinen.");
  out.push("# Falls einer nicht antwortet, nimmt dieselben Anfragen auch:");
  for (const [name, url] of ENDPOINTS.slice(1)) out.push(`#   ${url}  (${name})`);
  out.push("# Google nimmt nicht teil - dort zaehlt die Sitemap.");

  console.log(out.join("\n"));
  process.exit(0);
}

// --- Schluesseldatei pruefen ---------------------------------------------

// Der haeufigste Fehlschlag ist eine Schluesseldatei, die noch nicht live
// ist. Das vorher zu pruefen kostet eine Anfrage und erspart ein 403, das
// man sonst erst bei der Suchmaschine sieht.
//
// Mit Wiederholung, weil dieses Skript direkt hinter `wrangler deploy`
// laeuft: die neue Fassung ist meist sofort da, aber "meist" ist hier zu
// wenig - ein Deploy, der eine Sekunde zu frueh meldet, waere ein Fehler,
// der nur manchmal auftritt und sich entsprechend schlecht suchen laesst.
const VERSUCHE = 4;

const schlaf = (ms) => new Promise((weiter) => setTimeout(weiter, ms));

if (!flags["skip-check"]) {
  let served = null;
  let grund = "";

  for (let versuch = 1; versuch <= VERSUCHE; versuch += 1) {
    try {
      const response = await fetch(keyLocation, {
        redirect: "follow",
        cache: "no-store",
      });
      if (response.ok) {
        served = (await response.text()).trim();
        if (served === key) break;
        grund = "enthaelt einen anderen Schluessel als die Config";
      } else {
        grund = `antwortet mit ${response.status}`;
      }
    } catch (error) {
      grund = `nicht erreichbar: ${error.message}`;
    }

    if (versuch === VERSUCHE) break;
    const wartezeit = 2 ** (versuch - 1) * 1000;
    console.log(
      `indexnow: ${keyLocation} ${grund} - neuer Versuch in ${wartezeit / 1000}s`,
    );
    await schlaf(wartezeit);
    served = null;
  }

  if (served !== key) {
    fail(`${keyLocation} ${grund || "nicht abrufbar"} - erst deployen`);
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
