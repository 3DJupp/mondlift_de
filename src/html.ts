/**
 * Maskierung für Text, den der Worker selbst in HTML schreibt.
 *
 * Gebraucht wird das für Glossar und FAQ: deren Text steht als Daten in
 * src/ und wird serverseitig zu Markup. Die Werte kommen aus dem eigenen
 * Repo und enthalten nichts Gefährliches - das hier ist die Zusicherung,
 * dass ein Ampersand oder eine spitze Klammer im Text auch morgen noch
 * als Zeichen und nicht als Markup ankommt.
 */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ENTITIES[char] ?? char);
}

/** Aus einem Stichwort eine Sprungmarke machen: "g-Kraft" -> "g-kraft". */
export function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
