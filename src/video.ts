/**
 * Liefert das Vorschauvideo unter /video/ aus - mit Teilabrufen.
 *
 * Warum das nicht einfach eine Datei unter /assets/ ist: Cloudflare
 * beantwortet eine Anfrage mit `Range` an ein Static Asset mit `200` und
 * der ganzen Datei, ohne `Accept-Ranges`. Safari und alles, was auf Apples
 * Abspieler aufsetzt, spielt ein Video aber nur ab, wenn der Server
 * Teilstuecke liefern kann. Der Worker holt die Datei deshalb aus dem
 * Asset-Binding und schneidet das verlangte Stueck selbst heraus.
 *
 * Die Datei ist klein (rund 1,5 MB), sie ganz in den Speicher zu lesen ist
 * billiger als jede Loesung mit Streams. Fuer grosse Videos waere das der
 * falsche Weg.
 */

export const VIDEO_PREFIX = "/video/";

/** Ein Bereich in Bytes, beide Grenzen eingeschlossen. */
interface ByteRange {
  start: number;
  end: number;
}

/**
 * Liest `Range: bytes=...` fuer eine Datei der Laenge `length`.
 *
 * `null` heisst: kein auswertbarer Bereich, die ganze Datei schicken. So
 * verlangt es RFC 9110 fuer alles, was der Server nicht versteht - dazu
 * zaehlen hier auch mehrere Bereiche auf einmal, die kein Abspieler braucht.
 * `"unsatisfiable"` heisst: verstanden, aber ausserhalb der Datei.
 */
export function parseRange(
  header: string | null,
  length: number,
): ByteRange | null | "unsatisfiable" {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!match) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;

  // "-500": die letzten 500 Bytes.
  if (first === "") {
    const count = Number(last);
    if (count === 0 || length === 0) return "unsatisfiable";
    return { start: Math.max(0, length - count), end: length - 1 };
  }

  const start = Number(first);
  if (start >= length) return "unsatisfiable";
  const end = last === "" ? length - 1 : Math.min(Number(last), length - 1);
  if (end < start) return null;
  return { start, end };
}

/**
 * Antwortet auf GET und HEAD fuer eine Datei unter /video/. `null` heisst:
 * die Datei gibt es nicht, der Aufrufer liefert die uebliche 404-Seite.
 */
export async function handleVideo(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response | null> {
  // Das Binding bekommt die Anfrage ohne Range und ohne Query, aber mit
  // If-None-Match - ein 304 soll es weiter selbst beantworten.
  const assetUrl = new URL(url);
  assetUrl.search = "";
  const forwarded = new Headers(request.headers);
  forwarded.delete("range");
  forwarded.delete("if-range");
  const asset = await env.ASSETS.fetch(
    new Request(assetUrl, { method: "GET", headers: forwarded }),
  );
  if (asset.status === 304) return asset;
  if (asset.status !== 200) return null;

  const content = await asset.arrayBuffer();
  const headers = new Headers(asset.headers);
  headers.set("accept-ranges", "bytes");
  headers.delete("content-encoding");

  // If-Range: das Teilstueck gilt nur, wenn der Client noch denselben Stand
  // hat. Sonst bekommt er die ganze Datei neu.
  const ifRange = request.headers.get("if-range");
  const sameVersion = ifRange === null || ifRange === asset.headers.get("etag");
  const range = sameVersion
    ? parseRange(request.headers.get("range"), content.byteLength)
    : null;

  if (range === "unsatisfiable") {
    headers.set("content-range", `bytes */${content.byteLength}`);
    headers.delete("content-type");
    return new Response(null, { status: 416, headers });
  }

  const chunk =
    range === null ? content : content.slice(range.start, range.end + 1);
  headers.set("content-length", String(chunk.byteLength));
  if (range !== null) {
    headers.set(
      "content-range",
      `bytes ${range.start}-${range.end}/${content.byteLength}`,
    );
  }

  return new Response(request.method === "HEAD" ? null : chunk, {
    status: range === null ? 200 : 206,
    headers,
  });
}
