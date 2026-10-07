/*
 * mondlift.de - Animation eines Huss Enterprise auf Canvas 2D.
 *
 * Modell
 * ------
 * Ein Rad mit 20 Auslegern dreht sich um seine Achse. Das ganze Rad kippt um
 * eine waagerechte Achse, die an seiner hinteren Felgenkante liegt - genau so
 * hebt sich das echte Fahrgeschaeft aus der Horizontalen in die Senkrechte.
 *
 * Gerechnet wird in Metern im Weltsystem (X rechts, Y oben, Z zum Betrachter),
 * projiziert wird mit einer leichten Zentralprojektion und einer Kamera, die
 * etwas von oben schaut. Ohne diese Kameraneigung waere das waagerechte Rad
 * eine Linie.
 *
 * Die Gondeln haengen nicht nach Gefuehl, sondern in Richtung der
 * resultierenden Kraft aus Zentrifugalkraft (radial nach aussen) und
 * Schwerkraft. Dadurch ergibt sich von selbst das richtige Bild: flach und
 * langsam haengen sie nach unten, steil und schnell stehen sie radial ab.
 *
 * Keine Libraries.
 */

(() => {
  "use strict";

  const canvas = document.getElementById("ride");
  if (!canvas) return;
  // alpha:false spart das Compositing mit transparentem Hintergrund.
  // desynchronized wird bewusst nicht gesetzt: es bringt fuer eine
  // Hintergrundanimation nichts und bricht in manchen Browsern das
  // Zusammensetzen der Ebenen.
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;

  // ---------------------------------------------------------------- Geometrie

  const DEG = Math.PI / 180;
  const G = 9.81; // m/s^2

  const ARMS = 20; // Ausleger / Gondeln
  const R = 8.0; // Radradius in m
  const PIVOT_Y = 2.6; // Hoehe der Kippachse ueber Grund in m
  const BULBS_PER_ARM = 5;

  const TILT_MIN = 10 * DEG; // nahezu waagerecht
  const TILT_MAX = 84 * DEG; // fast senkrecht
  const TILT_PERIOD = 26; // Sekunden fuer hoch und wieder runter
  const RPM_MIN = 8.5;
  const RPM_MAX = 13.5;

  const CAM_PITCH = 19 * DEG; // Blick von oben
  const FOV = 62; // Brennweite in Metern, groesser = flacher

  // Platzbedarf der ganzen Szene in Metern, bei voller Neigung gemessen.
  const SCENE_W = 21.5;
  const SCENE_H = 21.5;

  // Radtragwerk. Das echte Rad ist kein Speichenrad, sondern ein Fachwerk:
  // Hauptträger nach außen, ein innerer Ring, dazwischen Dreiecksverbände,
  // und außen eine doppelte Felge mit Querstreben.
  const RIM_INNER = 0.9; // innerer Felgenring, Anteil von R
  const RING_MID = 0.44; // innerer Ring, Anteil von R
  const RIM_LAMPS = 3; // Lampen je Felgensegment

  // Gondel als Körper in m: Breite tangential, Höhe in Hängerichtung,
  // Tiefe senkrecht dazu.
  const HANGER_LEN = 0.8;
  const CAR_W = 1.52;
  const CAR_H = 1.62;
  const CAR_D = 0.98;

  // Eine Lichtrichtung für die Flächenschattierung, grob vom Mond her.
  const LIGHT = (() => {
    const v = { x: 0.48, y: 0.78, z: 0.4 };
    const l = Math.hypot(v.x, v.y, v.z);
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  })();

  // ------------------------------------------------------------------- Zustand

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let width = 0; // CSS-Pixel
  let height = 0;
  let dpr = 1;
  let pxPerM = 20; // Skalierung Meter -> Pixel
  let originX = 0; // Bildposition des Weltnullpunkts
  let originY = 0;

  let backdrop = null; // vorgerenderte Himmelsebene
  let twinkles = []; // die wenigen funkelnden Sterne

  let spin = 0; // aufsummierter Drehwinkel in rad
  let clock = 0; // Animationszeit in s
  let lastFrame = 0;
  let rafId = 0;
  let running = false;

  // Adaptive Aufloesung: Wenn die Bilder zu lange brauchen, wird die
  // Zeichenflaeche verkleinert. Das Bild bleibt gleich, nur etwas weicher.
  const QUALITY_STEPS = [1, 0.75, 0.55];
  let qualityStep = 0;
  let frameTimes = [];

  // ------------------------------------------------------- Hilfen und Mathe

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
  const smoothstep = (t) => t * t * (3 - 2 * t);

  /** Deterministischer Zufall, damit das Sternbild bei Resize stabil bleibt. */
  function makeRandom(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  const cosCam = Math.cos(CAM_PITCH);
  const sinCam = Math.sin(CAM_PITCH);

  /**
   * Weltpunkt -> Bildpunkt.
   *
   * p ist der Massstab an dieser Tiefe, also Pixel pro Meter - inklusive
   * pxPerM. Eine Laenge von L Metern am Punkt ist damit L * p Pixel breit;
   * ein zusaetzliches pxPerM davor waere doppelt gerechnet.
   * z ist die Kameratiefe, groesser bedeutet naeher am Betrachter.
   */
  function project(x, y, z) {
    const yc = y * cosCam - z * sinCam;
    const zc = y * sinCam + z * cosCam;
    const p = (FOV / (FOV - zc)) * pxPerM;
    return { x: originX + x * p, y: originY - yc * p, p, z: zc };
  }

  /** Zeigt eine Flächennormale zur Kamera? Entscheidet über sichtbare Seiten. */
  function facesCamera(n) {
    return n.y * sinCam + n.z * cosCam > 0;
  }

  /**
   * Einfache Schattierung einer Fläche: Grundhelligkeit plus Anteil, der von
   * der Lichtrichtung abhängt. Billiger als ein Verlauf pro Fläche und sorgt
   * dafür, dass der Körper als Körper lesbar ist.
   */
  function shade(n, base) {
    const d = n.x * LIGHT.x + n.y * LIGHT.y + n.z * LIGHT.z;
    const f = 0.42 + 0.58 * Math.max(0, d);
    return `rgb(${Math.round(base[0] * f)},${Math.round(base[1] * f)},${Math.round(base[2] * f)})`;
  }

  /** Kreuzprodukt, normiert. */
  function cross(a, b) {
    const x = a.y * b.z - a.z * b.y;
    const y = a.z * b.x - a.x * b.z;
    const z = a.x * b.y - a.y * b.x;
    const l = Math.hypot(x, y, z) || 1;
    return { x: x / l, y: y / l, z: z / l };
  }

  /** Linie zwischen zwei Bildpunkten. */
  function line(a, b, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, width);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  /** Viereck als Pfad anlegen. */
  function quadPath(a, b, c, d) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
  }

  const mix = (a, b, f) => ({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f });

  // -------------------------------------------------------------- Himmelsebene

  /**
   * Himmel, Mond, Sterne und Horizont aendern sich nicht. Sie werden einmal
   * pro Resize in ein Offscreen-Canvas gemalt und danach pro Bild mit einem
   * einzigen drawImage gezeichnet.
   */
  function buildBackdrop() {
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(width * dpr));
    c.height = Math.max(1, Math.round(height * dpr));
    const g = c.getContext("2d");
    if (!g) return null;
    g.scale(dpr, dpr);

    // Nachthimmel
    const sky = g.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#04060e");
    sky.addColorStop(0.45, "#0a1020");
    sky.addColorStop(0.82, "#121a2e");
    sky.addColorStop(1, "#1a2033");
    g.fillStyle = sky;
    g.fillRect(0, 0, width, height);

    const rnd = makeRandom(20260707);
    const short = Math.min(width, height);

    // Sterne. Die Dichte haengt an der Flaeche, damit Mobile nicht ueberladen
    // und Desktop nicht leer wirkt.
    const starCount = Math.round(clamp((width * height) / 5200, 90, 420));
    twinkles = [];
    for (let i = 0; i < starCount; i++) {
      const x = rnd() * width;
      const y = rnd() * height * 0.78;
      const depth = rnd();
      const r = 0.35 + depth * 1.0;
      // Oben dunkler Himmel, unten Lichtverschmutzung: Sterne ausblenden.
      const fade = 1 - Math.pow(y / (height * 0.82), 1.6);
      const a = (0.18 + depth * 0.55) * clamp(fade, 0, 1);
      g.globalAlpha = a;
      g.fillStyle = depth > 0.88 ? "#cfe0ff" : "#eef3ff";
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
      if (i % 24 === 0 && twinkles.length < 14) {
        twinkles.push({ x, y, r: r * 1.3, a, phase: rnd() * Math.PI * 2 });
      }
    }
    g.globalAlpha = 1;

    // Mond, oben rechts
    const moonR = clamp(short * 0.055, 22, 64);
    const mx = width - Math.max(moonR * 2.6, width * 0.16);
    const my = Math.max(moonR * 2.4, height * 0.17);

    const halo = g.createRadialGradient(mx, my, moonR * 0.8, mx, my, moonR * 7);
    halo.addColorStop(0, "rgba(198,214,255,0.16)");
    halo.addColorStop(0.35, "rgba(170,190,240,0.06)");
    halo.addColorStop(1, "rgba(150,170,220,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(mx, my, moonR * 7, 0, Math.PI * 2);
    g.fill();

    const disc = g.createRadialGradient(
      mx - moonR * 0.3,
      my - moonR * 0.35,
      moonR * 0.1,
      mx,
      my,
      moonR,
    );
    disc.addColorStop(0, "#fdfdf6");
    disc.addColorStop(0.6, "#e6e9f2");
    disc.addColorStop(1, "#b9c2d6");
    g.fillStyle = disc;
    g.beginPath();
    g.arc(mx, my, moonR, 0, Math.PI * 2);
    g.fill();

    // Krater, nur angedeutet
    g.globalAlpha = 0.1;
    g.fillStyle = "#6b7590";
    const craters = [
      [-0.3, -0.25, 0.2],
      [0.22, 0.1, 0.26],
      [-0.1, 0.42, 0.15],
      [0.42, -0.38, 0.12],
    ];
    for (const [cx, cy, cr] of craters) {
      g.beginPath();
      g.arc(mx + cx * moonR, my + cy * moonR, cr * moonR, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;

    // Horizont: eine dunkle Baumreihe, mehr nicht.
    const horizon = project(0, 0, -34);
    const hy = horizon.y;
    g.fillStyle = "#070a12";
    g.beginPath();
    g.moveTo(0, height);
    g.lineTo(0, hy);
    const step = Math.max(12, width / 60);
    for (let x = 0; x <= width + step; x += step) {
      const h = (0.4 + rnd() * 0.6) * short * 0.045;
      g.lineTo(x, hy - h);
      g.lineTo(x + step * 0.5, hy - h * 0.45);
    }
    g.lineTo(width, height);
    g.closePath();
    g.fill();

    return c;
  }

  // ------------------------------------------------------------ Lampen-Sprites

  /**
   * Gluehbirnen werden nicht pro Bild als Gradient gezeichnet, sondern aus
   * vorgerenderten Sprites gestempelt. Der Index laeuft von dunklem Amber bis
   * zu heissem Weissgelb, passend zur Helligkeit im Lauflicht.
   */
  /*
   * Gluehbirnen werden aus vorgerenderten Sprites gestempelt - und zwar
   * unskaliert. Das ist der Kern: ein skaliertes drawImage laesst den Browser
   * jedes Mal neu filtern und kostete in der Messung rund 50 ms pro Bild,
   * unskaliert sind es 0. Deshalb gibt es die Sprites in einer Groessenleiter
   * und in acht Helligkeitsstufen; gezeichnet wird in Geraetepixeln.
   * Die Deckkraft steckt mit im Sprite, damit auch globalAlpha ruhig bleibt.
   */
  const GLOW_STEPS = 8; // Helligkeitsstufen
  const GLOW_SIZES = 12; // Groessenstufen
  let glowSprites = []; // [groesse][helligkeit]
  let glowDiameter = []; // Durchmesser je Groessenstufe, in Geraetepixeln
  let glowMinD = 8;
  let glowRatio = 1.2;

  /** Ein einzelnes Glow-Sprite mit Durchmesser d und Helligkeit t (0..1). */
  function makeGlow(d, t) {
    const c = document.createElement("canvas");
    c.width = c.height = d;
    const g = c.getContext("2d");
    if (!g) return c;
    const m = d / 2;
    // Dunkel: tiefes Orange. Hell: warmes Weiss mit orangem Saum.
    const r = Math.round(lerp(190, 255, t));
    const gr = Math.round(lerp(96, 236, t));
    const b = Math.round(lerp(26, 170, t));
    const a = lerp(0.42, 1, t); // Deckkraft gleich mit einbacken
    const grad = g.createRadialGradient(m, m, 0, m, m, m);
    grad.addColorStop(0, `rgba(255,255,248,${(lerp(0.5, 1, t) * a).toFixed(3)})`);
    grad.addColorStop(0.16, `rgba(${r},${gr},${b},${(lerp(0.5, 0.95, t) * a).toFixed(3)})`);
    grad.addColorStop(
      0.45,
      `rgba(${r},${Math.round(gr * 0.7)},${Math.round(b * 0.6)},${(lerp(0.1, 0.35, t) * a).toFixed(3)})`,
    );
    grad.addColorStop(1, "rgba(120,50,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, d, d);
    return c;
  }

  /**
   * Baut die Sprites fuer den aktuellen Massstab. Die Leiter deckt genau die
   * Groessen ab, die bei dieser Fenstergroesse vorkommen koennen.
   */
  function buildGlowSprites() {
    // Kleinste Auslegerlampe bei dunkelster Stufe, groesste Felgenlampe hell.
    const minD = Math.max(4, 2 * dpr * 3.0 * Math.max(0.8, 0.075 * pxPerM * 0.8));
    const maxD = Math.max(minD * 2, 2 * dpr * 5.2 * Math.max(0.9, 0.1 * pxPerM * 1.3));
    glowMinD = minD;
    glowRatio = Math.pow(maxD / minD, 1 / (GLOW_SIZES - 1));

    glowDiameter = [];
    glowSprites = [];
    for (let si = 0; si < GLOW_SIZES; si++) {
      const d = Math.max(4, Math.round(minD * Math.pow(glowRatio, si)));
      glowDiameter.push(d);
      const row = [];
      for (let bi = 0; bi < GLOW_STEPS; bi++) {
        row.push(makeGlow(d, bi / (GLOW_STEPS - 1)));
      }
      glowSprites.push(row);
    }
  }

  /*
   * Lampen werden gesammelt und am Ende jeder Radhaelfte in einem additiven
   * Durchgang ausgegeben, statt den Zeichenmodus pro Lampe umzuschalten.
   */
  const bulbQueue = [];

  /** Merkt eine Lampe vor. radius in CSS-Pixeln, b (0..1) ist die Helligkeit. */
  function queueBulb(x, y, radius, b) {
    const step = clamp(Math.round(b * (GLOW_STEPS - 1)), 0, GLOW_STEPS - 1);
    const wanted = radius * lerp(3.0, 5.2, b) * 2 * dpr;
    const size = clamp(
      Math.round(Math.log(wanted / glowMinD) / Math.log(glowRatio)),
      0,
      GLOW_SIZES - 1,
    );
    bulbQueue.push({ x, y, size, step });
  }

  /** Gibt alle vorgemerkten Lampen aus - unskaliert, in Geraetepixeln. */
  function flushBulbs() {
    if (bulbQueue.length === 0) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < bulbQueue.length; i++) {
      const b = bulbQueue[i];
      const row = glowSprites[b.size];
      if (!row) continue;
      const half = glowDiameter[b.size] / 2;
      ctx.drawImage(row[b.step], (b.x * dpr - half) | 0, (b.y * dpr - half) | 0);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bulbQueue.length = 0;
  }

  // ------------------------------------------------------------------ Lauflicht

  /**
   * Weiche Welle, die um das Rad und die Ausleger laeuft. u ist eine Phase,
   * das Ergebnis liegt zwischen einem Grundglimmen und 1.
   */
  function chase(u) {
    const c = 0.5 + 0.5 * Math.cos(u * Math.PI * 2);
    return 0.2 + 0.8 * c * c * c * c;
  }

  // ---------------------------------------------------------- Bewegungsablauf

  /** Kippwinkel: langsam hoch, oben verweilen, langsam runter. */
  function tiltAt(time) {
    const u = (time % TILT_PERIOD) / TILT_PERIOD;
    const triangle = u < 0.5 ? u * 2 : (1 - u) * 2;
    return lerp(TILT_MIN, TILT_MAX, smoothstep(smoothstep(triangle)));
  }

  // ------------------------------------------------------------------ Zeichnen

  function drawFrame() {
    if (backdrop) {
      // 1:1 in Geraetepixeln kopieren. Mit der dpr-Transformation waere es
      // ein skalierter Blit ueber die ganze Flaeche - deutlich teurer.
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(backdrop, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    } else {
      ctx.fillStyle = "#0a1020";
      ctx.fillRect(0, 0, width, height);
    }

    const tilt = tiltAt(clock);
    const tiltNorm = (tilt - TILT_MIN) / (TILT_MAX - TILT_MIN);
    const rpm = lerp(RPM_MIN, RPM_MAX, tiltNorm);
    const omega = (rpm * Math.PI * 2) / 60; // rad/s
    const centrifugal = omega * omega * R; // m/s^2, radial nach aussen

    // Funkelnde Sterne (nur die wenigen, der Rest steckt in der Himmelsebene).
    // Eigener additiver Block, bevor das Fahrgeschaeft darueber kommt.
    if (twinkles.length) {
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = "#eaf1ff";
      for (const s of twinkles) {
        const f = 0.45 + 0.55 * Math.sin(clock * 1.4 + s.phase);
        ctx.globalAlpha = s.a * f * 0.9;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // Radbasis: beta ist die Drehung des Rades um die Weltachse X.
    // beta = 90 Grad bedeutet waagerechtes Rad, beta = 0 senkrechtes.
    const beta = Math.PI / 2 - tilt;
    const cb = Math.cos(beta);
    const sb = Math.sin(beta);

    // Einheitsvektoren der Radebene im Weltsystem
    const ex = { x: 1, y: 0, z: 0 };
    const ey = { x: 0, y: cb, z: sb };
    // Achsrichtung, die bei waagerechtem Rad nach unten zeigt
    const axis = { x: 0, y: -sb, z: cb };

    // Die Kippachse liegt an der hinteren Felgenkante, also bei Radkoordinate
    // (0, -R). Daraus folgt die Nabenposition.
    const hub = {
      x: 0,
      y: PIVOT_Y + R * ey.y,
      z: -R + R * ey.z,
    };
    const pHub = project(hub.x, hub.y, hub.z);

    /** Radkoordinate (lx, ly) -> Weltpunkt. */
    const wheelPoint = (lx, ly) => ({
      x: hub.x + lx * ex.x + ly * ey.x,
      y: hub.y + lx * ex.y + ly * ey.y,
      z: hub.z + lx * ex.z + ly * ey.z,
    });

    // --- Ausleger zu Einheiten buendeln und nach Tiefe sortieren -------------

    const units = [];
    for (let i = 0; i < ARMS; i++) {
      const theta = spin + (i / ARMS) * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);

      // Radialrichtung und Tangente in der Radebene
      const rad = {
        x: ct * ex.x + st * ey.x,
        y: ct * ex.y + st * ey.y,
        z: ct * ex.z + st * ey.z,
      };
      const tan = {
        x: -st * ex.x + ct * ey.x,
        y: -st * ex.y + ct * ey.y,
        z: -st * ex.z + ct * ey.z,
      };

      const rim = {
        x: hub.x + R * rad.x,
        y: hub.y + R * rad.y,
        z: hub.z + R * rad.z,
      };

      // Gondelrichtung aus der Resultierenden. Die Schwerkraft (0,-G,0) wird
      // in die Schwingebene projiziert, die von der Achsrichtung und der
      // Radialrichtung aufgespannt wird.
      const alongAxis = -G * axis.y; // Anteil entlang der Achse
      const alongRad = -G * rad.y; // Anteil entlang radial
      // Untergrenze gegen das Umklappen nach innen bei sehr langsamer Fahrt.
      const radComp = Math.max(centrifugal + alongRad, centrifugal * 0.12);
      let dx = alongAxis * axis.x + radComp * rad.x;
      let dy = alongAxis * axis.y + radComp * rad.y;
      let dz = alongAxis * axis.z + radComp * rad.z;
      const dLen = Math.hypot(dx, dy, dz) || 1;
      dx /= dLen;
      dy /= dLen;
      dz /= dLen;

      // Stuetzpunkte des Fachwerks auf demselben Radialstrahl
      const at = (f) => ({
        x: hub.x + R * f * rad.x,
        y: hub.y + R * f * rad.y,
        z: hub.z + R * f * rad.z,
      });

      units.push({
        theta,
        rim,
        rimIn: at(RIM_INNER),
        mid: at(RING_MID),
        rad,
        tan,
        d: { x: dx, y: dy, z: dz },
        i,
      });
    }

    // Projektionen vorberechnen und nach Kameratiefe sortieren
    for (const u of units) {
      u.pRim = project(u.rim.x, u.rim.y, u.rim.z);
      u.pRimIn = project(u.rimIn.x, u.rimIn.y, u.rimIn.z);
      u.pMid = project(u.mid.x, u.mid.y, u.mid.z);
    }
    units.sort((a, b) => a.pRim.z - b.pRim.z);

    // --- Hintere Haelfte, Struktur, vordere Haelfte --------------------------

    const byIndex = new Map(units.map((u) => [u.i, u]));
    const drawUnit = (u) => {
      const next = byIndex.get((u.i + 1) % ARMS);
      if (next) drawTruss(u, next);
      drawBeam(u, pHub);
      drawGondola(u, clock);
    };

    let split = units.findIndex((u) => u.pRim.z >= pHub.z);
    if (split < 0) split = units.length;

    // Hintere Haelfte samt ihrer Lampen ...
    for (let k = 0; k < split; k++) drawUnit(units[k]);
    flushBulbs();

    // ... dann der Unterbau, der sie verdeckt ...
    drawStructure(hub, pHub, wheelPoint);

    // ... dann die vordere Haelfte. Deren Lampen gehen zusammen mit dem
    // Bodenlicht in einen letzten additiven Durchgang.
    for (let k = split; k < units.length; k++) drawUnit(units[k]);
    ctx.globalCompositeOperation = "lighter";
    drawGroundGlow(pHub, tiltNorm);
    ctx.globalCompositeOperation = "source-over";
    flushBulbs();
  }

  /**
   * Fachwerk zwischen zwei benachbarten Auslegern.
   *
   * Das echte Rad besteht aus mehreren Lagen: außen eine doppelte Felge mit
   * Querstreben dazwischen, innen ein Ring auf etwa halbem Radius, und
   * dazwischen ein durchgehender Dreiecksverband. Erst das lässt es nach
   * Stahlbau aussehen statt nach einem Wagenrad.
   */
  function drawTruss(a, b) {
    const w = a.pRim.p; // Massstab an dieser Tiefe, Pixel je Meter

    // Dreiecksverband zwischen innerem Ring und Felge: zwei Diagonalen, die
    // sich kreuzen. Daraus ergeben sich die Rauten des Originals.
    line(a.pMid, b.pRimIn, "rgba(104,118,146,0.6)", 0.05 * w);
    line(a.pRimIn, b.pMid, "rgba(104,118,146,0.6)", 0.05 * w);

    // Innerer Ring
    line(a.pMid, b.pMid, "rgba(118,132,160,0.8)", 0.07 * w);

    // Doppelte Felge mit Querstreben
    line(a.pRimIn, b.pRimIn, "rgba(126,140,168,0.85)", 0.08 * w);
    line(a.pRim, b.pRim, "rgba(150,164,196,0.95)", 0.1 * w);
    line(a.pRim, a.pRimIn, "rgba(126,140,168,0.75)", 0.06 * w);
    line(a.pRim, b.pRimIn, "rgba(110,124,152,0.5)", 0.04 * w);

    // Lauflicht auf der Felge, dichter als ein Licht je Ausleger
    for (let k = 0; k < RIM_LAMPS; k++) {
      const f = k / RIM_LAMPS;
      const p = mix(a.pRim, b.pRim, f);
      const phase = (a.i + f) / ARMS - clock * 0.3;
      queueBulb(p.x, p.y, Math.max(0.8, 0.085 * w), chase(phase));
    }
  }

  /** Hauptträger von der Nabe zur Felge, plus Lampenkette darauf. */
  function drawBeam(u, pHub) {
    // Zwei Gurte statt einer Linie: innen kräftig, außen schlanker.
    line(pHub, u.pMid, "rgba(158,170,198,0.95)", 0.16 * u.pRim.p);
    line(u.pMid, u.pRim, "rgba(132,146,174,0.9)", 0.12 * u.pRim.p);

    // Lampen laufen von innen nach aussen. f ist der Anteil des Radius.
    for (let k = 0; k < BULBS_PER_ARM; k++) {
      const f = 0.34 + (k / (BULBS_PER_ARM - 1)) * 0.56;
      const p = project(
        u.rim.x - (1 - f) * R * u.rad.x,
        u.rim.y - (1 - f) * R * u.rad.y,
        u.rim.z - (1 - f) * R * u.rad.z,
      );
      const phase = u.i / ARMS - k / (BULBS_PER_ARM * 1.6) - clock * 0.55;
      queueBulb(p.x, p.y, Math.max(0.8, 0.07 * p.p), chase(phase));
    }
  }

  /*
   * Gondel.
   *
   * Beim Original ist das ein Käfig: geschlossene farbige Außenschale, Dach
   * darüber, offene Seiten mit Gitterstäben. Deshalb wird hier ein echter
   * Körper gezeichnet - acht Ecken, und nur die Flächen, die zur Kamera
   * zeigen. Flache Vierecke sahen aus wie aufgeklebte Platten.
   */

  /** Farben der Gondel, Grundwerte vor der Schattierung. */
  const CAR_SHELL = [134, 48, 54]; // gedämpftes Rot wie beim Original
  const CAR_CAGE = [44, 24, 28]; // offene Seiten: dunkel, aber warm getönt
  const CAR_DARK = [14, 17, 25];

  function drawGondola(u, time) {
    const { rim, d, tan, i } = u;

    // Leichtes Nachschwingen, damit die Gondeln nicht starr wirken
    const wob = Math.sin(time * 1.9 + i * 1.7) * 0.025;
    const wx = d.x + tan.x * wob;
    const wy = d.y + tan.y * wob;
    const wz = d.z + tan.z * wob;
    const wl = Math.hypot(wx, wy, wz) || 1;
    const down = { x: wx / wl, y: wy / wl, z: wz / wl };

    // Dritte Achse des Körpers, senkrecht auf Breite und Hängerichtung.
    const dep = cross(tan, down);
    const pRim = u.pRim;

    // Mittelpunkt des Kastens
    const c = {
      x: rim.x + down.x * (HANGER_LEN + CAR_H / 2),
      y: rim.y + down.y * (HANGER_LEN + CAR_H / 2),
      z: rim.z + down.z * (HANGER_LEN + CAR_H / 2),
    };

    /** Ecke in lokalen Vorzeichen (Breite, Höhe, Tiefe), je -1 oder 1. */
    const corner = (sw, sh, sd) =>
      project(
        c.x + tan.x * (sw * CAR_W) / 2 + down.x * (sh * CAR_H) / 2 + dep.x * (sd * CAR_D) / 2,
        c.y + tan.y * (sw * CAR_W) / 2 + down.y * (sh * CAR_H) / 2 + dep.y * (sd * CAR_D) / 2,
        c.z + tan.z * (sw * CAR_W) / 2 + down.z * (sh * CAR_H) / 2 + dep.z * (sd * CAR_D) / 2,
      );

    // Hänger: zwei Streben vom Felgenknoten zum Dach des Kastens.
    const neg = (v) => ({ x: -v.x, y: -v.y, z: -v.z });
    ctx.lineCap = "butt";
    for (const side of [-0.54, 0.54]) {
      const foot = project(
        rim.x + down.x * HANGER_LEN + tan.x * side * CAR_W,
        rim.y + down.y * HANGER_LEN + tan.y * side * CAR_W,
        rim.z + down.z * HANGER_LEN + tan.z * side * CAR_W,
      );
      line(pRim, foot, "rgba(132,144,170,0.9)", 0.05 * pRim.p);
    }

    const edge = Math.max(0.5, 0.028 * pRim.p);
    const barW = Math.max(0.5, 0.022 * pRim.p);

    /** Füllt eine Fläche und legt optional Gitterstäbe darüber. */
    const face = (c1, c2, c3, c4, normal, base, bars) => {
      if (!facesCamera(normal)) return;
      ctx.fillStyle = shade(normal, base);
      quadPath(c1, c2, c3, c4);
      ctx.fill();
      if (bars) {
        // Stäbe laufen quer, von Kante c1-c2 zur Kante c4-c3.
        ctx.strokeStyle = "rgba(206,218,240,0.72)";
        ctx.lineWidth = barW;
        for (let k = 1; k <= bars; k++) {
          const f = k / (bars + 1);
          const a = mix(c1, c4, f);
          const b = mix(c2, c3, f);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      ctx.strokeStyle = "rgba(168,182,210,0.55)";
      ctx.lineWidth = edge;
      quadPath(c1, c2, c3, c4);
      ctx.stroke();
    };

    // Acht Ecken
    const p000 = corner(-1, -1, -1), p100 = corner(1, -1, -1);
    const p110 = corner(1, 1, -1), p010 = corner(-1, 1, -1);
    const p001 = corner(-1, -1, 1), p101 = corner(1, -1, 1);
    const p111 = corner(1, 1, 1), p011 = corner(-1, 1, 1);

    // Dach zur Felge hin: farbiges Verdeck, beim Original der auffälligste
    // Teil, wenn das Rad flach liegt und man von oben hineinschaut.
    face(p000, p100, p101, p001, neg(down), CAR_SHELL, 0);
    // Boden
    face(p010, p110, p111, p011, down, CAR_DARK, 0);
    // Rückwand farbig, Vorderseite offen. Die Fahrgäste sitzen alle in
    // dieselbe Richtung - das ist beim Enterprise tatsächlich so, weil die
    // Achse für das ganze Rad dieselbe ist.
    face(p000, p100, p110, p010, neg(dep), CAR_SHELL, 0);
    face(p001, p101, p111, p011, dep, CAR_CAGE, 3);
    // Seiten, beide mit Gitter
    face(p100, p101, p111, p110, tan, CAR_CAGE, 2);
    face(p000, p001, p011, p010, neg(tan), CAR_CAGE, 2);

    // Warmes Licht aus dem Inneren des Wagens
    const pc = project(c.x, c.y, c.z);
    queueBulb(pc.x, pc.y, Math.max(0.7, 0.085 * pc.p), 0.55);
  }

  /** Nabe, Hydraulikzylinder, Lagerbock und Unterbau. */
  function drawStructure(hub, pHub, wheelPoint) {
    const pivot = wheelPoint(0, -R);
    const pPivot = project(pivot.x, pivot.y, pivot.z);
    const ramTop = wheelPoint(0, -R * 0.42);
    const pRamTop = project(ramTop.x, ramTop.y, ramTop.z);
    const ramBase = project(0, 0.95, -5.2);

    // Hydraulikzylinder: dickes Rohr unten, duenne Stange oben
    ctx.lineCap = "round";
    ctx.strokeStyle = "#3b4356";
    ctx.lineWidth = Math.max(3, 0.78 * ramBase.p);
    ctx.beginPath();
    ctx.moveTo(ramBase.x, ramBase.y);
    ctx.lineTo(
      lerp(ramBase.x, pRamTop.x, 0.52),
      lerp(ramBase.y, pRamTop.y, 0.52),
    );
    ctx.stroke();
    ctx.strokeStyle = "#8b94a8";
    ctx.lineWidth = Math.max(2, 0.34 * ramBase.p);
    ctx.beginPath();
    ctx.moveTo(
      lerp(ramBase.x, pRamTop.x, 0.45),
      lerp(ramBase.y, pRamTop.y, 0.45),
    );
    ctx.lineTo(pRamTop.x, pRamTop.y);
    ctx.stroke();

    // Lagerbock an der Kippachse
    const legL = project(-2.6, 0, -R - 1.4);
    const legR = project(2.6, 0, -R - 1.4);
    ctx.strokeStyle = "#333b4d";
    ctx.lineWidth = Math.max(3, 0.62 * pPivot.p);
    ctx.beginPath();
    ctx.moveTo(legL.x, legL.y);
    ctx.lineTo(pPivot.x, pPivot.y);
    ctx.lineTo(legR.x, legR.y);
    ctx.stroke();

    // Unterbau / Trailer
    const b = [
      project(-5.4, 0, -R + 1.2),
      project(5.4, 0, -R + 1.2),
      project(4.2, 1.5, -R - 2.0),
      project(-4.2, 1.5, -R - 2.0),
    ];
    const baseGrad = ctx.createLinearGradient(b[0].x, b[0].y, b[3].x, b[3].y);
    baseGrad.addColorStop(0, "#161c2a");
    baseGrad.addColorStop(1, "#242c3e");
    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.moveTo(b[0].x, b[0].y);
    for (let i = 1; i < b.length; i++) ctx.lineTo(b[i].x, b[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(140,152,176,0.35)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // Nabe: beim Original eine große, glatte Kappe, kein Kugelchen.
    const hubR = Math.max(4, 1.55 * pHub.p);

    // Kragen hinter der Kappe, in den die Träger laufen
    ctx.fillStyle = "#1b2230";
    ctx.beginPath();
    ctx.arc(pHub.x, pHub.y, hubR * 1.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(140,154,184,0.5)";
    ctx.lineWidth = Math.max(1, 0.05 * pHub.p);
    ctx.stroke();

    const hubGrad = ctx.createRadialGradient(
      pHub.x - hubR * 0.35,
      pHub.y - hubR * 0.4,
      hubR * 0.08,
      pHub.x,
      pHub.y,
      hubR,
    );
    hubGrad.addColorStop(0, "#aab4ca");
    hubGrad.addColorStop(0.55, "#5a6578");
    hubGrad.addColorStop(1, "#222a38");
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(pHub.x, pHub.y, hubR, 0, Math.PI * 2);
    ctx.fill();

    // Lampenkranz auf dem Kragen, wie die verzierte Nabenscheibe im Original
    const ring = 12;
    for (let k = 0; k < ring; k++) {
      const a = (k / ring) * Math.PI * 2 + clock * 0.25;
      queueBulb(
        pHub.x + Math.cos(a) * hubR * 1.1,
        pHub.y + Math.sin(a) * hubR * 1.1,
        Math.max(0.7, 0.07 * pHub.p),
        chase(k / ring - clock * 0.4),
      );
    }
  }

  /** Warmer Lichtteppich am Boden unter dem Fahrgeschaeft. */
  function drawGroundGlow(pHub, tiltNorm) {
    const gx = originX;
    const gy = originY;
    const rr = Math.max(60, R * 1.6 * pxPerM);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, rr);
    const a = 0.1 + 0.07 * (1 - tiltNorm);
    g.addColorStop(0, `rgba(255,164,64,${a})`);
    g.addColorStop(0.5, `rgba(255,132,40,${a * 0.4})`);
    g.addColorStop(1, "rgba(255,120,30,0)");
    // Laeuft im additiven Durchgang des Aufrufers mit.
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(gx, gy, rr, rr * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // --------------------------------------------------------------- Layout

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, Math.round(rect.width || window.innerWidth));
    height = Math.max(1, Math.round(rect.height || window.innerHeight));
    // Device-Pixel-Ratio deckeln: ueber 2 bringt optisch nichts mehr, kostet
    // auf Mobilgeraeten aber deutlich Fuellrate.
    dpr = Math.min(window.devicePixelRatio || 1, 2) * QUALITY_STEPS[qualityStep];

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Bei voller Neigung reicht die oberste Gondel rund 21 m hoch, und das
    // Rad ist mit den Gondeln rund 21 m breit. Der Massstab muss sich auf den
    // Platz UNTER der Grundlinie beziehen, nicht auf die ganze Fensterhoehe -
    // sonst laeuft die Szene oben aus dem Bild.
    const portrait = height > width * 1.15;
    originX = width / 2;
    originY = height * (portrait ? 0.86 : 0.93);
    // PERSPECTIVE_HEADROOM: Punkte weit oben liegen naeher an der Kamera und
    // werden dadurch groesser gezeichnet. Dafuer etwas Luft lassen.
    const PERSPECTIVE_HEADROOM = 1.14;
    pxPerM =
      Math.min(width / SCENE_W, originY / SCENE_H) / PERSPECTIVE_HEADROOM;

    buildGlowSprites();
    backdrop = buildBackdrop();
    drawFrame();
  }

  // -------------------------------------------------------------- Animation

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    // Sprung nach Tab-Wechsel oder Jank abfedern
    const dt = Math.min((now - lastFrame) / 1000, 0.05);
    lastFrame = now;
    clock += dt;
    measure(dt);
    const tiltNorm =
      (tiltAt(clock) - TILT_MIN) / (TILT_MAX - TILT_MIN);
    spin += ((lerp(RPM_MIN, RPM_MAX, tiltNorm) * Math.PI * 2) / 60) * dt;
    drawFrame();
  }

  /**
   * Beobachtet die Bildzeiten und schaltet bei dauerhaft zu langsamen Bildern
   * eine Qualitaetsstufe zurueck. Die ersten Bilder nach dem Start werden
   * ignoriert, weil dort noch Layout und Schriften dazwischenfunken.
   */
  function measure(dt) {
    if (qualityStep >= QUALITY_STEPS.length - 1) return;
    frameTimes.push(dt);
    if (frameTimes.length < 50) return;
    const sorted = frameTimes.slice(10).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    frameTimes = [];
    if (median > 0.032) {
      // schlechter als rund 30 Bilder pro Sekunde
      qualityStep++;
      resize();
    }
  }

  function start() {
    if (running || reduceMotion.matches) return;
    running = true;
    lastFrame = performance.now();
    rafId = requestAnimationFrame(tick);
  }

  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
  }

  /** Bei prefers-reduced-motion nur ein ruhiges Standbild. */
  function applyMotionPreference() {
    if (reduceMotion.matches) {
      stop();
      clock = TILT_PERIOD * 0.31; // schoene Zwischenstellung
      spin = 0.22;
      drawFrame();
    } else {
      start();
    }
  }

  // ------------------------------------------------------------------- Setup

  resize(); // legt Massstab, Sprites und Himmelsebene an

  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  });
  window.addEventListener("orientationchange", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 220);
  });

  // Im versteckten Tab nicht rechnen.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stop();
    else applyMotionPreference();
  });

  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", applyMotionPreference);
  }

  applyMotionPreference();
})();
