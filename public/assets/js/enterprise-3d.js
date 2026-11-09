/*
 * Mondlift: prozedurales 3D-Modell des Huss Enterprise, so wie es am Platz
 * steht: Podium mit Treppen und Kasse, Rückwand, Auflieger, Ausleger mit
 * Hydraulik, Rad mit Lauflicht und zwanzig Tandemgondeln am Kranz.
 * Alles ist aus einfachen Körpern gerechnet, kein fremdes 3D-Modell wird
 * geladen. Einzige Bilddatei ist das Wandbild der Rückwand
 * (/assets/img/rueckwand.webp); Herkunft siehe README.
 */
(async () => {
  "use strict";

  const canvas = document.getElementById("ride");
  if (!canvas) return;

  // Drei.js wird nur für die Startseite nachgeladen. Falls CDN oder WebGL
  // nicht verfügbar sind, übernimmt die bisherige Canvas-Animation.
  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js");
  } catch (error) {
    console.warn("3D-Modell nicht verfügbar; nutze die Canvas-Fallback-Animation.", error);
    return fallback();
  }

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    console.warn("WebGL nicht verfügbar; nutze die Canvas-Fallback-Animation.", error);
    return fallback();
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a12, 0.011);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x070a12, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.45;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 0.1, 220);
  const isNarrow = () => window.innerWidth < 680;
  function placeCamera() {
    const narrow = isNarrow();
    camera.fov = narrow ? 50 : 39;
    camera.position.set(narrow ? 17 : 25, narrow ? 7 : 7.5, narrow ? 54 : 48);
    camera.lookAt(0, narrow ? 7.6 : 9.9, -5);
    camera.updateProjectionMatrix();
  }
  placeCamera();

  // ---------------------------------------------------------------- Licht
  scene.add(new THREE.HemisphereLight(0xbac9f0, 0x141925, 1.1));
  const moonLight = new THREE.DirectionalLight(0xc7d7ff, 2.2);
  moonLight.position.set(-14, 30, 16);
  moonLight.castShadow = true;
  const shadowSize = window.innerWidth < 680 ? 1024 : 2048;
  moonLight.shadow.mapSize.set(shadowSize, shadowSize);
  moonLight.shadow.camera.left = -22;
  moonLight.shadow.camera.right = 22;
  moonLight.shadow.camera.top = 26;
  moonLight.shadow.camera.bottom = -14;
  moonLight.shadow.camera.far = 90;
  moonLight.shadow.bias = -0.0004;
  scene.add(moonLight);

  // ------------------------------------------------------------ Werkstoffe
  const std = (color, metalness, roughness, extra = {}) =>
    new THREE.MeshStandardMaterial({ color, metalness, roughness, ...extra });
  const white = std(0xe9edf2, 0.35, 0.42);
  const steel = std(0x8794a8, 0.8, 0.32);
  const darkSteel = std(0x2b3447, 0.75, 0.4);
  const rubber = std(0x10151e, 0.1, 0.75);
  const chrome = std(0xcfd6df, 0.9, 0.22);
  const hubRed = std(0xc2302d, 0.45, 0.3);
  const stripeRed = std(0xc93a34, 0.3, 0.45);
  const stripeGreen = std(0x2a9461, 0.3, 0.45);
  const deckMat = std(0x8d96a5, 0.55, 0.5, { side: THREE.DoubleSide });
  const skirtMat = std(0x263a78, 0.2, 0.6, { side: THREE.DoubleSide });
  const stepMats = [0xd8452f, 0xe9b233, 0x2f9c6a].map((c) => std(c, 0.15, 0.55, { side: THREE.DoubleSide }));
  const groundMat = std(0x0d121c, 0.04, 0.92);
  const pitMat = std(0x0a0e16, 0.1, 0.9);
  const hullMat = std(0x1b2742, 0.5, 0.35);
  const seatMat = std(0x232a38, 0.1, 0.7);
  const roofMat = std(0xffffff, 0.3, 0.35);
  const cyanMat = std(0x35d6e6, 0.2, 0.3, { emissive: 0x1bb8d0, emissiveIntensity: 1.3 });
  const globeMat = std(0xfff3d6, 0, 0.4, { emissive: 0xffd9a0, emissiveIntensity: 0.85 });
  const windowMat = std(0xffe2a8, 0, 0.5, { emissive: 0xffc56b, emissiveIntensity: 1.1 });
  const flagMats = [0xd8452f, 0xe9b233, 0x2a6fc0, 0x2f9c6a].map((c) =>
    std(c, 0, 0.8, { side: THREE.DoubleSide, emissive: c, emissiveIntensity: 0.12 }));

  // Lauflicht in drei Phasen: drei Werkstoffe für die Birnen, drei für den
  // Lichthof. Pro Bild ändern sich nur sechs Zahlen, nicht hunderte Lampen.
  const lampMats = [0, 1, 2].map(() => std(0xffe2ac, 0.05, 0.25, { emissive: 0xffa53a, emissiveIntensity: 2 }));
  const glowTexture = (() => {
    const c = document.createElement("canvas");
    c.width = c.height = 64;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,236,200,1)");
    grad.addColorStop(0.25, "rgba(255,190,110,0.55)");
    grad.addColorStop(1, "rgba(255,150,60,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const glowMats = [0, 1, 2].map(() => new THREE.PointsMaterial({
    map: glowTexture, size: 1.5, sizeAttenuation: true, transparent: true, opacity: 0.8,
    blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));

  // -------------------------------------------------- Geometrie-Werkzeuge
  // Alle festen Teile werden pro Werkstoff zu einem einzigen Netz verschmolzen.
  // Das hält die Zahl der Zeichenaufrufe klein, obwohl das Modell aus
  // mehreren tausend Einzelteilen besteht.
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const Y_AXIS = v(0, 1, 0);
  function mergeGeometries(list) {
    let count = 0;
    for (const g of list) count += g.attributes.position.count;
    const position = new Float32Array(count * 3);
    const normal = new Float32Array(count * 3);
    let offset = 0;
    for (const g of list) {
      position.set(g.attributes.position.array, offset);
      normal.set(g.attributes.normal.array, offset);
      offset += g.attributes.position.count * 3;
      g.dispose();
    }
    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.BufferAttribute(position, 3));
    merged.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
    return merged;
  }
  function createBatch() {
    const parts = new Map();
    return {
      add(geometry, material, matrix) {
        const g = geometry.index ? geometry.toNonIndexed() : geometry;
        if (geometry.index) geometry.dispose();
        if (matrix) g.applyMatrix4(matrix);
        if (!parts.has(material)) parts.set(material, []);
        parts.get(material).push(g);
      },
      geometries() {
        return [...parts].map(([material, list]) => [material, mergeGeometries(list)]);
      },
      build(parent, cast = true, receive = true) {
        for (const [material, geometry] of this.geometries()) {
          const item = new THREE.Mesh(geometry, material);
          item.castShadow = cast;
          item.receiveShadow = receive;
          parent.add(item);
        }
      },
    };
  }
  function rod(batch, start, end, radius, material, segments = 7) {
    const dir = new THREE.Vector3().subVectors(end, start);
    const length = dir.length();
    const m = new THREE.Matrix4().compose(
      start.clone().add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(Y_AXIS, dir.normalize()),
      v(1, 1, 1),
    );
    batch.add(new THREE.CylinderGeometry(radius, radius, length, segments, 1), material, m);
  }
  function box(batch, w, h, d, material, x, y, z, rotY = 0) {
    const m = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    batch.add(new THREE.BoxGeometry(w, h, d), material, m);
  }
  function ball(batch, radius, material, p, squash = 1) {
    const m = new THREE.Matrix4().makeScale(1, squash, 1).setPosition(p.x, p.y, p.z);
    batch.add(new THREE.SphereGeometry(radius, 14, 10), material, m);
  }
  function ring(batch, radius, tubeRadius, y, material, segments = 96) {
    const m = new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, y, 0);
    batch.add(new THREE.TorusGeometry(radius, tubeRadius, 8, segments), material, m);
  }
  function drum(batch, rTop, rBottom, y0, y1, material, segments = 40) {
    const m = new THREE.Matrix4().makeTranslation(0, (y0 + y1) / 2, 0);
    batch.add(new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, segments, 1), material, m);
  }
  // Punkt auf einem Kreis um die Hochachse; psi = 0 zeigt nach vorn (+Z).
  const polar = (r, psi, y = 0) => v(Math.sin(psi) * r, y, Math.cos(psi) * r);
  // Kreisringsegment als Körper: Deck, Stufen und Verkleidungen des Podiums.
  function sector(batch, rIn, rOut, y0, y1, a0, a1, material, segments = 24) {
    const pos = [];
    const quad = (a, b, c, d) => { for (const p of [a, b, c, a, c, d]) pos.push(p.x, p.y, p.z); };
    for (let i = 0; i < segments; i++) {
      const p0 = a0 + (a1 - a0) * i / segments, p1 = a0 + (a1 - a0) * (i + 1) / segments;
      quad(polar(rIn, p0, y1), polar(rOut, p0, y1), polar(rOut, p1, y1), polar(rIn, p1, y1));
      quad(polar(rOut, p0, y0), polar(rOut, p1, y0), polar(rOut, p1, y1), polar(rOut, p0, y1));
      quad(polar(rIn, p1, y0), polar(rIn, p0, y0), polar(rIn, p0, y1), polar(rIn, p1, y1));
    }
    for (const a of [a0, a1]) {
      quad(polar(rIn, a, y0), polar(rOut, a, y0), polar(rOut, a, y1), polar(rIn, a, y1));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    batch.add(g, material);
  }
  function roundedRect(width, height, radius) {
    const shape = new THREE.Shape();
    const x = -width / 2, y = -height / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    return shape;
  }
  // Sammelt Lampen: je Phase ein Netz aus Birnen und eine Punktwolke für den
  // Lichthof drumherum.
  function createLamps() {
    const points = [[], [], []];
    return {
      add(p, phase) { points[((phase % 3) + 3) % 3].push(p); },
      build(parent, bulbRadius = 0.07) {
        points.forEach((list, phase) => {
          if (!list.length) return;
          const batch = createBatch();
          for (const p of list) {
            batch.add(new THREE.SphereGeometry(bulbRadius, 6, 4), lampMats[phase],
              new THREE.Matrix4().makeTranslation(p.x, p.y, p.z));
          }
          batch.build(parent, false, false);
          const halo = new THREE.Points(new THREE.BufferGeometry().setFromPoints(list), glowMats[phase]);
          halo.frustumCulled = false;
          parent.add(halo);
        });
      },
    };
  }
  // Beschriftung als gezeichnete Textur - keine Schriftdatei, kein Bild.
  function signTexture(text, width, height, fill, stroke) {
    const c = document.createElement("canvas");
    c.width = width;
    c.height = height;
    const g = c.getContext("2d");
    g.font = `900 ${Math.round(height * 0.74)}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    g.lineWidth = height * 0.11;
    g.strokeStyle = stroke;
    g.strokeText(text, width / 2, height * 0.54, width * 0.94);
    g.fillStyle = fill;
    g.fillText(text, width / 2, height * 0.54, width * 0.94);
    const texture = new THREE.CanvasTexture(c);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  // ------------------------------------------------------------ Hintergrund
  const starPositions = [];
  let seed = 812731;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 420; i++) {
    const theta = random() * Math.PI * 2;
    const y = 8 + random() * 40;
    const radius = 50 + random() * 40;
    starPositions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius - 16);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xdce7ff, size: 0.2, sizeAttenuation: true, transparent: true, opacity: 0.75, fog: false,
  }));
  scene.add(stars);

  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 40, 32), std(0xe8edf7, 0, 0.88, {
    emissive: 0x8791ad, emissiveIntensity: 0.5, fog: false,
  }));
  moon.position.set(21, 23, -34);
  scene.add(moon);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(160, 96), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ------------------------------------------------------------------ Maße
  // Aufbau wie beim echten Gerät: Das Gelenk des Auslegers sitzt vorn hinter
  // der Kasse. In Ruhe liegt der Ausleger waagerecht in der Grube des Podiums
  // und das Rad schwebt flach über dem Umlauf. Zwei Hydraulikzylinder heben
  // ihn auf 87 Grad; das Rad steht dann vorn über dem Eingang und zeigt mit
  // der Nabenkappe zum Publikum, die Rückwand bleibt dahinter stehen.
  const TAU = Math.PI * 2;
  const GONDOLAS = 20;
  const R = 8.0;              // Radkranz
  const RP = R + 0.45;        // Schwenkachse der Gondeln, knapp außerhalb
  const BOOM = 9.6;           // Gelenk bis Nabe
  const HUB_LIFT = 2.1;       // Nabenturm: Rad sitzt so hoch über dem Ausleger
  const PIVOT_Y = 1.0;        // Gelenkhöhe
  const DECK_Y = 1.3;         // Höhe des Umlaufs
  const DECK_IN = 6.5, DECK_OUT = 10.4;
  const GAP = 0.25;           // Lücke im Umlauf für Gelenk und Kasse (Bogenmaß)
  const STAIRS = 1.75;        // die Treppen laufen vorn bis hierher herum
  const WALL_R = 11.9, WALL_H = 4.1, WALL_HALF = 1.0;

  // ---------------------------------------------------------------- Podium
  const podium = new THREE.Group();
  podium.position.set(0, 0, -BOOM);
  scene.add(podium);
  {
    const b = createBatch();
    const lamps = createLamps();
    sector(b, DECK_IN, DECK_OUT, DECK_Y - 0.18, DECK_Y, GAP, TAU - GAP, deckMat, 56);
    sector(b, DECK_IN, DECK_IN + 0.08, 0, DECK_Y - 0.18, GAP, TAU - GAP, skirtMat, 56);
    sector(b, DECK_OUT - 0.08, DECK_OUT, 0, DECK_Y - 0.18, STAIRS, TAU - STAIRS, skirtMat, 32);
    // Drei Stufen in Regenbogenfarben, links und rechts der Kasse.
    for (let k = 0; k < 3; k++) {
      const rIn = DECK_OUT + k * 0.5;
      for (const [a0, a1] of [[GAP, STAIRS], [TAU - STAIRS, TAU - GAP]]) {
        sector(b, rIn, rIn + 0.5, 0, DECK_Y - (k + 1) * 0.325, a0, a1, stepMats[k], 16);
      }
    }
    // Geländer: außen um den hinteren Teil, innen rund um die Grube.
    function railing(radius, a0, a1, height, spacing) {
      const n = Math.max(2, Math.round((a1 - a0) * radius / spacing));
      for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * i / n;
        rod(b, polar(radius, a, DECK_Y), polar(radius, a, DECK_Y + height), 0.03, chrome, 6);
        if (i === n) break;
        const next = a0 + (a1 - a0) * (i + 1) / n;
        for (const h of [height, height * 0.55]) {
          rod(b, polar(radius, a, DECK_Y + h), polar(radius, next, DECK_Y + h), 0.022, chrome, 5);
        }
        rod(b, polar(radius, a, DECK_Y + height * 0.55), polar(radius, next, DECK_Y + 0.08), 0.014, stepMats[1], 4);
      }
    }
    railing(DECK_OUT - 0.14, STAIRS, TAU - STAIRS, 1.0, 1.0);
    railing(DECK_IN + 0.14, GAP + 0.05, TAU - GAP - 0.05, 0.9, 1.1);

    // Rückwand: Tragrahmen, Sockel, Lampenleiste und Wimpel. Das Wandbild
    // selbst kommt als Textur dazu, sobald sie geladen ist.
    const wallTop = DECK_Y + WALL_H;
    sector(b, WALL_R, WALL_R + 0.1, 0, DECK_Y, Math.PI - WALL_HALF, Math.PI + WALL_HALF, skirtMat, 24);
    sector(b, DECK_OUT, WALL_R, DECK_Y - 0.18, DECK_Y, Math.PI - WALL_HALF, Math.PI + WALL_HALF, deckMat, 24);
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - WALL_HALF + (2 * WALL_HALF) * i / 8;
      rod(b, polar(WALL_R - 0.06, a, 0), polar(WALL_R - 0.06, a, wallTop + 0.25), 0.07, white, 8);
      rod(b, polar(WALL_R + 0.5, a, 0), polar(WALL_R - 0.06, a, wallTop - 0.4), 0.04, darkSteel, 6);
      // Wimpel auf jedem Pfosten.
      const top = polar(WALL_R - 0.06, a, wallTop + 2.0);
      rod(b, polar(WALL_R - 0.06, a, wallTop + 0.25), top, 0.025, chrome, 5);
      const out = polar(1, a + Math.PI / 2, 0);
      const flag = new THREE.BufferGeometry().setFromPoints([
        top, top.clone().add(v(0, -0.62, 0)), top.clone().add(v(0, -0.31, 0)).addScaledVector(out, 1.05),
      ]);
      flag.computeVertexNormals();
      b.add(flag, flagMats[i % flagMats.length]);
    }
    const lampCount = 72;
    for (let i = 0; i <= lampCount; i++) {
      const a = Math.PI - WALL_HALF + (2 * WALL_HALF) * i / lampCount;
      lamps.add(polar(WALL_R - 0.16, a, wallTop + 0.12), i);
      if (i % 2 === 0) lamps.add(polar(WALL_R - 0.16, a, DECK_Y + 0.1), -i / 2);
    }
    rod(b, polar(WALL_R - 0.06, Math.PI - 0.36, wallTop + 0.3), polar(WALL_R - 0.06, Math.PI - 0.36, wallTop + 2.3), 0.06, white, 6);
    rod(b, polar(WALL_R - 0.06, Math.PI + 0.36, wallTop + 0.3), polar(WALL_R - 0.06, Math.PI + 0.36, wallTop + 2.3), 0.06, white, 6);

    // Kugelleuchten an den Ecken des Podiums.
    // Die vorderen stehen seitlich außerhalb des Radkreises: Aufgerichtet
    // reichen die Gondeln bis knapp zehn Meter neben die Mitte.
    for (const a of [0.95, -0.95, 1.95, -1.95]) {
      const foot = polar(DECK_OUT + 3.0, a, 0);
      rod(b, foot, foot.clone().setY(4.4), 0.07, white, 8);
      for (const [dx, dy, dz] of [[0, 0.45, 0], [0.42, 0, 0], [-0.42, 0, 0], [0, 0, 0.42], [0, 0, -0.42]]) {
        ball(b, 0.3, globeMat, foot.clone().add(v(dx, 4.5 + dy, dz)));
      }
    }
    b.build(podium);
    lamps.build(podium, 0.075);

    const pit = new THREE.Mesh(new THREE.CircleGeometry(DECK_IN + 0.05, 48), pitMat);
    pit.rotation.x = -Math.PI / 2;
    pit.position.y = 0.02;
    pit.receiveShadow = true;
    podium.add(pit);

    // Wandbild: acht Tafeln nebeneinander auf einer gebogenen Fläche.
    const wallPos = [], wallUv = [], wallIdx = [];
    const wallSegs = 48;
    for (let i = 0; i <= wallSegs; i++) {
      const u = i / wallSegs;
      const theta = -WALL_HALF + 2 * WALL_HALF * u;
      const x = Math.sin(theta) * WALL_R, z = -Math.cos(theta) * WALL_R;
      wallPos.push(x, DECK_Y, z, x, wallTop, z);
      wallUv.push(u, 0, u, 1);
      if (i < wallSegs) wallIdx.push(i * 2, i * 2 + 2, i * 2 + 1, i * 2 + 1, i * 2 + 2, i * 2 + 3);
    }
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(wallPos, 3));
    wallGeo.setAttribute("uv", new THREE.Float32BufferAttribute(wallUv, 2));
    wallGeo.setIndex(wallIdx);
    wallGeo.computeVertexNormals();
    const wallMat = std(0x1c2a52, 0.05, 0.8, { side: THREE.DoubleSide });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.receiveShadow = true;
    podium.add(wall);
    new THREE.TextureLoader().load("/assets/img/rueckwand.webp", (texture) => {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      wallMat.color.set(0xffffff);
      wallMat.map = texture;
      // Die Wand wird am Platz von unten angestrahlt; hier leuchtet sie
      // etwas von selbst, statt dafür eigene Scheinwerfer zu rechnen.
      wallMat.emissive.set(0xffffff);
      wallMat.emissiveMap = texture;
      wallMat.emissiveIntensity = 0.42;
      wallMat.needsUpdate = true;
      renderOnce();
    });

    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.6, 1.9), new THREE.MeshBasicMaterial({
      map: signTexture("MONDLIFT", 1024, 226, "#fff1c4", "#c2302d"), transparent: true, side: THREE.DoubleSide,
    }));
    sign.position.set(0, wallTop + 1.45, -WALL_R + 0.75);
    podium.add(sign);
  }

  // ------------------------------------------------------------------ Kasse
  {
    const b = createBatch();
    const lamps = createLamps();
    const kz = 4.2;
    box(b, 2.8, 2.3, 1.8, skirtMat, 0, 1.15, kz);
    box(b, 2.86, 0.16, 1.86, stepMats[0], 0, 0.78, kz);
    box(b, 2.86, 0.16, 1.86, stepMats[1], 0, 0.6, kz);
    box(b, 3.3, 0.14, 2.4, white, 0, 2.37, kz);
    box(b, 1.9, 0.85, 0.06, windowMat, 0, 1.55, kz + 0.9);
    box(b, 0.06, 0.85, 1.0, windowMat, 1.4, 1.55, kz);
    box(b, 0.06, 0.85, 1.0, windowMat, -1.4, 1.55, kz);
    for (let i = 0; i <= 12; i++) lamps.add(v(-1.6 + i * 3.2 / 12, 2.5, kz + 1.18), i);
    b.build(scene);
    lamps.build(scene, 0.06);
    const kasse = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 0.62), new THREE.MeshBasicMaterial({
      map: signTexture("KASSE", 512, 138, "#fff1c4", "#c2302d"), transparent: true,
    }));
    kasse.position.set(0, 2.82, kz + 1.0);
    scene.add(kasse);
  }

  // ------------------------------------------------------------- Auflieger
  {
    const b = createBatch();
    box(b, 2.4, 0.3, 12.6, darkSteel, 0, 0.55, -5.4);
    for (const side of [-1, 1]) {
      box(b, 0.26, 0.5, 12.9, steel, side * 1.25, 0.5, -5.4);
      for (const z of [-9.9, -11.1]) {
        const m = new THREE.Matrix4().makeRotationZ(Math.PI / 2).setPosition(side * 1.55, 0.5, z);
        b.add(new THREE.CylinderGeometry(0.5, 0.5, 0.42, 20), rubber, m);
        b.add(new THREE.CylinderGeometry(0.26, 0.26, 0.44, 12), steel, m);
      }
      for (const z of [-0.6, -7.8]) {
        box(b, 2.2, 0.2, 0.3, steel, side * 2.4, 0.6, z);
        rod(b, v(side * 3.4, 0.05, z), v(side * 3.4, 0.7, z), 0.1, chrome, 8);
        box(b, 0.6, 0.06, 0.6, darkSteel, side * 3.4, 0.03, z);
      }
      box(b, 0.28, 1.15, 1.1, white, side * 1.0, PIVOT_Y - 0.3, 0);
    }
    rod(b, v(-1.3, PIVOT_Y, 0), v(1.3, PIVOT_Y, 0), 0.18, chrome, 14);
    b.build(scene);
  }

  // -------------------------------------------------------------- Ausleger
  // Dreht um die Gelenkachse (X). Lokal zeigt er nach -Z.
  const boom = new THREE.Group();
  boom.position.set(0, PIVOT_Y, 0);
  scene.add(boom);
  {
    const b = createBatch();
    box(b, 1.3, 0.62, BOOM + 1.6, white, 0, 0, -BOOM / 2 - 0.5);
    // Farbstreifen auf der Oberseite; aufgerichtet sieht man sie durch die
    // Speichen hindurch.
    box(b, 0.3, 0.03, BOOM - 0.4, stripeRed, -0.38, 0.32, -BOOM / 2 + 0.4);
    box(b, 0.3, 0.03, BOOM - 0.4, stripeGreen, 0.38, 0.32, -BOOM / 2 + 0.4);
    for (const side of [-1, 1]) {
      box(b, 0.05, 0.3, BOOM - 1, darkSteel, side * 0.66, -0.05, -BOOM / 2);
      // Konsole, an der die Kolbenstange angreift.
      box(b, 0.42, 0.36, 0.5, darkSteel, side * 0.8, -0.15, -5.6);
    }
    // Nabenturm mit Drehkranz und Antrieb.
    const tower = new THREE.Matrix4().makeTranslation(0, 0, -BOOM);
    const towerDrum = (rTop, rBottom, y0, y1, material) => b.add(
      new THREE.CylinderGeometry(rTop, rBottom, y1 - y0, 32, 1), material,
      tower.clone().multiply(new THREE.Matrix4().makeTranslation(0, (y0 + y1) / 2, 0)));
    towerDrum(0.85, 1.3, 0.3, HUB_LIFT - 0.62, white);
    towerDrum(1.05, 1.05, HUB_LIFT - 0.62, HUB_LIFT - 0.38, darkSteel);
    box(b, 0.7, 0.7, 0.9, darkSteel, 0.95, 0.66, -BOOM + 0.2);
    b.build(boom);
  }

  // Hydraulik: Der Zylinder sitzt auf dem Auflieger, die Kolbenstange greift
  // am Ausleger an. Beide werden pro Bild neu zwischen ihre Lagerpunkte gelegt.
  const rams = [-1, 1].map((side) => {
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 14), darkSteel);
    const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1, 12), chrome);
    barrel.castShadow = piston.castShadow = true;
    scene.add(barrel, piston);
    return {
      barrel, piston,
      foot: v(side * 0.86, 0.78, -2.6),
      head: v(side * 0.86, -0.15, -5.6), // im System des Auslegers
    };
  });
  const BARREL_LEN = 3.4, PISTON_LEN = 3.4;
  const ramHead = v(0, 0, 0), ramDir = v(0, 0, 0);
  function placeAlong(item, start, dir, length) {
    item.scale.set(1, length, 1);
    item.position.copy(start).addScaledVector(dir, length / 2);
    item.quaternion.setFromUnitVectors(Y_AXIS, dir);
  }
  function updateRams() {
    for (const ram of rams) {
      boom.localToWorld(ramHead.copy(ram.head));
      const length = ramDir.subVectors(ramHead, ram.foot).length();
      ramDir.normalize();
      placeAlong(ram.barrel, ram.foot, ramDir, Math.min(BARREL_LEN, length));
      placeAlong(ram.piston, ramHead, ramDir.negate(), Math.min(PISTON_LEN, length - 0.05));
    }
  }

  // ------------------------------------------------------------------- Rad
  const wheelSpin = new THREE.Group();
  wheelSpin.position.set(0, HUB_LIFT, -BOOM);
  boom.add(wheelSpin);
  {
    const b = createBatch();
    const lamps = createLamps();
    const circle = (r, a, y = 0) => v(Math.cos(a) * r, y, Math.sin(a) * r);

    // Kranz als Fachwerk: Außenrohr, Innenrohr, Zickzack dazwischen.
    ring(b, R - 0.1, 0.15, 0, white, 120);
    ring(b, R - 1.05, 0.07, 0, white, 100);
    ring(b, R * 0.52, 0.06, 0, steel, 80);

    // Nabe: Trommel, Kegel, rote Kappe.
    drum(b, 1.3, 1.3, -0.3, 0.4, white);
    drum(b, 0.95, 1.25, 0.4, 1.3, white);
    b.add(new THREE.SphereGeometry(0.95, 32, 12, 0, TAU, 0, Math.PI / 2), hubRed,
      new THREE.Matrix4().makeScale(1, 0.55, 1).setPosition(0, 1.3, 0));
    ring(b, 1.32, 0.05, 0.42, chrome, 48);
    for (let i = 0; i < 24; i++) lamps.add(circle(1.36, i / 24 * TAU, 0.5), i);

    const step = TAU / GONDOLAS;
    for (let i = 0; i < GONDOLAS; i++) {
      const a = i * step, mid = a + step / 2;
      // Untere Speiche in der Radebene, zur Gondel hin.
      rod(b, circle(1.25, a, -0.1), circle(R - 0.1, a, 0), 0.085, white, 8);
      // Obere Abspannung vom Nabenkegel zum Kranz, um eine halbe Teilung
      // versetzt. Von vorn ergibt das den dichten Speichenstern.
      const top = circle(0.98, mid, 1.22), foot = circle(R - 0.1, mid, 0.1);
      rod(b, top, foot, 0.05, white, 6);
      for (let k = 1; k <= 6; k++) {
        lamps.add(top.clone().lerp(foot, 0.12 + k * 0.135).add(v(0, 0.09, 0)), k);
      }
      // Zickzack im Kranz und Verband zum Mittelring.
      rod(b, circle(R - 0.1, a, 0), circle(R - 1.05, mid, 0), 0.035, steel, 5);
      rod(b, circle(R - 1.05, mid, 0), circle(R - 0.1, a + step, 0), 0.035, steel, 5);
      rod(b, circle(R * 0.52, a, 0), circle(R - 1.05, mid, 0), 0.03, steel, 5);
      rod(b, circle(R * 0.52, a + step, 0), circle(R - 1.05, mid, 0), 0.03, steel, 5);
      // Zwei Konsolen je Gondel tragen die Schwenkachse.
      const radial = circle(1, a), tangent = v(-Math.sin(a), 0, Math.cos(a));
      for (const side of [-1, 1]) {
        const inner = radial.clone().multiplyScalar(R - 0.15).addScaledVector(tangent, side * 0.8);
        const outer = radial.clone().multiplyScalar(RP).addScaledVector(tangent, side * 0.8);
        rod(b, inner, outer, 0.05, white, 6);
        rod(b, inner.clone().add(v(0, 0.3, 0)).addScaledVector(radial, -0.5), outer, 0.03, steel, 5);
      }
      // Lampenkranz auf der Felge.
      for (let k = 0; k < 6; k++) lamps.add(circle(R - 0.1, a + k * step / 6, 0.2), i * 6 + k);
    }
    b.build(wheelSpin);
    lamps.build(wheelSpin, 0.095);
  }

  // --------------------------------------------------------------- Gondeln
  // Eine Gondel wird einmal gebaut und zwanzigmal als Instanz gezeichnet.
  // Ursprung ist die Schwenkachse am Dach, X zeigt in Fahrtrichtung: zwei
  // Sitze hintereinander in einer Wanne mit runden Enden, darüber ein offener
  // Rohrkäfig und ein farbiges Dach.
  const gondolaParts = [];
  {
    const b = createBatch();
    const hull = new THREE.Shape();
    hull.moveTo(-0.84, -1.45);
    hull.lineTo(0.84, -1.45);
    hull.quadraticCurveTo(1.12, -1.45, 1.1, -1.15);
    hull.lineTo(1.05, -0.93);
    hull.lineTo(-1.05, -0.93);
    hull.lineTo(-1.1, -1.15);
    hull.quadraticCurveTo(-1.12, -1.45, -0.84, -1.45);
    b.add(new THREE.ExtrudeGeometry(hull, {
      depth: 0.8, bevelEnabled: true, bevelSegments: 2, bevelSize: 0.03, bevelThickness: 0.03, curveSegments: 6,
    }), hullMat, new THREE.Matrix4().makeTranslation(0, 0, -0.4));
    box(b, 1.9, 0.07, 0.9, cyanMat, 0, -1.13, 0);
    box(b, 2.14, 0.06, 0.92, white, 0, -0.92, 0);
    for (const x of [-1.11, 1.11]) for (const z of [-0.24, 0.24]) ball(b, 0.1, cyanMat, v(x, -1.22, z));

    // Rohrkäfig.
    for (const z of [-0.43, 0.43]) {
      for (const x of [-0.99, -0.33, 0.33, 0.99]) rod(b, v(x, -0.92, z), v(x, -0.25, z), 0.026, white, 6);
      rod(b, v(-0.99, -0.58, z), v(0.99, -0.58, z), 0.022, white, 5);
      rod(b, v(-0.99, -0.25, z), v(0.99, -0.25, z), 0.026, white, 5);
    }
    for (const x of [-0.99, 0.99]) {
      rod(b, v(x, -0.58, -0.43), v(x, -0.58, 0.43), 0.022, white, 5);
      rod(b, v(x, -0.25, -0.43), v(x, -0.25, 0.43), 0.026, white, 5);
      rod(b, v(x, -0.92, 0), v(x, -0.25, 0), 0.022, white, 5);
    }
    // Dach.
    b.add(new THREE.ExtrudeGeometry(roundedRect(2.08, 0.96, 0.22), { depth: 0.06, bevelEnabled: false, curveSegments: 5 }),
      roofMat, new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(0, -0.17, 0));
    // Aufhängung: zwei Böcke vom Dach zur Schwenkachse.
    for (const x of [-0.8, 0.8]) {
      rod(b, v(x, 0, 0), v(x, -0.2, -0.36), 0.035, white, 6);
      rod(b, v(x, 0, 0), v(x, -0.2, 0.36), 0.035, white, 6);
      ball(b, 0.07, chrome, v(x, 0, 0));
    }
    // Zwei Sitze hintereinander, Blick in Fahrtrichtung.
    for (const x of [-0.55, 0.32]) {
      box(b, 0.5, 0.1, 0.68, seatMat, x + 0.05, -0.86, 0);
      box(b, 0.09, 0.5, 0.68, seatMat, x - 0.22, -0.62, 0);
    }
    const roofColors = [0xd23a35, 0xe8b92e, 0x2c9a5b, 0x2a6fc0, 0xe07a2a].map((c) => new THREE.Color(c));
    for (const [material, geometry] of b.geometries()) {
      const part = new THREE.InstancedMesh(geometry, material, GONDOLAS);
      part.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      part.castShadow = true;
      part.receiveShadow = true;
      part.frustumCulled = false;
      if (material === roofMat) {
        for (let i = 0; i < GONDOLAS; i++) part.setColorAt(i, roofColors[i % roofColors.length]);
      }
      scene.add(part);
      gondolaParts.push(part);
    }
  }

  // Warmes Licht vom Platz: zwei Strahler vorn, einer in der Grube.
  for (const [x, y, z, power] of [[11, 5.5, 5, 620], [-11, 5.5, 5, 620], [0, 2.4, -BOOM + 3, 320]]) {
    const light = new THREE.PointLight(0xffb866, power, 60, 2);
    light.position.set(x, y, z);
    scene.add(light);
  }

  // ---------------------------------------------------------------- Fahrt
  // Ablauf wie am Platz: Einsteigen bei stehendem, flachem Rad - anfahren,
  // bis die Gondeln ausschwenken - aufrichten - oben halten - absenken -
  // auslaufen. Die Reihenfolge ist zwingend: Erst die Drehzahl hält die
  // Fahrgäste im Sitz, dann darf das Rad kippen.
  const PHASE = { stand: 4, spinUp: 8, raise: 10, hold: 12, lower: 10, spinDown: 9 };
  const T_SPIN = PHASE.stand;
  const T_RAISE = T_SPIN + PHASE.spinUp;
  const T_HOLD = T_RAISE + PHASE.raise;
  const T_LOWER = T_HOLD + PHASE.hold;
  const T_SLOW = T_LOWER + PHASE.lower;
  const T_END = T_SLOW + PHASE.spinDown;
  const MAX_TILT = THREE.MathUtils.degToRad(87);
  // 14 Umdrehungen in der Minute, wie für den Mondlift angegeben.
  const MAX_SPIN = 14 * TAU / 60;
  // Fliehbeschleunigung an der Gondel bei voller Drehzahl im Verhältnis zur
  // Erdbeschleunigung: omega² · r / g mit r = 9,5 m.
  const MAX_CENTRIFUGAL = MAX_SPIN * MAX_SPIN * 9.5 / 9.81;
  const smooth = (x) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
  function rideState(time) {
    const t = ((time % T_END) + T_END) % T_END;
    const speed = t < T_SLOW ? smooth((t - T_SPIN) / PHASE.spinUp) : 1 - smooth((t - T_SLOW) / PHASE.spinDown);
    const lift = t < T_LOWER ? smooth((t - T_RAISE) / PHASE.raise) : 1 - smooth((t - T_LOWER) / PHASE.lower);
    return { speed, lift };
  }

  const clock = new THREE.Clock();
  const gravity = v(0, -1, 0);
  const wheelCenter = new THREE.Vector3();
  const wheelQuat = new THREE.Quaternion();
  const gondolaMatrix = new THREE.Matrix4();
  const gPivot = v(0, 0, 0), gRadial = v(0, 0, 0), gTangent = v(0, 0, 0), gUp = v(0, 0, 0), gSide = v(0, 0, 0);
  // Wer die Seite mit ?t=30 aufruft, sieht die Anlage in genau diesem
  // Augenblick der Fahrt stehen - praktisch zum Vergleichen mit Fotos.
  const frozenAt = Number.parseFloat(new URLSearchParams(location.search).get("t") ?? "");
  const frozen = Number.isFinite(frozenAt);
  let rideTime = T_SPIN;      // die Seite beginnt mit dem Anfahren
  let spinAngle = 0.4;
  let frameId = 0;
  let stillDrawn = false;

  // Stellt die ganze Anlage für einen Zeitpunkt ein.
  function pose(time, angle) {
    const { speed, lift } = rideState(time);
    boom.rotation.x = MAX_TILT * lift;
    wheelSpin.rotation.y = -angle;
    boom.updateMatrixWorld(true);
    updateRams();

    for (let p = 0; p < 3; p++) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 7 - p * TAU / 3);
      lampMats[p].emissiveIntensity = 0.7 + 2.3 * pulse;
      glowMats[p].opacity = 0.3 + 0.6 * pulse;
    }

    const centrifugal = MAX_CENTRIFUGAL * speed * speed;
    wheelSpin.getWorldPosition(wheelCenter);
    wheelSpin.getWorldQuaternion(wheelQuat);
    for (let i = 0; i < GONDOLAS; i++) {
      const a = i / GONDOLAS * TAU;
      wheelSpin.localToWorld(gPivot.set(Math.cos(a) * RP, 0, Math.sin(a) * RP));
      gRadial.copy(gPivot).sub(wheelCenter).normalize();
      gTangent.set(-Math.sin(a), 0, Math.cos(a)).applyQuaternion(wheelQuat).normalize();
      // Die Gondel kann nur um ihre Achse entlang der Felge schwenken. Also
      // zählt von der Schwerkraft nur der Teil senkrecht zu dieser Achse;
      // dazu kommt die Fliehkraft nach außen. Die Summe ist "unten", ihr
      // Gegenteil "oben".
      gUp.copy(gravity).addScaledVector(gTangent, -gravity.dot(gTangent))
        .addScaledVector(gRadial, centrifugal).normalize().negate();
      gSide.crossVectors(gTangent, gUp).normalize();
      gondolaMatrix.makeBasis(gTangent, gUp, gSide).setPosition(gPivot);
      for (const part of gondolaParts) part.setMatrixAt(i, gondolaMatrix);
    }
    for (const part of gondolaParts) part.instanceMatrix.needsUpdate = true;
  }

  function drawStill() {
    // Standbild: Rad halb aufgerichtet, Gondeln ausgeschwenkt.
    if (frozen) pose(frozenAt, frozenAt * 0.9);
    else pose(T_RAISE + PHASE.raise * 0.62, 0.75);
    renderer.render(scene, camera);
    stillDrawn = true;
  }
  const isStill = () => frozen || reducedMotion.matches;
  // Nach dem Laden der Textur einmal neu zeichnen, falls nichts läuft.
  function renderOnce() {
    if (isStill()) drawStill();
  }

  // Sobald der Text die Bühne verdeckt, wird nicht mehr gezeichnet. Das
  // Scrollen durch die Seite bleibt so frei von der Last der Szene.
  let onStage = true;
  const hero = document.querySelector(".hero");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      onStage = entry.isIntersecting;
      if (onStage) { clock.getDelta(); windowStart = 0; animate(); }
    }).observe(hero);
  }

  // Schafft ein Gerät die Szene nicht flüssig, wird sie schrittweise
  // leichter: erst weniger Pixel, dann ohne Schatten. Gezählt wird in
  // Fenstern von zwei Sekunden; zwei langsame Fenster in Folge lösen aus.
  // Die erste Sekunde zählt nicht, weil dort noch übersetzt wird.
  let pixelRatioCap = 1.6;
  let quality = 2, slowFrames = 0, windowStart = 0, windowFrames = 0;
  function watchFrameRate(now) {
    if (!windowStart) { windowStart = now + 1000; windowFrames = 0; return; }
    if (now < windowStart) return;
    windowFrames++;
    const span = now - windowStart;
    if (span < 2000) return;
    const fps = windowFrames * 1000 / span;
    windowStart = now;
    windowFrames = 0;
    slowFrames = fps < 27 ? slowFrames + 1 : 0;
    if (slowFrames < 2 || quality === 0) return;
    slowFrames = 0;
    quality--;
    if (quality === 1) {
      pixelRatioCap = 1;
      resize();
    } else {
      moonLight.castShadow = false;
      renderer.shadowMap.enabled = false;
      scene.traverse((item) => { if (item.material) item.material.needsUpdate = true; });
    }
  }

  function animate(now = 0) {
    cancelAnimationFrame(frameId);
    if (document.hidden || !onStage) return;
    if (isStill()) {
      if (!stillDrawn) drawStill();
      return;
    }
    frameId = requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    rideTime += dt;
    spinAngle = (spinAngle + rideState(rideTime).speed * MAX_SPIN * dt) % TAU;
    stars.rotation.y = rideTime * 0.002;
    pose(rideTime, spinAngle);
    renderer.render(scene, camera);
    if (now) watchFrameRate(now);
  }

  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelRatioCap));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    placeCamera();
    if (isStill()) drawStill();
  }
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return cancelAnimationFrame(frameId);
    clock.getDelta();
    windowStart = 0;
    animate();
  });
  reducedMotion.addEventListener?.("change", () => {
    stillDrawn = false;
    clock.getDelta();
    animate();
  });
  animate();

  function fallback() {
    const script = document.createElement("script");
    script.src = "/assets/js/enterprise.js";
    script.defer = true;
    document.body.appendChild(script);
  }
})();
