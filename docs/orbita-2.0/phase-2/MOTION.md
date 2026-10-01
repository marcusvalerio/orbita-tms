# Órbita Motion System

Movimento explica **mudança de estado ou de lugar**. Nada decorativo: sem bounce exagerado, sem elasticidade, sem parallax. Rápido e discreto.

Implementação 100% nativa da plataforma — CSS transitions/animations, Web Animations API, View Transitions (React `<ViewTransition>` no App Router) e `requestAnimationFrame` para o mapa. Nenhuma biblioteca de animação.

Fontes: tokens em `app/globals.css` (`--orb-duration-*`, `--orb-ease-*`, `--orb-distance-*`, keyframes `orb-*`), espelho em `lib/design/tokens.ts` (`DURATION`, `EASE`, `prefersReducedMotion`) para WAAPI. Paridade CSS ↔ TS testada.

## Tokens

| Token | Valor | Uso |
|---|---|---|
| `--orb-duration-instant` | 80ms | hover, press, troca de cor de linha |
| `--orb-duration-fast` | 140ms | tooltip, menu, filtro, toast (saída), saída de página |
| `--orb-duration-base` | 200ms | drawer, dialog, tabs, expansão, entrada de lista |
| `--orb-duration-slow` | 320ms | sheet, câmera do mapa, progresso, marcador que muda de estado |
| `--orb-duration-status` | 900ms | flash único de mudança de status |
| `--orb-ease-standard` | `cubic-bezier(.2,0,0,1)` | movimentos e mudanças de tamanho |
| `--orb-ease-enter` | `cubic-bezier(0,0,0,1)` | tudo que entra |
| `--orb-ease-exit` | `cubic-bezier(.3,0,1,1)` | tudo que sai (≈30% mais curto que a entrada) |
| `--orb-distance-sm / md / drawer` | 4 / 8 / 24px | deslocamento de entrada |

## Padrões

| Padrão | Como | Onde |
|---|---|---|
| **Enter** | opacidade + 4–8px para cima (`orb-rise-in`, classe `.orb-enter`) | itens de lista, painéis, etapas |
| **Exit** | opacidade (+4px) com `ease-exit`, mais curto | toasts, popovers, saída de página |
| **Overlay** | `orb-pop-in` (0,98 → 1) só em overlays | dialog, Command Menu, popover, menu |
| **Drawer / sheet** | entra 24px da direita (≥768px) ou de baixo (mobile); classes `.orb-panel` | painéis contextuais, "Mais" no mobile |
| **Layout** | `grid-template-rows 0fr → 1fr` (`.orb-collapsible`) | expansão do item "Agora", "Por que este plano?", temperatura no pedido |
| **Navigation** | `<ViewTransition key={pathname}>` — crossfade + rise só do workspace; sidebar/header ficam parados; filtros na URL não animam a página | App Shell |
| **Feedback** | `active:translate-y-px`; spinner em `loading`; foco sem animação | botões |
| **Status change** | `<Status>` detecta valor novo e faz um único anel (`orb-status-flash`) | badges em toda a aplicação |
| **Marker change** | `TimelineDot` cresce e assenta uma vez (`orb-pop-state`) quando o estado muda | paradas concluídas, timeline |
| **Table** | linhas novas entre renders entram com `.orb-enter`; inserção explícita com `.orb-row-new` (realce de marca que desaparece) | DataTable |
| **Queue** | `.orb-stagger` — até 6 itens, 30ms entre eles | fila "Agora" |
| **Toast** | entra com `orb-toast-in`, sai deslizando à direita; região `aria-live` | Toaster |
| **Command Menu** | dialog `orb-pop-in`; altura da lista acompanha o filtro (`[cmdk-list-sizer]` com transição) | ⌘K |
| **Loading / skeleton** | spinner (`orb-spin`), shimmer (`orb-shimmer`), ponto pulsante para "ao vivo" | estados de região |

## Mapa

| Interação | Implementação |
|---|---|
| Movimento do veículo | `TrackingProvider` notifica a cada quadro (rAF do relógio); `MapHandle.moveMarkers` só translada o nó e gira a seta — sem recriar marcadores, sem saltos |
| Heading | interpolado pelo menor arco (`lerpAngle`, fator 0,18 por quadro) |
| Mudança de viewport | esquemático: câmera animada (centro + escala logarítmica, 440ms, ease-out); Google: `fitBounds`/`panTo` nativos |
| Seleção de rota | a rota selecionada "se desenha" uma vez (WAAPI em `stroke-dashoffset`, 640ms) |
| Seleção de veículo | halo em Tangerine + anel pulsante + rótulo com placa e km/h |
| Parada ativa | anel pulsante azul (`.orb-marker-pulse`) |
| Seguir veículo | `panTo` a cada 900ms (o pan é animado) |

## Acessibilidade

`prefers-reduced-motion: reduce` zera deslocamentos (`--orb-distance-* = 0`), encurta durações e desliga pulsos, shimmer, pop e stagger — a informação continua (opacidade e cor). A câmera do mapa e a rota "desenhada" viram instantâneas (`prefersReducedMotion()`).

## Regras

1. Anime só o que mudou. Um eixo de atenção por vez.
2. Entrada lenta o suficiente para ser vista; saída mais rápida.
3. Nunca anime layout pesado (largura de tabela, mapa inteiro) — use opacidade/transform.
4. Movimento contínuo (veículo) fica fora do React; o painel atualiza a ~4 Hz.
5. Se precisar de algo que o nativo não resolve bem (ex.: reordenar paradas com arrastar), avaliar biblioteca específica separadamente.
