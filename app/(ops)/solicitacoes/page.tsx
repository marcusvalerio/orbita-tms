import { redirect } from "next/navigation";

// Solicitações recebidas viraram a "Caixa de entrada" de Pedidos.
export default function SolicitacoesRedirect() {
  redirect("/orders?aba=entrada");
}
