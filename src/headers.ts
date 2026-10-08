/**
 * Security-Header fuer jede Antwort des Workers.
 *
 * Die CSP ist absichtlich eng: alles von der eigenen Origin, keine Inline-
 * Skripte, keine Inline-Styles. Einzige Ausnahme ist Cloudflare Turnstile
 * auf der Kontaktseite - dafuer sind ein Skript und ein iframe noetig.
 *
 * Dazu kommen die Hashes, die `scriptHashes` mitbringt: die Inhaltsseiten
 * tragen einen JSON-LD-Block, und der ist technisch ein Inline-Skript.
 * Erlaubt wird deshalb nicht `'unsafe-inline'`, sondern genau dieser eine
 * Block - der Hash wird im Worker ueber dieselbe Zeichenkette gerechnet,
 * die er ausliefert, siehe src/strukturierte-daten.ts. Seiten ohne Block
 * bekommen auch keinen Hash.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/**
 * Die Richtlinie fuer eine Antwort. `scriptHashes` sind zusaetzliche
 * Quellen fuer `script-src`, schon in CSP-Form (`'sha256-...'`).
 */
function csp(scriptHashes: readonly string[]): string {
  const script = ["'self'", TURNSTILE_ORIGIN, ...scriptHashes].join(" ");
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "connect-src 'self'",
    `frame-src ${TURNSTILE_ORIGIN}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const PERMISSIONS_POLICY = [
  "accelerometer=()",
  "camera=()",
  "display-capture=()",
  "geolocation=()",
  "gyroscope=()",
  "magnetometer=()",
  "microphone=()",
  "payment=()",
  "usb=()",
].join(", ");

/**
 * Legt die Security-Header auf eine Antwort. Die Antwort wird kopiert, weil
 * Header von Asset-Antworten immutable sind.
 *
 * `scriptHashes` sind zusaetzliche Quellen fuer `script-src`, in CSP-Form
 * (`'sha256-...'`). Ohne Angabe bleibt die Richtlinie wie bisher.
 */
export function withSecurityHeaders(
  response: Response,
  url: URL,
  scriptHashes: readonly string[] = [],
): Response {
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", csp(scriptHashes));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");

  // HSTS nur ueber HTTPS, damit lokales `wrangler dev` auf http nicht
  // dauerhaft im Browser-Cache landet.
  if (url.protocol === "https:") {
    headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
