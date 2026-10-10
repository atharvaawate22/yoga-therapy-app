// Copies the files in-browser inference needs into public/ before dev/build:
//   - the MoveNet .tflite models, from backend/models (the same files the
//     server runs, so there is one copy of each in git)
//   - LiteRT.js's WebAssembly runtime, from node_modules
// Both targets are gitignored.
import { copyFileSync, cpSync, existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const webDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const modelsSrc = join(webDir, "..", "backend", "models");
const modelsDest = join(webDir, "public", "models");
const wasmSrc = join(webDir, "node_modules", "@litertjs", "core", "wasm");
const wasmDest = join(webDir, "public", "litert");

const MODELS = ["movenet_lightning.tflite", "movenet_thunder.tflite"];

mkdirSync(modelsDest, { recursive: true });
for (const name of MODELS) {
  const src = join(modelsSrc, name);
  if (!existsSync(src)) throw new Error(`Missing ${src}`);
  const dest = join(modelsDest, name);
  if (!existsSync(dest) || statSync(dest).mtimeMs < statSync(src).mtimeMs) copyFileSync(src, dest);
}

if (!existsSync(wasmSrc)) throw new Error(`Missing ${wasmSrc}; run npm install`);
cpSync(wasmSrc, wasmDest, { recursive: true });

console.log(`Copied ${MODELS.length} models to public/models and LiteRT wasm to public/litert`);
