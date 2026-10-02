"use client";

import { useState, type ReactNode } from "react";
import { Bell, Map as MapIcon, Plus, Route, Search, Truck, Ellipsis, Play, Package } from "lucide-react";
import {
  Button,
  IconButton,
  TooltipProvider,
  Menu,
  Dialog,
  Drawer,
  ConfirmDialog,
  Popover,
  Field,
  Input,
  Textarea,
  Select,
  DateInput,
  SearchInput,
  Combobox,
  SegmentedControl,
  Tabs,
  Status,
  StatusDot,
  FilterBar,
  KeyValue,
  MetricGrid,
  Kpi,
  Progress,
  TripProgress,
  Timeline,
  AttentionMeter,
  DistributionBar,
  HeatStrip,
  EntityRow,
  DataTable,
  SectionHeader,
  Kbd,
  Skeleton,
  SkeletonRows,
  EmptyState,
  ErrorState,
  LoadingState,
  Toaster,
  Spinner,
  type ToastItem,
} from "@/components/ds";
import { STATUS, type StatusEntity } from "@/lib/ui/status";

// Catálogo vivo do Órbita DS 2.0 — alvo do QA visual e da regressão por screenshot.
// Fora da navegação; acessível em /design-system.

const ROWS = [
  { id: "VIA-00004", route: "RJ-ZONA-OESTE-042", vehicle: "RJT3P27", status: "In Transit", eta: "01:52", progress: 0.42 },
  { id: "VIA-00005", route: "SP-ZONA-OESTE-017", vehicle: "RJK1D52", status: "Exception", eta: "00:52", progress: 0.3 },
  { id: "VIA-00006", route: "BH-CENTRO-SUL-008", vehicle: "RJO4A21", status: "In Transit", eta: "02:10", progress: 0.65 },
  { id: "VIA-00007", route: "RJ-NITEROI-007", vehicle: "—", status: "Planned", eta: "03:19", progress: 0 },
];

