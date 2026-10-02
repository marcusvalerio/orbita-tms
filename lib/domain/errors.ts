/**
 * Erro de regra de negócio. Lançado pelo núcleo de domínio quando um comando
 * não pode ser aplicado ao estado atual; a mensagem é segura para exibir à
 * pessoa usuária. Qualquer outro erro é tratado como falha inesperada.
 */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(err: unknown): err is DomainError {
  return err instanceof DomainError || (err instanceof Error && err.name === "DomainError");
}
