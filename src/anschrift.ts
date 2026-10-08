/**
 * GET /anschrift.svg - die Anschrift als Bild.
 *
 * Zweck: die Anbieterkennzeichnung nach § 5 DDG muss auf der Seite stehen,
 * sie muss aber nicht als Text dort stehen. Als Bild laesst sie sich nicht
 * mehr von Programmen einsammeln, die Seiten nach Adressen durchsuchen.
 *
 * Drei Dinge, die man dazu wissen sollte:
 *
 * 1. **Es ist ein Vektorbild aus Umrissen, kein `<text>` im SVG.** Text in
 *    einem SVG ist genauso auslesbar wie Text in HTML - der Umweg waere
 *    sonst wirkungslos. Die Umrisse der Zeichen stehen in
 *    anschrift-glyphen.ts, erzeugt von scripts/glyphs.py.
 *
 * 2. **Die Anschrift selbst kommt weiterhin nur aus site.config.json.** Ein
 *    fertiges Bild im Repo waere die zweite Stelle mit der Adresse, und eine
 *    Aenderung muesste jemand in einem Grafikprogramm nachziehen. Der Worker
 *    setzt sie bei jeder Anfrage aus den Umrissen zusammen.
 *
 * 3. **Barrierefreiheit ist damit eingeschraenkt**, und das ist eine bewusste
 *    Abwaegung: wer das Bild nicht sehen kann, liest die Anschrift nicht. Der
 *    alt-Text im Impressum nennt sie deshalb nicht - er wuerde sie den
 *    Sammelprogrammen gleich wieder servieren - sondern verweist auf den Weg
 *    per E-Mail und Kontaktformular. Die bleiben als Text erreichbar, niemand
 *    ist also vom Kontakt abgeschnitten.
 */

import config from "../site.config.json";
import { GLYPHS, UPM, ASCENDER, DESCENDER } from "./anschrift-glyphen";
import { generatedFile } from "./cache";

/** Die Zeilen des Anschriftenblocks, wie im Impressum gesetzt. */
const LINES = [
  config.owner.name,
  config.owner.street,
  `${config.owner.postalCode} ${config.owner.city}`,
  config.owner.country,
];

/** Schriftgroesse in px. Entspricht dem Fliesstext der Seite. */
const SIZE = 16;

/** Zeilenabstand als Vielfaches der Schriftgroesse. */
const LINE_HEIGHT = 1.55;

/**
 * Entspricht `--ink-soft` in public/assets/css/style.css, der Farbe des
 * `address`-Blocks. Fest eingetragen, weil `currentColor` in einem per
 * `<img>` eingebundenen SVG nicht die Farbe der Seite erbt, sondern gegen
 * Schwarz aufloest - das waere auf dem dunklen Hintergrund unsichtbar. Wer
 * die Farbe dort aendert, aendert sie hier mit.
 */
const COLOR = "#b3bdd1";

/**
 * Ersatzzeichen fuer ein Zeichen, dessen Umriss fehlt: ein leeres Kaestchen.
 * Lieber sichtbar falsch als stillschweigend verschluckt - in einer Anschrift
 * faellt ein fehlender Buchstabe sonst niemandem auf. Aussen im Uhrzeigersinn,
 * innen dagegen, damit das Kaestchen hohl bleibt.
 */
const PLACEHOLDER: [number, string] = [
  600,
  "M60 -700H540V0H60ZM120 -640V-60H480V-640Z",
];

/** Setzt die Zeilen aus Umrissen zusammen und liefert das fertige SVG. */
function buildSvg(): string {
  const lineStep = UPM * LINE_HEIGHT;
  const paths: string[] = [];
  const fehlend = new Set<string>();
  let widthUnits = 0;

  LINES.forEach((line, index) => {
    // Grundlinie der Zeile im Koordinatensystem der Umrisse.
    const baseline = ASCENDER + index * lineStep;
    let x = 0;

    // Ueber Codepoints laufen, nicht ueber UTF-16-Einheiten.
    for (const char of line) {
      const glyph = GLYPHS[char];
      if (glyph === undefined) fehlend.add(char);
      const [advance, d] = glyph ?? PLACEHOLDER;
      // Das Leerzeichen hat einen Vorschub, aber keinen Umriss.
      if (d !== "") {
        paths.push(`<path transform="translate(${x} ${baseline})" d="${d}"/>`);
      }
      x += advance;
    }

    widthUnits = Math.max(widthUnits, x);
  });

  if (fehlend.size > 0) {
    // Sichtbar im Bild und nachlesbar in den Workers Logs.
    console.error(
      JSON.stringify({
        event: "anschrift_glyphen_fehlen",
        zeichen: [...fehlend].join(""),
      }),
    );
  }

  // DESCENDER ist negativ, die Unterlaenge liegt unter der letzten Grundlinie.
  const heightUnits = ASCENDER + (LINES.length - 1) * lineStep - DESCENDER;
  const px = (units: number) => Math.round((units * SIZE) / UPM);

  return [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="0 0 ${Math.round(widthUnits)} ${Math.round(heightUnits)}"`,
    ` width="${px(widthUnits)}" height="${px(heightUnits)}">`,
    `<g fill="${COLOR}">`,
    ...paths,
    `</g>`,
    `</svg>`,
    "",
  ].join("");
}

// Aendert sich nur mit einem Deploy, deshalb ein Tag Cache und ein ETag.
// Das SVG wird dadurch auch nur einmal je Isolate aus den Umrissen
// zusammengesetzt statt bei jeder Anfrage.
const FILE = generatedFile(buildSvg, "image/svg+xml; charset=utf-8", 86400);

export function handleAnschrift(request: Request): Response {
  return FILE.respond(request);
}
