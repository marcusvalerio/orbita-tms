# ÓRBITA 2.0 — Fase 2 · Análise das referências visuais

> Cinco referências enviadas em 01/10/2026, analisadas antes de qualquer código. Nenhuma é copiada: cada uma é lida por **o que resolve para o operador**.
> Restrição permanente: o ÓRBITA só mostra o que o domínio realmente tem. Hoje existem posição, heading, velocidade, progresso, ETA por parada e janelas (simulação), status, prioridade, severidade, transportadora (SLA/OTIF/custo/km/taxa de ocorrência), veículo (tipo, placa, capacidade, status) e motorista (nome, CNH, status). **Não existem** combustível, telefone, fotos, histórico semanal, clima, tráfego nem modelo preditivo.

## Grupos

| Grupo | Referências | Linguagem |
|---|---|---|
| **A · Command Center claro, mapa como tela** | Haulsight (1), Weagle (5) | claro, mapa ocupando o workspace, painéis flutuantes, status como filtro |
| **B · Rastreamento de frota escuro** | TrackWise (2), Fleetly (4) | escuro, lista de veículos + mapa + detalhe do veículo, KPIs com tendência |
| **C · Editorial / hub** | Logivo (3) | foto de capa, cartões grandes, tipografia de marketing |

---

## Grupo A — Haulsight + Weagle

