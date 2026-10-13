#!/usr/bin/env node
/**
 * Reicht die Seiten aus site.config.json bei IndexNow ein.
 *
 *   npm run indexnow                      alle Seiten aus der Config
 *   npm run indexnow -- /kontakt          nur diese, Pfad oder vollstaendige URL
 *   npm run indexnow -- --changed         nur was dieser Commit geaendert hat
 *   npm run indexnow -- --recent          nur kuerzlich geaenderte (Standard 7 Tage)
 *   npm run indexnow -- --recent=30       dasselbe mit anderem Fenster
 *   npm run indexnow -- --since=2026-10-01  alles ab diesem Datum
 *   npm run indexnow -- --wait-live       erst warten, bis der Deploy live ist
 *   npm run indexnow -- --dry-run         nur zeigen, was gesendet wuerde
 *   npm run indexnow -- --curl            dieselbe Meldung als curl-Befehle
 *   npm run indexnow -- --endpoint=<url>  andere Suchmaschine direkt
 *   npm run indexnow -- --base=<url>      andere Basisadresse (nur zum Testen)
 *
 * **Wer ruft das auf.** Zwei Wege, und der zweite ist der, der hier zaehlt:
 *
 *  - `npm run deploy` ruft es ueber den npm-Hook `postdeploy` auf. Das greift
 *    aber nur, wenn jemand von Hand deployt.
 *  - `.github/workflows/indexnow.yml` ruft es nach jedem Push auf `main` auf,
 *    mit `--wait-live`. Das ist der Weg, der zaehlt, wenn Cloudflare selbst
 *    aus dem Git-Repository deployt: Workers Builds fuehrt seinen eigenen
 *    Deploy-Befehl aus (`npx wrangler deploy`), also ist npm am Deploy gar
 *    nicht beteiligt - und ein npm-Hook, den niemand ausloest, laeuft nie.
 *
 * `--wait-live` ist der Grund, warum der zweite Weg nicht ins Leere meldet:
 * die Github-Action startet gleichzeitig mit dem Cloudflare-Build, nicht
 * danach. Das Skript sieht deshalb erst in der live ausgelieferten
 * sitemap.xml nach, ob die Seiten mit dem erwarteten `lastmod` schon dort
 * stehen, und meldet erst dann. Es meldet also nie eine Aenderung, die noch
 * gar nicht ausgeliefert wird.
 *
 * Zwei Gruende fuer `--recent`:
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

import { execFileSync } from "node:child_process";
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

// --base ersetzt die Basisadresse. Gedacht ist das fuer Tests gegen
// `wrangler dev`; fuer eine echte Meldung muss die Adresse die Domain sein,
// fuer die der Schluessel gilt.
const siteUrl = typeof flags.base === "string" ? flags.base : config.site?.url;
const key = config.indexNow?.key;

if (!siteUrl) fail("site.url fehlt in site.config.json");
if (typeof flags.base === "string") {
  console.log(`indexnow: Basisadresse ueberschrieben auf ${siteUrl}`);
}
if (!key) fail("indexNow.key fehlt in site.config.json");
if (!KEY_PATTERN.test(key)) {
  fail(
    "indexNow.key passt nicht zur Spezifikation: 8 bis 128 Zeichen aus " +
      "a-z, A-Z, 0-9 und Bindestrich",
  );
}

const host = new URL(siteUrl).hostname;
const keyLocation = new URL(`/${key}.txt`, siteUrl).toString();

/**
 * Die Seiten, deren `lastmod` sich gegenueber `ref` geaendert hat, oder die
 * dort noch nicht standen. `null`, wenn sich die alte Fassung nicht lesen
 * laesst - dann faellt der Aufrufer auf das Zeitfenster zurueck.
 *
 * Warum nicht einfach `--recent`: das Zeitfenster meldet eine Seite bei
 * jedem Push erneut, solange ihr Datum jung ist. Fuenf Deploys in einer
 * Woche heissen fuenf Meldungen fuer dieselbe unveraenderte Seite - genau
 * das, was IndexNow nicht haben will. Der Vergleich gegen den vorigen Stand
 * nennt dagegen genau die Seiten, die dieser Deploy wirklich aendert.
 */
