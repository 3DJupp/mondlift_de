/**
 * Serverseitige Prüfung eines Turnstile-Tokens.
 *
 * Geprüft wird nicht nur success, sondern auch die Aktion und der Hostname,
 * von dem das Token stammt. Sonst ließe sich ein Token, das auf einer
 * anderen Seite desselben Widgets erzeugt wurde, hier einlösen.
 *
 * Im Fehlerfall wird zugemacht, nicht aufgemacht: Ist Siteverify nicht
 * erreichbar oder antwortet seltsam, gilt das Token als ungültig.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Vereinbarte Aktion. Muss zum data-action im Formular passen. */
export const CONTACT_ACTION = "kontakt";

const MAX_TOKEN_LENGTH = 2048;
const TIMEOUT_MS = 10_000;

interface SiteverifyResponse {
  success?: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

/**
 * Prüft ein Token. expectedHostname ist der Host, unter dem die Seite
 * ausgeliefert wurde - bei einer Ein-Domain-Seite genau der richtige Wert.
 */
export async function verifyTurnstile(
  token: string,
  secret: string,
  expectedHostname: string,
  remoteIp: string | null,
): Promise<boolean> {
  if (token.length === 0 || token.length > MAX_TOKEN_LENGTH) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  let result: SiteverifyResponse;
  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return false;
    result = (await response.json()) as SiteverifyResponse;
  } catch {
    // Netzfehler, Zeitüberschreitung oder keine gültige Antwort: zumachen.
    return false;
  }

  return (
    result.success === true &&
    result.action === CONTACT_ACTION &&
    result.hostname === expectedHostname
  );
}
