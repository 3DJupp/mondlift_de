/**
 * POST /api/contact
 *
 * Ablauf: Rate Limit, Felder prüfen, Turnstile prüfen, Mail zustellen.
 *
 * Zwei Dinge sind hier bewusst entschieden:
 *
 * 1. Turnstile braucht JavaScript, um überhaupt ein Token zu erzeugen. Das
 *    Formular soll aber auch ohne JavaScript funktionieren. Deshalb gibt es
 *    zwei Wege: mit Token wird streng geprüft, ohne Token greift ein engeres
 *    Rate Limit. Wer das nicht will, setzt REQUIRE_TURNSTILE auf true -
 *    dann sind Einsendungen ohne JavaScript nicht mehr möglich.
 *
 * 2. Die Absenderadresse der Mail ist immer die eigene Domain, niemals die
 *    des Besuchers. Sonst würde die Mail als Fälschung aussehen und an SPF
 *    und DMARC scheitern. Die Adresse des Besuchers steht in Reply-To, man
 *    kann also einfach antworten.
 */

import { validateContact, LIMITS } from "./validation";
import { verifyTurnstile } from "./turnstile";

/**
 * Auf true setzen, um Einsendungen ohne gültiges Turnstile-Token
 * abzulehnen. Das schaltet zugleich den Weg ohne JavaScript ab.
 */
const REQUIRE_TURNSTILE = false;

/** Größte zulässige Menge an Formulardaten, bevor abgebrochen wird. */
const MAX_BODY_BYTES = 16_000;

/** Rückmeldungen an den Besucher. Bewusst ohne interne Details. */
const MESSAGES = {
  ok: "Danke, die Nachricht ist angekommen.",
  ungueltig:
    "Bitte Name, E-Mail-Adresse und eine Nachricht von mindestens zehn Zeichen angeben.",
  spam: "Die Nachricht konnte nicht zugestellt werden.",
  zuviel: "Zu viele Versuche. Bitte in einer Minute noch einmal probieren.",
  fehler: "Das hat gerade nicht geklappt. Bitte später noch einmal versuchen.",
} as const;

type Status = keyof typeof MESSAGES;

const HTTP_STATUS: Record<Status, number> = {
  ok: 200,
  ungueltig: 400,
  spam: 403,
  zuviel: 429,
  fehler: 502,
};

/** Fragt einen Rate Limiter ab und lässt bei fehlendem Binding durch. */
async function withinLimit(
  limiter: RateLimit | undefined,
  key: string,
): Promise<boolean> {
  if (!limiter) return true;
  const { success } = await limiter.limit({ key });
  return success;
}

/**
 * Prüft, ob alles da ist, was zum Zustellen gebraucht wird.
 *
 * Fehlt etwas, ist das ein Konfigurationsfehler des Betreibers und keiner
 * des Besuchers. Nach außen gibt es dafür nur die allgemeine Meldung; was
 * genau fehlt, steht ausschließlich im Log.
 *
 * @returns Beschreibung des Problems fürs Log, oder null wenn alles passt.
 */
function missingConfig(env: Env): string | null {
  if (typeof env.CONTACT_MAILER?.send !== "function") return "CONTACT_MAILER";
  if (!env.CONTACT_TO_EMAIL) return "CONTACT_TO_EMAIL";
  if (!env.CONTACT_FROM_EMAIL) return "CONTACT_FROM_EMAIL";
  return null;
}

export async function handleContact(
  request: Request,
  env: Env,
): Promise<Status> {
  const url = new URL(request.url);
  const ip = request.headers.get("cf-connecting-ip") ?? "unbekannt";

  // Vor aller Arbeit: kann das Formular überhaupt zustellen?
  const missing = missingConfig(env);
  if (missing) {
    console.error(JSON.stringify({ event: "contact_not_configured", missing }));
    return "fehler";
  }

  // Rate Limit zuerst: schützt auch vor dem Aufwand des Rests.
  if (!(await withinLimit(env.CONTACT_RATE_LIMIT, ip))) return "zuviel";

  const type = request.headers.get("content-type") ?? "";
  if (
    !type.includes("application/x-www-form-urlencoded") &&
    !type.includes("multipart/form-data")
  ) {
    return "ungueltig";
  }

  // Vor dem Einlesen abschätzen, damit ein riesiger Rumpf nicht erst
  // vollständig im Speicher landet.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return "ungueltig";
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return "ungueltig";
  }

  const checked = validateContact(form);
  if (!checked.ok) return checked.reason;
  const { name, email, message } = checked.value;

  // --- Turnstile ---------------------------------------------------------
  const token = form.get("cf-turnstile-response");
  const secret = env.TURNSTILE_SECRET_KEY;

  if (typeof token === "string" && token.length > 0) {
    if (!secret) {
      // Ein Token kam an, aber es gibt nichts, womit man es prüfen könnte.
      console.error(
        JSON.stringify({ event: "turnstile_secret_missing", path: url.pathname }),
      );
      return "fehler";
    }
    const valid = await verifyTurnstile(token, secret, url.hostname, ip);
    if (!valid) return "spam";
  } else {
    // Kein Token: entweder kein JavaScript oder ein einfacher Bot.
    if (REQUIRE_TURNSTILE) return "spam";
    if (!(await withinLimit(env.CONTACT_RATE_LIMIT_STRICT, ip))) return "zuviel";
  }

  // --- Zustellung --------------------------------------------------------
  const body = [
    `Name:    ${name}`,
    `E-Mail:  ${email}`,
    `Absender-IP: ${ip}`,
    `Geprüft: ${typeof token === "string" && token.length > 0 ? "Turnstile" : "nur Rate Limit (ohne JavaScript gesendet)"}`,
    "",
    "Nachricht:",
    message,
  ].join("\n");

  // missingConfig() hat beide Adressen bereits geprüft.
  const toAddress = env.CONTACT_TO_EMAIL as string;
  const fromAddress = env.CONTACT_FROM_EMAIL as string;

  try {
    await env.CONTACT_MAILER.send({
      to: toAddress,
      from: { email: fromAddress, name: "Mondlift Kontaktformular" },
      replyTo: { email, name },
      subject: `Kontaktformular mondlift.de: ${name}`.slice(0, 120),
      text: body,
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "contact_send_failed",
        code:
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : undefined,
        message: error instanceof Error ? error.message : String(error),
      }),
    );
    return "fehler";
  }

  return "ok";
}

/** JSON-Antwort für den Weg mit JavaScript. */
export function contactJson(status: Status): Response {
  return Response.json(
    { ok: status === "ok", status, message: MESSAGES[status] },
    { status: HTTP_STATUS[status] },
  );
}

/** Weiterleitung auf die Seite für den Weg ohne JavaScript. */
export function contactRedirect(status: Status, url: URL): Response {
  const target = new URL("/kontakt", url);
  target.searchParams.set("status", status);
  target.hash = "formular";
  return new Response(null, {
    status: 303,
    headers: { location: target.toString() },
  });
}

export { MESSAGES, LIMITS };
export type { Status };
