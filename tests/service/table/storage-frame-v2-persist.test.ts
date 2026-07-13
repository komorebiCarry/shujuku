import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  chat: [] as any[],
  saveChat: vi.fn().mockResolvedValue(undefined),
  saveChatStrict: vi.fn().mockResolvedValue(undefined),
  settings: { dataIsolationEnabled: false, dataIsolationCode: '' },
  collectSummary: vi.fn(() => ({ sheet_a: { lastFilledAiFloor: 7, lastChangedAiFloor: 6 } })),
  loadReplayState: vi.fn(),
  scopeContainer: null as any,
  guideContainer: null as any,
  setGuide: vi.fn(() => true),
  runTransaction: vi.fn(),
}));

vi.mock('../../../src/data/gateways/chat-gateway', () => ({
  getChatArray_ACU: vi.fn(() => mocks.chat),
  saveChatToHost_ACU: mocks.saveChat,
  saveChatToHostStrict_ACU: mocks.saveChatStrict,
}));
vi.mock('../../../src/data/repositories/chat-message-data-repo', () => ({
  cloneIsolatedData_ACU: vi.fn((message: any) => JSON.parse(JSON.stringify(message.TavernDB_ACU_IsolatedData || {}))),
  writeMessageIdentity_ACU: vi.fn((message: any, isolationConfig: any) => {
    if (isolationConfig.enabled) {
      message.TavernDB_ACU_Identity = isolationConfig.code;
    } else {
      delete message.TavernDB_ACU_Identity;
    }
  }),
}));
vi.mock('../../../src/shared/utils', () => ({ logDebug_ACU: vi.fn(), logWarn_ACU: vi.fn() }));
vi.mock('../../../src/service/runtime/state-manager', () => ({
  getCurrentIsolationKey_ACU: vi.fn(() => ''),
  settings_ACU: mocks.settings,
}));
vi.mock('../../../src/service/table/storage-strategy-resolver', () => ({
  isV2TagData_ACU: vi.fn((tagData: any) => tagData?.storageFrame?.version === 2 && Array.isArray(tagData.storageFrame.logEntries)),
}));
vi.mock('../../../src/service/table/storage-frame-v2-replay', () => ({
  collectScheduleSummaryFromFramesV2_ACU: mocks.collectSummary,
  loadTableStateFromFramesV2_ACU: mocks.loadReplayState,
}));
vi.mock('../../../src/data/storage/chat-history', () => ({
  getChatScopedConfigContainer_ACU: vi.fn(() => mocks.scopeContainer),
  getChatSheetGuideContainer_ACU: vi.fn(() => mocks.guideContainer),
  setChatScopedConfigContainer_ACU: vi.fn((_chat: any[], value: any) => { mocks.scopeContainer = value; }),
  setChatSheetGuideContainer_ACU: vi.fn((_chat: any[], value: any) => { mocks.guideContainer = value; }),
}));
vi.mock('../../../src/service/template/chat-scope', () => ({
  setChatSheetGuideDataForIsolationKey_ACU: mocks.setGuide,
}));
vi.mock('../../../src/service/table/table-write-transaction', () => ({
  runTableWriteTransaction_ACU: mocks.runTransaction,
}));

import { commitCurrentFloorTemplateChanges_ACU, persistNullRowCleanupShards_ACU, persistTableSheetCheckpointV2_ACU } from '../../../src/service/table/storage-frame-v2-persist';

const sheetA = { uid: 'a', name: 'A', sourceData: {}, content: [['row_id', 'value'], ['1', 'new']], updateConfig: {}, exportConfig: {}, orderNo: 1 } as any;
const sheetB = { uid: 'b', name: 'B', sourceData: {}, content: [['row_id', 'value']], updateConfig: {}, exportConfig: {}, orderNo: 2 } as any;

function makeEntry(overrides: Record<string, any> = {}): any {
  return {
    seq: 1, entryId: 'entry-1', createdAt: 10, source: 'manual_fill', targetMessageIndex: 0, aiFloor: 1,
    filledSheetKeys: [], changedSheetKeys: [], groupKeys: [], operations: [], ...overrides,
  };
}

