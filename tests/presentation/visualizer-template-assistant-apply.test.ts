import { describe, expect, it, vi, beforeEach } from 'vitest';

const { mockShowToastr, mockRenderSidebar, mockRenderMain } = vi.hoisted(() => ({
  mockShowToastr: vi.fn(),
  mockRenderSidebar: vi.fn(),
  mockRenderMain: vi.fn(),
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

vi.mock('../../src/service/template-assistant/service', () => ({
  buildTemplateAssistantFingerprint_ACU: vi.fn((data: any) => {
    const keys = Object.keys(data || {}).filter((key) => key.startsWith('sheet_')).sort();
    return `acu-struct:${keys.join('|')}`;
  }),
}));

import { buildTemplateAssistantFingerprint_ACU } from '../../src/service/template-assistant/service';
import { applyTemplateAssistantDraftToVisualizer_ACU } from '../../src/presentation/pages/visualizer-template-assistant-apply';

describe('applyTemplateAssistantDraftToVisualizer_ACU', () => {
  beforeEach(() => {
    mockShowToastr.mockReset();
    mockRenderSidebar.mockReset();
    mockRenderMain.mockReset();
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
      },
    } as any);

    expect(ok).toBe(true);
    expect(state.sheetOrder).toEqual(['sheet_a', 'sheet_b']);
    expect(state.deletedSheetKeys).toEqual(['legacy_deleted', 'sheet_x']);
    expect(state.currentSheetKey).toBe('sheet_a');
  });

  it('fingerprint 不一致时阻止应用', () => {
    const ok = applyTemplateAssistantDraftToVisualizer_ACU({
      draft: { baseFingerprint: 'acu-struct:stale' } as any,
      compileResult: { candidateData: state.tempData, orderedSheetKeys: ['sheet_a'], deletedSheetKeys: [], focusSheetKey: 'sheet_a' },
    } as any);

    expect(ok).toBe(false);
    expect(mockRenderSidebar).not.toHaveBeenCalled();
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
      },
    } as any);

    expect(ok).toBe(true);
    expect(state.currentSheetKey).toBeNull();
  });
});
