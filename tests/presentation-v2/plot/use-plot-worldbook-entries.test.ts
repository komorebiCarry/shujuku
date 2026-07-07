/**
 * usePlotWorldbookEntries 单元测试
 *
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

function makeEntry(uid: number, comment: string, enabled = true) {
  return { uid, comment, name: comment, enabled };
}

function createSettings() {
  return {
    plotSettings: {
      plotWorldbookConfig: {
        source: 'character',
        manualSelection: [],
        enabledEntries: {},
      },
    },
  } as any;
}

let settings: ReturnType<typeof createSettings>;
const mockSaveSettings = vi.fn();
const mockGetEntries = vi.fn();
const mockGetAgentSnapshot = vi.fn(() => ({ active: false, selectionSignature: '', createdAt: 0, books: {} }));
const mockSaveEntrySkillMeta = vi.fn();
const mockDeleteEntrySkillMeta = vi.fn();

async function getComposable(presetSettings?: ReturnType<typeof createSettings>, options: Record<string, any> = {}) {
  vi.resetModules();
  settings = presetSettings || createSettings();

  vi.doMock('../../../src/service/runtime/state-manager', () => ({
    settings_ACU: settings,
  }));
  vi.doMock('../../../src/service/settings/settings-service', () => ({
    saveSettings_ACU: mockSaveSettings,
  }));
  vi.doMock('../../../src/service/worldbook/pipeline', () => ({
    getLorebookEntriesByNames_ACU: mockGetEntries,
  }));
  vi.doMock('../../../src/service/agent/agent-worldbook-takeover', () => ({
    getPlotAgentWorldbookSnapshot_ACU: mockGetAgentSnapshot,
  }));
  vi.doMock('../../../src/service/agent/agent-worldbook-skill-meta', () => ({
    deleteWorldbookEntrySkillMeta_ACU: mockDeleteEntrySkillMeta,
    parseWorldbookSkillMetaFromComment_ACU: (comment: unknown) => String(comment || '').includes('ACU_SKILL_META_START')
      ? { description: '已 Skill 化', triggerWhen: '测试触发', tk: 0, updatedBy: 'manual', updatedAt: 1 }
      : null,
    saveWorldbookEntrySkillMeta_ACU: mockSaveEntrySkillMeta,
    stripWorldbookSkillMetaBlock_ACU: (comment: unknown) => String(comment || '').replace(/\n?<!--\s*ACU_SKILL_META_START\s*\n[\s\S]*?\nACU_SKILL_META_END\s*-->\n?/g, '').trim(),
  }));
  vi.doMock('../../../src/service/agent/agent-skillify-service', () => ({
    getWorldbookEntryKeywordsForSkillify_ACU: vi.fn((entry: any) => Array.isArray(entry?.keys)
      ? entry.keys
      : (entry?.key ? [entry.key] : [])),
    isDatabaseGeneratedWorldbookEntryForAgent_ACU: vi.fn((entry: any) => /^(?:ACU-\[[^\]]+\]-)?(?:TavernDB-ACU-|重要人物条目|总结条目|小总结条目)/.test(String(entry?.comment || entry?.name || ''))
      && !String(entry?.comment || entry?.name || '').trim().startsWith('外部导入-')),
    isWorldbookEntrySkillifyCandidate_ACU: vi.fn((entry: any) => entry?.enabled !== false
      && String(entry?.type || '').trim().toLowerCase() !== 'constant'
      && !/^(?:ACU-\[[^\]]+\]-)?(?:TavernDB-ACU-|重要人物条目|总结条目|小总结条目)/.test(String(entry?.comment || entry?.name || ''))
      && !String(entry?.comment || entry?.name || '').trim().startsWith('AGENT_INTERNAL-')),
  }));

  const mod = await import('../../../src/presentation-v2/composables/usePlotWorldbookEntries');
  return mod.usePlotWorldbookEntries(options);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockSaveSettings.mockClear();
  mockGetEntries.mockClear();
  mockGetAgentSnapshot.mockReturnValue({ active: false, selectionSignature: '', createdAt: 0, books: {} });
  mockSaveEntrySkillMeta.mockReset();
  mockDeleteEntrySkillMeta.mockReset();
  mockSaveEntrySkillMeta.mockResolvedValue({ updated: false, reason: 'noop' });
  mockDeleteEntrySkillMeta.mockResolvedValue({ updated: false, reason: 'noop' });
});

describe('usePlotWorldbookEntries', () => {
  it('loadEntries 加载并过滤掉数据库生成条目', async () => {
    mockGetEntries.mockResolvedValue({
      'MyBook': [
        makeEntry(1, '角色设定'),
        makeEntry(2, 'TavernDB-ACU-OutlineTable'),
        makeEntry(3, 'TavernDB-ACU-CharTable'),
        makeEntry(4, '重要人物条目-xx'),
        makeEntry(5, '总结条目-xx'),
        makeEntry(6, '世界观'),
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['MyBook']);

    expect(c.groups.value).toHaveLength(1);
    expect(c.groups.value[0].bookName).toBe('MyBook');
    const uids = c.groups.value[0].entries.map(e => e.uid);
    expect(uids).toContain(1);
    expect(uids).toContain(6);
    expect(uids).not.toContain(2);
    expect(uids).not.toContain(3);
    expect(uids).not.toContain(4);
    expect(uids).not.toContain(5);
  });

  it('loadEntries 显示 active snapshot 命中的 constant 受控条目并标记正文放行', async () => {
    mockGetAgentSnapshot.mockReturnValue({
      active: true,
      selectionSignature: 'test-selection',
      createdAt: Date.now(),
      books: {
        MyBook: [{ uid: 7, previousEnabled: true, previousKeys: ['旧关键词'], previousType: 'selective' }],
      },
    });
    mockGetEntries.mockResolvedValue({
      'MyBook': [
        { uid: 1, comment: '普通条目', name: '普通条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 7, comment: 'legacy snapshot 命中的常驻空关键词条目', name: 'legacy snapshot 命中的常驻空关键词条目', enabled: true, type: 'constant', keys: [] },
        { uid: 8, comment: '大写常量条目', name: '大写常量条目', enabled: true, type: 'CONSTANT', keys: ['常量'] },
        { uid: 9, comment: '带空格常量条目', name: '带空格常量条目', enabled: true, type: ' constant ', keys: ['常量'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['MyBook']);

    expect(c.groups.value[0].entries.map(e => ({ uid: e.uid, state: e.agentTakeoverState }))).toEqual([
      { uid: 1, state: 'native' },
      { uid: 7, state: 'final_greenlight' },
    ]);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries.MyBook).toEqual([1, 7]);
  });

  it('loadEntries 仍隐藏非 snapshot 命中的 constant 条目', async () => {
    mockGetEntries.mockResolvedValue({
      'MyBook': [
        { uid: 1, comment: '普通条目', name: '普通条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 8, comment: '大写常量条目', name: '大写常量条目', enabled: true, type: 'CONSTANT', keys: ['常量'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['MyBook']);

    expect(c.groups.value[0].entries.map(e => e.uid)).toEqual([1]);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries.MyBook).toEqual([1]);
  });

  it('loadEntries 清理历史 enabledEntries 中已隐藏的 constant 条目', async () => {
    settings = createSettings();
    settings.plotSettings.plotWorldbookConfig.enabledEntries = { MyBook: [1, 7, 8] };
    mockGetEntries.mockResolvedValue({
      'MyBook': [
        { uid: 1, comment: '普通条目', name: '普通条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 7, comment: '历史残留常量条目', name: '历史残留常量条目', enabled: true, type: 'constant', keys: [] },
        { uid: 8, comment: '历史残留大写常量条目', name: '历史残留大写常量条目', enabled: true, type: 'CONSTANT', keys: ['常量'] },
      ],
    });

    const c = await getComposable(settings);
    await c.loadEntries(['MyBook']);

    expect(c.groups.value[0].entries.map(e => e.uid)).toEqual([1]);
    expect(c.groups.value[0].entries.map(e => ({ uid: e.uid, checked: e.checked }))).toEqual([
      { uid: 1, checked: true },
    ]);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries.MyBook).toEqual([1]);
    expect(mockSaveSettings).toHaveBeenCalled();
  });

  it('loadEntries 过滤屏蔽词条目', async () => {
    mockGetEntries.mockResolvedValue({
      'B': [
        makeEntry(10, '角色规则'),
        makeEntry(11, '思维链说明'),
        makeEntry(12, '正常条目'),
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['B']);

    const uids = c.groups.value[0].entries.map(e => e.uid);
    expect(uids).toEqual([12]);
  });

  it('loadEntries 分离剧情推进集合与 Agent Skill 化候选集合', async () => {
    mockGetEntries.mockResolvedValue({
      'AgentBook': [
        { uid: 1, comment: '普通关键词条目', name: '普通关键词条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 2, comment: '角色规则关键词条目', name: '角色规则关键词条目', enabled: true, type: 'selective', keys: ['规则'] },
        { uid: 3, comment: '常驻关键词条目', name: '常驻关键词条目', enabled: true, type: 'constant', keys: ['常驻'] },
        { uid: 4, comment: '角色规则\n<!-- ACU_SKILL_META_START\n{"description":"已 Skill 化","triggerWhen":"测试触发","tk":0,"updatedBy":"manual","updatedAt":1}\nACU_SKILL_META_END -->', name: '已 Skill 化规则条目', enabled: true, type: 'selective', keys: [] },
        { uid: 5, comment: '外部导入-TavernDB-ACU-OutlineTable', name: '外部导入条目', enabled: true, type: 'selective', keys: [] },
        { uid: 6, comment: 'TavernDB-ACU-OutlineTable', name: '数据库生成条目', enabled: true, type: 'selective', keys: ['db']},
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['AgentBook']);

    expect(c.groups.value[0].entries.map(e => e.uid)).toEqual([1, 5]);
    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, skillifySelectable: e.skillifySelectable }))).toEqual([
      { uid: 1, skillifySelectable: true },
      { uid: 2, skillifySelectable: true },
      { uid: 3, skillifySelectable: false },
      { uid: 4, skillifySelectable: true },
      { uid: 5, skillifySelectable: true },
    ]);
    expect(c.agentGroups.value[0].entries.find(e => e.uid === 4)?.hasSkill).toBe(true);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries.AgentBook).toEqual([1, 5]);
  });

  it('loadEntries 在 Agent 集合显示 snapshot 命中的 constant disabled 条目但仍过滤数据库生成条目', async () => {
    mockGetAgentSnapshot.mockReturnValue({
      active: true,
      selectionSignature: 'agent-snapshot',
      createdAt: Date.now(),
      books: {
        AgentBook: [{ uid: 7, previousEnabled: false, previousKeys: ['旧关键词'], previousType: 'selective' }],
      },
    });
    mockGetEntries.mockResolvedValue({
      'AgentBook': [
        { uid: 7, comment: 'snapshot 命中的常驻关闭条目', name: 'snapshot 命中的常驻关闭条目', enabled: false, type: 'constant', keys: [] },
        { uid: 8, comment: 'TavernDB-ACU-CharTable', name: '数据库生成条目', enabled: true, type: 'selective', keys: ['db'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['AgentBook']);

    expect(c.groups.value[0].entries.map(e => ({ uid: e.uid, state: e.agentTakeoverState, disabled: e.disabled }))).toEqual([
      { uid: 7, state: 'taken_over', disabled: true },
    ]);
    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, state: e.agentTakeoverState, disabled: e.disabled }))).toEqual([
      { uid: 7, state: 'taken_over', disabled: true },
    ]);
  });

  it('首次加载默认启用所有可见条目', async () => {
    mockGetEntries.mockResolvedValue({
      'X': [makeEntry(1, '好条目'), makeEntry(2, '也好')],
    });

    const c = await getComposable();
    await c.loadEntries(['X']);

    expect(c.groups.value[0].entries.every(e => e.checked)).toBe(true);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries['X']).toEqual([1, 2]);
    expect(mockSaveSettings).toHaveBeenCalled();
  });

  it('已有 enabledEntries 时按已有值设置 checked', async () => {
    settings = createSettings();
    settings.plotSettings.plotWorldbookConfig.enabledEntries = { Y: [2] };

    mockGetEntries.mockResolvedValue({
      'Y': [makeEntry(1, '甲'), makeEntry(2, '乙'), makeEntry(3, '丙')],
    });

    const c = await getComposable(settings);
    await c.loadEntries(['Y']);

    const checks = c.groups.value[0].entries.map(e => ({ uid: e.uid, checked: e.checked }));
    expect(checks).toEqual([
      { uid: 1, checked: false },
      { uid: 2, checked: true },
      { uid: 3, checked: false },
    ]);
  });

  it('toggleEntry 更新 checked 和 enabledEntries', async () => {
    mockGetEntries.mockResolvedValue({
      'Z': [makeEntry(1, 'a'), makeEntry(2, 'b')],
    });

    const c = await getComposable();
    await c.loadEntries(['Z']);
    mockSaveSettings.mockClear();

    c.toggleEntry('Z', 2, false);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries['Z']).toEqual([1]);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.checked).toBe(false);
    expect(mockSaveSettings).toHaveBeenCalledTimes(1);

    c.toggleEntry('Z', 2, true);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries['Z']).toContain(2);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.checked).toBe(true);
  });

  it('selectAll 启用所有非 disabled 条目', async () => {
    mockGetEntries.mockResolvedValue({
      'W': [makeEntry(1, 'ok'), makeEntry(2, 'disabled', false), makeEntry(3, 'ok2')],
    });

    const c = await getComposable();
    settings.plotSettings.plotWorldbookConfig.enabledEntries = { W: [] };
    await c.loadEntries(['W']);
    mockSaveSettings.mockClear();

    c.selectAll();
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries['W']).toEqual([1, 3]);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.checked).toBe(false);
    expect(mockSaveSettings).toHaveBeenCalled();
  });

  it('deselectAll 清空所有条目', async () => {
    mockGetEntries.mockResolvedValue({
      'V': [makeEntry(1, 'a'), makeEntry(2, 'b')],
    });

    const c = await getComposable();
    await c.loadEntries(['V']);
    mockSaveSettings.mockClear();

    c.deselectAll();
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries['V']).toEqual([]);
    expect(c.groups.value[0].entries.every(e => !e.checked)).toBe(true);
    expect(mockSaveSettings).toHaveBeenCalled();
  });

  it('Skill 化勾选独立于条目启用 checked，不写 enabledEntries', async () => {
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, 'a'), makeEntry(2, 'b')],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);
    mockSaveSettings.mockClear();

    c.toggleSkillifyEntry('SkillBook', 2, true);

    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 2 }]);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.skillifySelected).toBe(true);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.checked).toBe(true);
    expect(settings.plotSettings.plotWorldbookConfig.enabledEntries.SkillBook).toEqual([1, 2]);
    expect(mockSaveSettings).not.toHaveBeenCalled();

    c.toggleEntry('SkillBook', 2, false);
    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 2 }]);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.skillifySelected).toBe(true);
    expect(c.groups.value[0].entries.find(e => e.uid === 2)?.checked).toBe(false);
  });

  it('Skill 化全选只选择非 disabled 条目，全不选清空选择', async () => {
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, 'ok'), makeEntry(2, 'disabled', false), makeEntry(3, 'ok2')],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);

    c.selectAllForSkillify();
    expect(c.getSelectedSkillifyEntries()).toEqual([
      { bookName: 'SkillBook', uid: 1 },
      { bookName: 'SkillBook', uid: 3 },
    ]);
    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, skillifySelected: e.skillifySelected, skillifySelectable: e.skillifySelectable }))).toEqual([
      { uid: 1, skillifySelected: true, skillifySelectable: true },
      { uid: 2, skillifySelected: false, skillifySelectable: false },
      { uid: 3, skillifySelected: true, skillifySelectable: true },
    ]);

    c.deselectAllForSkillify();
    expect(c.getSelectedSkillifyEntries()).toEqual([]);
    expect(c.agentGroups.value[0].entries.every(e => !e.skillifySelected)).toBe(true);
  });

  it('Agent 设置显示不可 Skill 化条目，但全选和手动勾选都不能选中它们', async () => {
    mockGetEntries.mockResolvedValue({
      'SkillBook': [
        { uid: 1, comment: '普通关键词条目', name: '普通关键词条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 2, comment: '常驻关键词条目', name: '常驻关键词条目', enabled: true, type: 'constant', keys: ['常驻'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);

    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, skillifySelectable: e.skillifySelectable }))).toEqual([
      { uid: 1, skillifySelectable: true },
      { uid: 2, skillifySelectable: false },
    ]);

    c.selectAllForSkillify();
    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 1 }]);
    expect(c.agentGroups.value[0].entries.find(e => e.uid === 2)?.skillifySelected).toBe(false);

    c.toggleSkillifyEntry('SkillBook', 2, true);
    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 1 }]);
    expect(c.agentGroups.value[0].entries.find(e => e.uid === 2)?.skillifySelected).toBe(false);
  });

  it('loadEntries 清理已经不存在的 Skill 化勾选', async () => {
    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [makeEntry(1, 'a'), makeEntry(2, 'b')],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);
    c.toggleSkillifyEntry('SkillBook', 2, true);

    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [makeEntry(1, 'a')],
    });
    await c.loadEntries(['SkillBook']);

    expect(c.getSelectedSkillifyEntries()).toEqual([]);
    expect(c.groups.value[0].entries.map(e => e.uid)).toEqual([1]);
  });

  it('loadEntries 基于 agentGroups 而不是剧情推进 groups 清理 Skill 化勾选', async () => {
    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [
        { uid: 1, comment: '普通条目', name: '普通条目', enabled: true, type: 'selective', keys: ['普通'] },
        { uid: 2, comment: '角色规则关键词条目', name: '角色规则关键词条目', enabled: true, type: 'selective', keys: ['规则'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);
    c.toggleSkillifyEntry('SkillBook', 2, true);

    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [
        { uid: 2, comment: '角色规则关键词条目', name: '角色规则关键词条目', enabled: true, type: 'selective', keys: ['规则'] },
      ],
    });
    await c.loadEntries(['SkillBook']);

    expect(c.groups.value).toEqual([]);
    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, skillifySelected: e.skillifySelected }))).toEqual([{ uid: 2, skillifySelected: true }]);
    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 2 }]);
  });

  it('loadEntries 会清理仍显示但不再具备 Skill 化资格的历史勾选', async () => {
    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [
        { uid: 2, comment: '角色规则关键词条目', name: '角色规则关键词条目', enabled: true, type: 'selective', keys: ['规则'] },
      ],
    });

    const c = await getComposable();
    await c.loadEntries(['SkillBook']);
    c.toggleSkillifyEntry('SkillBook', 2, true);
    expect(c.getSelectedSkillifyEntries()).toEqual([{ bookName: 'SkillBook', uid: 2 }]);

    mockGetEntries.mockResolvedValueOnce({
      'SkillBook': [
        { uid: 2, comment: '常驻关键词条目', name: '常驻关键词条目', enabled: true, type: 'constant', keys: ['常驻'] },
      ],
    });
    await c.loadEntries(['SkillBook']);

    expect(c.agentGroups.value[0].entries.map(e => ({ uid: e.uid, skillifySelected: e.skillifySelected, skillifySelectable: e.skillifySelectable }))).toEqual([
      { uid: 2, skillifySelected: false, skillifySelectable: false },
    ]);
    expect(c.getSelectedSkillifyEntries()).toEqual([]);
  });

  it('saveEntrySkillMeta 成功更新时同步本地 Skill 状态并调用外部接管同步回调', async () => {
    const onSkillMetaChanged = vi.fn(async () => undefined);
    const updatedComment = '角色条目\n\n<!-- ACU_SKILL_META_START\n{"description":"已 Skill 化","triggerWhen":"测试触发","tk":0,"updatedBy":"manual","updatedAt":1}\nACU_SKILL_META_END -->';
    mockSaveEntrySkillMeta.mockResolvedValue({ updated: true, entry: { uid: 1, comment: updatedComment } });
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, '角色条目')],
    });

    const c = await getComposable(undefined, { onSkillMetaChanged });
    await c.loadEntries(['SkillBook']);

    await c.saveEntrySkillMeta('SkillBook', 1, { description: '已 Skill 化', triggerWhen: '测试触发' }, 'manual');

    expect(mockSaveEntrySkillMeta).toHaveBeenCalledWith('SkillBook', 1, { description: '已 Skill 化', triggerWhen: '测试触发' }, 'manual');
    expect(onSkillMetaChanged).toHaveBeenCalledTimes(1);
    const entry = c.groups.value[0].entries[0];
    expect(entry.hasSkill).toBe(true);
    expect(entry.skillMeta).toEqual(expect.objectContaining({ description: '已 Skill 化' }));
  });

  it('saveEntrySkillMeta 未实际更新时不调用外部接管同步回调', async () => {
    const onSkillMetaChanged = vi.fn(async () => undefined);
    mockSaveEntrySkillMeta.mockResolvedValue({ updated: false, reason: '世界书 Skill 元数据未变化', entry: { uid: 1, comment: '角色条目' } });
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, '角色条目')],
    });

    const c = await getComposable(undefined, { onSkillMetaChanged });
    await c.loadEntries(['SkillBook']);

    await c.saveEntrySkillMeta('SkillBook', 1, { description: '已 Skill 化' }, 'manual');

    expect(onSkillMetaChanged).not.toHaveBeenCalled();
  });

  it('deleteEntrySkillMeta 成功更新时同步本地 Skill 状态并调用外部接管同步回调', async () => {
    const onSkillMetaChanged = vi.fn(async () => undefined);
    mockDeleteEntrySkillMeta.mockResolvedValue({ updated: true, entry: { uid: 1, comment: '角色条目' } });
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, '角色条目\n<!-- ACU_SKILL_META_START\n{"description":"旧 Skill","triggerWhen":"旧触发","tk":0,"updatedBy":"manual","updatedAt":1}\nACU_SKILL_META_END -->')],
    });

    const c = await getComposable(undefined, { onSkillMetaChanged });
    await c.loadEntries(['SkillBook']);

    await c.deleteEntrySkillMeta('SkillBook', 1);

    expect(mockDeleteEntrySkillMeta).toHaveBeenCalledWith('SkillBook', 1);
    expect(onSkillMetaChanged).toHaveBeenCalledTimes(1);
    const entry = c.groups.value[0].entries[0];
    expect(entry.hasSkill).toBe(false);
    expect(entry.skillMeta).toBeNull();
  });

  it('deleteEntrySkillMeta 未实际更新时不调用外部接管同步回调', async () => {
    const onSkillMetaChanged = vi.fn(async () => undefined);
    mockDeleteEntrySkillMeta.mockResolvedValue({ updated: false, reason: '世界书条目没有 Skill 元数据', entry: { uid: 1, comment: '角色条目' } });
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, '角色条目')],
    });

    const c = await getComposable(undefined, { onSkillMetaChanged });
    await c.loadEntries(['SkillBook']);

    await c.deleteEntrySkillMeta('SkillBook', 1);

    expect(mockDeleteEntrySkillMeta).toHaveBeenCalledWith('SkillBook', 1);
    expect(onSkillMetaChanged).not.toHaveBeenCalled();
  });

  it('Skill 元数据保存成功后外部接管同步失败也不阻断调用完成', async () => {
    const onSkillMetaChanged = vi.fn(async () => { throw new Error('sync failed'); });
    const updatedComment = '角色条目\n\n<!-- ACU_SKILL_META_START\n{"description":"已 Skill 化","triggerWhen":"测试触发","tk":0,"updatedBy":"manual","updatedAt":1}\nACU_SKILL_META_END -->';
    mockSaveEntrySkillMeta.mockResolvedValue({ updated: true, entry: { uid: 1, comment: updatedComment } });
    mockGetEntries.mockResolvedValue({
      'SkillBook': [makeEntry(1, '角色条目')],
    });

    const c = await getComposable(undefined, { onSkillMetaChanged });
    await c.loadEntries(['SkillBook']);

    await expect(c.saveEntrySkillMeta('SkillBook', 1, { description: '已 Skill 化' }, 'manual')).resolves.toBeUndefined();

    expect(onSkillMetaChanged).toHaveBeenCalledTimes(1);
    expect(c.groups.value[0].entries[0].hasSkill).toBe(true);
  });


  it('空书名列表返回空 groups', async () => {
    const c = await getComposable();
    await c.loadEntries([]);
    expect(c.groups.value).toEqual([]);
    expect(c.status.value).toBe('success');
  });

  it('toggleGroupExpanded 切换展开状态', async () => {
    mockGetEntries.mockResolvedValue({
      'G': [makeEntry(1, 'x')],
    });

    const c = await getComposable();
    await c.loadEntries(['G']);
    expect(c.groups.value[0].expanded).toBe(false);

    c.toggleGroupExpanded('G');
    expect(c.groups.value[0].expanded).toBe(true);

    c.toggleGroupExpanded('G');
    expect(c.groups.value[0].expanded).toBe(false);
  });
});
