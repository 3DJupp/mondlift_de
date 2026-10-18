/*
 * mondlift.de - Animation eines Huss Enterprise auf Canvas 2D.
 *
 * Modell
 * ------
 * Ein Rad mit 20 Gondeln dreht sich um seine Achse. Das ganze Rad kippt um
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
 * Aussehen
 * --------
 * Nach Referenzfotos eines Huss Enterprise, siehe BACKLOG.md:
 *  - das Rad ist ein Fachwerk: Haupttraeger, ein innerer Ring, dazwischen
 *    Dreiecke und Rauten, aussen eine doppelte Felge mit Querstreben
 *  - die Gondeln sind Kaefige: Dach, farbige Aussenschale, offene Seiten
 *    mit Gitterstaeben, Sitzschale innen; sie oeffnen sich zur Nabe hin
 *  - in der Mitte eine grosse glatte Nabenkappe mit Lampenkranz
 *  - getragen wird das Rad von einem kraeftigen Kastentraeger, den zwei
 *    Hydraulikzylinder vom Trailer aus heben
 *  - die Lampen sitzen dicht an dicht auf Felge, Traegern und Kappe
 *
 * Koerper werden als Flaechen mit einfacher Lambert-Schattierung gezeichnet.
 * Welche Flaeche sichtbar ist, entscheidet ihre Normale gegen die echte
 * Kameraposition - nicht die Reihenfolge der Zeichenbefehle.
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

  const ARMS = 20; // Haupttraeger / Gondeln
  const R = 8.0; // Radradius bis zur aeusseren Felge, in m
  const R_RIM_IN = R - 0.62; // zweite, innere Felge
  const R_RING = R * 0.5; // innerer Ring des Fachwerks
  const R_CAP = 1.85; // Nabenkappe
  const PIVOT_Y = 2.6; // Hoehe der Kippachse ueber Grund in m

  const BULBS_PER_RIM = 3; // je Feld zwischen zwei Traegern
  const BULBS_PER_ARM = 2; // je Haupttraeger

  const TILT_MIN = 10 * DEG; // nahezu waagerecht
  const TILT_MAX = 84 * DEG; // fast senkrecht
  const TILT_PERIOD = 26; // Sekunden fuer hoch und wieder runter
  const RPM_MIN = 8.5;
  const RPM_MAX = 13.5;

  const CAM_PITCH = 19 * DEG; // Blick von oben
  const FOV = 62; // Brennweite in Metern, groesser = flacher

  // Gondel in m. Laenge laeuft vom Drehpunkt an der Felge weg, Breite
  // tangential zum Rad, Tiefe von der Gitterseite zur Aussenschale.
  const HANGER_LEN = 0.5; // Drehpunkt bis Dach
  const CAR_LEN = 1.7; // Dach bis Boden
  const CAR_HALF_W = 0.66;
  const CAR_HALF_D = 0.55;

  // Farben. Dunkles Schema; Farbe gibt es nur auf den Gondelschalen, und
  // auch dort gedeckt. Die Reihe wiederholt sich um das Rad.
  const SHELLS = [
    [168, 46, 56], // rot
    [44, 98, 166], // blau
    [36, 128, 92], // gruen
    [190, 140, 40], // gelb
    [150, 62, 140], // pink
  ];
  const STEEL = [96, 116, 156]; // blauer Stahl
  const METAL = [196, 204, 220]; // helles Metall der Gitter und Daecher
  const DARK = [22, 26, 38];

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
    // Die Kamera steht auf der Seite der Kippachse und schaut in Richtung
    // -Z, also um die Hochachse gedreht: X und Z wechseln das Vorzeichen.
    // So sieht man das aufgerichtete Rad von vorn, und der Traeger liegt
    // dahinter - wie auf den Fotos vom Platz vor dem Geschaeft.
    const yc = y * cosCam + z * sinCam;
    const zc = y * sinCam - z * cosCam;
    const p = (FOV / (FOV - zc)) * pxPerM;
    return { x: originX - x * p, y: originY - yc * p, p, z: zc };
  }

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
    const horizon = project(0, 0, 34);
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


  // ---------------------------------------------------------- Vektoren, Licht

  const vec = (x, y, z) => ({ x, y, z });
  /** p + d * s */
  const along = (p, d, s) => vec(p.x + d.x * s, p.y + d.y * s, p.z + d.z * s);
  const sub = (a, b) => vec(a.x - b.x, a.y - b.y, a.z - b.z);
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const cross = (a, b) =>
    vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
  const unit = (a) => {
    const l = Math.hypot(a.x, a.y, a.z) || 1;
    return vec(a.x / l, a.y / l, a.z / l);
  };
  const projectV = (p) => project(p.x, p.y, p.z);

  // Kameraposition im Weltsystem: der Punkt, den project() auf Tiefe FOV
  // legt. Gebraucht, um zu entscheiden, welche Seite einer Flaeche man sieht.
  const CAM = vec(0, FOV * sinCam, -FOV * cosCam);

  // Mondlicht von rechts oben, etwas von vorn.
  const LIGHT = unit(vec(-0.5, 0.75, -0.45));

  /** Helligkeit einer Flaeche mit Normale n: Grundlicht plus Mondlicht. */
  const lambert = (n) => 0.3 + 0.7 * Math.max(0, dot(n, LIGHT));

  /** Farbe als CSS-String, mit Helligkeit k und Deckkraft a. */
  const rgb = (c, k, a = 1) =>
    `rgba(${Math.min(255, c[0] * k) | 0},${Math.min(255, c[1] * k) | 0},${Math.min(255, c[2] * k) | 0},${a})`;

  /** Pfad durch projizierte Punkte, geschlossen. */
  function polygon(points) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let k = 1; k < points.length; k++) ctx.lineTo(points[k].x, points[k].y);
    ctx.closePath();
  }

  /**
   * Eine ebene Flaeche aus Weltpunkten. Die Normale wird von `inside`
   * weg ausgerichtet; sichtbar ist die Flaeche, wenn diese Normale zur
   * Kamera zeigt. Gibt die Normale und die Sichtbarkeit zurueck, damit der
   * Aufrufer entscheiden kann, was er mit verdeckten Flaechen macht.
   */
  function faceInfo(world, inside) {
    let n = unit(cross(sub(world[1], world[0]), sub(world[3], world[0])));
    const c = world[0];
    if (dot(n, sub(c, inside)) < 0) n = vec(-n.x, -n.y, -n.z);
    return { n, visible: dot(n, sub(CAM, c)) > 0 };
  }

  /**
   * Quader aus Mittelpunkt, drei Achsen und halben Kantenlaengen. Gezeichnet
   * werden nur die sichtbaren Seiten - bei einem konvexen Koerper
   * ueberlappen die sich nicht, die Reihenfolge ist also egal.
   */
  function drawBox(c, a, b, d, ha, hb, hd, color, edge) {
    const P = (sa, sb, sd) =>
      along(along(along(c, a, sa * ha), b, sb * hb), d, sd * hd);
    const faces = [
      [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)],
      [P(-1, -1, -1), P(-1, 1, -1), P(-1, 1, 1), P(-1, -1, 1)],
      [P(-1, 1, -1), P(1, 1, -1), P(1, 1, 1), P(-1, 1, 1)],
      [P(-1, -1, -1), P(1, -1, -1), P(1, -1, 1), P(-1, -1, 1)],
      [P(-1, -1, 1), P(1, -1, 1), P(1, 1, 1), P(-1, 1, 1)],
      [P(-1, -1, -1), P(1, -1, -1), P(1, 1, -1), P(-1, 1, -1)],
    ];
    for (const world of faces) {
      const info = faceInfo(world, c);
      if (!info.visible) continue;
      polygon(world.map(projectV));
      ctx.fillStyle = rgb(color, lambert(info.n));
      ctx.fill();
      if (edge) {
        ctx.strokeStyle = edge;
        ctx.stroke();
      }
    }
  }

  // ------------------------------------------------------------------ Zeichnen

  /** Was pro Bild fuer alle Teile gleich ist: Lage des Rades. */
  const frame = {
    hub: vec(0, 0, 0),
    pHub: null,
    ex: vec(1, 0, 0),
    ey: vec(0, 1, 0),
    axis: vec(0, 0, 1),
    facing: 1, // +1: die Kamera sieht die Seite, zu der axis zeigt
  };

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
    const ex = vec(1, 0, 0);
    const ey = vec(0, cb, sb);
    // Achsrichtung, die bei waagerechtem Rad nach unten zeigt. Zu dieser
    // Seite schwingen die Gondeln aus, und dort sitzt der Traeger.
    const axis = vec(0, -sb, cb);

    // Die Kippachse liegt an der hinteren Felgenkante, also bei Radkoordinate
    // (0, -R). Daraus folgt die Nabenposition.
    const hub = vec(0, PIVOT_Y + R * ey.y, -R + R * ey.z);
    const pHub = projectV(hub);

    frame.hub = hub;
    frame.pHub = pHub;
    frame.ex = ex;
    frame.ey = ey;
    frame.axis = axis;
    // Bei flachem Rad sieht die Kamera von oben auf die Gegenseite der
    // Achse, bei steilem Rad auf die Achsseite. Dazwischen steht es einmal
    // genau auf der Kante.
    frame.facing = dot(sub(CAM, hub), axis) >= 0 ? 1 : -1;

    // --- Je Traeger: Richtungen, Fachwerkknoten, Gondelrichtung ----------

    const half = Math.PI / ARMS;
    const units = [];
    for (let i = 0; i < ARMS; i++) {
      const theta = spin + (i / ARMS) * Math.PI * 2;
      const ct = Math.cos(theta);
      const st = Math.sin(theta);
      const ch = Math.cos(theta + half);
      const sh = Math.sin(theta + half);

      // Radialrichtung und Tangente in der Radebene, dazu die Richtung
      // genau zwischen diesem und dem naechsten Traeger.
      const rad = vec(ct * ex.x + st * ey.x, ct * ex.y + st * ey.y, ct * ex.z + st * ey.z);
      const tan = vec(-st * ex.x + ct * ey.x, -st * ex.y + ct * ey.y, -st * ex.z + ct * ey.z);
      const radH = vec(ch * ex.x + sh * ey.x, ch * ex.y + sh * ey.y, ch * ex.z + sh * ey.z);

      const rim = along(hub, rad, R);

      // Gondelrichtung aus der Resultierenden. Die Schwerkraft (0,-G,0) wird
      // in die Schwingebene projiziert, die von der Achsrichtung und der
      // Radialrichtung aufgespannt wird.
      const alongAxis = -G * axis.y; // Anteil entlang der Achse
      const alongRad = -G * rad.y; // Anteil entlang radial
      // Untergrenze gegen das Umklappen nach innen bei sehr langsamer Fahrt.
      const radComp = Math.max(centrifugal + alongRad, centrifugal * 0.12);
      const d = unit(
        vec(
          alongAxis * axis.x + radComp * rad.x,
          alongAxis * axis.y + radComp * rad.y,
          alongAxis * axis.z + radComp * rad.z,
        ),
      );

      units.push({
        i,
        rad,
        tan,
        rim,
        d,
        pRim: projectV(rim),
        pRimIn: projectV(along(hub, rad, R_RIM_IN)),
        pRing: projectV(along(hub, rad, R_RING)),
        pCap: projectV(along(hub, rad, R_CAP)),
        pRimH: projectV(along(hub, radH, R)),
        pRimInH: projectV(along(hub, radH, R_RIM_IN)),
        pCapH: projectV(along(hub, radH, R_CAP)),
        pArm: [0.5, 0.78].map((f) => projectV(along(hub, rad, R * f))),
      });
    }

    // Nach Kameratiefe der Felge sortieren und in hintere und vordere
    // Haelfte teilen. Die Gondeln der hinteren Haelfte liegen hinter dem
    // Rad, die der vorderen davor.
    const order = units.slice().sort((a, b) => a.pRim.z - b.pRim.z);
    let split = order.findIndex((u) => u.pRim.z >= pHub.z);
    if (split < 0) split = order.length;

    // --- Zeichenreihenfolge -------------------------------------------------
    // Boden und Trailer, hintere Gondeln, Rad, vordere Gondeln. Der Traeger
    // sitzt auf der Achsseite: sieht die Kamera diese Seite, liegt er vor
    // dem Rad, sonst dahinter.

    drawGround();

    for (let k = 0; k < split; k++) drawGondola(order[k], clock);

    const boomInFront = frame.facing > 0;
    if (!boomInFront) drawBoom();

    // Fachwerk in einem Zug, hinten zuerst, damit vordere Streben oben liegen.
    for (const u of order) drawSector(u, units[(u.i + 1) % ARMS]);
    drawHubCap();
    flushBulbs();

    if (boomInFront) drawBoom();

    for (let k = split; k < order.length; k++) drawGondola(order[k], clock);

    // Zentrallampe und Bodenlicht gehen zusammen mit den restlichen Lampen
    // in einen letzten additiven Durchgang.
    ctx.globalCompositeOperation = "lighter";
    drawHubGlow(tiltNorm);
    drawGroundGlow(tiltNorm);
    ctx.globalCompositeOperation = "source-over";
    flushBulbs();
  }

  /**
   * Ein Feld des Rades zwischen Traeger a und dem naechsten, b: der
   * Haupttraeger von a, beide Felgen, der innere Ring und das Fachwerk
   * dazwischen. Die Lampen des Feldes werden vorgemerkt.
   */
  function drawSector(a, b) {
    const { pHub } = frame;
    const p = a.pRim.p;
    ctx.lineCap = "butt";
    ctx.lineJoin = "miter";

    // Haupttraeger, von der Kappe zur aeusseren Felge
    ctx.strokeStyle = rgb(STEEL, 1.0, 0.95);
    ctx.lineWidth = Math.max(1.1, 0.2 * p);
    ctx.beginPath();
    ctx.moveTo(a.pCap.x, a.pCap.y);
    ctx.lineTo(a.pRim.x, a.pRim.y);
    ctx.stroke();

    // Doppelte Felge und innerer Ring
    ctx.lineWidth = Math.max(0.9, 0.12 * p);
    ctx.beginPath();
    ctx.moveTo(a.pRim.x, a.pRim.y);
    ctx.lineTo(a.pRimH.x, a.pRimH.y);
    ctx.lineTo(b.pRim.x, b.pRim.y);
    ctx.moveTo(a.pRimIn.x, a.pRimIn.y);
    ctx.lineTo(a.pRimInH.x, a.pRimInH.y);
    ctx.lineTo(b.pRimIn.x, b.pRimIn.y);
    ctx.moveTo(a.pRing.x, a.pRing.y);
    ctx.lineTo(b.pRing.x, b.pRing.y);
    ctx.stroke();

    // Fachwerk: innen ein Dreieck von der Kappe zum Ring, aussen eines vom
    // Ring zur Felge - zusammen eine Raute um den Ring. Zwischen den Felgen
    // ein Zickzack.
    ctx.strokeStyle = rgb(STEEL, 1.25, 0.7);
    ctx.lineWidth = Math.max(0.6, 0.06 * p);
    ctx.beginPath();
    ctx.moveTo(a.pRing.x, a.pRing.y);
    ctx.lineTo(a.pCapH.x, a.pCapH.y);
    ctx.lineTo(b.pRing.x, b.pRing.y);
    ctx.lineTo(a.pRimInH.x, a.pRimInH.y);
    ctx.lineTo(a.pRing.x, a.pRing.y);
    ctx.moveTo(a.pRimIn.x, a.pRimIn.y);
    ctx.lineTo(a.pRimH.x, a.pRimH.y);
    ctx.lineTo(b.pRimIn.x, b.pRimIn.y);
    ctx.moveTo(a.pRimInH.x, a.pRimInH.y);
    ctx.lineTo(a.pRimH.x, a.pRimH.y);
    ctx.stroke();

    // Lampen: dicht auf der Felge, zwei auf dem Traeger, zwei am Kranz der
    // Kappe. Das Lauflicht laeuft auf Felge und Kappe gegenlaeufig.
    for (let k = 0; k < BULBS_PER_RIM; k++) {
      const t = k / BULBS_PER_RIM;
      const from = t < 0.5 ? a.pRim : a.pRimH;
      const to = t < 0.5 ? a.pRimH : b.pRim;
      const s = t < 0.5 ? t * 2 : t * 2 - 1;
      const u = (a.i + t) / ARMS - clock * 0.3;
      queueBulb(
        lerp(from.x, to.x, s),
        lerp(from.y, to.y, s),
        Math.max(0.9, 0.085 * p),
        chase(u * 2),
      );
    }
    for (let k = 0; k < BULBS_PER_ARM; k++) {
      const q = a.pArm[k];
      const phase = a.i / ARMS - k * 0.2 - clock * 0.55;
      queueBulb(q.x, q.y, Math.max(0.8, 0.07 * q.p), chase(phase));
    }
    const capPhase = a.i / ARMS + clock * 0.4;
    queueBulb(a.pCap.x, a.pCap.y, Math.max(0.8, 0.075 * pHub.p), chase(capPhase * 2));
    queueBulb(a.pCapH.x, a.pCapH.y, Math.max(0.8, 0.075 * pHub.p), chase(capPhase * 2 + 0.5 / ARMS));
  }

  /** Kreis in der Radebene um c, als projizierte Punkte. */
  function wheelCircle(c, r, steps) {
    const { ex, ey } = frame;
    const pts = [];
    for (let k = 0; k < steps; k++) {
      const a = (k / steps) * Math.PI * 2;
      const ca = Math.cos(a) * r;
      const sa = Math.sin(a) * r;
      pts.push(project(c.x + ca * ex.x + sa * ey.x, c.y + ca * ex.y + sa * ey.y, c.z + ca * ex.z + sa * ey.z));
    }
    return pts;
  }

  /**
   * Die Nabenkappe: eine grosse, glatte Scheibe mit flacher Kuppel. Die
   * Kuppel sitzt auf der Seite, die die Kamera gerade sieht.
   */
  function drawHubCap() {
    const { hub, axis, facing } = frame;
    const n = vec(axis.x * facing, axis.y * facing, axis.z * facing);
    const k = lambert(n);

    polygon(wheelCircle(hub, R_CAP * 1.08, 28));
    ctx.fillStyle = rgb(STEEL, 0.55 * k);
    ctx.fill();
    ctx.strokeStyle = rgb(METAL, 0.6, 0.6);
    ctx.lineWidth = Math.max(0.8, 0.08 * frame.pHub.p);
    ctx.stroke();

    polygon(wheelCircle(along(hub, n, 0.35), R_CAP * 0.72, 24));
    ctx.fillStyle = rgb(METAL, 0.62 * k);
    ctx.fill();

    polygon(wheelCircle(along(hub, n, 0.55), R_CAP * 0.34, 16));
    ctx.fillStyle = rgb(METAL, 0.72 * k);
    ctx.fill();
  }

  /** Leuchten der Kappe, atmet mit der Neigung. */
  function drawHubGlow(tiltNorm) {
    const { pHub } = frame;
    const lampR = Math.max(6, R_CAP * 2.4 * pHub.p);
    const lamp = ctx.createRadialGradient(pHub.x, pHub.y, 0, pHub.x, pHub.y, lampR);
    const li = 0.1 + 0.12 * tiltNorm;
    lamp.addColorStop(0, `rgba(255,236,200,${li})`);
    lamp.addColorStop(0.35, `rgba(255,186,96,${li * 0.6})`);
    lamp.addColorStop(1, "rgba(255,140,40,0)");
    ctx.fillStyle = lamp;
    ctx.beginPath();
    ctx.arc(pHub.x, pHub.y, lampR, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Gondel als Kaefig. Achsen: L vom Drehpunkt weg (Dach -> Boden), W
   * tangential, N von der Gitterseite zur Aussenschale. N liegt in derselben
   * Schwingebene wie L und steht senkrecht darauf: haengt die Gondel nach
   * unten, zeigt N radial nach aussen; steht sie radial ab, zeigt N gegen
   * die Achse. Die Schale ist also immer der Ruecken der Fahrgaeste.
   */
  function drawGondola(u, time) {
    const { axis } = frame;
    const { rim, tan, rad, d, i } = u;

    // Leichtes Nachschwingen, damit die Gondeln nicht starr wirken
    const wob = Math.sin(time * 1.9 + i * 1.7) * 0.025;
    const L = unit(along(d, tan, wob));
    const W = tan;
    const la = dot(L, axis);
    const lr = dot(L, rad);
    const N = unit(vec(rad.x * la - axis.x * lr, rad.y * la - axis.y * lr, rad.z * la - axis.z * lr));

    const P = (l, w, n) =>
      vec(
        rim.x + L.x * (HANGER_LEN + l * CAR_LEN) + W.x * w * CAR_HALF_W + N.x * n * CAR_HALF_D,
        rim.y + L.y * (HANGER_LEN + l * CAR_LEN) + W.y * w * CAR_HALF_W + N.y * n * CAR_HALF_D,
        rim.z + L.z * (HANGER_LEN + l * CAR_LEN) + W.z * w * CAR_HALF_W + N.z * n * CAR_HALF_D,
      );
    const center = P(0.5, 0, 0);
    const shell = SHELLS[i % SHELLS.length];
    const p = u.pRim.p;

    // Haenger: zwei Streben vom Drehpunkt an der Felge zum Dach
    ctx.strokeStyle = rgb(STEEL, 1.1, 0.95);
    ctx.lineWidth = Math.max(0.8, 0.07 * p);
    ctx.lineCap = "butt";
    ctx.beginPath();
    for (const side of [-0.5, 0.5]) {
      const top = projectV(along(rim, W, side * 0.5));
      const foot = projectV(P(0, side * 1.4, 0.2));
      ctx.moveTo(top.x, top.y);
      ctx.lineTo(foot.x, foot.y);
    }
    ctx.stroke();

    // Geschlossene Flaechen: Dach (leicht ueberstehend), Boden, Schale
    const roof = [P(0, -1.12, -1.2), P(0, 1.12, -1.2), P(0, 1.12, 1.12), P(0, -1.12, 1.12)];
    const floor = [P(1, -1, -1), P(1, 1, -1), P(1, 1, 1), P(1, -1, 1)];
    const back = [P(0, -1, 1), P(0, 1, 1), P(1, 1, 1), P(1, -1, 1)];
    // Die Schale ist an den Ecken gerundet; fuer die Sichtbarkeit reicht
    // das Rechteck, gezeichnet wird der Umriss mit abgeschraegten Ecken.
    const backShape = [
      P(0, -0.78, 1), P(0, 0.78, 1), P(0.14, 1, 1), P(0.84, 1, 1),
      P(1, 0.72, 1), P(1, -0.72, 1), P(0.84, -1, 1), P(0.14, -1, 1),
    ];
    const solids = [
      { world: roof, color: METAL, k: 0.5 },
      { world: floor, color: DARK, k: 1.6 },
      { world: back, shape: backShape, color: shell, k: 0.85, stripe: true },
    ];
    for (const s of solids) s.info = faceInfo(s.world, center);

    // 1. Was man durch das Gitter von innen sieht: verdeckte Flaechen, dunkel
    for (const s of solids) {
      if (s.info.visible) continue;
      polygon((s.shape || s.world).map(projectV));
      ctx.fillStyle = rgb(s.color, 0.32 * s.k);
      ctx.fill();
    }

    // 2. Sitzschale vor der Schale, mit Lehne
    polygon([P(0.42, -0.82, 0.88), P(0.42, 0.82, 0.88), P(0.96, 0.82, 0.88), P(0.96, -0.82, 0.88)].map(projectV));
    ctx.fillStyle = rgb(DARK, 1.3);
    ctx.fill();
    polygon([P(0.7, -0.82, 0.88), P(0.7, 0.82, 0.88), P(0.7, 0.82, 0.1), P(0.7, -0.82, 0.1)].map(projectV));
    ctx.fillStyle = rgb(shell, 0.35);
    ctx.fill();

    // 3. Gitter: senkrechte Staebe auf der offenen Vorderseite und den
    // beiden Seiten, dazu je ein Handlauf
    ctx.strokeStyle = rgb(METAL, 0.95, 0.75);
    ctx.lineWidth = Math.max(0.5, 0.03 * p);
    ctx.beginPath();
    const bar = (a, b) => {
      const pa = projectV(a);
      const pb = projectV(b);
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
    };
    for (const w of [-1, -0.5, 0, 0.5, 1]) bar(P(0, w, -1), P(1, w, -1));
    for (const n of [-0.33, 0.33]) {
      bar(P(0, -1, n), P(1, -1, n));
      bar(P(0, 1, n), P(1, 1, n));
    }
    bar(P(0.45, -1, -1), P(0.45, 1, -1));
    bar(P(0.45, -1, -1), P(0.45, -1, 1));
    bar(P(0.45, 1, -1), P(0.45, 1, 1));
    bar(P(1, -1, -1), P(1, 1, -1));
    ctx.stroke();

    // 4. Sichtbare Aussenflaechen, schattiert, mit heller Kante
    ctx.lineWidth = Math.max(0.5, 0.03 * p);
    for (const s of solids) {
      if (!s.info.visible) continue;
      const k = s.k * lambert(s.info.n);
      polygon((s.shape || s.world).map(projectV));
      ctx.fillStyle = rgb(s.color, k);
      ctx.fill();
      ctx.strokeStyle = rgb(METAL, 0.9, 0.35);
      ctx.stroke();
      if (s.stripe) {
        // Zierband und Kante oben, wie die Chromleisten der Originale
        polygon([P(0.2, -0.96, 1.01), P(0.2, 0.96, 1.01), P(0.3, 0.96, 1.01), P(0.3, -0.96, 1.01)].map(projectV));
        ctx.fillStyle = rgb(METAL, 0.7 * k);
        ctx.fill();
        polygon([P(0.42, -0.7, 1.01), P(0.42, 0.7, 1.01), P(0.9, 0.62, 1.01), P(0.9, -0.62, 1.01)].map(projectV));
        ctx.fillStyle = rgb(s.color, k * 0.72);
        ctx.fill();
      }
    }

    // Kleine Lampe vorn am Dach
    const lamp = projectV(P(0, 0, -1.2));
    queueBulb(lamp.x, lamp.y, Math.max(0.8, 0.07 * p), chase(i / ARMS - time * 0.3) * 0.8);
  }

  /**
   * Der Traeger: ein Kastentraeger von der Kippachse zur Nabe, auf der
   * Achsseite des Rades, dazu das Lager unter der Nabe und die beiden
   * Hydraulikzylinder vom Trailer.
   */
  function drawBoom() {
    const { hub, ex, ey, axis } = frame;
    const pivot = along(hub, ey, -R);
    const edge = "rgba(150,166,198,0.35)";
    ctx.lineWidth = 1;

    // Hydraulikzylinder: dickes Rohr unten, blanke Stange oben
    for (const side of [-1.5, 1.5]) {
      const base = projectV(vec(side, 1.3, -R + 3.2));
      const top = projectV(along(along(pivot, ey, R * 0.55), axis, 1.4));
      ctx.lineCap = "round";
      ctx.strokeStyle = rgb(STEEL, 0.55);
      ctx.lineWidth = Math.max(2, 0.42 * base.p);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(lerp(base.x, top.x, 0.55), lerp(base.y, top.y, 0.55));
      ctx.stroke();
      ctx.strokeStyle = rgb(METAL, 0.75);
      ctx.lineWidth = Math.max(1.2, 0.17 * base.p);
      ctx.beginPath();
      ctx.moveTo(lerp(base.x, top.x, 0.5), lerp(base.y, top.y, 0.5));
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
    }
    ctx.lineWidth = 1;

    // Kastentraeger
    const mid = along(along(pivot, ey, R * 0.5), axis, 0.95);
    drawBox(mid, ey, ex, axis, R * 0.5 + 0.4, 0.7, 0.5, STEEL.map((c) => c * 0.62), edge);

    // Lager unter der Nabe
    drawBox(along(hub, axis, 0.75), axis, ex, ey, 0.55, 1.0, 1.0, STEEL.map((c) => c * 0.75), edge);
  }

  /**
   * Boden: Trailer mit Lagerbock an der Kippachse und ein flaches Podest,
   * von dem aus eingestiegen wird. Mit Lampen an der Podestkante.
   */
  function drawGround() {
    const edge = "rgba(140,152,176,0.3)";
    ctx.lineWidth = 1;

    // Podest unter dem Rad
    drawBox(vec(0, 0.15, -1.5), vec(1, 0, 0), vec(0, 1, 0), vec(0, 0, 1), 9.6, 0.15, 7.5, [34, 40, 56], edge);
    for (let k = 0; k <= 12; k++) {
      const q = project(-9.4 + (k / 12) * 18.8, 0.32, 6.0);
      queueBulb(q.x, q.y, Math.max(0.8, 0.07 * q.p), 0.35 + 0.25 * chase(k / 12 - clock * 0.2));
    }

    // Trailer
    drawBox(vec(0, 0.85, -R + 1), vec(1, 0, 0), vec(0, 1, 0), vec(0, 0, 1), 1.7, 0.55, 4.2, [42, 50, 70], edge);

    // Lagerbock: zwei Boecke links und rechts der Kippachse
    for (const side of [-1.9, 1.9]) {
      drawBox(vec(side, PIVOT_Y * 0.5 + 0.4, -R), vec(1, 0, 0), vec(0, 1, 0), vec(0, 0, 1), 0.3, PIVOT_Y * 0.5 - 0.1, 0.6, [58, 70, 96], edge);
    }
  }

  /** Warmer Lichtteppich am Boden unter dem Fahrgeschaeft. */
  function drawGroundGlow(tiltNorm) {
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

    fitScene();

    buildGlowSprites();
    backdrop = buildBackdrop();
    drawFrame();
  }

  /**
   * Legt Massstab und Bildposition so fest, dass das Rad mit allen Gondeln
   * in jeder Neigung ins Bild passt. Statt einer geschaetzten Szenengroesse
   * wird die Huelle wirklich projiziert: bei Massstab 1 sind Bildpunkte
   * linear im Massstab, also reicht ein Durchlauf und eine Division.
   */
  function fitScene() {
    pxPerM = 1;
    originX = 0;
    originY = 0;
    const reach = HANGER_LEN + CAR_LEN + CAR_HALF_D;
    let maxX = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let s = 0; s <= 6; s++) {
      const tilt = lerp(TILT_MIN, TILT_MAX, s / 6);
      const sb = Math.cos(tilt); // sin(beta), beta = 90 Grad - tilt
      const cb = Math.sin(tilt);
      const hub = vec(0, PIVOT_Y + R * cb, -R + R * sb);
      const ey = vec(0, cb, sb);
      const axis = vec(0, -sb, cb);
      for (let k = 0; k < 24; k++) {
        const a = (k / 24) * Math.PI * 2;
        const rad = vec(Math.cos(a), Math.sin(a) * ey.y, Math.sin(a) * ey.z);
        const rim = along(hub, rad, R);
        for (const q of [along(rim, rad, reach), along(rim, axis, reach)]) {
          const p = projectV(q);
          maxX = Math.max(maxX, Math.abs(p.x));
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
        }
      }
    }
    const portrait = height > width * 1.15;
    // Oben bleibt Platz fuer Titel und Unterzeile der Startseite.
    const top = height * (portrait ? 0.2 : 0.25);
    const bottom = height * (portrait ? 0.9 : 0.97);
    pxPerM = Math.min((width * 0.47) / maxX, (bottom - top) / (maxY - minY));
    originX = width / 2;
    originY = bottom - maxY * pxPerM;
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
