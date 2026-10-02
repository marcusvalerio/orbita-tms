"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Dialog as D } from "radix-ui";
import { Ellipsis, X } from "lucide-react";
import { useOperation } from "@/components/operation/OperationProvider";
import { cn } from "@/lib/ui/cn";
import { ALL_ITEMS, MOBILE_PRIMARY, NAV, isActive } from "./navigation";

// Mobile: cinco destinos fixos (Central · Mapa · Viagens · Ocorrências · Mais).
// O resto da navegação abre num sheet — o mobile não tenta ser o desktop.
export function BottomNav() {
  const pathname = usePathname();
  const { data, can } = useOperation();
  const [more, setMore] = useState(false);
  const primary = MOBILE_PRIMARY.map((id) => ALL_ITEMS.find((i) => i.id === id)!);
  const moreActive = !primary.some((i) => isActive(i, pathname));
  const moreCount = ALL_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.id as never) && i.badgeTone === "attention").reduce((n, i) => n + (i.badge?.(data) ?? 0), 0);

  return (
    <>
      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-30 border-t border-line-subtle bg-surface/97 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden">
        <ul className="grid h-(--orb-bottom-nav-h) grid-cols-5">
          {primary.map((item) => {
            const Icon = item.icon;
            const active = isActive(item, pathname);
            const count = item.badge?.(data) ?? 0;
            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("relative flex h-full flex-col items-center justify-center gap-0.5 text-caption", active ? "text-fg" : "text-fg-muted")}
                >
                  {active && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />}
                  <span className="relative">
                    <Icon className="size-5" aria-hidden />
                    {count > 0 && <span className="tabular absolute -right-2 -top-1 min-w-4 rounded-full bg-danger px-1 text-center text-caption leading-4 text-fg-inverse">{count}</span>}
                  </span>
                  {item.id === "central" ? "Central" : item.label}
                </Link>
              </li>
            );
          })}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={cn("relative flex h-full w-full flex-col items-center justify-center gap-0.5 text-caption", moreActive ? "text-fg" : "text-fg-muted")}>
              {moreActive && <span aria-hidden className="absolute top-0 h-0.5 w-8 rounded-b-full bg-brand" />}
              <span className="relative">
                <Ellipsis className="size-5" aria-hidden />
                {moreCount > 0 && <span aria-hidden className="absolute -right-1 -top-0.5 size-2 rounded-full bg-danger" />}
              </span>
              Mais
            </button>
          </li>
        </ul>
      </nav>

      <D.Root open={more} onOpenChange={setMore}>
        <D.Portal>
          <D.Overlay className="orb-overlay fixed inset-0 z-40 bg-overlay md:hidden" />
          <D.Content className="orb-panel fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-lg bg-surface pb-[max(16px,env(safe-area-inset-bottom))] shadow-3 md:hidden">
            <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" />
            <div className="flex items-center justify-between px-4 pb-1 pt-2">
              <D.Title className="text-h2 text-fg">Todas as áreas</D.Title>
              <D.Close aria-label="Fechar" className="grid size-9 place-items-center rounded-sm text-fg-muted hover:bg-surface-hover">
                <X className="size-4" aria-hidden />
              </D.Close>
            </div>
            <D.Description className="sr-only">Navegação completa do ÓRBITA</D.Description>
            {NAV.map((g) => {
              const items = g.items.filter((i) => (!i.permission || can(i.permission)));
              if (!items.length) return null;
              return (
                <div key={g.id} className="px-2 pb-2">
                  <p className="px-2 pb-1 pt-3 text-caption font-medium text-fg-subtle">{g.label}</p>
                  <ul className="grid grid-cols-2 gap-1">
                    {items.map((item) => {
                      const Icon = item.icon;
                      const count = item.badge?.(data) ?? 0;
                      const active = isActive(item, pathname);
                      return (
                        <li key={item.id}>
                          <Link
                            href={item.href}
                            onClick={() => setMore(false)}
                            aria-current={active ? "page" : undefined}
                            className={cn("flex h-11 items-center gap-2.5 rounded-sm px-2 text-body", active ? "bg-surface-selected text-fg" : "text-fg hover:bg-surface-hover")}
                          >
                            <Icon className={cn("size-4", active ? "text-brand-fg" : "text-fg-muted")} aria-hidden />
                            <span className="flex-1 truncate">{item.label}</span>
                            {count > 0 && <span className="tabular text-caption text-fg-muted">{count}</span>}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </D.Content>
        </D.Portal>
      </D.Root>
    </>
  );
}
