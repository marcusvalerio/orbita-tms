# Fase 1 — Configuração e implantação

## Desenvolvimento local

```bash
npm ci
cp .env.example .env.local        # ORBITA_MODE=demo já funciona sem banco
npm run dev                       # http://localhost:3000
npm run check                     # lint + tipos + testes unitários
```

Modo Produção local (PostgreSQL próprio, sem Neon Auth):

```bash
createdb orbita_dev
DATABASE_URL=postgres://localhost/orbita_dev npm run db:migrate
DATABASE_URL=postgres://localhost/orbita_dev npm run db:seed -- --company atlas --with-demo --admin voce@empresa.com
# .env.local: ORBITA_MODE=production, DATABASE_URL=…, ORBITA_AUTH_PROVIDER=dev,
#             ORBITA_ALLOW_INSECURE_DEV_AUTH=true, ORBITA_DEV_AUTH_SECRET=<32+>, ORBITA_DEV_AUTH_PASSWORD=<senha>
```

## Produção (Vercel + Neon)

| Variável | Valor | Ambiente |
|---|---|---|
| `ORBITA_MODE` | `production` | Production (e Preview, se desejar) |
| `DATABASE_URL` | connection string **pooled** do branch `main` (Neon Console → Connect) | Production |
| `DATABASE_URL_UNPOOLED` | connection string direta (migrations) | Production |
| `NEON_AUTH_BASE_URL` | `https://ep-twilight-morning-b6pvzgs7.neonauth.c-2.sa-east-1.aws.neon.tech/orbita/auth` | Production |
| `NEON_AUTH_COOKIE_SECRET` | `openssl rand -base64 32` (novo, só na Vercel) | Production |
| `GOOGLE_MAPS_BROWSER_KEY` | chave de navegador (Maps JavaScript API) restrita por referrer | Production **e Preview** |
| `GOOGLE_MAPS_MAP_ID` | Map ID vetorial | Production e Preview |
| `GOOGLE_MAPS_SERVER_KEY` | chave de servidor (Routes + Geocoding) | Production e Preview |

Não definir `ORBITA_AUTH_PROVIDER` (padrão `neon`) nem nenhuma variável `ORBITA_DEV_*` em produção.

### Checklist antes de abrir para usuários

- [ ] Neon Auth → **Trusted domains**: adicionar o domínio de produção.
- [ ] Neon Auth → **Email verification** habilitada; provedor de e-mail próprio (SMTP) configurado.
- [ ] Criar as contas das pessoas no Neon Auth com os mesmos e-mails concedidos em `memberships`.
- [ ] Google Cloud: Billing habilitado, duas chaves restritas (ver GOOGLE-MAPS.md), cotas e alertas de orçamento.
- [ ] Neon: branch `main` protegido; política de snapshots.
- [ ] CI verde (`.github/workflows/ci.yml`).
