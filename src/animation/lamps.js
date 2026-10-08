/**
 * Lampen des Fahrgeschäfts.
 *
 * Es sind einige hundert, deshalb sitzen sie alle in einem einzigen
 * InstancedMesh. Die Matrizen stehen fest, weil die Lampen fest am Rad
 * hängen und das Rad als Ganzes gedreht wird - pro Bild wird nur die Farbe
 * neu gesetzt.
 *
 * Das Lauflicht wechselt zwischen mehreren Mustern, so wie es die echten
 * Geräte tun: einmal läuft es um die Felge, einmal von der Nabe nach außen,
 * einmal pulsiert die Nabe.
 */

import { Color, InstancedMesh, MeshBasicMaterial, Object3D, SphereGeometry } from "three";

const PATTERN_LENGTH = 9; // Sekunden je Muster
const BLEND = 1.4; // Sekunden Überblendung

// Warmes Gelb und Orange, dazwischen vereinzelt Weiß und ein kühler Akzent.
const WARM = new Color(0xffb04a);
const HOT = new Color(0xfff0c8);
const COOL = new Color(0x6fa8ff);

const tmpObject = new Object3D();
const tmpColor = new Color();

/** Weiche Welle. u ist eine Phase, das Ergebnis liegt zwischen 0 und 1. */
function wave(u, sharpness = 4) {
  const c = 0.5 + 0.5 * Math.cos(u * Math.PI * 2);
  return Math.pow(c, sharpness);
}

/**
 * @param {Array<{x:number,y:number,z:number,kind:string,u:number,v:number}>} lamps
 *   kind ist "rim", "spoke" oder "hub"; u läuft um das Rad, v von innen nach
 *   außen.
 */
export function createLamps(lamps, { radius = 0.09 } = {}) {
  const geometry = new SphereGeometry(radius, 6, 4);
  const material = new MeshBasicMaterial({ toneMapped: false });
  const mesh = new InstancedMesh(geometry, material, lamps.length);
  mesh.frustumCulled = false;

  // Grundfarbe je Lampe: meist warm, jede siebte weiß, jede dreizehnte kühl.
  const base = lamps.map((_, i) => {
    if (i % 13 === 0) return COOL;
    if (i % 7 === 0) return HOT;
    return WARM;
  });

  for (let i = 0; i < lamps.length; i++) {
    tmpObject.position.set(lamps[i].x, lamps[i].y, lamps[i].z);
    tmpObject.updateMatrix();
    mesh.setMatrixAt(i, tmpObject.matrix);
    mesh.setColorAt(i, base[i]);
  }
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  /** Helligkeit einer Lampe in einem bestimmten Muster. */
  function brightness(pattern, lamp, time) {
    switch (pattern) {
      case 0: // um die Felge laufend
        if (lamp.kind === "rim") return 0.18 + 0.82 * wave(lamp.u - time * 0.32);
        if (lamp.kind === "hub") return 0.3;
        return 0.22 + 0.3 * wave(lamp.u - time * 0.32, 2);
      case 1: // von der Nabe nach außen
        if (lamp.kind === "spoke")
          return 0.15 + 0.85 * wave(lamp.v - time * 0.5 + lamp.u * 0.35);
        if (lamp.kind === "hub") return 0.35 + 0.4 * wave(-time * 0.5);
        return 0.3 + 0.35 * wave(lamp.u * 2 - time * 0.2, 2);
      default: {
        // Nabe pulsiert, Rest ruhig an
        const pulse = 0.35 + 0.65 * wave(-time * 0.34, 1.5);
        if (lamp.kind === "hub") return pulse;
        if (lamp.kind === "rim") return 0.55 + 0.3 * wave(lamp.u * 4 - time * 0.18, 2);
        return 0.4 + 0.25 * pulse;
      }
    }
  }

  return {
    mesh,
    /** @param {number} time Sekunden. @param {number} level 0..1 Grundhelligkeit. */
    update(time, level = 1) {
      const slot = time / PATTERN_LENGTH;
      const current = Math.floor(slot) % 3;
      const next = (current + 1) % 3;
      // Überblendung in den letzten Sekunden eines Musters
      const into = (slot - Math.floor(slot)) * PATTERN_LENGTH;
      const mixF =
        into > PATTERN_LENGTH - BLEND ? (into - (PATTERN_LENGTH - BLEND)) / BLEND : 0;

      for (let i = 0; i < lamps.length; i++) {
        const lamp = lamps[i];
        let b = brightness(current, lamp, time);
        if (mixF > 0) b += (brightness(next, lamp, time) - b) * mixF;
        // Über 1 hinaus, damit der Bloom die hellen Lampen aufgreift.
        tmpColor.copy(base[i]).multiplyScalar(b * b * 2.1 * level);
        mesh.setColorAt(i, tmpColor);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    /** Standbild für prefers-reduced-motion: alles ruhig an, kein Blinken. */
    freeze() {
      for (let i = 0; i < lamps.length; i++) {
        tmpColor.copy(base[i]).multiplyScalar(1.15);
        mesh.setColorAt(i, tmpColor);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
  };
}
