import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShowToastr, mockRunSession, mockApply, state } = vi.hoisted(() => ({
  mockShowToastr: vi.fn(),
  mockRunSession: vi.fn(),
  mockApply: vi.fn(() => true),
  state: {
    tempData: {
      sheet_a: { name: 'A表' },
    } as any,
    currentSheetKey: 'sheet_a',
    sheetOrder: ['sheet_a'],
    deletedSheetKeys: [],
  },
}));

function jqueryStub_ACU(selectorOrElement: any) {
  let elements: HTMLElement[] = [];
  if (typeof selectorOrElement === 'string') {
    elements = Array.from(document.querySelectorAll(selectorOrElement)) as HTMLElement[];
  } else if (selectorOrElement instanceof HTMLElement || (selectorOrElement && typeof selectorOrElement === 'object')) {
    elements = [selectorOrElement];
  }
  const api: any = {
    length: elements.length,
    html(value?: string) {
      if (value === undefined) return elements[0]?.innerHTML || '';
      elements.forEach((el) => { el.innerHTML = value; });
      return api;
    },
    find(selector: string) {
      const found = elements.flatMap((el) => Array.from(el.querySelectorAll(selector)) as HTMLElement[]);
      return jqueryStub_ACU(found[0] ?? { __elements: found });
    },
    on(event: string, handler: any) {
      elements.forEach((el) => el.addEventListener(event, handler));
      return api;
    },
    val(value?: string) {
      const el = elements[0] as HTMLInputElement | HTMLTextAreaElement | undefined;
      if (!el) return value === undefined ? '' : api;
      if (value === undefined) return el.value;
      el.value = value;
      return api;
    },
    data(name: string) {
      return elements[0]?.getAttribute(`data-${name}`);
    },
    prop(name: string) {
      return (elements[0] as any)?.[name];
    },
  };
  if ((selectorOrElement as any)?.__elements) {
    elements = (selectorOrElement as any).__elements;
    api.length = elements.length;
  }
  return api;
}

type ListenerMap_ACU = Record<string, Array<(event?: any) => any>>;

class FakeHTMLElement_ACU {
  private _innerHTML = '';
  style: Record<string, string> = {};
  value = '';
  disabled = false;
  checked = false;
  listeners: ListenerMap_ACU = {};
  attributes: Record<string, string> = {};

  constructor(private readonly selector: string, private readonly owner: FakeDocument_ACU) {}

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(value: string) {
    this._innerHTML = String(value || '');
    this.owner.invalidateCache();
  }

  addEventListener(event: string, handler: any) {
    this.listeners[event] ||= [];
    this.listeners[event].push(handler);
  }

  dispatchEvent(event: any) {
    const type = String(event?.type || '');
    const handlers = this.listeners[type] || [];
    handlers.forEach((handler) => handler.call(this, event));
  }

  click() {
    this.dispatchEvent({ type: 'click' });
  }

  getAttribute(name: string) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  querySelectorAll(selector: string) {
    return this.owner.querySelectorAll(selector);
  }

  syncFromHtml(html: string) {
    if (this.selector === '#acu-vis-assistant-host') {
      this._innerHTML = html;
      return;
    }

    if (this.selector === '.acu-vis-assistant-panel') {
      const styleMatch = html.match(/class="acu-vis-assistant-panel"[^>]*style="([^"]*)"/);
      const styleStr = styleMatch?.[1] || '';
      const displayMatch = styleStr.match(/display\s*:\s*([^;]+)/);
      this.style.display = displayMatch ? displayMatch[1].trim() : '';
      const overflowMatch = styleStr.match(/overflow\s*:\s*([^;]+)/);
      this.style.overflow = overflowMatch ? overflowMatch[1].trim() : '';
      const heightMatch = styleStr.match(/height\s*:\s*([^;]+)/);
      this.style.height = heightMatch ? heightMatch[1].trim() : '';
      return;
    }

