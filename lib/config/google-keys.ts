// Resolução das chaves do Google Maps Platform a partir do ambiente.
// Duas chaves, papéis separados:
//
//   GOOGLE_MAPS_BROWSER_KEY  Maps JavaScript API no navegador; restrita por HTTP referrer.
//   GOOGLE_MAPS_SERVER_KEY   Routes API / Geocoding no servidor; nunca enviada ao navegador.
//
// Os nomes antigos (GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_SERVER_API_KEY) continuam
// aceitos como alias para não quebrar ambientes já configurados. Uma chave
// nunca substitui a outra.

export const BROWSER_KEY_VARS = ["GOOGLE_MAPS_BROWSER_KEY", "GOOGLE_MAPS_API_KEY"] as const;
export const SERVER_KEY_VARS = ["GOOGLE_MAPS_SERVER_KEY", "GOOGLE_MAPS_SERVER_API_KEY"] as const;

export interface ResolvedKey {
  value: string;
  /** Variável de onde a chave veio (para diagnóstico; nunca o valor). */
  variable: string;
}

type Env = Record<string, string | undefined>;

export function resolveKey(env: Env, names: readonly string[]): ResolvedKey | null {
  for (const variable of names) {
    const value = env[variable]?.trim();
    if (value) return { value, variable };
  }
  return null;
}

export const resolveBrowserKey = (env: Env) => resolveKey(env, BROWSER_KEY_VARS);
export const resolveServerKey = (env: Env) => resolveKey(env, SERVER_KEY_VARS);