function geaendertGegen(ref, pages, fallback) {
  let alt;
  try {
    const roh = execFileSync("git", ["show", `${ref}:site.config.json`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    alt = JSON.parse(roh);
  } catch {
    return null;
  }

  const vorher = new Map(
    (alt.pages ?? []).map((p) => [p.path, p.lastmod ?? alt.site?.lastUpdated]),
  );
  return pages.filter((p) => vorher.get(p.path) !== (p.lastmod ?? fallback));
}

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

/**
 * Die gewaehlten Seiten mit dem `lastmod`, das nach dem Deploy live stehen
 * muss. Leer, wenn Adressen von Hand genannt wurden - dann gibt es nichts
 * zu vergleichen, denn die Config sagt ueber eine beliebige Adresse nichts.
 */
let erwartet = [];

if (rest.length > 0) {
  // Ausdruecklich genannte Adressen werden gemeldet, Datum hin oder her.
  // Steht eine davon in der Config, kann --wait-live sie trotzdem pruefen.
  paths = rest;
  const bekannt = new Map(
    (config.pages ?? []).map((p) => [
      p.path,
      p.lastmod ?? config.site?.lastUpdated ?? "",
    ]),
  );
  erwartet = rest
    .map((pfad) => {
      const url = new URL(pfad, siteUrl);
      const lastmod = bekannt.get(url.pathname);
      return lastmod === undefined
        ? null
        : { url: url.toString(), pfad: url.pathname, lastmod };
    })
    .filter(Boolean);
} else {
  const pages = config.pages ?? [];
  const fallback = config.site?.lastUpdated ?? "";

  let gewaehlt = null;
  let begruendung = "";

  if (flags.changed) {
    const ref = typeof flags.changed === "string" ? flags.changed : "HEAD~1";
    gewaehlt = geaendertGegen(ref, pages, fallback);
    if (gewaehlt === null) {
      console.log(
        `indexnow: ${ref}:site.config.json nicht lesbar - zurueck auf das ` +
          "Zeitfenster.",
      );
    } else {
      begruendung = `gegenueber ${ref} geaendert`;
    }
  }

  if (gewaehlt === null) {
    gewaehlt =
      grenze === null
        ? pages
        : pages.filter((p) => (p.lastmod ?? fallback) >= grenze);
    if (grenze !== null) begruendung = `lastmod ab ${grenze}`;
  }

  // Nichts Neues ist kein Fehler: der haeufigste Deploy aendert Code und
  // keine Inhalte. Dann ist "nichts zu melden" die richtige Antwort, und
  // ein Fehlschlag hier wuerde einen gelungenen Deploy als misslungen
  // ausgeben.
  if (gewaehlt.length === 0) {
    console.log(
      `indexnow: keine Seite ${begruendung || "ausgewaehlt"} - nichts zu melden.`,
    );
    process.exit(0);
  }

  paths = gewaehlt.map((p) => p.path);
  erwartet = gewaehlt.map((p) => ({
    url: new URL(p.path, siteUrl).toString(),
    pfad: new URL(p.path, siteUrl).pathname,
    lastmod: p.lastmod ?? fallback,
  }));
  if (begruendung) {
    console.log(
      `indexnow: ${gewaehlt.length} von ${pages.length} Seiten ` +
        `(${begruendung}).`,
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

// --- Auf den Deploy warten ------------------------------------------------

/**
 * Wartet, bis die live ausgelieferte sitemap.xml die gewaehlten Seiten mit
 * dem erwarteten `lastmod` enthaelt.
 *
 * Der Grund steht oben: die Github-Action startet gleichzeitig mit dem
 * Cloudflare-Build. Ohne diese Schleife wuerde sie melden, waehrend noch die
 * alte Fassung ausgeliefert wird - die Suchmaschine kaeme vorbei, faende
 * nichts Neues und haette gelernt, dass die Meldungen dieser Domain nichts
 * bedeuten.
 *
 * Verglichen wird gegen die Sitemap und nicht gegen den Seiteninhalt, weil
 * die Sitemap aus derselben Config kommt wie diese Meldung: steht dort das
 * neue Datum, ist der neue Worker live.
 */
const WARTE_MINUTEN = 10;
const WARTE_ABSTAND_MS = 15000;

/**
 * Pfad und lastmod aus einer Sitemap. Ein eigener XML-Parser waere hier
 * verfehlt - es ist die eigene Datei, in bekanntem Format.
 *
 * Verglichen wird der Pfad und nicht die volle Adresse: so laesst sich mit
 * --base gegen `wrangler dev` pruefen, dessen Sitemap die Produktionsdomain
 * nennt. Strenger waere der Vergleich der vollen Adresse nicht - eine
 * Sitemap, die fremde Hosts auffuehrt, waere ohnehin kaputt.
 */
function sitemapLesen(xml) {
  const eintraege = new Map();
  for (const block of xml.match(/<url>[\s\S]*?<\/url>/g) ?? []) {
    const loc = block.match(/<loc>([^<]*)<\/loc>/)?.[1];
    const lastmod = block.match(/<lastmod>([^<]*)<\/lastmod>/)?.[1];
    if (!loc) continue;
    try {
      eintraege.set(new URL(loc.trim()).pathname, (lastmod ?? "").trim());
    } catch {
      // Eine Adresse, die keine ist, ignorieren statt daran zu scheitern.
    }
  }
  return eintraege;
}

if (flags["wait-live"] && erwartet.length > 0) {
  const minuten =
    flags["wait-live"] === true ? WARTE_MINUTEN : Number(flags["wait-live"]);
  if (!Number.isFinite(minuten) || minuten <= 0) {
    fail(`--wait-live=${flags["wait-live"]} ist keine Anzahl von Minuten`);
  }

  const sitemapUrl = new URL("/sitemap.xml", siteUrl).toString();
  const frist = Date.now() + minuten * 60 * 1000;
  let offen = erwartet;

  console.log(`indexnow: warte auf den Deploy, hoechstens ${minuten} Minuten.`);

  while (true) {
    try {
      const response = await fetch(sitemapUrl, { cache: "no-store" });
      if (response.ok) {
        const live = sitemapLesen(await response.text());
        offen = erwartet.filter((e) => live.get(e.pfad) !== e.lastmod);
        if (offen.length === 0) break;
      }
    } catch {
      // Netzfehler sind waehrend eines Deploys normal - weiter warten.
    }

    if (Date.now() >= frist) {
      console.error(
        `indexnow: nach ${minuten} Minuten steht in ${sitemapUrl} noch nicht, ` +
          "was erwartet wurde:",
      );
      for (const e of offen) console.error(`  ${e.url} (erwartet ${e.lastmod})`);
      fail("Deploy nicht live - nichts gemeldet");
    }

    await new Promise((weiter) => setTimeout(weiter, WARTE_ABSTAND_MS));
  }

  console.log(`indexnow: Deploy ist live (${sitemapUrl}).`);
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
