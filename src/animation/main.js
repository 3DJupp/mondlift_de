/**
 * Mondlift - Animation eines Huss Enterprise.
 *
 * Einstiegspunkt: Renderer, Szene, Kamera, Schleife. Das Fahrgeschäft
 * steckt in ride.js, die Kulisse in sky.js, der Fahrablauf in sequence.js.
 *
 * Gebündelt wird über scripts/build.mjs; im HTML steht kein Inline-Skript,
 * damit die Content-Security-Policy eng bleiben kann.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  PerspectiveCamera,
  PointLight,
  Scene,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

import { createRide, R } from "./ride.js";
import { createSky, createGround } from "./sky.js";
import { stateAt, CYCLE } from "./sequence.js";

const canvas = document.getElementById("ride");
const fallback = document.getElementById("ride-fallback");

/** Ohne WebGL gibt es ein Standbild statt einer leeren Fläche. */
function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (c.getContext("webgl2") || c.getContext("webgl")),
    );
  } catch {
    return false;
  }
}

function showFallback() {
  if (canvas) canvas.hidden = true;
  if (fallback) fallback.hidden = false;
}

if (!canvas) {
  // nichts zu tun
} else if (!webglAvailable()) {
  showFallback();
} else {
  start();
}

function start() {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const debug = new URLSearchParams(location.search).has("debug");

  // --- Renderer --------------------------------------------------------
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  } catch {
    showFallback();
    return;
  }
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new Scene();
  scene.fog = new Fog(0x0a1020, 55, 190);

  const camera = new PerspectiveCamera(38, 1, 0.5, 900);
  const lookTarget = new Vector3(0, 7.5, 0);

  // --- Inhalt ----------------------------------------------------------
  const sky = createSky({ radius: 420 });
  scene.add(sky.group);
  scene.add(createGround(90));

  const ride = createRide();
  scene.add(ride.group);

  // Licht: bewusst wenig. Die Struktur soll fast schwarz bleiben und nur
  // durch Streiflicht und die eigenen Lampen lesbar sein.
  scene.add(new HemisphereLight(0x32456b, 0x06080e, 1.15));
  const moonLight = new DirectionalLight(0xc2d4ff, 2.1);
  moonLight.position.set(40, 48, -22);
  scene.add(moonLight);
  scene.add(new AmbientLight(0x1a2338, 1.5));
  // Warmes Licht aus der Mitte des Rads, damit die Gondeln von innen
  // etwas Farbe bekommen.
  const warm = new PointLight(0xffa64d, 130, 40, 2);
  warm.position.set(0, 8, 2);
  scene.add(warm);

  // --- Nachbearbeitung --------------------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  // Stärke, Radius, Schwelle. Die Schwelle liegt bewusst hoch: strahlen
  // sollen nur die Lampen, nicht das ganze Bild. Mit niedriger Schwelle lag
  // die Szene in einem milchigen Dunst.
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.62, 0.42, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // --- Qualitätsstufen --------------------------------------------------
  // Fällt die Bildrate dauerhaft unter 40, wird zuerst der Bloom
  // abgeschaltet und danach die Auflösung gesenkt.
  const LEVELS = [
    { bloom: true, scale: 1 },
    { bloom: false, scale: 1 },
    { bloom: false, scale: 0.72 },
  ];
  let level = 0;
  let frameTimes = [];

  function maxPixelRatio() {
    return Math.min(window.devicePixelRatio || 1, 2) * LEVELS[level].scale;
  }

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = maxPixelRatio();

    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    // Bloom auf halber Auflösung, das reicht optisch und kostet ein Viertel.
    bloom.setSize(Math.max(2, (w * dpr) / 2), Math.max(2, (h * dpr) / 2));

    camera.aspect = w / h;

    // Bildausschnitt: auf dem Desktop füllt das Rad rund 70 Prozent der
    // Höhe, im Hochformat rund 85 Prozent der Breite.
    //
    // Das wird für beide Endlagen getrennt gerechnet. Flach liegend ist das
    // Rad nur wenige Meter hoch, senkrecht über zwanzig; mit einem festen
    // Abstand wirkte es in der Ruhephase verloren. Die Kamera fährt deshalb
    // mit der Neigung zurück.
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const fit = (h, w) =>
      Math.max(h / 0.72 / (2 * tanHalf), w / 0.86 / (2 * tanHalf * camera.aspect));

    const width = 2 * (R + 2.6);
    distanceFlat = fit(9, width);
    distanceTall = fit(22, width);

    camera.updateProjectionMatrix();
  }

  // Kameraabstand und Blickpunkt in den beiden Endlagen; dazwischen wird
  // mit der Neigung überblendet.
  let distanceFlat = 30;
  let distanceTall = 50;
  let cameraDistance = 50;

  // --- Kamera -----------------------------------------------------------
  // Leicht von der Seite und etwas unterhalb der Nabe, mit sehr langsamer
  // Drift, damit das Bild nie ganz stillsteht.
  function placeCamera(time, tiltNorm = 1) {
    cameraDistance = distanceFlat + (distanceTall - distanceFlat) * tiltNorm;
    // Mit dem Rad wandert auch der Blickpunkt nach oben.
    lookTarget.y = 3.4 + 5.4 * tiltNorm;

    // Auf einer Kugel um den Zielpunkt, damit der Abstand wirklich dem
    // entspricht, mit dem der Bildausschnitt berechnet wurde.
    const azimuth = 0.3 + Math.sin(time * 0.045) * 0.085;
    // Negative Höhe: die Kamera steht etwas unterhalb der Nabe und schaut
    // leicht nach oben, das lässt das Rad größer wirken.
    const elevation = -0.075 + Math.sin(time * 0.031) * 0.022;
    const ce = Math.cos(elevation);
    camera.position.set(
      lookTarget.x + Math.sin(azimuth) * ce * cameraDistance,
      lookTarget.y + Math.sin(elevation) * cameraDistance,
      lookTarget.z + Math.cos(azimuth) * ce * cameraDistance,
    );
    camera.lookAt(lookTarget);

    // Nebel erst hinter dem Fahrgeschäft ansetzen, sonst frisst er es auf.
    scene.fog.near = cameraDistance * 1.35;
    scene.fog.far = cameraDistance * 4.2;
  }

  // --- Debug-Anzeige ----------------------------------------------------
  let debugUi = null;
  if (debug) debugUi = createDebugUi();

  // --- Schleife ---------------------------------------------------------
  let clock = 0;
  let spin = 0;
  let last = 0;
  let raf = 0;
  let running = false;

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    if (debugUi && debugUi.scrubbing) {
      clock = debugUi.time;
    } else {
      clock += dt;
      if (debugUi) debugUi.time = clock % CYCLE;
    }

    const state = stateAt(clock);
    const omega = (state.rpm * Math.PI * 2) / 60;
    spin += omega * dt;

    ride.update(state.tilt, spin, omega, dt);
    ride.lamps.update(clock, 1);
    sky.update(clock, camera);
    placeCamera(clock, state.tilt / ((88 * Math.PI) / 180));

    composer.render();

    if (debugUi) debugUi.report(dt, state);
    adapt(dt);
  }

  /** Beobachtet die Bildzeiten und schaltet notfalls eine Stufe zurück. */
  function adapt(dt) {
    if (level >= LEVELS.length - 1) return;
    frameTimes.push(dt);
    if (frameTimes.length < 70) return;
    const sorted = frameTimes.slice(10).sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    frameTimes = [];
    if (median > 0.025) {
      // schlechter als 40 Bilder je Sekunde
      level++;
      bloom.enabled = LEVELS[level].bloom;
      resize();
    }
  }

  function startLoop() {
    if (running || reduceMotion.matches) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stopLoop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  /**
   * Bei prefers-reduced-motion dreht sich das Rad nur sehr langsam, kippt
   * nicht und die Lampen blinken nicht.
   */
  function calmFrame(now) {
    raf = requestAnimationFrame(calmFrame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    clock += dt;
    spin += 0.055 * dt;
    ride.update((52 * Math.PI) / 180, spin, 0.055, dt);
    placeCamera(0, 0.58);
    composer.render();
  }

  function applyMotionPreference() {
    stopLoop();
    cancelAnimationFrame(raf);
    if (reduceMotion.matches) {
      ride.lamps.freeze();
      last = performance.now();
      raf = requestAnimationFrame(calmFrame);
    } else {
      startLoop();
    }
  }

  // --- Ereignisse -------------------------------------------------------
  let resizeTimer = 0;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 120);
  });
  window.addEventListener("orientationchange", () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 220);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopLoop();
      cancelAnimationFrame(raf);
    } else {
      applyMotionPreference();
    }
  });

  if (typeof reduceMotion.addEventListener === "function") {
    reduceMotion.addEventListener("change", applyMotionPreference);
  }

  renderer.setClearColor(new Color(0x04060e), 1);
  resize();
  applyMotionPreference();

  // ---------------------------------------------------------------------

  /** Kleine Anzeige mit Bildrate und einem Regler für die Ablaufphase. */
  function createDebugUi() {
    const box = document.createElement("div");
    box.className = "debug";
    const readout = document.createElement("p");
    readout.className = "debug__read";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0";
    slider.max = String(CYCLE);
    slider.step = "0.1";
    slider.value = "0";
    slider.className = "debug__slider";
    slider.setAttribute("aria-label", "Phase des Fahrablaufs");
    box.append(readout, slider);
    document.body.append(box);

    const ui = { time: 0, scrubbing: false, fps: 0 };
    let acc = 0;
    let frames = 0;

    slider.addEventListener("pointerdown", () => {
      ui.scrubbing = true;
    });
    slider.addEventListener("pointerup", () => {
      ui.scrubbing = false;
    });
    slider.addEventListener("input", () => {
      ui.scrubbing = true;
      ui.time = Number(slider.value);
    });

    ui.report = (dt, state) => {
      acc += dt;
      frames++;
      if (acc >= 0.4) {
        ui.fps = Math.round(frames / acc);
        acc = 0;
        frames = 0;
      }
      if (!ui.scrubbing) slider.value = String(ui.time.toFixed(1));
      readout.textContent =
        `${ui.fps} fps · Stufe ${level} · ${state.phase} · ` +
        `${(state.tilt * 180) / Math.PI | 0}° · ${state.rpm.toFixed(1)} U/min`;
    };
    return ui;
  }
}