export default function DesignSystemPage() {
  const [seg, setSeg] = useState<"b2b" | "b2c" | "outro">("b2b");
  const [tab, setTab] = useState<"todos" | "rota" | "risco">("todos");
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [combo, setCombo] = useState<string | null>(null);
  const [dialog, setDialog] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [statusIdx, setStatusIdx] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>("VIA-00005");
  const cycle = ["Planned", "In Transit", "At Delivery", "Delivered"];

  const toast = (tone: ToastItem["tone"], message: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, tone, message, action: tone === "success" ? { label: "Ver", onClick: () => {} } : undefined }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3500);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3700);
  };

  return (
    <TooltipProvider>
      <main id="conteudo" className="mx-auto max-w-6xl space-y-12 px-6 py-10">
        <header>
          <p className="text-label text-brand-fg">ÓRBITA DESIGN SYSTEM 2.0</p>
          <h1 className="mt-1 font-display text-display text-fg">Catálogo de componentes</h1>
          <p className="mt-1 max-w-2xl text-body text-fg-muted">
            Tokens → primitives → componentes → padrões. Todo status é ícone + texto + cor; ação (Charcoal) nunca usa cor de estado.
          </p>
        </header>

        <Section title="Cor semântica">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {[
              ["primary", "bg-primary", "Ação"],
              ["brand", "bg-brand", "Marca · seleção"],
              ["info", "bg-info", "Em rota"],
              ["success", "bg-success", "Concluído"],
              ["warning", "bg-warning", "Em risco"],
              ["danger", "bg-danger", "Atraso · falha"],
              ["critical", "bg-critical", "Crítico"],
              ["exception", "bg-exception", "Ocorrência"],
              ["route", "bg-route", "Rota"],
              ["delivery", "bg-delivery", "Entrega"],
              ["vehicle", "bg-vehicle", "Veículo"],
              ["neutral", "bg-neutral", "Neutro"],
            ].map(([name, cls, use]) => (
              <div key={name} className="overflow-hidden rounded-md border border-line-subtle bg-surface">
                <div className={`h-10 ${cls}`} />
                <div className="px-2.5 py-2">
                  <p className="orb-data text-body-sm text-fg">{name}</p>
                  <p className="text-caption text-fg-muted">{use}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Tipografia">
          <div className="space-y-2 rounded-md border border-line-subtle bg-surface p-5">
            <p className="font-display text-display">128 entregas hoje</p>
            <p className="font-display text-h1">Command Center</p>
            <p className="text-h2">Agora · atenção</p>
            <p className="text-h3">Paradas da rota</p>
            <p className="text-body">Body — texto padrão da interface, 14/20.</p>
            <p className="text-body-sm text-fg-muted">Body small — células de tabela e meta, 13/18.</p>
            <p className="text-label text-fg-muted">Label — rótulos de campo e cabeçalhos</p>
            <p className="text-caption text-fg-subtle">Caption — texto auxiliar, mínimo de 12px</p>
            <p className="orb-data text-body">VIA-00004 · RJ-ZONA-OESTE-042 · RJT3P27 · ETA 01:52 · 64,3 km · 38 km/h</p>
          </div>
        </Section>

        <Section title="Botões">
          <Row label="Variantes">
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />}>
              Novo pedido
            </Button>
            <Button>Secundário</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Cancelar viagem</Button>
            <Button variant="brand-ghost">Ver no mapa</Button>
          </Row>
          <Row label="Estados">
            <Button variant="primary" loading>
              Salvando
            </Button>
            <Button disabled>Desabilitado</Button>
            <Button selected>Selecionado</Button>
            <Button aria-invalid="true">Com erro</Button>
          </Row>
          <Row label="Tamanhos · ícones">
            <Button size="sm">Pequeno</Button>
            <Button size="md">Médio</Button>
            <Button size="lg" variant="primary">
              Grande
            </Button>
            <IconButton label="Buscar" shortcut="⌘K" icon={<Search className="size-4" />} />
            <IconButton label="Notificações" badge={3} icon={<Bell className="size-4" />} />
            <IconButton label="Mais ações" variant="secondary" icon={<Ellipsis className="size-4" />} />
            <IconButton label="Iniciar simulação" variant="primary" icon={<Play className="size-4" />} />
          </Row>
        </Section>

        <Section title="Status — ícone + texto + cor">
          {(["shipment", "order", "load", "delivery", "severity", "stop", "vehicle", "attention"] as StatusEntity[]).map((entity) => (
            <Row key={entity} label={entity}>
              {Object.keys(STATUS[entity]).map((v) => (
                <Status key={v} entity={entity} value={v} />
              ))}
            </Row>
          ))}
          <Row label="Inline · ponto">
            <Status entity="shipment" value="In Transit" variant="inline" />
            <Status entity="delivery" value="Late" variant="inline" />
            <Status entity="severity" value="Crítica" variant="inline" />
            <StatusDot tone="info" label="Em rota" pulse />
            <StatusDot tone="danger" label="Atrasada" />
          </Row>
          <Row label="Mudança de status (flash)">
            <Status entity="shipment" value={cycle[statusIdx % cycle.length]} />
            <Button size="sm" onClick={() => setStatusIdx((i) => i + 1)}>
              Avançar status
            </Button>
          </Row>
        </Section>

        <Section title="Filtros com contagem">
          <FilterBar
            label="Situação"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Todas", count: 128, tone: "all" },
              { value: "rota", label: "Em rota", count: 42, tone: "info" },
              { value: "prazo", label: "No prazo", count: 91, tone: "success" },
              { value: "risco", label: "Em risco", count: 7, tone: "warning" },
              { value: "ocorr", label: "Com ocorrência", count: 4, tone: "exception" },
            ]}
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <SegmentedControl label="Tipo de operação" value={seg} onChange={setSeg} options={[{ value: "b2b", label: "B2B" }, { value: "b2c", label: "B2C" }, { value: "outro", label: "Outro" }]} />
            <Tabs
              label="Viagens"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: "todos", label: "Todas", count: 7 },
                { value: "rota", label: "Em rota", count: 3 },
                { value: "risco", label: "Em risco", count: 2, attention: true },
              ]}
            />
          </div>
        </Section>

        <Section title="Formulários">
          <div className="grid gap-4 rounded-md border border-line-subtle bg-surface p-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Responsável" hint="Quem pediu o transporte.">
              <Input placeholder="Nome" />
            </Field>
            <Field label="Peso (kg)" required error="Informe um peso maior que zero.">
              <Input inputMode="decimal" defaultValue="0" />
            </Field>
            <Field label="Prioridade">
              <Select defaultValue="Normal">
                <option>Normal</option>
                <option>Alta</option>
                <option>Urgente</option>
              </Select>
            </Field>
            <Field label="Cliente">
              <Combobox
                label="Cliente"
                value={combo}
                onChange={setCombo}
                placeholder="Buscar cliente"
                options={[
                  { value: "c1", label: "Mercado Bom Preço", hint: "Rio de Janeiro" },
                  { value: "c2", label: "Farmavida", hint: "São Paulo" },
                  { value: "c3", label: "Atlas Home", hint: "Belo Horizonte" },
                ]}
              />
            </Field>
            <Field label="Data prevista">
              <DateInput defaultValue="2026-10-01" />
            </Field>
            <Field label="Desabilitado">
              <Input disabled value="Bloqueado pela regra" readOnly />
            </Field>
            <Field label="Observações" className="sm:col-span-2">
              <Textarea placeholder="Opcional" />
            </Field>
            <Field label="Busca" labelHidden>
              <SearchInput label="Buscar viagem" value={q} onChange={setQ} placeholder="Viagem, rota ou placa" shortcut="/" />
            </Field>
          </div>
        </Section>

        <Section title="Overlays">
          <Row label="Dialog · Drawer · Confirmação · Menu · Popover · Toast">
            <Button onClick={() => setDialog(true)}>Abrir dialog</Button>
            <Button onClick={() => setDrawer(true)}>Abrir drawer</Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              Ação destrutiva
            </Button>
            <Menu
              label="Ações da viagem"
              trigger={<Button trailing={<Ellipsis className="size-4" aria-hidden />}>Menu</Button>}
              items={[
                { label: "Ver no mapa", icon: <MapIcon />, onSelect: () => {} },
                { label: "Registrar ocorrência", icon: <Route />, onSelect: () => {}, shortcut: "O" },
                "separator",
                { label: "Cancelar", tone: "danger", onSelect: () => {} },
              ]}
            />
            <Popover label="Exemplo" trigger={<Button>Popover</Button>}>
              <div className="w-64 p-3 text-body-sm text-fg-muted">Conteúdo contextual curto, ancorado no gatilho.</div>
            </Popover>
            <Button onClick={() => toast("success", "Viagem VIA-00004 iniciada.")}>Toast sucesso</Button>
            <Button onClick={() => toast("error", "Domínio recusou: a viagem já foi concluída.")}>Toast erro</Button>
          </Row>
        </Section>

        <Section title="Dados">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4 rounded-md border border-line-subtle bg-surface p-4">
              <MetricGrid
                items={[
                  { label: "Velocidade", value: "38 km/h", mono: true },
                  { label: "Restante", value: "28,4 km", mono: true },
                  { label: "ETA final", value: "02:46", mono: true },
                  { label: "Atraso projetado", value: "+18 min", tone: "danger", mono: true },
                ]}
              />
              <TripProgress
                progress={0.42}
                startLabel="CD Rio de Janeiro"
                startTime="23:08"
                endLabel="Campo Grande"
                endTime="02:46"
                stops={[
                  { at: 0.18, state: "done", title: "Taquara" },
                  { at: 0.36, state: "done", title: "Freguesia" },
                  { at: 0.55, state: "active", title: "Barra" },
                  { at: 0.74, state: "late", title: "Recreio" },
                  { at: 1, state: "pending", title: "Campo Grande" },
                ]}
              />
              <Progress value={0.68} label="Ocupação" />
              <DistributionBar
                label="Viagens"
                segments={[
                  { label: "No prazo", value: 14, tone: "success" },
                  { label: "Em risco", value: 2, tone: "warning" },
                  { label: "Atrasadas", value: 1, tone: "danger" },
                  { label: "Com ocorrência", value: 1, tone: "exception" },
                ]}
              />
              <HeatStrip
                label="Janelas nas próximas 6 h"
                buckets={[
                  { hour: "00h", late: 0, risk: 1, ok: 3 },
                  { hour: "01h", late: 1, risk: 1, ok: 4 },
                  { hour: "02h", late: 0, risk: 0, ok: 2 },
                  { hour: "03h", late: 0, risk: 0, ok: 1 },
                  { hour: "04h", late: 0, risk: 0, ok: 0 },
                  { hour: "05h", late: 0, risk: 0, ok: 0 },
                ]}
              />
              <div className="flex flex-wrap items-center gap-6">
                <Kpi label="OTIF" value={94} suffix="%" target="Meta 95%" tone="warning" definition="Entregas no prazo e completas ÷ entregas concluídas" />
                <Kpi label="Custo por entrega" value={null} />
                <AttentionMeter score={82} level="alta" />
                <dl>
                  <KeyValue label="Placa" value="RJT3P27" mono />
                </dl>
                <Kbd>⌘K</Kbd>
              </div>
            </div>
            <div className="rounded-md border border-line-subtle bg-surface p-4">
              <Timeline
                label="Paradas"
                items={[
                  { id: "0", marker: "CD", title: "CD Rio de Janeiro", meta: "Saída", state: "done", time: "23:08" },
                  { id: "1", marker: "1", title: "Taquara", meta: "Concluída · janela 00:00–02:40", state: "done", time: "23:41" },
                  { id: "2", marker: "2", title: "Freguesia", meta: "Próxima · janela 00:30–03:10", state: "active", time: "ETA 00:13" },
                  { id: "3", marker: "3", title: "Recreio", meta: "ETA excede a janela em 18 min", state: "late", aside: <Status entity="stop" value="Atrasada" size="sm" /> },
                  { id: "4", marker: "4", title: "Campo Grande", meta: "Pendente", state: "pending", time: "ETA 02:46" },
                ]}
              />
            </div>
          </div>
          <div className="mt-6 overflow-hidden rounded-md border border-line-subtle bg-surface">
            <EntityRow icon={<Truck />} id="ORBT-014" title="Carlos Mendes" meta="Van · RJT3P27 · RJ-ZONA-OESTE-042" status={<Status entity="vehicle" value="Em Viagem" size="sm" />} aside="38 km/h" onClick={() => {}} selected />
            <EntityRow icon={<Package />} id="PED-00021" title="Mercado Bom Preço" meta="Rio de Janeiro → Vitória · 1.600 kg" status={<Status entity="order" value="Aguardando planejamento" size="sm" />} onClick={() => {}} />
          </div>
          <div className="mt-6 overflow-hidden rounded-md border border-line-subtle bg-surface">
            <DataTable
              label="Viagens (exemplo)"
              rows={ROWS}
              rowKey={(r) => r.id}
              activeKey={active}
              onRowClick={(r) => setActive(r.id)}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              defaultSort={{ id: "eta", dir: "asc" }}
              rowActions={() => <IconButton size="sm" label="Mais ações" icon={<Ellipsis className="size-4" />} />}
              card={(r) => (
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="orb-data text-body-sm text-fg">{r.route}</p>
                    <p className="text-caption text-fg-muted">{r.id} · ETA {r.eta}</p>
                  </div>
                  <Status entity="shipment" value={r.status} size="sm" />
                </div>
              )}
              columns={[
                { id: "route", header: "Rota", cell: (r) => r.route, sortValue: (r) => r.route, mono: true },
                { id: "id", header: "Viagem", cell: (r) => r.id, mono: true, hideBelow: "lg" },
                { id: "vehicle", header: "Placa", cell: (r) => r.vehicle, mono: true },
                { id: "progress", header: "Progresso", cell: (r) => <Progress value={r.progress} label={`Progresso ${r.id}`} className="w-24" />, sortValue: (r) => r.progress },
                { id: "eta", header: "ETA", cell: (r) => r.eta, sortValue: (r) => r.eta, mono: true, align: "right" },
                { id: "status", header: "Situação", cell: (r) => <Status entity="shipment" value={r.status} size="sm" /> },
              ]}
            />
          </div>
        </Section>

        <Section title="Estados de região">
          <div className="grid gap-4 md:grid-cols-2">
            <Box>
              <EmptyState icon={<Route />} title="Nenhuma rota em execução." description="As rotas aparecem aqui quando uma carga é contratada." action={<Button variant="primary">Ir para o planejamento</Button>} />
            </Box>
            <Box>
              <ErrorState description="O provedor de rotas não respondeu. A estimativa local continua disponível." action={<Button>Tentar de novo</Button>} />
            </Box>
            <Box>
              <LoadingState label="Calculando rota…" />
            </Box>
            <Box>
              <SkeletonRows rows={3} />
              <div className="flex items-center gap-3 p-4">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="w-40" />
                <Spinner label="Carregando" />
              </div>
            </Box>
          </div>
        </Section>
      </main>

      <Dialog
        open={dialog}
        onOpenChange={setDialog}
        title="Novo pedido"
        description="Coleta, entrega e itens."
        footer={
          <>
            <Button onClick={() => setDialog(false)}>Cancelar</Button>
            <Button variant="primary">Criar pedido</Button>
          </>
        }
      >
        <Field label="Cliente">
          <Input autoFocus />
        </Field>
      </Dialog>
      <Drawer
        open={drawer}
        onOpenChange={setDrawer}
        title={<span className="orb-data">RJ-ZONA-OESTE-042</span>}
        subtitle="VIA-00004 · CD Rio de Janeiro → Campo Grande"
        status={<Status entity="shipment" value="In Transit" size="sm" />}
        footer={
          <>
            <Button variant="primary">Ver rota</Button>
            <Button>Registrar ocorrência</Button>
          </>
        }
      >
        <div className="p-5 text-body-sm text-fg-muted">Conteúdo do painel contextual.</div>
      </Drawer>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Reiniciar a operação?" description="Todos os dados do Modo Demo serão apagados." confirmLabel="Reiniciar" tone="danger" onConfirm={() => toast("success", "Operação reiniciada.")} />
      <Toaster toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </TooltipProvider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeader title={title} className="mb-3 border-b border-line-subtle pb-2" />
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center">
      <span className="orb-data w-40 shrink-0 text-caption text-fg-subtle">{label}</span>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-md border border-line-subtle bg-surface">{children}</div>;
}
