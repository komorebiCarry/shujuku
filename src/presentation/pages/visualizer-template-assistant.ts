import {
    createTemplateAssistantSessionGuard_ACU,
    runTemplateAssistantSession_ACU,
    TemplateAssistantSessionStoppedError_ACU,
    type TemplateAssistantSessionGuardController_ACU,
    type TemplateAssistantSessionProgress_ACU,
    type TemplateAssistantSessionResult_ACU,
    type TemplateAssistantSessionRound_ACU,
} from '../../service/template-assistant/service';
import { escapeHtml_ACU } from '../../shared/html-helpers';
import { jQuery_API_ACU } from '../dom-utils';
import { showToastr_ACU } from '../theme/toast';
import { applyTemplateAssistantDraftToVisualizer_ACU } from './visualizer-template-assistant-apply';
import { _acuVisState } from './visualizer';

type ChatTurnUser = {
    type: 'user';
    id: string;
    content: string;
    timestamp: number;
};

type ChatTurnAssistantPreview = {
    type: 'assistant';
    phase: 'round';
    id: string;
    roundData: TemplateAssistantSessionRound_ACU;
    maxRounds: number;
    riskConfirmations: Record<string, boolean>;
    expandedSections: Record<string, boolean>;
    timestamp: number;
};

type ChatTurnAssistantFinal = {
    type: 'assistant';
    phase: 'final';
    id: string;
    result: TemplateAssistantSessionResult_ACU;
    riskConfirmations: Record<string, boolean>;
    expandedSections: Record<string, boolean>;
    timestamp: number;
};

type ChatTurnAssistant = ChatTurnAssistantPreview | ChatTurnAssistantFinal;

type ChatTurnError = {
    type: 'error';
    id: string;
    errorMessage: string;
    timestamp: number;
};

type ChatTurn = ChatTurnUser | ChatTurnAssistant | ChatTurnError;

type AssistantUiState = {
    isOpen: boolean;
    userRequest: string;
    isGenerating: boolean;
    transcript: ChatTurn[];
    pendingScrollTop: number;
    pendingScrollMode: 'preserve' | 'stick-bottom';
    maxRoundsInput: string;
    guardController: TemplateAssistantSessionGuardController_ACU | null;
    runningSessionId: number;
};

const assistantUiState_ACU: AssistantUiState = {
    isOpen: false,
    userRequest: '',
    isGenerating: false,
    transcript: [],
    pendingScrollTop: 0,
    pendingScrollMode: 'preserve',
    maxRoundsInput: '3',
    guardController: null,
    runningSessionId: 0,
};

