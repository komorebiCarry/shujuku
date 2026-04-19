import { describe, expect, it } from 'vitest';

import { vi } from 'vitest';

vi.mock('../../../src/service/template/chat-scope', () => ({
  getSortedSheetKeys_ACU: (data: any) => Object.keys(data || {}).filter((key) => key.startsWith('sheet_')).sort((a, b) => (data[a]?.orderNo ?? 0) - (data[b]?.orderNo ?? 0)),
}));

vi.mock('../../../src/service/worldbook/injection-engine', async () => {
  const actual = await vi.importActual<any>('../../../src/service/worldbook/injection-engine-config');
  return {
    buildDefaultExportConfig_ACU: actual.buildDefaultExportConfig_ACU,
    ensureGlobalInjectionConfigDefaults_ACU: actual.ensureGlobalInjectionConfigDefaults_ACU,
    ensureSheetExportConfigDefaults_ACU: actual.ensureSheetExportConfigDefaults_ACU,
  };
});

import { compileTemplateAssistantDraft_ACU } from '../../../src/service/template-assistant/compiler';

function buildTempData_ACU() {
  return {
    mate: {
      type: 'chatSheets',
      version: 1,
      globalInjectionConfig: {
        readableEntryPlacement: { position: 'before_character_definition', depth: 2, order: 99981 },
        wrapperPlacement: { position: 'before_character_definition', depth: 2, order: 99980 },
      },
    },
    sheet_a: {
      uid: 'sheet_a',
      name: 'A表',
      orderNo: 0,
      content: [['row_id', '姓名', '备注'], [1, '甲', '旧备注']],
      sourceData: { note: 'a', initNode: '', insertNode: '', updateNode: '', deleteNode: '' },
      updateConfig: { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
      exportConfig: { enabled: false, splitByRow: false, entryName: 'A表', entryType: 'constant', keywords: '', preventRecursion: true, injectionTemplate: '', extraIndexEnabled: false, extraIndexEntryName: 'A表-索引', extraIndexColumns: [], extraIndexColumnModes: {}, extraIndexInjectionTemplate: '', entryPlacement: { position: 'at_depth_as_system', depth: 2, order: 10000 }, extraIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 10010 }, fixedEntryPlacement: { position: 'at_depth_as_system', depth: 2, order: 99990 }, fixedIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 99991 } },
    },
    sheet_b: {
      uid: 'sheet_b',
      name: 'B表',
      orderNo: 1,
      content: [['row_id', '标题'], [1, '旧值']],
      sourceData: { note: 'b', initNode: '', insertNode: '', updateNode: '', deleteNode: '' },
      updateConfig: { uiSentinel: -1, contextDepth: 3, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
      exportConfig: { enabled: true, splitByRow: false, entryName: 'B表', entryType: 'constant', keywords: '', preventRecursion: true, injectionTemplate: '', extraIndexEnabled: false, extraIndexEntryName: 'B表-索引', extraIndexColumns: [], extraIndexColumnModes: {}, extraIndexInjectionTemplate: '', entryPlacement: { position: 'at_depth_as_system', depth: 2, order: 10000 }, extraIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 10010 }, fixedEntryPlacement: { position: 'at_depth_as_system', depth: 2, order: 99990 }, fixedIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 99991 } },
    },
  } as any;
}

