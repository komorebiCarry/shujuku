import {
    cloneIsolatedData_ACU,
    readIsolatedTagData_ACU,
    writeIsolatedTagData_ACU,
    writeMessageIdentity_ACU,
    writeLegacyCompatData_ACU,
} from '../../data/repositories/chat-message-data-repo';
import type {
    ChatSummaryVectorIndexChunk_ACU,
    ChatSummaryVectorIndexRow_ACU,
    ChatSummaryVectorIndexState_ACU,
} from '../../data/models/chat-message-data';
import { createEmbeddings_ACU } from '../../data/gateways/vector-embedding-gateway';
import { saveChatToHost_ACU } from '../../data/gateways/chat-gateway';
import { currentJsonTableData_ACU, getCurrentIsolationKey_ACU, settings_ACU } from '../runtime/state-manager';
import { getChatArray_ACU } from '../chat/chat-service';
import { getLatestAiMessageIndexFromChat_ACU } from '../table/table-history';
import {
    persistRemoteMemorySnapshotAnchorIfNeeded_ACU,
    resolveRemoteMemorySnapshotAnchor_ACU,
} from './remote-memory-snapshot-anchor';
import {
    getEffectiveSummaryVectorIndexConfig_ACU,
    validateSummaryVectorIndexConfig_ACU,
} from './vector-memory-config';
import { assignSummaryVectorIndexStateToTagData_ACU } from './summary-vector-index-state-service';
import { hashUserInput_ACU, isSummaryOrOutlineTable_ACU, logWarn_ACU } from '../../shared/utils';

export interface SummaryVectorIndexArchiveResult_ACU {
    success: boolean;
    skipped: boolean;
    indexedRowCount: number;
    skippedRowCount: number;
    chunkCount: number;
    messageIndex?: number;
    summaryKey?: string;
    reason?: string;
    errors: string[];
}

interface SummaryTableSelection_ACU {
    summaryKey: string;
    table: any;
}

interface SummaryVectorArchivePreparedRow_ACU {
    rowKey: string;
    rowId: string;
    rowOrder: number;
    summary: string;
    indexCode: string;
    vectorSourceText: string;
}

function buildResult_ACU(partial: Partial<SummaryVectorIndexArchiveResult_ACU> = {}): SummaryVectorIndexArchiveResult_ACU {
    return {
        success: false,
        skipped: false,
        indexedRowCount: 0,
        skippedRowCount: 0,
        chunkCount: 0,
        errors: [],
        ...partial,
    };
}

function normalizeText_ACU(value: any): string {
    return String(value ?? '').trim();
}

function resolveColumnIndexByAliases_ACU(headerRow: any[], aliases: string[], fallbackIndex = -1): number {
    const normalizedAliases = aliases.map((item) => normalizeText_ACU(item).replace(/\s+/g, ''));
    const index = (Array.isArray(headerRow) ? headerRow : []).findIndex((header) => normalizedAliases.includes(normalizeText_ACU(header).replace(/\s+/g, '')));
    return index >= 0 ? index : fallbackIndex;
}

function findSummaryTable_ACU(): SummaryTableSelection_ACU | null {
    if (!currentJsonTableData_ACU || typeof currentJsonTableData_ACU !== 'object') {
        return null;
    }

    const summaryKey = Object.keys(currentJsonTableData_ACU).find((key) => {
        const table = currentJsonTableData_ACU[key];
        return !!table?.name && isSummaryOrOutlineTable_ACU(String(table.name || ''));
    });

    if (!summaryKey) return null;
    const table = currentJsonTableData_ACU[summaryKey];
    if (!table || !Array.isArray(table.content)) return null;

    return {
        summaryKey,
        table,
    };
}

function splitSentences_ACU(text: string): string[] {
    const normalized = normalizeText_ACU(text);
    if (!normalized) return [];
    const matches = normalized.match(/[^。！？!?；;\n]+[。！？!?；;]?/g);
    const sentences = Array.isArray(matches)
        ? matches.map((item) => normalizeText_ACU(item)).filter(Boolean)
        : [normalized];
    return sentences.length > 0 ? sentences : [normalized];
}

