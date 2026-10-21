# Fase 1 — Arquitetura

## Visão geral

```
                       ┌──────────────────────── Navegador ────────────────────────┐
                       │  Telas (app/(ops), app/(partner), components/*)           │
                       │        │ useOperation()                                    │
                       │  OperationProvider ─── Modo Demo ──► núcleo de regras      │
                       │        │                            + localStorage         │
                       │        └────────── Modo Produção ──► server action         │
                       │  Mapa: MapProvider / RouteProvider / Geocoding / Tracking  │
                       └────────────────────────────┬──────────────────────────────┘
                                                    │ runOperationCommand(action)
 ┌──────────────────────────────── Servidor (Next.js 16) ────────────────────────────────┐
 │ proxy.ts ─ checagem otimista de sessão                                                 │
 │ lib/server/session.ts ─ Identity (Neon Auth) + memberships → Actor (empresa + papel)   │
 │ lib/application/execute-command.ts                                                     │
 │     autoriza (RBAC) → transação por empresa → núcleo de regras → grava diferença       │
 │     → auditoria → recorte por papel                                                    │
 │ lib/infrastructure/postgres ─ adapter Neon (RLS, papel orbita_app, lock por empresa)   │
 │ app/api/geo/* ─ Google Routes / Geocoding (chave de servidor, cache, limite)           │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

## Camadas

| Camada | Pasta | Depende de | Não pode depender de |
|---|---|---|---|
| Domínio | `lib/domain`, `lib/sim/reducer.ts`, `lib/planning` | nada | React, banco, auth, mapas |
| Autorização | `lib/authz` | tipos de comando | banco, provedor de identidade |
| Aplicação | `lib/application` | domínio, autorização, **portas** | adapters concretos |
| Infraestrutura | `lib/infrastructure/{memory,postgres}` | portas, `pg` | telas |
| Identidade | `lib/auth` | Neon Auth SDK | domínio |
| Geo | `lib/geo` | portas próprias; SDK Google só nos adapters | domínio operacional |
| Composição | `lib/server/*` | tudo acima (único ponto que instancia adapters) | — |
| Interface | `app`, `components` | `useOperation`, portas geo | SQL, SDKs diretamente |

## Decisões

1. **Um único núcleo de regras** (`reduce`) roda no navegador (Demo) e no servidor (Produção). Não existe "regra de demo" e "regra real".
2. **Relógio injetável** (`reduce(state, action, now)`): determinismo em testes e no cenário de demonstração.
3. **`DomainError`**: toda violação de regra tem mensagem para a pessoa; a interface nunca mais afirma sucesso de um comando rejeitado (L1).
4. **Cenário de demonstração como roteiro de comandos** (`lib/sim/generate-atlas.ts`): coerente por construção (L9, L10, L11).
5. **Escrita via um caso de uso** (`executeCommand`): autenticação → autorização → transação → auditoria. Server actions são a única fronteira de escrita.
6. **Persistência incremental**: o adapter lê a operação da empresa, aplica o comando e grava só as linhas alteradas. Adequado ao volume atual; o caminho para repositórios por agregado está nas portas (ver "Limites").
7. **Modo decidido em runtime** (`ORBITA_MODE`), com `connection()` nos layouts: o mesmo build roda Demo ou Produção.

## Modos

| | Demo | Produção |
|---|---|---|
| Dados | navegador (`localStorage`) | Neon PostgreSQL |
| Login | não | Neon Auth |
| Papel | administrador fictício | memberships (RBAC) |
| Cenário/reinício | sim | não |
| Mapa | Google (se houver chave) ou esquemático | idem, APIs geo exigem sessão |
| Depende de banco | **não** | sim |

## Limites conhecidos (aceitos na Fase 1)

- Cada comando lê a operação inteira da empresa (dentro da transação). Para milhares de pedidos ativos, evoluir `OperationStore` para repositórios por agregado — as telas e o domínio não mudam.
- Atualizações de outras pessoas chegam por atualização periódica (30 s) e ao voltar para a aba; tempo real (SSE/WebSocket) fica para uma fase posterior.
- Seleção de empresa quando uma pessoa pertence a várias: usa o cookie `orbita_company` (interface de troca na Fase 4 — App Shell).
