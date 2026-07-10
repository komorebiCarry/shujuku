import { beforeEach, describe, expect, it, vi } from 'vitest';

const { entriesByBook, mockSetEntries } = vi.hoisted(() => ({
  entriesByBook: new Map<string, any[]>(),
  mockSetEntries: vi.fn(),
}));

vi.mock('../../../src/data/gateways/worldbook-gateway', () => ({
  getLorebookEntries_ACU: vi.fn(async (bookName: string) => entriesByBook.get(bookName) || []),
  setLorebookEntries_ACU: mockSetEntries,
}));

vi.mock('../../../src/shared/utils', () => ({
  hashUserInput_ACU: vi.fn((value: string) => `hash:${value}`),
  logWarn_ACU: vi.fn(),
}));

import {
  buildAgentWorldbookSelectionSignature_ACU,
  restoreAgentWorldbookSnapshotEntries_ACU,
} from '../../../src/service/agent/agent-worldbook-snapshot-restore';

function activeSnapshot(entries: any[]) {
  return {
    active: true,
    selectionSignature: buildAgentWorldbookSelectionSignature_ACU(['世界书']),
    createdAt: 1,
    books: { 世界书: entries },
  } as any;
}

describe('restoreAgentWorldbookSnapshotEntries_ACU', () => {
  beforeEach(() => {
    entriesByBook.clear();
    mockSetEntries.mockReset();
  });

  it('rejects an active snapshot whose signature belongs to another scope', async () => {
    const result = await restoreAgentWorldbookSnapshotEntries_ACU({ ...activeSnapshot([]), selectionSignature: 'other' }, ['世界书']);

    expect(result).toEqual({ restored: 0, skipped: 0, failed: 0, signatureMatched: false });
    expect(mockSetEntries).not.toHaveBeenCalled();
  });

  it('skips missing or invalid snapshot entries without patching unrelated entries', async () => {
    entriesByBook.set('世界书', [{ uid: 'present', comment: '普通条目', enabled: false }]);

    const result = await restoreAgentWorldbookSnapshotEntries_ACU(activeSnapshot([
      { uid: '', previousEnabled: true },
      { uid: 'missing', previousEnabled: true },
    ]), ['世界书']);

    expect(result).toEqual({ restored: 0, skipped: 2, failed: 0, signatureMatched: true });
    expect(mockSetEntries).not.toHaveBeenCalled();
  });

  it('does not overwrite a user-edited entry but removes takeover metadata', async () => {
    const comment = '用户修改后的正文\n<!-- ACU_AGENT_WORLDBOOK_TAKEOVER_META_START\n{}\nACU_AGENT_WORLDBOOK_TAKEOVER_META_END -->';
    entriesByBook.set('世界书', [{ uid: 'entry-1', comment, enabled: false, keys: [] }]);

    const result = await restoreAgentWorldbookSnapshotEntries_ACU(activeSnapshot([
      { uid: 'entry-1', commentHash: 'hash:旧正文', previousEnabled: true, previousKeys: ['旧关键词'], previousType: 'selective' },
    ]), ['世界书']);

    expect(result).toEqual({ restored: 0, skipped: 1, failed: 0, signatureMatched: true });
    expect(mockSetEntries).toHaveBeenCalledWith('世界书', [{ uid: 'entry-1', comment: '用户修改后的正文' }]);
  });

  it('reports all entries in a book as failed when the gateway write fails', async () => {
    entriesByBook.set('世界书', [{ uid: 'entry-1', comment: '正文', enabled: false, keys: [] }]);
    mockSetEntries.mockRejectedValueOnce(new Error('gateway failure'));

    const result = await restoreAgentWorldbookSnapshotEntries_ACU(activeSnapshot([
      { uid: 'entry-1', previousEnabled: true, previousKeys: ['关键词'], previousType: 'selective' },
    ]), ['世界书']);

    expect(result).toEqual({ restored: 0, skipped: 0, failed: 1, signatureMatched: true });
  });
});
