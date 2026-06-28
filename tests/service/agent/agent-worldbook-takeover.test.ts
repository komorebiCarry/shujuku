import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockEntriesByBook,
  mockCurrentChar,
  mockPersistSettings,
  mockResolveBookNames,
  mockHashUserInput,
  mockCreateLorebookEntriesShouldSkip,
  mockSetLorebookEntriesShouldSkipSnapshot,
} = vi.hoisted(() => ({
  mockEntriesByBook: new Map<string, any[]>(),
  mockCurrentChar: { id: 'char-a', name: '角色A', avatar: 'a.png', data: { id: 'char-a-data' } } as any,
  mockPersistSettings: vi.fn(),
  mockResolveBookNames: vi.fn(async () => ['角色A世界书']),
  mockHashUserInput: vi.fn((value: string) => `hash:${value}`),
  mockCreateLorebookEntriesShouldSkip: { value: false },
  mockSetLorebookEntriesShouldSkipSnapshot: { value: false },
}));

vi.mock('../../../src/data/gateways/worldbook-gateway', () => ({
  getLorebookEntries_ACU: vi.fn(async (bookName: string) => mockEntriesByBook.get(bookName) || []),
  setLorebookEntries_ACU: vi.fn(async (bookName: string, updates: any[]) => {
    const entries = mockEntriesByBook.get(bookName) || [];
    if (mockSetLorebookEntriesShouldSkipSnapshot.value && updates.some(update => update.comment === 'TavernDB-ACU-AgentWorldbookSnapshot')) return;
    for (const update of updates) {
      const index = entries.findIndex(entry => String(entry.uid) === String(update.uid));
      if (index >= 0) entries[index] = { ...entries[index], ...update };
    }
    mockEntriesByBook.set(bookName, entries);
  }),
  createLorebookEntries_ACU: vi.fn(async (bookName: string, creates: any[]) => {
    if (mockCreateLorebookEntriesShouldSkip.value) return;
    const entries = mockEntriesByBook.get(bookName) || [];
    creates.forEach((entry, index) => entries.push({ uid: `created-${entries.length + index + 1}`, ...entry }));
    mockEntriesByBook.set(bookName, entries);
  }),
  deleteLorebookEntries_ACU: vi.fn(async (bookName: string, uids: any[]) => {
    const uidSet = new Set((uids || []).map(uid => String(uid)));
    const entries = mockEntriesByBook.get(bookName) || [];
    mockEntriesByBook.set(bookName, entries.filter(entry => !uidSet.has(String(entry.uid))));
  }),
  isWorldbookEntryUpdateApiAvailable_ACU: vi.fn(() => true),
}));

vi.mock('../../../src/data/gateways/character-gateway', () => ({
  getCurrentCharData_ACU: vi.fn(() => mockCurrentChar),
}));

vi.mock('../../../src/data/storage/tavern-storage', () => ({
  persistTavernSettings_ACU: mockPersistSettings,
}));

vi.mock('../../../src/shared/utils', () => ({
  hashUserInput_ACU: mockHashUserInput,
}));

vi.mock('../../../src/service/runtime/state-manager', () => ({
  settings_ACU: { plotSettings: {} },
}));

vi.mock('../../../src/service/agent/agent-skillify-service', () => ({
  resolvePlotWorldbookSkillifyBookNames_ACU: mockResolveBookNames,
  isWorldbookEntrySkillifyCandidate_ACU: vi.fn((entry: any) => entry?.enabled !== false && String(entry?.type || '').toLowerCase() !== 'constant' && Array.isArray(entry?.keys) && entry.keys.length > 0),
  getWorldbookEntryKeywordsForSkillify_ACU: vi.fn((entry: any) => entry?.keys || []),
}));