describe('compileTemplateAssistantDraft_ACU', () => {
  it('add_sheet 生成兼容的新表对象', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: {
        operations: [
          { op: 'add_sheet', sheetName: '战利品表', headers: ['物品', '品质'], sourceData: { note: 'loot' } },
        ],
      },
    });

    expect(result.diff.addedSheets).toHaveLength(1);
    const addedKey = result.diff.addedSheets[0].sheetKey;
    expect(result.candidateData[addedKey].content[0]).toEqual(['row_id', '物品', '品质']);
    expect(result.candidateData[addedKey].updateConfig.groupId).toBe(-1);
    expect(result.focusSheetKey).toBe(addedKey);
  });

  it('add_sheet 拒绝未知 sourceData 字段和直接注入 ddl', () => {
    expect(() => compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: {
        operations: [
          { op: 'add_sheet', sheetName: '战利品表', headers: ['物品'], sourceData: { ddl: 'CREATE TABLE loot(id INTEGER);' } },
        ],
      },
    })).toThrow(/未知字段/);
  });

  it('rename_sheet 只改表名', () => {
    const data = buildTempData_ACU();
    const result = compileTemplateAssistantDraft_ACU({
      tempData: data,
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { operations: [{ op: 'rename_sheet', sheetKey: 'sheet_a', newName: '新A表' }] },
    });

    expect(result.candidateData.sheet_a.name).toBe('新A表');
    expect(result.candidateData.sheet_a.content).toEqual(data.sheet_a.content);
  });

  it('delete_sheet 产出删除 key 并更新顺序', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { operations: [{ op: 'delete_sheet', sheetKey: 'sheet_b' }] },
    });

    expect(result.deletedSheetKeys).toEqual(['sheet_b']);
    expect(result.orderedSheetKeys).toEqual(['sheet_a']);
    expect(result.highRiskItems[0]?.type).toBe('delete_sheet');
  });

  it('move_sheet 重建 orderedSheetKeys', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { operations: [{ op: 'move_sheet', sheetKey: 'sheet_b', beforeSheetKey: 'sheet_a' }] },
    });

    expect(result.orderedSheetKeys).toEqual(['sheet_b', 'sheet_a']);
    expect(result.diff.movedSheets[0]?.toIndex).toBe(0);
  });

  it('patch_sheet_update_config 保留未 patch 字段', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_b',
      draft: { selectedSheetKey: 'sheet_b', operations: [{ op: 'patch_sheet_update_config', sheetKey: 'sheet_b', patch: { contextDepth: 8 } }] },
    });

    expect(result.candidateData.sheet_b.updateConfig.contextDepth).toBe(8);
    expect(result.candidateData.sheet_b.updateConfig.updateFrequency).toBe(-1);
  });

  it('patch_sheet_export_config 保持默认值完整', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_b',
      draft: { selectedSheetKey: 'sheet_b', operations: [{ op: 'patch_sheet_export_config', sheetKey: 'sheet_b', patch: { enabled: false } }] },
    });

    expect(result.candidateData.sheet_b.exportConfig.extraIndexPlacement).toBeTruthy();
    expect(result.candidateData.sheet_b.exportConfig.enabled).toBe(false);
  });

  it('patch_global_injection_config 复用默认 normalize 结果', () => {
    const result = compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { operations: [{ op: 'patch_global_injection_config', patch: { readableEntryPlacement: { position: 'after_character_definition', depth: 4, order: 100 } } }] },
    });

    expect(result.candidateData.mate.globalInjectionConfig.readableEntryPlacement.position).toBe('after_character_definition');
    expect(result.diff.globalInjectionChanged).toBe(true);
  });

  it('拒绝未知结构 patch 字段', () => {
    expect(() => compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { selectedSheetKey: 'sheet_a', operations: [{ op: 'patch_sheet_source_data', sheetKey: 'sheet_a', patch: { unknownField: 'x' } }] },
    })).toThrow(/未知字段/);
  });

  it('draft.selectedSheetKey 与 patch op 的 sheetKey 不一致时报错', () => {
    expect(() => compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_b',
      draft: { selectedSheetKey: 'sheet_a', operations: [{ op: 'patch_sheet_update_config', sheetKey: 'sheet_b', patch: { contextDepth: 8 } }] },
    })).toThrow(/selectedSheetKey/);
  });

  it('currentSheetKey 与 patch op 的 sheetKey 不一致时报错', () => {
    expect(() => compileTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      sheetOrder: ['sheet_a', 'sheet_b'],
      currentSheetKey: 'sheet_a',
      draft: { selectedSheetKey: 'sheet_b', operations: [{ op: 'patch_sheet_export_config', sheetKey: 'sheet_b', patch: { enabled: false } }] },
    })).toThrow(/只能修改当前选中表/);
  });
});
