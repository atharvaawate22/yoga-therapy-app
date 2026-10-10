import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildManifest,
  injectManifest,
  isPrecached,
  isRuntimeCached,
  urlFor,
} from "../../../scripts/sw-manifest.mjs";
import { isIOS } from "./platform";

const DEMO = ["30-warrior_pose.jpg"];

describe("service worker manifest", () => {
  it.each([
    ["index.html", true],
    ["conditions/back-pain.html", true],
    ["about.txt", true], // RSC payload for client-side navigation
    ["_next/static/chunks/app.js", true],
    ["_next/static/media/font.woff2", true],
    ["poses/tree_pose-480.webp", true],
    ["icons/icon-192.png", true],
    ["manifest.webmanifest", true],
    ["lab/fixtures/30-warrior_pose.jpg", true], // a demo photo
    ["lab/fixtures/ATTRIBUTION.md", true],
    ["lab/fixtures/00-boat_pose.jpg", false], // lab-only photo
    ["lab/fixtures/manifest.json", false],
    ["_next/static/media/tree_pose.abc.png", false], // RN original, replaced by WebP
    ["models/movenet_thunder.tflite", false], // cached on first use instead
    ["litert/litert_wasm_internal.wasm", false],
    ["sw.js", false],
  ])("%s precached: %s", (path, expected) => {
    expect(isPrecached(path, DEMO)).toBe(expected);
  });

  it("caches models and WASM on first use", () => {
    expect(isRuntimeCached("models/movenet_lightning.tflite")).toBe(true);
    expect(isRuntimeCached("litert/litert_wasm_jspi_internal.js")).toBe(true);
    expect(isRuntimeCached("index.html")).toBe(false);
  });

  it("maps files to the URLs they're served at", () => {
    expect(urlFor("index.html")).toBe("/");
    expect(urlFor("conditions/back-pain.html")).toBe("/conditions/back-pain");
    expect(urlFor("404.html")).toBe("/404.html");
    expect(urlFor("_next/static/chunks/a.js")).toBe("/_next/static/chunks/a.js");
  });

  it("versions the cache by content", () => {
    const files = [
      { path: "index.html", hash: "a" },
      { path: "models/movenet_thunder.tflite", hash: "m1" },
    ];
    const first = buildManifest(files, DEMO);
    expect(first.precache).toEqual([{ url: "/", revision: "a" }]);
    expect(first.runtime).toEqual({ "/models/movenet_thunder.tflite": "m1" });
    expect(buildManifest(files, DEMO).version).toBe(first.version);
    expect(buildManifest([{ ...files[0]!, hash: "b" }, files[1]!], DEMO).version).not.toBe(first.version);
    // A new model alone doesn't invalidate the app shell.
    expect(buildManifest([files[0]!, { ...files[1]!, hash: "m2" }], DEMO).version).toBe(first.version);
  });
});

describe("injectManifest", () => {
  it("fills the assignment, not an earlier mention of the placeholder", () => {
    // Regression: String.replace once swapped the comment's mention instead,
    // leaving `const BUILD = __BUILD__;` to throw when the worker loaded.
    const template = ["// replaces __BUILD__ below", "const BUILD = __BUILD__;", "use(BUILD);"].join("\n");
    const out = injectManifest(template, { version: "1", price: "$&$1" });
    expect(out).toContain('const BUILD = {"version":"1","price":"$&$1"};');
    expect(out).not.toContain("= __BUILD__");
  });

  it("works on the real template", () => {
    const template = readFileSync(resolve("sw", "sw.js"), "utf8");
    const out = injectManifest(template, buildManifest([{ path: "index.html", hash: "x" }]));
    expect(out).toContain('const BUILD = {"version":');
    expect(out).not.toContain("= __BUILD__");
  });

  it("refuses a template without exactly one placeholder", () => {
    expect(() => injectManifest("nothing here", {})).toThrow();
  });
});

describe("isIOS", () => {
  it("recognises iPhone and iPadOS (which reports a Mac with touch)", () => {
    expect(isIOS("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 5)).toBe(true);
    expect(isIOS("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", 0)).toBe(false);
    expect(isIOS("Mozilla/5.0 (Linux; Android 15)", 5)).toBe(false);
  });
});
