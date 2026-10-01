"use client";

import { useActionState } from "react";
import { signIn } from "../actions";
import { Button, Field, Input } from "@/components/ds";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4 rounded-lg border border-line-subtle bg-surface p-6 shadow-3" aria-describedby={state?.error ? "signin-error" : undefined}>
      <div>
        <h1 className="font-display text-h1 text-fg">Entrar</h1>
        <p className="text-body-sm text-fg-muted">Acesso restrito a pessoas convidadas pela operação.</p>
      </div>
      <Field label="E-mail">
        <Input name="email" type="email" autoComplete="email" required className="h-10" />
      </Field>
      <Field label="Senha">
        <Input name="password" type="password" autoComplete="current-password" required className="h-10" />
      </Field>
      {state?.error && (
        <p id="signin-error" role="alert" className="rounded-sm border border-danger-line bg-danger-subtle px-3 py-2 text-body-sm text-danger-fg">
          {state.error}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" loading={isPending} className="w-full">
        Entrar
      </Button>
    </form>
  );
}
