/**
 * Bündelt die Animation zu einer Datei unter public/assets/js/.
 *
 * Das Ergebnis ist absichtlich nicht eingecheckt: wrangler ruft diesen
 * Schritt über "build" in wrangler.jsonc vor jedem dev, preview und deploy
 * selbst auf. Alles andere unter public/ bleibt handgeschrieben.
 */

import { build } from "esbuild";
import { rm } from "node:fs/promises";

const OUT = "public/assets/js/mondlift.js";
const watch = process.argv.includes("--watch");

await rm(OUT, { force: true });
await rm(`${OUT}.map`, { force: true });

/** @type {import("esbuild").BuildOptions} */
const options = {
  entryPoints: ["src/animation/main.js"],
  outfile: OUT,
  bundle: true,
  format: "iife",
  target: ["es2022"],
  minify: !watch,
  sourcemap: watch ? "inline" : false,
  legalComments: "none",
  logLevel: "info",
};

if (watch) {
  const ctx = await (await import("esbuild")).context(options);
  await ctx.watch();
  console.log("esbuild beobachtet src/animation/");
} else {
  const result = await build(options);
  if (result.errors.length) process.exit(1);
}
