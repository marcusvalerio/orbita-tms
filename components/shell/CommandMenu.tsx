"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog as D } from "radix-ui";
import {
  ArrowRight,
  Boxes,
  Building,
  ClipboardList,
  Clock,
  CornerDownLeft,
  IdCard,
  Inbox,
  ListFilter,
  Plus,
  Route,
  Search,
  Siren,
  Truck,
  Users,
  Waypoints,
} from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { buildSearchIndex, searchEntries, KIND_LABEL, type SearchEntry, type SearchKind } from "@/lib/ui/search-index";
import { ALL_ITEMS } from "./navigation";
import { useShell } from "./ShellContext";

// Command Menu (⌘K / Ctrl+K): ir para, buscar, criar, filtros prontos e
// ações do contexto atual. Respeita o papel (RBAC) do usuário.

const KIND_ICON: Record<SearchKind, ReactNode> = {
  viagem: <Route />,
  pedido: <ClipboardList />,
  carga: <Boxes />,
  veiculo: <Truck />,
  motorista: <IdCard />,
  cliente: <Users />,
  ocorrencia: <Siren />,
  transportadora: <Building />,
  solicitacao: <Inbox />,
};

const RECENTS_KEY = "orbita-cmdk-recent";

function readRecents(): SearchEntry[] {
  try {
    return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function pushRecent(e: SearchEntry) {
  try {
    const next = [e, ...readRecents().filter((r) => r.key !== e.key)].slice(0, 5);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* armazenamento indisponível: recentes são só conveniência */
  }
}

/** Filtros prontos: hoje são URLs com filtro; no futuro podem virar busca semântica. */
const PRESETS = [
  { id: "late", label: "Mostrar viagens atrasadas", href: "/shipments?filtro=atrasadas", keywords: "atraso atrasada fora da janela" },
  { id: "risk", label: "Mostrar entregas em risco", href: "/deliveries?filtro=risco", keywords: "janela risco" },
  { id: "open-occ", label: "Ocorrências em aberto", href: "/occurrences?filtro=abertas", keywords: "exceções abertas" },
  { id: "critical", label: "Ocorrências críticas", href: "/occurrences?filtro=criticas", keywords: "crítica roubo acidente" },
  { id: "contract", label: "Cargas aguardando contratação", href: "/loads?filtro=aguardando", keywords: "contratar cotação" },
  { id: "inbox", label: "Solicitações na caixa de entrada", href: "/orders?aba=entrada", keywords: "parceiro portal" },
];

export function CommandMenu() {
  const router = useRouter();
  const { data, can } = useOperation();
  const { commandOpen, setCommandOpen, commands, setNewOrderOpen } = useShell();
  const [query, setQuery] = useState("");
  const [recents, setRecents] = useState<SearchEntry[]>([]);

  // Atalhos globais: ⌘K/Ctrl+K alterna; "/" abre fora de campos de texto.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName));
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
      } else if (e.key === "/" && !typing && !commandOpen) {
        e.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commandOpen, setCommandOpen]);

  const onOpenChange = (open: boolean) => {
    setCommandOpen(open);
    if (open) setRecents(readRecents());
    else setQuery("");
  };

  const index = useMemo(() => (commandOpen ? buildSearchIndex(data) : []), [commandOpen, data]);
  const results = useMemo(() => searchEntries(index, query), [index, query]);
  const grouped = useMemo(() => {
    const m = new Map<SearchKind, SearchEntry[]>();
    for (const r of results) m.set(r.kind, [...(m.get(r.kind) ?? []), r]);
    return [...m.entries()];
  }, [results]);

  const go = (href: string) => {
    setCommandOpen(false);
    setQuery("");
    router.push(href);
  };
  const openEntry = (e: SearchEntry) => {
    pushRecent(e);
    go(e.href);
  };
  const run = (fn: () => void) => {
    setCommandOpen(false);
    setQuery("");
    fn();
  };

  const q = query.trim();
  const nav = ALL_ITEMS.filter((i) => !i.pending && (!i.permission || can(i.permission)));

  return (
    <D.Root open={commandOpen} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="orb-overlay fixed inset-0 z-50 bg-overlay" />
        <D.Content
          aria-label="Command Menu"
          className="orb-dialog fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-lg border border-line-subtle bg-surface shadow-3 outline-none"
        >
          <D.Title className="sr-only">Command Menu</D.Title>
          <D.Description className="sr-only">Busque pedidos, viagens, veículos e motoristas, navegue ou execute ações.</D.Description>
          <Command label="Command Menu" shouldFilter={false} loop className="flex max-h-[min(560px,72vh)] flex-col">
            <div className="flex items-center gap-2.5 border-b border-line-subtle px-4">
              <Search aria-hidden className="size-4 shrink-0 text-fg-subtle" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar viagem, pedido, placa, motorista… ou digite uma ação"
                className="h-12 flex-1 bg-transparent text-body text-fg outline-none placeholder:text-fg-subtle focus-visible:outline-none"
              />
              <kbd className="orb-data rounded-xs border border-line px-1.5 text-caption text-fg-subtle">Esc</kbd>
            </div>
            <Command.List className="orb-scroll min-h-0 flex-1 overflow-y-auto p-1.5 [&_[cmdk-list-sizer]]:transition-[height] [&_[cmdk-list-sizer]]:duration-(--orb-duration-fast)">
              <Command.Empty className="px-3 py-8 text-center text-body-sm text-fg-muted">
                Nada encontrado para “{q}”. Tente o ID (VIA-00004), a placa ou o nome do cliente.
              </Command.Empty>

              {commands.length > 0 && match(q, "contexto ações") && (
                <Group heading="Nesta tela">
                  {commands
                    .filter((c) => !q || norm(c.label).includes(norm(q)))
                    .map((c) => (
                      <Item key={c.id} value={`ctx-${c.id}`} icon={c.icon ?? <ArrowRight />} label={c.label} hint={c.hint} onSelect={() => run(c.run)} />
                    ))}
                </Group>
              )}

              {!q && recents.length > 0 && (
                <Group heading="Recentes">
                  {recents.map((r) => (
                    <Item key={`rec-${r.key}`} value={`rec-${r.key}`} icon={<Clock />} label={r.label} hint={r.sublabel} onSelect={() => openEntry(r)} />
                  ))}
                </Group>
              )}

              {grouped.map(([kind, entries]) => (
                <Group key={kind} heading={KIND_LABEL[kind]}>
                  {entries.map((e) => (
                    <Item key={e.key} value={e.key} icon={KIND_ICON[e.kind]} label={e.label} hint={e.sublabel} mono={e.kind !== "cliente" && e.kind !== "motorista" && e.kind !== "transportadora"} onSelect={() => openEntry(e)} />
                  ))}
                </Group>
              ))}

              {(() => {
                const actions = [
                  can("orders:create") && { id: "new-order", label: "Criar pedido", icon: <Plus />, keywords: "novo pedido ordem", fn: () => setNewOrderOpen(true) },
                  can("planning:consolidate") && { id: "new-plan", label: "Criar viagem (planejar transporte)", icon: <Waypoints />, keywords: "nova viagem planejamento carga", fn: () => go("/planning") },
                ].filter(Boolean) as { id: string; label: string; icon: ReactNode; keywords: string; fn: () => void }[];
                const shown = actions.filter((a) => match(q, `${a.label} ${a.keywords}`));
                return shown.length ? (
                  <Group heading="Criar">
                    {shown.map((a) => (
                      <Item key={a.id} value={a.id} icon={a.icon} label={a.label} onSelect={() => run(a.fn)} />
                    ))}
                  </Group>
                ) : null;
              })()}

              {(() => {
                const shown = PRESETS.filter((p) => match(q, `${p.label} ${p.keywords}`));
                return shown.length ? (
                  <Group heading="Filtros prontos">
                    {shown.map((p) => (
                      <Item key={p.id} value={`preset-${p.id}`} icon={<ListFilter />} label={p.label} onSelect={() => go(p.href)} />
                    ))}
                  </Group>
                ) : null;
              })()}

              {(() => {
                const shown = nav.filter((i) => match(q, `${i.label} ${i.group} ${i.keywords ?? ""} ir para abrir`));
                return shown.length ? (
                  <Group heading="Ir para">
                    {shown.map((i) => {
                      const Icon = i.icon;
                      return <Item key={i.id} value={`nav-${i.id}`} icon={<Icon />} label={i.label} hint={i.group} onSelect={() => go(i.href)} />;
                    })}
                  </Group>
                ) : null;
              })()}
            </Command.List>
            <div className="flex items-center gap-4 border-t border-line-subtle bg-canvas px-4 py-2 text-caption text-fg-muted">
              <span className="flex items-center gap-1">
                <kbd className="orb-data">↑↓</kbd> navegar
              </span>
              <span className="flex items-center gap-1">
                <CornerDownLeft className="size-3" aria-hidden /> abrir
              </span>
              <span className="ml-auto flex items-center gap-1">
                <kbd className="orb-data">/</kbd> ou <kbd className="orb-data">⌘K</kbd> abre de qualquer lugar
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

const norm = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
function match(q: string, text: string) {
  if (!q) return true;
  const hay = norm(text);
  return norm(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function Group({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="mb-1 [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-caption [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-subtle"
    >
      {children}
    </Command.Group>
  );
}

function Item({ value, icon, label, hint, onSelect, mono }: { value: string; icon: ReactNode; label: string; hint?: string; onSelect: () => void; mono?: boolean }) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="group flex h-10 cursor-default select-none items-center gap-3 rounded-sm px-2.5 text-body-sm text-fg transition-colors duration-(--orb-duration-instant) data-[selected=true]:bg-surface-hover"
    >
      <span aria-hidden className="grid size-6 shrink-0 place-items-center rounded-xs text-fg-muted [&_svg]:size-4 group-data-[selected=true]:text-fg">
        {icon}
      </span>
      <span className={mono ? "orb-data shrink-0" : "shrink-0"}>{label}</span>
      {hint && <span className="min-w-0 truncate text-caption text-fg-muted">{hint}</span>}
      <ArrowRight aria-hidden className="ml-auto size-3.5 shrink-0 text-fg-subtle opacity-0 transition-opacity group-data-[selected=true]:opacity-100" />
    </Command.Item>
  );
}
