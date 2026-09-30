# ÓRBITA TMS

Sistema de Gestão de Transporte (TMS): pedidos, planejamento e consolidação, contratação de frete, viagens com rotas multi-parada, ocorrências, entregas, Portal do Parceiro e Mapa Operacional com simulação.

## Modos

| Modo | Para quê | Requisitos |
|---|---|---|
| **Demo** (padrão) | explorar o produto; operação no navegador, com cenário de demonstração | nenhum |
| **Produção** | operação real, multiempresa | Neon PostgreSQL, Neon Auth |

## Começando

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Abra <http://localhost:3000> e use **Carregar Cenário de Demonstração**. Para o mapa real, defina `GOOGLE_MAPS_API_KEY`; sem ela, o Mapa Operacional usa um mapa esquemático.

## Scripts

| Script | O que faz |
|---|---|
| `npm run check` | lint + tipos + testes unitários |
| `npm run test:integration` | testes contra PostgreSQL (`TEST_DATABASE_URL`) |
| `npm run test:e2e` | Playwright (Demo; + Produção com `E2E_DATABASE_URL`) — requer `npm run build` |
| `npm run db:migrate` / `npm run db:seed` | banco do Modo Produção |

## Documentação

- [Auditoria ÓRBITA 2.0](docs/orbita-2.0/AUDIT-REPORT.md)
- [Fase 1 — relatório](docs/orbita-2.0/phase-1/README.md) · [Arquitetura](docs/orbita-2.0/phase-1/ARCHITECTURE.md) · [Banco](docs/orbita-2.0/phase-1/DATABASE.md) · [Auth e RBAC](docs/orbita-2.0/phase-1/AUTH-RBAC.md) · [Google Maps](docs/orbita-2.0/phase-1/GOOGLE-MAPS.md) · [Implantação](docs/orbita-2.0/phase-1/SETUP.md)

Stack: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PostgreSQL (Neon), Neon Auth, Google Maps Platform.
