"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Slot } from "radix-ui";
import { cn } from "@/lib/ui/cn";
import { Spinner } from "./Feedback";
import { Tooltip } from "./Overlay";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "brand-ghost";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<ButtonVariant, string> = {
  // Ação primária: Charcoal. Nunca usa cor de estado.
  primary: "bg-primary text-primary-fg hover:bg-primary-hover active:bg-primary border border-transparent shadow-1",
  secondary: "bg-surface text-fg border border-line hover:bg-surface-hover hover:border-line-strong active:bg-surface-sunken",
  ghost: "bg-transparent text-fg border border-transparent hover:bg-surface-hover active:bg-surface-sunken",
  // Destrutiva: texto/borda de perigo, nunca sólida (o sólido vermelho é reservado ao estado crítico).
  danger: "bg-surface text-danger-fg border border-danger-line hover:bg-danger-subtle active:bg-danger-subtle",
  "brand-ghost": "bg-transparent text-brand-fg border border-transparent hover:bg-brand-subtle",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 gap-1.5 text-body-sm",
  md: "h-8 px-3 gap-2 text-body",
  lg: "h-10 px-4 gap-2 text-body",
};
const SQUARE: Record<ButtonSize, string> = { sm: "size-7", md: "size-8", lg: "size-10" };

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Estado "selecionado" (toggle). Usa aria-pressed. */
  selected?: boolean;
  icon?: ReactNode;
  trailing?: ReactNode;
  /** Renderiza o filho (ex.: <Link>) com o estilo do botão. */
  asChild?: boolean;
  /** Botão quadrado só com ícone (use IconButton). */
  iconOnly?: boolean;
}

export const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md", extra?: string, iconOnly?: boolean) =>
  cn(
    "relative inline-flex shrink-0 [&_svg]:shrink-0 select-none items-center justify-center whitespace-nowrap rounded-sm font-medium",
    "transition-[background-color,border-color,color,box-shadow,transform] duration-(--orb-duration-instant) ease-standard",
    "active:translate-y-px aria-busy:pointer-events-none aria-busy:cursor-progress disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45",
    "aria-[invalid=true]:border-danger aria-pressed:bg-surface-selected aria-pressed:border-brand aria-pressed:text-fg",
    VARIANT[variant],
    iconOnly ? SQUARE[size] : SIZE[size],
    extra
  );

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading, selected, icon, trailing, asChild, iconOnly, className, children, disabled, type, ...rest },
  ref
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      type={asChild ? undefined : (type ?? "button")}
      className={buttonClass(variant, size, className, iconOnly)}
      disabled={asChild ? undefined : disabled}
      aria-busy={loading || undefined}
      aria-pressed={selected}
      {...rest}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading ? <Spinner size={size === "sm" ? 12 : 14} /> : icon}
          {children}
          {trailing}
        </>
      )}
    </Comp>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "icon" | "trailing" | "children"> {
  /** Nome acessível obrigatório — vira aria-label e tooltip. */
  label: string;
  icon: ReactNode;
  /** Atalho exibido no tooltip. */
  shortcut?: string;
  tooltip?: boolean;
  badge?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, icon, shortcut, tooltip = true, badge, variant = "ghost", size = "md", className, ...rest },
  ref
) {
  const button = (
    <Button ref={ref} variant={variant} size={size} iconOnly aria-label={label} className={className} icon={icon} {...rest}>
      {badge ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 min-w-4 h-4 rounded-full bg-danger px-1 text-caption leading-4 font-semibold text-fg-inverse tabular"
        >
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </Button>
  );
  if (!tooltip) return button;
  return <Tooltip content={shortcut ? `${label} · ${shortcut}` : label}>{button}</Tooltip>;
});
