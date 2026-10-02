# Fase 1 — Autenticação (Neon Auth) e Autorização (RBAC)

## Separação

| Pergunta | Quem responde | Onde |
|---|---|---|
| Quem é a pessoa? | Neon Auth (Managed Better Auth) | `lib/auth` (porta `IdentityProvider`) |
| A qual empresa pertence e com qual papel? | tabela `memberships` | `lib/infrastructure/postgres/membership-store.ts` |
| O que o papel pode fazer? | matriz RBAC | `lib/authz/rbac.ts` |
| A regra de negócio permite? | domínio | `lib/sim/reducer.ts` |

O domínio não conhece papéis; a autorização não conhece o provedor de identidade. Trocar Neon Auth por outro provedor = nova implementação de `IdentityProvider`.

## Fluxo de uma requisição

1. `proxy.ts` — checagem otimista (sem sessão → `/auth/sign-in`; APIs → 401).
2. Layout (`lib/server/operation-context.tsx`) — `resolveSession()`: identidade → memberships → `Actor`. Sem vínculo → `/acesso-pendente`. Parceiro → só `/portal`.
3. Leitura — `readOperation()` devolve apenas o recorte permitido ao papel (`projectForActor`): o parceiro nunca recebe pedidos, frota ou outros parceiros.
4. Escrita — `runOperationCommand()` revalida a sessão **no servidor** a cada chamada; papel, empresa e parceiro vêm do banco, nunca do navegador.

## Papéis e permissões

| Permissão | Admin | Gerente | Planejador | Operador | Conferente | Leitura | Parceiro |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| operation:read | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| orders:create | ✔ | ✔ | ✔ | ✔ | | | |
| planning:consolidate | ✔ | ✔ | ✔ | | | | |
| shipments:contract | ✔ | ✔ | ✔ | | | | |
| shipments:execute | ✔ | ✔ | | ✔ | ✔ | | |
| occurrences:report | ✔ | ✔ | ✔ | ✔ | ✔ | | |
| occurrences:resolve | ✔ | ✔ | | ✔ | | | |
| partners:manage | ✔ | ✔ | | | | | |
| solicitations:create | ✔ | ✔ | | | | | ✔ (só a própria empresa) |
| solicitations:convert | ✔ | ✔ | ✔ | | | | |
| members:manage | ✔ | | | | | | |

A interface esconde ações sem permissão; o servidor as recusa de qualquer forma e registra `denied` em `audit_log`.

## Primeiro acesso

1. Administrador concede o vínculo por e-mail (`npm run db:seed -- --grant email:papel`; tela de gestão de membros na Fase 12/Settings).
2. A pessoa cria a conta no Neon Auth com o mesmo e-mail e entra.
3. No primeiro login o `user_id` do Neon Auth é gravado no vínculo; outra conta com o mesmo e-mail não herda o acesso.

> Cadastro aberto não está exposto na interface: só entra quem foi convidado. Em produção, habilite **verificação de e-mail** no Neon Auth antes de liberar o cadastro (ver checklist em SETUP.md).

## Provedor local (desenvolvimento/E2E)

`ORBITA_AUTH_PROVIDER=dev` usa um cookie HttpOnly assinado (HMAC-SHA256) e senha única de ambiente. Exige `ORBITA_ALLOW_INSECURE_DEV_AUTH=true` e **recusa rodar com `VERCEL_ENV=production`**. A autorização continua sendo a real (memberships + RBAC + RLS). Foi o que permitiu testar o Modo Produção de ponta a ponta neste ambiente, cuja rede bloqueia o Neon Auth.