    if (this.selector === '.acu-vis-assistant-body') {
      const styleMatch = html.match(/class="acu-vis-assistant-body"[^>]*style="([^"]*)"/);
      const styleStr = styleMatch?.[1] || '';
      const overflowYMatch = styleStr.match(/overflow-y\s*:\s*([^;]+)/);
      this.style.overflowY = overflowYMatch ? overflowYMatch[1].trim() : '';
      const flexMatch = styleStr.match(/flex\s*:\s*([^;]+)/);
      this.style.flex = flexMatch ? flexMatch[1].trim() : '';
      const minHeightMatch = styleStr.match(/min-height\s*:\s*([^;]+)/);
      this.style.minHeight = minHeightMatch ? minHeightMatch[1].trim() : '';
      return;
    }

    if (this.selector.startsWith('#')) {
      const id = this.selector.slice(1);
      const match = html.match(new RegExp(`<([a-zA-Z0-9-]+)[^>]*id="${id}"([^>]*)>`, 'i'));
      const attrs = match?.[2] || '';
      this.disabled = /disabled/.test(attrs);
      const dataRiskKeyMatch = attrs.match(/data-risk-key="([^"]+)"/);
      this.attributes = dataRiskKeyMatch ? { 'data-risk-key': dataRiskKeyMatch[1] } : {};
      return;
    }

    if (this.selector === '.acu-assistant-risk-confirm') {
      const match = html.match(/class="acu-assistant-risk-confirm"[^>]*data-risk-key="([^"]+)"([^>]*)/);
      if (match) {
        this.attributes = { 'data-risk-key': match[1] };
        this.checked = /checked/.test(match[2] || '');
      }
    }

    if (this.selector === '.acu-assistant-round-toggle') {
      const match = html.match(/class="acu-btn-small acu-assistant-round-toggle"[^>]*data-round-toggle="([^"]+)"/);
      if (match) {
        this.attributes = { 'data-round-toggle': match[1] };
      }
    }

    if (this.selector === '.acu-assistant-round-item') {
      const match = html.match(/class="acu-assistant-round-item"[^>]*data-round-index="([^"]+)"/);
      if (match) {
        this.attributes = { 'data-round-index': match[1] };
      }
    }
  }
}

class FakeDocument_ACU {
  private elementCache = new Map<string, FakeHTMLElement_ACU[]>();
  body = new FakeHTMLElement_ACU('#acu-vis-assistant-host', this);

  invalidateCache() {
    this.elementCache.clear();
  }

  private buildElements(selector: string) {
    const html = this.body.innerHTML;
    if (selector === '#acu-vis-assistant-host') {
      this.body.syncFromHtml(html);
      return [this.body];
    }
    if (selector === '.acu-vis-assistant-panel') {
      if (!html.includes('acu-vis-assistant-panel')) return [];
      const el = new FakeHTMLElement_ACU(selector, this);
      el.syncFromHtml(html);
      return [el];
    }
    if (selector === '.acu-vis-assistant-body') {
      if (!html.includes('acu-vis-assistant-body')) return [];
      const el = new FakeHTMLElement_ACU(selector, this);
      el.syncFromHtml(html);
      return [el];
    }
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      if (!new RegExp(`id="${id}"`, 'i').test(html)) return [];
      const el = new FakeHTMLElement_ACU(selector, this);
      el.syncFromHtml(html);
      return [el];
    }
    if (selector === '.acu-assistant-risk-confirm') {
      if (!html.includes('acu-assistant-risk-confirm')) return [];
      const matches = Array.from(html.matchAll(/class="acu-assistant-risk-confirm"[^>]*data-risk-key="([^"]+)"([^>]*)/g));
      return matches.map((match) => {
        const el = new FakeHTMLElement_ACU(selector, this);
        el.attributes = { 'data-risk-key': match[1] };
        el.checked = /checked/.test(match[2] || '');
        return el;
      });
    }
    if (selector === '.acu-assistant-round-toggle') {
      if (!html.includes('acu-assistant-round-toggle')) return [];
      const matches = Array.from(html.matchAll(/class="acu-btn-small acu-assistant-round-toggle"[^>]*data-round-toggle="([^"]+)"/g));
      return matches.map((match) => {
        const el = new FakeHTMLElement_ACU(selector, this);
        el.attributes = { 'data-round-toggle': match[1] };
        return el;
      });
    }
    if (selector === '.acu-assistant-round-item') {
      if (!html.includes('acu-assistant-round-item')) return [];
      const matches = Array.from(html.matchAll(/class="acu-assistant-round-item"[^>]*data-round-index="([^"]+)"/g));
      return matches.map((match) => {
        const el = new FakeHTMLElement_ACU(selector, this);
        el.attributes = { 'data-round-index': match[1] };
        return el;
      });
    }
    return [];
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector: string) {
    if (!this.elementCache.has(selector)) {
      this.elementCache.set(selector, this.buildElements(selector));
    }
    return this.elementCache.get(selector) || [];
  }
}

