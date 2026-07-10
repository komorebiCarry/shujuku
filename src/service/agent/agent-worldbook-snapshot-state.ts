import type { AgentWorldbookControlSnapshot_ACU } from '../../shared/models/agent-worldbook-model';

let cachedAgentWorldbookSnapshot_ACU: AgentWorldbookControlSnapshot_ACU = {
  active: false,
  selectionSignature: '',
  createdAt: 0,
  books: {},
};

export function getAgentWorldbookSnapshotState_ACU(): AgentWorldbookControlSnapshot_ACU {
  return cachedAgentWorldbookSnapshot_ACU;
}

export function setAgentWorldbookSnapshotState_ACU(snapshot: AgentWorldbookControlSnapshot_ACU): void {
  cachedAgentWorldbookSnapshot_ACU = snapshot;
}
