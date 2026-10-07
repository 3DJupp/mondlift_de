/**
 * Der Fahrablauf als Zeitleiste.
 *
 * Ein Durchlauf dauert 70 Sekunden und wiederholt sich: erst steht das Rad
 * waagerecht und dreht langsam, dann wird beschleunigt, dann hebt der
 * Hubarm das Rad in die Senkrechte, volle Fahrt, danach senken und bremsen.
 * Genau in dieser Reihenfolge läuft das echte Fahrgeschäft.
 */

export const CYCLE = 70; // Sekunden je Durchlauf

const RPM_IDLE = 1.6;
const RPM_FULL = 13;
const TILT_UP = 88; // Grad, fast senkrecht

/** Stützstellen: Zeit, Neigung in Grad, Drehzahl in Umdrehungen je Minute. */
const KEYS = [
  { t: 0, tilt: 0, rpm: RPM_IDLE, phase: "Ruhe" },
  { t: 8, tilt: 0, rpm: RPM_IDLE, phase: "Anfahren" },
  { t: 18, tilt: 0, rpm: RPM_FULL, phase: "Ausschwingen" },
  { t: 30, tilt: TILT_UP, rpm: RPM_FULL, phase: "Heben" },
  { t: 50, tilt: TILT_UP, rpm: RPM_FULL, phase: "Volle Fahrt" },
  { t: 62, tilt: 0, rpm: RPM_IDLE, phase: "Senken" },
  { t: CYCLE, tilt: 0, rpm: RPM_IDLE, phase: "Ruhe" },
];

const smooth = (x) => x * x * (3 - 2 * x);

/**
 * Zustand zum Zeitpunkt t. Gibt Neigung im Bogenmaß, Drehzahl und den Namen
 * der aktuellen Phase zurück.
 */
export function stateAt(time) {
  const t = ((time % CYCLE) + CYCLE) % CYCLE;

  let i = 0;
  while (i < KEYS.length - 2 && KEYS[i + 1].t <= t) i++;
  const a = KEYS[i];
  const b = KEYS[i + 1];

  const span = b.t - a.t;
  const f = span > 0 ? smooth((t - a.t) / span) : 0;

  return {
    tilt: ((a.tilt + (b.tilt - a.tilt) * f) * Math.PI) / 180,
    rpm: a.rpm + (b.rpm - a.rpm) * f,
    phase: b.phase,
    progress: t / CYCLE,
  };
}

/** Namen der Phasen, für die Anzeige im Debug-Modus. */
export const PHASES = KEYS.slice(1).map((k) => ({ at: k.t, name: k.phase }));
