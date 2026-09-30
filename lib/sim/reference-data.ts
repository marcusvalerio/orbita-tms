import { pickMany, intBetween, floatBetween } from "./rng";
import type { Company, Location, Customer, Product, Vehicle, Driver, Carrier } from "../domain/types";

// Cadastros da operação de referência (Atlas Distribuição, Sudeste).
// Representam infraestrutura — não movimentação — e por isso existem tanto na
// operação vazia quanto no cenário de demonstração. Coordenadas reais de
// bairros e cidades; empresas e pessoas são fictícias.

const CDS = [
  { name: "CD Rio de Janeiro", city: "Rio de Janeiro", state: "RJ", lat: -22.8105, lng: -43.362, address: "Av. Pastor Martin Luther King Jr. — Pavuna" },
  { name: "CD São Paulo", city: "São Paulo", state: "SP", lat: -23.529, lng: -46.734, address: "Av. Gastão Vidigal — Vila Leopoldina" },
  { name: "CD Belo Horizonte", city: "Contagem", state: "MG", lat: -19.932, lng: -44.054, address: "Via Expressa — Cidade Industrial" },
];

// Destinos intermunicipais (ids loc-cli-1..12 preservados para dados já salvos).
const CLIENT_CITIES = [
  { name: "Niterói", city: "Niterói", state: "RJ", lat: -22.8833, lng: -43.1036 },
  { name: "Petrópolis", city: "Petrópolis", state: "RJ", lat: -22.5112, lng: -43.1779 },
  { name: "Duque de Caxias", city: "Duque de Caxias", state: "RJ", lat: -22.7856, lng: -43.3117 },
  { name: "Campinas", city: "Campinas", state: "SP", lat: -22.9099, lng: -47.0626 },
  { name: "Santos", city: "Santos", state: "SP", lat: -23.9608, lng: -46.3336 },
  { name: "Guarulhos", city: "Guarulhos", state: "SP", lat: -23.4538, lng: -46.5333 },
  { name: "Sorocaba", city: "Sorocaba", state: "SP", lat: -23.5015, lng: -47.4526 },
  { name: "Uberlândia", city: "Uberlândia", state: "MG", lat: -18.9186, lng: -48.2772 },
  { name: "Juiz de Fora", city: "Juiz de Fora", state: "MG", lat: -21.7642, lng: -43.3467 },
  { name: "Contagem", city: "Contagem", state: "MG", lat: -19.9317, lng: -44.0536 },
  { name: "Vitória", city: "Vitória", state: "ES", lat: -20.3155, lng: -40.3128 },
  { name: "Vila Velha", city: "Vila Velha", state: "ES", lat: -20.3297, lng: -40.2925 },
  // Distribuição urbana (loc-cli-13 em diante)
  { name: "Barra da Tijuca", city: "Rio de Janeiro", state: "RJ", lat: -23.0004, lng: -43.3659 },
  { name: "Recreio dos Bandeirantes", city: "Rio de Janeiro", state: "RJ", lat: -23.0189, lng: -43.4658 },
  { name: "Freguesia (Jacarepaguá)", city: "Rio de Janeiro", state: "RJ", lat: -22.9416, lng: -43.3431 },
  { name: "Campo Grande", city: "Rio de Janeiro", state: "RJ", lat: -22.9035, lng: -43.5591 },
  { name: "Taquara", city: "Rio de Janeiro", state: "RJ", lat: -22.9223, lng: -43.3713 },
  { name: "Pinheiros", city: "São Paulo", state: "SP", lat: -23.567, lng: -46.7019 },
  { name: "Moema", city: "São Paulo", state: "SP", lat: -23.601, lng: -46.665 },
  { name: "Santana", city: "São Paulo", state: "SP", lat: -23.502, lng: -46.625 },
  { name: "Tatuapé", city: "São Paulo", state: "SP", lat: -23.54, lng: -46.576 },
  { name: "Savassi", city: "Belo Horizonte", state: "MG", lat: -19.938, lng: -43.935 },
  { name: "Pampulha", city: "Belo Horizonte", state: "MG", lat: -19.851, lng: -43.969 },
  { name: "Barreiro", city: "Belo Horizonte", state: "MG", lat: -19.976, lng: -44.02 },
];

const CUSTOMER_NAMES = [
  "Mercado Bom Preço", "Farmácia Vitalis", "Distribuidora Central", "Auto Peças Rota Sul",
  "Supermercado Raiz", "Constrular Materiais", "Ótica Visão Clara", "Papelaria Horizonte",
  "Móveis Bento", "Eletro Fácil", "Padaria Trigo Dourado", "Depósito São Judas",
  "Farmavida Drogaria", "Mercearia Ponto Certo", "Casa das Tintas", "Comercial Alvorada",
  "Rede Nutrimais", "Atacado União", "Distribuidora Rio Verde", "Loja Estrela Sul",
  "Armazém do Zé", "Mercado Nova Era", "Grupo Ferraz Distribuição", "Center Box Atacado",
  "Comercial Planalto", "Distribuidora Bela Vista", "Rede Popular", "Atacadão Serrano",
];

const PRODUCTS = [
  { name: "Caixa de bebidas", category: "Alimentos e Bebidas" },
  { name: "Pallet de material de construção", category: "Construção" },
  { name: "Caixa de medicamentos", category: "Farma" },
  { name: "Lote de eletrodomésticos", category: "Eletro" },
  { name: "Fardo de papelaria", category: "Papelaria" },
  { name: "Caixa de autopeças", category: "Autopeças" },
  { name: "Lote de móveis desmontados", category: "Móveis" },
  { name: "Caixa de produtos de limpeza", category: "Higiene e Limpeza" },
];

