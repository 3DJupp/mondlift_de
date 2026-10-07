/**
 * Kulisse: Nachthimmel, Mond, Sterne, Boden.
 *
 * Alles hier ist statisch bis auf das Funkeln der Sterne. Der Himmel ist ein
 * Verlauf als Textur statt einer Volltonfarbe, weil ein Nachthimmel zum
 * Horizont hin heller wird.
 */

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  Points,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
} from "three";

/** Weicher Farbverlauf als Himmelstextur. */
function skyTexture() {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d");
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#04060e");
  grad.addColorStop(0.45, "#0a1020");
  grad.addColorStop(0.78, "#121a2e");
  grad.addColorStop(1, "#19203a");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.minFilter = LinearFilter;
  return tex;
}

/** Mondscheibe mit weichem Rand und angedeuteten Kratern. */
function moonTexture() {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  const m = size / 2;

  // Hof
  const halo = g.createRadialGradient(m, m, size * 0.18, m, m, m);
  halo.addColorStop(0, "rgba(206,220,255,0.13)");
  halo.addColorStop(0.42, "rgba(170,190,240,0.035)");
  halo.addColorStop(1, "rgba(150,170,220,0)");
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);

  // Scheibe
  const r = size * 0.19;
  const disc = g.createRadialGradient(m - r * 0.3, m - r * 0.35, r * 0.1, m, m, r);
  disc.addColorStop(0, "#fdfdf6");
  disc.addColorStop(0.62, "#e4e8f1");
  disc.addColorStop(1, "#b5bed2");
  g.fillStyle = disc;
  g.beginPath();
  g.arc(m, m, r, 0, Math.PI * 2);
  g.fill();

  g.globalAlpha = 0.11;
  g.fillStyle = "#67718c";
  for (const [cx, cy, cr] of [
    [-0.3, -0.25, 0.2],
    [0.22, 0.1, 0.26],
    [-0.1, 0.42, 0.15],
    [0.42, -0.38, 0.12],
  ]) {
    g.beginPath();
    g.arc(m + cx * r, m + cy * r, cr * r, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Sterne als Punktwolke. Das Funkeln läuft im Shader, damit pro Bild nichts
 * auf der CPU zu tun ist - nur eine Zahl wird hochgezählt.
 */
function makeStars(count, radius) {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    // Nur die obere Halbkugel, und nicht ganz bis zum Horizont.
    const theta = Math.random() * Math.PI * 2;
    const y = Math.pow(Math.random(), 0.7);
    const r = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(theta) * r * radius;
    pos[i * 3 + 1] = y * radius * 0.85 + radius * 0.04;
    pos[i * 3 + 2] = Math.sin(theta) * r * radius;
    seed[i] = Math.random() * Math.PI * 2;
    size[i] = 0.6 + Math.random() * 1.9;
  }

  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aSeed", new BufferAttribute(seed, 1));
  geo.setAttribute("aSize", new BufferAttribute(size, 1));

  const material = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uScale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    vertexShader: `
      attribute float aSeed;
      attribute float aSize;
      uniform float uTime;
      uniform float uScale;
      varying float vAlpha;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = 0.65 + 0.35 * sin(uTime * 1.3 + aSeed);
        vAlpha = tw * 0.85;
        gl_PointSize = aSize * uScale * (300.0 / -mv.z);
      }
    `,
    fragmentShader: `
      varying float vAlpha;
      void main() {
        vec2 d = gl_PointCoord - vec2(0.5);
        float r = length(d);
        if (r > 0.5) discard;
        float a = smoothstep(0.5, 0.0, r);
        gl_FragColor = vec4(vec3(0.92, 0.95, 1.0), a * a * vAlpha);
      }
    `,
  });

  return new Points(geo, material);
}

/**
 * Baut die Kulisse. Gibt die Gruppe zurück und eine update-Funktion für
 * das Funkeln.
 */
export function createSky({ radius = 420 } = {}) {
  const group = new Group();

  // Himmelskuppel, von innen sichtbar
  const dome = new Mesh(
    new SphereGeometry(radius, 32, 16),
    new MeshBasicMaterial({
      map: skyTexture(),
      side: 1, // BackSide
      depthWrite: false,
      fog: false,
    }),
  );
  dome.renderOrder = -2;
  group.add(dome);

  const stars = makeStars(900, radius * 0.92);
  stars.renderOrder = -1;
  group.add(stars);

  // Mond als Fläche, die immer zur Kamera zeigt, weit hinten
  const moonSize = radius * 0.42;
  const moon = new Mesh(
    new SphereGeometry(1, 8, 8),
    new MeshBasicMaterial({
      map: moonTexture(),
      transparent: true,
      depthWrite: false,
      fog: false,
      blending: AdditiveBlending,
    }),
  );
  // Statt einer Kugel eine Billboard-Fläche: einfacher über eine Ebene.
  moon.geometry.dispose();
  const planeGeo = new BufferGeometry();
  const h = moonSize / 2;
  planeGeo.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([-h, -h, 0, h, -h, 0, h, h, 0, -h, -h, 0, h, h, 0, -h, h, 0]),
      3,
    ),
  );
  planeGeo.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2),
  );
  moon.geometry = planeGeo;
  moon.position.set(-radius * 0.36, radius * 0.27, -radius * 0.79);
  moon.renderOrder = -1;
  group.add(moon);

  return {
    group,
    moon,
    update(time, camera) {
      stars.material.uniforms.uTime.value = time;
      moon.quaternion.copy(camera.quaternion);
    },
    setTwinkle(on) {
      stars.material.uniforms.uTime.value = on ? stars.material.uniforms.uTime.value : 0;
    },
  };
}

/** Dunkler Boden mit warmem Lichtteppich unter dem Fahrgeschäft. */
export function createGround(radius = 60) {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#070a11";
  g.fillRect(0, 0, size, size);
  const pool = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  pool.addColorStop(0, "rgba(255,168,70,0.30)");
  pool.addColorStop(0.35, "rgba(255,140,48,0.10)");
  pool.addColorStop(1, "rgba(255,120,30,0)");
  g.fillStyle = pool;
  g.fillRect(0, 0, size, size);

  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;

  const geo = new BufferGeometry();
  const r = radius;
  geo.setAttribute(
    "position",
    new BufferAttribute(
      new Float32Array([-r, 0, -r, r, 0, -r, r, 0, r, -r, 0, -r, r, 0, r, -r, 0, r]),
      3,
    ),
  );
  geo.setAttribute(
    "uv",
    new BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0]), 2),
  );
  geo.computeVertexNormals();

  const mesh = new Mesh(
    geo,
    new MeshBasicMaterial({ map: tex, color: new Color(0xffffff) }),
  );
  mesh.position.y = 0.01;
  return mesh;
}
