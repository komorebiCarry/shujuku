/**
 * service/table/update-orchestrator.ts — 表格更新编排（service 层：纯业务逻辑）
 * 从 presentation/triggers/update-process.ts 提取。
 * service 层不驱动 UI，只返回结果/状态，presentation 层根据返回值自行决定 UI 操作。
 */

import { isAutoUpdatingCard_ACU, wasStoppedByUser_ACU, _set_isAutoUpdatingCard_ACU, _set_manualExtraHint_ACU, _set_wasStoppedByUser_ACU } from '../runtime/state-manager';
import { callCustomOpenAI_ACU } from '../ai/prompt-builder';
import { getChatArray_ACU } from '../chat/chat-service';
import { coreApisAreReady_ACU, currentJsonTableData_ACU, getCurrentIsolationKey_ACU, settings_ACU, _set_currentJsonTableData_ACU } from '../runtime/state-manager';
import { checkAutoMergeTrigger_ACU, prepareAutoMergeBatches_ACU, executeAutoMergeBatch_ACU, finalizeAutoMerge_ACU } from '../summary/merge-logic';
import { getChatSheetGuideDataForIsolationKey_ACU } from '../template/chat-scope';
import { loadAllChatMessages_ACU, updateReadableLorebookEntry_ACU } from '../worldbook/pipeline';

import { isSummaryOrOutlineTable_ACU, logDebug_ACU, logError_ACU, logWarn_ACU, parseTableTemplateJson_ACU } from '../../shared/utils';
import { checkIfFirstTimeInit_ACU, saveIndependentTableToChatHistory_ACU } from './table-service';
import { parseAndApplyTableEdits_ACU, prepareAIInput_ACU } from '../ai/prompt-builder';
import { buildGuidedBaseDataFromSheetGuide_ACU, getSortedSheetKeys_ACU } from '../template/chat-scope';
import { isSqliteMode } from './storage-mode';

// ============================================================
// 类型定义：返回值 + 进度事件（service 层不驱动 UI）
// ============================================================

/** 卡片更新进度事件阶段 */
export type CardUpdatePhase =
    | 'preparing'        // 准备 AI 输入
    | 'calling_ai'       // 调用 AI（含重试信息）
    | 'parsing'          // 解析 AI 返回
    | 'saving'           // 保存到聊天记录
    | 'chunk_done'       // 分块处理成功（import 模式）
    | 'complete'         // 完成
    | 'retry'            // 重试中
    | 'error';           // 出错

/** 卡片更新进度事件 */
export interface CardUpdateProgressEvent {
    phase: CardUpdatePhase;
    attempt?: number;
    maxRetries?: number;
    message?: string;
}

/** executeCardUpdateCore 的返回值 */
export interface CardUpdateResult {
    success: boolean;
    modifiedKeys: string[];
    error?: string;
    aborted?: boolean;
}

/** processUpdatesBatch 的返回值 */
export interface BatchUpdateResult {
    success: boolean;
    failedBatch?: number;
    error?: string;
}

/** orchestrateManualUpdate 的返回值 */
export interface ManualUpdateResult {
    success: boolean;
    error?: string;
    /** 是否触发了自动合并 */
    autoMergeTriggered?: boolean;
    autoMergeSuccess?: boolean;
}

// ============================================================
// 核心业务函数
// ============================================================

/**
 * 加载批次基础数据：从聊天记录中为每个表格查找最新数据
 * 纯业务逻辑，不涉及任何 UI 操作
 */
