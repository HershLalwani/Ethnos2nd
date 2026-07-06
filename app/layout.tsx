import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ethnos — 2nd Edition",
  description:
    "Digital 3D adaptation of Ethnos 2nd Edition: unite the Clans, control the Regions, become Emperor.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
