import type { OperationDataset } from "../domain/types";
import { loadPersistedState, persistState, clearPersistedState } from "../sim/persistence";
import { generateEmptyOperation } from "../sim/generate-empty";

// Armazenamento do Modo Demo: operação inteira no navegador (localStorage).
// Exposto como "external store" para useSyncExternalStore — leitura síncrona
// no cliente e `null` no servidor (sem descasamento de hidratação).

type Listener = () => void;
const listeners = new Set<Listener>();
let snapshot: OperationDataset | null = null;
let loaded = false;

function emit() {
  listeners.forEach((l) => l());
}

export const demoStore = {
  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): OperationDataset | null {
    if (!loaded) {
      loaded = true;
      snapshot = loadPersistedState() ?? generateEmptyOperation();
    }
    return snapshot;
  },
  getServerSnapshot(): OperationDataset | null {
    return null;
  },
  set(next: OperationDataset) {
    snapshot = next;
    persistState(next);
    emit();
  },
  reset() {
    clearPersistedState();
    snapshot = generateEmptyOperation();
    emit();
  },
};
