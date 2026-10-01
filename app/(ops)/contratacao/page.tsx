import { redirect } from "next/navigation";

// Contratação agora acontece no contexto da carga (Cargas → painel da carga)
// e na etapa 3 do Planejamento. A rota antiga continua válida.
export default async function ContratacaoRedirect({ searchParams }: { searchParams: Promise<{ load?: string }> }) {
  const { load } = await searchParams;
  redirect(load ? `/loads?carga=${encodeURIComponent(load)}` : "/loads?filtro=aguardando");
}
