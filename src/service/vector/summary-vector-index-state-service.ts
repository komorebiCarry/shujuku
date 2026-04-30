import type {
    ChatSummaryVectorIndexChunk_ACU,
    ChatSummaryVectorIndexRow_ACU,
    ChatSummaryVectorIndexState_ACU,
    IsolationTagData_ACU,
} from '../../data/models/chat-message-data';
import { readIsolatedTagData_ACU } from '../../data/repositories/chat-message-data-repo';
import { getChatArray_ACU } from '../chat/chat-service';
import { getCurrentIsolationKey_ACU } from '../runtime/state-manager';

function normalizeText_ACU(value: any): string {
    return String(value ?? '').trim();
}

function normalizeFiniteNumberArray_ACU(values: any): number[] {
    if (!Array.isArray(values)) return [];
    return values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
}

function normalizeChunk_ACU(chunk: any): ChatSummaryVectorIndexChunk_ACU | null {
    const chunkId = normalizeText_ACU(chunk?.chunkId);
    const rowKey = normalizeText_ACU(chunk?.rowKey);
    const text = normalizeText_ACU(chunk?.text);
    const vector = normalizeFiniteNumberArray_ACU(chunk?.vector);
    const sequenceNumber = Number(chunk?.sequence);
    if (!chunkId || !rowKey || !text || vector.length === 0) {
        return null;
    }
    return {
        chunkId,
        rowKey,
        text,
        vector,
        sequence: Number.isFinite(sequenceNumber) && sequenceNumber >= 0 ? Math.floor(sequenceNumber) : 0,
    };
}

function normalizeRow_ACU(row: any): ChatSummaryVectorIndexRow_ACU | null {
    const rowKey = normalizeText_ACU(row?.rowKey);
    const rowId = normalizeText_ACU(row?.rowId);
    const rowOrderNumber = Number(row?.rowOrder);
    const summary = normalizeText_ACU(row?.summary);
    const indexCode = normalizeText_ACU(row?.indexCode);
    const vectorSourceText = normalizeText_ACU(row?.vectorSourceText);
    const chunkIds = Array.isArray(row?.chunkIds)
        ? row.chunkIds.map((item: any) => normalizeText_ACU(item)).filter(Boolean)
        : [];
    if (!rowKey || !rowId || !summary || !indexCode || chunkIds.length === 0) {
        return null;
    }
    return {
        rowKey,
        rowId,
        rowOrder: Number.isFinite(rowOrderNumber) && rowOrderNumber >= 0 ? Math.floor(rowOrderNumber) : 0,
        summary,
        indexCode,
        vectorSourceText,
        chunkIds,
    };
}

export function normalizeSummaryVectorIndexState_ACU(state: any): ChatSummaryVectorIndexState_ACU | null {
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
        return null;
    }
    const snapshotMessageId = normalizeText_ACU(state.snapshotMessageId);
    const sourceTableKey = normalizeText_ACU(state.sourceTableKey);
    const sourceTableName = normalizeText_ACU(state.sourceTableName);
    const indexedAt = normalizeText_ACU(state.indexedAt);
    const normalizedRows: ChatSummaryVectorIndexRow_ACU[] = Array.isArray(state.rows)
        ? state.rows
            .map((row: any) => normalizeRow_ACU(row))
            .filter((row: ChatSummaryVectorIndexRow_ACU | null): row is ChatSummaryVectorIndexRow_ACU => !!row)
        : [];
    const rows: ChatSummaryVectorIndexRow_ACU[] = normalizedRows.sort((a, b) => a.rowOrder - b.rowOrder);
    const rowKeySet = new Set(rows.map((row: ChatSummaryVectorIndexRow_ACU) => row.rowKey));
    const normalizedChunks: ChatSummaryVectorIndexChunk_ACU[] = Array.isArray(state.chunks)
        ? state.chunks
            .map((chunk: any) => normalizeChunk_ACU(chunk))
            .filter((chunk: ChatSummaryVectorIndexChunk_ACU | null): chunk is ChatSummaryVectorIndexChunk_ACU => !!chunk && rowKeySet.has(chunk.rowKey))
        : [];
    const chunks: ChatSummaryVectorIndexChunk_ACU[] = normalizedChunks.sort((a, b) => a.sequence - b.sequence);

    if (!snapshotMessageId || !sourceTableKey || !sourceTableName || !indexedAt || rows.length === 0 || chunks.length === 0) {
        return null;
    }

    const skippedRowCount = Number(state.skippedRowCount);
    return {
        schemaVersion: 1,
        snapshotMessageId,
        sourceTableKey,
        sourceTableName,
        indexedAt,
        rowCount: rows.length,
        chunkCount: chunks.length,
        skippedRowCount: Number.isFinite(skippedRowCount) && skippedRowCount >= 0 ? Math.floor(skippedRowCount) : 0,
        rows,
        chunks,
    };
}

export function getSummaryVectorIndexStateFromTagData_ACU(
    tagData: IsolationTagData_ACU | null | undefined,
): ChatSummaryVectorIndexState_ACU | null {
    return normalizeSummaryVectorIndexState_ACU(tagData?.summaryVectorIndexState);
}

export function assignSummaryVectorIndexStateToTagData_ACU(
    tagData: IsolationTagData_ACU,
    state: ChatSummaryVectorIndexState_ACU | null | undefined,
): IsolationTagData_ACU {
    const normalized = normalizeSummaryVectorIndexState_ACU(state);
    if (normalized) {
        tagData.summaryVectorIndexState = normalized;
    } else {
        delete tagData.summaryVectorIndexState;
    }
    return tagData;
}

export interface ActiveSummaryVectorIndexSnapshot_ACU {
    messageIndex: number;
    message: any;
    isolationKey: string;
    tagData: IsolationTagData_ACU | null | undefined;
    summaryVectorIndexState: ChatSummaryVectorIndexState_ACU;
}

export function getActiveSummaryVectorIndexSnapshot_ACU(): ActiveSummaryVectorIndexSnapshot_ACU | null {
    const chat = getChatArray_ACU();
    if (!Array.isArray(chat) || chat.length === 0) {
        return null;
    }

    const isolationKey = getCurrentIsolationKey_ACU();
    if (typeof isolationKey !== 'string') {
        return null;
    }

    for (let index = chat.length - 1; index >= 0; index -= 1) {
        const message = chat[index];
        if (!message || message.is_user === true) {
            continue;
        }
        const tagData = readIsolatedTagData_ACU(message, isolationKey);
        const summaryVectorIndexState = getSummaryVectorIndexStateFromTagData_ACU(tagData);
        if (!summaryVectorIndexState) {
            continue;
        }
        return {
            messageIndex: index,
            message,
            isolationKey,
            tagData,
            summaryVectorIndexState,
        };
    }

    return null;
}