import { settings_ACU } from '../../../src/service/runtime/state-manager';
import {
  AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU,
  AGENT_WORLDBOOK_SNAPSHOT_COMMENT_ACU,
  getPlotAgentWorldbookSnapshot_ACU,
  readFinalGenerationGreenlights_ACU,
  refreshPlotAgentWorldbookSnapshotFromWorldbooks_ACU,
  restoreWorldbookGreenlights_ACU,
  takeoverWorldbookGreenlights_ACU,
  writeFinalGenerationGreenlights_ACU,
} from '../../../src/service/agent/agent-worldbook-takeover';

function snapshotEntry(bookName = '角色A世界书'): any {
  return (mockEntriesByBook.get(bookName) || []).find(entry => entry.comment === AGENT_WORLDBOOK_SNAPSHOT_COMMENT_ACU);
}

function finalGenerationGreenlightEntry(bookName = '角色A世界书'): any {
  return (mockEntriesByBook.get(bookName) || []).find(entry => entry.comment === AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEntriesByBook.clear();
  mockCurrentChar.id = 'char-a';
  mockCurrentChar.name = '角色A';
  mockCurrentChar.avatar = 'a.png';
  mockCurrentChar.data = { id: 'char-a-data' };
  mockResolveBookNames.mockResolvedValue(['角色A世界书']);
  mockCreateLorebookEntriesShouldSkip.value = false;
  mockSetLorebookEntriesShouldSkipSnapshot.value = false;
  (settings_ACU as any).plotSettings = {};
  mockEntriesByBook.set('角色A世界书', [
    { uid: 1, enabled: true, keys: ['钥匙A'], comment: '普通条目A', content: '内容A' },
  ]);
});