function generateTurnId_ACU() {
    return `turn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const NEAR_BOTTOM_THRESHOLD_ACU = 50;

const DEFAULT_MAX_ROUNDS_ACU = 3;

function normalizeMaxRounds_ACU(input: string): number {
    const normalized = Number(input);
    if (!Number.isFinite(normalized)) return DEFAULT_MAX_ROUNDS_ACU;
    const integer = Math.floor(normalized);
    return integer > 0 ? integer : DEFAULT_MAX_ROUNDS_ACU;
}

function isNearBottom_ACU(container: HTMLElement | null | undefined): boolean {
    if (!container) return true;
    const scrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;
    const scrollHeight = container.scrollHeight;
    return scrollTop + clientHeight >= scrollHeight - NEAR_BOTTOM_THRESHOLD_ACU;
}

function getChatContainerElement_ACU() {
    const $container = getHost_ACU().find('.acu-chat-container');
    return $container.length ? ($container[0] as HTMLElement) : null;
}

function getMaxScrollTop_ACU(container: HTMLElement | null | undefined) {
    if (!container) return 0;
    return Math.max(0, Number(container.scrollHeight || 0) - Number(container.clientHeight || 0));
}

function captureScrollState_ACU(mode: 'append' | 'preserve') {
    const container = getChatContainerElement_ACU();
    const currentScrollTop = container?.scrollTop ?? 0;
    const maxScrollTop = getMaxScrollTop_ACU(container);
    assistantUiState_ACU.pendingScrollMode = mode === 'append' && isNearBottom_ACU(container)
        ? 'stick-bottom'
        : 'preserve';
    assistantUiState_ACU.pendingScrollTop = assistantUiState_ACU.pendingScrollMode === 'stick-bottom'
        ? maxScrollTop
        : currentScrollTop;
}

function restoreScrollState_ACU(container: HTMLElement | null | undefined) {
    if (!container) return;
    if (assistantUiState_ACU.pendingScrollMode === 'stick-bottom') {
        container.scrollTop = getMaxScrollTop_ACU(container);
        return;
    }
    container.scrollTop = assistantUiState_ACU.pendingScrollTop;
}

function clearAssistantDraftState_ACU() {
    assistantUiState_ACU.transcript = [];
}

function createNewGuardController_ACU() {
    assistantUiState_ACU.guardController = createTemplateAssistantSessionGuard_ACU();
    assistantUiState_ACU.runningSessionId += 1;
}

function invalidateActiveSession_ACU() {
    if (assistantUiState_ACU.guardController) {
        assistantUiState_ACU.guardController.invalidate();
    }
    if (assistantUiState_ACU.isGenerating) {
        assistantUiState_ACU.isGenerating = false;
        showToastr_ACU('warning', '会话已失效（结构变化或切表）');
    }
}

function cancelActiveSession_ACU() {
    if (assistantUiState_ACU.guardController) {
        assistantUiState_ACU.guardController.cancel();
    }
    if (assistantUiState_ACU.isGenerating) {
        assistantUiState_ACU.isGenerating = false;
        showToastr_ACU('warning', '模板助手会话已取消');
        renderVisualizerTemplateAssistantPanel_ACU();
    }
}

function isFinalAssistantTurn_ACU(turn: ChatTurnAssistant): turn is ChatTurnAssistantFinal {
    return turn.phase === 'final';
}

function getAssistantDraft_ACU(turn: ChatTurnAssistant) {
    return isFinalAssistantTurn_ACU(turn) ? turn.result.draft : turn.roundData.draft;
}

function getAssistantCompileResult_ACU(turn: ChatTurnAssistant) {
    return isFinalAssistantTurn_ACU(turn) ? turn.result.compileResult : turn.roundData.perRoundCompileResult;
}

function getAssistantAiRawText_ACU(turn: ChatTurnAssistant) {
    return isFinalAssistantTurn_ACU(turn) ? turn.result.aiRawText : turn.roundData.aiRawText;
}

function buildAssistantRoundProgressLabel_ACU(turn: ChatTurnAssistant) {
    if (isFinalAssistantTurn_ACU(turn)) {
        return buildSessionMetaSummary_ACU(turn.result);
    }
    return `第 ${turn.roundData.round} / ${turn.maxRounds} 轮`;
}

function buildPriorTurnsFromTranscript_ACU(transcript: ChatTurn[]): Array<{ user: string; assistant?: string }> {
    const priorTurns: Array<{ user: string; assistant?: string }> = [];
    for (let i = 0; i < transcript.length; i++) {
        const turn = transcript[i];
        if (turn.type === 'user') {
            const userContent = String(turn.content || '').trim();
            if (!userContent) continue;
            // 查找紧跟的 assistant turn（可能不存在或中间有 error turn）
            let assistantText: string | undefined = undefined;
            for (let j = i + 1; j < transcript.length; j++) {
                const nextTurn = transcript[j];
                if (nextTurn.type === 'user') {
                    // 遇到下一个 user turn，说明当前 user 没有对应的 assistant
                    break;
                }
                if (nextTurn.type === 'assistant' && isFinalAssistantTurn_ACU(nextTurn)) {
                    assistantText = String(getAssistantAiRawText_ACU(nextTurn) || '').trim();
                }
                // error turn 跳过，继续查找可能的 assistant
            }
            priorTurns.push({
                user: userContent,
                assistant: assistantText || undefined,
            });
        }
    }
    return priorTurns;
}

function getRiskConfirmationKey_ACU(index: number) {
    return String(index);
}

function getHost_ACU() {
    return jQuery_API_ACU('#acu-vis-assistant-host');
}

function readDataAttrFromElement_ACU(node: unknown, name: string) {
    if (!node || typeof node !== 'object' || !('getAttribute' in (node as any))) return '';
    return String((node as any).getAttribute(`data-${name}`) || '');
}

function getApplyButtonElement_ACU() {
    if (typeof document === 'undefined') return null;
    return document.querySelector('#acu-vis-assistant-apply') as HTMLButtonElement | null;
}

function getSelectedSheetLabel_ACU() {
    const sheetKey = _acuVisState.currentSheetKey;
    const sheet = sheetKey ? _acuVisState.tempData?.[sheetKey] : null;
    if (!sheetKey || !sheet) return '当前未选中表';
    return `${sheet.name || sheetKey} (${sheetKey})`;
}

type TemplateAssistantDiff_ACU = TemplateAssistantSessionResult_ACU['compileResult']['diff'];

function buildSessionStopReasonLabel_ACU(result: TemplateAssistantSessionResult_ACU) {
    const stopReason = String(result.session?.stopReason || '');
    switch (stopReason) {
        case 'empty_operations':
            return '空操作停止';
        case 'repeated_working_fingerprint':
            return '重复状态停止';
        case 'repair_retry_capped':
            return '修复重试已达上限';
        case 'max_rounds':
            return '达到轮次上限';
        default:
            return '';
    }
}

function buildSessionMetaSummary_ACU(result: TemplateAssistantSessionResult_ACU) {
    if (!result.session) return '';
    const parts = [`会话${result.session.roundsExecuted}轮`];
    const stopReasonLabel = buildSessionStopReasonLabel_ACU(result);
    if (stopReasonLabel) parts.push(stopReasonLabel);
    return parts.join(' · ');
}

function countDiffChanges_ACU(diff: TemplateAssistantDiff_ACU): number {
    let count = 0;
    count += diff.addedSheets.length;
    count += diff.deletedSheets.length;
    count += diff.renamedSheets.length;
    count += diff.movedSheets.length;
    count += diff.patchedSourceDataSheets.length;
    count += diff.patchedUpdateConfigSheets.length;
    count += diff.patchedExportConfigSheets.length;
    count += (diff.patchedContentSheets || []).length;
    count += (diff.patchedSchemaSheets || []).length;
    count += (diff.patchedLockSheets || []).length;
    if (diff.globalInjectionChanged) count += 1;
    return count;
}

function buildDiffSummary_ACU(diff: TemplateAssistantDiff_ACU): string {
    const parts: string[] = [];
    if (diff.addedSheets.length) parts.push(`新增${diff.addedSheets.length}表`);
    if (diff.deletedSheets.length) parts.push(`删除${diff.deletedSheets.length}表`);
    if (diff.renamedSheets.length) parts.push(`重命名${diff.renamedSheets.length}表`);
    if (diff.movedSheets.length) parts.push(`移动${diff.movedSheets.length}表`);
    const patchCount = diff.patchedSourceDataSheets.length + diff.patchedUpdateConfigSheets.length + diff.patchedExportConfigSheets.length + (diff.patchedContentSheets || []).length + (diff.patchedSchemaSheets || []).length + (diff.patchedLockSheets || []).length;
    if (patchCount) parts.push(`修改${patchCount}处`);
    if (diff.globalInjectionChanged) parts.push('全局配置变更');
    return parts.length ? parts.join('、') : '无变更';
}

function buildDiffHtml_ACU(diff: TemplateAssistantDiff_ACU) {
    const sections: string[] = [];
    const renderList = (items: string[]) => items.length ? `<ul>${items.map((item) => `<li>${escapeHtml_ACU(item)}</li>`).join('')}</ul>` : '<div class="acu-hint">无</div>';

    sections.push(`<div class="acu-assistant-diff-block"><strong>新增表</strong>${renderList(diff.addedSheets.map((item) => `${item.name} [${item.sheetKey}]`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>删除表</strong>${renderList(diff.deletedSheets.map((item) => `${item.name} [${item.sheetKey}]`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>重命名</strong>${renderList(diff.renamedSheets.map((item) => `${item.beforeName} -> ${item.afterName}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>顺序变化</strong>${renderList(diff.movedSheets.map((item) => `${item.name}: ${item.fromIndex} -> ${item.toIndex}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>sourceData patch</strong>${renderList(diff.patchedSourceDataSheets.map((item) => `${item.name}: ${item.keys.join(', ') || '字段已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>updateConfig patch</strong>${renderList(diff.patchedUpdateConfigSheets.map((item) => `${item.name}: ${item.keys.join(', ') || '字段已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>exportConfig patch</strong>${renderList(diff.patchedExportConfigSheets.map((item) => `${item.name}: ${item.keys.join(', ') || '字段已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>content patch</strong>${renderList((diff.patchedContentSheets || []).map((item) => `${item.name}: ${item.changes.join('；') || '内容已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>schema patch</strong>${renderList((diff.patchedSchemaSheets || []).map((item) => `${item.name}: ${item.changes.join('；') || '结构已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>locks patch</strong>${renderList((diff.patchedLockSheets || []).map((item) => `${item.name}: ${item.changes.join('；') || '锁状态已修改'}`))}</div>`);
    sections.push(`<div class="acu-assistant-diff-block"><strong>全局注入配置</strong>${diff.globalInjectionChanged ? '<div>已修改</div>' : '<div class="acu-hint">未修改</div>'}</div>`);
    return sections.join('');
}

function areHighRiskItemsConfirmed_ACU(turn: ChatTurnAssistant) {
    return getAssistantCompileResult_ACU(turn).highRiskItems.every((_, index) => turn.riskConfirmations[getRiskConfirmationKey_ACU(index)]);
}

function syncLatestApplyButtonDisabledState_ACU(turn: ChatTurnAssistant) {
    const latestTurn = assistantUiState_ACU.transcript[assistantUiState_ACU.transcript.length - 1];
    if (!latestTurn || latestTurn.type !== 'assistant' || latestTurn.id !== turn.id) return;
    if (!isFinalAssistantTurn_ACU(turn)) return;

    const button = getApplyButtonElement_ACU();
    if (!button) return;

    const applyDisabled = getAssistantCompileResult_ACU(turn).highRiskItems.length > 0 && !areHighRiskItemsConfirmed_ACU(turn);
    button.disabled = applyDisabled;
}

function renderCollapsedSection_ACU(title: string, summary: string, sectionKey: string, expanded: boolean, detailContent: string) {
    const expandIcon = expanded ? '▼' : '▶';
    const detailStyle = expanded ? '' : 'display:none;';
    return `
        <div class="acu-collapsible-section" data-section-key="${escapeHtml_ACU(sectionKey)}">
            <div class="acu-collapsed-summary" data-section-key="${escapeHtml_ACU(sectionKey)}">
                <span class="acu-expand-toggle" data-section-key="${escapeHtml_ACU(sectionKey)}">${expandIcon}</span>
                <span class="acu-summary-title">${escapeHtml_ACU(title)}</span>
                <span class="acu-summary-text">${escapeHtml_ACU(summary)}</span>
            </div>
            <div class="acu-detail-block" data-section-key="${escapeHtml_ACU(sectionKey)}" style="${detailStyle}">
                ${detailContent}
            </div>
        </div>
    `;
}

function buildAssistantDetailSummary_ACU(turn: ChatTurnAssistant): string {
    const draft = getAssistantDraft_ACU(turn);
    const compileResult = getAssistantCompileResult_ACU(turn);
    const parts: string[] = [];
    const warningCount = draft.warnings.length;
    const changeCount = countDiffChanges_ACU(compileResult.diff);
    const riskCount = compileResult.highRiskItems.length;
    const progressSummary = buildAssistantRoundProgressLabel_ACU(turn);
    
    if (warningCount > 0) parts.push(`警告${warningCount}条`);
    if (changeCount > 0) parts.push(`变更${changeCount}处`);
    if (riskCount > 0) parts.push(`高风险${riskCount}项`);
    if (progressSummary) parts.push(progressSummary);
    
    return parts.length > 0 ? parts.join(' · ') : '无变更';
}

function buildAssistantDetailContent_ACU(turn: ChatTurnAssistant): string {
    const draft = getAssistantDraft_ACU(turn);
    const compileResult = getAssistantCompileResult_ACU(turn);
    const sections: string[] = [];
    const progressSummary = buildAssistantRoundProgressLabel_ACU(turn);

    if (progressSummary) {
        sections.push(`<div class="acu-assistant-diff-block"><strong>${isFinalAssistantTurn_ACU(turn) ? '会话信息' : '轮次信息'}</strong><div>${escapeHtml_ACU(progressSummary)}${isFinalAssistantTurn_ACU(turn) ? '' : '（中间结果，暂不可应用）'}</div></div>`);
    }
    
    // 警告部分
    const warningsDetail = draft.warnings.length
        ? `<ul>${draft.warnings.map((item) => `<li>${escapeHtml_ACU(item)}</li>`).join('')}</ul>`
        : '<div class="acu-hint">无</div>';
    sections.push(`<div class="acu-assistant-diff-block"><strong>警告</strong>${warningsDetail}</div>`);
    
    // 变更部分
    sections.push(`<div class="acu-assistant-diff-block"><strong>变更详情</strong>${buildDiffHtml_ACU(compileResult.diff)}</div>`);
    
    // 高风险部分
    const riskDetail = compileResult.highRiskItems.length
        ? compileResult.highRiskItems.map((item, index) => {
            const riskKey = getRiskConfirmationKey_ACU(index);
            if (!isFinalAssistantTurn_ACU(turn)) {
                return `<div class="acu-assistant-risk-item"><span>${escapeHtml_ACU(item.label)}</span></div>`;
            }
            return `
                <label class="acu-assistant-risk-item">
                    <input type="checkbox" class="acu-assistant-risk-confirm" data-turn-id="${escapeHtml_ACU(turn.id)}" data-risk-key="${escapeHtml_ACU(riskKey)}" ${turn.riskConfirmations[riskKey] ? 'checked' : ''}>
                    <span>${escapeHtml_ACU(item.label)}</span>
                </label>
            `;
        }).join('')
        : '<div class="acu-hint">无高风险操作</div>';
    sections.push(`<div class="acu-assistant-diff-block"><strong>高风险确认</strong><div class="acu-assistant-risk-list">${riskDetail}</div></div>`);
    
    return sections.join('');
}

function renderAssistantTurn_ACU(turn: ChatTurnAssistant, isLatest: boolean) {
    const draft = getAssistantDraft_ACU(turn);
    const compileResult = getAssistantCompileResult_ACU(turn);
    const detailSummary = buildAssistantDetailSummary_ACU(turn);
    const detailContent = buildAssistantDetailContent_ACU(turn);
    const isExpanded = turn.expandedSections.details || false;

    const applyDisabled = compileResult.highRiskItems.length > 0 && !areHighRiskItemsConfirmed_ACU(turn);
    const applyHtml = isLatest && isFinalAssistantTurn_ACU(turn)
        ? `<button id="acu-vis-assistant-apply" class="acu-btn-primary" data-turn-id="${escapeHtml_ACU(turn.id)}" ${applyDisabled ? 'disabled' : ''}>应用到编辑器</button>`
        : '';
    const turnLabel = isFinalAssistantTurn_ACU(turn) ? 'AI 助手' : `AI 助手 · 第 ${turn.roundData.round} / ${turn.maxRounds} 轮`;

    return `
        <div class="acu-chat-turn acu-chat-turn-assistant" data-turn-id="${escapeHtml_ACU(turn.id)}" style="display:flex; justify-content:flex-start;">
            <div class="acu-message-bubble acu-message-bubble-assistant" style="max-width:82%; width:fit-content; min-width:240px; padding:12px 14px; border-radius:16px 16px 16px 4px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.12); box-shadow:0 10px 24px rgba(0,0,0,0.18); backdrop-filter:blur(10px);">
                <div class="acu-chat-turn-label" style="font-size:12px; font-weight:600; opacity:0.78; margin-bottom:6px;">${escapeHtml_ACU(turnLabel)}</div>
                <div class="acu-chat-turn-content">
                    <div class="acu-assistant-summary" style="line-height:1.6; white-space:pre-wrap; word-break:break-word;">${escapeHtml_ACU(draft.summary || '（无摘要）')}</div>
                </div>
                ${renderCollapsedSection_ACU('详情', detailSummary, 'details', isExpanded, detailContent)}
                ${applyHtml ? `<div class="acu-assistant-actions-row">${applyHtml}</div>` : ''}
            </div>
        </div>
    `;
}

function renderErrorTurn_ACU(turn: ChatTurnError) {
    return `
        <div class="acu-chat-turn acu-chat-turn-error" data-turn-id="${escapeHtml_ACU(turn.id)}" style="display:flex; justify-content:flex-start;">
            <div class="acu-message-bubble acu-message-bubble-error" style="max-width:82%; width:fit-content; min-width:220px; padding:12px 14px; border-radius:16px 16px 16px 4px; background:rgba(255,120,120,0.1); border:1px solid rgba(255,120,120,0.28); box-shadow:0 10px 24px rgba(0,0,0,0.14);">
                <div class="acu-chat-turn-label" style="font-size:12px; font-weight:600; color:#ffb2b2; margin-bottom:6px;">执行错误</div>
                <div class="acu-chat-turn-content">
                    <div class="acu-error-message" style="line-height:1.6; white-space:pre-wrap; word-break:break-word;">${escapeHtml_ACU(turn.errorMessage)}</div>
                </div>
            </div>
        </div>
    `;
}

function renderUserTurn_ACU(turn: ChatTurnUser) {
    return `
        <div class="acu-chat-turn acu-chat-turn-user" data-turn-id="${escapeHtml_ACU(turn.id)}" style="display:flex; justify-content:flex-end;">
            <div class="acu-message-bubble acu-message-bubble-user" style="max-width:82%; width:fit-content; min-width:180px; padding:12px 14px; border-radius:16px 16px 4px 16px; background:linear-gradient(135deg, rgba(78,164,255,0.28), rgba(71,116,255,0.2)); border:1px solid rgba(122,180,255,0.35); box-shadow:0 10px 24px rgba(0,0,0,0.16);">
                <div class="acu-chat-turn-label" style="font-size:12px; font-weight:600; opacity:0.72; margin-bottom:6px; text-align:right;">你</div>
                <div class="acu-chat-turn-content" style="line-height:1.6; white-space:pre-wrap; word-break:break-word; text-align:left;">
                    ${escapeHtml_ACU(turn.content)}
                </div>
            </div>
        </div>
    `;
}

function renderTranscript_ACU() {
    const transcript = assistantUiState_ACU.transcript;
    if (transcript.length === 0) return '';

    const html = transcript.map((turn, index) => {
        const isLatest = index === transcript.length - 1;
        switch (turn.type) {
            case 'user':
                return renderUserTurn_ACU(turn);
            case 'assistant':
                return renderAssistantTurn_ACU(turn, isLatest);
            case 'error':
                return renderErrorTurn_ACU(turn);
            default:
                return '';
        }
    }).join('');

    return `<div class="acu-chat-transcript">${html}</div>`;
}

function bindEvents_ACU() {
    const $host = getHost_ACU();
    if (!$host.length || !assistantUiState_ACU.isOpen) return;

    $host.find('#acu-vis-assistant-input').on('input', function() {
        assistantUiState_ACU.userRequest = String(jQuery_API_ACU(this).val() || '');
        // 更新按钮的disabled状态，避免重新渲染导致焦点丢失
        const generateDisabled = assistantUiState_ACU.isGenerating || !String(assistantUiState_ACU.userRequest || '').trim();
        const $btn = $host.find('#acu-vis-assistant-generate');
        if ($btn.length) {
            $btn.prop('disabled', generateDisabled);
        }
    });

    $host.find('#acu-vis-assistant-max-rounds').on('input', function() {
        assistantUiState_ACU.maxRoundsInput = String(jQuery_API_ACU(this).val() || '');
    });

    $host.find('#acu-vis-assistant-generate').on('click', async () => {
        const requestSheetKey = _acuVisState.currentSheetKey || null;
        const userRequest = assistantUiState_ACU.userRequest.trim();
        if (!userRequest) return;
        captureScrollState_ACU('append');
        const previewTurnIds: string[] = [];
        const capturedSessionId = assistantUiState_ACU.runningSessionId + 1;

        // 在添加当前用户轮次前构建 priorTurns（不包含当前请求）
        const priorTurns = buildPriorTurnsFromTranscript_ACU(assistantUiState_ACU.transcript);

        // 立即添加用户轮次
        const userTurn: ChatTurnUser = {
            type: 'user',
            id: generateTurnId_ACU(),
            content: userRequest,
            timestamp: Date.now(),
        };
        assistantUiState_ACU.transcript.push(userTurn);
        
        try {
            assistantUiState_ACU.isGenerating = true;
            assistantUiState_ACU.userRequest = '';
            createNewGuardController_ACU();
            renderVisualizerTemplateAssistantPanel_ACU();

            const result = await runTemplateAssistantSession_ACU({
                tempData: JSON.parse(JSON.stringify(_acuVisState.tempData || {})),
                currentSheetKey: requestSheetKey,
                sheetOrder: Array.isArray(_acuVisState.sheetOrder) ? [..._acuVisState.sheetOrder] : null,
                userRequest: userRequest,
                priorTurns: priorTurns,
                maxRounds: normalizeMaxRounds_ACU(assistantUiState_ACU.maxRoundsInput),
                guard: assistantUiState_ACU.guardController?.createRunGuard() || null,
                onRoundComplete: (progress: TemplateAssistantSessionProgress_ACU) => {
                    if (capturedSessionId !== assistantUiState_ACU.runningSessionId) return;
                    if ((requestSheetKey || null) !== (_acuVisState.currentSheetKey || null)) return;
                    captureScrollState_ACU('append');
                    const previewTurn: ChatTurnAssistant = {
                        type: 'assistant',
                        phase: 'round',
                        id: generateTurnId_ACU(),
                        roundData: progress.round,
                        maxRounds: progress.maxRounds,
                        riskConfirmations: {},
                        expandedSections: {},
                        timestamp: Date.now(),
                    };
                    previewTurnIds.push(previewTurn.id);
                    assistantUiState_ACU.transcript.push(previewTurn);
                    renderVisualizerTemplateAssistantPanel_ACU();
                },
            });

            if (capturedSessionId !== assistantUiState_ACU.runningSessionId) {
                return;
            }
            
            if ((requestSheetKey || null) !== (_acuVisState.currentSheetKey || null)) {
                assistantUiState_ACU.transcript = assistantUiState_ACU.transcript.filter((turn) => turn.id !== userTurn.id && !previewTurnIds.includes(turn.id));
                const errorTurn: ChatTurnError = {
                    type: 'error',
                    id: generateTurnId_ACU(),
                    errorMessage: '当前选中表已变化，请重新生成 assistant 草稿。',
                    timestamp: Date.now(),
                };
                assistantUiState_ACU.transcript.push(errorTurn);
                showToastr_ACU('warning', errorTurn.errorMessage);
                renderVisualizerTemplateAssistantPanel_ACU();
                return;
            }
            
            const finalAssistantTurn: ChatTurnAssistant = {
                type: 'assistant',
                phase: 'final',
                id: previewTurnIds[previewTurnIds.length - 1] || generateTurnId_ACU(),
                result: result,
                riskConfirmations: {},
                expandedSections: {},
                timestamp: Date.now(),
            };
            captureScrollState_ACU('append');
            if (previewTurnIds.length > 0) {
                const latestPreviewId = previewTurnIds[previewTurnIds.length - 1];
                assistantUiState_ACU.transcript = assistantUiState_ACU.transcript.map((turn) => {
                    if (turn.type === 'assistant' && turn.id === latestPreviewId) {
                        return finalAssistantTurn;
                    }
                    return turn;
                });
            } else {
                assistantUiState_ACU.transcript.push(finalAssistantTurn);
            }
        } catch (error: any) {
            if (capturedSessionId !== assistantUiState_ACU.runningSessionId) {
                return;
            }
            if (error instanceof TemplateAssistantSessionStoppedError_ACU) {
                showToastr_ACU('warning', error.message);
                return;
            }
            const errorTurn: ChatTurnError = {
                type: 'error',
                id: generateTurnId_ACU(),
                errorMessage: error?.message || '生成失败',
                timestamp: Date.now(),
            };
            assistantUiState_ACU.transcript.push(errorTurn);
            showToastr_ACU('error', errorTurn.errorMessage);
        } finally {
            assistantUiState_ACU.isGenerating = false;
            renderVisualizerTemplateAssistantPanel_ACU();
        }
    });

    $host.find('.acu-expand-toggle').on('click', function() {
        const sectionKey = String(jQuery_API_ACU(this).data('section-key') || '');
        // 找到对应的assistant turn
        const $section = jQuery_API_ACU(this).closest('.acu-collapsible-section');
        const $turn = jQuery_API_ACU(this).closest('.acu-chat-turn-assistant');
        const turnId = $turn.data('turn-id');
        
        const turn = assistantUiState_ACU.transcript.find(t => t.id === turnId && t.type === 'assistant') as ChatTurnAssistant | undefined;
        if (turn) {
            captureScrollState_ACU('preserve');
            turn.expandedSections[sectionKey] = !turn.expandedSections[sectionKey];
            renderVisualizerTemplateAssistantPanel_ACU();
        }
    });

    $host.find('.acu-assistant-risk-confirm').on('change', function() {
        const riskKey = readDataAttrFromElement_ACU(this, 'risk-key');
        const turnId = readDataAttrFromElement_ACU(this, 'turn-id');
        
        const turn = assistantUiState_ACU.transcript.find(t => t.id === turnId && t.type === 'assistant') as ChatTurnAssistant | undefined;
        if (turn) {
            turn.riskConfirmations[riskKey] = !!((this as HTMLInputElement | null)?.checked);
            syncLatestApplyButtonDisabledState_ACU(turn);
        }
    });

    $host.find('#acu-vis-assistant-apply').on('click', function() {
        const turnId = readDataAttrFromElement_ACU(this, 'turn-id');
        const turn = assistantUiState_ACU.transcript.find(t => t.id === turnId && t.type === 'assistant') as ChatTurnAssistant | undefined;
        if (!turn || !isFinalAssistantTurn_ACU(turn)) return;
        if (getAssistantCompileResult_ACU(turn).highRiskItems.length > 0 && !areHighRiskItemsConfirmed_ACU(turn)) {
            showToastr_ACU('warning', '请先确认所有高风险项后再应用。');
            return;
        }
        
        const applied = applyTemplateAssistantDraftToVisualizer_ACU(turn.result);
        if (!applied) return;
        captureScrollState_ACU('preserve');
        renderVisualizerTemplateAssistantPanel_ACU();
    });

    $host.find('#acu-vis-assistant-stop').on('click', () => {
        cancelActiveSession_ACU();
    });
}

export function resetVisualizerTemplateAssistantState_ACU() {
    assistantUiState_ACU.isOpen = false;
    assistantUiState_ACU.userRequest = '';
    assistantUiState_ACU.isGenerating = false;
    assistantUiState_ACU.pendingScrollTop = 0;
    assistantUiState_ACU.pendingScrollMode = 'preserve';
    assistantUiState_ACU.maxRoundsInput = '3';
    invalidateActiveSession_ACU();
    assistantUiState_ACU.guardController = null;
    clearAssistantDraftState_ACU();
    renderVisualizerTemplateAssistantPanel_ACU();
}

export function handleVisualizerTemplateAssistantSheetChange_ACU() {
    captureScrollState_ACU('preserve');
    invalidateActiveSession_ACU();
    const currentSheetKey = _acuVisState.currentSheetKey || null;
    // 检查最新的assistant轮次是否是v1且需要清除
    const lastAssistantTurn = [...assistantUiState_ACU.transcript].reverse().find((t): t is ChatTurnAssistantFinal => t.type === 'assistant' && isFinalAssistantTurn_ACU(t));
    
    if (
        lastAssistantTurn
        && lastAssistantTurn.result.draft.protocolVersion === 1
        && lastAssistantTurn.result.draft.selectedSheetKey !== currentSheetKey
    ) {
        clearAssistantDraftState_ACU();
    }
    renderVisualizerTemplateAssistantPanel_ACU();
}

export function invalidateVisualizerTemplateAssistantSession_ACU() {
    invalidateActiveSession_ACU();
    renderVisualizerTemplateAssistantPanel_ACU();
}

export function setVisualizerTemplateAssistantOpen_ACU(nextOpen: boolean) {
    assistantUiState_ACU.isOpen = !!nextOpen;
    renderVisualizerTemplateAssistantPanel_ACU();
}

export function toggleVisualizerTemplateAssistant_ACU() {
    assistantUiState_ACU.isOpen = !assistantUiState_ACU.isOpen;
    renderVisualizerTemplateAssistantPanel_ACU();
}

export function renderVisualizerTemplateAssistantPanel_ACU() {
    const $host = getHost_ACU();
    if (!$host.length) return;

    const display = assistantUiState_ACU.isOpen ? 'flex' : 'none';
    const generateDisabled = assistantUiState_ACU.isGenerating || !String(assistantUiState_ACU.userRequest || '').trim();
    const stopDisabled = !assistantUiState_ACU.isGenerating;

    $host.html(`
        <div class="acu-vis-assistant-panel" style="display:${display}; flex-direction:column; width:420px; height:100%; min-height:0; border-left:1px solid var(--vis-border-color); background:var(--vis-bg-secondary, rgba(0,0,0,0.02)); overflow:hidden;">
            <div style="padding:14px 16px; border-bottom:1px solid var(--vis-border-color); display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div>
                    <div style="font-weight:600;">AI 改表助手</div>
                    <div class="acu-hint" style="font-size:12px; margin-top:4px;">当前表：${escapeHtml_ACU(getSelectedSheetLabel_ACU())}</div>
                </div>
                <button id="acu-vis-assistant-close" class="acu-btn-secondary">关闭</button>
            </div>
            <div class="acu-chat-scroll-frame" style="flex:1; min-height:0; margin:16px 16px 12px; border:1px solid rgba(255,255,255,0.16); border-radius:12px; background:rgba(0,0,0,0.14); box-shadow:inset 0 1px 0 rgba(255,255,255,0.04); overflow:hidden; display:flex; flex-direction:column;">
                <div class="acu-chat-container" style="flex:1; min-height:0; overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:12px;">
                    ${renderTranscript_ACU()}
                </div>
            </div>
            <div style="padding:16px; border-top:1px solid var(--vis-border-color);">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                    <label for="acu-vis-assistant-max-rounds" style="font-size:12px; opacity:0.78; white-space:nowrap;">最大轮次</label>
                    <input id="acu-vis-assistant-max-rounds" type="number" min="1" class="acu-form-input" style="width:60px; text-align:center;" value="${escapeHtml_ACU(assistantUiState_ACU.maxRoundsInput)}">
                </div>
                <textarea id="acu-vis-assistant-input" class="acu-form-textarea" style="min-height:80px;" placeholder="例如：新增一张战利品表，并关闭旧表独立导出。">${escapeHtml_ACU(assistantUiState_ACU.userRequest)}</textarea>
                <div style="display:flex; gap:8px; margin-top:8px;">
                    <button id="acu-vis-assistant-generate" class="acu-btn-primary" style="flex:1;" ${generateDisabled ? 'disabled' : ''}>${assistantUiState_ACU.isGenerating ? '生成中...' : '发送'}</button>
                    <button id="acu-vis-assistant-stop" class="acu-btn-secondary" style="width:88px;" ${stopDisabled ? 'disabled' : ''}>停止</button>
                </div>
            </div>
        </div>
    `);

    restoreScrollState_ACU(getChatContainerElement_ACU());

    $host.find('#acu-vis-assistant-close').on('click', () => {
        assistantUiState_ACU.isOpen = false;
        renderVisualizerTemplateAssistantPanel_ACU();
    });

    bindEvents_ACU();
}
