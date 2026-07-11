import * as THREE from "three";
import { CLAN_INFO, REGION_INFO } from "@/game/constants";
import type { Clan, RegionColor } from "@/game/types";

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

/**
 * Face of a played ally card lying flat on the table: Region-colored card with
 * the clan emoji. Laid flat via a `rotation-x = -PI/2` mesh, the texture's top
 * points toward the board — the "far" edge — so the card reads upright to the
 * player seated on that side (each seat's card group is rotated to face them).
 */
export function cardTexture(
  clan: Clan,
  color: RegionColor,
  leader = false
): { tex: THREE.CanvasTexture; aspect: number } {
  const w = 200;
  const h = 280;
  const key = `card-${clan}-${color}-${leader}`;
  const region = REGION_INFO[color];
  const tex = canvasTexture(key, w, h, (ctx) => {
    ctx.fillStyle = region.hex;
    roundRect(ctx, 6, 6, w - 12, h - 12, 24);
    ctx.fill();

    // Frosted inner panel so emojis stay legible on any Region color.
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    roundRect(ctx, 22, 22, w - 44, h - 44, 16);
    ctx.fill();

    ctx.font = `128px ${EMOJI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(CLAN_INFO[clan].emoji, w / 2, h / 2 + 4);

    ctx.lineWidth = leader ? 16 : 6;
    ctx.strokeStyle = leader ? "#f6c945" : "rgba(0,0,0,0.4)";
    roundRect(ctx, 9, 9, w - 18, h - 18, 22);
    ctx.stroke();
  });
  return { tex, aspect: w / h };
}
