import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export: the app is fully client-side, and the Bun websocket server
  // (server/ws.ts) serves the exported `out/` directory in production.
  output: "export",
  transpilePackages: ["three"],
};

export default nextConfig;
