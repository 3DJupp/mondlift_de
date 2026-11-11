/**
 * Gemeinsame Buehne fuer scripts/og-image.mjs und scripts/og-video.mjs.
 *
 * Beide zeigen dasselbe: den Kopf der Startseite mit Namensschild und der
 * 3D-Szene, 1200x630 Pixel. Hier steht, was sie dafuer teilen - der kleine
 * Server auf public/, der Start von Chromium, das DevTools-Protokoll und
 * die Uhr, die der Seite untergeschoben wird.
 *
 * Gesteuert wird Chromium ueber --remote-debugging-pipe; eine Bibliothek
 * ist dafuer nicht noetig. Die 3D-Szene laedt three.js von jsDelivr, der
 * Rechner braucht beim Aufnehmen also Netz.
 */

import { createServer } from "node:http";
import { readFile, access, mkdtemp, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLIC = join(ROOT, "public");
export const WIDTH = 1200;
export const HEIGHT = 630;

/** Pfade, unter denen ein Chromium liegen kann - der erste Treffer gewinnt. */
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/opt/pw-browsers/chromium",
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
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
};

/** Wert hinter --name auf der Kommandozeile. */
export function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

/** Wie arg(), aber als Zahl; bei Unsinn endet das Skript. */
export function zahl(name, fallback) {
  const wert = Number.parseFloat(arg(name, String(fallback)));
  if (!Number.isFinite(wert) || wert < 0) {
    console.error(`--${name} braucht eine Zahl, bekommen: ${arg(name)}`);
    process.exit(1);
  }
  return wert;
}

/**
 * Laeuft in der Seite, bevor irgendein Skript von ihr startet. Ersetzt die
 * Uhr und sammelt die Bildanforderungen, statt sie dem Browser zu geben.
 */
const UHR = `(() => {
  let jetzt = 0;
  let naechste = 1;
  let wartend = new Map();
  performance.now = () => jetzt;
  window.requestAnimationFrame = (fn) => {
    const id = naechste++;
    wartend.set(id, fn);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    wartend.delete(id);
  };
  window.__uhr = {
    /** Haelt die CSS-Animationen an; ab jetzt folgen sie der Uhr. */
    anhalten: () => {
      for (const a of document.getAnimations()) a.pause();
    },
    /** Ein Schritt um ms Millisekunden: ein Bild der Szene. */
    schritt: (ms) => {
      jetzt += ms;
      for (const a of document.getAnimations()) a.currentTime = jetzt;
      const faellig = wartend;
      wartend = new Map();
      for (const fn of faellig.values()) fn(jetzt);
    },
  };
})();`;

/**
 * Was die Vorschau anders zeigt als die Seite. Der Sprunglink fuehrt in
 * einem Bild nirgendwohin. Die Unterzeile wandert an den unteren Rand: im
 * flachen Vorschauformat reicht das aufgerichtete Rad bis unter das Schild
 * und wuerde sie sonst verdecken.
 */
