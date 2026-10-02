"use client";

import {
  createContext,
  forwardRef,
  useContext,
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { ChevronDown, Search as SearchIcon, X, Check, ChevronsUpDown } from "lucide-react";
import { ToggleGroup, Tabs as RTabs } from "radix-ui";
import { Command } from "cmdk";
import { cn } from "@/lib/ui/cn";
import { Popover } from "./Overlay";

/* ---------------------------------------------------------------- Field
   Liga rótulo, dica e erro ao controle (htmlFor, aria-describedby, aria-invalid). */

interface FieldCtx {
  id: string;
  describedBy?: string;
  invalid: boolean;
}
const FieldContext = createContext<FieldCtx | null>(null);

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  labelHidden,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  className?: string;
  labelHidden?: boolean;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: !!error }}>
      <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
        <label htmlFor={id} className={cn("text-label text-fg-muted", labelHidden && "sr-only")}>
          {label}
          {required && (
            <span className="text-danger-fg" aria-hidden>
              {" "}
              *
            </span>
          )}
        </label>
        {children}
        {error ? (
          <p id={errorId} className="flex items-center gap-1 text-caption text-danger-fg animate-orb-fade-in">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-caption text-fg-subtle">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

function useFieldProps(props: { id?: string; "aria-describedby"?: string; "aria-invalid"?: React.AriaAttributes["aria-invalid"] }) {
  const ctx = useContext(FieldContext);
  if (!ctx) return props;
  return {
    id: props.id ?? ctx.id,
    "aria-describedby": props["aria-describedby"] ?? ctx.describedBy,
    "aria-invalid": props["aria-invalid"] ?? (ctx.invalid || undefined),
  };
}

export const controlClass = cn(
  "h-8 w-full min-w-0 rounded-sm border border-line bg-surface px-2.5 text-body text-fg",
  "placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-(--orb-duration-instant)",
  "hover:border-line-strong focus-visible:outline-none focus-visible:border-fg focus-visible:shadow-[0_0_0_1px_var(--orb-fg)]",
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:text-fg-disabled",
  "aria-invalid:border-danger aria-invalid:focus-visible:shadow-[0_0_0_1px_var(--orb-danger)]"
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  const field = useFieldProps(props);
  return <input ref={ref} {...props} {...field} className={cn(controlClass, className)} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  const field = useFieldProps(props);
  return <textarea ref={ref} rows={3} {...props} {...field} className={cn(controlClass, "h-auto min-h-16 py-1.5", className)} />;
});

/** Select nativo estilizado: acessível, rápido de teclar e ótimo no mobile. */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  const field = useFieldProps(props);
  return (
    <span className="relative block min-w-0">
      <select ref={ref} {...props} {...field} className={cn(controlClass, "appearance-none pr-8", className)}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 top-1/2 size-4 -translate-y-1/2 text-fg-muted" />
    </span>
  );
});

