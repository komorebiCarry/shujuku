/**
 * useTableTemplatePresets — 表格模板预设状态语义
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function importComposable() {
  vi.resetModules();
  let selectedGlobal = 'global-A';
  let selectedChat = 'global-A';
  let activeScope: 'global' | 'chat' = 'global';
  let activeMode = 'inherit_global';
  let chatEntries: any[] = [];
  const applyTemplatePresetToCurrent_ACU = vi.fn(async () => ({ presetName: selectedChat }));
  const resolveTemplateForExport_ACU = vi.fn(() => ({ jsonData: { sheet_1: {} }, fromPresetName: selectedChat || '默认预设' }));
  const ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU = vi.fn(async () => ({ success: true, dataWasReset: false }));
  const validateCurrentChatTableRecoveryWithGuide_ACU = vi.fn(async () => ({ success: true }));
  const deleteLocalDataInChatCore_ACU = vi.fn(async () => 1);

  vi.doMock('../../../src/service/runtime/state-manager', () => ({
    settings_ACU: {},
  }));
  vi.doMock('../../../src/service/table/storage-mode', () => ({
    isSqliteMode: () => false,
  }));
  vi.doMock('../../../src/service/table/table-storage-strategy', () => ({
    reloadStorageProvider: vi.fn(async () => undefined),
  }));
  vi.doMock('../../../src/service/table/storage-frame-v2-replay', () => ({
    validateCurrentChatTableRecoveryWithGuide_ACU,
  }));
  vi.doMock('../../../src/service/chat/chat-service', () => ({
    deleteLocalDataInChatCore_ACU,
  }));
  vi.doMock('../../../src/presentation-v2/composables/useTemplateRecoveryGuard', () => ({
    ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU,
  }));
  vi.doMock('../../../src/service/template/chat-scope', () => ({
    buildChatSheetGuideDataFromTemplateObj_ACU: (value: any) => value ? { sheet_1: value.sheet_1 || {} } : null,
    listChatTemplatePresetEntries_ACU: () => chatEntries,
    sanitizeChatSheetsObject_ACU: (value: any) => value,
  }));
  vi.doMock('../../../src/shared/template-preset-utils', () => ({
    getCurrentTemplatePresetName_ACU: () => selectedGlobal,
    normalizeTemplatePresetSelectionValue_ACU: (value: string) => String(value || '').trim(),
    sanitizeFilenameComponent_ACU: (value: string) => String(value || '').trim(),
    deriveTemplatePresetNameForImport_ACU: () => '导入模板',
  }));
  vi.doMock('../../../src/service/template/template-preset-service', () => ({
    applyTemplatePresetToCurrent_ACU,
    deleteTemplatePreset_ACU: vi.fn(() => true),
    getActiveTemplatePresetMeta_ACU: () => ({ presetName: selectedChat, scope: activeScope, mode: activeMode }),
    ensureUniqueTemplatePresetName_ACU: (name: string) => name,
    getDefaultTemplateSnapshot_ACU: () => ({ templateObj: { sheet_1: {} }, templateStr: '{"sheet_1":{}}' }),
    getTemplatePreset_ACU: () => ({ templateStr: '{"sheet_1":{}}' }),
    listTemplatePresetNames_ACU: () => ['global-A', 'chat-A'],
    normalizeTemplateForPresetSave_ACU: () => ({ templateStr: '{"sheet_1":{}}' }),
    parseImportedTemplateData_ACU: () => ({ templateObj: { sheet_1: {} }, templateStr: '{"sheet_1":{}}' }),
    resolveActiveTemplatePresetName_ACU: () => selectedChat,
    resolveTemplateForExport_ACU,
    upsertTemplatePreset_ACU: vi.fn(() => true),
  }));

  const { createPinia, setActivePinia } = await import('pinia');
  setActivePinia(createPinia());
  const [{ useTableTemplatePresets }, { useToastStore }] = await Promise.all([
    import('../../../src/presentation-v2/composables/useTableTemplatePresets'),
    import('../../../src/presentation-v2/stores/toast-store'),
  ]);
  return {
    useTableTemplatePresets,
    toast: useToastStore(),
    applyTemplatePresetToCurrent_ACU,
    resolveTemplateForExport_ACU,
    ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU,
    validateCurrentChatTableRecoveryWithGuide_ACU,
    deleteLocalDataInChatCore_ACU,
    setSelectedGlobal: (value: string) => { selectedGlobal = value; },
    setSelectedChat: (value: string) => { selectedChat = value; },
    setActiveScope: (value: 'global' | 'chat') => { activeScope = value; activeMode = value === 'chat' ? 'chat_override' : 'inherit_global'; },
    setActiveMode: (value: string) => { activeMode = value; activeScope = value === 'inherit_global' ? 'global' : 'chat'; },
    setChatEntries: (value: any[]) => { chatEntries = value; },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('useTableTemplatePresets', () => {
  it('isChatOverridden 按实际聊天作用域判断，同名快照也算覆盖', async () => {
    const { useTableTemplatePresets, setSelectedChat, setSelectedGlobal, setActiveScope } = await importComposable();
    const presets = useTableTemplatePresets();

    expect(presets.isChatOverridden.value).toBe(false);

    setActiveScope('chat');
    setSelectedChat('chat-A');
    presets.refresh();
    expect(presets.isChatOverridden.value).toBe(true);

    setSelectedChat('global-A');
    presets.refresh();
    expect(presets.isChatOverridden.value).toBe(true);

    setActiveScope('global');
    setSelectedGlobal('');
    setSelectedChat('');
    presets.refresh();
    expect(presets.isChatOverridden.value).toBe(false);
  });

  it('同名全局预设和聊天快照在当前聊天下拉中可区分', async () => {
    const { useTableTemplatePresets, setChatEntries, setSelectedChat, setActiveMode } = await importComposable();
    setChatEntries([{ presetName: 'global-A', templateStr: '{"sheet_1":{"name":"本地"}}' }]);
    setSelectedChat('global-A');
    setActiveMode('chat_override');

    const presets = useTableTemplatePresets();

    expect(presets.chatPresetItems.value.map(item => item.label)).toEqual(expect.arrayContaining([
      'global-A（全局预设）',
      'global-A（当前聊天快照）',
    ]));
    expect(presets.selectedChatPresetLabel.value).toBe('global-A（当前聊天快照）');
  });

  it('选择同名全局项时按全局来源切换，不被本地快照抢占', async () => {
    const { useTableTemplatePresets, applyTemplatePresetToCurrent_ACU, setChatEntries } = await importComposable();
    setChatEntries([{ presetName: 'global-A', templateStr: '{"sheet_1":{"name":"本地"}}' }]);
    const presets = useTableTemplatePresets();
    const globalItem = presets.chatPresetItems.value.find(item => item.label === 'global-A（全局预设）');

    await presets.selectChatPreset(globalItem!.value);

    expect(applyTemplatePresetToCurrent_ACU).toHaveBeenCalledWith('global-A', expect.objectContaining({
      updateGlobal: false,
      chatSelectionSource: 'global',
    }));
  });

  it('切换当前聊天模板前使用统一恢复 guard，guard 取消时不切换', async () => {
    const { useTableTemplatePresets, applyTemplatePresetToCurrent_ACU, ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU } = await importComposable();
    const presets = useTableTemplatePresets();
    ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU.mockResolvedValueOnce({ success: false, dataWasReset: false });

    await presets.selectChatPreset('chat-A');

    expect(ensureTemplateRecoveryOrDeleteCurrentIsolationData_ACU).toHaveBeenCalledWith(expect.any(Object), 'switch-template');
    expect(applyTemplatePresetToCurrent_ACU).not.toHaveBeenCalled();
  });

  it('操作失败时保留局部错误并显示短 toast', async () => {
    const { useTableTemplatePresets, toast, applyTemplatePresetToCurrent_ACU } = await importComposable();
    const presets = useTableTemplatePresets();
    applyTemplatePresetToCurrent_ACU.mockResolvedValueOnce(null as any);

    await presets.selectGlobalPreset('broken');

    expect(presets.message.value).toMatchObject({
      kind: 'error',
      text: '全局模板预设切换失败。',
    });
    expect(toast.items.at(-1)).toMatchObject({
      kind: 'error',
      text: '全局模板预设切换失败。',
    });
  });

  it('导出无法解析当前模板时显示短 toast', async () => {
    const { useTableTemplatePresets, toast, resolveTemplateForExport_ACU } = await importComposable();
    const presets = useTableTemplatePresets();
    resolveTemplateForExport_ACU.mockReturnValueOnce(null as any);

    presets.exportTemplate('global');

    expect(presets.message.value).toMatchObject({
      kind: 'error',
      text: '无法解析当前模板。',
    });
    expect(toast.items.at(-1)).toMatchObject({
      kind: 'error',
      text: '无法解析当前模板。',
    });
  });
});