export function loadBatchBaseData_ACU(
    chatHistory: any[],
    firstMessageIndexOfBatch: number,
    batchIsolationKey: string,
    batchSheetKeys: string[],
    mergedBatchData: Record<string, any>
): { foundCount: number; totalCount: number } {
    const batchFoundSheets: Record<string, boolean> = {};
    batchSheetKeys.forEach(k => batchFoundSheets[k] = false);

    for (let j = firstMessageIndexOfBatch - 1; j >= 0; j--) {
        const msg = chatHistory[j];
        if (msg.is_user) continue;

        // [优先级1] 新版按标签分组存储
        if (msg.TavernDB_ACU_IsolatedData && msg.TavernDB_ACU_IsolatedData[batchIsolationKey]) {
            const tagData = msg.TavernDB_ACU_IsolatedData[batchIsolationKey];
            const independentData = tagData.independentData || {};

            Object.keys(independentData).forEach(storedSheetKey => {
                if (batchFoundSheets[storedSheetKey] === false && mergedBatchData[storedSheetKey]) {
                    mergedBatchData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                    batchFoundSheets[storedSheetKey] = true;
                }
            });
        }

        // [优先级2] 兼容旧版存储格式
        const msgIdentity = msg.TavernDB_ACU_Identity;
        let isLegacyMatch = false;
        if (settings_ACU.dataIsolationEnabled) {
            isLegacyMatch = (msgIdentity === settings_ACU.dataIsolationCode);
        } else {
            isLegacyMatch = !msgIdentity;
        }

        if (isLegacyMatch) {
            if (msg.TavernDB_ACU_IndependentData) {
                const independentData = msg.TavernDB_ACU_IndependentData;
                Object.keys(independentData).forEach(storedSheetKey => {
                    if (batchFoundSheets[storedSheetKey] === false && mergedBatchData[storedSheetKey]) {
                        mergedBatchData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                        batchFoundSheets[storedSheetKey] = true;
                    }
                });
            }

            if (msg.TavernDB_ACU_Data) {
                const standardData = msg.TavernDB_ACU_Data;
                Object.keys(standardData).forEach(k => {
                    if (k.startsWith('sheet_') && batchFoundSheets[k] === false && mergedBatchData[k]) {
                        mergedBatchData[k] = JSON.parse(JSON.stringify(standardData[k]));
                        batchFoundSheets[k] = true;
                    }
                });
            }

            if (msg.TavernDB_ACU_SummaryData) {
                const summaryData = msg.TavernDB_ACU_SummaryData;
                Object.keys(summaryData).forEach(k => {
                    if (k.startsWith('sheet_') && batchFoundSheets[k] === false && mergedBatchData[k]) {
                        mergedBatchData[k] = JSON.parse(JSON.stringify(summaryData[k]));
                        batchFoundSheets[k] = true;
                    }
                });
            }
        }

        if (Object.values(batchFoundSheets).every(v => v === true)) {
            break;
        }
    }

    const foundCount = Object.values(batchFoundSheets).filter(v => v === true).length;
    const totalCount = batchSheetKeys.length;
    return { foundCount, totalCount };
}

/**
 * 构建批次合并基底数据
 * 纯业务逻辑，不涉及任何 UI 操作
 */
export function buildBatchMergeBase_ACU(batchNumber: number): { data: Record<string, any> | null; error: string | null } {
    try {
        const batchIsoKey = getCurrentIsolationKey_ACU();
        const sheetGuideForBatch = getChatSheetGuideDataForIsolationKey_ACU(batchIsoKey);
        if (sheetGuideForBatch && typeof sheetGuideForBatch === 'object' && Object.keys(sheetGuideForBatch).some(k => k.startsWith('sheet_'))) {
            const data = buildGuidedBaseDataFromSheetGuide_ACU(sheetGuideForBatch);
            logDebug_ACU(`[Batch ${batchNumber}] Using chat sheet guide as merge base.`);
            return { data, error: null };
        } else {
            const data = parseTableTemplateJson_ACU({ stripSeedRows: true });
            logDebug_ACU(`[Batch ${batchNumber}] No chat sheet guide found, using template as merge base.`);
            return { data, error: null };
        }
    } catch (e) {
        logError_ACU(`[Batch ${batchNumber}] Failed to build merge base from guide/template.`, e);
        return { data: null, error: '无法构建合并基底，操作已终止。' };
    }
}

/**
 * 确定更新模式
 * 纯业务逻辑
 */
export function resolveUpdateMode_ACU(mode: string): string {
    if (mode === 'auto_unified' || mode === 'manual_unified' || mode === 'full') {
        return mode;
    } else if (mode === 'auto_summary_silent') {
        return 'auto_summary_silent';
    } else if (mode && mode.startsWith('manual')) {
        if (mode.includes('summary')) return 'manual_summary';
        else if (mode === 'manual_independent') return 'manual_independent';
        else return 'manual_standard';
    } else {
        if (mode && mode.includes('summary')) return 'auto_summary';
        else return 'auto_standard';
    }
}

/**
 * 执行单次卡片更新的核心逻辑（AI调用 + 重试 + 解析 + 保存）
 * 纯业务逻辑，不驱动 UI。通过可选的 onProgress 回调传递纯数据进度事件。
 * presentation 层根据返回值和进度事件自行决定 UI 操作。
 */
