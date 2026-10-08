#!/usr/bin/env python3
"""
Erzeugt src/anschrift-glyphen.ts: die Umrisse der Zeichen, aus denen der
Worker das Anschrift-Bild zusammensetzt.

Laeuft nicht im normalen Entwicklungsablauf. Noetig nur, wenn die Schrift
oder der Zeichenvorrat gewechselt werden soll:

    pip install fonttools
    python3 scripts/glyphs.py

Warum ueberhaupt Umrisse und nicht `<text>` im SVG: Text in einem SVG ist
genauso auslesbar wie Text in HTML. Erst als Pfad ist die Anschrift kein
Text mehr.
"""

import unicodedata
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform
from fontTools.ttLib import TTFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
OUT = Path(__file__).resolve().parent.parent / "src" / "anschrift-glyphen.ts"

# Zielhoehe des Koordinatensystems. 1000 statt der 2048 der Schrift: auf
# ganze Zahlen gerundet bleibt das fuer eine Anschrift reichlich genau und
# halbiert die Datenmenge.
UPM = 1000

# Der Zeichenvorrat: Buchstaben und Ziffern, dazu die Satzzeichen, die in
# Namen und Anschriften wirklich auftreten. Zeichen wie $ % # @ { | ~ sind
# bewusst nicht dabei - sie kosten die groessten Pfade und kommen in keiner
# Adresse vor. Die Buchstaben des Latin-1-Nachtrags sind dagegen komplett
# drin: Umlaute und scharfes S braucht schon diese Seite, Akzente die
# naechste Anschrift vielleicht.
PUNCTUATION = " '(),-./&:"
CHARS = list(PUNCTUATION)
CHARS += [chr(c) for c in range(0x30, 0x3A)]
CHARS += [chr(c) for c in range(0x41, 0x5B)]
CHARS += [chr(c) for c in range(0x61, 0x7B)]
CHARS += [
    chr(c)
    for c in range(0xC0, 0x100)
    if unicodedata.category(chr(c)).startswith("L")
]


def main() -> None:
    font = TTFont(FONT)
    glyphs = font.getGlyphSet()
    cmap = font.getBestCmap()
    upm = font["head"].unitsPerEm
    scale = UPM / upm

    # Y nach oben in der Schrift, Y nach unten im SVG - der Flip steckt
    # hier, damit der Worker die Pfade unveraendert einsetzen kann.
    transform = Transform(scale, 0, 0, -scale, 0, 0)

    rows = []
    missing = []
    for char in CHARS:
        name = cmap.get(ord(char))
        if name is None:
            missing.append(char)
            continue
        pen = SVGPathPen(glyphs, ntos=lambda v: str(round(v)))
        glyphs[name].draw(TransformPen(pen, transform))
        rows.append((char, round(glyphs[name].width * scale), pen.getCommands()))

    ascender = round(font["hhea"].ascender * scale)
    descender = round(font["hhea"].descender * scale)

    body = "\n".join(
        f"  {json_key(char)}: [{advance}, {ts_string(path)}]," for char, advance, path in rows
    )

    OUT.write_text(
        HEADER.format(upm=UPM, ascender=ascender, descender=descender, body=body),
        encoding="utf-8",
    )

    data = OUT.read_text(encoding="utf-8")
    print(f"src/{OUT.name}: {len(rows)} Glyphen, {len(data) / 1024:.1f} KiB")
    if missing:
        print("fehlen in der Schrift:", " ".join(missing))


def json_key(char: str) -> str:
    return '"' + char.replace("\\", "\\\\").replace('"', '\\"') + '"'


def ts_string(path: str) -> str:
    return '"' + path.replace("\\", "\\\\").replace('"', '\\"') + '"'


HEADER = '''/**
 * Zeichenumrisse fuer das Anschrift-Bild. ERZEUGT - nicht von Hand aendern,
 * sondern `python3 scripts/glyphs.py` laufen lassen.
 *
 * Je Zeichen: Vorschubbreite und der SVG-Pfad, beides in einem
 * Koordinatensystem von {upm} Einheiten je Em, Y nach unten.
 *
 * Schrift: DejaVu Sans.
 *
 * Copyright (c) 2003 by Bitstream, Inc. All Rights Reserved. Bitstream Vera
 * is a trademark of Bitstream, Inc. Permission is hereby granted, free of
 * charge, to any person obtaining a copy of the fonts accompanying this
 * license ("Fonts") and associated documentation files (the "Font
 * Software"), to reproduce and distribute the Font Software, including
 * without limitation the rights to use, copy, merge, publish, distribute,
 * and/or sell copies of the Font Software, and to permit persons to whom the
 * Font Software is furnished to do so, subject to the following conditions:
 * The above copyright and trademark notices and this permission notice shall
 * be included in all copies of one or more of the Font Software typefaces.
 * The Font Software may be modified, altered, or added to, and in particular
 * the designs of glyphs or characters in the Fonts may be modified and
 * additional glyphs or characters may be added to the Fonts, only if the
 * fonts are renamed to names not containing either the words "Bitstream" or
 * the word "Vera". THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY
 * OF ANY KIND, EXPRESS OR IMPLIED.
 */

/** Einheiten je Em, in denen die Pfade notiert sind. */
export const UPM = {upm};

/** Oberlaenge und Unterlaenge der Schrift, fuer die Hoehe der Zeilen. */
export const ASCENDER = {ascender};
export const DESCENDER = {descender};

/** Zeichen -> [Vorschubbreite, SVG-Pfad]. */
export const GLYPHS: Record<string, [number, string]> = {{
{body}
}};
'''


if __name__ == "__main__":
    main()