/** Data/hora nativos (teclado e mobile prontos), com aparência do sistema. */
export const DateInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { kind?: "date" | "time" | "datetime-local" }>(
  function DateInput({ kind = "date", className, ...props }, ref) {
    const field = useFieldProps(props);
    return <input ref={ref} type={kind} lang="pt-BR" {...props} {...field} className={cn(controlClass, "orb-data tabular", className)} />;
  }
);

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar",
  label,
  className,
  shortcut,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
  shortcut?: string;
  autoFocus?: boolean;
}) {
  return (
    <div role="search" className={cn("relative min-w-0", className)}>
      <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
      <input
        type="search"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.stopPropagation();
            onChange("");
          }
        }}
        placeholder={placeholder}
        className={cn(controlClass, "pl-8 pr-8 [&::-webkit-search-cancel-button]:hidden")}
      />
      {value ? (
        <button type="button" aria-label="Limpar busca" onClick={() => onChange("")} className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-xs text-fg-muted hover:bg-surface-hover">
          <X className="size-3.5" aria-hidden />
        </button>
      ) : shortcut ? (
        <kbd aria-hidden className="orb-data absolute right-2 top-1/2 -translate-y-1/2 rounded-xs border border-line px-1 text-caption text-fg-subtle">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Combobox
   Busca + seleção em listas longas (clientes, locais, veículos). */

export interface ComboOption {
  value: string;
  label: string;
  hint?: string;
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  emptyText = "Nada encontrado.",
  label,
  invalid,
}: {
  value: string | null;
  onChange: (v: string) => void;
  options: ComboOption[];
  placeholder?: string;
  emptyText?: string;
  label: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ctx = useContext(FieldContext);
  const current = options.find((o) => o.value === value);
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align="start"
      label={label}
      className="w-(--radix-popover-trigger-width) min-w-56 p-0"
      trigger={
        <button
          type="button"
          id={ctx?.id}
          aria-label={ctx ? undefined : label}
          aria-describedby={ctx?.describedBy}
          data-invalid={invalid || ctx?.invalid || undefined}
          className={cn(controlClass, "flex items-center justify-between gap-2 text-left data-invalid:border-danger")}
        >
          <span className={cn("truncate", !current && "text-fg-subtle")}>{current?.label ?? placeholder}</span>
          <ChevronsUpDown aria-hidden className="size-4 shrink-0 text-fg-muted" />
        </button>
      }
    >
      <Command label={label} className="flex max-h-72 flex-col">
        <div className="flex items-center gap-2 border-b border-line-subtle px-2.5">
          <SearchIcon aria-hidden className="size-4 text-fg-subtle" />
          <Command.Input placeholder="Buscar…" className="h-9 flex-1 bg-transparent text-body outline-none placeholder:text-fg-subtle focus-visible:outline-none" />
        </div>
        <Command.List className="orb-scroll overflow-y-auto p-1">
          <Command.Empty className="px-2 py-3 text-body-sm text-fg-muted">{emptyText}</Command.Empty>
          {options.map((o) => (
            <Command.Item
              key={o.value}
              value={`${o.label} ${o.hint ?? ""} ${o.value}`}
              onSelect={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-body-sm text-fg data-[selected=true]:bg-surface-hover"
            >
              <Check aria-hidden className={cn("size-4", o.value === value ? "text-fg" : "text-transparent")} />
              <span className="flex-1 truncate">{o.label}</span>
              {o.hint && <span className="truncate text-caption text-fg-subtle">{o.hint}</span>}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </Popover>
  );
}

/* ---------------------------------------------------------------- SegmentedControl */

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("inline-flex rounded-sm border border-line bg-surface-sunken p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className={cn(
            "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xs px-2.5 font-medium text-fg-muted",
            "transition-[background-color,color,box-shadow] duration-(--orb-duration-fast) ease-standard hover:text-fg",
            "data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-1",
            size === "sm" ? "h-6 text-caption" : "h-7 text-body-sm"
          )}
        >
          {o.label}
          {o.count !== undefined && <span className="tabular text-fg-subtle">{o.count}</span>}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/* ---------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  tabs,
  label,
  children,
  className,
  listClassName,
}: {
  value: T;
  onChange: (v: T) => void;
  tabs: { value: T; label: ReactNode; count?: number; attention?: boolean }[];
  label: string;
  children?: ReactNode;
  className?: string;
  listClassName?: string;
}) {
  return (
    <RTabs.Root value={value} onValueChange={(v) => onChange(v as T)} className={className}>
      <RTabs.List aria-label={label} className={cn("orb-scroll flex gap-4 overflow-x-auto border-b border-line-subtle", listClassName)}>
        {tabs.map((t) => (
          <RTabs.Trigger
            key={t.value}
            value={t.value}
            // Sem painéis (abas como navegação de visões): não aponta para conteúdo inexistente.
            {...(children ? {} : { "aria-controls": undefined })}
            className={cn(
              "relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 border-transparent text-body-sm font-medium text-fg-muted",
              "transition-colors duration-(--orb-duration-fast) hover:text-fg data-[state=active]:border-brand data-[state=active]:text-fg"
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn("tabular rounded-xs px-1 text-caption", t.attention ? "bg-danger-subtle text-danger-fg" : "bg-surface-sunken text-fg-muted")}>{t.count}</span>
            )}
          </RTabs.Trigger>
        ))}
      </RTabs.List>
      {children}
    </RTabs.Root>
  );
}
export const TabPanel = RTabs.Content;

/* ---------------------------------------------------------------- Checkbox simples (nativo) */

export function Checkbox({ checked, onChange, label, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; label: string; indeterminate?: boolean }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(el) => {
        if (el) el.indeterminate = !!indeterminate;
      }}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className="size-4 cursor-pointer rounded-xs border-line accent-(--orb-fg)"
    />
  );
}
