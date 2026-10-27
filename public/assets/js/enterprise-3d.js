/*
 * Mondlift: prozedurales 3D-Modell eines historischen Huss Enterprise.
 * Die Szene ist absichtlich aus einfachen, echten 3D-Körpern aufgebaut:
 * Stahlrohre, Doppelkranz, Fachwerk, Nabenkappe und offene Gondelkäfige.
 * Keine externen Bilder und kein fremdes 3D-Modell werden geladen.
 */
(async () => {
  "use strict";

  const canvas = document.getElementById("ride");
  if (!canvas) return;

  // Drei.js wird nur für die Startseite nachgeladen. Falls CDN oder WebGL
  // nicht verfügbar sind, übernimmt die bisherige Canvas-Animation.
  let THREE;
  try {
    THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js");
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
  scene.fog = new THREE.FogExp2(0x070a12, 0.008);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.setClearColor(0x070a12, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const camera = new THREE.PerspectiveCamera(39, window.innerWidth / window.innerHeight, 0.1, 180);
  const isNarrow = () => window.innerWidth < 680;
  function placeCamera() {
    const narrow = isNarrow();
    camera.fov = narrow ? 47 : 39;
    camera.position.set(narrow ? 19 : 16, narrow ? 15 : 12, narrow ? 34 : 29);
    camera.lookAt(0, 7.2, 0);
    camera.updateProjectionMatrix();
  }
  placeCamera();

  // Nachtumgebung und weiches Mondlicht.
  scene.add(new THREE.HemisphereLight(0xbac9f0, 0x111521, 1.45));
  const moonLight = new THREE.DirectionalLight(0xc7d7ff, 3.0);
  moonLight.position.set(-10, 22, 12);
  moonLight.castShadow = true;
  moonLight.shadow.mapSize.set(1024, 1024);
  moonLight.shadow.camera.left = -18;
  moonLight.shadow.camera.right = 18;
  moonLight.shadow.camera.top = 22;
  moonLight.shadow.camera.bottom = -10;
  scene.add(moonLight);
  const warmFill = new THREE.PointLight(0xffa33e, 28, 34, 2);
  warmFill.position.set(3, 7, 8);
  scene.add(warmFill);

  const steel = new THREE.MeshStandardMaterial({ color: 0x77859a, metalness: 0.82, roughness: 0.31 });
  const brightSteel = new THREE.MeshStandardMaterial({ color: 0xc4cbd5, metalness: 0.88, roughness: 0.24 });
  const darkSteel = new THREE.MeshStandardMaterial({ color: 0x303b50, metalness: 0.78, roughness: 0.38 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x111722, metalness: 0.15, roughness: 0.72 });
  const shellColors = [0xc33e4b, 0x2875bd, 0x26805b, 0xd4a13b, 0x9d4c91];
  const shells = shellColors.map((color) => new THREE.MeshStandardMaterial({
    color, metalness: 0.34, roughness: 0.29, side: THREE.DoubleSide,
  }));
  const lampMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd58a, emissive: 0xff9b2f, emissiveIntensity: 2.1, metalness: 0.1, roughness: 0.22,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x101521, metalness: 0.18, roughness: 0.62 });
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x0b101b, roughness: 0.92, metalness: 0.04 });

  function mesh(geometry, material, parent, cast = true, receive = true) {
    const item = new THREE.Mesh(geometry, material);
    item.castShadow = cast;
    item.receiveShadow = receive;
    parent.add(item);
    return item;
  }
  function rod(parent, start, end, radius, material, radialSegments = 8) {
    const direction = new THREE.Vector3().subVectors(end, start);
    const length = direction.length();
    const item = mesh(new THREE.CylinderGeometry(radius, radius, length, radialSegments, 1), material, parent);
    item.position.copy(start).add(end).multiplyScalar(0.5);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
    return item;
  }
  function tube(parent, points, radius, material, segments = 64) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), segments, radius, 8, false), material, parent);
  }
  function torus(parent, radius, tubeRadius, material, y = 0) {
    const item = mesh(new THREE.TorusGeometry(radius, tubeRadius, 10, 120), material, parent);
    item.rotation.x = Math.PI / 2;
    item.position.y = y;
    return item;
  }

  // Hintergrund: dezente Sterne, Mond und eine dunkle Horizontfläche.
  const starPositions = [];
  let seed = 812731;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 360; i++) {
    const theta = random() * Math.PI * 2;
    const y = 8 + random() * 28;
    const radius = 32 + random() * 30;
    starPositions.push(Math.cos(theta) * radius, y, Math.sin(theta) * radius - 16);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({
    color: 0xdce7ff, size: 0.13, sizeAttenuation: true, transparent: true, opacity: 0.72,
  }));
  scene.add(stars);

  const moon = mesh(new THREE.SphereGeometry(1.35, 40, 32), new THREE.MeshStandardMaterial({
    color: 0xe8edf7, emissive: 0x6c7898, emissiveIntensity: 0.28, roughness: 0.88,
  }), scene, false, false);
  moon.position.set(12.8, 16.4, -14);
  const moonGlow = new THREE.PointLight(0x9eafd9, 12, 25, 2);
  moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  // Boden bleibt dezent; der Schwerpunkt ist das beleuchtete Stahlrad.
  const ground = mesh(new THREE.CircleGeometry(38, 80), groundMat, scene, false, true);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  const horizon = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 20),
    new THREE.MeshBasicMaterial({ color: 0x070a12, transparent: true, opacity: 0.72 }),
  );
  horizon.position.set(0, 1.4, -21);
  scene.add(horizon);

  // Kippachse und Träger: das Rad hebt sich um eine Achse an der hinteren
  // Felgenkante; dadurch wandert die Nabe von ca. 2,6 m auf über 10 m.
  const pivot = new THREE.Group();
  pivot.position.set(0, 2.6, 0);
  scene.add(pivot);

  const trailer = mesh(new THREE.BoxGeometry(5.2, 0.55, 9.4), darkSteel, pivot);
  trailer.position.set(0, 0.35, -3.4);
  const chassisRailA = mesh(new THREE.BoxGeometry(0.42, 0.72, 9.7), steel, pivot);
  chassisRailA.position.set(-1.65, 0.55, -3.5);
  const chassisRailB = chassisRailA.clone();
  chassisRailB.position.x = 1.65;
  pivot.add(chassisRailB);
  const pivotBeam = mesh(new THREE.BoxGeometry(4.1, 0.72, 1.05), brightSteel, pivot);
  pivotBeam.position.set(0, 1.0, -0.15);

  // Stützen und Hydraulikzylinder bleiben hinter der bewegten Radfläche.
  for (const side of [-1, 1]) {
    rod(pivot, new THREE.Vector3(side * 1.45, 0.9, -0.55), new THREE.Vector3(side * 1.45, 3.0, -6.0), 0.24, darkSteel, 12);
    rod(pivot, new THREE.Vector3(side * 1.1, 0.8, -0.4), new THREE.Vector3(side * 1.1, 4.0, -6.5), 0.105, brightSteel, 12);
    rod(pivot, new THREE.Vector3(side * 0.9, 0.65, -0.2), new THREE.Vector3(side * 0.9, 3.3, -6.0), 0.07, steel, 10);
  }

  const wheelTilt = new THREE.Group();
  pivot.add(wheelTilt);
  const R = 8.0;
  wheelTilt.position.set(0, 0, -R);
  const wheelSpin = new THREE.Group();
  wheelTilt.add(wheelSpin);

  // Doppelte Felge, innerer Ring und radialer Fachwerkträger.
  torus(wheelSpin, R, 0.16, brightSteel, 0.23);
  torus(wheelSpin, R, 0.16, brightSteel, -0.23);
  torus(wheelSpin, R - 0.52, 0.095, steel, 0.0);
  torus(wheelSpin, R * 0.51, 0.13, steel, 0.0);
  torus(wheelSpin, 1.85, 0.11, brightSteel, 0.0);

  const rimBulbs = [];
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * Math.PI * 2;
    for (const y of [-0.24, 0.24]) {
      const bulb = mesh(new THREE.SphereGeometry(0.075, 8, 8), lampMaterial, wheelSpin, false, false);
      bulb.position.set(Math.cos(a) * R, y, Math.sin(a) * R);
      rimBulbs.push(bulb);
    }
  }

  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    const radial = new THREE.Vector3(ca, 0, sa);
    const tangent = new THREE.Vector3(-sa, 0, ca);
    rod(wheelSpin, radial.clone().multiplyScalar(1.55).add(new THREE.Vector3(0, 0.08, 0)),
      radial.clone().multiplyScalar(R - 0.12).add(new THREE.Vector3(0, 0.08, 0)), 0.105, brightSteel, 10);
    rod(wheelSpin, radial.clone().multiplyScalar(1.55).add(new THREE.Vector3(0, -0.08, 0)),
      radial.clone().multiplyScalar(R - 0.12).add(new THREE.Vector3(0, -0.08, 0)), 0.085, steel, 10);

    // Dreiecke und Diagonalstreben zwischen Nabe, Ring und Felge.
    rod(wheelSpin, radial.clone().multiplyScalar(1.85), radial.clone().multiplyScalar(R - 0.2).add(tangent.clone().multiplyScalar(0.42)), 0.055, steel, 7);
    rod(wheelSpin, radial.clone().multiplyScalar(4.05), radial.clone().multiplyScalar(R - 0.2).add(tangent.clone().multiplyScalar(-0.42)), 0.052, steel, 7);
    rod(wheelSpin, radial.clone().multiplyScalar(4.05).add(tangent.clone().multiplyScalar(0.35)),
      radial.clone().multiplyScalar(4.05).add(tangent.clone().multiplyScalar(-0.35)), 0.045, darkSteel, 7);

    const armLamp = mesh(new THREE.SphereGeometry(0.095, 8, 8), lampMaterial, wheelSpin, false, false);
    armLamp.position.set(ca * 6.0, 0.14, sa * 6.0);
    rimBulbs.push(armLamp);
    const armLamp2 = armLamp.clone();
    armLamp2.position.y = -0.14;
    wheelSpin.add(armLamp2);
    rimBulbs.push(armLamp2);
  }

  // Mehrteilige Nabenkappe: Stahlring, glatte Kappe und Lampenkranz.
  const hub = mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.72, 64), brightSteel, wheelSpin);
  const hubFace = mesh(new THREE.CylinderGeometry(1.22, 1.22, 0.78, 64), new THREE.MeshStandardMaterial({
    color: 0x68768d, metalness: 0.9, roughness: 0.22,
  }), wheelSpin);
  hubFace.position.y = 0.02;
  torus(wheelSpin, 1.52, 0.075, lampMaterial, 0.4);
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2;
    const bulb = mesh(new THREE.SphereGeometry(0.09, 8, 8), lampMaterial, wheelSpin, false, false);
    bulb.position.set(Math.cos(a) * 1.58, 0.43, Math.sin(a) * 1.58);
  }

  // Jede Gondel ist ein eigener, gerundeter Käfig mit Dach, Sitz, Rückenschale
  // und feinen Rohrstreben. Sie bleibt als Körper räumlich und kann realistisch
  // zur resultierenden Kraft aus Schwerkraft und Rotation ausgerichtet werden.
  const gondolas = [];
  const hangerLines = [];
  function roundedPanel(width, height, radius) {
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
  function createGondola(index) {
    const group = new THREE.Group();
    scene.add(group);
    const shell = shells[index % shells.length];
    // Rückenschale, leicht gewölbt durch eine weich abgeschrägte Extrusion.
    const panel = mesh(new THREE.ExtrudeGeometry(roundedPanel(0.98, 1.08, 0.16), {
      depth: 0.16, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.045, bevelThickness: 0.045,
    }), shell, group);
    panel.position.set(0, 0.08, 0.34);
    // Umlaufender dunkler Stoßschutz und farbiger Zierstreifen.
    const bumper = mesh(new THREE.BoxGeometry(1.08, 0.12, 0.92), rubber, group);
    bumper.position.set(0, -0.57, 0);
    const stripe = mesh(new THREE.BoxGeometry(0.88, 0.065, 0.08), brightSteel, group, false, false);
    stripe.position.set(0, 0.12, 0.49);
    // Dach mit Metallkante und Bodenblech.
    const roof = mesh(new THREE.BoxGeometry(1.16, 0.12, 1.0), brightSteel, group);
    roof.position.y = 0.73;
    const floor = mesh(new THREE.BoxGeometry(1.02, 0.09, 0.9), darkSteel, group);
    floor.position.y = -0.62;
    // Seitliche und vordere Gitterstäbe, mit offenem Einstieg statt Vollkörper.
    for (const x of [-0.51, 0.51]) {
      for (const z of [-0.43, 0.43]) {
        rod(group, new THREE.Vector3(x, -0.59, z), new THREE.Vector3(x, 0.65, z), 0.035, brightSteel, 7);
      }
      rod(group, new THREE.Vector3(x, 0.28, -0.45), new THREE.Vector3(x, 0.28, 0.45), 0.03, steel, 7);
    }
    for (const x of [-0.34, 0, 0.34]) {
      rod(group, new THREE.Vector3(x, -0.55, -0.44), new THREE.Vector3(x, 0.65, -0.44), 0.026, brightSteel, 7);
    }
    // Sitzfläche und Lehne sind hinter den Stäben sichtbar.
    const seat = mesh(new THREE.BoxGeometry(0.76, 0.14, 0.46), darkMat, group);
    seat.position.set(0, -0.15, -0.02);
    const backrest = mesh(new THREE.BoxGeometry(0.76, 0.56, 0.12), darkMat, group);
    backrest.position.set(0, 0.14, 0.19);
    const headrest = mesh(new THREE.BoxGeometry(0.42, 0.18, 0.15), rubber, group);
    headrest.position.set(0, 0.46, 0.18);
    // Haltebügel-/Handlaufdetails, ohne den offenen Käfig zu schließen.
    rod(group, new THREE.Vector3(-0.42, -0.04, -0.47), new THREE.Vector3(0.42, -0.04, -0.47), 0.035, brightSteel, 7);

    const hangerMaterial = new THREE.LineBasicMaterial({ color: 0xaab6c9, transparent: true, opacity: 0.88 });
    const hangerGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const hangerA = new THREE.Line(hangerGeometry, hangerMaterial);
    const hangerB = new THREE.Line(hangerGeometry.clone(), hangerMaterial);
    scene.add(hangerA, hangerB);
    gondolas.push({ group, index, panel, hangerA, hangerB });
    hangerLines.push(hangerA, hangerB);
  }
  for (let i = 0; i < 20; i++) createGondola(i);

  // Leise Bodenreflexion und ein paar niedrige Volksfestlichter im Hintergrund.
  const groundGlow = new THREE.PointLight(0xffa747, 7, 20, 2);
  groundGlow.position.set(0, 0.8, 3);
  scene.add(groundGlow);
  for (let i = 0; i < 16; i++) {
    const bulb = mesh(new THREE.SphereGeometry(0.07, 8, 8), lampMaterial, scene, false, false);
    bulb.position.set(-10 + i * 1.35, 0.18 + (i % 3) * 0.06, -10);
  }

  const clock = new THREE.Clock();
  const TAU = Math.PI * 2;
  let frameId = 0;
  let lastTime = 0;

  function animate(now = 0) {
    frameId = requestAnimationFrame(animate);
    if (document.hidden) { cancelAnimationFrame(frameId); return; }
    if (reducedMotion.matches && lastTime) { cancelAnimationFrame(frameId); return; }
    const elapsed = reducedMotion.matches ? 8.5 : clock.getElapsedTime();
    const cycle = elapsed % 26 / 26;
    const triangle = cycle < 0.5 ? cycle * 2 : (1 - cycle) * 2;
    const smooth = triangle * triangle * (3 - 2 * triangle);
    const tilt = THREE.MathUtils.degToRad(8 + 76 * smooth);
    wheelTilt.rotation.x = tilt;
    wheelSpin.rotation.y = reducedMotion.matches ? 0.75 : elapsed * 1.1;
    stars.rotation.y = elapsed * 0.002;
    wheelTilt.updateMatrixWorld(true);
    wheelSpin.updateMatrixWorld(true);

    const wheelCenter = wheelSpin.getWorldPosition(new THREE.Vector3());
    const spinRate = reducedMotion.matches ? 0.85 : 1.1;
    for (const item of gondolas) {
      const a = item.index / 20 * TAU;
      const localRim = new THREE.Vector3(Math.cos(a) * R, 0, Math.sin(a) * R);
      const rimWorld = wheelSpin.localToWorld(localRim);
      const radial = rimWorld.clone().sub(wheelCenter).normalize();
      // Resultierende Kraft: Schwerkraft plus Zentrifugalanteil. Der Anteil
      // ist begrenzt, damit die Gondeln nicht unnatürlich starr radial stehen.
      const centrifugal = Math.min(1.55, (spinRate * spinRate * R / 9.81) * 0.16);
      const down = radial.multiplyScalar(centrifugal).add(new THREE.Vector3(0, -1, 0)).normalize();
      const up = down.clone().negate();
      const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a));
      tangent.applyQuaternion(wheelSpin.getWorldQuaternion(new THREE.Quaternion())).normalize();
      const xAxis = tangent.addScaledVector(up, -tangent.dot(up)).normalize();
      const zAxis = new THREE.Vector3().crossVectors(xAxis, up).normalize();
      const basis = new THREE.Matrix4().makeBasis(xAxis, up, zAxis);
      item.group.quaternion.setFromRotationMatrix(basis);
      item.group.position.copy(rimWorld).addScaledVector(down, 1.18);
      // Zwei Hänger verbinden Felge und Dach. Die Linien werden als echte
      // räumliche Segmente aktualisiert, nicht als Bildschirmgrafik.
      const top = item.group.localToWorld(new THREE.Vector3(0, 0.66, 0));
      const leftRoof = item.group.localToWorld(new THREE.Vector3(-0.34, 0.66, 0));
      const rightRoof = item.group.localToWorld(new THREE.Vector3(0.34, 0.66, 0));
      const leftRim = rimWorld.clone().addScaledVector(tangent, -0.3);
      const rightRim = rimWorld.clone().addScaledVector(tangent, 0.3);
      item.hangerA.geometry.setFromPoints([leftRim, leftRoof]);
      item.hangerB.geometry.setFromPoints([rightRim, rightRoof]);
      item.hangerA.geometry.attributes.position.needsUpdate = true;
      item.hangerB.geometry.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    lastTime = now;
    if (reducedMotion.matches) cancelAnimationFrame(frameId);
  }

  function resize() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    placeCamera();
  }
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(frameId);
    if (!document.hidden && !reducedMotion.matches) {
      clock.start();
      animate();
    }
  });
  reducedMotion.addEventListener?.("change", () => {
    lastTime = 0;
    if (!reducedMotion.matches) {
      clock.start();
      animate();
    }
  });
  animate();

  function fallback() {
    const script = document.createElement("script");
    script.src = "/assets/js/enterprise.js";
    script.defer = true;
    document.body.appendChild(script);
  }
})();