describe('agent worldbook takeover snapshot persistence', () => {
  it('接管时将当前角色卡快照保存到世界书内部条目，并禁用候选条目', async () => {
    const result = await takeoverWorldbookGreenlights_ACU();

    expect(result.updated).toBe(true);
    expect(result.disabled).toBe(1);
    expect(mockEntriesByBook.get('角色A世界书')?.find(entry => entry.uid === 1)?.enabled).toBe(false);

    const internalEntry = snapshotEntry();
    expect(internalEntry).toBeTruthy();
    expect(internalEntry.enabled).toBe(false);
    expect(internalEntry.type).toBe('constant');
    const payload = JSON.parse(internalEntry.content);
    expect(payload.version).toBe(1);
    expect(payload.active).toBe(true);
    expect(payload.books['角色A世界书'][0]).toMatchObject({ uid: 1, previousEnabled: true, previousKeys: ['钥匙A'] });
  });

  it('世界书内部快照创建失败时拒绝继续禁用候选条目', async () => {
    mockCreateLorebookEntriesShouldSkip.value = true;

    await expect(takeoverWorldbookGreenlights_ACU()).rejects.toThrow('接管快照写入失败');

    expect(mockEntriesByBook.get('角色A世界书')?.find(entry => entry.uid === 1)?.enabled).toBe(true);
    expect(getPlotAgentWorldbookSnapshot_ACU().active).toBe(false);
  });

  it('切换到其他角色卡时忽略不匹配角色的世界书内部快照', async () => {
    await takeoverWorldbookGreenlights_ACU();
    mockCurrentChar.id = 'char-b';
    mockCurrentChar.name = '角色B';
    mockCurrentChar.avatar = 'b.png';
    mockCurrentChar.data = { id: 'char-b-data' };
    (settings_ACU as any).plotSettings.agentWorldbookControlSnapshot = { active: true, selectionSignature: 'stale', createdAt: 1, books: { stale: [{ uid: 9, previousEnabled: true }] } };

    const snapshot = await refreshPlotAgentWorldbookSnapshotFromWorldbooks_ACU();

    expect(snapshot.active).toBe(false);
    expect(getPlotAgentWorldbookSnapshot_ACU().active).toBe(false);
  });

  it('恢复时从世界书内部读取当前角色卡快照并删除内部快照条目', async () => {
    await takeoverWorldbookGreenlights_ACU();
    (settings_ACU as any).plotSettings.agentWorldbookControlSnapshot = { active: false, selectionSignature: '', createdAt: 0, books: {} };

    const result = await restoreWorldbookGreenlights_ACU();

    expect(result.updated).toBe(true);
    expect(result.restored).toBe(1);
    expect(mockEntriesByBook.get('角色A世界书')?.find(entry => entry.uid === 1)?.enabled).toBe(true);
    expect(snapshotEntry()).toBeUndefined();
    expect(getPlotAgentWorldbookSnapshot_ACU().active).toBe(false);
  });

  it('正文绿灯状态写入后可按当前角色和世界书范围读取', async () => {
    await takeoverWorldbookGreenlights_ACU();

    const written = await writeFinalGenerationGreenlights_ACU([{ bookName: '角色A世界书', uid: 1, reason: '正文需要' }]);
    const readBack = await readFinalGenerationGreenlights_ACU();

    expect(written).toBe(true);
    expect(finalGenerationGreenlightEntry()).toBeTruthy();
    expect(readBack).toEqual([{ bookName: '角色A世界书', uid: 1, reason: '正文需要' }]);
  });

  it('正文绿灯为空时删除旧托管状态条目', async () => {
    await takeoverWorldbookGreenlights_ACU();
    await writeFinalGenerationGreenlights_ACU([{ bookName: '角色A世界书', uid: 1, reason: '正文需要' }]);

    const written = await writeFinalGenerationGreenlights_ACU([]);

    expect(written).toBe(false);
    expect(finalGenerationGreenlightEntry()).toBeUndefined();
  });

  it('没有 active 快照时恢复也会清理残留正文绿灯状态条目', async () => {
    mockEntriesByBook.set('角色A世界书', [
      { uid: 1, enabled: true, keys: ['钥匙A'], comment: '普通条目A', content: '内容A' },
      { uid: 'final-state', enabled: false, type: 'constant', keys: [], comment: AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU, content: JSON.stringify({ version: 1, characterKey: 'hash:char-a-data|char-a|a.png|角色A', selectionSignature: 'hash:{"scope":"agent-worldbook-takeover","books":["角色A世界书"]}', createdAt: 1, greenlights: [{ bookName: '角色A世界书', uid: 1 }] }) },
      { uid: 'snapshot-state', enabled: false, type: 'constant', keys: [], comment: AGENT_WORLDBOOK_SNAPSHOT_COMMENT_ACU, content: JSON.stringify({ version: 1, characterKey: 'hash:char-a-data|char-a|a.png|角色A', active: false, selectionSignature: 'hash:{"scope":"agent-worldbook-takeover","books":["角色A世界书"]}', createdAt: 1, books: {} }) },
    ]);

    const result = await restoreWorldbookGreenlights_ACU();

    expect(result.updated).toBe(true);
    expect(result.reason).toBe('no_active_snapshot');
    expect(finalGenerationGreenlightEntry()).toBeUndefined();
    expect(snapshotEntry()).toBeUndefined();
  });

  it('正文绿灯状态创建静默失败时抛出写入失败', async () => {
    await takeoverWorldbookGreenlights_ACU();
    mockCreateLorebookEntriesShouldSkip.value = true;

    await expect(writeFinalGenerationGreenlights_ACU([{ bookName: '角色A世界书', uid: 1, reason: '正文需要' }])).rejects.toThrow('正文绿灯状态写入失败');
  });

  it('恢复成功时同步删除正文绿灯状态条目', async () => {
    await takeoverWorldbookGreenlights_ACU();
    await writeFinalGenerationGreenlights_ACU([{ bookName: '角色A世界书', uid: 1, reason: '正文需要' }]);

    await restoreWorldbookGreenlights_ACU();

    expect(mockEntriesByBook.get('角色A世界书')?.find(entry => entry.uid === 1)?.enabled).toBe(true);
    expect(snapshotEntry()).toBeUndefined();
    expect(finalGenerationGreenlightEntry()).toBeUndefined();
  });
});
