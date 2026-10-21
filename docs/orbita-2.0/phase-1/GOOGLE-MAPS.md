# Fase 1 — Google Maps Platform

## Arquitetura de provedores

```
Telas ──► MapProvider ──────► GoogleMapProvider (Maps JavaScript API)   │ fallback: SchematicMapProvider (SVG)
     ──► RouteProvider ─────► HttpRouteProvider → /api/geo/route → GoogleRoutesProvider (Routes API)   │ fallback: estimativa
     ──► GeocodingProvider ─► HttpGeocodingProvider → /api/geo/geocode → GoogleGeocodingProvider       │ fallback: cadastro local
     ──► TrackingProvider ──► DemoTrackingProvider (motor de simulação)   │ futuro: GPS próprio / Fleet Engine
```

Contratos em `lib/geo/types.ts`. Nenhuma tela importa o SDK do Google. O Google **não é dependência absoluta**: sem chave, com a chave recusada ou sem rede, o mapa esquemático e as estimativas assumem (com aviso na interface).

## APIs a habilitar

| API | Uso no ÓRBITA | Onde é chamada | Chave |
|---|---|---|---|
| **Maps JavaScript API** | mapa, marcadores (AdvancedMarker), polylines | navegador | `GOOGLE_MAPS_BROWSER_KEY` (navegador) |
| **Routes API** (`computeRoutes`) | geometria, distância e duração com paradas intermediárias (até 25) | servidor | `GOOGLE_MAPS_SERVER_KEY` |
| **Geocoding API** | busca de endereço no mapa | servidor | `GOOGLE_MAPS_SERVER_KEY` |

Map ID: crie um em *Google Cloud Console → Google Maps Platform → Map Management* (tipo JavaScript, vetorial) e informe em `GOOGLE_MAPS_MAP_ID`. Sem ele o código usa `DEMO_MAP_ID`, válido só para testes.

## Diagnóstico: "Mapa esquemático" aparecendo

O selo **Mapa esquemático** só aparece quando o fallback está ativo; o tooltip dele e o console (`[ÓRBITA] …`) dizem o motivo. O elemento do mapa expõe `data-map-provider` (`google` · `schematic` · `fallback` · `loading`).

| Sintoma | Causa | Correção |
|---|---|---|
| Console: *"Sem chave do Maps JavaScript API neste ambiente"*; nenhuma requisição a `maps.googleapis.com`; HTML com `"mapConfig":null` | o servidor não tem `GOOGLE_MAPS_BROWSER_KEY` **neste ambiente** (nome diferente, ou variável só no escopo Production e não em Preview) | criar a variável com esse nome no escopo certo (Production **e** Preview) e **fazer novo deploy** — variáveis só valem para deploys feitos depois |
| Console do Google: `RefererNotAllowedMapError` | o domínio atual não está nos HTTP referrers da chave | incluir o domínio (e o padrão dos previews) na restrição |
| `ApiNotActivatedMapError` | Maps JavaScript API desabilitada no projeto | habilitar a API |
| `ApiTargetBlockedMapError` | a restrição de API da chave não inclui Maps JavaScript API | adicionar a API na restrição da chave de navegador |
| `BillingNotEnabledMapError` | projeto sem faturamento | vincular conta de faturamento |
| `InvalidKeyMapError` | chave errada (ex.: a de servidor no lugar da de navegador) | usar a chave de navegador |

## Chaves e restrições (obrigatório antes de produção)

**Não use uma chave única irrestrita.** Duas chaves, cada uma com restrição de aplicação **e** de API:

| Chave | Restrição de aplicação | Restrição de API | Variável |
|---|---|---|---|
| Navegador | *HTTP referrers*: `https://<seu-domínio>/*`; para previews da Vercel, `https://<projeto>-*-<time>.vercel.app/*` (ou `https://*.vercel.app/*`); `http://localhost:3000/*` apenas na chave de desenvolvimento | somente Maps JavaScript API | `GOOGLE_MAPS_BROWSER_KEY` |
| Servidor | *IP addresses* quando o provedor tiver IP de saída fixo; na Vercel (IPs dinâmicos) use "Nenhuma" **com** restrição de API e cotas | somente Routes API + Geocoding API | `GOOGLE_MAPS_SERVER_KEY` |

