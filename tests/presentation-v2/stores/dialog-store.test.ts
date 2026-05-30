/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useDialogStore } from '../../../src/presentation-v2/stores/dialog-store';

describe('useDialogStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('按确认弹窗语义解析确认与取消', async () => {
    const dialog = useDialogStore();
    const confirmed = dialog.confirm({
      title: '删除',
      message: '确定删除？',
    });

    expect(dialog.active?.kind).toBe('confirm');
    dialog.cancelActive();

    await expect(confirmed).resolves.toBe(false);
  });

  it('队列中的 prompt 激活时保留自己的默认值', async () => {
    const dialog = useDialogStore();
    const first = dialog.confirm({
      title: '先确认',
      message: '先处理确认。',
    });
    const second = dialog.prompt({
      title: '再输入',
      message: '请输入名称。',
      label: '名称',
      defaultValue: '默认名称',
    });

    expect(dialog.active?.kind).toBe('confirm');
    expect(dialog.queue).toHaveLength(1);

    dialog.submitActive();
    await expect(first).resolves.toBe(true);

    expect(dialog.active?.kind).toBe('prompt');
    expect(dialog.inputValue).toBe('默认名称');

    dialog.submitActive();
    await expect(second).resolves.toBe('默认名称');
  });
});