function chunkTextBySentenceCount_ACU(text: string, sentenceCount: number): string[] {
    const sentences = splitSentences_ACU(text);
    const normalizedSentenceCount = Math.max(1, Math.floor(Number(sentenceCount) || 2));
    const chunks: string[] = [];
    for (let index = 0; index < sentences.length; index += normalizedSentenceCount) {
        const chunkText = normalizeText_ACU(sentences.slice(index, index + normalizedSentenceCount).join(''));
        if (chunkText) chunks.push(chunkText);
    }
    return chunks;
}

function buildPreparedRows_ACU(table: any, summaryKey: string, snapshotMessageId: string): {
    rows: SummaryVectorArchivePreparedRow_ACU[];
    skippedRowCount: number;
    error: string;
} {
    const content = Array.isArray(table?.content) ? table.content : [];
    const headerRow = Array.isArray(content[0]) ? content[0] : [];
    const summaryColIdx = resolveColumnIndexByAliases_ACU(headerRow, ['概要', '概览', '概述', '摘要']);
    const indexColIdx = resolveColumnIndexByAliases_ACU(headerRow, ['编码索引']);
    if (summaryColIdx < 0) {
        return { rows: [], skippedRowCount: 0, error: '纪要表缺少概要列，无法构建纪要向量索引。' };
    }
    if (indexColIdx < 0) {
        return { rows: [], skippedRowCount: 0, error: '纪要表缺少编码索引列，无法构建纪要向量索引。' };
    }

    const dataRows = content.slice(1).filter((row: any) => Array.isArray(row));
    const preparedRows: SummaryVectorArchivePreparedRow_ACU[] = [];
    let skippedRowCount = 0;
    dataRows.forEach((row: any[], rowIndex: number) => {
        const rowId = normalizeText_ACU(row?.[0]) || String(rowIndex + 1);
        const summary = normalizeText_ACU(row?.[summaryColIdx]);
        const indexCode = normalizeText_ACU(row?.[indexColIdx]);
        const sourceParts: string[] = [];
        headerRow.forEach((header: any, colIndex: number) => {
            if (colIndex === 0 || colIndex === summaryColIdx || colIndex === indexColIdx) return;
            const headerText = normalizeText_ACU(header);
            const cellText = normalizeText_ACU(row?.[colIndex]);
            if (!headerText || !cellText) return;
            sourceParts.push(`${headerText}: ${cellText}`);
        });
        const vectorSourceText = normalizeText_ACU(sourceParts.join('\n'));
        if (!summary || !indexCode || !vectorSourceText) {
            skippedRowCount += 1;
            return;
        }
        preparedRows.push({
            rowKey: `${snapshotMessageId}:${summaryKey}:${rowId}`,
            rowId,
            rowOrder: rowIndex,
            summary,
            indexCode,
            vectorSourceText,
        });
    });

    return { rows: preparedRows, skippedRowCount, error: '' };
}

function resolveTargetMessageIndex_ACU(preferredIndex?: number): number {
    const chat = getChatArray_ACU();
    if (!Array.isArray(chat) || chat.length === 0) {
        return -1;
    }

    if (typeof preferredIndex === 'number' && preferredIndex >= 0 && chat[preferredIndex] && !chat[preferredIndex].is_user) {
        return preferredIndex;
    }

    return getLatestAiMessageIndexFromChat_ACU(chat);
}

