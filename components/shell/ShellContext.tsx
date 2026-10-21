"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

// Contexto do App Shell: a página informa o detalhe do breadcrumb e as ações
// contextuais (que aparecem no Command Menu). O shell abre ⌘K e Novo Pedido.

export interface ContextCommand {
  id: string;
  label: string;
  hint?: string;
  icon?: ReactNode;
  run: () => void;
}

interface ShellState {
  crumb: string | null;
  setCrumb: (c: string | null) => void;
  commands: ContextCommand[];
  setCommands: (c: ContextCommand[]) => void;
  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  newOrderOpen: boolean;
  setNewOrderOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [crumb, setCrumb] = useState<string | null>(null);
  const [commands, setCommands] = useState<ContextCommand[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const value = useMemo(
    () => ({ crumb, setCrumb, commands, setCommands, commandOpen, setCommandOpen, newOrderOpen, setNewOrderOpen }),
    [crumb, commands, commandOpen, newOrderOpen]
  );
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShell() {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useShell precisa de ShellProvider");
  return ctx;
}

/** Define o último nível do breadcrumb (ex.: "VIA-00004") enquanto a página estiver montada. */
export function useBreadcrumb(crumb: string | null) {
  const { setCrumb } = useShell();
  useEffect(() => {
    setCrumb(crumb);
    return () => setCrumb(null);
  }, [crumb, setCrumb]);
}

/** Registra ações do contexto atual no Command Menu. */
export function useContextCommands(commands: ContextCommand[]) {
  const { setCommands } = useShell();
  const key = commands.map((c) => c.id).join("|");
  useEffect(() => {
    setCommands(commands);
    return () => setCommands([]);
    // As ações mudam quando muda o conjunto de ids; a função `run` mais recente é capturada no próximo registro.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setCommands]);
}
