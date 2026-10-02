"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronRight, LogOut, Plus, Search, Siren, Waypoints, ClipboardList } from "lucide-react";
import { OrbitaMark } from "@/components/ui/OrbitaMark";
import { Button, IconButton, Menu, Popover, Status, EmptyState } from "@/components/ds";
import { useOperation } from "@/components/operation/OperationProvider";
import { getRecentActivity } from "@/lib/data/atlas";
import { signOut } from "@/app/auth/actions";
import { cn } from "@/lib/ui/cn";
import { activeItem } from "./navigation";
import { useShell } from "./ShellContext";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { crumb, setCommandOpen, setNewOrderOpen } = useShell();
  const { can, mode, actor, roleLabel, pending } = useOperation();
  const item = activeItem(pathname);
  const title = item?.label ?? "ÓRBITA";

  return (
    <header className="sticky top-0 z-30 flex h-(--orb-header-h) shrink-0 items-center gap-2 border-b border-line-subtle bg-surface/95 px-3 backdrop-blur-sm md:px-4">
      {/* Mobile: marca + título da tela */}
      <Link href="/" aria-label="ÓRBITA — Command Center" className="flex items-center rounded-sm md:hidden">
        <OrbitaMark size={18} />
      </Link>

      <nav aria-label="Você está em" className="min-w-0 flex-1">
        <ol className="flex min-w-0 items-center gap-1 text-body-sm">
          {item && (
            <li className="hidden shrink-0 text-fg-muted md:block">
              {item.group}
              <ChevronRight className="ml-1 inline size-3.5 text-fg-subtle" aria-hidden />
            </li>
          )}
          <li className={cn("truncate font-medium", crumb ? "hidden text-fg-muted sm:block" : "text-fg")}>
            {crumb ? (
              <Link href={item?.href ?? "/"} className="hover:text-fg hover:underline underline-offset-2">
                {title}
              </Link>
            ) : (
              <span aria-current="page">{title}</span>
            )}
          </li>
          {crumb && (
            <li className="flex min-w-0 items-center gap-1">
              <ChevronRight className="hidden size-3.5 shrink-0 text-fg-subtle sm:block" aria-hidden />
              <span aria-current="page" className="orb-data truncate font-medium text-fg">
                {crumb}
              </span>
            </li>
          )}
        </ol>
      </nav>

      {pending && (
        <span role="status" className="hidden items-center gap-1.5 text-caption text-fg-muted sm:flex">
          <span className="size-1.5 animate-orb-pulse rounded-full bg-info" aria-hidden />
          Salvando…
        </span>
      )}

      <button
        type="button"
        onClick={() => setCommandOpen(true)}
        className="hidden h-8 w-64 items-center gap-2 rounded-sm border border-line bg-canvas px-2.5 text-body-sm text-fg-subtle transition-colors hover:border-line-strong hover:text-fg-muted lg:flex"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Buscar ou executar…</span>
        <kbd className="orb-data rounded-xs border border-line px-1 text-caption">⌘K</kbd>
      </button>
      <IconButton className="lg:hidden" label="Buscar" shortcut="⌘K" icon={<Search className="size-4" />} onClick={() => setCommandOpen(true)} />

      <Notifications />

      {(can("orders:create") || can("planning:consolidate")) && (
        <Menu
          label="Criar"
          trigger={
            <Button variant="primary" size="md" icon={<Plus className="size-4" aria-hidden />} trailing={<ChevronDown className="hidden size-3.5 opacity-70 sm:block" aria-hidden />} className="max-sm:size-8 max-sm:px-0">
              <span className="sr-only sm:not-sr-only">Novo</span>
            </Button>
          }
          items={[
            ...(can("orders:create") ? [{ label: "Novo pedido", icon: <ClipboardList />, onSelect: () => setNewOrderOpen(true) }] : []),
            ...(can("planning:consolidate") ? [{ label: "Planejar transporte", icon: <Waypoints />, onSelect: () => router.push("/planning") }] : []),
          ]}
        />
      )}

      <Menu
        label="Perfil"
        trigger={
          <button type="button" aria-label={`Perfil: ${actor.name}`} className="grid size-8 place-items-center rounded-full bg-surface-sunken text-caption font-semibold text-fg ring-1 ring-line hover:ring-line-strong">
            {initials(actor.name)}
          </button>
        }
        items={[
          { label: `${actor.name} · ${roleLabel}`, onSelect: () => {}, disabled: true },
          { label: mode === "demo" ? "Modo Demo — dados simulados" : "Modo Produção", onSelect: () => {}, disabled: true },
          "separator",
          ...(mode === "production" ? [{ label: "Sair", icon: <LogOut />, onSelect: () => void signOut() }] : []),
        ]}
      />
    </header>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Notifications() {
  const { data } = useOperation();
  const open = data.occurrences
    .filter((o) => !o.resolved)
    .sort((a, b) => (a.severity === "Crítica" ? -1 : 0) - (b.severity === "Crítica" ? -1 : 0) || b.reportedAt.localeCompare(a.reportedAt));
  const inbox = (data.solicitations ?? []).filter((s) => s.status === "Solicitada");
  const activity = getRecentActivity(data, 6);
  const count = open.length + inbox.length;

  return (
    <Popover
      label="Notificações"
      className="w-[min(380px,calc(100vw-24px))] p-0"
      trigger={<IconButton label={count ? `Notificações, ${count} pendentes` : "Notificações"} badge={count} icon={<Bell className="size-4" />} />}
    >
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-2.5">
        <p className="text-h3 text-fg">Notificações</p>
        <Link href="/occurrences" className="text-caption font-medium text-fg-muted hover:text-fg">
          Ver ocorrências
        </Link>
      </div>
      <div className="orb-scroll max-h-[60vh] overflow-y-auto">
        {open.length === 0 && inbox.length === 0 && <EmptyState compact icon={<Bell />} title="Nada pendente." description="Ocorrências e solicitações novas aparecem aqui." />}
        {open.map((o) => (
          <Link key={o.id} href={`/occurrences?ocorrencia=${o.id}`} className="flex items-start gap-3 border-b border-line-subtle px-4 py-2.5 hover:bg-surface-hover">
            <Siren className="mt-0.5 size-4 shrink-0 text-exception" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-body-sm text-fg">
                {o.type} · <span className="orb-data">{o.shipmentId}</span>
              </span>
              <span className="block truncate text-caption text-fg-muted">{o.description}</span>
            </span>
            <Status entity="severity" value={o.severity} size="sm" />
          </Link>
        ))}
        {inbox.map((s) => (
          <Link key={s.id} href={`/orders?aba=entrada&solicitacao=${s.id}`} className="flex items-center gap-3 border-b border-line-subtle px-4 py-2.5 hover:bg-surface-hover">
            <ClipboardList className="size-4 shrink-0 text-info" aria-hidden />
            <span className="flex-1 text-body-sm text-fg">
              Nova solicitação <span className="orb-data">{s.id}</span>
            </span>
            <Status entity="solicitation" value={s.status} size="sm" />
          </Link>
        ))}
        {activity.length > 0 && (
          <div className="px-4 py-2.5">
            <p className="mb-1.5 text-caption font-medium text-fg-subtle">Atividade recente</p>
            <ul className="space-y-1.5">
              {activity.map((e) => (
                <li key={e.id} className="flex gap-3 text-caption">
                  <span className="orb-data shrink-0 text-fg-subtle">{new Date(e.timestamp).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })}</span>
                  <span className="text-fg-muted">{e.label}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Popover>
  );
}
