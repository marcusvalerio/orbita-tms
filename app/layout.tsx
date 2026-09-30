import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

// Roobert é uma fonte licenciada (Displaay Type Foundry) e não está disponível
// via Google Fonts/npm. Usamos Inter como substituto provisório com a mesma
// função (corpo/operação) até os arquivos oficiais da Roobert serem
// adicionados em /public/fonts e registrados via next/font/local.
const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
  weight: ["400", "500", "600", "700"],
});

const roobertStandIn = Inter({
  subsets: ["latin"],
  variable: "--font-roobert",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "ÓRBITA TMS",
  description: "Sistema de Gestão de Transporte (TMS)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${roobertStandIn.variable} antialiased`}>{children}</body>
    </html>
  );
}
