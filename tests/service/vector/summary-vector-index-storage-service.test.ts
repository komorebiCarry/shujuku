/**
 * tests/service/vector/summary-vector-index-storage-service.test.ts
 * 交火向量索引 base 404 死锁修复单元测试：
 *  - 改动点 2：读分片遇 404 记录路径并短路后续网络重试
 *  - 改动点 1：复用 base 分片确认缺失时强制折叠（不受 15 条阈值限制）
 *  - 改动点 4：折叠时 base 按块数上限拆多分片写入
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  missingPaths,
  mockRead,
  mockUpload,
  mockGetCachedShard,
} = vi.hoisted(() => {
  const missingPaths = new Set<string>();
  return {
    missingPaths,
    mockRead: vi.fn(),
    mockUpload: vi.fn(async (params: any) => {
      missingPaths.delete(params.path);
      return {
        ok: true,
        ref: {
          role: params.role,
          path: params.path,
          shardId: params.shardId,
          byteSize: 16,
          checksum: `ck-${params.path}`,
          chunkCount: params.chunkCount,
          rowCount: params.rowCount,
          createdAt: '2026-07-14T00:00:00.000Z',
          updatedAt: '2026-07-14T00:00:00.000Z',
          status: params.status || 'ready',
        },
      };
    }),
    mockGetCachedShard: vi.fn(async () => null),
  };
});

vi.mock('../../../src/data/storage/vector-index-st-files-storage', () => ({
  buildVectorIndexFileName_ACU: vi.fn((p: any) => `vec/${p.indexId}_${p.role}${p.shardId ? `_${p.shardId}` : ''}.json`),
  buildVectorIndexSingleSnapshotFilePath_ACU: vi.fn(() => 'vec/single_snapshot.json'),
  buildVectorIndexSnapshotFilePath_ACU: vi.fn(() => 'vec/snapshot.json'),
  buildVectorIndexStableDirectory_ACU: vi.fn(() => 'vec'),
  buildVectorIndexStableFilePath_ACU: vi.fn(() => 'vec/stable.json'),
  deleteRegisteredVectorIndexFilesWhere_ACU: vi.fn(async () => 0),
  deleteVectorIndexFile_ACU: vi.fn(async (path: string) => ({ ok: true, path })),
  isVectorIndexFilePathConfirmedMissing_ACU: (path: string) => missingPaths.has(path),
  loadVectorIndexRegistry_ACU: vi.fn(async () => ({ version: 1, files: [] })),
  markVectorIndexFilePathConfirmedMissing_ACU: (path: string) => { missingPaths.add(path); },
  readVectorIndexJsonFile_ACU: (...args: any[]) => mockRead(...args),
  registerVectorIndexFiles_ACU: vi.fn(async () => undefined),
  sha256Text_ACU: vi.fn(async (text: string) => `sha-${String(text).length}`),
  unregisterVectorIndexFiles_ACU: vi.fn(async () => undefined),
  uploadVectorIndexJsonFile_ACU: mockUpload,
}));

vi.mock('../../../src/data/storage/vector-index-temp-cache', () => ({
  deleteVectorIndexCacheByIndex_ACU: vi.fn(async () => undefined),
  estimateVectorIndexTempCache_ACU: vi.fn(async () => ({ count: 0, bytes: 0 })),
  getVectorIndexCachedShard_ACU: mockGetCachedShard,
  putVectorIndexCachedShard_ACU: vi.fn(async () => undefined),
}));

vi.mock('../../../src/data/storage/vector-index-hot-cache', () => ({
  deleteSummaryVectorHotCacheByIndex_ACU: vi.fn(async () => undefined),
  estimateSummaryVectorFlushTasks_ACU: vi.fn(async () => 0),
  estimateSummaryVectorHotCache_ACU: vi.fn(async () => ({ count: 0, bytes: 0 })),
  getSummaryVectorHotCacheChunks_ACU: vi.fn(async () => null),
  putSummaryVectorHotCacheChunks_ACU: vi.fn(async () => undefined),
}));

vi.mock('../../../src/service/runtime/state-manager', () => ({
  getCurrentIsolationKey_ACU: vi.fn(() => 'default'),
  currentChatFileIdentifier_ACU: 'test-chat',
}));

vi.mock('../../../src/shared/template-preset-utils', () => ({
  getCurrentCharacterCardName_ACU: vi.fn(() => 'TestChar'),
}));

vi.mock('../../../src/service/vector/summary-vector-index-state-service', () => ({
  getAggregatedSummaryVectorIndexSnapshot_ACU: vi.fn(() => null),
}));

vi.mock('../../../src/service/vector/vector-memory-config', () => ({
  getEffectiveSummaryVectorIndexConfig_ACU: vi.fn(() => ({
    summaryIndexRollingDeltaEnabled: true,
    summaryIndexRollingDeltaFoldThreshold: 15,
  })),
}));

import {
  loadSummaryVectorIndexChunksFromManifest_ACU,
  persistSummaryVectorIndexSnapshot_ACU,
} from '../../../src/service/vector/summary-vector-index-storage-service';

const BASE_SHARD_PATH = 'vec/idx-prev_base_shard_base_0001.json';

function buildRollingManifest(): any {
  return {
    version: 1,
    backend: 'st-files',
    status: 'ready',
    indexId: 'idx-prev',
    chatKey: 'test-chat',
    isolationKey: 'default',
    snapshotMessageId: 'msg-1',
    sourceTableKey: 'sheet_summary',
    sourceTableName: '纪要表',
    indexedAt: '2026-07-14T00:00:00.000Z',
    rowCount: 1,
    chunkCount: 1,
    snapshot: {
      mode: 'base_rolling_delta',
      revision: 2,
      activeRowKeys: ['r1'],
      activeChunkIds: ['c1'],
      removedRowKeys: [],
      replacedRowKeys: [],
    },
    batchRefs: [
      {
        role: 'base',
        batchId: 'base_2',
        indexId: 'idx-prev',
        status: 'ready',
        rowKeys: ['r1'],
        chunkIds: ['c1'],
        files: [
          {
            role: 'base_shard',
            path: BASE_SHARD_PATH,
            shardId: 'base_0001',
            byteSize: 16,
            status: 'ready',
          },
        ],
      },
    ],
    files: [],
  };
}

function buildPersistOptions(overrides: Record<string, any> = {}): any {
  return {
    chatKey: 'test-chat',
    isolationKey: 'default',
    previousManifest: buildRollingManifest(),
    rows: [{
      rowKey: 'r1',
      rowId: '1',
      rowOrder: 0,
      timeSpan: '上午',
      location: '甲地',
      summary: '第一次事件。',
      indexCode: 'AM-0001',
      vectorSourceText: '第一次事件。',
      chunkIds: ['c1'],
    }],
    chunks: [{
      chunkId: 'c1',
      rowKey: 'r1',
      text: '第一次事件。',
      vector: [0.1, 0.2],
      sequence: 0,
    }],
    snapshotMessageId: 'msg-1',
    sourceTableKey: 'sheet_summary',
    sourceTableName: '纪要表',
    indexedAt: '2026-07-14T01:00:00.000Z',
    skippedRowCount: 0,
    embeddingModel: 'test-model',
    snapshotRevision: 2,
    ...overrides,
  };
}

function uploadedRoles(): string[] {
  return mockUpload.mock.calls.map(([params]: any[]) => params.role);
}

beforeEach(() => {
  vi.clearAllMocks();
  missingPaths.clear();
  mockGetCachedShard.mockResolvedValue(null);
});

describe('改动点 2：分片 404 记录与短路', () => {
  it('读分片返回 404 时记录路径，且同会话第二次读取直接短路不再联网', async () => {
    mockRead.mockResolvedValue({ ok: false, status: 404, error: '读取失败 404: Not Found' });
    const manifest = buildRollingManifest();

    await expect(loadSummaryVectorIndexChunksFromManifest_ACU(manifest))
      .rejects.toThrow(/交火向量索引分片读取失败/);
    expect(missingPaths.has(BASE_SHARD_PATH)).toBe(true);
    expect(mockRead).toHaveBeenCalledTimes(1);

    await expect(loadSummaryVectorIndexChunksFromManifest_ACU(manifest))
      .rejects.toThrow(/已确认缺失\(404\)/);
    expect(mockRead).toHaveBeenCalledTimes(1); // 未再次联网
  });

  it('非 404 的读取失败（如瞬时 500）不记录缺失，避免误触发强制折叠', async () => {
    mockRead.mockResolvedValue({ ok: false, status: 500, error: '读取失败 500: Internal Server Error' });
    const manifest = buildRollingManifest();

    await expect(loadSummaryVectorIndexChunksFromManifest_ACU(manifest))
      .rejects.toThrow(/交火向量索引分片读取失败/);
    expect(missingPaths.has(BASE_SHARD_PATH)).toBe(false);
  });
});

describe('改动点 1：base 确认缺失时强制折叠', () => {
  it('base 完好且无变动行时不折叠（复用旧 base，不重写 base 分片）', async () => {
    const result = await persistSummaryVectorIndexSnapshot_ACU(buildPersistOptions());
    expect(uploadedRoles()).not.toContain('base_shard');
    expect(result.manifest.snapshot?.mode).toBe('base_rolling_delta');
  });

  it('base 分片已确认缺失(404)时，即使变动行数远低于阈值也强制折叠重写 base', async () => {
    missingPaths.add(BASE_SHARD_PATH);
    const result = await persistSummaryVectorIndexSnapshot_ACU(buildPersistOptions());
    expect(uploadedRoles()).toContain('base_shard');
    // 折叠后新 base 上传成功，路径从缺失集合移除（上传成功分支）
    const baseUpload = mockUpload.mock.calls.find(([params]: any[]) => params.role === 'base_shard');
    expect(baseUpload).toBeTruthy();
    expect(result.manifest.batchRefs?.some((batch: any) => batch.role === 'base' && batch.files.some((file: any) => file.role === 'base_shard'))).toBe(true);
  });

  it('闭环：先读 404（记录缺失）→ 随后归档强制折叠自愈', async () => {
    mockRead.mockResolvedValue({ ok: false, status: 404, error: '读取失败 404: Not Found' });
    await expect(loadSummaryVectorIndexChunksFromManifest_ACU(buildRollingManifest())).rejects.toThrow();
    expect(missingPaths.has(BASE_SHARD_PATH)).toBe(true);

    await persistSummaryVectorIndexSnapshot_ACU(buildPersistOptions());
    expect(uploadedRoles()).toContain('base_shard');
    // 新 base 上传成功后，其路径不在缺失集合中
    const uploadedBasePaths = mockUpload.mock.calls
      .filter(([params]: any[]) => params.role === 'base_shard')
      .map(([params]: any[]) => params.path);
    uploadedBasePaths.forEach((path: string) => expect(missingPaths.has(path)).toBe(false));
  });
});

describe('改动点 4：折叠时 base 多分片写入', () => {
  it('base chunks 超过 128 块时拆为 base_0001/base_0002 多分片', async () => {
    const rowCount = 130;
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      rowKey: `r${index + 1}`,
      rowId: String(index + 1),
      rowOrder: index,
      timeSpan: '上午',
      location: '甲地',
      summary: `事件 ${index + 1}。`,
      indexCode: `AM-${index + 1}`,
      vectorSourceText: `事件 ${index + 1}。`,
      chunkIds: [`c${index + 1}`],
    }));
    const chunks = rows.map((row, index) => ({
      chunkId: `c${index + 1}`,
      rowKey: row.rowKey,
      text: row.summary,
      vector: [0.1, 0.2],
      sequence: index,
    }));

    await persistSummaryVectorIndexSnapshot_ACU(buildPersistOptions({
      previousManifest: null, // 无可复用 base → 必然折叠
      rows,
      chunks,
    }));

    const baseShardIds = mockUpload.mock.calls
      .filter(([params]: any[]) => params.role === 'base_shard')
      .map(([params]: any[]) => params.shardId);
    expect(baseShardIds).toEqual(['base_0001', 'base_0002']);
    const baseChunkCounts = mockUpload.mock.calls
      .filter(([params]: any[]) => params.role === 'base_shard')
      .map(([params]: any[]) => params.chunkCount);
    expect(baseChunkCounts).toEqual([128, 2]);
  });
});