export async function executeCardUpdateCore_ACU(
    messagesToUse: any[],
    saveTargetIndex: number,
    isImportMode: boolean,
    updateMode: string,
    isSilentMode: boolean,
    targetSheetKeys: string[] | null,
    requestOptions: Record<string, any> | null,
    abortController: AbortController,
    onProgress?: (event: CardUpdateProgressEvent) => void
): Promise<CardUpdateResult> {
    let success = false;
    let modifiedKeys: string[] = [];
    const maxRetries = settings_ACU.tableMaxRetries || 3;

    try {
        onProgress?.({ phase: 'preparing' });

        const dynamicContent = await prepareAIInput_ACU(messagesToUse, updateMode, targetSheetKeys, {
            excludeImportTaggedWorldbookEntries: isImportMode && settings_ACU.importPromptExcludeImportedWorldbookEntries !== false,
        });
        if (!dynamicContent) {
            return { success: false, modifiedKeys: [], error: '无法准备AI输入，数据库未加载。' };
        }

        const SQL_ERROR_MARKER = '\n\n<!-- SQL_ERROR_FEEDBACK -->\n';
        let lastSqlError: string | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (wasStoppedByUser_ACU) {
                return { success: false, modifiedKeys: [], aborted: true };
            }

            onProgress?.({ phase: 'calling_ai', attempt, maxRetries });

            if (lastSqlError && isSqliteMode()) {
                const markerIndex = dynamicContent.tableDataText.indexOf(SQL_ERROR_MARKER);
                if (markerIndex !== -1) {
                    dynamicContent.tableDataText = dynamicContent.tableDataText.substring(0, markerIndex);
                }
                dynamicContent.tableDataText += `${SQL_ERROR_MARKER}[SQL执行错误，请修正后重新输出]\n错误信息: ${lastSqlError}`;
            }

            try {
                const aiResponse = await callCustomOpenAI_ACU(dynamicContent, abortController, requestOptions);

                if (abortController.signal.aborted || wasStoppedByUser_ACU) {
                    return { success: false, modifiedKeys: [], aborted: true };
                }

                const minReplyLength = settings_ACU.autoUpdateTokenThreshold || 0;
                if (aiResponse && minReplyLength > 0 && aiResponse.length < minReplyLength) {
                    throw new Error(`AI回复过短 (${aiResponse.length} 字符)，低于阈值 (${minReplyLength} 字符)`);
                }

                if (!aiResponse || !aiResponse.includes('<tableEdit>') || !aiResponse.includes('</tableEdit>')) {
                    throw new Error('AI响应中未找到完整有效的 <tableEdit> 标签');
                }

                onProgress?.({ phase: 'parsing' });

                const parseResult = parseAndApplyTableEdits_ACU(aiResponse, updateMode, isImportMode);

                let parseSuccess = false;
                modifiedKeys = [];

                if (typeof parseResult === 'object' && parseResult !== null) {
                    parseSuccess = parseResult.success;
                    modifiedKeys = parseResult.modifiedKeys || [];
                } else {
                    parseSuccess = !!parseResult;
                    modifiedKeys = targetSheetKeys || [];
                }

                if (!parseSuccess) {
                    throw new Error('解析或应用AI更新时出错');
                }

                success = true;
                break;

            } catch (error: any) {
                logWarn_ACU(`第 ${attempt} 次尝试失败: ${error.message}`);

                if (isSqliteMode() && error.message) {
                    lastSqlError = error.message;
                }

                if (error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted') || wasStoppedByUser_ACU) {
                    return { success: false, modifiedKeys: [], aborted: true };
                }

                if (attempt < maxRetries) {
                    const waitTime = 5000;
                    logDebug_ACU(`等待 ${waitTime}ms 后重试...`);
                    onProgress?.({ phase: 'retry', attempt, maxRetries, message: error.message?.substring(0, 50) });
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                    continue;
                } else {
                    return { success: false, modifiedKeys: [], error: `填表在 ${maxRetries} 次尝试后仍失败: ${error.message}` };
                }
            }
        }

        if (success) {
            if (!isImportMode) {
                onProgress?.({ phase: 'saving' });

                let keysToPersist = modifiedKeys;
                if (targetSheetKeys && Array.isArray(targetSheetKeys)) {
                    keysToPersist = keysToPersist.filter((k: string) => targetSheetKeys.includes(k));
                }

                const isFirstTimeInit = await checkIfFirstTimeInit_ACU();

                if (keysToPersist.length > 0 || isFirstTimeInit) {
                    let keysToActuallySave = keysToPersist;
                    if (isFirstTimeInit) {
                        const allSheetKeys = getSortedSheetKeys_ACU(currentJsonTableData_ACU);
                        keysToActuallySave = allSheetKeys;

                        const fullTemplate = parseTableTemplateJson_ACU({ stripSeedRows: false });
                        if (fullTemplate) {
                            allSheetKeys.forEach(sheetKey => {
                                if (!keysToPersist.includes(sheetKey) && fullTemplate[sheetKey]) {
                                    currentJsonTableData_ACU[sheetKey] = JSON.parse(JSON.stringify(fullTemplate[sheetKey]));
                                    logDebug_ACU(`[Init] Table ${sheetKey} not modified by AI, using template data (may include seed rows).`);
                                }
                            });
                        }

                        logDebug_ACU('[Init] First time initialization detected. Saving complete template structure with all tables.');
                    }

                    const updateGroupKeysRaw = isFirstTimeInit ? keysToPersist : targetSheetKeys;
                    const updateGroupKeysToUse = Array.isArray(updateGroupKeysRaw)
                        ? updateGroupKeysRaw.filter(sheetKey => {
                            const table = currentJsonTableData_ACU?.[sheetKey];
                            if (!table || !isSummaryOrOutlineTable_ACU(table.name)) return true;
                            return keysToActuallySave.includes(sheetKey);
                        })
                        : updateGroupKeysRaw;
                    const saveSuccess = await saveIndependentTableToChatHistory_ACU(saveTargetIndex, keysToActuallySave, updateGroupKeysToUse);
                    if (!saveSuccess) {
                        return { success: false, modifiedKeys, error: '无法将更新后的数据库保存到聊天记录。' };
                    }
                } else {
                    logDebug_ACU("No tables were modified by AI, skipping save to chat history.");
                }

                await updateReadableLorebookEntry_ACU(true);
            } else {
                onProgress?.({ phase: 'chunk_done' });
                logDebug_ACU("Import mode: skipping save to chat history for this chunk.");
            }

            onProgress?.({ phase: 'complete' });
        }
        return { success, modifiedKeys };

    } catch (error: any) {
        if (error.name === 'AbortError') {
            logDebug_ACU('Fetch request was aborted by the user.');
            return { success: false, modifiedKeys: [], aborted: true };
        } else {
            logError_ACU(`数据库增量更新流程失败: ${error.message}`);
            return { success: false, modifiedKeys: [], error: error.message };
        }
    }
}