async function buildChunksWithEmbeddings_ACU(
    rows: SummaryVectorArchivePreparedRow_ACU[],
    options: {
        snapshotMessageId: string;
        sentenceCount: number;
        embeddingEndpoint: string;
        embeddingApiKey: string;
        embeddingModel: string;
    },
): Promise<{ rows: ChatSummaryVectorIndexRow_ACU[]; chunks: ChatSummaryVectorIndexChunk_ACU[] }> {
    const chunkSources: Array<{ chunkId: string; rowKey: string; rowIndex: number; text: string; sequence: number }> = [];
    rows.forEach((row, rowIndex) => {
        const rowChunkTexts = chunkTextBySentenceCount_ACU(row.vectorSourceText, options.sentenceCount);
        rowChunkTexts.forEach((text, chunkIndex) => {
            chunkSources.push({
                chunkId: `${row.rowKey}:chunk:${chunkIndex}`,
                rowKey: row.rowKey,
                rowIndex,
                text,
                sequence: chunkSources.length,
            });
        });
    });

    if (chunkSources.length === 0) {
        return { rows: [], chunks: [] };
    }

    const embeddings = await createEmbeddings_ACU({
        endpoint: options.embeddingEndpoint,
        apiKey: options.embeddingApiKey,
        model: options.embeddingModel,
        input: chunkSources.map((item) => item.text),
    });

    const embeddingMap = new Map<number, number[]>();
    embeddings.forEach((item) => {
        if (Array.isArray(item.embedding) && item.embedding.length > 0) {
            embeddingMap.set(item.index, item.embedding);
        }
    });

    const chunks: ChatSummaryVectorIndexChunk_ACU[] = [];
    const rowChunkIds = new Map<string, string[]>();
    chunkSources.forEach((source, index) => {
        const vector = embeddingMap.get(index) || [];
        if (vector.length === 0) return;
        chunks.push({
            chunkId: source.chunkId,
            rowKey: source.rowKey,
            text: source.text,
            vector,
            sequence: source.sequence,
        });
        const ids = rowChunkIds.get(source.rowKey) || [];
        ids.push(source.chunkId);
        rowChunkIds.set(source.rowKey, ids);
    });

    const indexedRows: ChatSummaryVectorIndexRow_ACU[] = rows
        .map((row) => ({
            rowKey: row.rowKey,
            rowId: row.rowId,
            rowOrder: row.rowOrder,
            summary: row.summary,
            indexCode: row.indexCode,
            vectorSourceText: row.vectorSourceText,
            chunkIds: rowChunkIds.get(row.rowKey) || [],
        }))
        .filter((row) => row.chunkIds.length > 0);

    return { rows: indexedRows, chunks };
}

