import "server-only";
import { getIdentityProviderKind } from "../config/runtime";
import { neonIdentityProvider } from "./neon";
import { devIdentityProvider } from "./dev";
import type { IdentityProvider } from "./types";

export function getIdentityProvider(): IdentityProvider {
  return getIdentityProviderKind() === "dev" ? devIdentityProvider : neonIdentityProvider;
}

export type { Identity, IdentityProvider } from "./types";
