// Autenticação: responde apenas "quem é a pessoa". Não sabe de empresas,
// papéis nem do domínio do TMS — isso é autorização (lib/authz).

export interface Identity {
  userId: string;
  email: string;
  name: string;
}

export type SignInResult = { ok: true } | { ok: false; error: string };

export interface IdentityProvider {
  readonly kind: "neon" | "dev";
  getIdentity(): Promise<Identity | null>;
  signInWithPassword(email: string, password: string): Promise<SignInResult>;
  signOut(): Promise<void>;
}
