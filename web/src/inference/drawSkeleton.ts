import { SKELETON_DRAW_MIN_SCORE, SKELETON_EDGES, keypointsFromMoveNet } from "pose-core";
import { toFramePoint } from "./letterbox";

/**
 * Draw `frame` onto `canvas` at its natural size with MoveNet's skeleton on
 * top. Joints below the server's drawing threshold are left out.
 */
export function drawSkeleton(
  canvas: HTMLCanvasElement,
  frame: CanvasImageSource,
  width: number,
  height: number,
  raw: ArrayLike<number>,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(frame, 0, 0, width, height);

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
