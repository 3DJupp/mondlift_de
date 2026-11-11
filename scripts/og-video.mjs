#!/usr/bin/env node
/**
 * Nimmt die Startseite mit der 3D-Szene als kurzes Video auf:
 * public/assets/og/mondlift.mp4, gedacht fuer `og:video`.
 *
 * Gezeigt wird, was Besucher oben auf der Startseite sehen - Namensschild,
 * Unterzeile und die Anlage, wie sie anfaehrt und sich aufrichtet. Nur der
 * Sprunglink am unteren Rand ist ausgeblendet, der fuehrt in einem Video
 * nirgendwohin.
 *
 * Aufgenommen wird nicht in Echtzeit, sondern Bild fuer Bild. Die Seite
 * bekommt dafuer eine eigene Uhr untergeschoben: `performance.now()` und
 * `requestAnimationFrame` laufen nur weiter, wenn dieses Skript einen
 * Schritt macht, und die CSS-Animationen des Schilds werden auf dieselbe
 * Zeit gestellt. Dadurch ist es egal, wie schnell der Rechner die Szene
 * zeichnet - ohne Grafikkarte sind es wenige Bilder pro Sekunde, das Video
 * laeuft trotzdem fluessig und sieht nach jedem Lauf gleich aus.
 *
 * Gebraucht werden Chromium und ffmpeg, sonst nichts. Gesteuert wird
 * Chromium ueber das DevTools-Protokoll auf einer Pipe; eine Bibliothek ist
 * dafuer nicht noetig. Die 3D-Szene laedt three.js von jsDelivr, der Rechner
 * braucht beim Aufnehmen also Netz.
 *
 *   node scripts/og-video.mjs
 *   node scripts/og-video.mjs --chrome /pfad/zu/chrome
 *   node scripts/og-video.mjs --out /tmp/vorschau.mp4
 *   node scripts/og-video.mjs --vorlauf 5 --dauer 15 --crf 26
 *
 * Neu aufnehmen muss man nur, wenn sich die Szene, das Schild oder der
 * Kopf der Startseite aendert.
 */

