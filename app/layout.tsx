import type { Metadata, Viewport } from "next";
import { Sora, Inter, Geist_Mono } from "next/font/google";
import "./globals.css";

// Tipografia do Órbita DS 2.0 (docs/orbita-2.0/phase-2/DESIGN-SYSTEM.md):
//   Sora       → títulos e número-herói (marca)
//   Inter      → interface e texto (substituto da Roobert licenciada, que pode
//                entrar depois via next/font/local sem mudar tokens)
//   Geist Mono → dado operacional: IDs, placas, códigos de rota, horários, km
const sora = Sora({ subsets: ["latin"], variable: "--font-sora", weight: ["600", "700"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400", "500", "600"] });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: { default: "ÓRBITA TMS", template: "%s · ÓRBITA" },
  description: "Sistema de Gestão de Transporte (TMS)",
};

export const viewport: Viewport = {
  themeColor: "#161616",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${inter.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
