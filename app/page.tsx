"use client";

import dynamic from "next/dynamic";

// The game is fully client-side (WebGL + canvas textures) — skip SSR.
const GameApp = dynamic(() => import("@/components/GameApp"), { ssr: false });

export default function Page() {
  return <GameApp />;
}