/**
 * 批处理更新编排（纯业务逻辑）
 * 从 processUpdates_ACU 提取。不驱动 UI，只返回结果。
 */
export async function processUpdatesBatch_ACU(
    indicesToUpdate: number[],
    mode: string,
    options: any,
    executeUpdate: (messagesToUse: any[], saveTargetIndex: number, updateMode: string, isSilentMode: boolean, targetSheetKeys: string[] | null, requestOptions: Record<string, any> | null) => Promise<CardUpdateResult>
): Promise<BatchUpdateResult> {
    if (!indicesToUpdate || indicesToUpdate.length === 0) {
        return { success: true };
    }

    const { targetSheetKeys, batchSize: specificBatchSize, requestOptions } = options;

    _set_isAutoUpdatingCard_ACU(true);

    const isSummaryMode = (mode && (mode.includes('summary') || mode === 'manual_summary')) || false;
    const batchSize = specificBatchSize || (settings_ACU.updateBatchSize || 2);

    const batches: number[][] = [];
    for (let i = 0; i < indicesToUpdate.length; i += batchSize) {
        batches.push(indicesToUpdate.slice(i, i + batchSize));
    }

    logDebug_ACU(`[${mode}] Processing ${indicesToUpdate.length} updates in ${batches.length} batches of size ${batchSize} (${isSummaryMode ? '总结表模式' : '标准表模式'}). Target Sheets: ${targetSheetKeys ? targetSheetKeys.length : 'All'}`);

    const chatHistory = getChatArray_ACU();
    const isAutoUpdateMode = mode && mode.startsWith('auto');
    const isSilentMode = !!(isAutoUpdateMode && settings_ACU.toastMuteEnabled);

    for (let i = 0; i < batches.length; i++) {
        const batchIndices = batches[i];
        const batchNumber = i + 1;
        const firstMessageIndexOfBatch = batchIndices[0];
        const lastMessageIndexOfBatch = batchIndices[batchIndices.length - 1];
        const finalSaveTargetIndex = lastMessageIndexOfBatch;

        // 构建合并基底
        const baseResult = buildBatchMergeBase_ACU(batchNumber);
        if (!baseResult.data) {
            _set_isAutoUpdatingCard_ACU(false);
            return { success: false, failedBatch: batchNumber, error: baseResult.error || '无法构建合并基底，操作已终止。' };
        }
        const mergedBatchData = baseResult.data;

        const batchSheetKeys = getSortedSheetKeys_ACU(mergedBatchData);
        const batchIsolationKey = getCurrentIsolationKey_ACU();

        // 加载历史数据
        const loadResult = loadBatchBaseData_ACU(chatHistory, firstMessageIndexOfBatch, batchIsolationKey, batchSheetKeys, mergedBatchData);
        _set_currentJsonTableData_ACU(mergedBatchData);
        logDebug_ACU(`[Batch ${batchNumber}] Loaded ${loadResult.foundCount}/${loadResult.totalCount} tables from history before index ${firstMessageIndexOfBatch}. Missing tables will use template structure (header-only).`);

        // 计算上下文范围
        let sliceStartIndex = firstMessageIndexOfBatch;
        if (sliceStartIndex > 0 && chatHistory[sliceStartIndex - 1]?.is_user) {
            sliceStartIndex--;
            logDebug_ACU(`[Batch ${batchNumber}] Adjusted slice start to ${sliceStartIndex} to include preceding user message.`);
        }
        const messagesForContext = chatHistory.slice(sliceStartIndex, lastMessageIndexOfBatch + 1);

        // 检查最新AI回复长度阈值
        const lastAiMessageInBatch = chatHistory[lastMessageIndexOfBatch];
        const lastAiMessageContent = lastAiMessageInBatch?.mes || lastAiMessageInBatch?.message || '';
        const lastAiMessageLength = lastAiMessageContent.length;
        const minReplyLength = settings_ACU.autoUpdateTokenThreshold || 0;

        if (isAutoUpdateMode && lastAiMessageLength < minReplyLength) {
            logDebug_ACU(`[Auto] Batch ${batchNumber}/${batches.length} skipped: Last AI reply length (${lastAiMessageLength}) is below threshold (${minReplyLength}).`);
            continue;
        }

        // 确定更新模式
        const updateMode = resolveUpdateMode_ACU(mode);

        const result = await executeUpdate(messagesForContext, finalSaveTargetIndex, updateMode, isSilentMode, targetSheetKeys, requestOptions);

        if (!result.success) {
            _set_isAutoUpdatingCard_ACU(false);
            return { success: false, failedBatch: batchNumber, error: result.error || `批处理在第 ${batchNumber} 批时失败或被终止。` };
        }
    }

    _set_isAutoUpdatingCard_ACU(false);
    return { success: true };
}

