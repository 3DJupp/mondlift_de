/**
 * Security-Header fuer jede Antwort des Workers.
 *
 * Die CSP ist absichtlich eng: alles von der eigenen Origin, keine Inline-
 * Skripte, keine Inline-Styles. Einzige Ausnahme ist Cloudflare Turnstile
 * auf der Kontaktseite - dafuer sind ein Skript und ein iframe noetig.
 */

const TURNSTILE_ORIGIN = "https://challenges.cloudflare.com";

const CSP = [
  "default-src 'self'",
  `script-src 'self' ${TURNSTILE_ORIGIN}`,
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
 */
/**
 * Setzt Cache-Zeiten nach Dateityp.
 *
 * Ohne das liefert das Asset-Binding alles mit max-age=0 aus, und das
 * Three.js-Bündel von rund 570 KB würde bei jedem Seitenaufruf neu geholt.
 * HTML bleibt ungecacht, damit Textänderungen sofort sichtbar sind; der
 * ETag sorgt dort trotzdem für kurze Antworten.
 */
function cacheFor(pathname: string): string | null {
  if (/\.(js|css|woff2?)$/.test(pathname)) {
    // Kein Dateiname mit Inhaltshash, deshalb nur ein Tag fest und danach
    // Nachfragen beim Server erlaubt.
    return "public, max-age=86400, stale-while-revalidate=604800";
  }
  if (/\.(png|jpe?g|svg|webp|avif|ico)$/.test(pathname)) {
    return "public, max-age=604800, stale-while-revalidate=2592000";
  }
  if (/\.(xml|txt)$/.test(pathname)) {
    return "public, max-age=3600";
  }
  return null;
}

export function withSecurityHeaders(response: Response, url: URL): Response {
  const headers = new Headers(response.headers);

  const cache = cacheFor(url.pathname);
  if (cache && response.ok) headers.set("Cache-Control", cache);

  headers.set("Content-Security-Policy", CSP);
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
