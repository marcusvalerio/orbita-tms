import type { ReactNode } from "react";

export function WorkspaceHeader({
  section,
  title,
  meta,
  actions,
}: {
  section: string;
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 bg-milk-mustache/95 backdrop-blur border-b border-cosmic-ink/10 px-6 md:px-10 py-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-cosmic-ink/45 mb-0.5">
          {section}
        </p>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="font-display font-semibold text-xl text-cosmic-ink">{title}</h1>
          {meta && <div className="text-sm text-cosmic-ink/55">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </header>
  );
}
