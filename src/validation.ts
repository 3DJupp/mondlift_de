/**
 * Prüfung der Formularfelder.
 *
 * Bewusst streng und bewusst ohne Bibliothek: drei Felder, feste Längen,
 * klare Fehlertexte. Die Texte sind für Besucher gedacht und verraten nichts
 * über die Innereien.
 */

/** Längengrenzen in Zeichen. */
export const LIMITS = {
  name: 80,
  email: 160,
  message: 4000,
} as const;

export interface ContactInput {
  name: string;
  email: string;
  message: string;
}

/**
 * Alles, was wir von den Formulardaten brauchen. FormData und
 * URLSearchParams erfüllen das beide, und ein schlichtes Objekt im Test
 * ebenfalls - ohne Cast.
 */
export interface FieldSource {
  get(name: string): unknown;
}

export type ValidationResult =
  | { ok: true; value: ContactInput }
  | { ok: false; reason: ValidationReason };

/** Gründe, die auch als ?status= in der URL auftauchen dürfen. */
export type ValidationReason = "ungueltig" | "spam";

/**
 * Entfernt Steuerzeichen und begrenzt die Länge.
 *
 * Zeilenumbrüche fliegen aus Name und E-Mail raus, weil beide in
 * Mail-Kopfzeilen landen könnten. Das Binding baut die Nachricht zwar selbst
 * zusammen, aber Header-Injection schließt man besser an der Quelle aus.
 */
function clean(raw: unknown, max: number, keepNewlines = false): string {
  if (typeof raw !== "string") return "";
  const stripped = keepNewlines
    ? raw.replace(/\r\n?/g, "\n").replace(/[^\P{C}\n]/gu, "")
    : raw.replace(/\p{C}/gu, " ");
  return stripped.trim().slice(0, max);
}

/** Pragmatische E-Mail-Prüfung: genau ein @, beidseitig etwas, Punkt danach. */
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(value);
}

/**
 * Liest und prüft die Formulardaten.
 *
 * Das Honigtopf-Feld muss leer bleiben. Echte Besucher sehen es nicht,
 * einfache Bots füllen alles aus.
 */
export function validateContact(form: FieldSource): ValidationResult {
  if (clean(form.get("website"), 200) !== "") {
    return { ok: false, reason: "spam" };
  }

  const name = clean(form.get("name"), LIMITS.name);
  const email = clean(form.get("email"), LIMITS.email);
  const message = clean(form.get("message"), LIMITS.message, true);

  if (name.length < 2) return { ok: false, reason: "ungueltig" };
  if (!looksLikeEmail(email)) return { ok: false, reason: "ungueltig" };
  if (message.length < 10) return { ok: false, reason: "ungueltig" };

  return { ok: true, value: { name, email, message } };
}
