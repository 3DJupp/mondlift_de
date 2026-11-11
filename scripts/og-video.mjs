#!/usr/bin/env node
/**
 * Nimmt die Startseite mit der 3D-Szene als kurzes Video auf:
 * public/video/mondlift.mp4, gedacht fuer `og:video`.
 *
 * Gezeigt wird dieselbe Buehne wie auf dem Standbild aus og-image.mjs -
 * Namensschild, Unterzeile und die Anlage -, nur in Bewegung: das Rad
 * faehrt an und richtet sich auf.
 *
 * Aufgenommen wird nicht in Echtzeit, sondern Bild fuer Bild. Die Seite
 * bekommt dafuer eine eigene Uhr untergeschoben: `performance.now()` und
 * `requestAnimationFrame` laufen nur weiter, wenn dieses Skript einen
 * Schritt macht, und die CSS-Animationen des Schilds werden auf dieselbe
 * Zeit gestellt. Dadurch ist es egal, wie schnell der Rechner die Szene
 * zeichnet - ohne Grafikkarte sind es wenige Bilder pro Sekunde, das Video
 * laeuft trotzdem fluessig und sieht nach jedem Lauf gleich aus.
 *
 * Gebraucht werden Chromium, ffmpeg und Netz fuer three.js, sonst nichts.
 * Die gemeinsamen Teile stehen in og-buehne.mjs.
 *
 *   node scripts/og-video.mjs
 *   node scripts/og-video.mjs --chrome /pfad/zu/chrome
 *   node scripts/og-video.mjs --out /tmp/vorschau.mp4
 *   node scripts/og-video.mjs --vorlauf 5 --dauer 15 --crf 26
 *
 * Neu aufnehmen muss man nur, wenn sich die Szene, das Schild oder der
 * Kopf der Startseite aendert - dann auch das Standbild.
 */

import { mkdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import {
  PUBLIC,
  WIDTH,
  HEIGHT,
  arg,
  zahl,
  oeffneStartseite,
} from "./og-buehne.mjs";

const FPS = 30;

/**
 * Die Fahrt beginnt auf der Seite mit dem Anfahren. Der Vorlauf ueberspringt
 * den Anfang davon, damit das Video nicht mit einem fast stehenden Rad
 * beginnt; danach folgen das Ende des Anfahrens, das Aufrichten und ein
 * Stueck der Fahrt in voller Hoehe. Die Phasen stehen in enterprise-3d.js.
 */
const VORLAUF = zahl("vorlauf", 5); // Sekunden Fahrt vor dem ersten Bild
const DAUER = zahl("dauer", 15); // Laenge des Videos in Sekunden
const CRF = zahl("crf", 26); // Qualitaet fuer x264, kleiner = besser

const ziel = resolve(arg("out", join(PUBLIC, "video/mondlift.mp4")));
await mkdir(dirname(ziel), { recursive: true });

let buehne = null;
let ffmpeg = null;

try {
  buehne = await oeffneStartseite();

  // Vorlauf: die Fahrt laeuft, aufgenommen wird noch nichts. Die Schritte
  // bleiben so klein wie spaeter im Video, weil die Szene bei grossen
  // Spruengen ein langsames Geraet vermutet und die Qualitaet senkt.
  const vorlaufBilder = Math.round(VORLAUF * FPS);
  for (let i = 0; i < vorlaufBilder; i++) {
    await buehne.schritt(1000 / FPS);
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
    await buehne.schritt(1000 / FPS);
    if (!ffmpeg.stdin.write(await buehne.bild())) {
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
  await buehne?.schliessen();
}