const VEHICLE_SPECS = {
  Van: { capacityKg: 1200, capacityM3: 6 },
  Toco: { capacityKg: 3500, capacityM3: 20 },
  Truck: { capacityKg: 8000, capacityM3: 40 },
  Carreta: { capacityKg: 27000, capacityM3: 90 },
} as const;

// Frota fixa (placas no padrão Mercosul). ORBT-006 está em manutenção.
const FLEET: { type: Vehicle["type"]; plate: string; ownership: Vehicle["ownership"]; status?: Vehicle["status"] }[] = [
  { type: "Van", plate: "RJO4A21", ownership: "Frota Própria" },
  { type: "Van", plate: "SPA2B37", ownership: "Frota Própria" },
  { type: "Van", plate: "MGB7C04", ownership: "Frota Própria" },
  { type: "Toco", plate: "RJK1D52", ownership: "Frota Própria" },
  { type: "Toco", plate: "SPF3E88", ownership: "Frota Própria" },
  { type: "Toco", plate: "MGH5F19", ownership: "Frota Própria", status: "Manutenção" },
  { type: "Truck", plate: "RJL8G63", ownership: "Frota Própria" },
  { type: "Truck", plate: "SPM0H45", ownership: "Terceiro" },
  { type: "Truck", plate: "MGN2J71", ownership: "Frota Própria" },
  { type: "Carreta", plate: "RJP6K30", ownership: "Terceiro" },
  { type: "Van", plate: "SPQ9L12", ownership: "Frota Própria" },
  { type: "Toco", plate: "MGR4M56", ownership: "Frota Própria" },
  { type: "Van", plate: "RJS7N83", ownership: "Frota Própria" },
  { type: "Toco", plate: "RJT3P27", ownership: "Frota Própria" },
  { type: "Carreta", plate: "SPU1Q94", ownership: "Terceiro" },
];

const DRIVERS: { name: string; cnh: string; status?: Driver["status"] }[] = [
  { name: "Carlos Mendes", cnh: "D" },
  { name: "Marcos Andrade", cnh: "E" },
  { name: "José Ribeiro", cnh: "D" },
  { name: "Antônio Farias", cnh: "C" },
  { name: "Paulo Nascimento", cnh: "E" },
  { name: "Roberto Lima", cnh: "D", status: "Folga" },
  { name: "Eduardo Souza", cnh: "C" },
  { name: "Fernando Alves", cnh: "D" },
  { name: "Ricardo Gomes", cnh: "E" },
  { name: "André Pereira", cnh: "C" },
  { name: "Sérgio Barbosa", cnh: "D" },
  { name: "Luiz Fernandes", cnh: "D" },
  { name: "Marcelo Teixeira", cnh: "E" },
  { name: "Bruno Cardoso", cnh: "C" },
  { name: "Diego Martins", cnh: "D" },
];

const CARRIER_NAMES = ["RioLog", "FastCargo", "Trans Serrana", "Malha Sudeste", "Vetor Cargas"];

function pad(n: number, len: number): string {
  return n.toString().padStart(len, "0");
}

export function generateReferenceData(rng: () => number) {
  const company: Company = {
    id: "atlas",
    name: "Atlas Distribuição",
    region: "Sudeste",
    operationType: "Rodoviária",
  };

  const locations: Location[] = [
    ...CDS.map((cd, i) => ({
      id: `loc-cd-${i + 1}`,
      name: cd.name,
      city: cd.city,
      state: cd.state,
      kind: "CD" as const,
      lat: cd.lat,
      lng: cd.lng,
      address: cd.address,
    })),
    ...CLIENT_CITIES.map((c, i) => ({
      id: `loc-cli-${i + 1}`,
      name: c.name,
      city: c.city,
      state: c.state,
      kind: "Cliente" as const,
      lat: c.lat,
      lng: c.lng,
    })),
  ];
  const clientLocations = locations.filter((l) => l.kind === "Cliente");

  // Distribuição determinística: todo local de cliente tem pelo menos um cliente.
  const customers: Customer[] = CUSTOMER_NAMES.map((name, i) => ({
    id: `cust-${pad(i + 1, 3)}`,
    name,
    locationId: clientLocations[i % clientLocations.length].id,
  }));

  const products: Product[] = PRODUCTS.map((p, i) => ({ id: `prod-${pad(i + 1, 2)}`, ...p }));

  const vehicles: Vehicle[] = FLEET.map((v, i) => ({
    id: `ORBT-${pad(i + 1, 3)}`,
    plate: v.plate,
    type: v.type,
    ...VEHICLE_SPECS[v.type],
    ownership: v.ownership,
    status: v.status ?? "Disponível",
  }));

  const drivers: Driver[] = DRIVERS.map((d, i) => ({
    id: `driver-${pad(i + 1, 2)}`,
    name: d.name,
    cnhCategory: d.cnh,
    status: d.status ?? "Disponível",
  }));

  // Indicadores das transportadoras variam por seed — mesma seed, mesmos valores.
  const carriers: Carrier[] = CARRIER_NAMES.map((name, i) => ({
    id: `carrier-${pad(i + 1, 2)}`,
    name,
    regions: pickMany(rng, ["RJ", "SP", "MG", "ES"], intBetween(rng, 1, 3)),
    cargoTypes: pickMany(rng, ["Fracionado", "Lotação", "Distribuição", "Transferência"], intBetween(rng, 1, 2)),
    slaPercent: floatBetween(rng, 82, 98, 1),
    otifPercent: floatBetween(rng, 78, 97, 1),
    avgCostPerKm: floatBetween(rng, 1.4, 3.2, 2),
    occurrenceRate: floatBetween(rng, 0.02, 0.18, 2),
  }));

  return { company, locations, customers, products, vehicles, drivers, carriers };
}
