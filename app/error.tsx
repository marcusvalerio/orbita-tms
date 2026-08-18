"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-milk-mustache px-6 text-center">
      <div>
        <p className="font-display font-semibold text-lg text-cosmic-ink mb-1">
          Não foi possível concluir a ação
        </p>
        <p className="text-sm text-cosmic-ink/60">A operação não foi alterada. Tente novamente.</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-blue-opal text-white text-sm font-medium px-4 py-2 hover:bg-blue-opal/90 transition-colors"
      >
        Tentar novamente
      </button>
    </div>
  );
}
