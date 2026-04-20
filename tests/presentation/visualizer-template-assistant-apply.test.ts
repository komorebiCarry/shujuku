import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockShowToastr, mockRenderSidebar, mockRenderMain } = vi.hoisted(() => ({
  mockShowToastr: vi.fn(),
  mockRenderSidebar: vi.fn(),
  mockRenderMain: vi.fn(),
}));

const { mockGetTableLocks, mockSaveTableLocks, mockSetSpecialIndexLockEnabled } = vi.hoisted(() => ({
  mockGetTableLocks: vi.fn(() => ({ rows: new Set<number>(), cols: new Set<number>(), cells: new Set<string>() })),
  mockSaveTableLocks: vi.fn(),
  mockSetSpecialIndexLockEnabled: vi.fn(),
}));

const { state } = vi.hoisted(() => ({
  state: {
    tempData: {
      mate: { type: 'chatSheets', version: 1, globalInjectionConfig: { readableEntryPlacement: { position: 'before_character_definition', depth: 2, order: 99981 }, wrapperPlacement: { position: 'before_character_definition', depth: 2, order: 99980 } } },
      sheet_a: { uid: 'sheet_a', name: 'A表', orderNo: 0, content: [['row_id', '姓名']], sourceData: { note: 'a', initNode: '', insertNode: '', updateNode: '', deleteNode: '' }, updateConfig: { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 }, exportConfig: { enabled: false, splitByRow: false, entryName: 'A表', entryType: 'constant', keywords: '', preventRecursion: true, injectionTemplate: '', extraIndexEnabled: false, extraIndexEntryName: 'A表-索引', extraIndexColumns: [], extraIndexColumnModes: {}, extraIndexInjectionTemplate: '', entryPlacement: { position: 'at_depth_as_system', depth: 2, order: 10000 }, extraIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 10010 }, fixedEntryPlacement: { position: 'at_depth_as_system', depth: 2, order: 99990 }, fixedIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 99991 } } },
    } as any,
    sheetOrder: ['sheet_a'],
    currentSheetKey: 'sheet_a',
    deletedSheetKeys: ['legacy_deleted'],
  },
}));

vi.mock('../../src/presentation/theme/toast', () => ({
  showToastr_ACU: mockShowToastr,
}));

vi.mock('../../src/presentation/pages/visualizer-main-render', () => ({
  renderVisualizerMain_ACU: mockRenderMain,
}));

vi.mock('../../src/presentation/pages/visualizer-sidebar', () => ({
  renderVisualizerSidebar_ACU: mockRenderSidebar,
}));

vi.mock('../../src/presentation/pages/visualizer', () => ({
  _acuVisState: state,
}));

vi.mock('../../src/shared/utils', () => ({
  applySheetOrderNumbers_ACU: vi.fn((dataObj: any, orderedKeys: string[]) => {
    orderedKeys.forEach((key, index) => {
      if (dataObj?.[key]) dataObj[key].orderNo = index;
    });
    return true;
  }),
}));

vi.mock('../../src/service/runtime/helpers-remaining', () => ({
  getTableLocksForSheet_ACU: mockGetTableLocks,
  saveTableLocksForSheet_ACU: mockSaveTableLocks,
  setSpecialIndexLockEnabled_ACU: mockSetSpecialIndexLockEnabled,
}));

vi.mock('../../src/service/template-assistant/service', () => ({
  buildTemplateAssistantFingerprint_ACU: vi.fn((data: any) => {
    const keys = Object.keys(data || {}).filter((key) => key.startsWith('sheet_')).sort();
    return `acu-struct:${keys.join('|')}`;
  }),
  getTemplateAssistantApplyBaselineFingerprint_ACU: vi.fn((result: any) => {
    const originalBaseFingerprint = String(result?.originalBaseFingerprint || '').trim();
    if (originalBaseFingerprint) return originalBaseFingerprint;
    if (Array.isArray(result?.rounds) || !!result?.session) return '';
    return String(result?.draft?.baseFingerprint || '').trim();
  }),
}));

import { buildTemplateAssistantFingerprint_ACU, getTemplateAssistantApplyBaselineFingerprint_ACU } from '../../src/service/template-assistant/service';
import { applyTemplateAssistantDraftToVisualizer_ACU } from '../../src/presentation/pages/visualizer-template-assistant-apply';

