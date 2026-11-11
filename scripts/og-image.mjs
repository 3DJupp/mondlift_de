#!/usr/bin/env node
/**
 * Erzeugt das Standbild fuer die Link-Vorschau: public/assets/og/mondlift.png
 *
 * Warum ueberhaupt eine Datei und kein Erzeugen im Worker: og:image braucht
 * ein Rasterbild von etwa 1200x630 Pixeln. SVG nehmen die Netzwerke und
 * Messenger nicht an, und ein PNG-Encoder im Worker haette keinen zweiten
 * Verwendungszweck. Das Bild wird also einmal gebaut und eingecheckt.
 *
 * Gezeigt wird der Kopf der Startseite: Namensschild, Unterzeile und die
 * 3D-Szene mit aufgerichtetem Rad. Die Fahrt wird dafuer mit `?t=...`
 * eingefroren, wie es enterprise-3d.js fuer Standbilder vorsieht, und die
 * Lichter des Schilds stehen auf einem festen Zeitpunkt. Dadurch sieht das
 * Bild nach jedem Lauf gleich aus. Dieselbe Buehne nimmt og-video.mjs in
 * Bewegung auf; die gemeinsamen Teile stehen in og-buehne.mjs.
 *
 * Gebraucht werden Chromium und Netz fuer three.js. Mit ffmpeg wird das
 * Bild zusaetzlich auf 256 Farben gebracht, damit es klein bleibt; ohne
 * ffmpeg bleibt es beim groesseren PNG aus Chromium.
 *
 *   node scripts/og-image.mjs
 *   node scripts/og-image.mjs --chrome /pfad/zu/chrome
 *   node scripts/og-image.mjs --out /tmp/vorschau.png
 *   node scripts/og-image.mjs --t 24 --schild 600
 *
 * Neu bauen muss man das Bild nur, wenn sich die Szene, das Schild oder
 * der Kopf der Startseite aendert - dann auch das Video.
 */

import { mkdir, writeFile, stat } from "node:fs/promises";
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

const FAHRT = zahl("t", 24); // Sekunde der Fahrt: Rad steht oben
const SCHILD = zahl("schild", 600); // Millisekunden im Lichtspiel des Schilds

/** PNG auf eine Palette von 256 Farben bringen. Faellt aus, wenn ffmpeg fehlt. */
function verkleinern(png) {
  return new Promise((ok) => {
    const ffmpeg = spawn(
      arg("ffmpeg", "ffmpeg"),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-c:v",
        "png",
        "-i",
        "-",
        "-vf",
        "split[a][b];[a]palettegen=max_colors=256:stats_mode=single[p];[b][p]paletteuse=dither=sierra2_4a",
        "-f",
        "image2pipe",
        "-c:v",
        "png",
        "-",
      ],
      { stdio: ["pipe", "pipe", "ignore"] },
    );
    const teile = [];
    ffmpeg.stdout.on("data", (stueck) => teile.push(stueck));
    ffmpeg.on("error", () => ok(null));
    ffmpeg.on("close", (code) => ok(code === 0 ? Buffer.concat(teile) : null));
    ffmpeg.stdin.on("error", () => {});
    ffmpeg.stdin.end(png);
  });
}

const ziel = resolve(arg("out", join(PUBLIC, "assets/og/mondlift.png")));
await mkdir(dirname(ziel), { recursive: true });

let buehne = null;
try {
  buehne = await oeffneStartseite({ query: `?t=${FAHRT}` });
  await buehne.schritt(SCHILD);
  const gross = await buehne.bild();
  const klein = await verkleinern(gross);
  if (!klein) console.warn("ffmpeg fehlt, das Bild bleibt unverkleinert.");
  await writeFile(ziel, klein && klein.length < gross.length ? klein : gross);

  const { size } = await stat(ziel);
  console.log(
    `Standbild geschrieben: ${ziel} (${WIDTH}x${HEIGHT}, ${Math.round(size / 1024)} kB)`,
  );
} catch (fehler) {
  console.error(fehler.message);
  process.exitCode = 1;
} finally {
  await buehne?.schliessen();
}
