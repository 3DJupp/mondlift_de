/**
 * Das Fahrgeschäft: Unterbau, Hubarm, Rad, Gondeln.
 *
 * Aufbau der Achsen
 * -----------------
 * Das Rad liegt in seiner lokalen XY-Ebene, die Achse zeigt entlang Z.
 * Der Hubarm dreht es um eine waagerechte Achse, die an der hinteren
 * Felgenkante liegt - genau so hebt sich das echte Gerät aus der
 * Waagerechten in die Senkrechte, wobei die Nabe von 2,6 m auf gut 10 m
 * steigt.
 *
 * Das gesamte Tragwerk wird zu einer einzigen Geometrie verschmolzen. Es
 * sind mehrere hundert Streben; als Einzelobjekte wären das ebenso viele
 * Zeichenaufrufe pro Bild.
 */

import {
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createGondola } from "./gondola.js";
import { createLamps } from "./lamps.js";

export const R = 8; // Radradius in m
export const ARMS = 20;
const PIVOT_Y = 2.6; // Höhe der Kippachse über Grund
const RING_MID = 0.42; // innerer Ring, Anteil von R
const RIM_INNER = 0.92; // innerer Felgenring, Anteil von R

const G = 9.81;

const steel = new MeshStandardMaterial({
  color: 0x8e99ae,
  metalness: 0.7,
  roughness: 0.42,
});
const darkSteel = new MeshStandardMaterial({
  color: 0x2a3140,
  metalness: 0.6,
  roughness: 0.6,
});
const hubMaterial = new MeshStandardMaterial({
  color: 0x3b3566,
  metalness: 0.65,
  roughness: 0.35,
});

const UP = new Vector3(0, 1, 0);
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpQ = new Quaternion();

/** Rohr zwischen zwei Punkten, als Geometrie im gemeinsamen Koordinatensystem. */
function tube(from, to, radius, segments = 6) {
  const dir = tmpA.copy(to).sub(from);
  const len = dir.length();
  if (len < 1e-5) return null;
  const geo = new CylinderGeometry(radius, radius, len, segments, 1, true);
  // Zylinder zeigt in Y, auf die Verbindungsrichtung drehen.
  tmpQ.setFromUnitVectors(UP, dir.normalize());
  const obj = new Object3D();
  obj.quaternion.copy(tmpQ);
  obj.position.copy(from).add(tmpB.copy(to).sub(from).multiplyScalar(0.5));
  obj.updateMatrix();
  geo.applyMatrix4(obj.matrix);
  return geo;
}

/** Punkt auf dem Radialstrahl i, bei Anteil f des Radius. */
function spokePoint(i, f) {
  const a = (i / ARMS) * Math.PI * 2;
  return new Vector3(Math.cos(a) * R * f, Math.sin(a) * R * f, 0);
}

/**
 * Baut das Tragwerk des Rads und sammelt dabei die Lampenpositionen ein.
 */
function buildWheelStructure() {
  const parts = [];
  const lamps = [];
  const push = (g) => g && parts.push(g);

  for (let i = 0; i < ARMS; i++) {
    const u = i / ARMS;
    const hubEnd = spokePoint(i, 0.07);
    const mid = spokePoint(i, RING_MID);
    const rimIn = spokePoint(i, RIM_INNER);
    const rim = spokePoint(i, 1);
    const next = (i + 1) % ARMS;

    // Hauptträger, innen kräftiger als außen
    push(tube(hubEnd, mid, 0.075));
    push(tube(mid, rim, 0.055));

    // Zwei dünne Zugstangen je Gondel, leicht versetzt - das gibt dem Rad
    // die Vielzahl feiner Stäbe, die die echten Geräte haben.
    const offA = spokePoint(i, 1).lerp(spokePoint(next, 1), 0.18);
    const offB = spokePoint(i, 1).lerp(spokePoint((i - 1 + ARMS) % ARMS, 1), 0.18);
    push(tube(hubEnd, offA, 0.022, 4));
    push(tube(hubEnd, offB, 0.022, 4));

    // Innerer Ring und doppelte Felge
    push(tube(mid, spokePoint(next, RING_MID), 0.035, 4));
    push(tube(rimIn, spokePoint(next, RIM_INNER), 0.04, 4));
    push(tube(rim, spokePoint(next, 1), 0.05, 5));
    push(tube(rim, rimIn, 0.03, 4));

    // Dreiecksverband zwischen innerem Ring und Felge
    push(tube(mid, spokePoint(next, RIM_INNER), 0.026, 4));
    push(tube(rimIn, spokePoint(next, RING_MID), 0.026, 4));

    // Lampen: Kette entlang des Trägers ...
    for (let k = 0; k < 9; k++) {
      const f = 0.16 + (k / 8) * 0.78;
      const p = spokePoint(i, f);
      lamps.push({ x: p.x, y: p.y, z: 0.1, kind: "spoke", u, v: f });
    }
    // ... und dicht an dicht auf der Felge.
    for (let k = 0; k < 4; k++) {
      const f = k / 4;
      const p = spokePoint(i, 1).lerp(spokePoint(next, 1), f);
      lamps.push({ x: p.x, y: p.y, z: 0.1, kind: "rim", u: u + f / ARMS, v: 1 });
    }
  }

  // Lampenstern auf der Nabe
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    lamps.push({
      x: Math.cos(a) * 1.15,
      y: Math.sin(a) * 1.15,
      z: 0.34,
      kind: "hub",
      u: k / 16,
      v: 0,
    });
  }

  return { geometry: mergeGeometries(parts, false), lamps };
}