function seedFrame(frameOverrides: Record<string, any> = {}): any {
  const frame = {
    version: 2,
    checkpoint: { kind: 'full', createdAt: 1, reason: 'init', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB } },
    headRevision: '3:existing',
    manualRefillProgress: { kind: 'manual_refill', status: 'in_progress', selectedSheetKeys: ['sheet_b'] },
    logEntries: [makeEntry({ operations: [{ kind: 'sheet_replace', sheetKey: 'sheet_b', sheet: sheetB, reason: 'system' }] })],
    perSheetCheckpoints: { sheet_b: { kind: 'sheet_full', createdAt: 2, reason: 'manual', sheetKey: 'sheet_b', data: sheetB } },
    ...frameOverrides,
  };
  const message = { is_user: false, TavernDB_ACU_IsolatedData: { '': { _acu_storage_version: 2, storageFrame: frame } } };
  mocks.chat.splice(0, mocks.chat.length, message);
  mocks.loadReplayState.mockResolvedValue(frame.checkpoint?.data ?? null);
  return message;
}

function makeTransaction(baseRevision: string | null = 'runtime-v1:test'): any {
  return {
    baseRevision,
    writeSet: [{ kind: 'sheet', sheetKey: 'sheet_a' }],
    assertFresh: vi.fn(),
    runCommit: vi.fn(async (task: () => any) => task()),
  };
}

