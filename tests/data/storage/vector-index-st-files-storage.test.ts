/**
 * tests/data/storage/vector-index-st-files-storage.test.ts
 * 真实模块测试：会话级"已确认缺失(404)"路径集合与读/写行为
 *  - readVectorIndexJsonFile_ACU 对 HTTP 失败返回 status（404 判定依据）
 *  - mark/is 缺失集合语义
 *  - uploadVectorIndexJsonFile_ACU 成功后将路径从缺失集合移除
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/shared/host-api', () => ({
  SillyTavern_API_ACU: {},
}));

import {
  isVectorIndexFilePathConfirmedMissing_ACU,
  markVectorIndexFilePathConfirmedMissing_ACU,
  readVectorIndexJsonFile_ACU,
  uploadVectorIndexJsonFile_ACU,
} from '../../../src/data/storage/vector-index-st-files-storage';

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readVectorIndexJsonFile_ACU', () => {
  it('HTTP 404 时返回 ok=false 且 status=404', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });
    const result = await readVectorIndexJsonFile_ACU('vec/missing.json');
    expect(result.ok).toBe(false);
    expect(result.status).toBe(404);
    expect(result.error).toContain('404');
  });

  it('网络异常（无响应）时返回 ok=false 且无 status', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const result = await readVectorIndexJsonFile_ACU('vec/unreachable.json');
    expect(result.ok).toBe(false);
    expect(result.status).toBeUndefined();
  });
});

describe('已确认缺失(404)路径集合', () => {
  it('mark 后 is 返回 true，未 mark 的路径返回 false；空路径不记录', () => {
    const path = `vec/case-mark-${Date.now()}.json`;
    expect(isVectorIndexFilePathConfirmedMissing_ACU(path)).toBe(false);
    markVectorIndexFilePathConfirmedMissing_ACU(path);
    expect(isVectorIndexFilePathConfirmedMissing_ACU(path)).toBe(true);
    expect(isVectorIndexFilePathConfirmedMissing_ACU('vec/other.json')).toBe(false);
    markVectorIndexFilePathConfirmedMissing_ACU('');
    expect(isVectorIndexFilePathConfirmedMissing_ACU('')).toBe(false);
  });

  it('上传成功后路径从缺失集合移除', async () => {
    const path = `vec/case-upload-${Date.now()}.json`;
    markVectorIndexFilePathConfirmedMissing_ACU(path);
    expect(isVectorIndexFilePathConfirmedMissing_ACU(path)).toBe(true);

    mockFetch.mockResolvedValue({ ok: true });
    const result = await uploadVectorIndexJsonFile_ACU({
      path,
      role: 'base_shard',
      shardId: 'base_0001',
      data: { hello: 'world' },
      chunkCount: 1,
      status: 'ready',
    });
    expect(result.ok).toBe(true);
    expect(result.ref?.path).toBe(path);
    expect(isVectorIndexFilePathConfirmedMissing_ACU(path)).toBe(false);
  });

  it('上传失败时路径仍保留在缺失集合中', async () => {
    const path = `vec/case-upload-fail-${Date.now()}.json`;
    markVectorIndexFilePathConfirmedMissing_ACU(path);

    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Internal Server Error', text: async () => 'boom' });
    const result = await uploadVectorIndexJsonFile_ACU({
      path,
      role: 'base_shard',
      shardId: 'base_0001',
      data: { hello: 'world' },
      chunkCount: 1,
      status: 'ready',
    });
    expect(result.ok).toBe(false);
    expect(isVectorIndexFilePathConfirmedMissing_ACU(path)).toBe(true);
  });
});