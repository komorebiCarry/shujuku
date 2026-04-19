import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCallAIWithPreset, mockCompileTemplateAssistantDraft, mockBuildTemplateAssistantCumulativeCompileResult } = vi.hoisted(() => ({
  mockCallAIWithPreset: vi.fn(),
  mockCompileTemplateAssistantDraft: vi.fn(),
  mockBuildTemplateAssistantCumulativeCompileResult: vi.fn(),
}));

vi.mock('../../../src/service/ai/api-call', () => ({
  callAIWithPreset_ACU: mockCallAIWithPreset,
}));

vi.mock('../../../src/service/runtime/state-manager', () => ({
  settings_ACU: { tableApiPreset: 'preset-1' },
}));

vi.mock('../../../src/service/template/chat-scope', () => ({
  getSortedSheetKeys_ACU: (data: any) => Object.keys(data || {}).filter((key) => key.startsWith('sheet_')).sort((a, b) => (data[a]?.orderNo ?? 0) - (data[b]?.orderNo ?? 0)),
}));

vi.mock('../../../src/service/worldbook/injection-engine', async () => {
  const actual = await vi.importActual<any>('../../../src/service/worldbook/injection-engine-config');
  return {
    getGlobalInjectionConfigFromData_ACU: actual.getGlobalInjectionConfigFromData_ACU,
  };
});

vi.mock('../../../src/service/template-assistant/compiler', () => ({
  compileTemplateAssistantDraft_ACU: mockCompileTemplateAssistantDraft,
  buildTemplateAssistantCumulativeCompileResult_ACU: mockBuildTemplateAssistantCumulativeCompileResult,
}));

import {
  buildTemplateAssistantFingerprint_ACU,
  createTemplateAssistantSessionGuard_ACU,
  generateTemplateAssistantDraft_ACU,
  getTemplateAssistantApplyBaselineFingerprint_ACU,
  parseTemplateAssistantDraft_ACU,
  runTemplateAssistantSession_ACU,
  TemplateAssistantSessionStoppedError_ACU,
  validateTemplateAssistantDraft_ACU,
} from '../../../src/service/template-assistant/service';

function clone_ACU<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function buildEmptyDiff_ACU() {
  return {
    addedSheets: [],
    deletedSheets: [],
    renamedSheets: [],
    movedSheets: [],
    patchedSourceDataSheets: [],
    patchedUpdateConfigSheets: [],
    patchedExportConfigSheets: [],
    globalInjectionChanged: false,
  };
}

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
      content: [['row_id', '姓名'], [1, '甲']],
      sourceData: { note: 'a', initNode: '', insertNode: '', updateNode: '', deleteNode: '' },
      updateConfig: { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
      exportConfig: { enabled: false, splitByRow: false, entryName: 'A表', entryType: 'constant', keywords: '', preventRecursion: true, injectionTemplate: '', extraIndexEnabled: false, extraIndexEntryName: 'A表-索引', extraIndexColumns: [], extraIndexColumnModes: {}, extraIndexInjectionTemplate: '', entryPlacement: { position: 'at_depth_as_system', depth: 2, order: 10000 }, extraIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 10010 }, fixedEntryPlacement: { position: 'at_depth_as_system', depth: 2, order: 99990 }, fixedIndexPlacement: { position: 'at_depth_as_system', depth: 2, order: 99991 } },
    },
  } as any;
}

function buildCompileResult_ACU(input: any) {
  const candidateData = clone_ACU(input.tempData);
  const operations = Array.isArray(input?.draft?.operations) ? input.draft.operations : [];
  const deletedSheetKeys: string[] = [];
  let orderedSheetKeys = Array.isArray(input?.sheetOrder)
    ? [...input.sheetOrder].filter((key) => candidateData[key])
    : Object.keys(candidateData).filter((key) => key.startsWith('sheet_'));
  let focusSheetKey = input?.currentSheetKey || input?.draft?.selectedSheetKey || null;

  operations.forEach((op: any) => {
    if (op.op === 'rename_sheet' && candidateData[op.sheetKey]) {
      candidateData[op.sheetKey].name = op.newName;
      return;
    }
    if (op.op === 'patch_sheet_update_config' && candidateData[op.sheetKey]) {
      candidateData[op.sheetKey].updateConfig = { ...candidateData[op.sheetKey].updateConfig, ...op.patch };
      return;
    }
    if (op.op === 'delete_sheet' && candidateData[op.sheetKey]) {
      delete candidateData[op.sheetKey];
      deletedSheetKeys.push(op.sheetKey);
      orderedSheetKeys = orderedSheetKeys.filter((key) => key !== op.sheetKey);
      focusSheetKey = orderedSheetKeys[0] || null;
    }
  });

  return {
    candidateData,
    orderedSheetKeys,
    deletedSheetKeys,
    focusSheetKey,
    diff: buildEmptyDiff_ACU(),
    highRiskItems: deletedSheetKeys.map((sheetKey) => ({ type: 'delete_sheet', label: `删除表: ${sheetKey}` })),
  };
}

