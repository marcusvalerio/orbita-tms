"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Estado em parâmetro de URL (compartilhável, sobrevive ao recarregar). Use dentro de <Suspense>. */
export function useUrlParam(name: string): [string | null, (value: string | null) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const value = params.get(name);
  const set = useCallback(
    (next: string | null) => {
      const p = new URLSearchParams(window.location.search);
      if (next === null || next === "") p.delete(name);
      else p.set(name, next);
      const qs = p.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [name, pathname, router]
  );
  return [value, set];
}
