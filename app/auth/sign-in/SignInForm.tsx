"use client";

import { useActionState } from "react";
import { signIn } from "../actions";

const inputClass =
  "block w-full rounded-md border border-cosmic-ink/20 bg-white px-3 py-2 text-sm text-cosmic-ink focus:outline-none focus:ring-2 focus:ring-blue-opal";

export function SignInForm() {
  const [state, formAction, isPending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="rounded-lg bg-milk-mustache px-6 py-6 shadow-xl space-y-4" aria-describedby={state?.error ? "signin-error" : undefined}>
      <div>
        <h1 className="font-display font-semibold text-xl text-cosmic-ink">Entrar</h1>
        <p className="text-sm text-cosmic-ink/70">Acesso restrito a pessoas convidadas pela operação.</p>
      </div>
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-cosmic-ink">E-mail</label>
        <input id="email" name="email" type="email" autoComplete="email" required className={inputClass} />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-cosmic-ink">Senha</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </div>
      {state?.error && (
        <p id="signin-error" role="alert" className="text-sm text-red-700">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-md bg-cosmic-ink text-milk-mustache text-sm font-medium py-2.5 hover:bg-cosmic-ink/90 disabled:opacity-60 transition-colors"
      >
        {isPending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