describe('persistTableSheetCheckpointV2_ACU', () => {
  beforeEach(() => {
    mocks.chat.length = 0;
    mocks.saveChat.mockReset().mockResolvedValue(undefined);
    mocks.saveChatStrict.mockReset().mockResolvedValue(undefined);
    mocks.collectSummary.mockClear();
    mocks.settings.dataIsolationEnabled = false;
    mocks.settings.dataIsolationCode = '';
    mocks.scopeContainer = { version: 1, template: { '': { old: true } } };
    mocks.guideContainer = { version: 1, tags: { '': { data: { sheet_old: {} } } } };
    mocks.setGuide.mockReset().mockImplementation(() => true);
    mocks.runTransaction.mockReset().mockImplementation(async (_options: any, task: any) => task({
      baseRevision: 'runtime-v1:test',
      assertFresh: vi.fn(),
      runCommit: async (commitTask: () => any) => commitTask(),
    }));
  });


  it('写入目标 shard 且保持根 checkpoint、revision、日志、进度和其他 shard 不变', async () => {
    const message = seedFrame();
    const beforeFrame = JSON.parse(JSON.stringify(message.TavernDB_ACU_IsolatedData[''].storageFrame));
    const transaction = makeTransaction();
    const event = { filledSheetKeys: ['sheet_a'], changedSheetKeys: ['sheet_a'], groupKeys: ['sheet_a'] };

    const result = await persistTableSheetCheckpointV2_ACU({
      targetMessageIndex: 0, sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', createdAt: 20,
      event, baseRevision: 'base-20', transactionContext: transaction,
    });

    expect(result.saved).toBe(true);
    expect(transaction.runCommit).toHaveBeenCalledWith(expect.any(Function), []);
    expect(transaction.assertFresh).toHaveBeenCalledWith('persistTableSheetCheckpointV2:before_persist');
    expect(mocks.saveChat).toHaveBeenCalledOnce();
    expect(mocks.collectSummary).toHaveBeenCalledWith(mocks.chat, '', { maxMessageIndex: 0 });
    const frame = message.TavernDB_ACU_IsolatedData[''].storageFrame;
    expect(frame.perSheetCheckpoints.sheet_a).toEqual({
      kind: 'sheet_full', createdAt: 20, reason: 'manual', sheetKey: 'sheet_a', data: sheetA,
      scheduleSummary: { lastFilledAiFloor: 7, lastChangedAiFloor: 6 }, event, baseRevision: 'base-20',
    });
    expect(frame.checkpoint).toEqual(beforeFrame.checkpoint);
    expect(frame.headRevision).toBe(beforeFrame.headRevision);
    expect(frame.logEntries).toEqual(beforeFrame.logEntries);
    expect(frame.manualRefillProgress).toEqual(beforeFrame.manualRefillProgress);
    expect(frame.perSheetCheckpoints.sheet_b).toEqual(beforeFrame.perSheetCheckpoints.sheet_b);

    sheetA.content[1][1] = 'caller-mutated';
    event.changedSheetKeys.push('sheet_b');
    expect(frame.perSheetCheckpoints.sheet_a.data.content[1][1]).toBe('new');
    expect(frame.perSheetCheckpoints.sheet_a.event.changedSheetKeys).toEqual(['sheet_a']);
    sheetA.content[1][1] = 'new';
  });

  it('宿主保存失败时恢复 isolated data 与 Identity，并继续抛出原错误', async () => {
    const message = seedFrame();
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    message.TavernDB_ACU_Identity = 'old-identity';
    mocks.settings.dataIsolationEnabled = true;
    mocks.settings.dataIsolationCode = 'new-identity';
    const saveError = new Error('host save failed');
    mocks.saveChat.mockRejectedValueOnce(saveError);

    await expect(persistTableSheetCheckpointV2_ACU({
      targetMessageIndex: 0,
      sheetKey: 'sheet_a',
      sheetData: sheetA,
      reason: 'manual',
      transactionContext: makeTransaction(),
    })).rejects.toBe(saveError);

    expect(mocks.saveChat).toHaveBeenCalledOnce();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
    expect(message.TavernDB_ACU_Identity).toBe('old-identity');
  });

  it('R1：没有 transactionContext 时拒绝直接写入', async () => {
    seedFrame();
    const result = await persistTableSheetCheckpointV2_ACU({ sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual' });
    expect(result).toEqual({ saved: false, error: expect.stringContaining('requires TableWriteTransactionContext') });
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it.each([
    ['R6 非 sheet_ key', { sheetKey: 'mate', sheetData: sheetA, reason: 'manual' }, 'sheetKey beginning'],
    ['R7 sheetData 缺失', { sheetKey: 'sheet_a', sheetData: undefined, reason: 'manual' }, 'object sheetData'],
    ['R7 sheetData 非对象', { sheetKey: 'sheet_a', sheetData: [], reason: 'manual' }, 'object sheetData'],
    ['R8 reason 缺失', { sheetKey: 'sheet_a', sheetData: sheetA }, 'explicit checkpoint reason'],
  ])('%s 时拒绝且不保存', async (_name, partial, errorText) => {
    seedFrame();
    const result = await persistTableSheetCheckpointV2_ACU({ ...partial, transactionContext: makeTransaction() } as any);
    expect(result.saved).toBe(false);
    expect(result.error).toContain(errorText);
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it.each([
    ['filledSheetKeys', makeEntry({ filledSheetKeys: ['sheet_a'] })],
    ['changedSheetKeys', makeEntry({ changedSheetKeys: ['sheet_a'] })],
    ['groupKeys', makeEntry({ groupKeys: ['sheet_a'] })],
    ['结构化 operation', makeEntry({ operations: [{ kind: 'row_delete', sheetKey: 'sheet_a', rowId: '1' }] })],
    ['legacy patch', makeEntry({ patches: [{ kind: 'row_delete', sheetKey: 'sheet_a', rowId: '1' }] })],
  ])('R9：目标 frame 已有目标表 %s 时拒绝', async (_name, entry) => {
    seedFrame({ logEntries: [entry] });
    const result = await persistTableSheetCheckpointV2_ACU({ sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', transactionContext: makeTransaction() });
    expect(result.saved).toBe(false);
    expect(result.error).toContain('existing target-sheet log entry');
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it.each(['data_replace', 'sql_batch', 'table_edit_dsl'])('R9：存在无法证明不影响目标表的 %s 时拒绝', async kind => {
    const operation = kind === 'data_replace'
      ? { kind, data: { mate: {}, sheet_a: sheetA }, reason: 'system' }
      : kind === 'sql_batch'
        ? { kind, statements: ['UPDATE anything SET value = 1'] }
        : { kind, text: 'unknown edit' };
    seedFrame({ logEntries: [makeEntry({ operations: [operation] })] });
    const result = await persistTableSheetCheckpointV2_ACU({ sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', transactionContext: makeTransaction() });
    expect(result.saved).toBe(false);
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it('R10：已有更新 createdAt 的同表 shard 时拒绝旧写覆盖', async () => {
    seedFrame({ perSheetCheckpoints: {
      sheet_a: { kind: 'sheet_full', createdAt: 30, reason: 'manual', sheetKey: 'sheet_a', data: sheetA },
      sheet_b: { kind: 'sheet_full', createdAt: 2, reason: 'manual', sheetKey: 'sheet_b', data: sheetB },
    } });
    const result = await persistTableSheetCheckpointV2_ACU({
      sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', createdAt: 20, transactionContext: makeTransaction(),
    });
    expect(result.saved).toBe(false);
    expect(result.error).toContain('cannot replace a newer checkpoint');
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it('目标 frame 早于最后一个 full checkpoint 时拒绝写入无效 shard', async () => {
    const earlyMessage = seedFrame({
      checkpoint: { kind: 'full', createdAt: 1, reason: 'init', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB } },
      logEntries: [],
    });
    const laterFullMessage = {
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          _acu_storage_version: 2,
          storageFrame: {
            version: 2,
            checkpoint: { kind: 'full', createdAt: 10, reason: 'compaction', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB } },
            logEntries: [],
          },
        },
      },
    };
    mocks.chat.splice(0, mocks.chat.length, earlyMessage, laterFullMessage);

    const result = await persistTableSheetCheckpointV2_ACU({ targetMessageIndex: 0, sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', transactionContext: makeTransaction() });
    expect(result.saved).toBe(false);
    expect(result.error).toContain('precedes the latest full checkpoint');
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });

  it('没有根 full checkpoint 时拒绝仅写 shard', async () => {
    seedFrame({ checkpoint: undefined });
    const result = await persistTableSheetCheckpointV2_ACU({ sheetKey: 'sheet_a', sheetData: sheetA, reason: 'manual', transactionContext: makeTransaction() });
    expect(result.saved).toBe(false);
    expect(result.error).toContain('existing full checkpoint anchor');
    expect(mocks.saveChat).not.toHaveBeenCalled();
  });
});

describe('persistNullRowCleanupShards_ACU', () => {
  beforeEach(() => {
    mocks.chat.length = 0;
    mocks.saveChat.mockReset().mockResolvedValue(undefined);
    mocks.saveChatStrict.mockReset().mockResolvedValue(undefined);
    mocks.collectSummary.mockClear();
    mocks.settings.dataIsolationEnabled = false;
    mocks.settings.dataIsolationCode = '';
    mocks.runTransaction.mockReset().mockImplementation(async (_options: any, task: any) => task({
      baseRevision: 'runtime-v1:test',
      assertFresh: vi.fn(),
      runCommit: async (commitTask: () => any) => commitTask(),
    }));
  });

  it('在一次事务和一次严格宿主保存中批量写入受影响 shard，不写 guide 或根 frame 字段', async () => {
    const message = seedFrame({ logEntries: [] });
    const before = JSON.parse(JSON.stringify(message.TavernDB_ACU_IsolatedData[''].storageFrame));

    const result = await persistNullRowCleanupShards_ACU({
      sheetDataByKey: { sheet_a: sheetA, sheet_b: sheetB },
      createdAt: 30,
    });

    expect(result).toMatchObject({ status: 'persisted', messageIndex: 0 });
    expect(result.checkpoints).toHaveLength(2);
    expect(mocks.saveChatStrict).toHaveBeenCalledOnce();
    expect(mocks.saveChat).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(before.checkpoint);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.logEntries).toEqual(before.logEntries);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.headRevision).toBe(before.headRevision);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toMatchObject({
      kind: 'sheet_full', reason: 'integrity_repair', createdAt: 30, sheetKey: 'sheet_a',
    });
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_b).toMatchObject({
      kind: 'sheet_full', reason: 'integrity_repair', createdAt: 30, sheetKey: 'sheet_b',
    });
    expect(mocks.setGuide).not.toHaveBeenCalled();
  });

  it('没有 full checkpoint anchor 时跳过且不创建 V2 checkpoint', async () => {
    const message = seedFrame({ checkpoint: undefined, logEntries: [] });

    const result = await persistNullRowCleanupShards_ACU({ sheetDataByKey: { sheet_a: sheetA } });

    expect(result).toEqual({ status: 'skipped_no_anchor' });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toBeUndefined();
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
  });

  it('最新 AI 楼层不是 V2 frame 时跳过，不把 legacy 目标隐式迁移为 V2', async () => {
    const anchor = seedFrame({ logEntries: [] });
    const legacyTarget = { is_user: false, TavernDB_ACU_IndependentData: { sheet_a: { legacy: true } } };
    mocks.chat.splice(0, mocks.chat.length, anchor, legacyTarget);

    const result = await persistNullRowCleanupShards_ACU({ sheetDataByKey: { sheet_a: sheetA } });

    expect(result).toEqual({ status: 'skipped_no_v2_target' });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(legacyTarget.TavernDB_ACU_IsolatedData).toBeUndefined();
    expect(legacyTarget.TavernDB_ACU_Identity).toBeUndefined();
    expect(anchor.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
  });

  it('commit 前 freshness conflict 时零写入、零保存且不报告已持久化', async () => {
    const message = seedFrame({ logEntries: [] });
    const original = message.TavernDB_ACU_IsolatedData;
    mocks.runTransaction.mockImplementationOnce(async (_options: any, task: any) => task({
      baseRevision: 'runtime-v1:stale',
      assertFresh: () => { throw new Error('runtime revision conflict'); },
      runCommit: async (commitTask: () => any) => commitTask(),
    }));

    const result = await persistNullRowCleanupShards_ACU({ sheetDataByKey: { sheet_a: sheetA } });

    expect(result).toEqual({ status: 'failed', error: 'runtime revision conflict' });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(original);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
  });

  it('严格宿主保存失败时恢复 isolated data 与 identity，并报告失败', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    message.TavernDB_ACU_Identity = 'old-identity';
    mocks.settings.dataIsolationEnabled = true;
    mocks.settings.dataIsolationCode = 'new-identity';
    mocks.saveChatStrict.mockRejectedValueOnce(new Error('host save failed'));

    const result = await persistNullRowCleanupShards_ACU({ sheetDataByKey: { sheet_a: sheetA } });

    expect(result).toEqual({ status: 'failed', error: 'host save failed' });
    expect(mocks.saveChatStrict).toHaveBeenCalledTimes(2);
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
    expect(message.TavernDB_ACU_Identity).toBe('old-identity');
  });

  it('提交与回滚宿主保存均失败时保留两个错误并恢复内存状态', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    message.TavernDB_ACU_Identity = 'old-identity';
    mocks.settings.dataIsolationEnabled = true;
    mocks.settings.dataIsolationCode = 'new-identity';
    mocks.saveChatStrict.mockRejectedValueOnce(new Error('commit save failed')).mockRejectedValueOnce(new Error('rollback save failed'));

    const result = await persistNullRowCleanupShards_ACU({ sheetDataByKey: { sheet_a: sheetA } });

    expect(result).toMatchObject({ status: 'failed', error: expect.stringContaining('commit save failed') });
    expect(result.error).toContain('rollback save failed');
    expect(mocks.saveChatStrict).toHaveBeenCalledTimes(2);
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
    expect(message.TavernDB_ACU_Identity).toBe('old-identity');
  });
});

describe('commitCurrentFloorTemplateChanges_ACU', () => {
  beforeEach(() => {
    mocks.chat.length = 0;
    mocks.saveChat.mockReset().mockResolvedValue(undefined);
    mocks.saveChatStrict.mockReset().mockResolvedValue(undefined);
    mocks.collectSummary.mockClear();
    mocks.settings.dataIsolationEnabled = false;
    mocks.settings.dataIsolationCode = '';
    mocks.scopeContainer = { version: 1, template: { '': { old: true } } };
    mocks.guideContainer = { version: 1, tags: { '': { data: { sheet_old: {} } } } };
    mocks.loadReplayState.mockReset();
    mocks.setGuide.mockReset().mockImplementation(() => true);
  });

  it('在最新 AI 楼层原子写入多个 shard 与 guide，并且严格保存一次', async () => {
    const message = seedFrame({ logEntries: [] });
    const guideData = { sheet_a: { name: 'A' }, sheet_b: { name: 'B' } };
    const event = { filledSheetKeys: [], changedSheetKeys: ['sheet_a'] };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [
        { sheetKey: 'sheet_a', sheetData: sheetA, event },
        { sheetKey: 'sheet_b', sheetData: sheetB },
      ],
      guideData,
      syncTemplateScope: true,
      createdAt: 30,
    });

    expect(result.saved).toBe(true);
    expect(result.messageIndex).toBe(0);
    expect(mocks.saveChatStrict).toHaveBeenCalledOnce();
    expect(mocks.saveChat).not.toHaveBeenCalled();
    expect(mocks.setGuide).toHaveBeenCalledWith('', guideData, expect.objectContaining({
      syncTemplateScope: true,
      updatedAt: 30,
    }));
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toMatchObject({
      kind: 'sheet_full', reason: 'schema_change', createdAt: 30, sheetKey: 'sheet_a', event,
    });
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_b).toMatchObject({
      kind: 'sheet_full', reason: 'schema_change', createdAt: 30, sheetKey: 'sheet_b',
      event: { filledSheetKeys: [], changedSheetKeys: ['sheet_b'] },
    });
  });

  it('新增 sheet 在目标 frame 尾部日志后写入 introduction timeline', async () => {
    const introducedSheet = { ...sheetB, uid: 'introduced', name: '新增表' };
    const message = seedFrame({
      logEntries: [makeEntry({
        seq: 7,
        operations: [{ kind: 'data_replace', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB }, reason: 'system' }],
      })],
    });

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '新增表' } },
      createdAt: 30,
    });

    expect(result.saved).toBe(true);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toMatchObject({
      kind: 'sheet_full', sheetKey: 'sheet_new',
      timeline: { kind: 'sheet_introduction', activateAtMessageIndex: 0, afterSeq: 7 },
    });
  });

  it('前序合法 V2 history frame 缺少 checkpoint 时仍允许 introduction', async () => {
    const historicalMessage = seedFrame({
      checkpoint: undefined,
      logEntries: [],
      perSheetCheckpoints: {},
    });
    const targetMessage = seedFrame({ logEntries: [], perSheetCheckpoints: {} });
    mocks.chat.splice(0, mocks.chat.length, historicalMessage, targetMessage);
    mocks.loadReplayState.mockResolvedValue(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data);
    const introducedSheet = { ...sheetB, uid: 'no-history-checkpoint', name: '无根 checkpoint 的历史后新增表' };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '无根 checkpoint 的历史后新增表' } },
      createdAt: 30,
    });

    expect(result.saved).toBe(true);
    expect(mocks.saveChatStrict).toHaveBeenCalledOnce();
    expect(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toMatchObject({
      kind: 'sheet_full',
      sheetKey: 'sheet_new',
      timeline: { kind: 'sheet_introduction', activateAtMessageIndex: 1, afterSeq: 0 },
    });
  });

  it('既有 full checkpoint 或当前 shard 的 sheet 被标为新增时受控拒绝且零写入', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const headerOnlySheetA = { ...sheetA, content: [sheetA.content[0]] };
    const headerOnlySheetB = { ...sheetB, content: [sheetB.content[0]] };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [
        { sheetKey: 'sheet_a', sheetData: headerOnlySheetA, isNewSheet: true },
        { sheetKey: 'sheet_b', sheetData: headerOnlySheetB, isNewSheet: true },
      ],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
  });

  it('replay state 已存在同名 sheet 但 target frame 无 shard 时拒绝 introduction 且零写入', async () => {
    const message = seedFrame({ logEntries: [], perSheetCheckpoints: {} });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const introducedSheet = { ...sheetB, uid: 'replayed-sheet', name: '历史已存在表' };
    mocks.loadReplayState.mockResolvedValue({
      ...message.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data,
      sheet_new: introducedSheet,
    });

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '历史已存在表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.loadReplayState).toHaveBeenCalledWith(mocks.chat, '', { maxMessageIndex: 0, updateRuntimeState: false });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
  });

  it('历史 full checkpoint 曾存在且后续 data_replace 删除同名 sheet 时拒绝 introduction 且零写入', async () => {
    const historicalSheet = { ...sheetB, uid: 'historical-sheet', name: '已删除历史表' };
    const historicalMessage = seedFrame({
      checkpoint: {
        kind: 'full', createdAt: 1, reason: 'init',
        data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB, sheet_new: historicalSheet },
      },
      logEntries: [],
      perSheetCheckpoints: {},
    });
    const targetMessage = {
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          _acu_storage_version: 2,
          storageFrame: {
            version: 2,
            checkpoint: {
              kind: 'full', createdAt: 2, reason: 'system',
              data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB },
            },
            logEntries: [makeEntry({
              operations: [{ kind: 'data_replace', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB }, reason: 'system' }],
            })],
            perSheetCheckpoints: {},
          },
        },
      },
    };
    mocks.chat.splice(0, mocks.chat.length, historicalMessage, targetMessage);
    mocks.loadReplayState.mockResolvedValue(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data);
    const originalIsolatedData = targetMessage.TavernDB_ACU_IsolatedData;

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: historicalSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '已删除历史表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(targetMessage.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toBeUndefined();
  });

  it('带业务行的新 sheet 不能作为 introduction 且零写入', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const sheetWithDataRow = { ...sheetB, uid: 'new-with-data', name: '含数据新表', content: [['row_id', 'value'], ['1', '业务数据']] };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: sheetWithDataRow, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '含数据新表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('header-only') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toBeUndefined();
  });

  it.each([
    ['伪造 sheetKey 的全局 sql_batch', { kind: 'sql_batch', sheetKey: 'sheet_other', statements: ['UPDATE any_table SET value = 1'] }],
    ['伪造 sheetKey 的全局 table_edit_dsl', { kind: 'table_edit_dsl', sheetKey: 'sheet_other', text: '更新表格：任意表' }],
    ['伪造 sheetKey 的未知 operation', { kind: 'future_unknown_operation', sheetKey: 'sheet_other' }],
    ['缺少 rowId 的单表 operation', { kind: 'row_delete', sheetKey: 'sheet_other' }],
  ])('无法证明安全的历史 %s 时拒绝 introduction 且零写入', async (_label, operation) => {
    const message = seedFrame({
      logEntries: [makeEntry({ operations: [operation] })],
      perSheetCheckpoints: {},
    });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const introducedSheet = { ...sheetB, uid: `unsafe-history-${_label}`, name: '新增表' };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '新增表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toBeUndefined();
  });

  it.each([
    ['logEntries 非数组', { logEntries: null }],
    ['perSheetCheckpoints 非对象', { logEntries: [], perSheetCheckpoints: [] }],
  ])('带 V2 标记的畸形历史 frame：%s 时拒绝 introduction 且零写入', async (_label, frameOverrides) => {
    const historicalMessage = seedFrame(frameOverrides);
    const targetMessage = seedFrame({ logEntries: [], perSheetCheckpoints: {} });
    mocks.chat.splice(0, mocks.chat.length, historicalMessage, targetMessage);
    mocks.loadReplayState.mockResolvedValue(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data);
    const originalIsolatedData = targetMessage.TavernDB_ACU_IsolatedData;
    const introducedSheet = { ...sheetB, uid: `malformed-history-${_label}`, name: '新增表' };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '新增表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(targetMessage.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toBeUndefined();
  });

  it.each([
    ['缺少 createdAt 的 full checkpoint', { checkpoint: { kind: 'full', reason: 'init', data: { mate: { type: 'acu' }, sheet_a: sheetA, sheet_b: sheetB } } }],
    ['缺少 reason 的 sheet checkpoint', { perSheetCheckpoints: { sheet_other: { kind: 'sheet_full', sheetKey: 'sheet_other', createdAt: 1, data: sheetB } } }],
    ['V2 marker 与 frame version 不一致', { version: 1, logEntries: [] }],
    ['缺少 entry 必填字段', { logEntries: [{ operations: [{ kind: 'row_delete', sheetKey: 'sheet_other', rowId: '1' }] }] }],
    ['空 sheet_replace sheet', { logEntries: [makeEntry({ operations: [{ kind: 'sheet_replace', sheetKey: 'sheet_other', sheet: {}, reason: 'system' }] })] }],
    ['空 schema migration descriptor', { logEntries: [makeEntry({ operations: [{ kind: 'sheet_schema_migrate', sheetKey: 'sheet_other', contractVersion: 1, beforeSchemaDigest: 'before', targetSchemaDigest: 'after', beforeSchema: {}, targetSchema: {}, columnChanges: [], migrationPolicy: { destructiveChangeConfirmed: false } }] })] }],
    ['畸形 sql_sheet_batch', { logEntries: [makeEntry({ operations: [{ kind: 'sql_sheet_batch', sheetKey: 'sheet_other', statements: [123] }] })] }],
    ['畸形 schema migration', { logEntries: [makeEntry({ operations: [{ kind: 'sheet_schema_migrate', sheetKey: 'sheet_other', contractVersion: 999 }] })] }],
    ['畸形 row_upsert cells', { logEntries: [makeEntry({ operations: [{ kind: 'row_upsert', sheetKey: 'sheet_other', rowId: '1', cells: [1] }] })] }],
    ['未知 legacy patch', { logEntries: [makeEntry({ patches: [{ kind: 'future_unknown_patch', sheetKey: 'sheet_other' }] })] }],
  ])('不完整的历史 persisted contract：%s 时拒绝 introduction 且零写入', async (_label, frameOverrides) => {
    const historicalMessage = seedFrame(frameOverrides);
    const targetMessage = seedFrame({ logEntries: [], perSheetCheckpoints: {} });
    mocks.chat.splice(0, mocks.chat.length, historicalMessage, targetMessage);
    mocks.loadReplayState.mockResolvedValue(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data);
    const originalIsolatedData = targetMessage.TavernDB_ACU_IsolatedData;
    const introducedSheet = { ...sheetB, uid: `incomplete-contract-${_label}`, name: '新增表' };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '新增表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('genuinely new sheet') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(targetMessage.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(targetMessage.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_new).toBeUndefined();
  });

  it.each([
    { label: '重复', entries: [makeEntry({ seq: 7 }), makeEntry({ seq: 7, entryId: 'entry-2' })], error: '唯一且严格递增' },
    { label: '倒序', entries: [makeEntry({ seq: 8 }), makeEntry({ seq: 7, entryId: 'entry-2' })], error: '唯一且严格递增' },
    { label: '非法', entries: [makeEntry({ seq: -1 })], error: '非法 log seq' },
  ])('目标 frame log seq $label 时拒绝 introduction 且零写入', async ({ entries, error }) => {
    const message = seedFrame({ logEntries: entries });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const introducedSheet = { ...sheetB, uid: `introduced-${entries[0].seq}`, name: '新增表' };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_new', sheetData: introducedSheet, isNewSheet: true }],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' }, sheet_new: { name: '新增表' } },
      createdAt: 30,
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining(error) });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
  });

  it('严格保存失败时回滚 shard、identity、guide 与 scope', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    message.TavernDB_ACU_Identity = 'old-identity';
    const originalScope = JSON.parse(JSON.stringify(mocks.scopeContainer));
    const originalGuide = JSON.parse(JSON.stringify(mocks.guideContainer));
    mocks.settings.dataIsolationEnabled = true;
    mocks.settings.dataIsolationCode = 'new-identity';
    mocks.setGuide.mockImplementation(() => {
      mocks.scopeContainer.template[''].changed = true;
      mocks.guideContainer.tags[''].changed = true;
      return true;
    });
    mocks.saveChatStrict.mockRejectedValueOnce(new Error('host save failed'));

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_a', sheetData: sheetA }],
      guideData: { sheet_a: { name: 'A' } },
      syncTemplateScope: true,
    });

    expect(result).toEqual({ saved: false, error: 'host save failed' });
    expect(mocks.saveChatStrict).toHaveBeenCalledTimes(2);
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_Identity).toBe('old-identity');
    expect(mocks.scopeContainer).toEqual(originalScope);
    expect(mocks.guideContainer).toEqual(originalGuide);
  });

  it('最新 AI 楼层不是 V2 frame 时拒绝提交，不隐式迁移或修改 guide/scope', async () => {
    const anchor = seedFrame({ logEntries: [] });
    const legacyTarget = { is_user: false, TavernDB_ACU_IndependentData: { sheet_a: { legacy: true } } };
    mocks.chat.splice(0, mocks.chat.length, anchor, legacyTarget);
    const originalScope = JSON.parse(JSON.stringify(mocks.scopeContainer));
    const originalGuide = JSON.parse(JSON.stringify(mocks.guideContainer));

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [{ sheetKey: 'sheet_a', sheetData: sheetA }],
      guideData: { sheet_a: { name: 'A' } },
    });

    expect(result).toMatchObject({ saved: false, error: expect.stringContaining('已存在合法 V2 storage frame') });
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(mocks.scopeContainer).toEqual(originalScope);
    expect(mocks.guideContainer).toEqual(originalGuide);
    expect(legacyTarget.TavernDB_ACU_IsolatedData).toBeUndefined();
    expect(legacyTarget.TavernDB_ACU_Identity).toBeUndefined();
    expect(anchor.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
  });

  it('拒绝非最新 AI 楼层且不保存', async () => {
    seedFrame({ logEntries: [] });
    mocks.chat.push({ is_user: false });

    const result = await commitCurrentFloorTemplateChanges_ACU({
      targetMessageIndex: 0,
      sheetCheckpoints: [{ sheetKey: 'sheet_a', sheetData: sheetA }],
      guideData: { sheet_a: { name: 'A' } },
    });

    expect(result.saved).toBe(false);
    expect(result.error).toContain('最新 AI 楼层');
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
  });

  it('任一 shard 的 DDL 无法 strict hydrate 时拒绝整批提交且不写 guide', async () => {
    const message = seedFrame({ logEntries: [] });
    const originalIsolatedData = message.TavernDB_ACU_IsolatedData;
    const invalidSheet = {
      ...sheetB,
      sourceData: { ddl: 'CREATE TABLE sheet_b ( value TEXT );' },
    };

    const result = await commitCurrentFloorTemplateChanges_ACU({
      isolationKey: '',
      sheetCheckpoints: [
        { sheetKey: 'sheet_a', sheetData: sheetA },
        { sheetKey: 'sheet_b', sheetData: invalidSheet },
      ],
      guideData: { sheet_a: { name: 'A' }, sheet_b: { name: 'B' } },
    });

    expect(result.saved).toBe(false);
    expect(result.error).toContain('DDL 无法 strict hydrate');
    expect(mocks.saveChatStrict).not.toHaveBeenCalled();
    expect(mocks.setGuide).not.toHaveBeenCalled();
    expect(message.TavernDB_ACU_IsolatedData).toBe(originalIsolatedData);
    expect(message.TavernDB_ACU_IsolatedData[''].storageFrame.perSheetCheckpoints.sheet_a).toBeUndefined();
  });
});
