/**
 * Eine Gondel.
 *
 * Die Gondeln des Mondlift sind stromlinienförmige Kapseln, und sie liegen
 * LÄNGS ZUR FAHRTRICHTUNG, also tangential am Kreis - nicht nach unten und
 * nicht nach außen. Deshalb zeigen auch die beiden runden Scheinwerfer
 * nach vorn in die Fahrtrichtung.
 *
 * Achsen im lokalen System (Ursprung ist der Drehpunkt an der Felge):
 *   -Z  Hängerichtung, der Wagen hängt darunter
 *   +Y  Fahrtrichtung, die lange Achse des Wagens
 *    X  radial, die kurze Achse
 *   +Z  oben, dort sitzt das Verdeck
 */

import {
  BoxGeometry,
  CapsuleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";

// Maße nach den Fotos: die Kapseln sind deutlich länger als breit. Vorher
// war der Rumpf 1,87 m lang bei 1,43 m Breite - das sah aus wie ein Fass.
export const CAR_LENGTH = 2.45;
const CAR_WIDTH = 1.38;
const CAR_HEIGHT = 0.66;
const HANGER = 0.62; // Abstand Drehpunkt bis Wagendach

// Gedämpfte Lackfarben. Die echten Gondeln sind kräftig bunt; hier sind sie
// entsättigt, damit sie sich in den Nachthimmel einfügen statt ihn zu
// zerreißen.
const BODY_COLORS = [
  0x2f7a72, // Petrol
  0x2f4f86, // Blau
  0x8a3038, // Rot
  0x386b45, // Grün
  0x7a6230, // Bernstein
  0x3f4759, // Schiefer
];

const chrome = new MeshStandardMaterial({
  color: 0xccd6e8,
  metalness: 1,
  roughness: 0.18,
});

const shellMaterials = BODY_COLORS.map(
  (color) => new MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.38 }),
);

const silver = new MeshStandardMaterial({
  color: 0xa6b1c4,
  metalness: 0.88,
  roughness: 0.26,
});

const roofMaterial = new MeshStandardMaterial({
  color: 0x20262f,
  metalness: 0.45,
  roughness: 0.55,
});

const headlight = new MeshBasicMaterial({ color: 0xfff0d0, toneMapped: false });

// Geometrien einmal bauen und teilen - 20 Gondeln aus denselben Puffern.
// CapsuleGeometry liegt von Haus aus entlang Y, das ist hier genau die
// Fahrtrichtung - es braucht also keine Drehung mehr.
const hullGeo = new CapsuleGeometry(0.4, CAR_LENGTH - 0.8, 4, 14);
const noseGeo = new SphereGeometry(0.4, 14, 10);
const canopyGeo = new BoxGeometry(CAR_WIDTH * 0.92, CAR_LENGTH * 0.62, 0.07);
const bandGeo = new CapsuleGeometry(0.405, CAR_LENGTH * 0.3, 3, 14);
const postGeo = new CylinderGeometry(0.032, 0.032, 1, 6);
const barGeo = new CylinderGeometry(0.028, 0.028, 1, 6);
const lightGeo = new SphereGeometry(0.07, 8, 6);
const yokeGeo = new CylinderGeometry(0.055, 0.055, 1, 6);

/**
 * @param {number} index Nummer der Gondel, bestimmt die Lackfarbe.
 * @returns {Group} hängt entlang -Z, Ursprung ist der Aufhängepunkt.
 */
export function createGondola(index) {
  const g = new Group();
  const shell = shellMaterials[index % shellMaterials.length];

  // Mitte des Wagens unter dem Drehpunkt
  const cz = -(HANGER + CAR_HEIGHT / 2);
  const half = CAR_LENGTH / 2;

  // Rumpf: lange, flach gedrückte Kapsel in Fahrtrichtung.
  const hull = new Mesh(hullGeo, silver);
  hull.position.z = cz;
  hull.scale.set(CAR_WIDTH / 0.8, 1, CAR_HEIGHT / 0.8);
  g.add(hull);

  // Farbiger Ring um den Rumpf, damit die Lackfarbe von jeder Seite liest.
  const band = new Mesh(bandGeo, shell);
  band.position.set(0, -CAR_LENGTH * 0.14, cz);
  band.scale.set(CAR_WIDTH / 0.79, 1, CAR_HEIGHT / 0.79);
  g.add(band);

  // Nase vorn in Fahrtrichtung
  const nose = new Mesh(noseGeo, shell);
  nose.position.set(0, half - 0.22, cz);
  nose.scale.set(CAR_WIDTH / 0.8, 1.45, CAR_HEIGHT / 0.8);
  g.add(nose);

  // Zwei runde Scheinwerfer, ebenfalls nach vorn
  for (const sx of [-0.26, 0.26]) {
    const lamp = new Mesh(lightGeo, headlight);
    lamp.position.set(sx, half + 0.04, cz);
    g.add(lamp);
  }

  // Verdeck über dem Sitzbereich
  const canopy = new Mesh(canopyGeo, roofMaterial);
  canopy.position.set(0, -CAR_LENGTH * 0.04, cz + CAR_HEIGHT * 0.62);
  g.add(canopy);

  // Pfosten tragen das Verdeck
  for (const sx of [-CAR_WIDTH * 0.4, CAR_WIDTH * 0.4]) {
    for (const sy of [-CAR_LENGTH * 0.26, CAR_LENGTH * 0.2]) {
      const post = new Mesh(postGeo, chrome);
      post.rotation.x = Math.PI / 2;
      post.scale.y = CAR_HEIGHT * 0.62;
      post.position.set(sx, sy, cz + CAR_HEIGHT * 0.3);
      g.add(post);
    }
  }

  // Chrombügel längs an der inneren und der äußeren Flanke
  for (const sx of [-CAR_WIDTH * 0.52, CAR_WIDTH * 0.52]) {
    for (const sz of [0.06, 0.3]) {
      const bar = new Mesh(barGeo, chrome);
      bar.scale.y = CAR_LENGTH * 0.72;
      bar.position.set(sx, -CAR_LENGTH * 0.04, cz + sz);
      g.add(bar);
    }
  }

  // Aufhängung: zwei Streben vom Drehpunkt auf das Dach, in Fahrtrichtung
  // versetzt, damit der Wagen wie an einem Joch hängt.
  for (const sy of [-CAR_LENGTH * 0.26, CAR_LENGTH * 0.26]) {
    const drop = HANGER - CAR_HEIGHT * 0.1;
    const arm = new Mesh(yokeGeo, silver);
    arm.scale.y = Math.hypot(sy, drop);
    arm.position.set(0, sy / 2, -drop / 2);
    arm.rotation.x = Math.PI / 2 - Math.atan2(sy, drop);
    g.add(arm);
  }

  return g;
}
