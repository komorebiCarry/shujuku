/**
 * usePlotWorldbookAgentControl 单元测试
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = {
  success: vi.fn(),
  info: vi.fn(() => 'progress-1'),
  warning: vi.fn(),
  error: vi.fn(),
  update: vi.fn(() => true),
};
const dialog = {
  confirm: vi.fn(async () => true),
};
const mockSaveSettings = vi.fn();
const mockRefreshSnapshot = vi.fn(async () => ({ active: false, selectionSignature: '', createdAt: 0, books: {} }));
const mockSkillify = vi.fn(async (options: any) => {
  options.onProgress?.({ phase: 'collecting' });
  throw new Error('boom');
});

function createSettings() {
  return {
    apiPresets: [],
    plotSettings: {
      agentWorldbookControlSnapshot: { active: false, selectionSignature: '', createdAt: 0, books: {} },
      agentWorldbookControl: {
        enabled: true,
        mode: 'agent',
        agentPlotExecutionMode: 'sequential',
        agentApiPreset: '',
        agentSkillApiPreset: '',
        contextSettings: { agentAiMaxRetries: 2 },
        agentDecisionPromptSegments: [],
        agentSkillifyPromptSegments: [],
      },
    },
  } as any;
}

async function getComposable() {
  vi.resetModules();
  const settings = createSettings();

  vi.doMock('../../../src/service/runtime/state-manager', () => ({
    settings_ACU: settings,
    _set_pendingFinalGenerationGreenlights_ACU: vi.fn(),
  }));
  vi.doMock('../../../src/service/settings/settings-service', () => ({
    saveSettings_ACU: mockSaveSettings,
  }));
  vi.doMock('../../../src/service/agent/agent-worldbook-takeover', () => ({
    getPlotAgentWorldbookSnapshot_ACU: () => settings.plotSettings.agentWorldbookControlSnapshot,
    refreshPlotAgentWorldbookSnapshotFromWorldbooks_ACU: mockRefreshSnapshot,
    restoreWorldbookGreenlights_ACU: vi.fn(),
    takeoverWorldbookGreenlights_ACU: vi.fn(),
  }));
  vi.doMock('../../../src/service/agent/agent-skillify-service', () => ({
    skillifyCurrentPlotWorldbookSelection_ACU: mockSkillify,
  }));
  vi.doMock('../../../src/service/agent/agent-prompt-template', () => ({
    clonePromptSegments_ACU: (segments: any[]) => [...segments],
    getDefaultAgentDecisionPromptSegments_ACU: () => [],
    getDefaultAgentSkillifyPromptSegments_ACU: () => [],
    normalizeAgentContextSettings_ACU: (value: any) => ({ agentAiMaxRetries: 2, ...(value || {}) }),
    normalizeEditablePromptSegments_ACU: (segments: any[] | undefined, fallback: any[]) => segments || fallback,
  }));
  vi.doMock('../../../src/presentation-v2/stores/dialog-store', () => ({
    useDialogStore: () => dialog,
  }));
  vi.doMock('../../../src/presentation-v2/stores/toast-store', () => ({
    useToastStore: () => toast,
  }));

  const mod = await import('../../../src/presentation-v2/composables/usePlotWorldbookAgentControl');
  return mod.usePlotWorldbookAgentControl();
}

describe('usePlotWorldbookAgentControl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSaveSettings.mockClear();
    mockRefreshSnapshot.mockClear();
    mockSkillify.mockClear();
    dialog.confirm.mockClear();
    toast.success.mockClear();
    toast.info.mockClear();
    toast.warning.mockClear();
    toast.error.mockClear();
    toast.update.mockClear();
    toast.info.mockReturnValue('progress-1');
    toast.update.mockReturnValue(true);
    dialog.confirm.mockResolvedValue(true);
    mockRefreshSnapshot.mockResolvedValue({ active: false, selectionSignature: '', createdAt: 0, books: {} });
    mockSkillify.mockImplementation(async (options: any) => {
      options.onProgress?.({ phase: 'collecting' });
      throw new Error('boom');
    });
  });

  it('skillifyAll 异常时把已有 progress toast 更新为 error 而不是新建 error toast', async () => {
    const c = await getComposable();

    const result = await c.skillifyAll();

    expect(result).toBe(false);
    expect(toast.info).toHaveBeenCalledWith('正在扫描当前世界书范围内可 Skill 化的条目...', {
      durationMs: 0,
      muteable: false,
      dismissible: false,
    });
    expect(toast.update).toHaveBeenCalledWith(
      'progress-1',
      'error',
      expect.stringContaining('boom'),
      { muteable: false },
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('skillifyAll 异常且 progress toast 更新失败时新建 error toast 兜底', async () => {
    toast.update.mockReturnValue(false);
    const c = await getComposable();

    const result = await c.skillifyAll();

    expect(result).toBe(false);
    expect(toast.update).toHaveBeenCalledWith(
      'progress-1',
      'error',
      expect.stringContaining('boom'),
      { muteable: false },
    );
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining('boom'),
      { muteable: false },
    );
  });
});
