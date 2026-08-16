import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { SimulationProvider } from "@/components/simulation/SimulationProvider";
import { ToastStack } from "@/components/simulation/ToastStack";
import { TopBar } from "@/components/simulation/TopBar";

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
  description: "Sistema de Gestão de Transporte (TMS) — simulação operacional",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${sora.variable} ${roobertStandIn.variable} antialiased`}>
        <SimulationProvider>
          <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 min-w-0 h-screen flex flex-col">
              <TopBar />
              <main className="flex-1 min-w-0 overflow-hidden flex flex-col">{children}</main>
            </div>
          </div>
          <ToastStack />
        </SimulationProvider>
      </body>
    </html>
  );
}
