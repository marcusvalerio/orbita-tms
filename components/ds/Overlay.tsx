"use client";

import type { ReactNode } from "react";
import { Tooltip as T, Popover as P, DropdownMenu as M, Dialog as D } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/ui/cn";

/* ---------------------------------------------------------------- Tooltip */

export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <T.Provider delayDuration={400} skipDelayDuration={200}>
      {children}
    </T.Provider>
  );
}

export function Tooltip({ content, children, side = "bottom" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="orb-popover z-50 rounded-md bg-chrome px-2 py-1 text-caption text-chrome-fg shadow-3"
        >
          {content}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}

/* ---------------------------------------------------------------- Popover */

export function Popover({
  trigger,
  children,
  align = "end",
  className,
  open,
  onOpenChange,
  label,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  label?: string;
}) {
  return (
    <P.Root open={open} onOpenChange={onOpenChange}>
      <P.Trigger asChild>{trigger}</P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={6}
          collisionPadding={12}
          aria-label={label}
          className={cn("orb-popover z-50 rounded-md border border-line-subtle bg-surface shadow-3 outline-none", className)}
        >
          {children}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}

/* ---------------------------------------------------------------- Menu */

export interface MenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  shortcut?: string;
}

export function Menu({ trigger, items, label, align = "end" }: { trigger: ReactNode; items: (MenuItem | "separator")[]; label?: string; align?: "start" | "end" }) {
  return (
    <M.Root>
      <M.Trigger asChild>{trigger}</M.Trigger>
      <M.Portal>
        <M.Content
          align={align}
          sideOffset={4}
          collisionPadding={12}
          aria-label={label}
          className="orb-popover z-50 min-w-48 rounded-md border border-line-subtle bg-surface p-1 shadow-3"
        >
          {items.map((item, i) =>
            item === "separator" ? (
              <M.Separator key={`sep-${i}`} className="my-1 h-px bg-line-subtle" />
            ) : (
              <M.Item
                key={item.label}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 text-body-sm outline-none",
                  "data-highlighted:bg-surface-hover data-disabled:text-fg-disabled",
                  item.tone === "danger" ? "text-danger-fg" : "text-fg"
                )}
              >
                <span aria-hidden className="text-fg-muted [&_svg]:size-4">
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.shortcut && <kbd className="orb-data text-caption text-fg-subtle">{item.shortcut}</kbd>}
              </M.Item>
            )
          )}
        </M.Content>
      </M.Portal>
    </M.Root>
  );
}

/* ---------------------------------------------------------------- Dialog */

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  dismissible = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** false: clique fora não fecha (formulários com dados). Esc continua fechando. */
  dismissible?: boolean;
}) {
  const width = size === "sm" ? "max-w-[420px]" : size === "lg" ? "max-w-[760px]" : "max-w-[560px]";
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="orb-overlay fixed inset-0 z-40 bg-overlay" />
        <D.Content
          onPointerDownOutside={dismissible ? undefined : (e) => e.preventDefault()}
          className={cn(
            "orb-dialog fixed left-1/2 top-[8vh] z-50 flex max-h-[84vh] w-[calc(100vw-32px)] -translate-x-1/2 flex-col",
            "rounded-lg border border-line-subtle bg-surface shadow-3 outline-none",
            width
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-line-subtle px-5 py-4">
            <div className="min-w-0">
              <D.Title className="text-h2 text-fg">{title}</D.Title>
              {description ? (
                <D.Description className="mt-0.5 text-body-sm text-fg-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{title}</D.Description>
              )}
            </div>
            <D.Close className="-mr-1 grid size-8 place-items-center rounded-sm text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label="Fechar">
              <X className="size-4" aria-hidden />
            </D.Close>
          </header>
          <div className="orb-scroll min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <footer className="flex items-center justify-end gap-2 border-t border-line-subtle px-5 py-3">{footer}</footer>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/* ---------------------------------------------------------------- Drawer
   Painel contextual. Desktop: lateral direita (440px). Mobile: sheet de baixo. */

export function Drawer({
  open,
  onOpenChange,
  title,
  subtitle,
  status,
  actions,
  children,
  footer,
  modal = true,
  width,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  subtitle?: ReactNode;
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** false: não bloqueia o resto da tela (ex.: sobre o mapa). */
  modal?: boolean;
  width?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <D.Portal>
        {modal && <D.Overlay className="orb-overlay fixed inset-0 z-40 bg-overlay md:bg-overlay/40" />}
        <D.Content
          onInteractOutside={modal ? undefined : (e) => e.preventDefault()}
          // Foco vai para o painel (anunciado pelo título), não para o botão fechar.
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }}
          tabIndex={-1}
          style={width ? ({ "--orb-drawer-w": width } as React.CSSProperties) : undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-surface shadow-3 outline-none",
            // mobile: sheet
            "orb-panel inset-x-0 bottom-0 max-h-[88dvh] rounded-t-lg border-t border-line-subtle",
            // desktop: drawer lateral
            "md:inset-y-0 md:left-auto md:right-0 md:max-h-none md:w-(--orb-drawer-w) md:max-w-[calc(100vw-48px)] md:rounded-none md:border-l md:border-t-0"
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong md:hidden" />
          <header className="flex items-start gap-3 border-b border-line-subtle px-5 pb-3 pt-3 md:pt-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <D.Title className="text-h2 text-fg">{title}</D.Title>
                {status}
              </div>
              {subtitle ? (
                <D.Description asChild>
                  <div className="mt-0.5 text-body-sm text-fg-muted">{subtitle}</div>
                </D.Description>
              ) : (
                <D.Description className="sr-only">Detalhes</D.Description>
              )}
            </div>
            {actions}
            <D.Close className="-mr-1 grid size-8 shrink-0 place-items-center rounded-sm text-fg-muted hover:bg-surface-hover hover:text-fg" aria-label="Fechar painel">
              <X className="size-4" aria-hidden />
            </D.Close>
          </header>
          <div className="orb-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
          {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line-subtle px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</footer>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Confirmação de ação destrutiva/irreversível. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  tone = "default",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  tone?: "default" | "danger";
  children?: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      size="sm"
      footer={
        <>
          <D.Close asChild>
            <button type="button" className="h-8 rounded-sm border border-line bg-surface px-3 text-body font-medium text-fg hover:bg-surface-hover">
              Cancelar
            </button>
          </D.Close>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
            className={cn(
              "h-8 rounded-sm px-3 text-body font-medium",
              tone === "danger" ? "border border-danger-line bg-danger-subtle text-danger-fg hover:border-danger" : "bg-primary text-primary-fg hover:bg-primary-hover"
            )}
          >
            {confirmLabel}
          </button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