export async function archiveSummaryVectorIndexNow_ACU(options: { targetMessageIndex?: number } = {}): Promise<SummaryVectorIndexArchiveResult_ACU> {
    const config = getEffectiveSummaryVectorIndexConfig_ACU();
    const validation = validateSummaryVectorIndexConfig_ACU(config);
    if (!validation.valid) {
        return buildResult_ACU({
            success: false,
            reason: 'summary_vector_index_config_invalid',
            errors: validation.errors,
        });
    }

    const selectedSummary = findSummaryTable_ACU();
    if (!selectedSummary) {
        return buildResult_ACU({
            success: true,
            skipped: true,
            reason: 'summary_table_not_found',
        });
    }

    const targetMessageIndex = resolveTargetMessageIndex_ACU(options.targetMessageIndex);
    if (targetMessageIndex < 0) {
        return buildResult_ACU({
            success: false,
            reason: 'target_message_not_found',
            errors: ['未找到可写入纪要向量索引的 AI 楼层。'],
        });
    }

    const chat = getChatArray_ACU();
    const targetMessage = chat[targetMessageIndex];
    if (!targetMessage || targetMessage.is_user) {
        return buildResult_ACU({
            success: false,
            reason: 'target_message_invalid',
            errors: ['目标楼层不是可写入的 AI 消息。'],
        });
    }

    const snapshotAnchor = resolveRemoteMemorySnapshotAnchor_ACU(chat, targetMessageIndex);
    if (!snapshotAnchor?.anchor) {
        return buildResult_ACU({
            success: false,
            reason: 'snapshot_anchor_unresolved',
            errors: ['目标楼层缺少可用的本地聊天记录锚点，无法写入纪要向量索引。'],
        });
    }
    const snapshotMessageId = snapshotAnchor.anchor;

    const prepared = buildPreparedRows_ACU(selectedSummary.table, selectedSummary.summaryKey, snapshotMessageId);
    if (prepared.error) {
        return buildResult_ACU({
            success: false,
            summaryKey: selectedSummary.summaryKey,
            messageIndex: targetMessageIndex,
            reason: 'summary_vector_index_prepare_failed',
            errors: [prepared.error],
        });
    }
    if (prepared.rows.length === 0) {
        return buildResult_ACU({
            success: true,
            skipped: true,
            summaryKey: selectedSummary.summaryKey,
            messageIndex: targetMessageIndex,
            skippedRowCount: prepared.skippedRowCount,
            reason: 'no_effective_rows',
        });
    }

    try {
        const embedded = await buildChunksWithEmbeddings_ACU(prepared.rows, {
            snapshotMessageId,
            sentenceCount: config.summaryIndexChunkSentenceCount,
            embeddingEndpoint: config.embeddingEndpoint,
            embeddingApiKey: config.embeddingApiKey,
            embeddingModel: config.embeddingModel,
        });
        if (embedded.rows.length === 0 || embedded.chunks.length === 0) {
            return buildResult_ACU({
                success: false,
                summaryKey: selectedSummary.summaryKey,
                messageIndex: targetMessageIndex,
                reason: 'embedding_empty',
                errors: ['纪要向量索引 embedding 结果为空。'],
            });
        }

        const indexedAt = new Date().toISOString();
        const state: ChatSummaryVectorIndexState_ACU = {
            schemaVersion: 1,
            snapshotMessageId,
            sourceTableKey: selectedSummary.summaryKey,
            sourceTableName: normalizeText_ACU(selectedSummary.table?.name) || '纪要表',
            indexedAt,
            rowCount: embedded.rows.length,
            chunkCount: embedded.chunks.length,
            skippedRowCount: prepared.skippedRowCount + (prepared.rows.length - embedded.rows.length),
            rows: embedded.rows,
            chunks: embedded.chunks,
        };

        const isolationKey = getCurrentIsolationKey_ACU();
        const existingTagData = readIsolatedTagData_ACU(targetMessage, isolationKey) || {
            independentData: {},
            modifiedKeys: [],
            updateGroupKeys: [],
        };
        const nextIsolatedData = cloneIsolatedData_ACU(targetMessage);
        const nextTagData = {
            independentData: existingTagData.independentData || {},
            modifiedKeys: Array.isArray(existingTagData.modifiedKeys) ? [...existingTagData.modifiedKeys] : [],
            updateGroupKeys: Array.isArray(existingTagData.updateGroupKeys) ? [...existingTagData.updateGroupKeys] : [],
            ...(existingTagData.vectorMemoryState ? { vectorMemoryState: existingTagData.vectorMemoryState } : {}),
            ...(existingTagData._acu_base_state ? { _acu_base_state: existingTagData._acu_base_state } : {}),
        } as any;
        assignSummaryVectorIndexStateToTagData_ACU(nextTagData, state);
        nextIsolatedData[isolationKey] = nextTagData;
        targetMessage.TavernDB_ACU_IsolatedData = nextIsolatedData;
        writeIsolatedTagData_ACU(targetMessage, isolationKey, nextTagData);
        persistRemoteMemorySnapshotAnchorIfNeeded_ACU(targetMessage, snapshotAnchor);
        writeMessageIdentity_ACU(targetMessage, {
            enabled: settings_ACU.dataIsolationEnabled,
            code: settings_ACU.dataIsolationCode,
        });
        writeLegacyCompatData_ACU(
            targetMessage,
            nextTagData.independentData || {},
            nextTagData.modifiedKeys || [],
            nextTagData.updateGroupKeys || [],
        );

        await saveChatToHost_ACU();

        return buildResult_ACU({
            success: true,
            skipped: false,
            indexedRowCount: state.rowCount,
            skippedRowCount: state.skippedRowCount,
            chunkCount: state.chunkCount,
            messageIndex: targetMessageIndex,
            summaryKey: selectedSummary.summaryKey,
            reason: 'archived_summary_vector_index',
        });
    } catch (error: any) {
        logWarn_ACU('[纪要向量索引] 归档失败，未修改纪要表原条目:', error);
        return buildResult_ACU({
            success: false,
            skipped: false,
            summaryKey: selectedSummary.summaryKey,
            messageIndex: targetMessageIndex,
            reason: 'summary_vector_index_archive_failed',
            errors: [normalizeText_ACU(error?.message) || '纪要向量索引归档失败'],
        });
    }
}

export function buildSummaryVectorIndexBatchId_ACU(state: ChatSummaryVectorIndexState_ACU): string {
    const source = `${state.snapshotMessageId}:${state.sourceTableKey}:${state.indexedAt}:${state.rowCount}:${state.chunkCount}`;
    return `summary-vector-index:${hashUserInput_ACU(source)}`;
}