Complementos recomendados:
- **Cotas diárias** por API no Console (teto de custo) e **alertas de orçamento** no Billing.
- Chaves distintas para desenvolvimento, homologação e produção.
- A chave de navegador chega ao navegador por natureza; por isso é entregue **em runtime** pelo servidor (não fica no bundle nem no repositório — verificado: 0 ocorrências em `.next/static` e no Git) e depende da restrição por referrer.
- A chave de servidor nunca sai do servidor (`/api/geo/*`), que ainda aplica: sessão obrigatória no Modo Produção, limite de 30 req/min por pessoa/IP, validação (2–27 coordenadas dentro do Brasil) e cache (rotas 1 h, endereços 24 h).
- Sem `GOOGLE_MAPS_SERVER_KEY`, as rotas são **estimadas** e a busca de endereço usa o cadastro local — em qualquer modo. A chave de navegador **nunca** é reaproveitada no servidor, e a de servidor nunca vai ao navegador.
- Nomes antigos (`GOOGLE_MAPS_API_KEY`, `GOOGLE_MAPS_SERVER_API_KEY`) ainda são aceitos como alias; o nome novo tem prioridade.

## Situação da chave de demonstração fornecida (verificada em 30/09/2026)

| API | Resultado |
|---|---|
| Maps JavaScript API | script carrega (HTTP 200) |
| Routes API | **funciona** — rota real CD Rio → Freguesia → Campo Grande: 68,1 km / 1 h 31 (2 pernas) |
| Geocoding API | **REQUEST_DENIED**: *"You must enable Billing on the Google Cloud Project"* |

No navegador deste ambiente de desenvolvimento o mapa do Google não pôde ser validado visualmente: parte dos arquivos do SDK não atravessou o proxy de rede do ambiente e o Google exibiu o aviso "Esta página não carregou o Google Maps corretamente". Esse aviso também é o sintoma de projeto sem faturamento habilitado — mesma causa do erro do Geocoding. **Ação**: habilitar Billing no projeto do Google Cloud e validar em `localhost`/Vercel. Enquanto isso, o ÓRBITA cai automaticamente para o mapa esquemático (também quando o Google recusa a chave depois de carregar — `gm_authFailure`).

> A chave de demonstração foi compartilhada em texto na conversa. Ela está apenas em `.env.local` (ignorado pelo Git). Recomenda-se **restringi-la agora** (referrer `http://localhost:*`) ou revogá-la e gerar as chaves definitivas acima.

## Rastreamento real — próxima etapa (não implementada nesta fase)

A Maps JavaScript API **não** rastreia motoristas. Rastreamento real no Google é o conjunto **Mobility / Fleet Engine**, contratado à parte:

| Peça | Papel | Observação |
|---|---|---|
| **Fleet Engine — Last Mile Fleet Solution (Deliveries API)** | backend com veículos de entrega, tarefas (paradas), status e localização | modelo aderente ao ÓRBITA: `DeliveryVehicle` ≈ viagem/veículo, `Task` ≈ parada/entrega. Requer contrato de Mobility com o Google, projeto dedicado e service accounts com papéis do Fleet Engine (tokens JWT) |
| **Driver SDK** (Android/iOS) | publica localização e progresso do motorista no Fleet Engine | exige app do motorista |
| **Navigation SDK** (Android/iOS) | navegação curva a curva no app do motorista | usado junto com o Driver SDK |
| **Fleet Tracking / Journey Sharing (Maps JS, biblioteca `journeySharing`)** | exibe veículos e tarefas do Fleet Engine no mapa web | substitui o `DemoTrackingProvider` no Mapa Operacional |
| **Fleet Engine real-time events** | eventos de mudança (chegada, atraso) para o backend | alimenta ocorrências e alertas de risco |
| **Route Optimization API** | sequência ótima de paradas com janelas, capacidade e jornada | candidata para a Fase 7 (Planejamento); substitui a heurística do vizinho mais próximo |
| **Roads API** (opcional) | ajusta pontos de GPS próprio à via | se o rastreamento vier de rastreadores veiculares em vez do Driver SDK |

Integração prevista sem reescrever telas: um `FleetEngineTrackingProvider` implementando `TrackingProvider` (mesmo `VehiclePosition`, `source: "fleet-engine"`), alimentado pelo `FleetEngineDeliveryFleetLocationProvider` da biblioteca `journeySharing` ou por eventos do Fleet Engine no servidor.

Fontes: [Fleet Engine](https://developers.google.com/maps/documentation/mobility/fleet-engine) · [Mobility](https://developers.google.com/maps/documentation/mobility) · [Fleet Tracking (Maps JS)](https://developers.google.com/maps/documentation/javascript/reference/journey-sharing-fleet-tracking) · [Fleet Engine real-time events](https://developers.google.com/maps/architecture/fleetevents-overview) · [Route Optimization API](https://developers.google.com/maps/documentation/route-optimization/overview) · [Route Optimization + Fleet Engine](https://developers.google.com/maps/documentation/mobility/services/capabilities/route-optimization-fleet-engine) · [Segurança de chaves](https://developers.google.com/maps/api-security-best-practices) · [Routes API — boas práticas](https://developers.google.com/maps/documentation/routes/web-service-best-practices)
