import { SKELETON_DRAW_MIN_SCORE, SKELETON_EDGES, keypointsFromMoveNet } from "pose-core";
import { toFramePoint } from "./letterbox";

/**
 * Draw MoveNet's skeleton onto `canvas` at the frame's natural size. With a
 * `frame`, it is painted underneath (a photo); with null, the canvas is
 * cleared and only the skeleton drawn, as an overlay over a playing video.
 * Joints below the server's drawing threshold are left out.
 */
export function drawSkeleton(
  canvas: HTMLCanvasElement,
  frame: CanvasImageSource | null,
  width: number,
  height: number,
  raw: ArrayLike<number>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (frame) ctx.drawImage(frame, 0, 0, width, height);
  else ctx.clearRect(0, 0, width, height);

  const points = keypointsFromMoveNet(raw).map((k) => ({
    ...toFramePoint(k.x, k.y, width, height),
    score: k.score,
  }));
  const scale = Math.max(width, height);
  ctx.lineWidth = Math.max(2, scale / 200);
  ctx.lineCap = "round";
  ctx.strokeStyle = "#28dc78";
  for (const [a, b] of SKELETON_EDGES) {
    const p = points[a]!;
    const q = points[b]!;
    if (p.score < SKELETON_DRAW_MIN_SCORE || q.score < SKELETON_DRAW_MIN_SCORE) continue;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
  }
  ctx.fillStyle = "#ff5a28";
  for (const p of points) {
    if (p.score < SKELETON_DRAW_MIN_SCORE) continue;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(3, scale / 150), 0, Math.PI * 2);
    ctx.fill();
  }
}
