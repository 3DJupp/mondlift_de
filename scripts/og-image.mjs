#!/usr/bin/env node
/**
 * Erzeugt das Standbild fuer die Link-Vorschau: public/assets/og/mondlift.png
 *
 * Warum ueberhaupt eine Datei und kein Erzeugen im Worker: og:image braucht
 * ein Rasterbild von etwa 1200x630 Pixeln. SVG nehmen die Netzwerke und
 * Messenger nicht an, und ein PNG-Encoder im Worker haette keinen zweiten
 * Verwendungszweck. Das Bild wird also einmal gebaut und eingecheckt.
 *
 * Gezeigt wird dasselbe, was Besucher auf der Startseite sehen: die
 * Animation aus public/assets/js/enterprise.js, angehalten in der Stellung,
 * die sie auch bei `prefers-reduced-motion: reduce` zeichnet. Dafuer laeuft
 * hier kein Playwright und keine Bibliothek, sondern das Chromium, das
 * ohnehin auf dem Rechner liegt - mit `--screenshot` kann es das allein.
 *
 *   node scripts/og-image.mjs
 *   node scripts/og-image.mjs --chrome /pfad/zu/chrome
 *   node scripts/og-image.mjs --out /tmp/vorschau.png
 *
 * Neu bauen muss man das Bild nur, wenn sich die Animation oder der
 * Schriftzug darauf aendert. Die Punkte zur Optik stehen in BACKLOG.md.
 */

import { createServer } from "node:http";
import { readFile, mkdir, access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const WIDTH = 1200;
const HEIGHT = 630;
const HARNESS = "/__og-standbild.html";

/** Pfade, unter denen ein Chromium liegen kann - der erste Treffer gewinnt. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain; charset=utf-8",
};

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

/**
 * Die Seite fuer den Screenshot. Nur Canvas und Schriftzug - keine
 * Navigation, kein Footer, nichts, was auf einer Vorschaukarte verloren
 * waere. Das Stylesheet der Seite wird mitgeladen, damit Schrift und
 * Farben dieselben sind.
 */
const harnessHtml = `<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="/assets/css/style.css" />
    <style>
      html, body { margin: 0; height: 100%; overflow: hidden; background: #070a12; }
      #ride { position: fixed; inset: 0; width: 100%; height: 100%; }
      .karte {
        position: fixed;
        inset: auto 0 0 0;
        padding: 0 0 54px;
        text-align: center;
        background: linear-gradient(
          to top,
          rgba(4, 6, 14, 0.95) 0%,
          rgba(4, 6, 14, 0.62) 55%,
          rgba(4, 6, 14, 0) 100%
        );
      }
      .karte__titel {
        margin: 0;
        font-size: 92px;
        font-weight: 600;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        line-height: 1;
        color: #e9edf6;
        text-shadow: 0 0 48px rgba(255, 176, 64, 0.3);
      }
      .karte__zeile {
        margin: 18px 0 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
        font-size: 19px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #b3bdd1;
      }
    </style>
  </head>
  <body>
    <canvas id="ride" aria-hidden="true"></canvas>
    <div class="karte">
      <p class="karte__titel">Mondlift</p>
      <p class="karte__zeile">Huss Enterprise &middot; mondlift.de</p>
    </div>
    <script src="/assets/js/enterprise.js"></script>
  </body>
</html>
`;

async function erstesVorhandenes(pfade) {
  for (const pfad of pfade) {
    if (!pfad) continue;
    try {
      await access(pfad);
      return pfad;
    } catch {
      // weiter suchen
    }
  }
  return null;
}

/** Kleiner Server, damit die absoluten Pfade im HTML aufgehen. */
function serve() {
  const server = createServer(async (request, response) => {
    const pfad = new URL(request.url, "http://127.0.0.1").pathname;

    if (pfad === HARNESS) {
      response.writeHead(200, { "content-type": TYPES[".html"] });
      response.end(harnessHtml);
      return;
    }

    try {
      const datei = join(PUBLIC, pfad);
      if (!datei.startsWith(PUBLIC)) throw new Error("ausserhalb");
      const inhalt = await readFile(datei);
      response.writeHead(200, {
        "content-type": TYPES[extname(datei)] ?? "application/octet-stream",
      });
      response.end(inhalt);
    } catch {
      response.writeHead(404);
      response.end("nicht gefunden");
    }
  });

  return new Promise((ok) => {
    server.listen(0, "127.0.0.1", () => ok(server));
  });
}

function run(bin, args) {
  return new Promise((ok, fehler) => {
    const kind = spawn(bin, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    kind.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    kind.on("error", fehler);
    kind.on("close", (code) => {
      if (code === 0) ok();
      else fehler(new Error(`Chromium endete mit ${code}:\n${stderr}`));
    });
  });
}

const chrome = await erstesVorhandenes([arg("chrome"), ...CHROME_CANDIDATES]);
if (!chrome) {
  console.error(
    "Kein Chromium gefunden. Pfad mit --chrome oder CHROME_PATH angeben.",
  );
  process.exit(1);
}

const ziel = resolve(arg("out", join(PUBLIC, "assets/og/mondlift.png")));
await mkdir(dirname(ziel), { recursive: true });

const server = await serve();
const { port } = server.address();
const profil = await mkdtemp(join(tmpdir(), "og-chrome-"));

try {
  await run(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--hide-scrollbars",
    `--user-data-dir=${profil}`,
    // Haelt die Animation an: bei reduzierter Bewegung zeichnet
    // enterprise.js genau ein Bild, in einer festgelegten Stellung.
    // Dadurch sieht die Vorschau nach jedem Lauf gleich aus.
    "--force-prefers-reduced-motion",
    "--virtual-time-budget=4000",
    `--window-size=${WIDTH},${HEIGHT}`,
    `--screenshot=${ziel}`,
    `http://127.0.0.1:${port}${HARNESS}`,
  ]);
  console.log(`Standbild geschrieben: ${ziel} (${WIDTH}x${HEIGHT})`);
} finally {
  server.close();
  await rm(profil, { recursive: true, force: true });
}