const ZUSCHNITT = `
  const stil = document.createElement("style");
  stil.textContent = \`
    .hero__more, .skip { visibility: hidden !important; }
    .hero__sub {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 40px;
      margin: 0 auto;
      max-width: none;
    }
  \`;
  document.head.appendChild(stil);
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

/** Kleiner Server auf public/, damit die absoluten Pfade im HTML aufgehen. */
function serve() {
  const server = createServer(async (request, response) => {
    let pfad = new URL(request.url, "http://127.0.0.1").pathname;
    if (pfad === "/") pfad = "/index.html";
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

const warte = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Das DevTools-Protokoll ueber --remote-debugging-pipe: Chromium liest
 * Befehle auf Dateideskriptor 3 und antwortet auf 4, jede Nachricht ist
 * JSON und endet mit einem Nullbyte.
 */
function devtools(kind) {
  const hin = kind.stdio[3];
  const her = kind.stdio[4];
  const offen = new Map();
  const lauscher = new Set();
  let naechste = 1;
  let rest = "";

  her.setEncoding("utf8");
  her.on("data", (stueck) => {
    rest += stueck;
    let ende;
    while ((ende = rest.indexOf("\0")) !== -1) {
      const nachricht = JSON.parse(rest.slice(0, ende));
      rest = rest.slice(ende + 1);
      if (nachricht.id !== undefined) {
        const { ok, fehler } = offen.get(nachricht.id) ?? {};
        offen.delete(nachricht.id);
        if (nachricht.error) fehler?.(new Error(nachricht.error.message));
        else ok?.(nachricht.result);
      } else {
        for (const fn of lauscher) fn(nachricht);
      }
    }
  });

  return {
    senden(method, params = {}, sessionId) {
      const id = naechste++;
      return new Promise((ok, fehler) => {
        offen.set(id, { ok, fehler });
        hin.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
      });
    },
    /** Wartet auf das naechste Ereignis mit diesem Namen. */
    ereignis(method) {
      return new Promise((ok) => {
        const fn = (nachricht) => {
          if (nachricht.method !== method) return;
          lauscher.delete(fn);
          ok(nachricht.params);
        };
        lauscher.add(fn);
      });
    },
    abbrechen(grund) {
      for (const { fehler } of offen.values()) fehler(grund);
      offen.clear();
    },
  };
}

/**
 * Oeffnet die Startseite in Chromium und wartet, bis die 3D-Szene steht.
 * `query` kommt an die Adresse, etwa "?t=24" fuer eine eingefrorene Fahrt.
 *
 * Zurueck kommen:
 *   rechne(ausdruck)  wertet JavaScript in der Seite aus
 *   schritt(ms)       stellt die Uhr der Seite um ms weiter
 *   bild()            das aktuelle Bild als PNG
 *   schliessen()      beendet Chromium und den Server
 */
export async function oeffneStartseite({ query = "" } = {}) {
  const chrome = await erstesVorhandenes([arg("chrome"), ...CHROME_CANDIDATES]);
  if (!chrome) {
    throw new Error(
      "Kein Chromium gefunden. Pfad mit --chrome oder CHROME_PATH angeben.",
    );
  }

  const server = await serve();
  const { port } = server.address();
  const profil = await mkdtemp(join(tmpdir(), "og-chrome-"));
  const browser = spawn(
    chrome,
    [
      "--headless=new",
      "--no-sandbox",
      "--hide-scrollbars",
      // Ohne Grafikkarte zeichnet Chromium WebGL nur noch auf ausdruecklichen
      // Wunsch in Software. Mit Grafikkarte aendert der Schalter nichts.
      "--enable-unsafe-swiftshader",
      `--user-data-dir=${profil}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      "--remote-debugging-pipe",
      "about:blank",
    ],
    { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] },
  );

  async function schliessen() {
    browser.removeAllListeners("close");
    browser.kill();
    server.close();
    await rm(profil, { recursive: true, force: true }).catch(() => {});
  }

  try {
    const cdp = devtools(browser);
    const ende = new Promise((_, fehler) => {
      browser.on("error", fehler);
      browser.on("close", (code) => {
        const grund = new Error(`Chromium endete vorzeitig (${code}).`);
        cdp.abbrechen(grund);
        fehler(grund);
      });
    });
    ende.catch(() => {});

    const { targetId } = await cdp.senden("Target.createTarget", {
      url: "about:blank",
    });
    const { sessionId } = await cdp.senden("Target.attachToTarget", {
      targetId,
      flatten: true,
    });
    const seite = (method, params) =>
      Promise.race([cdp.senden(method, params, sessionId), ende]);
    const rechne = async (expression) => {
      const { result, exceptionDetails } = await seite("Runtime.evaluate", {
        expression,
        returnByValue: true,
      });
      if (exceptionDetails) {
        throw new Error(
          `Fehler in der Seite: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`,
        );
      }
      return result.value;
    };

    await seite("Emulation.setDeviceMetricsOverride", {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await seite("Page.enable");
    await seite("Page.addScriptToEvaluateOnNewDocument", { source: UHR });

    const geladen = cdp.ereignis("Page.loadEventFired");
    await seite("Page.navigate", { url: `http://127.0.0.1:${port}/${query}` });
    await Promise.race([geladen, ende]);
    await rechne(ZUSCHNITT);

    // Die Szene laedt three.js und das Wandbild nach; ist das Wandbild da,
    // steht sie. Springt stattdessen die Canvas-Fassung ein, fehlt Netz
    // oder WebGL - dann waere die Vorschau nicht das, was die Startseite
    // zeigt.
    const frist = Date.now() + 60_000;
    for (;;) {
      const stand = await rechne(`({
        ersatz: Boolean(document.querySelector('script[src$="/enterprise.js"]')),
        wandbild: performance.getEntriesByType("resource")
          .some((e) => e.name.endsWith("/rueckwand.webp") && e.responseEnd > 0),
      })`);
      if (stand.ersatz) {
        throw new Error(
          "Die 3D-Szene ist nicht gestartet (three.js nicht erreichbar oder kein WebGL).",
        );
      }
      if (stand.wandbild) break;
      if (Date.now() > frist) {
        throw new Error("Die 3D-Szene ist nach 60 Sekunden nicht bereit.");
      }
      await warte(200);
    }
    await warte(800); // dem Wandbild Zeit lassen, zur Textur zu werden
    await rechne("window.__uhr.anhalten()");

    return {
      rechne,
      schritt: (ms) => rechne(`window.__uhr.schritt(${ms})`),
      async bild() {
        const { data } = await seite("Page.captureScreenshot", {
          format: "png",
        });
        return Buffer.from(data, "base64");
      },
      schliessen,
    };
  } catch (fehler) {
    await schliessen();
    throw fehler;
  }
}
