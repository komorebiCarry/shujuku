/**
 * useFormFillWorldbookEntries 单元测试
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeEntry(uid: number, comment: string, enabled = true, type = 'selective') {
  return { uid, comment, name: comment, enabled, type };
}

function createWorldbookConfig() {
  return {
    source: 'character',
    manualSelection: [],
    enabledEntries: {},
  } as any;
}

let worldbookConfig: ReturnType<typeof createWorldbookConfig>;
const mockSaveSettings = vi.fn();
const mockGetEntries = vi.fn();

async function getComposable() {
  vi.resetModules();
  worldbookConfig = createWorldbookConfig();

  vi.doMock('../../../src/service/settings/settings-readers', () => ({
    getCurrentWorldbookConfig_ACU: () => worldbookConfig,
  }));
  vi.doMock('../../../src/service/settings/settings-service', () => ({
    saveSettings_ACU: mockSaveSettings,
  }));
  vi.doMock('../../../src/service/worldbook/pipeline', () => ({
    getLorebookEntriesByNames_ACU: mockGetEntries,
  }));

  const mod = await import('../../../src/presentation-v2/composables/useFormFillWorldbookEntries');
  return mod.useFormFillWorldbookEntries();
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockSaveSettings.mockClear();
  mockGetEntries.mockClear();
});

describe('useFormFillWorldbookEntries', () => {
  it('首次加载默认启用可见条目但分组保持折叠', async () => {
    mockGetEntries.mockResolvedValue({
      'CharBook': [makeEntry(1, '人物'), makeEntry(2, '地点')],
    });

    const c = await getComposable();
    await c.loadEntries(['CharBook']);

    expect(c.groups.value).toHaveLength(1);
    expect(c.groups.value[0].expanded).toBe(false);
    expect(c.groups.value[0].entries.every(entry => entry.checked)).toBe(true);
    expect(worldbookConfig.enabledEntries['CharBook']).toEqual([1, 2]);
    expect(mockSaveSettings).toHaveBeenCalled();
  });

  it('显示、默认启用并标记 constant 条目', async () => {
    mockGetEntries.mockResolvedValue({
      'CharBook': [
        makeEntry(1, '人物'),
        makeEntry(2, '常驻设定', true, ' CONSTANT '),
        makeEntry(3, '关闭常驻', false, 'constant'),
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['CharBook']);

    expect(c.groups.value[0].entries.map(entry => ({
      uid: entry.uid,
      checked: entry.checked,
      disabled: entry.disabled,
      isConstant: entry.isConstant,
    }))).toEqual([
      { uid: 1, checked: true, disabled: false, isConstant: false },
      { uid: 2, checked: true, disabled: false, isConstant: true },
      { uid: 3, checked: true, disabled: true, isConstant: true },
    ]);
    expect(worldbookConfig.enabledEntries.CharBook).toEqual([1, 2, 3]);
  });
});