class FakeEvent_ACU {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

const fakeDocument_ACU = new FakeDocument_ACU();

(globalThis as any).document = fakeDocument_ACU;
(globalThis as any).window = { Event: FakeEvent_ACU };
(globalThis as any).HTMLElement = FakeHTMLElement_ACU;
(globalThis as any).Event = FakeEvent_ACU;

vi.mock('../../src/presentation/theme/toast', () => ({
  showToastr_ACU: mockShowToastr,
}));

vi.mock('../../src/service/template-assistant/service', () => ({
  runTemplateAssistantSession_ACU: mockRunSession,
  createTemplateAssistantSessionGuard_ACU: () => ({
    createRunGuard: () => ({
      isCancelled: () => false,
      isStale: () => false,
    }),
    invalidate: () => {},
    cancel: () => {},
    reset: () => {},
  }),
  TemplateAssistantSessionStoppedError_ACU: class extends Error {
    constructor(stopReason: string) {
      super(stopReason === 'cancelled' ? '模板助手会话已取消' : '模板助手会话已过期');
      this.name = 'TemplateAssistantSessionStoppedError_ACU';
    }
  },
}));

vi.mock('../../src/presentation/pages/visualizer-template-assistant-apply', () => ({
  applyTemplateAssistantDraftToVisualizer_ACU: mockApply,
}));

vi.mock('../../src/presentation/pages/visualizer', () => ({
  _acuVisState: state,
}));

vi.mock('../../src/presentation/dom-utils', () => ({
  jQuery_API_ACU: jqueryStub_ACU,
}));

vi.mock('../../src/shared/html-helpers', () => ({
  escapeHtml_ACU: (v: string) => v,
}));

import {
  handleVisualizerTemplateAssistantSheetChange_ACU,
  invalidateVisualizerTemplateAssistantSession_ACU,
  renderVisualizerTemplateAssistantPanel_ACU,
  setVisualizerTemplateAssistantOpen_ACU,
} from '../../src/presentation/pages/visualizer-template-assistant';

function buildSingleRoundResult() {
  return {
    draft: { selectedSheetKey: 'sheet_a', summary: '新增战利品表', warnings: ['注意命名一致性'], operations: [{ op: 'add_sheet', name: '战利品表' }] },
    aiRawText: '',
    messages: [],
    compileResult: {
      diff: {
        addedSheets: [{ sheetKey: 'sheet_new', name: '战利品表' }],
        deletedSheets: [],
        renamedSheets: [{ sheetKey: 'sheet_a', beforeName: 'A表', afterName: '新A表' }],
        movedSheets: [],
        patchedSourceDataSheets: [],
        patchedUpdateConfigSheets: [{ sheetKey: 'sheet_a', name: 'A表', keys: ['contextDepth'] }],
        patchedExportConfigSheets: [],
        globalInjectionChanged: false,
      },
      highRiskItems: [],
      candidateData: {},
      orderedSheetKeys: ['sheet_a', 'sheet_new'],
      focusSheetKey: 'sheet_a',
      deletedSheetKeys: [],
    },
    originalBaseFingerprint: 'fp-orig',
    rounds: [],
    session: {
      originalBaseFingerprint: 'fp-orig',
      finalWorkingFingerprint: 'fp-final',
      stopReason: 'empty_operations',
      roundsExecuted: 1,
      maxRounds: 3,
      repairRetriesUsed: 0,
      maxRepairRetries: 1,
      lastErrorMessage: '',
    },
  };
}

function buildMultiRoundResult() {
  return {
    draft: { selectedSheetKey: 'sheet_a', summary: '最终草稿', warnings: [], operations: [] },
    aiRawText: '',
    messages: [],
    compileResult: {
      diff: {
        addedSheets: [{ sheetKey: 'sheet_new1', name: '表1' }, { sheetKey: 'sheet_new2', name: '表2' }],
        deletedSheets: [],
        renamedSheets: [],
        movedSheets: [],
        patchedSourceDataSheets: [],
        patchedUpdateConfigSheets: [],
        patchedExportConfigSheets: [],
        globalInjectionChanged: false,
      },
      highRiskItems: [],
      candidateData: {},
      orderedSheetKeys: ['sheet_a', 'sheet_new1', 'sheet_new2'],
      focusSheetKey: 'sheet_a',
      deletedSheetKeys: [],
    },
    originalBaseFingerprint: 'fp-orig',
    rounds: [
      {
        round: 1,
        userRequest: '新增表',
        draft: { selectedSheetKey: 'sheet_a', summary: '第1轮摘要：新增表1', warnings: [], operations: [{ op: 'add_sheet', name: '表1' }] },
        aiRawText: '',
        messages: [],
        perRoundCompileResult: {
          diff: {
            addedSheets: [{ sheetKey: 'sheet_new1', name: '表1' }],
            deletedSheets: [],
            renamedSheets: [],
            movedSheets: [],
            patchedSourceDataSheets: [],
            patchedUpdateConfigSheets: [],
            patchedExportConfigSheets: [],
            globalInjectionChanged: false,
          },
          highRiskItems: [],
          candidateData: {},
          orderedSheetKeys: ['sheet_a', 'sheet_new1'],
          focusSheetKey: 'sheet_a',
          deletedSheetKeys: [],
        },
        workingFingerprint: 'fp-round1',
      },
      {
        round: 2,
        userRequest: '新增表',
        draft: { selectedSheetKey: 'sheet_a', summary: '第2轮摘要：新增表2', warnings: ['注意'], operations: [{ op: 'add_sheet', name: '表2' }] },
        aiRawText: '',
        messages: [],
        perRoundCompileResult: {
          diff: {
            addedSheets: [{ sheetKey: 'sheet_new2', name: '表2' }],
            deletedSheets: [],
            renamedSheets: [],
            movedSheets: [],
            patchedSourceDataSheets: [],
            patchedUpdateConfigSheets: [],
            patchedExportConfigSheets: [],
            globalInjectionChanged: false,
          },
          highRiskItems: [],
          candidateData: {},
          orderedSheetKeys: ['sheet_a', 'sheet_new1', 'sheet_new2'],
          focusSheetKey: 'sheet_a',
          deletedSheetKeys: [],
        },
        workingFingerprint: 'fp-round2',
      },
    ],
    session: {
      originalBaseFingerprint: 'fp-orig',
      finalWorkingFingerprint: 'fp-final',
      stopReason: 'max_rounds',
      roundsExecuted: 2,
      maxRounds: 3,
      repairRetriesUsed: 0,
      maxRepairRetries: 1,
      lastErrorMessage: '',
    },
  };
}

describe('visualizer template assistant panel', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="acu-vis-assistant-host"></div>';
    fakeDocument_ACU.invalidateCache();
    mockShowToastr.mockReset();
    mockRunSession.mockReset();
    mockApply.mockReset();
    mockApply.mockReturnValue(true);
    state.tempData = { sheet_a: { name: 'A表' } } as any;
    state.currentSheetKey = 'sheet_a';
    state.sheetOrder = ['sheet_a'];
    state.deletedSheetKeys = [];
  });

  it('panel 能打开和关闭', () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    expect(document.querySelector('.acu-vis-assistant-panel')).toBeTruthy();

    const closeBtn = document.querySelector('#acu-vis-assistant-close') as HTMLButtonElement;
    closeBtn.click();
    expect((document.querySelector('.acu-vis-assistant-panel') as HTMLElement).style.display).toBe('none');
  });

  it('生成时调用 runTemplateAssistantSession_ACU 并传入最新快照', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    state.tempData.sheet_b = { name: 'B表' } as any;
    mockRunSession.mockResolvedValue(buildSingleRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增';
    textarea.dispatchEvent(new Event('input'));
    const btn = document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement;
    btn.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(mockRunSession.mock.calls[0][0].tempData.sheet_b.name).toBe('B表');
  });

  it('单轮结果能展示 diff 和 session meta', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    mockRunSession.mockResolvedValue(buildSingleRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增战利品表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.innerHTML).toContain('战利品表 [sheet_new]');
    expect(document.body.innerHTML).toContain('A表: contextDepth');
    expect(document.body.innerHTML).toContain('A表 -> 新A表');
    expect(document.body.innerHTML).toContain('轮次: 1/3');
    expect(document.body.innerHTML).toContain('结束原因');
  });

  it('多轮结果能展示轮次历史', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    mockRunSession.mockResolvedValue(buildMultiRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增两张表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.innerHTML).toContain('轮次历史');
    expect(document.body.innerHTML).toContain('第 1 轮');
    expect(document.body.innerHTML).toContain('第 2 轮');
    expect(document.body.innerHTML).toContain('第1轮摘要：新增表1');
    expect(document.body.innerHTML).toContain('第2轮摘要：新增表2');
  });

  it('能展开/收起轮次详情', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    mockRunSession.mockResolvedValue(buildMultiRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增两张表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    // 初始状态轮次详情应该收起
    expect(document.body.innerHTML).not.toContain('本轮变更 diff');

    // 点击第一个轮次的展开按钮
    const toggleBtns = document.querySelectorAll('.acu-assistant-round-toggle') as unknown as HTMLButtonElement[];
    expect(toggleBtns.length).toBeGreaterThan(0);
    toggleBtns[0].click();

    // 展开后应该显示详情
    expect(document.body.innerHTML).toContain('本轮变更 diff');
    expect(document.body.innerHTML).toContain('表1 [sheet_new1]');

    // 再次点击收起
    toggleBtns[0].click();
    expect(document.body.innerHTML).not.toContain('本轮变更 diff');
  });

  it('存在高风险项时未确认前应用按钮不可用', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    const result = buildSingleRoundResult();
    result.compileResult.highRiskItems = [{ type: 'delete_sheet', label: '删除表: A表' }];
    result.compileResult.diff.deletedSheets = [{ sheetKey: 'sheet_a', name: 'A表' }];
    mockRunSession.mockResolvedValue(result);

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '删除旧表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect((document.querySelector('#acu-vis-assistant-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('切换当前表时会刷新标题并清空旧草稿', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    mockRunSession.mockResolvedValue(buildSingleRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增战利品表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.innerHTML).toContain('当前表：A表 (sheet_a)');
    expect(document.body.innerHTML).toContain('战利品表 [sheet_new]');

    state.tempData.sheet_b = { name: 'B表' } as any;
    state.currentSheetKey = 'sheet_b';
    handleVisualizerTemplateAssistantSheetChange_ACU();

    expect(document.body.innerHTML).toContain('当前表：B表 (sheet_b)');
    expect(document.body.innerHTML).not.toContain('战利品表 [sheet_new]');
  });

  it('多条高风险操作需要逐项确认', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    const result = buildSingleRoundResult();
    result.draft.summary = '删除多张旧表';
    result.compileResult.highRiskItems = [
      { type: 'delete_sheet', label: '删除表: A表' },
      { type: 'delete_sheet', label: '删除表: B表' },
    ];
    result.compileResult.diff.deletedSheets = [{ sheetKey: 'sheet_a', name: 'A表' }, { sheetKey: 'sheet_b', name: 'B表' }];
    mockRunSession.mockResolvedValue(result);

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '删除两张旧表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    const checkboxes = document.querySelectorAll('.acu-assistant-risk-confirm') as unknown as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect((document.querySelector('#acu-vis-assistant-apply') as HTMLButtonElement).disabled).toBe(true);

    checkboxes[0].checked = true;
    checkboxes[0].dispatchEvent(new Event('change'));

    expect((document.querySelector('#acu-vis-assistant-apply') as HTMLButtonElement).disabled).toBe(true);
  });

  it('panel 使用 flex containment 模式确保内部滚动', () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();

    const panel = document.querySelector('.acu-vis-assistant-panel') as HTMLElement;
    expect(panel).toBeTruthy();
    expect(panel.style.overflow).toBe('hidden');

    const body = document.querySelector('.acu-vis-assistant-body') as HTMLElement;
    expect(body).toBeTruthy();
    expect(body.style.overflowY).toBe('auto');
    expect(body.style.flex).toBe('1');
    expect(body.style.minHeight).toBe('0');
  });

  it('调用 invalidateVisualizerTemplateAssistantSession_ACU 会清空结果', async () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();
    mockRunSession.mockResolvedValue(buildSingleRoundResult());

    const textarea = document.querySelector('#acu-vis-assistant-input') as HTMLTextAreaElement;
    textarea.value = '新增战利品表';
    textarea.dispatchEvent(new Event('input'));
    (document.querySelector('#acu-vis-assistant-generate') as HTMLButtonElement).click();
    await Promise.resolve();
    await Promise.resolve();

    expect(document.body.innerHTML).toContain('战利品表 [sheet_new]');

    invalidateVisualizerTemplateAssistantSession_ACU();

    expect(document.body.innerHTML).not.toContain('战利品表 [sheet_new]');
  });

  it('停止按钮存在且初始不可用', () => {
    setVisualizerTemplateAssistantOpen_ACU(true);
    renderVisualizerTemplateAssistantPanel_ACU();

    const stopBtn = document.querySelector('#acu-vis-assistant-stop') as HTMLButtonElement;
    expect(stopBtn).toBeTruthy();
    expect(stopBtn.disabled).toBe(true);
  });
});