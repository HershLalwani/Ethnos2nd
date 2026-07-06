import * as THREE from "three";

const cache = new Map<string, THREE.CanvasTexture>();

function canvasTexture(
  key: string,
  w: number,
  h: number,
  draw: (ctx: CanvasRenderingContext2D) => void
): THREE.CanvasTexture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  cache.set(key, tex);
  return tex;
}

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
const UI_FONT = '"Avenir Next", "Segoe UI", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Simple one-line text label rendered to a sprite texture. */
export function labelTexture(
  text: string,
  opts: { size?: number; color?: string; bg?: string | null; bold?: boolean } = {}
): { tex: THREE.CanvasTexture; aspect: number } {
  const { size = 48, color = "#ffffff", bg = null, bold = true } = opts;
  const key = `label-${text}-${size}-${color}-${bg}-${bold}`;
  const measure = document.createElement("canvas").getContext("2d")!;
  const font = `${bold ? "bold " : ""}${size}px ${UI_FONT}, ${EMOJI_FONT}`;
  measure.font = font;
  const w = Math.ceil(measure.measureText(text).width) + 40;
  const h = Math.ceil(size * 1.5);
  const tex = canvasTexture(key, w, h, (ctx) => {
    if (bg) {
      ctx.fillStyle = bg;
      roundRect(ctx, 0, 0, w, h, h / 2.4);
      ctx.fill();
    }
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 8;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
  return { tex, aspect: w / h };
}

/** Square texture for the top face of a Region prestige token. */
export function prestigeTokenTexture(opts: {
  baseValue: number;
  plus4: boolean;
  coinSum?: number;
  bg: string;
  color?: string;
}): THREE.CanvasTexture {
  const { baseValue, plus4, coinSum = 0, bg, color = "#2b2416" } = opts;
  const key = `prestige-token-${baseValue}-${plus4}-${coinSum}-${bg}-${color}`;
  return canvasTexture(key, 256, 256, (ctx) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 256, 256);

    ctx.strokeStyle = "rgba(43, 36, 22, 0.35)";
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, 244, 244);

    ctx.fillStyle = color;
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 8;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const text = coinSum > 0 ? `${baseValue}+${coinSum}` : String(baseValue);
    ctx.font = `bold ${coinSum > 0 ? 76 : 116}px ${UI_FONT}`;
    ctx.fillText(text, 128, 138);

    if (plus4) {
      ctx.shadowBlur = 4;
      ctx.font = `bold 48px ${UI_FONT}`;
      ctx.fillText("+4", 194, 68);
    }
  });
}
