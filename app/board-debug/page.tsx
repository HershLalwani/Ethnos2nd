"use client";

// Dev-only calibration view: draws public/Ethnos.jpg with every anchor from
// boardMap.ts overlaid, so the UV constants can be tuned against the photo.
// Cyan dots = prestige track, white circle = region click hotspot,
// dashed ellipse = marker area, magenta boxes = Ⅰ/Ⅱ/Ⅲ token slots.

import { useEffect, useRef } from "react";
import { REGION_MAP, trackUV } from "@/components/three/boardMap";

const SIZE = 1200;

export default function BoardDebug() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const img = new Image();
    img.src = "/Ethnos.jpg";
    img.onload = () => {
      const w = SIZE;
      const h = (SIZE * img.naturalHeight) / img.naturalWidth;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let n = 0; n < 80; n++) {
        const [u, v] = trackUV(n);
        ctx.fillStyle = "rgba(0,255,255,0.9)";
        ctx.beginPath();
        ctx.arc(u * w, v * h, 5, 0, Math.PI * 2);
        ctx.fill();
        if (n % 5 === 0) {
          ctx.fillStyle = "#ff2222";
          ctx.font = "bold 15px monospace";
          ctx.fillText(String(n), u * w, v * h - 14);
        }
      }

      for (const [color, a] of Object.entries(REGION_MAP)) {
        const [cu, cv] = a.center;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.lineWidth = 2;
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(cu * w, cv * h, a.clickR * w, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 18px monospace";
        ctx.fillText(color, cu * w, cv * h);

        ctx.strokeStyle = "rgba(255,255,0,0.95)";
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.ellipse(a.markers[0] * w, a.markers[1] * h, a.markerR[0] * w, a.markerR[1] * h, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.setLineDash([]);
        ctx.strokeStyle = "#ff00ff";
        for (const [bu, bv] of a.box) {
          ctx.strokeRect(bu * w - 0.019 * w, bv * h - 0.019 * w, 0.038 * w, 0.038 * w);
        }
      }
    };
  }, []);

  return (
    <div style={{ background: "#111", minHeight: "100vh", padding: 8 }}>
      <canvas ref={ref} style={{ maxWidth: "100%" }} />
    </div>
  );
}
