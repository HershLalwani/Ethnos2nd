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

/** Face texture for an ally card (also used by the 3D pool cards). */
export function cardFaceTexture(clan: Clan, color: RegionColor): THREE.CanvasTexture {
  return canvasTexture(`card-${clan}-${color}`, 256, 360, (ctx) => {
    const region = REGION_INFO[color];
    const info = CLAN_INFO[clan];
    ctx.fillStyle = region.hex;
    roundRect(ctx, 0, 0, 256, 360, 22);
    ctx.fill();
    ctx.fillStyle = "#f6f1e3";
    roundRect(ctx, 12, 12, 232, 336, 14);
    ctx.fill();
    // color band with region name
    ctx.fillStyle = region.hex;
    roundRect(ctx, 12, 12, 232, 54, 14);
    ctx.fill();
    ctx.fillRect(12, 44, 232, 22);
    ctx.fillStyle = color === "white" || color === "yellow" ? "#3a3325" : "#f6f1e3";
    ctx.font = `bold 26px ${UI_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(region.name.replace(" Region", "").toUpperCase(), 128, 41);
    // emoji
    ctx.font = `120px ${EMOJI_FONT}`;
    ctx.fillText(info.emoji, 128, 190);
    // clan name
    ctx.fillStyle = "#3a3325";
    ctx.font = `bold 26px ${UI_FONT}`;
    const words = info.name.split(" ");
    ctx.fillText(words[0], 128, 288);
    ctx.font = `22px ${UI_FONT}`;
    ctx.fillText(words.slice(1).join(" "), 128, 318);
  });
}

export function cardBackTexture(): THREE.CanvasTexture {
  return canvasTexture("card-back", 256, 360, (ctx) => {
    ctx.fillStyle = "#232a3d";
    roundRect(ctx, 0, 0, 256, 360, 22);
    ctx.fill();
    ctx.strokeStyle = "#c9a227";
    ctx.lineWidth = 6;
    roundRect(ctx, 14, 14, 228, 332, 14);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `90px ${EMOJI_FONT}`;
    ctx.fillText("🐉", 128, 160);
    ctx.fillStyle = "#c9a227";
    ctx.font = `bold 34px ${UI_FONT}`;
    ctx.fillText("ETHNOS", 128, 268);
  });
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

const ROMAN = ["Ⅰ", "Ⅱ", "Ⅲ"];

/**
 * The floating prestige display for one region: its name plus a row per
 * prestige token (current Age highlighted, Raccoon coins appended).
 */
export function prestigeTexture(
  regionName: string,
  regionHex: string,
  tokens: number[],
  ageIdx: number,
  coinSum: number
): { tex: THREE.CanvasTexture; aspect: number } {
  const rows = tokens.length;
  const w = 240;
  const h = 74 + rows * 62;
  const key = `prestige-${regionName}-${tokens.join(",")}-${ageIdx}-${coinSum}`;
  const tex = canvasTexture(key, w, h, (ctx) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // region name plate
    ctx.fillStyle = regionHex;
    roundRect(ctx, 10, 6, w - 20, 52, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 3;
    roundRect(ctx, 10, 6, w - 20, 52, 16);
    ctx.stroke();
    ctx.fillStyle = regionName === "White" || regionName === "Yellow" ? "#332d20" : "#ffffff";
    ctx.font = `bold 30px ${UI_FONT}`;
    ctx.fillText(regionName.toUpperCase(), w / 2, 33);
    // token rows, highest (III) on top
    for (let i = rows - 1; i >= 0; i--) {
      const y = 66 + (rows - 1 - i) * 62;
      const active = i === Math.min(ageIdx, rows - 1);
      ctx.globalAlpha = active ? 1 : 0.45;
      ctx.fillStyle = active ? "#ffd75e" : "#cfd6e4";
      roundRect(ctx, 24, y, w - 48, 54, 27);
      ctx.fill();
      ctx.fillStyle = "#332d20";
      ctx.font = `bold 30px ${UI_FONT}`;
      const coinText = active && coinSum > 0 ? `  +${coinSum}🪙` : "";
      ctx.fillText(`${ROMAN[i]}  ${tokens[i]}${coinText}`, w / 2, y + 28);
      ctx.globalAlpha = 1;
    }
  });
  return { tex, aspect: w / h };
}
