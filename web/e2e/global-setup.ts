import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import sharp from "sharp";
import { FAKE_CAMERA } from "../playwright.config";

const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 20; // Chromium loops the file
const PHOTO = join(__dirname, "..", "public", "lab", "fixtures", "30-warrior_pose.jpg");

/** RGB -> I420 (full-range BT.601, as the "C420jpeg" y4m header declares). */
function toI420(rgb: Buffer): Buffer {
  const ySize = WIDTH * HEIGHT;
  const out = Buffer.alloc(ySize * 1.5);
  const u = ySize;
  const v = ySize + ySize / 4;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 3;
      const [r, g, b] = [rgb[i]!, rgb[i + 1]!, rgb[i + 2]!];
      out[y * WIDTH + x] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      if (y % 2 === 0 && x % 2 === 0) {
        const c = (y / 2) * (WIDTH / 2) + x / 2;
        out[u + c] = Math.round(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
        out[v + c] = Math.round(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
      }
    }
  }
  return out;
}

/**
 * Write a short .y4m clip of a credited Warrior II photo for Chromium's fake
 * camera, so tests exercise the real getUserMedia path with a known pose.
 */
export default async function globalSetup() {
  if (existsSync(FAKE_CAMERA)) return;
  const rgb = await sharp(PHOTO)
    .resize(WIDTH, HEIGHT, { fit: "contain", background: "#000" })
    .removeAlpha()
    .raw()
    .toBuffer();
  const frame = toI420(rgb);
  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F10:1 Ip A1:1 C420jpeg\n`);
  const frameTag = Buffer.from("FRAME\n");
  mkdirSync(dirname(FAKE_CAMERA), { recursive: true });
  writeFileSync(FAKE_CAMERA, Buffer.concat([header, ...Array.from({ length: FRAMES }, () => [frameTag, frame]).flat()]));
}
