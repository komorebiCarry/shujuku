/**
 * tests/service/chat/chat-service.test.ts
 * 聊天数据服务 单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSettings, mockCurrentJsonTableData, mockGetChatArray, mockSaveChatToHost, mockSetChatMessages, mockEmitMessageUpdated, mockGetCurrentIsolationKey, mockGetLastOptimizationBase, mockSetLastOptimizationBase, mockSanitizeSheet, mockPersistTablesToChatMessage, mockRunTableUpdateCommit, mockRunTableWriteTransaction, mockLoadTableStateFromFramesV2, mockCollectScheduleSummaryFromFramesV2 } = vi.hoisted(() => ({
  mockSettings: {
    retainRecentLayers: 3,
    dataIsolationEnabled: false,
    dataIsolationCode: '',
  } as any,
  mockCurrentJsonTableData: {
    sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] },
    sheet_1: { name: '纪要表', content: [['row_id', '事件'], ['1', '开始']] },
  } as any,
  mockGetChatArray: vi.fn(),
  mockSaveChatToHost: vi.fn(),
  mockSetChatMessages: vi.fn(),
  mockEmitMessageUpdated: vi.fn(),
  mockGetCurrentIsolationKey: vi.fn(() => ''),
  mockGetLastOptimizationBase: vi.fn(() => null),
  mockSetLastOptimizationBase: vi.fn(),
  mockSanitizeSheet: vi.fn((sheet: any) => sheet),
  mockPersistTablesToChatMessage: vi.fn(),
  mockRunTableUpdateCommit: vi.fn(),
  mockRunTableWriteTransaction: vi.fn(),
  mockLoadTableStateFromFramesV2: vi.fn(),
  mockCollectScheduleSummaryFromFramesV2: vi.fn(() => null),
}));

vi.mock('../../../src/data/gateways/chat-gateway', () => ({
  getChatArray_ACU: mockGetChatArray,
  getChatLength_ACU: vi.fn(() => 0),
  getLastMessageIndex_ACU: vi.fn(() => -1),
  saveChatToHost_ACU: mockSaveChatToHost,
  stopGeneration_ACU: vi.fn(),
  deleteLastMessage_ACU: vi.fn(),
  setChatMessages_ACU: mockSetChatMessages,
  emitMessageUpdated_ACU: mockEmitMessageUpdated,
}));

vi.mock('../../../src/shared/utils', () => ({
  logDebug_ACU: vi.fn(),
  logError_ACU: vi.fn(),
  logWarn_ACU: vi.fn(),
  isSummaryOrOutlineTable_ACU: vi.fn((name: string) => name.includes('纪要') || name.includes('总结')),
}));

vi.mock('../../../src/service/optimization/content-optimization', () => ({
  getLastOptimizationBase_ACU: mockGetLastOptimizationBase,
  setLastOptimizationBase_ACU: mockSetLastOptimizationBase,
}));

vi.mock('../../../src/service/runtime/state-manager', () => ({
  settings_ACU: mockSettings,
  currentJsonTableData_ACU: mockCurrentJsonTableData,
  currentChatFileIdentifier_ACU: 'chat-test',
  getCurrentIsolationKey_ACU: mockGetCurrentIsolationKey,
}));

vi.mock('../../../src/service/template/chat-scope', () => ({
  sanitizeSheetForStorage_ACU: mockSanitizeSheet,
}));

vi.mock('../../../src/service/table/table-service', () => ({
  persistTablesToChatMessage_ACU: mockPersistTablesToChatMessage,
}));

vi.mock('../../../src/service/table/table-update-commit', () => ({
  runTableUpdateCommit_ACU: mockRunTableUpdateCommit,
}));

vi.mock('../../../src/service/table/table-write-transaction', () => ({
  runTableWriteTransaction_ACU: mockRunTableWriteTransaction,
}));

vi.mock('../../../src/service/table/storage-frame-v2-replay', () => ({
  loadTableStateFromFramesV2_ACU: mockLoadTableStateFromFramesV2,
  collectScheduleSummaryFromFramesV2_ACU: mockCollectScheduleSummaryFromFramesV2,
}));

import {
  replaceChatMessage_ACU,
  getOriginalContent_ACU,
  purgeOldLayerData_ACU,
  ensureV2BoundaryCheckpointForRetainedBuffer_ACU,
  ensureManualRefillInitialBaseline_ACU,
  deleteLocalDataInChatCore_ACU,
  overrideLatestLayerWithTemplateCore_ACU,
  saveCurrentDataForTable_ACU,
} from '../../../src/service/chat/chat-service';

beforeEach(() => {
  vi.clearAllMocks();
  mockSettings.retainRecentLayers = 3;
  mockSettings.dataIsolationEnabled = false;
  mockSettings.dataIsolationCode = '';
  mockGetCurrentIsolationKey.mockReturnValue('');
  mockSaveChatToHost.mockResolvedValue(undefined);
  mockPersistTablesToChatMessage.mockResolvedValue({ saved: true, messageIndex: 0 });
  mockRunTableUpdateCommit.mockImplementation(async (options: any, apply: any) => {
    mockPersistTablesToChatMessage(options);
    const applied = await apply();
    return {
      success: applied?.success !== false,
      value: applied?.value,
      tableData: applied?.tableData,
      saved: true,
    };
  });
  mockRunTableWriteTransaction.mockImplementation(async (_options: any, task: any) => task());
  mockLoadTableStateFromFramesV2.mockResolvedValue({
    sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] },
  });
  mockCollectScheduleSummaryFromFramesV2.mockReturnValue(null);
});

// ═══ replaceChatMessage_ACU ═══
describe('replaceChatMessage_ACU', () => {
  it('成功替换消息内容', async () => {
    const chat = [
      { is_user: true, mes: '你好' },
      { is_user: false, mes: '原始内容', message_id: 'msg1', extra: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);
    mockSetChatMessages.mockResolvedValue(true);
    const result = await replaceChatMessage_ACU(1, '新内容');
    expect(result).toBe(true);
    expect(mockSetChatMessages).toHaveBeenCalledWith(
      [expect.objectContaining({ message_id: 'msg1', mes: '新内容' })],
      { refresh: 'affected' },
    );
  });

  it('消息不存在返回 false', async () => {
    mockGetChatArray.mockReturnValue([]);
    const result = await replaceChatMessage_ACU(5, '新内容');
    expect(result).toBe(false);
  });

  it('setChatMessages 不可用时使用降级方案', async () => {
    const chat = [
      { is_user: false, mes: '原始内容', message_id: 'msg1', extra: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);
    mockSetChatMessages.mockResolvedValue(false);
    const result = await replaceChatMessage_ACU(0, '新内容');
    expect(result).toBe(true);
    expect(chat[0].mes).toBe('新内容');
    expect(mockSaveChatToHost).toHaveBeenCalled();
  });

  it('保存原始内容到 extra._acu_original_content', async () => {
    const chat = [
      { is_user: false, mes: '原始内容', message_id: 'msg1', extra: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);
    mockSetChatMessages.mockResolvedValue(true);
    await replaceChatMessage_ACU(0, '新内容');
    expect(mockSetChatMessages).toHaveBeenCalledWith(
      [expect.objectContaining({
        extra: expect.objectContaining({ _acu_original_content: '原始内容' }),
      })],
      expect.anything(),
    );
  });
});

// ═══ getOriginalContent_ACU ═══
describe('getOriginalContent_ACU', () => {
  it('从缓存获取原始内容', () => {
    mockGetLastOptimizationBase.mockReturnValue({
      messageIndex: 1,
      messageId: 'msg1',
      baseContent: '原始内容',
    });
    mockGetChatArray.mockReturnValue([
      { is_user: true },
      { is_user: false, message_id: 'msg1' },
    ]);
    expect(getOriginalContent_ACU(1)).toBe('原始内容');
  });

  it('从 extra 获取原始内容', () => {
    mockGetLastOptimizationBase.mockReturnValue(null);
    mockGetChatArray.mockReturnValue([
      { is_user: false, extra: { _acu_original_content: '从extra获取' } },
    ]);
    expect(getOriginalContent_ACU(0)).toBe('从extra获取');
  });

  it('消息不存在返回 null', () => {
    mockGetLastOptimizationBase.mockReturnValue(null);
    mockGetChatArray.mockReturnValue([]);
    expect(getOriginalContent_ACU(5)).toBeNull();
  });
});

// ═══ purgeOldLayerData_ACU ═══
describe('purgeOldLayerData_ACU', () => {
  it('清理超出保留层数的旧数据', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_Data: { sheet_0: { index } },
    }));
    mockGetChatArray.mockReturnValue(chat);
    await purgeOldLayerData_ACU();
    expect(chat[0].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[1].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[2].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[12].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[22].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[23].TavernDB_ACU_Data).toBeDefined();
    expect(chat[24].TavernDB_ACU_Data).toBeDefined();
    expect(mockSaveChatToHost).toHaveBeenCalled();
  });

  it('chat[0] 只保护指导表字段，不保护普通本地数据', async () => {
    mockSettings.retainRecentLayers = 1;
    const chat = Array.from({ length: 23 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_InternalSheetGuide: index === 0 ? { sheet_0: { name: '指导表' } } : undefined,
      TavernDB_ACU_Data: { sheet_0: { index } },
    }));
    mockGetChatArray.mockReturnValue(chat);

    await purgeOldLayerData_ACU();

    expect(chat[0].TavernDB_ACU_InternalSheetGuide).toEqual({ sheet_0: { name: '指导表' } });
    expect(chat[0].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[1].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[11].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[21].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[22].TavernDB_ACU_Data).toBeDefined();
  });

  it('达到保留数与 20 个 AI 楼层缓冲后，在最新保留 AI 窗口首个 AI 楼层补写 V2 checkpoint', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            ...(index === 0
              ? {
                  checkpoint: {
                    kind: 'full',
                    createdAt: 1,
                    reason: 'init',
                    data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                  },
                }
              : {}),
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    await purgeOldLayerData_ACU();

    expect(chat[0].TavernDB_ACU_IsolatedData).toBeUndefined();
    expect(chat[22].TavernDB_ACU_IsolatedData).toBeUndefined();
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data.sheet_0.content[1][1]).toBe('剑');
    expect(chat[24].TavernDB_ACU_IsolatedData).toBeDefined();
  });

  it('boundary checkpoint 写入失败时保留旧 checkpoint 且不清理旧楼层', async () => {
    mockSettings.retainRecentLayers = 2;
    mockLoadTableStateFromFramesV2.mockResolvedValueOnce(null);
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            checkpoint: index === 0
              ? {
                  kind: 'full',
                  createdAt: 1,
                  reason: 'init',
                  data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                }
              : index === 24
                ? {
                    kind: 'full',
                    createdAt: 24,
                    reason: 'manual',
                    data: { sheet_0: { name: '旧手动快照', content: [['row_id', '物品名'], ['1', '盾']] } },
                  }
                : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    await purgeOldLayerData_ACU();

    expect(chat[0].TavernDB_ACU_IsolatedData).toBeDefined();
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toBeUndefined();
    expect(chat[24].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'manual',
    }));
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('user 消息不参与 AI 楼层计数，purge anchor 仍落在第 21 个 AI 楼层', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat: any[] = [];
    for (let aiOrdinal = 0; aiOrdinal < 22; aiOrdinal++) {
      if (aiOrdinal === 5 || aiOrdinal === 12 || aiOrdinal === 20) {
        chat.push({ is_user: true, mes: `用户插入 ${aiOrdinal}` });
      }
      chat.push({
        is_user: false,
        mes: `AI ${aiOrdinal}`,
        TavernDB_ACU_IsolatedData: {
          '': {
            storageFrame: {
              version: 2,
              ...(aiOrdinal === 0
                ? {
                    checkpoint: {
                      kind: 'full',
                      createdAt: 1,
                      reason: 'init',
                      data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                    },
                  }
                : {}),
              logEntries: [],
            },
            _acu_storage_version: 2,
          },
        },
      });
    }
    mockGetChatArray.mockReturnValue(chat);

    await purgeOldLayerData_ACU();

    expect(chat).toHaveLength(25);
    expect(chat[0].TavernDB_ACU_IsolatedData).toBeUndefined();
    expect(chat[22].is_user).toBe(true);
    expect(chat[23].is_user).toBe(false);
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    expect(chat[24].TavernDB_ACU_IsolatedData).toBeDefined();
  });

  it('retainRecentLayers=0 时跳过', async () => {
    mockSettings.retainRecentLayers = 0;
    mockGetChatArray.mockReturnValue([]);
    await purgeOldLayerData_ACU();
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('数据层数不超过保留数时不清理', async () => {
    mockSettings.retainRecentLayers = 10;
    const chat = [
      { is_user: false },
      { is_user: false, TavernDB_ACU_Data: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);
    await purgeOldLayerData_ACU();
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });
});

// ═══ ensureV2BoundaryCheckpointForRetainedBuffer_ACU ═══
describe('ensureV2BoundaryCheckpointForRetainedBuffer_ACU', () => {
  it('手动入口在最新保留 AI 窗口首个 AI 楼层写入 full boundary checkpoint，且不删除旧楼层数据', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            ...(index === 0
              ? {
                  checkpoint: {
                    kind: 'full',
                    createdAt: 1,
                    reason: 'init',
                    data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                  },
                }
              : {}),
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: true, changed: true, anchorIndex: 23 }));
    expect(mockRunTableWriteTransaction).toHaveBeenCalledWith(expect.objectContaining({
      source: 'system_cleanup',
      reason: 'manual_refill_boundary_checkpoint',
      maintenanceMode: 'exclusive',
      writeSet: [{ kind: 'all' }],
    }), expect.any(Function));
    expect(chat[0].TavernDB_ACU_IsolatedData).toBeDefined();
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.data.sheet_0.content[1][1]).toBe('剑');
    expect(mockSaveChatToHost).toHaveBeenCalledTimes(1);
  });

  it('已有 anchor compaction full checkpoint 时跳过写入并不保存', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            checkpoint: index === 23
              ? { kind: 'full', createdAt: 2, reason: 'compaction', data: { sheet_0: { name: '已有', content: [['row_id']] } } }
              : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: true, changed: false, anchorIndex: 23 }));
    expect(mockLoadTableStateFromFramesV2).not.toHaveBeenCalled();
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('retained window 内已有非 compaction full 时仍写 anchor，并将旧 full 降级为 data_replace log', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            checkpoint: index === 24
              ? {
                  kind: 'full',
                  createdAt: 24,
                  reason: 'manual',
                  data: { sheet_0: { name: '最新旧快照', content: [['row_id', '物品名'], ['1', '盾']] } },
                }
              : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: true, changed: true, anchorIndex: 23 }));
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    const downgradedFrame = chat[24].TavernDB_ACU_IsolatedData[''].storageFrame;
    expect(downgradedFrame.checkpoint).toBeUndefined();
    expect(downgradedFrame.logEntries[0]).toEqual(expect.objectContaining({
      source: 'system',
      targetMessageIndex: 24,
      operations: [{ kind: 'data_replace', data: { sheet_0: { name: '最新旧快照', content: [['row_id', '物品名'], ['1', '盾']] } }, reason: 'checkpoint_fallback' }],
    }));
    expect(mockSaveChatToHost).toHaveBeenCalledTimes(1);
  });

  it('boundary checkpoint 恢复失败时不降级旧 full checkpoint 且不保存', async () => {
    mockSettings.retainRecentLayers = 2;
    mockLoadTableStateFromFramesV2.mockResolvedValueOnce(null);
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        '': {
          storageFrame: {
            version: 2,
            checkpoint: index === 0
              ? {
                  kind: 'full',
                  createdAt: 1,
                  reason: 'init',
                  data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                }
              : index === 24
                ? {
                    kind: 'full',
                    createdAt: 24,
                    reason: 'manual',
                    data: { sheet_0: { name: '旧手动快照', content: [['row_id', '物品名'], ['1', '盾']] } },
                  }
                : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: false, changed: false, anchorIndex: 23 }));
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toBeUndefined();
    expect(chat[24].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'manual',
    }));
    expect(chat[24].TavernDB_ACU_IsolatedData[''].storageFrame.logEntries).toEqual([]);
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('多 isolationKey 写入中途失败时不保存、不降级后续旧 full、不清理旧楼层', async () => {
    mockSettings.retainRecentLayers = 2;
    mockLoadTableStateFromFramesV2
      .mockResolvedValueOnce({ sheet_0: { name: '标签A', content: [['row_id'], ['1']] } })
      .mockResolvedValueOnce(null);
    const chat = Array.from({ length: 25 }, (_, index) => ({
      is_user: false,
      TavernDB_ACU_IsolatedData: {
        tag_A: {
          storageFrame: {
            version: 2,
            checkpoint: index === 0
              ? { kind: 'full', createdAt: 1, reason: 'init', data: { sheet_0: { name: '标签A旧基线', content: [['row_id']] } } }
              : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
        tag_B: {
          storageFrame: {
            version: 2,
            checkpoint: index === 0
              ? { kind: 'full', createdAt: 1, reason: 'init', data: { sheet_0: { name: '标签B旧基线', content: [['row_id']] } } }
              : index === 24
                ? { kind: 'full', createdAt: 24, reason: 'manual', data: { sheet_0: { name: '标签B手动快照', content: [['row_id'], ['b1']] } } }
                : undefined,
            logEntries: [],
          },
          _acu_storage_version: 2,
        },
      },
    }));
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: false, changed: false, anchorIndex: 23 }));
    expect(mockLoadTableStateFromFramesV2).toHaveBeenNthCalledWith(1, chat, 'tag_A', { maxMessageIndex: 23 });
    expect(mockLoadTableStateFromFramesV2).toHaveBeenNthCalledWith(2, chat, 'tag_B', { maxMessageIndex: 23 });
    expect(chat[23].TavernDB_ACU_IsolatedData.tag_A.storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    expect(chat[23].TavernDB_ACU_IsolatedData.tag_B.storageFrame.checkpoint).toBeUndefined();
    expect(chat[24].TavernDB_ACU_IsolatedData.tag_B.storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'manual',
    }));
    expect(chat[24].TavernDB_ACU_IsolatedData.tag_B.storageFrame.logEntries).toEqual([]);
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('user 消息不参与 AI 楼层计数，ensure anchor 写入第 21 个 AI 楼层对应的实际 chat index', async () => {
    mockSettings.retainRecentLayers = 2;
    const chat: any[] = [];
    for (let aiOrdinal = 0; aiOrdinal < 22; aiOrdinal++) {
      if (aiOrdinal === 5 || aiOrdinal === 12 || aiOrdinal === 20) {
        chat.push({ is_user: true, mes: `用户插入 ${aiOrdinal}` });
      }
      chat.push({
        is_user: false,
        mes: `AI ${aiOrdinal}`,
        TavernDB_ACU_IsolatedData: {
          '': {
            storageFrame: {
              version: 2,
              ...(aiOrdinal === 0
                ? {
                    checkpoint: {
                      kind: 'full',
                      createdAt: 1,
                      reason: 'init',
                      data: { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] } },
                    },
                  }
                : {}),
              logEntries: [],
            },
            _acu_storage_version: 2,
          },
        },
      });
    }
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureV2BoundaryCheckpointForRetainedBuffer_ACU({ reason: 'manual_refill', save: true });

    expect(result).toEqual(expect.objectContaining({ success: true, changed: true, anchorIndex: 23 }));
    expect(chat).toHaveLength(25);
    expect(chat[0].TavernDB_ACU_IsolatedData).toBeDefined();
    expect(chat[22].is_user).toBe(true);
    expect(chat[23].is_user).toBe(false);
    expect(chat[23].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toEqual(expect.objectContaining({
      kind: 'full',
      reason: 'compaction',
    }));
    expect(mockSaveChatToHost).toHaveBeenCalledTimes(1);
  });
});


// ═══ deleteLocalDataInChatCore_ACU ═══
describe('deleteLocalDataInChatCore_ACU', () => {
  it('mode=all 删除所有数据', async () => {
    const chat = [
      { is_user: true },
      { is_user: false, TavernDB_ACU_Data: { sheet_0: {} }, TavernDB_ACU_SummaryData: {} },
      { is_user: false, TavernDB_ACU_Data: { sheet_0: {} } },
    ];
    mockGetChatArray.mockReturnValue(chat);
    const count = await deleteLocalDataInChatCore_ACU('all');
    expect(count).toBe(2);
    expect(chat[1].TavernDB_ACU_Data).toBeUndefined();
    expect(chat[2].TavernDB_ACU_Data).toBeUndefined();
  });

  it('空聊天记录返回 0', async () => {
    mockGetChatArray.mockReturnValue([]);
    const count = await deleteLocalDataInChatCore_ACU('all');
    expect(count).toBe(0);
  });

  it('mode=current 只删除当前隔离标签的数据', async () => {
    mockSettings.dataIsolationEnabled = true;
    mockSettings.dataIsolationCode = 'tag_A';
    mockGetCurrentIsolationKey.mockReturnValue('tag_A');
    const chat = [
      { is_user: false, TavernDB_ACU_Data: {}, TavernDB_ACU_Identity: 'tag_A', TavernDB_ACU_IsolatedData: { tag_A: { independentData: {} } } },
      { is_user: false, TavernDB_ACU_Data: {}, TavernDB_ACU_Identity: 'tag_B' },
    ];
    mockGetChatArray.mockReturnValue(chat);
    const count = await deleteLocalDataInChatCore_ACU('current');
    expect(count).toBe(1);
  });

  it('mode=current 删除无旧版 Identity 的 V2 当前隔离槽', async () => {
    mockSettings.dataIsolationEnabled = true;
    mockSettings.dataIsolationCode = 'tag_A';
    mockGetCurrentIsolationKey.mockReturnValue('tag_A');
    const chat = [
      { is_user: false, TavernDB_ACU_IsolatedData: { tag_A: { storageFrame: { version: 2, checkpoint: { kind: 'full', data: {} }, logEntries: [] }, _acu_storage_version: 2 }, tag_B: { independentData: {} } } },
      { is_user: false, TavernDB_ACU_IsolatedData: { tag_B: { independentData: {} } } },
    ];
    mockGetChatArray.mockReturnValue(chat);

    const count = await deleteLocalDataInChatCore_ACU('current');

    expect(count).toBe(1);
    expect(chat[0].TavernDB_ACU_IsolatedData.tag_A).toBeUndefined();
    expect(chat[0].TavernDB_ACU_IsolatedData.tag_B).toBeDefined();
    expect(chat[1].TavernDB_ACU_IsolatedData.tag_B).toBeDefined();
  });

  it('指定楼层范围', async () => {
    const chat = [
      { is_user: false, TavernDB_ACU_Data: {} }, // AI楼层1
      { is_user: false, TavernDB_ACU_Data: {} }, // AI楼层2
      { is_user: false, TavernDB_ACU_Data: {} }, // AI楼层3
    ];
    mockGetChatArray.mockReturnValue(chat);
    const count = await deleteLocalDataInChatCore_ACU('all', 1, 2);
    expect(count).toBe(2);
    expect(chat[2].TavernDB_ACU_Data).toBeDefined(); // 第3层不在范围内
  });
});

// ═══ overrideLatestLayerWithTemplateCore_ACU ═══
describe('overrideLatestLayerWithTemplateCore_ACU', () => {
  it('用模板覆盖最新层', async () => {
    const chat = [
      { is_user: true },
      { is_user: false, TavernDB_ACU_IsolatedData: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);
    const templateData = {
      sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑'], ['2', '盾']] },
    };
    const count = await overrideLatestLayerWithTemplateCore_ACU(templateData);
    expect(count).toBe(1);
    expect(mockPersistTablesToChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      targetMessageIndex: 1,
      targetSheetKeys: ['sheet_0'],
      source: 'system',
    }));
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('空聊天记录返回 0', async () => {
    mockGetChatArray.mockReturnValue([]);
    const count = await overrideLatestLayerWithTemplateCore_ACU({ sheet_0: { name: '表' } });
    expect(count).toBe(0);
  });

  it('无 AI 消息返回 0', async () => {
    mockGetChatArray.mockReturnValue([{ is_user: true }]);
    const count = await overrideLatestLayerWithTemplateCore_ACU({ sheet_0: { name: '表' } });
    expect(count).toBe(0);
  });

  it('覆盖后只保留表头', async () => {
    const chat = [{ is_user: false }];
    mockGetChatArray.mockReturnValue(chat);
    const templateData = {
      sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑'], ['2', '盾']] },
    };
    await overrideLatestLayerWithTemplateCore_ACU(templateData);
    const call = mockPersistTablesToChatMessage.mock.calls[0]?.[0];
    expect(call.operations[0].kind).toBe('sheet_replace');
    expect(call.operations[0].sheet.content.length).toBe(1); // 只有表头
    expect(chat[0].TavernDB_ACU_IsolatedData).toBeUndefined();
  });
});

// ═══ saveCurrentDataForTable_ACU ═══
describe('saveCurrentDataForTable_ACU', () => {
  beforeEach(() => {
    mockPersistTablesToChatMessage.mockClear();
  });

  it('无数据时不报错', async () => {
    mockCurrentJsonTableData.sheet_0 = undefined;
    await expect(saveCurrentDataForTable_ACU('sheet_0')).resolves.not.toThrow();
    expect(mockPersistTablesToChatMessage).not.toHaveBeenCalled();
  });
  it('无聊天记录时不报错', async () => {
    mockGetChatArray.mockReturnValue([]);
    await expect(saveCurrentDataForTable_ACU('sheet_0')).resolves.not.toThrow();
    expect(mockPersistTablesToChatMessage).not.toHaveBeenCalled();
  });
  it('聊天记录全为 user 消息时不调用持久化', async () => {
    const chat = [{ is_user: true, mes: '用户消息' }];
    mockGetChatArray.mockReturnValue(chat);
    mockCurrentJsonTableData.sheet_0 = { name: '物品表', content: [] };
    await saveCurrentDataForTable_ACU('sheet_0');
    expect(mockPersistTablesToChatMessage).not.toHaveBeenCalled();
  });
  it('标准表调用 persistTablesToChatMessage_ACU 持久化', async () => {
    const chat = [{ is_user: false, mes: 'AI回复' }];
    mockGetChatArray.mockReturnValue(chat);
    mockCurrentJsonTableData.sheet_0 = { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] };
    await saveCurrentDataForTable_ACU('sheet_0');
    expect(mockPersistTablesToChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      targetMessageIndex: 0,
      targetSheetKeys: ['sheet_0'],
      updateGroupKeys: null,
      trackAsUpdate: true
    }));
  });
  it('存在历史数据时 trackAsUpdate 为 false 且指向历史数据楼层', async () => {
    const chat = [
      { is_user: false, mes: '旧AI回复', TavernDB_ACU_IsolatedData: { '': { independentData: { sheet_0: { name: '物品表' } } } } },
      { is_user: true, mes: '用户新消息' },
      { is_user: false, mes: '新AI回复' }
    ];
    mockGetChatArray.mockReturnValue(chat);
    mockCurrentJsonTableData.sheet_0 = { name: '物品表', content: [] };
    await saveCurrentDataForTable_ACU('sheet_0');
    expect(mockPersistTablesToChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      targetMessageIndex: 0,
      targetSheetKeys: ['sheet_0'],
      trackAsUpdate: false
    }));
  });
  it('纪要表调用 persistTablesToChatMessage_ACU 持久化', async () => {
    const chat = [{ is_user: false, mes: 'AI回复' }];
    mockGetChatArray.mockReturnValue(chat);
    mockCurrentJsonTableData.sheet_1 = { name: '纪要表', content: [['row_id', '事件'], ['1', '开始']] };
    await saveCurrentDataForTable_ACU('sheet_1');
    expect(mockPersistTablesToChatMessage).toHaveBeenCalledWith(expect.objectContaining({
      targetMessageIndex: 0,
      targetSheetKeys: ['sheet_1'],
      updateGroupKeys: null,
      trackAsUpdate: true
    }));
  });
});

// ═══ ensureManualRefillInitialBaseline_ACU ═══
describe('ensureManualRefillInitialBaseline_ACU', () => {
  const makeV2FullMessage = (reason: string | undefined, data: any, logEntries: any[] = [], createdAt = 1) => ({
    is_user: false,
    TavernDB_ACU_IsolatedData: {
      '': {
        _acu_storage_version: 2,
        storageFrame: {
          version: 2,
          logEntries,
          checkpoint: {
            kind: 'full',
            reason,
            createdAt,
            data,
          },
        },
      },
    },
  });

  it('已有更晚 init checkpoint 时，将手动重填 initial baseline 前移到目标楼层并降级旧 checkpoint', async () => {
    const baselineData = {
      sheet_0: { name: '物品表', content: [['row_id', '物品名']] },
    };
    const laterData = {
      sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '剑']] },
    };
    const chat = [
      { is_user: false, TavernDB_ACU_IsolatedData: {} },
      { is_user: true },
      makeV2FullMessage('init', laterData, [], 11),
    ];
    mockGetChatArray.mockReturnValue(chat);
    mockCollectScheduleSummaryFromFramesV2.mockReturnValue({ schedules: ['s1'] });

    const result = await ensureManualRefillInitialBaseline_ACU({
      isolationKey: '',
      targetMessageIndex: 0,
      data: baselineData,
    });

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.targetMessageIndex).toBe(0);
    expect(result.movedFromMessageIndex).toBe(2);
    expect(result.downgradedCount).toBe(1);
    const targetFrame = chat[0].TavernDB_ACU_IsolatedData[''].storageFrame;
    expect(targetFrame.checkpoint.reason).toBe('init');
    expect(targetFrame.checkpoint.data).toEqual(baselineData);
    expect(targetFrame.checkpoint.scheduleSummary).toEqual({ schedules: ['s1'] });
    const oldFrame = chat[2].TavernDB_ACU_IsolatedData[''].storageFrame;
    expect(oldFrame.checkpoint).toBeUndefined();
    expect(oldFrame.logEntries[0].operations[0]).toEqual({ kind: 'data_replace', data: laterData, reason:'checkpoint_fallback' });
    expect(mockSaveChatToHost).toHaveBeenCalledTimes(1);
  });

  it('目标楼层已有 V2 logEntries 时拒绝覆盖并返回错误', async () => {
    const chat = [
      {
        is_user: false,
        TavernDB_ACU_IsolatedData: {
          '': {
            _acu_storage_version: 2,
            storageFrame: { version: 2, logEntries: [{ seq: 1 }], checkpoint: undefined },
          },
        },
      },
      makeV2FullMessage('init', { sheet_0: { name: '物品表', content: [['row_id', '物品名']] } }, [], 12),
    ];
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureManualRefillInitialBaseline_ACU({
      isolationKey: '',
      targetMessageIndex: 0,
      data: { sheet_0: { name: '物品表', content: [['row_id', '物品名']] } },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('已存在 V2 logEntries');
    expect(mockSaveChatToHost).not.toHaveBeenCalled();
  });

  it('存在 compaction checkpoint 时只降级 compaction 之前的 obsolete init，不前移 baseline', async () => {
    const oldInitData = { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['1', '旧']] } };
    const compactedData = { sheet_0: { name: '物品表', content: [['row_id', '物品名'], ['2', '压缩后']] } };
    const chat = [
      makeV2FullMessage('init', oldInitData, [], 1),
      { is_user: true },
      makeV2FullMessage('compaction', compactedData, [], 2),
      { is_user: false, TavernDB_ACU_IsolatedData: {} },
    ];
    mockGetChatArray.mockReturnValue(chat);

    const result = await ensureManualRefillInitialBaseline_ACU({
      isolationKey: '',
      targetMessageIndex: 3,
      data: { sheet_0: { name: '物品表', content: [['row_id', '物品名']] } },
    });

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(result.downgradedCount).toBe(1);
    expect(chat[0].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint).toBeUndefined();
    expect(chat[0].TavernDB_ACU_IsolatedData[''].storageFrame.logEntries[0].operations[0].data).toEqual(oldInitData);
    expect(chat[2].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.reason).toBe('compaction');
    expect(chat[3].TavernDB_ACU_IsolatedData).toEqual({});
    expect(mockSaveChatToHost).toHaveBeenCalledTimes(1);
  });

  it('存在非 init full checkpoint 时跳过，不破坏恢复链', async () => {
    for (const reason of ['import', 'migration', 'schema_change', 'manual', undefined]) {
      vi.clearAllMocks();
      mockRunTableWriteTransaction.mockImplementation(async (_options: any, task: any) => task());
      const chat = [
        { is_user: false, TavernDB_ACU_IsolatedData: {} },
        makeV2FullMessage(reason, { sheet_0: { name: '物品表', content: [['row_id', '物品名']] } }, [], 30),
      ];
      mockGetChatArray.mockReturnValue(chat);

      const result = await ensureManualRefillInitialBaseline_ACU({
        isolationKey: '',
        targetMessageIndex: 0,
        data: { sheet_0: { name: '物品表', content: [['row_id', '物品名']] } },
      });

      expect(result.success).toBe(true);
      expect(result.changed).toBe(false);
      expect(result.skipped).toBe(true);
      expect(chat[0].TavernDB_ACU_IsolatedData).toEqual({});
      expect(chat[1].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.reason).toBe(reason);
      expect(chat[1].TavernDB_ACU_IsolatedData[''].storageFrame.checkpoint.createdAt).toBe(30);
      expect(mockSaveChatToHost).not.toHaveBeenCalled();
    }
  });
});