describe('applyTemplateAssistantDraftToVisualizer_ACU', () => {
  beforeEach(() => {
    mockShowToastr.mockReset();
    mockRenderSidebar.mockReset();
    mockRenderMain.mockReset();
    mockGetTableLocks.mockReset();
    mockSaveTableLocks.mockReset();
    mockSetSpecialIndexLockEnabled.mockReset();
    mockGetTableLocks.mockReturnValue({ rows: new Set<number>(), cols: new Set<number>(), cells: new Set<string>() });
    state.tempData = {
      mate: { type: 'chatSheets', version: 1, globalInjectionConfig: { readableEntryPlacement: { position: 'before_character_definition', depth: 2, order: 99981 }, wrapperPlacement: { position: 'before_character_definition', depth: 2, order: 99980 } } },
      sheet_a: { uid: 'sheet_a', name: 'A表', orderNo: 0, content: [['row_id', '姓名']], sourceData: { note: 'a', initNode: '', insertNode: '', updateNode: '', deleteNode: '' }, updateConfig: { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 }, exportConfig: { enabled: false, splitByRow: false, entryName: 'A表', entryType: 'constant', keywords: '', preventRecursion: true, injectionTemplate: '', extraIndexEnabled: false, extraIndexEntryName: 'A表-索引', extraIndexColumns: [], extraIndexColumnModes: {}, extraIndexInjectionTemplate: '', entryPlacement: { position: 'at_depth_as_system', depth: 2, order: 10000 }, extraIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 10010 }, fixedEntryPlacement: { position: 'at_depth_as_system', depth: 2, order: 99990 }, fixedIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 99991 } } },
    } as any;
    state.sheetOrder = ['sheet_a'];
    state.currentSheetKey = 'sheet_a';
    state.deletedSheetKeys = ['legacy_deleted'];
  });

  it('同步 tempData/sheetOrder/currentSheetKey/deletedSheetKeys', () => {
    const fp = buildTemplateAssistantFingerprint_ACU(state.tempData);
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: fp } as any,
      compileResult: {
        candidateData: {
          ...state.tempData,
          sheet_b: { ...state.tempData.sheet_a, uid: 'sheet_b', name: 'B表', orderNo: 1 },
        },
        orderedSheetKeys: ['sheet_a', 'sheet_b'],
        deletedSheetKeys: ['sheet_x'],
        focusSheetKey: 'sheet_b',
        lockChanges: [],
      },
    } as any);

    expect(ok).toBe(true);
    expect(state.sheetOrder).toEqual(['sheet_a', 'sheet_b']);
    expect(state.deletedSheetKeys).toEqual(['legacy_deleted', 'sheet_x']);
    expect(state.currentSheetKey).toBe('sheet_b');
  });

  it('fingerprint 不一致时阻止应用', () => {
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: 'acu-struct:stale' } as any,
      compileResult: { candidateData: state.tempData, orderedSheetKeys: ['sheet_a'], deletedSheetKeys: [], focusSheetKey: 'sheet_a', lockChanges: [] },
    } as any);

    expect(ok).toBe(false);
    expect(mockRenderSidebar).not.toHaveBeenCalled();
  });

  it('session 风格结果使用 originalBaseFingerprint 作为 apply 基线', () => {
    const fp = buildTemplateAssistantFingerprint_ACU(state.tempData);
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: 'acu-struct:working-copy' } as any,
      originalBaseFingerprint: fp,
      rounds: [],
      session: {
        originalBaseFingerprint: fp,
        finalWorkingFingerprint: 'acu-struct:working-copy',
        stopReason: 'max_rounds',
        roundsExecuted: 1,
        maxRounds: 3,
        repairRetriesUsed: 0,
        maxRepairRetries: 1,
        lastErrorMessage: '',
      },
      compileResult: {
        candidateData: state.tempData,
        orderedSheetKeys: ['sheet_a'],
        deletedSheetKeys: [],
        focusSheetKey: 'sheet_a',
        lockChanges: [],
      },
    } as any);

    expect(ok).toBe(true);
    expect(getTemplateAssistantApplyBaselineFingerprint_ACU).toHaveBeenCalled();
  });

  it('缺失 session baseline 时安全拒绝 apply', () => {
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: 'acu-struct:working-copy' } as any,
      rounds: [],
      session: {
        originalBaseFingerprint: '',
        finalWorkingFingerprint: 'acu-struct:working-copy',
        stopReason: 'max_rounds',
        roundsExecuted: 1,
        maxRounds: 3,
        repairRetriesUsed: 0,
        maxRepairRetries: 1,
        lastErrorMessage: '',
      },
      compileResult: { candidateData: state.tempData, orderedSheetKeys: ['sheet_a'], deletedSheetKeys: [], focusSheetKey: 'sheet_a', lockChanges: [] },
    } as any);

    expect(ok).toBe(false);
    expect(mockShowToastr).toHaveBeenCalledWith('warning', '当前结构已变化，assistant 草稿已失效，请重新生成。');
  });

  it('删除当前表后回退到有效 currentSheetKey', () => {
    const fp = buildTemplateAssistantFingerprint_ACU(state.tempData);
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: fp } as any,
      compileResult: {
        candidateData: { mate: state.tempData.mate },
        orderedSheetKeys: [],
        deletedSheetKeys: ['sheet_a'],
        focusSheetKey: null,
        lockChanges: [],
      },
    } as any);

    expect(ok).toBe(true);
    expect(state.currentSheetKey).toBeNull();
  });

  it('应用 lockChanges 到运行时锁状态', () => {
    const fp = buildTemplateAssistantFingerprint_ACU(state.tempData);
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: fp } as any,
      compileResult: {
        candidateData: state.tempData,
        orderedSheetKeys: ['sheet_a'],
        deletedSheetKeys: [],
        focusSheetKey: 'sheet_a',
        lockChanges: [
          {
            sheetKey: 'sheet_a',
            rows: [{ rowIndex: 0, locked: true }],
            columns: [{ colIndex: 0, locked: true }],
            cells: [{ rowIndex: 0, colIndex: 0, locked: false }],
            specialIndexLocked: true,
          },
        ],
      },
    } as any);

    expect(ok).toBe(true);
    expect(mockSaveTableLocks).toHaveBeenCalledTimes(1);
    expect(mockSetSpecialIndexLockEnabled).toHaveBeenCalledWith('sheet_a', true);
  });
});
