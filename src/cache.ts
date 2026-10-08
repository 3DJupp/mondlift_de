/**
 * Cache-Validierung für die Dateien, die der Worker selbst erzeugt:
 * sitemap.xml, das Anschriftsbild und die IndexNow-Schlüsseldatei.
 *
 * Alle drei ändern sich nur mit einem Deploy. Ohne ETag lädt jeder Abruf den
 * vollen Inhalt neu, obwohl sich nichts geändert hat — Googlebot sieht die
 * Sitemap regelmäßig nach, Browser laden das Anschriftsbild bei jedem Besuch
 * des Impressums. Mit ETag beantwortet der Worker ein passendes
 * `If-None-Match` mit `304 Not Modified` und ohne Rumpf.
 *
 * Nebeneffekt, der fast so viel wert ist: der Inhalt wird einmal pro Isolate
 * erzeugt statt einmal pro Anfrage. Beim Anschriftsbild heißt das, die
 * Glyphenumrisse werden nicht bei jedem Aufruf neu zusammengesetzt.
 */

/** Eine erzeugte Datei, die ihren eigenen Stand kennt. */
export interface GeneratedFile {
  /** Antwort auf eine Anfrage — 304, wenn der Client den Stand schon hat. */
  respond(request: Request): Response;
}

/**
 * FNV-1a über den Inhalt, davor die Länge in Bytes.
 *
 * Ein ETag ist eine Kennung, keine Signatur: er muss sich ändern, wenn sich
 * der Inhalt ändert, und muss nicht fälschungssicher sein. Die Länge steht
 * mit davor, damit zwei verschiedene Inhalte denselben ETag nur bekommen,
 * wenn zusätzlich zur Hash-Kollision auch die Byte-Länge übereinstimmt.
 *
 * Schwach (`W/`), weil der Vergleich sich auf den Inhalt bezieht und nicht
 * auf eine byte-genaue Übertragung — mehr verlangt `If-None-Match` nicht.
 */
function weakEtag(body: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < body.length; index += 1) {
    hash ^= body.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  const bytes = new TextEncoder().encode(body).length;
  return `W/"${bytes.toString(16)}-${(hash >>> 0).toString(16)}"`;
}

/** Entfernt die Kennzeichnung als schwacher ETag. */
function opaque(value: string): string {
  return value.trim().replace(/^W\//, "");
}

/**
 * Schwacher Vergleich nach RFC 9110: `If-None-Match` darf eine Liste
 * enthalten, `*` passt immer, und das `W/` zählt beim Vergleich nicht mit.
 */
function isCurrent(header: string | null, etag: string): boolean {
  if (header === null) return false;
  if (header.trim() === "*") return true;
  const own = opaque(etag);
  return header.split(",").some((candidate) => opaque(candidate) === own);
}

/**
 * Bindet einen Erzeuger an Content-Type und Cache-Dauer. `build` läuft beim
 * ersten Abruf und danach nicht mehr.
 */
export function generatedFile(
  build: () => string,
  contentType: string,
  maxAge: number,
): GeneratedFile {
  const cacheControl = `public, max-age=${maxAge}`;
  let state: { body: string; etag: string } | null = null;

  return {
    respond(request: Request): Response {
      if (state === null) {
        const body = build();
        state = { body, etag: weakEtag(body) };
      }

      // Die Header gehören auch an die 304: ohne ETag und Cache-Control
      // dort verliert der Client die Angaben, mit denen er das nächste Mal
      // wieder fragen kann.
      const headers = {
        etag: state.etag,
        "cache-control": cacheControl,
      };

      if (isCurrent(request.headers.get("if-none-match"), state.etag)) {
        return new Response(null, { status: 304, headers });
      }

      return new Response(state.body, {
        headers: { ...headers, "content-type": contentType },
      });
    },
  };
}
