import type { ReactNode } from "react";

/**
 * Cabeçalho de workspace (padrão de página). O breadcrumb vive no App Shell;
 * aqui ficam título, contexto curto e ações da página.
 * `section` é mantido por compatibilidade e não é mais exibido.
 */
export function WorkspaceHeader({
  title,
  meta,
  actions,
  children,
}: {
  section?: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  /** Linha extra (filtros, abas) colada ao cabeçalho. */
  children?: ReactNode;
}) {
  return (
    <div className="shrink-0 border-b border-line-subtle bg-canvas">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 pb-3 pt-4 md:px-6">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-h1 text-fg">{title}</h1>
          {meta && <div className="mt-0.5 text-body-sm text-fg-muted">{meta}</div>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children && <div className="px-4 pb-3 md:px-6">{children}</div>}
    </div>
  );
}