import { createServer } from "node:http";
import { readFile, mkdir, access, mkdtemp, rm, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { extname, join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const WIDTH = 1200;
const HEIGHT = 630;
const FPS = 30;

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

function arg(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
}

function zahl(name, fallback) {
  const wert = Number.parseFloat(arg(name, String(fallback)));
  if (!Number.isFinite(wert) || wert < 0) {
    console.error(`--${name} braucht eine Zahl, bekommen: ${arg(name)}`);
    process.exit(1);
  }
  return wert;
}

/**
 * Die Fahrt beginnt auf der Seite mit dem Anfahren. Der Vorlauf ueberspringt
 * den Anfang davon, damit das Video nicht mit einem fast stehenden Rad
 * beginnt; danach folgen das Ende des Anfahrens, das Aufrichten und ein
 * Stueck der Fahrt in voller Hoehe. Die Phasen stehen in enterprise-3d.js.
 */
const VORLAUF = zahl("vorlauf", 5); // Sekunden Fahrt vor dem ersten Bild
const DAUER = zahl("dauer", 15); // Laenge des Videos in Sekunden
const CRF = zahl("crf", 26); // Qualitaet fuer x264, kleiner = besser

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
    /** Ruft die Seite schon nach Bildern? Dann laeuft die Szene. */
    bereit: () => wartend.size > 0,
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

/** Was im Video nicht zu sehen sein soll. */
const AUSBLENDEN = `
  const stil = document.createElement("style");
  stil.textContent = ".hero__more, .skip { visibility: hidden !important; }";
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

// ------------------------------------------------------------------ Ablauf

const chrome = await erstesVorhandenes([arg("chrome"), ...CHROME_CANDIDATES]);
if (!chrome) {
  console.error(
    "Kein Chromium gefunden. Pfad mit --chrome oder CHROME_PATH angeben.",
  );
  process.exit(1);
}

const ziel = resolve(arg("out", join(PUBLIC, "assets/og/mondlift.mp4")));
await mkdir(dirname(ziel), { recursive: true });

const server = await serve();
const { port } = server.address();
const profil = await mkdtemp(join(tmpdir(), "og-chrome-"));
let browser = null;
let ffmpeg = null;

try {
  browser = spawn(
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
  const cdp = devtools(browser);
  const browserEnde = new Promise((_, fehler) => {
    browser.on("error", fehler);
    browser.on("close", (code) => {
      const grund = new Error(`Chromium endete vorzeitig (${code}).`);
      cdp.abbrechen(grund);
      fehler(grund);
    });
  });
  browserEnde.catch(() => {});

  const { targetId } = await cdp.senden("Target.createTarget", {
    url: "about:blank",
  });
  const { sessionId } = await cdp.senden("Target.attachToTarget", {
    targetId,
    flatten: true,
  });
  const seite = (method, params) => cdp.senden(method, params, sessionId);
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
  await seite("Page.navigate", { url: `http://127.0.0.1:${port}/` });
  await geladen;
  await rechne(AUSBLENDEN);

  // Die Szene laedt three.js und das Wandbild nach. Fertig ist sie, wenn
  // sie das erste Bild anfordert und das Wandbild angekommen ist. Springt
  // stattdessen die Canvas-Fassung ein, fehlt Netz oder WebGL - dann waere
  // das Video nicht das, was die Startseite zeigt.
  const frist = Date.now() + 60_000;
  for (;;) {
    const stand = await rechne(`({
      ersatz: Boolean(document.querySelector('script[src$="/enterprise.js"]')),
      bereit: window.__uhr.bereit(),
      wandbild: performance.getEntriesByType("resource")
        .some((e) => e.name.endsWith("/rueckwand.webp") && e.responseEnd > 0),
    })`);
    if (stand.ersatz) {
      throw new Error(
        "Die 3D-Szene ist nicht gestartet (three.js nicht erreichbar oder kein WebGL).",
      );
    }
    if (stand.bereit && stand.wandbild) break;
    if (Date.now() > frist) {
      throw new Error("Die 3D-Szene ist nach 60 Sekunden nicht bereit.");
    }
    await Promise.race([warte(200), browserEnde]);
  }
  await warte(500); // dem Wandbild Zeit lassen, zur Textur zu werden
  await rechne("window.__uhr.anhalten()");

  // Vorlauf: die Fahrt laeuft, aufgenommen wird noch nichts. Die Schritte
  // bleiben so klein wie spaeter im Video, weil die Szene bei grossen
  // Spruengen ein langsames Geraet vermutet und die Qualitaet senkt.
  const schritt = `window.__uhr.schritt(${1000 / FPS})`;
  const vorlaufBilder = Math.round(VORLAUF * FPS);
  for (let i = 0; i < vorlaufBilder; i++) {
    await rechne(schritt);
    if (i % FPS === 0) {
      process.stdout.write(`\rVorlauf ${i}/${vorlaufBilder}   `);
    }
  }

  ffmpeg = spawn(
    arg("ffmpeg", "ffmpeg"),
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "image2pipe",
      "-framerate",
      String(FPS),
      "-c:v",
      "png",
      "-i",
      "-",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      String(CRF),
      // yuv420p und "high" spielt jedes Geraet ab; faststart legt den Index
      // an den Anfang, damit das Abspielen beginnt, bevor alles geladen ist.
      "-pix_fmt",
      "yuv420p",
      "-profile:v",
      "high",
      "-movflags",
      "+faststart",
      ziel,
    ],
    { stdio: ["pipe", "ignore", "pipe"] },
  );
  let ffmpegFehler = "";
  ffmpeg.stderr.on("data", (stueck) => {
    ffmpegFehler += stueck;
  });
  const ffmpegEnde = new Promise((ok, fehler) => {
    ffmpeg.on("error", (grund) =>
      fehler(new Error(`ffmpeg liess sich nicht starten: ${grund.message}`)),
    );
    ffmpeg.on("close", (code) => {
      if (code === 0) ok();
      else fehler(new Error(`ffmpeg endete mit ${code}:\n${ffmpegFehler}`));
    });
  });
  ffmpegEnde.catch(() => {});
  ffmpeg.stdin.on("error", () => {}); // der Grund kommt ueber ffmpegEnde

  const bilder = Math.round(DAUER * FPS);
  for (let i = 0; i < bilder; i++) {
    await rechne(schritt);
    const { data } = await Promise.race([
      seite("Page.captureScreenshot", { format: "png" }),
      browserEnde,
    ]);
    if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) {
      await Promise.race([
        new Promise((ok) => ffmpeg.stdin.once("drain", ok)),
        ffmpegEnde,
      ]);
    }
    if (i % FPS === 0) process.stdout.write(`\rBild ${i}/${bilder}      `);
  }
  ffmpeg.stdin.end();
  await ffmpegEnde;
  ffmpeg = null;

  const { size } = await stat(ziel);
  console.log(
    `\rVideo geschrieben: ${ziel} (${WIDTH}x${HEIGHT}, ${DAUER} s, ${Math.round(size / 1024)} kB)`,
  );
} catch (fehler) {
  console.error(`\n${fehler.message}`);
  process.exitCode = 1;
} finally {
  ffmpeg?.kill();
  browser?.removeAllListeners("close");
  browser?.kill();
  server.close();
  await rm(profil, { recursive: true, force: true }).catch(() => {});
}
