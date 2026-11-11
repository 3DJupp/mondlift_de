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
interface Bereich {
  von: number;
  bis: number;
}

/**
 * Liest `Range: bytes=...` fuer eine Datei der Laenge `laenge`.
 *
 * `null` heisst: kein auswertbarer Bereich, die ganze Datei schicken. So
 * verlangt es RFC 9110 fuer alles, was der Server nicht versteht - dazu
 * zaehlen hier auch mehrere Bereiche auf einmal, die kein Abspieler braucht.
 * `"unerfuellbar"` heisst: verstanden, aber ausserhalb der Datei.
 */
export function leseBereich(
  kopf: string | null,
  laenge: number,
): Bereich | null | "unerfuellbar" {
  const treffer = /^bytes=(\d*)-(\d*)$/.exec(kopf?.trim() ?? "");
  if (!treffer) return null;
  const [, anfang = "", ende = ""] = treffer;
  if (anfang === "" && ende === "") return null;

  // "-500": die letzten 500 Bytes.
  if (anfang === "") {
    const anzahl = Number(ende);
    if (anzahl === 0 || laenge === 0) return "unerfuellbar";
    return { von: Math.max(0, laenge - anzahl), bis: laenge - 1 };
  }

  const von = Number(anfang);
  if (von >= laenge) return "unerfuellbar";
  const bis = ende === "" ? laenge - 1 : Math.min(Number(ende), laenge - 1);
  if (bis < von) return null;
  return { von, bis };
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
  const kopf = new Headers(request.headers);
  kopf.delete("range");
  kopf.delete("if-range");
  const asset = await env.ASSETS.fetch(
    new Request(assetUrl, { method: "GET", headers: kopf }),
  );
  if (asset.status === 304) return asset;
  if (asset.status !== 200) return null;

  const inhalt = await asset.arrayBuffer();
  const headers = new Headers(asset.headers);
  headers.set("accept-ranges", "bytes");
  headers.delete("content-encoding");

  // If-Range: das Teilstueck gilt nur, wenn der Client noch denselben Stand
  // hat. Sonst bekommt er die ganze Datei neu.
  const ifRange = request.headers.get("if-range");
  const gleicherStand = ifRange === null || ifRange === asset.headers.get("etag");
  const bereich = gleicherStand
    ? leseBereich(request.headers.get("range"), inhalt.byteLength)
    : null;

  if (bereich === "unerfuellbar") {
    headers.set("content-range", `bytes */${inhalt.byteLength}`);
    headers.delete("content-type");
    return new Response(null, { status: 416, headers });
  }

  const stueck =
    bereich === null ? inhalt : inhalt.slice(bereich.von, bereich.bis + 1);
  headers.set("content-length", String(stueck.byteLength));
  if (bereich !== null) {
    headers.set(
      "content-range",
      `bytes ${bereich.von}-${bereich.bis}/${inhalt.byteLength}`,
    );
  }

  return new Response(request.method === "HEAD" ? null : stueck, {
    status: bereich === null ? 200 : 206,
    headers,
  });
}
