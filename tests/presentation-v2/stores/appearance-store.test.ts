/**
 * appearance-store.test — 验证 UI v2 外观偏好持久化。
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const STORAGE_KEY = 'acu_v2_ui_state';

type AppearanceStoreModule = typeof import('../../../src/presentation-v2/stores/appearance-store');
type PiniaModule = typeof import('pinia');

async function freshImport(): Promise<{
  appearanceStore: AppearanceStoreModule;
  pinia: PiniaModule;
}> {
  vi.resetModules();
  const [appearanceStore, pinia] = await Promise.all([
    import('../../../src/presentation-v2/stores/appearance-store'),
    import('pinia'),
  ]);
  return { appearanceStore, pinia };
}

beforeEach(() => {
  localStorage.clear();
});

describe('appearance-store', () => {
  it('未持久化时使用 100% 界面缩放', async () => {
    const m = await freshImport();
    m.pinia.setActivePinia(m.pinia.createPinia());
    const store = m.appearanceStore.useAppearanceStore();

    expect(store.uiScale).toBe('100');
    expect(store.uiScaleLabel).toBe('100%');
    expect(store.uiScaleCssValue).toBe('1');
  });

  it('localStorage 中已有合法缩放时按持久化值初始化', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: { uiScale: '125' } }));
    const m = await freshImport();
    m.pinia.setActivePinia(m.pinia.createPinia());
    const store = m.appearanceStore.useAppearanceStore();

    expect(store.uiScale).toBe('125');
    expect(store.uiScaleLabel).toBe('125%');
    expect(store.uiScaleCssValue).toBe('1.25');
  });

  it('非法缩放值回退到 100%', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ appearance: { uiScale: '180' } }));
    const m = await freshImport();
    m.pinia.setActivePinia(m.pinia.createPinia());
    const store = m.appearanceStore.useAppearanceStore();

    expect(store.uiScale).toBe('100');
  });

  it('setUiScale 写入独立 appearance section', async () => {
    const m = await freshImport();
    m.pinia.setActivePinia(m.pinia.createPinia());
    const store = m.appearanceStore.useAppearanceStore();

    store.setUiScale('110');

    expect(store.uiScale).toBe('110');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      appearance: { uiScale: '110' },
    });
  });

  it('setUiScale 拒绝非法值并保持原状态', async () => {
    const m = await freshImport();
    m.pinia.setActivePinia(m.pinia.createPinia());
    const store = m.appearanceStore.useAppearanceStore();

    store.setUiScale('125');
    (store.setUiScale as any)('140');

    expect(store.uiScale).toBe('125');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      appearance: { uiScale: '125' },
    });
  });
});