function buildCumulativeResult_ACU(input: any) {
  const candidateData = clone_ACU(input.candidateData);
  const orderedSheetKeys = Array.isArray(input?.candidateSheetOrder)
    ? [...input.candidateSheetOrder]
    : Object.keys(candidateData).filter((key) => key.startsWith('sheet_'));
  const baselineKeys = Array.isArray(input?.baselineSheetOrder)
    ? input.baselineSheetOrder
    : Object.keys(input?.baselineData || {}).filter((key) => key.startsWith('sheet_'));
  return {
    candidateData,
    orderedSheetKeys,
    deletedSheetKeys: baselineKeys.filter((key) => !candidateData[key]),
    focusSheetKey: input.focusSheetKey || orderedSheetKeys[0] || null,
    diff: buildEmptyDiff_ACU(),
    highRiskItems: [],
  };
}

function parseUserPayload_ACU(messages: Array<{ role: string; content: string }>) {
  return JSON.parse(messages[1]?.content || '{}');
}

describe('template assistant service', () => {
  beforeEach(() => {
    mockCallAIWithPreset.mockReset();
    mockCompileTemplateAssistantDraft.mockReset();
    mockBuildTemplateAssistantCumulativeCompileResult.mockReset();
    mockCompileTemplateAssistantDraft.mockImplementation(buildCompileResult_ACU);
    mockBuildTemplateAssistantCumulativeCompileResult.mockImplementation(buildCumulativeResult_ACU);
  });

  it('提取最后一个合法标签块', () => {
    const draft = parseTemplateAssistantDraft_ACU(`x<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"acu-struct:1","selectedSheetKey":"sheet_a","summary":"旧","warnings":[],"operations":[]}</templateAssistantDraft>y<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"acu-struct:2","selectedSheetKey":"sheet_a","summary":"新","warnings":[],"operations":[]}</templateAssistantDraft>`);
    expect(draft.summary).toBe('新');
    expect(draft.baseFingerprint).toBe('acu-struct:2');
  });

  it('协议缺字段时报错', () => {
    expect(() => validateTemplateAssistantDraft_ACU({ protocolVersion: 1 })).toThrow(/mode/);
  });

  it('selectedSheetKey 为空字符串时报错', () => {
    expect(() => validateTemplateAssistantDraft_ACU({
      protocolVersion: 1,
      mode: 'modify_current_template_incremental',
      baseFingerprint: 'acu-struct:1',
      selectedSheetKey: '',
      summary: 'x',
      warnings: [],
      operations: [],
    })).toThrow(/selectedSheetKey 必须是非空字符串/);
  });

  it('selectedSheetKey 与 patch op 的 sheetKey 不一致时报错', async () => {
    const tempData = buildTempData_ACU();
    const fp = buildTemplateAssistantFingerprint_ACU(tempData);
    mockCallAIWithPreset.mockResolvedValue(`<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${fp}","selectedSheetKey":"sheet_a","summary":"x","warnings":[],"operations":[{"op":"patch_sheet_update_config","sheetKey":"sheet_b","patch":{"contextDepth":8}}]}</templateAssistantDraft>`);
    await expect(generateTemplateAssistantDraft_ACU({ tempData, currentSheetKey: 'sheet_a', sheetOrder: ['sheet_a'], userRequest: '修改当前表' })).rejects.toThrow(/selectedSheetKey/);
  });

  it('结构级 fingerprint 稳定', () => {
    const tempData = buildTempData_ACU();
    expect(buildTemplateAssistantFingerprint_ACU(tempData)).toBe(buildTemplateAssistantFingerprint_ACU(buildTempData_ACU()));
  });

  it('currentSheetKey 为空时直接拒绝生成', async () => {
    await expect(generateTemplateAssistantDraft_ACU({
      tempData: buildTempData_ACU(),
      currentSheetKey: null,
      sheetOrder: ['sheet_a'],
      userRequest: '修改当前表',
    })).rejects.toThrow(/请先选中一个表/);
    expect(mockCallAIWithPreset).not.toHaveBeenCalled();
  });

  it('构建 messages 后调用 callAIWithPreset_ACU', async () => {
    const tempData = buildTempData_ACU();
    const fp = buildTemplateAssistantFingerprint_ACU(tempData);
    mockCallAIWithPreset.mockResolvedValue(`<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${fp}","selectedSheetKey":"sheet_a","summary":"x","warnings":[],"operations":[]}</templateAssistantDraft>`);
    const result = await generateTemplateAssistantDraft_ACU({ tempData, currentSheetKey: 'sheet_a', sheetOrder: ['sheet_a'], userRequest: '查看' });
    expect(mockCallAIWithPreset).toHaveBeenCalledTimes(1);
    expect(result.messages).toHaveLength(2);
  });

  it('apply 基线指纹对多轮结果不回退到 working fingerprint', () => {
    expect(getTemplateAssistantApplyBaselineFingerprint_ACU({
      draft: { baseFingerprint: 'acu-struct:single-round' } as any,
    } as any)).toBe('acu-struct:single-round');

    expect(getTemplateAssistantApplyBaselineFingerprint_ACU({
      draft: { baseFingerprint: 'acu-struct:working' } as any,
      session: { stopReason: 'empty_operations' } as any,
    } as any)).toBe('');

    expect(getTemplateAssistantApplyBaselineFingerprint_ACU({
      draft: { baseFingerprint: 'acu-struct:working' } as any,
      originalBaseFingerprint: 'acu-struct:original',
      session: { stopReason: 'empty_operations' } as any,
    } as any)).toBe('acu-struct:original');
  });

  it('多轮 session 在内存草稿上继续并产出累计结果', async () => {
    const tempData = buildTempData_ACU();
    let round = 0;
    mockCallAIWithPreset.mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
      round += 1;
      const payload = parseUserPayload_ACU(messages);
      if (round === 1) {
        return `<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${payload.baseFingerprint}","selectedSheetKey":"sheet_a","summary":"第一轮改名","warnings":[],"operations":[{"op":"rename_sheet","sheetKey":"sheet_a","newName":"新A表"}]}</templateAssistantDraft>`;
      }
      return `<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${payload.baseFingerprint}","selectedSheetKey":"sheet_a","summary":"无需继续","warnings":[],"operations":[]}</templateAssistantDraft>`;
    });

    const result = await runTemplateAssistantSession_ACU({
      tempData,
      currentSheetKey: 'sheet_a',
      sheetOrder: ['sheet_a'],
      userRequest: '把当前表改名并确认完成',
      maxRounds: 3,
    });

    const secondPayload = parseUserPayload_ACU(mockCallAIWithPreset.mock.calls[1][0]);
    expect(secondPayload.selectedSheet.name).toBe('新A表');
    expect(mockBuildTemplateAssistantCumulativeCompileResult.mock.calls[0][0].baselineData.sheet_a.name).toBe('A表');
    expect(mockBuildTemplateAssistantCumulativeCompileResult.mock.calls[0][0].candidateData.sheet_a.name).toBe('新A表');
    expect(result.originalBaseFingerprint).toBe(buildTemplateAssistantFingerprint_ACU(tempData));
    expect(result.rounds).toHaveLength(2);
    expect(result.session.stopReason).toBe('empty_operations');
    expect(result.compileResult.candidateData.sheet_a.name).toBe('新A表');
  });

  it('多轮 session 达到 maxRounds 时停止', async () => {
    mockCallAIWithPreset.mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
      const payload = parseUserPayload_ACU(messages);
      if (mockCallAIWithPreset.mock.calls.length === 1) {
        return `<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${payload.baseFingerprint}","selectedSheetKey":"sheet_a","summary":"第一轮改名","warnings":[],"operations":[{"op":"rename_sheet","sheetKey":"sheet_a","newName":"新A表"}]}</templateAssistantDraft>`;
      }
      return `<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${payload.baseFingerprint}","selectedSheetKey":"sheet_a","summary":"第二轮补充配置","warnings":[],"operations":[{"op":"patch_sheet_update_config","sheetKey":"sheet_a","patch":{"contextDepth":8}}]}</templateAssistantDraft>`;
    });

    const result = await runTemplateAssistantSession_ACU({
      tempData: buildTempData_ACU(),
      currentSheetKey: 'sheet_a',
      sheetOrder: ['sheet_a'],
      userRequest: '持续修改直到达到轮次上限',
      maxRounds: 2,
    });

    expect(result.session.stopReason).toBe('max_rounds');
    expect(result.rounds).toHaveLength(2);
    expect(result.compileResult.candidateData.sheet_a.name).toBe('新A表');
    expect(result.compileResult.candidateData.sheet_a.updateConfig.contextDepth).toBe(8);
  });

  it('多轮 session working fingerprint 重复时停止', async () => {
    mockCallAIWithPreset.mockImplementation(async (messages: Array<{ role: string; content: string }>) => {
      const payload = parseUserPayload_ACU(messages);
      return `<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${payload.baseFingerprint}","selectedSheetKey":"sheet_a","summary":"无实际变化","warnings":[],"operations":[{"op":"rename_sheet","sheetKey":"sheet_a","newName":"A表"}]}</templateAssistantDraft>`;
    });

    const result = await runTemplateAssistantSession_ACU({
      tempData: buildTempData_ACU(),
      currentSheetKey: 'sheet_a',
      sheetOrder: ['sheet_a'],
      userRequest: '做一个不会产生实际变化的改动',
      maxRounds: 3,
    });

    expect(result.session.stopReason).toBe('repeated_working_fingerprint');
    expect(result.rounds).toHaveLength(1);
  });

  it('多轮 session 修复重试封顶后返回累计 no-op 结果', async () => {
    mockCallAIWithPreset.mockResolvedValue('not-a-valid-draft');

    const result = await runTemplateAssistantSession_ACU({
      tempData: buildTempData_ACU(),
      currentSheetKey: 'sheet_a',
      sheetOrder: ['sheet_a'],
      userRequest: '生成一个坏草稿',
      maxRounds: 2,
      maxRepairRetries: 1,
    });

    expect(mockCallAIWithPreset).toHaveBeenCalledTimes(2);
    expect(result.session.stopReason).toBe('repair_retry_capped');
    expect(result.session.lastErrorMessage).toMatch(/templateAssistantDraft/);
    expect(result.rounds).toHaveLength(0);
    expect(result.compileResult.candidateData.sheet_a.name).toBe('A表');
  });

  it('guard 失效后拒绝晚到异步结果', async () => {
    let resolveAI: ((value: string) => void) | null = null;
    mockCallAIWithPreset.mockImplementation(() => new Promise((resolve) => {
      resolveAI = resolve;
    }));
    const guardController = createTemplateAssistantSessionGuard_ACU();
    const promise = runTemplateAssistantSession_ACU({
      tempData: buildTempData_ACU(),
      currentSheetKey: 'sheet_a',
      sheetOrder: ['sheet_a'],
      userRequest: '等待晚到结果',
      guard: guardController.createRunGuard(),
    });

    guardController.invalidate();
    const fp = buildTemplateAssistantFingerprint_ACU(buildTempData_ACU());
    resolveAI?.(`<templateAssistantDraft>{"protocolVersion":1,"mode":"modify_current_template_incremental","baseFingerprint":"${fp}","selectedSheetKey":"sheet_a","summary":"晚到结果","warnings":[],"operations":[]}</templateAssistantDraft>`);

    await expect(promise).rejects.toMatchObject({ stopReason: 'stale' });
    await expect(promise).rejects.toBeInstanceOf(TemplateAssistantSessionStoppedError_ACU);
  });

  it('guard cancel 状态可供调用方直接判断', () => {
    const guardController = createTemplateAssistantSessionGuard_ACU();
    const guard = guardController.createRunGuard();
    expect(guard.isCancelled?.()).toBe(false);
    guardController.cancel();
    expect(guard.isCancelled?.()).toBe(true);
  });
});
