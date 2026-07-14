/**
 * tests/service/vector/summary-vector-index-hydrate-gating.test.ts
 * 改动点 3 回归测试：hydrate 聚合快照时，只有"最新层"和"内容寻址旧层"联网加载外置分片，
 * rolling 旧层（悬空 base 指针来源）不再逐层联网，消除 O(楼层数) 404 刷屏。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockChat,
  mockCurrentJsonTableDataRef,
  mockCreateEmbeddings,
  mockPersistSummaryVectorIndexSnapshot,
  mockLoadChunksFromManifest,
  mockReadIsolatedTagData,
  mockWriteIsolatedTagData,
  mockSaveChatToHost,
} = vi.hoisted(() => {
  const mockChat = [] as any[];
  const mockCurrentJsonTableDataRef = { value: {} as any };
  return {
    mockChat,
    mockCurrentJsonTableDataRef,
    mockCreateEmbeddings: vi.fn(),
    mockPersistSummaryVectorIndexSnapshot: vi.fn(),
    mockLoadChunksFromManifest: vi.fn(async () => [] as any[]),
    mockReadIsolatedTagData: vi.fn((message: any, isolationKey: string) => message?.TavernDB_ACU_IsolatedData?.[isolationKey || ''] || null),
    mockWriteIsolatedTagData: vi.fn(),
    mockSaveChatToHost: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock('../../../src/service/runtime/state-manager', () => ({
  get currentJsonTableData_ACU() { return mockCurrentJsonTableDataRef.value; },
  currentChatFileIdentifier_ACU: 'test-chat',
  getCurrentIsolationKey_ACU: vi.fn(() => ''),
  settings_ACU: { dataIsolationEnabled: false, dataIsolationCode: '' },
}));

vi.mock('../../../src/service/chat/chat-service', () => ({
  getChatArray_ACU: vi.fn(() => mockChat),
}));

vi.mock('../../../src/data/gateways/chat-gateway', () => ({
  saveChatToHost_ACU: mockSaveChatToHost,
}));

vi.mock('../../../src/data/gateways/vector-embedding-gateway', () => ({
  createEmbeddings_ACU: (...args: any[]) => mockCreateEmbeddings(...args),
}));

vi.mock('../../../src/service/vector/vector-memory-config', () => ({
  getEffectiveSummaryVectorIndexConfig_ACU: vi.fn(() => ({
    embeddingEndpoint: 'https://embedding.test',
    embeddingApiKey: 'test-key',
    embeddingModel: 'test-model',
    summaryIndexChunkSentenceCount: 1,
    summaryIndexArchiveMaxConcurrency: 10,
    threshold: 1,
    archiveTriggerCount: 1,
    archiveBatchSize: 1,
    archiveMaxConcurrency: 1,
    topK: 1,
    minScore: 0,
    recallCandidateLimit: 1,
    summaryPromptGroupId: 'summary',
    entryComment: 'entry',
    entryKey: 'key',
  })),
  validateSummaryVectorIndexConfig_ACU: vi.fn(() => ({ valid: true, errors: [] })),
}));

vi.mock('../../../src/service/vector/summary-vector-index-storage-service', () => ({
  loadSummaryVectorIndexChunksFromManifest_ACU: mockLoadChunksFromManifest,
  persistSummaryVectorIndexSnapshot_ACU: (...args: any[]) => mockPersistSummaryVectorIndexSnapshot(...args),
  deleteSummaryVectorIndexExternal_ACU: vi.fn(),
  isLegacySummaryVectorIndexManifest_ACU: vi.fn(() => false),
  normalizeSummaryVectorIndexManifestForRead_ACU: vi.fn((manifest: any) => manifest),
}));

vi.mock('../../../src/data/repositories/chat-message-data-repo', () => ({
  cloneIsolatedData_ACU: vi.fn((message: any) => JSON.parse(JSON.stringify(message?.TavernDB_ACU_IsolatedData || {}))),
  readIsolatedTagData_ACU: mockReadIsolatedTagData,
  writeIsolatedTagData_ACU: (...args: any[]) => mockWriteIsolatedTagData(...args),
  writeMessageIdentity_ACU: vi.fn(),
  writeLegacyCompatData_ACU: vi.fn(),
}));

import { archiveSummaryVectorIndexNow_ACU } from '../../../src/service/vector/summary-vector-index-archive-service';

function buildLayerState(indexId: string, options: { contentAddressed?: boolean } = {}): any {
  return {
    summaryVectorIndexState: {
      version: 1,
      backend: 'st-files',
      status: 'ready',
      indexId,
      snapshotMessageId: `msg-${indexId}`,
      sourceTableKey: 'sheet_summary',
      sourceTableName: '纪要表',
      indexedAt: '2026-07-14T00:00:00.000Z',
      rowCount: 1,
      chunkCount: 1,
      rows: [{
        rowKey: `r-${indexId}`,
        rowId: '1',
        rowOrder: 0,
        timeSpan: '上午',
        location: '甲地',
        summary: `事件 ${indexId}。`,
        indexCode: 'AM-0001',
        vectorSourceText: `事件 ${indexId}。`,
        chunkIds: [`c-${indexId}`],
      }],
      manifest: {
        version: 1,
        backend: 'st-files',
        status: 'ready',
        indexId,
        chatKey: 'test-chat',
        isolationKey: '',
        snapshotMessageId: `msg-${indexId}`,
        sourceTableKey: 'sheet_summary',
        sourceTableName: '纪要表',
        indexedAt: '2026-07-14T00:00:00.000Z',
        rowCount: 1,
        chunkCount: 1,
        snapshot: {
          mode: 'base_rolling_delta',
          revision: 1,
          activeRowKeys: [`r-${indexId}`],
          activeChunkIds: [`c-${indexId}`],
        },
        batchRefs: [{
          role: 'base',
          batchId: 'base_1',
          indexId,
          status: 'ready',
          rowKeys: [`r-${indexId}`],
          chunkIds: [`c-${indexId}`],
          files: [{ role: 'base_shard', path: `vec/${indexId}_base_0001.json`, shardId: 'base_0001', status: 'ready' }],
        }],
        files: [],
        ...(options.contentAddressed
          ? { contentAddressed: { mode: 'content_addressed_chunks', chunkRefs: [{ path: `vec/${indexId}_chunk_1.json`, chunkKey: `key-${indexId}` }], activeChunkKeys: [`key-${indexId}`] } }
          : {}),
      },
    },
  };
}

function loadedManifestIndexIds(): string[] {
  return mockLoadChunksFromManifest.mock.calls.map(([manifest]: any[]) => manifest?.indexId);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockChat.length = 0;
  mockCurrentJsonTableDataRef.value = {
    sheet_summary: {
      name: '纪要表',
      content: [
        ['row_id', '时间跨度', '地点', '概要', '编码索引'],
        ['1', '上午', '甲地', '第一次事件。', 'AM-0001'],
      ],
    },
  };
  mockCreateEmbeddings.mockImplementation(async (request: any) => request.input.map((_: string, index: number) => ({ index, embedding: [index + 1, index + 2] })));
  mockLoadChunksFromManifest.mockImplementation(async () => []);
});

describe('hydrate 层级门控（改动点 3）', () => {
  it('rolling 旧层不联网加载外置分片，最新层始终联网', async () => {
    mockChat.push(
      { is_user: false, mes: 'AI-1', id: 'm0', TavernDB_ACU_IsolatedData: { '': buildLayerState('idx-old') } },
      { is_user: false, mes: 'AI-2', id: 'm1', TavernDB_ACU_IsolatedData: { '': buildLayerState('idx-new') } },
    );

    await archiveSummaryVectorIndexNow_ACU({ targetMessageIndex: 1, vectorizeOnly: true, force: true });

    const loadedIds = loadedManifestIndexIds();
    expect(loadedIds).toContain('idx-new');
    expect(loadedIds).not.toContain('idx-old');
  });

  it('内容寻址旧层仍联网加载（不被跳过）', async () => {
    mockChat.push(
      { is_user: false, mes: 'AI-1', id: 'm0', TavernDB_ACU_IsolatedData: { '': buildLayerState('idx-old-ca', { contentAddressed: true }) } },
      { is_user: false, mes: 'AI-2', id: 'm1', TavernDB_ACU_IsolatedData: { '': buildLayerState('idx-new') } },
    );

    await archiveSummaryVectorIndexNow_ACU({ targetMessageIndex: 1, vectorizeOnly: true, force: true });

    const loadedIds = loadedManifestIndexIds();
    expect(loadedIds).toContain('idx-new');
    expect(loadedIds).toContain('idx-old-ca');
  });
});