**1. O que funciona**
- **O mapa é a tela**, não um cartão dentro da tela. Os dados flutuam sobre ele em camadas previsíveis: filtros em cima, decisão à direita, previsão embaixo.
- **Status = filtro com contagem** ("On schedule 2.444 · At risk 29 · Critical 8"; "All · Delivered · On the way · Delayed"). Um clique responde "o que está errado agora".
- **"Critical now" ordenado por risco**: cada linha tem ID, lane (origem → destino), cliente e uma pontuação. O primeiro item expande com progresso, risco, exposição, prazo e **duas ações** (revisar / abrir).
- **Prévia no mapa** (popover da #2048): título, risco, ETA, valor, **frase-causa** ("Likely to miss the 4:00 PM delivery window") e explicação curta. Explica *por que* antes de pedir uma ação.
- **Previsão por faixa de horário** (21 janelas em risco nas próximas 6h, matriz hora × severidade). Transforma ETA em carga de trabalho futura.
- Sidebar curta, agrupada por intenção (Operate · Network · Intelligence) com **contadores de atenção** (Exceptions 37).
- Barra de distribuição empilhada (Weagle) mostra a composição da operação numa linha.
- Rodapé da sidebar com **frescor do dado** ("synced 12s ago").

**2. O que adaptar**
- Painéis flutuantes sobre o mapa funcionam em 1440px; em 1280px e abaixo cobrem rotas. ÓRBITA: flutuam em ≥ 1440, **acoplam** às bordas em laptop/tablet, viram **sheet** no mobile.
- Pontuação de risco: o ÓRBITA não tem modelo preditivo. Usaremos um **índice de atenção determinístico e explicável** (atraso projetado vs janela + severidade de ocorrência aberta + prioridade do pedido), calculado na apresentação a partir do motor de simulação, sempre com o motivo em texto. Nada de "IA".
- "Re-route saves $2.400": sem cálculo real não há promessa. A ação recomendada vem das ações que o domínio já tem (Resolver ocorrência, Ver no mapa, Concluir entrega, Iniciar viagem).
- Ícone de "barras de sinal" para risco é ambíguo (parece conectividade). ÓRBITA: número + medidor linear curto + cor/ícone de severidade.
- Botão de ação amarelo: no ÓRBITA, ação é Charcoal; amarelo/âmbar é **estado** (em risco).

**3. O que não copiar**
- "Ask Haulsight", "AI forecast", "AI monitoring live", "AI Actions": marca de IA sem modelo seria desonesto.
- Weather/Traffic como filtros: não temos esses dados.
- Mascote, promoção na sidebar (Weagle), seletor de data com estética de app de consumo.
- Marcadores com ícone de caminhão dentro de um círculo grande + balão de score separado: duplica o objeto e polui o mapa com muitos veículos.
- Cantos de 24–32px na moldura.

**4. Padrões → Design System**
`FilterChip` (ponto + rótulo + contagem, selecionável) · `StatusDistributionBar` · `RiskMeter` (número + barra + severidade) · `MapOverlay` (slot flutuante/acoplado com elevação 2) · `MapPeek` (prévia ancorada no marcador) · `HeatStrip` (matriz hora × severidade) · `LaneLabel` (A → B, mono para códigos) · `NavCount` · `FreshnessIndicator`.

**5. Command Center**
Mapa como canvas; barra de filtros de status com contagens; **"Agora"** (fila por índice de atenção, primeiro item expandido com causa + 2 ações); **"Próximas 6 h"** (janelas em risco por hora, a partir das ETAs simuladas); prévia no mapa → drawer completo.

**6. Planning**
`FilterChip` para a demanda (por CD, prioridade, janela); mapa mostrando pedidos selecionados e a rota proposta; `HeatStrip` de janelas de entrega para ver concentração de horário antes de consolidar.

**7. Routes (mapa e viagem)**
Prévia ancorada no veículo/parada com causa em uma frase; lane + progresso origem → destino com horários nas pontas (saída 23:08 · chegada prevista 02:46); trecho percorrido × restante.

**8. Fleet**
Contadores de atenção (veículos em manutenção, motoristas em folga) no menu; filtro por status com contagem.

**9. Deliveries**
`HeatStrip` "janelas em risco nas próximas horas" como cabeçalho; filtros (A caminho · Na janela · Em risco · Atrasada · Concluída) com contagem; barra de distribuição.

**10. Exceptions**
Fila "Agora" é a referência direta: ordenação por atenção, primeiro item com causa, impacto e ações; prévia ligada ao mapa; contador na navegação.

---

## Grupo B — TrackWise + Fleetly

**1. O que funciona**
- **Três colunas de rastreamento**: lista de veículos (status + velocidade + motorista) → mapa → detalhe do veículo. Seleção na lista acende no mapa.
- Detalhe do veículo com **métricas atômicas** em grade 2×2 (velocidade, distância, ETA) e **progresso da viagem** origem → destino com o veículo posicionado na barra.
- **Atividade recente** como linha do tempo com ícone por tipo de evento e horário à esquerda.
- Contadores de frota por estado (On route · Idle · Maintenance · Offline) como segmentos clicáveis no topo da lista.
- Rótulo do veículo no mapa com ID + velocidade; controles do mapa (zoom, recentrar, camadas) agrupados numa coluna.
- Fleetly: KPI com **comparação** ("96% · ↑6% vs 90% last week").

**2. O que adaptar**
- Tema escuro inteiro: bom para parede de monitoramento, cansativo para 8h de planejamento e mais difícil de manter AA com cores de estado. ÓRBITA fica claro; o padrão de três colunas é mantido.
- Grade 2×2 de métricas: só com dados reais — velocidade, distância restante, próxima parada, ETA, atraso. Combustível sai.
- Botões de ligar/mensagem para o motorista: não há telefone no domínio. Fica o slot no componente, oculto sem dado.
- Comparação nos KPIs: sem histórico, compara com **meta** (OTIF 95%) — nunca "vs semana passada" inventado.
- Legenda do mapa (Route · Traffic · Stops · Geofence) vira legenda de **estados** do ÓRBITA (rota ativa, percorrido, parada pendente/ativa/concluída/atrasada, exceção).

**3. O que não copiar**
- Foto de caminhão em cada linha (ruído, sem informação) e fundo fotográfico.
- Glow, gradientes azuis, glassmorphism, sombras coloridas.
- Gráficos genéricos (combustível por dia, performance semanal) sem decisão associada.
- "Good morning, Daniel 👋", "Upgrade plan", "Top drivers" com ranking por viagens.
- Badge "Live" decorativo: o ÓRBITA mostra "Simulação" ou o horário da última atualização.

**4. Padrões → Design System**
`SegmentedCounter` (estados de frota com contagem) · `EntityRow` (ícone de tipo + ID mono + status + métrica à direita) · `MetricGrid` · `TripProgress` (barra com pontos de parada e veículo) · `ActivityTimeline` · `MapControls` (zoom, recentrar, seguir, legenda) · `VehicleLabel` (ID + km/h no mapa).

**5. Command Center**
Feed de atividade ao vivo (saídas, chegadas, ocorrências, entregas) como `ActivityTimeline` lateral; KPIs com meta; seleção lista ↔ mapa.

**6. Planning**
`TripProgress` vira **pré-visualização da rota planejada** (paradas na barra, distância/duração por perna); `MetricGrid` para capacidade (kg, m³, ocupação %) da carga em formação.

**7. Routes**
`/mapa` reorganizado no padrão lista → mapa → detalhe; `MetricGrid` + `TripProgress` + timeline de paradas no painel; rótulo do veículo com km/h; controles de mapa agrupados com **Seguir veículo**.

**8. Fleet**
Lista operacional de veículos com `SegmentedCounter` (Em viagem · Disponível · Manutenção), placa mono, tipo, capacidade, motorista e viagem atual; detalhe com `MetricGrid` e `ActivityTimeline`. Motoristas no mesmo padrão.

**9. Deliveries**
`ActivityTimeline` como histórico da entrega (saiu, chegou, POD); `EntityRow` para a fila do dia no mobile.

**10. Exceptions**
Ícone por tipo de ocorrência na timeline; atalho para a viagem e o veículo afetados no detalhe.

---

## Grupo C — Logivo

**1. O que funciona**
- **"Live Map" e "Route Simulation" como ações de primeiro nível** do contexto: a simulação não é escondida.
- Agenda do dia com o horário como âncora visual (pílula de hora à esquerda, pessoa e trecho ao lado).
- Contraste forte de hierarquia: título grande, rótulos discretos.

**2. O que adaptar**
- A agenda vira a **fila do dia** de Entregas e a lista de paradas da viagem: horário (mono) à esquerda, destino e cliente, veículo à direita.
- Hierarquia forte, mas em escala de produto (título 20px), não de marketing.

**3. O que não copiar**
- Foto de capa ocupando 40% da tela; cartões de 24px de raio; grade de logos com estrelas; "Approve Contract" como botão gigante; dados de vitrine (área do armazém, "since 2016") sem uso operacional; navegação em pílulas no topo.

**4. Padrões → Design System**
`TimeAnchorRow` (horário + conteúdo + recurso).

**5–10.** Command Center: ação "Simulação" visível no cabeçalho do mapa. Planning: — . Routes: entrada direta "Simular rota" na viagem. Fleet: — . Deliveries: `TimeAnchorRow` na fila do dia. Exceptions: — .

---

## Síntese — princípios de UI/UX do ÓRBITA

Cada princípio é verificável no QA visual.

1. **Mapa é workspace, não widget.** Em Command Center e Mapa o mapa ocupa a área principal; dados entram como camadas (filtros no topo, decisão à direita, horizonte embaixo, controles numa coluna). Nunca um mapa dentro de um cartão com margem.
2. **Todo status é um filtro.** Status aparece como chip com contagem; clicar filtra mapa, listas e tabelas ao mesmo tempo e grava na URL.
3. **Ordenar por atenção, explicar em uma frase.** Filas de exceção são ordenadas por um índice determinístico; cada item diz *por que* ("Parada 3 prevista 01:52, janela até 01:50") antes de qualquer número.
4. **Prévia → painel → página.** Clique no mapa/linha abre uma prévia leve; "Abrir" leva ao drawer com ações; a página completa é para trabalho longo. Nenhuma ação exige a página.
5. **No máximo duas ações visíveis por item**; o resto em menu `⋯` e no ⌘K.
6. **Só dado real, sempre com frescor.** Sem métricas, tendências, telefones ou "IA" inventados. Rodapé/painel mostra "Simulação · atualizado há 2 s" ou a hora do último evento.
7. **Seleção única e compartilhada.** Um objeto selecionado acende em todas as regiões (mapa, lista, timeline, drawer) com a mesma cor de seleção (Tangerine, a cor de marca — nunca de estado).
8. **Dados operacionais em mono, nomes em sans.** `VIA-00004`, `RJT3P27`, `RJ-ZONA-OESTE-042`, `01:52`, `64,3 km` em Geist Mono; pessoas, clientes e locais em Inter.
9. **Densidade por linha, não por cartão.** Listas de entidades usam `EntityRow` (ícone de tipo · ID · contexto · status · métrica à direita) em 40–44px; cartões só para objetos comparáveis (alternativas de plano, cotações).
10. **Horizonte de tempo visível.** Command Center e Entregas mostram o que vai acontecer nas próximas horas (janelas em risco por hora), não só o que já aconteceu.
11. **Calma por padrão, cor só para exceção.** Superfícies neutras e quentes; saturação reservada para estados. Sem gradientes, glow, fotos ou blur decorativo; sombra só em camadas flutuantes.
12. **Raios contidos.** 4–6px em controles, 10px em painéis flutuantes e sheets; nunca 24px.
13. **Movimento só para estado e lugar.** Veículo desliza, rota se desenha ao selecionar, item que entra na fila "Agora" desliza e pisca uma vez, badge que muda de estado faz flash; o resto é instantâneo.
14. **Painéis flutuantes degradam com a tela.** ≥ 1440 flutuam; 1024–1439 acoplam às bordas; < 1024 viram abas/sheets. O mapa nunca fica com menos de 50% da área útil no desktop.

## Ajustes que as referências trazem ao PLAN

| Ponto do plano | Antes | Depois |
|---|---|---|
| Estilo do mapa | escuro "control room" | **claro e dessaturado** (base Platinum, vias brancas, água azul-acinzentada), coerente com o app e com cores de estado validadas em fundo claro. Escuro fica como opção futura para parede de monitoramento |
| Command Center | mapa à esquerda + coluna de exceções + tabela embaixo | **mapa como canvas** com camadas: barra de filtros de status, painel "Agora", faixa "Próximas 6 h", controles e simulação; tabela de execução como aba/painel recolhível. Em < 1440 os painéis acoplam |
| Risco | "fila ordenada por risco" | **índice de atenção determinístico** com motivo em texto, calculado na apresentação (sem mudar domínio) |
| `/mapa` | lista · mapa · painel | mesmo padrão, com `MetricGrid`, `TripProgress`, rótulo do veículo com km/h, controles agrupados e Seguir veículo |
| Fleet | lista + detalhe | `SegmentedCounter` por status + `EntityRow` + detalhe com `MetricGrid`/`ActivityTimeline` |
| Componentes novos | — | FilterChip, StatusDistributionBar, RiskMeter, MapOverlay, MapPeek, HeatStrip, LaneLabel, NavCount, FreshnessIndicator, SegmentedCounter, EntityRow, MetricGrid, TripProgress, ActivityTimeline, MapControls, VehicleLabel, TimeAnchorRow |
