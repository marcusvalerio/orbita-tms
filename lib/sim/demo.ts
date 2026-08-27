/**
 * Fronteira do cenário de demonstração.
 *
 * Este módulo existe para manter o conteúdo demonstrativo removível sem
 * misturar sua API com a operação real. Quando a demonstração não for mais
 * necessária, este módulo e os arquivos de geração do cenário podem ser
 * removidos junto com loadDemoScenario no SimulationProvider.
 */
export { generateAtlasOperation } from './generate-atlas';
