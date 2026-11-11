/**
 * Security-Header fuer jede Antwort des Workers.
 *
 * Die CSP ist absichtlich eng: alles von der eigenen Origin, keine Inline-
 * Skripte, keine Inline-Styles. Ausnahmen sind Cloudflare Turnstile auf der
 * Kontaktseite (ein Skript und ein iframe), three.js von jsDelivr fuer die
 * 3D-Szene und - nur wenn eine Mess-ID gesetzt ist - Google Analytics.
 *
 * Dazu kommen die Hashes, die `scriptHashes` mitbringt: die Inhaltsseiten
 * tragen einen JSON-LD-Block, und der ist technisch ein Inline-Skript.
 * Erlaubt wird deshalb nicht `'unsafe-inline'`, sondern genau dieser eine
 * Block - der Hash wird im Worker ueber dieselbe Zeichenkette gerechnet,
 * die er ausliefert, siehe src/strukturierte-daten.ts. Seiten ohne Block
 * bekommen auch keinen Hash.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

/** Optionen fuer `withSecurityHeaders`. */
export interface HeaderOptions {
  /**
   * Zusaetzliche Quellen fuer `script-src`, schon in CSP-Form
   * (`'sha256-...'`).
   */
  scriptHashes?: readonly string[];
  /**
   * Google Analytics ist eingerichtet. Dann darf die Seite das Skript von
   * Google laden und Messdaten dorthin schicken - geladen wird es trotzdem
   * erst nach Einwilligung, siehe public/assets/js/einwilligung.js.
   */
  analytics?: boolean;
  /**
   * Die Antwort darf von fremden Seiten als Bild oder Video eingebunden
   * werden. Gilt nur fuer das Vorschauvideo, siehe src/video.ts.
   */
  einbindbar?: boolean;
}

/**
 * Die Richtlinie fuer eine Antwort. Ohne Analytics bleibt sie so eng wie
 * zuvor; mit Analytics kommen genau die Quellen dazu, die Google fuer GA4
 * angibt.
 */
function csp({ scriptHashes = [], analytics = false }: HeaderOptions): string {
  const script = [
    "'self'",
    TURNSTILE_ORIGIN,
    "https://cdn.jsdelivr.net",
    ...(analytics ? ANALYTICS_SCRIPT : []),
    ...scriptHashes,
  ].join(" ");
  const img = ["'self'", ...(analytics ? ANALYTICS_CONNECT : [])].join(" ");
  const connect = ["'self'", ...(analytics ? ANALYTICS_CONNECT : [])].join(" ");
  return [
    "default-src 'self'",
    `script-src ${script}`,
    "style-src 'self'",
    `img-src ${img}`,
    "font-src 'self'",
    `connect-src ${connect}`,
    `frame-src ${TURNSTILE_ORIGIN}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

/** GA4: woher das Skript kommt. */
const ANALYTICS_SCRIPT = ["https://*.googletagmanager.com"];

/** GA4: wohin Messdaten gehen (als Abruf oder als Zaehlpixel). */
const ANALYTICS_CONNECT = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
];

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
 * Ohne `options` bleibt die Richtlinie die enge Grundfassung.
 *
 * Nicht jede Antwort kommt hier vorbei: CSS, JS, Bilder und das Favicon
 * liefert Cloudflare direkt aus, ohne den Worker zu starten (siehe
 * `run_worker_first` in wrangler.jsonc). Deren Header stehen in
 * public/_headers - wer hier etwas aendert, prueft auch dort.
 */
export function withSecurityHeaders(
  response: Response,
  url: URL,
  options: HeaderOptions = {},
): Response {
  const headers = new Headers(response.headers);

  headers.set("Content-Security-Policy", csp(options));
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", PERMISSIONS_POLICY);
  headers.set("X-Frame-Options", "DENY");
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set(
    "Cross-Origin-Resource-Policy",
    options.einbindbar ? "cross-origin" : "same-origin",
  );

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