/**
 * 手动更新编排（纯业务逻辑）
 * 从 handleManualUpdate_ACU 提取。不驱动 UI，只返回结果。
 * presentation 层负责：收集 manualSelection、设置 manualExtraHint、刷新 UI、显示 toast。
 */
export async function orchestrateManualUpdate_ACU(
    targetKeys: string[],
    processBatch: (indices: number[], mode: string, options: any) => Promise<BatchUpdateResult>,
    refreshData: () => Promise<void>
): Promise<ManualUpdateResult> {
    try {
        if (isAutoUpdatingCard_ACU) {
            return { success: false, error: '数据库更新正在进行中，请稍候...' };
        }

        if (!coreApisAreReady_ACU) {
            return { success: false, error: 'API未就绪。' };
        }

        const apiIsConfigured = (settings_ACU.apiMode === 'custom' && (settings_ACU.apiConfig.useMainApi || (settings_ACU.apiConfig.url && settings_ACU.apiConfig.model))) || (settings_ACU.apiMode === 'tavern' && settings_ACU.tavernProfile);
        if (!apiIsConfigured) {
            return { success: false, error: 'API未配置，无法更新数据库。' };
        }

        await loadAllChatMessages_ACU();
        await refreshData();

        if (!currentJsonTableData_ACU) {
            return { success: false, error: '数据库未加载。' };
        }
        const liveChat = getChatArray_ACU();
        if (!liveChat || liveChat.length === 0) {
            return { success: false, error: '聊天记录为空，无法更新。' };
        }

        const allAiMessageIndices = liveChat
            .map((msg: any, index: number) => !msg.is_user ? index : -1)
            .filter((index: number) => index !== -1);

        if (allAiMessageIndices.length === 0) {
            return { success: false, error: '尚未检测到AI回复，无法执行手动更新。' };
        }

        if (!targetKeys.length) {
            return { success: false, error: '未选择需要更新的表格。' };
        }

        const uiThreshold = settings_ACU.autoUpdateThreshold || 3;
        const uiBatchSize = settings_ACU.updateBatchSize || 3;
        const uiSkip = settings_ACU.skipUpdateFloors || 0;

        const effectiveAiIndices = uiSkip > 0 ? allAiMessageIndices.slice(0, -uiSkip) : allAiMessageIndices.slice();
        const contextScopeIndices = uiThreshold > 0 ? effectiveAiIndices.slice(-uiThreshold) : effectiveAiIndices;

        if (!contextScopeIndices.length) {
            return { success: false, error: '未找到可用的上下文进行手动更新，请检查阈值或跳过楼层设置。' };
        }

        const templateData = parseTableTemplateJson_ACU({ stripSeedRows: true }) || {};
        const updateGroups: Record<string, any> = {};
        targetKeys.forEach((sheetKey: string) => {
            const tableGroupId = Number.isFinite(templateData?.[sheetKey]?.updateConfig?.groupId)
                ? Math.trunc(templateData[sheetKey].updateConfig.groupId)
                : -1;
            const groupKey = `${tableGroupId}|${contextScopeIndices.join(',')}|${uiBatchSize}`;
            if (!updateGroups[groupKey]) {
                updateGroups[groupKey] = {
                    indices: contextScopeIndices,
                    batchSize: uiBatchSize,
                    groupId: tableGroupId,
                    sheetKeys: []
                };
            }
            updateGroups[groupKey].sheetKeys.push(sheetKey);
        });
        const groupKeys = Object.keys(updateGroups);

        _set_isAutoUpdatingCard_ACU(true);
        for (const gKey of groupKeys) {
            const group = updateGroups[gKey];
            logDebug_ACU(`[Manual Parallel] Processing group update for groupId=${group.groupId}, sheets: ${group.sheetKeys.join(', ')}`);
            const batchResult = await processBatch(group.indices, 'manual_independent', {
                targetSheetKeys: group.sheetKeys,
                batchSize: group.batchSize
            });
            if (!batchResult.success) {
                _set_isAutoUpdatingCard_ACU(false);
                return { success: false, error: batchResult.error || '手动更新失败或被终止。' };
            }
            await loadAllChatMessages_ACU();
            await refreshData();
        }
        _set_isAutoUpdatingCard_ACU(false);

        // 手动更新完成后检测自动合并总结
        let autoMergeTriggered = false;
        let autoMergeSuccess = false;
        try {
            const trigger = checkAutoMergeTrigger_ACU();
            if (trigger.shouldTrigger) {
                autoMergeTriggered = true;
                const prepared = prepareAutoMergeBatches_ACU({
                    startIndex: 0, endIndex: trigger.mergeCount, targetCount: 1,
                    batchSize: 5, promptTemplate: '', isAutoMode: true,
                });
                let acc: any[] = [];
                for (let i = 0; i < prepared.batches.length; i++) {
                    const batchResult = await executeAutoMergeBatch_ACU(prepared, prepared.batches[i], acc);
                    acc = batchResult.accumulatedSummary;
                }
                await finalizeAutoMerge_ACU(prepared, acc);
                autoMergeSuccess = true;
            }
        } catch (e) {
            logWarn_ACU('自动合并总结检测失败:', e);
        }

        return { success: true, autoMergeTriggered, autoMergeSuccess };
    } finally {
        _set_manualExtraHint_ACU('');
        _set_isAutoUpdatingCard_ACU(false);
    }
}