/**
 * Baut das ganze Fahrgeschäft.
 * @returns {{group: Group, update: Function, lamps: object}}
 */
export function createRide() {
  const group = new Group();

  // --- Unterbau --------------------------------------------------------
  const baseParts = [];
  baseParts.push(tube(new Vector3(-5.5, 0.35, -R - 2.6), new Vector3(5.5, 0.35, -R - 2.6), 0.4, 6));
  baseParts.push(tube(new Vector3(-5.5, 0.35, -R + 2.2), new Vector3(5.5, 0.35, -R + 2.2), 0.4, 6));
  for (const sx of [-5.5, -2, 2, 5.5]) {
    baseParts.push(
      tube(new Vector3(sx, 0.35, -R - 2.6), new Vector3(sx, 0.35, -R + 2.2), 0.3, 5),
    );
  }
  // Lagerböcke, die die Kippachse tragen
  for (const sx of [-2.8, 2.8]) {
    baseParts.push(
      tube(new Vector3(sx, 0.35, -R - 1.4), new Vector3(sx, PIVOT_Y, -R), 0.26, 6),
    );
    baseParts.push(
      tube(new Vector3(sx, 0.35, -R + 1.6), new Vector3(sx, PIVOT_Y, -R), 0.2, 5),
    );
  }
  const base = new Mesh(mergeGeometries(baseParts, false), darkSteel);
  group.add(base);

  // --- Hubarm ----------------------------------------------------------
  // Dreht das Rad um die Kippachse an der hinteren Felgenkante.
  const liftPivot = new Object3D();
  liftPivot.position.set(0, PIVOT_Y, -R);
  group.add(liftPivot);

  const wheelRoot = new Object3D();
  wheelRoot.position.set(0, R, 0); // Nabe, eine Radlänge vom Drehpunkt
  liftPivot.add(wheelRoot);

  // --- Rad -------------------------------------------------------------
  const wheel = new Object3D(); // dreht sich um die eigene Achse
  wheelRoot.add(wheel);

  const { geometry, lamps: lampSpecs } = buildWheelStructure();
  wheel.add(new Mesh(geometry, steel));

  const lamps = createLamps(lampSpecs);
  wheel.add(lamps.mesh);

  // Nabenkappe
  const cap = new Mesh(new SphereGeometry(1.1, 20, 14), hubMaterial);
  cap.scale.z = 0.52;
  cap.position.z = 0.18;
  wheel.add(cap);
  const collar = new Mesh(new CylinderGeometry(1.35, 1.5, 0.5, 20), darkSteel);
  collar.rotation.x = Math.PI / 2;
  wheel.add(collar);

  // --- Gondeln ---------------------------------------------------------
  const mounts = [];
  for (let i = 0; i < ARMS; i++) {
    const theta = (i / ARMS) * Math.PI * 2;
    const mount = new Object3D();
    mount.position.set(Math.cos(theta) * R, Math.sin(theta) * R, 0);
    mount.rotation.z = theta; // lokal: X radial, Y tangential, Z Achse
    wheel.add(mount);

    const swing = new Object3D();
    mount.add(swing);
    swing.add(createGondola(i));

    mounts.push({ theta, swing, angle: 0, vel: 0 });
  }

  // --- Mast und Hydraulik ---------------------------------------------
  // Der Mast trägt die Nabe und ist auf den Fotos das auffälligste Bauteil.
  // Er darf nicht als Kind des Rads hängen: dann läge er bei waagerechtem
  // Rad darunter, bei senkrechtem aber davor und würde quer über die
  // Radfläche laufen. Stattdessen wird er pro Bild im Weltsystem zwischen
  // Fußpunkt und Nabe gespannt, immer ein Stück hinter der Radebene.
  const MAST_BEHIND = 1.25; // Versatz hinter die Radebene in m
  const mastFoot = new Vector3(0, 0.5, -R - 1.3);
  const ramFoot = new Vector3(0, 0.6, -R - 3.6);

  const mast = new Mesh(new CylinderGeometry(0.42, 0.62, 1, 12), darkSteel);
  const mastEdge = new Mesh(new CylinderGeometry(0.12, 0.12, 1, 6), steel);
  const ramOuter = new Mesh(new CylinderGeometry(0.26, 0.3, 1, 10), darkSteel);
  const ramRod = new Mesh(new CylinderGeometry(0.13, 0.13, 1, 8), steel);
  group.add(mast, mastEdge, ramOuter, ramRod);

  /** Spannt ein Bauteil zwischen zwei Weltpunkten. */
  function strut(mesh, from, to, fromFrac, lengthFrac) {
    const dir = tmpA.copy(to).sub(from);
    const len = dir.length();
    if (len < 1e-4) return;
    tmpQ.setFromUnitVectors(UP, tmpB.copy(dir).normalize());
    mesh.quaternion.copy(tmpQ);
    mesh.scale.y = len * lengthFrac;
    mesh.position
      .copy(from)
      .addScaledVector(dir, fromFrac + lengthFrac / 2);
  }

  const hubWorld = new Vector3();
  const mastHead = new Vector3();
  const ramMid = new Vector3();
  const gravityWheel = new Vector3();

  /**
   * @param {number} tilt Neigung in rad, 0 ist waagerecht.
   * @param {number} spin Drehwinkel des Rads in rad.
   * @param {number} omega Winkelgeschwindigkeit in rad/s.
   * @param {number} dt Zeitschritt in s.
   */
  function update(tilt, spin, omega, dt) {
    liftPivot.rotation.x = Math.PI / 2 - tilt;
    wheel.rotation.z = spin;
    wheel.updateWorldMatrix(true, false);

    // Schwerkraft ins Radsystem holen. Einmal pro Bild, nicht je Gondel.
    gravityWheel.set(0, -G, 0);
    tmpQ.copy(wheel.getWorldQuaternion(new Quaternion())).invert();
    gravityWheel.applyQuaternion(tmpQ);

    const centrifugal = omega * omega * R;

    for (const m of mounts) {
      // Schwerkraft in das Koordinatensystem der Aufhängung drehen:
      // dort ist X radial nach außen und Z die Radachse.
      const c = Math.cos(m.theta);
      const s = Math.sin(m.theta);
      const gRadial = gravityWheel.x * c + gravityWheel.y * s;
      const gAxial = gravityWheel.z;

      // Die Gondel stellt sich in Richtung der resultierenden Kraft.
      // Untergrenze gegen das Umklappen nach innen bei langsamer Fahrt.
      const radial = Math.max(centrifugal + gRadial, centrifugal * 0.1);
      const target = Math.atan2(radial, -gAxial);

      // Feder mit Dämpfung, damit es nach Masse aussieht statt starr.
      const k = 11;
      const damping = 2 * Math.sqrt(k) * 0.72;
      m.vel += ((target - m.angle) * k - m.vel * damping) * dt;
      m.angle += m.vel * dt;
      m.swing.rotation.y = -m.angle;
    }

    // Mast und Hydraulik nachführen. Der Kopf des Masts sitzt an der Nabe,
    // aber ein Stück dahinter, damit er nicht vor dem Rad erscheint.
    hubWorld.setFromMatrixPosition(wheelRoot.matrixWorld);
    mastHead.copy(hubWorld);
    mastHead.z -= MAST_BEHIND;

    strut(mast, mastFoot, mastHead, 0, 1);
    strut(mastEdge, mastFoot, mastHead, 0, 1);
    mastEdge.position.z -= 0.5;

    // Zylinder stützt den Mast von hinten ab und fährt beim Heben aus.
    ramMid.copy(mastFoot).lerp(mastHead, 0.62);
    strut(ramOuter, ramFoot, ramMid, 0, 0.58);
    strut(ramRod, ramFoot, ramMid, 0.42, 0.58);
  }

  return { group, update, lamps };
}
