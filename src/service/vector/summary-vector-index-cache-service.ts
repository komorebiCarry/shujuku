import { logDebug_ACU, logWarn_ACU } from '../../shared/utils';
import { getChatArray_ACU, saveChatToHost_ACU } from '../chat/chat-service';
import { readIsolatedTagData_ACU, writeIsolatedTagData_ACU } from '../../data/repositories/chat-message-data-repo';
import { deleteVectorIndexCacheByIndex_ACU } from '../../data/storage/vector-index-temp-cache';
import { assignSummaryVectorIndexStateToTagData_ACU, getLatestSummaryVectorIndexSnapshotState_ACU } from './summary-vector-index-state-service';
import {
    applySummaryVectorIndexManifestRepairs_ACU,
    loadSummaryVectorIndexChunksFromManifest_ACU,
    type SummaryVectorIndexManifestRepair_ACU,
} from './summary-vector-index-storage-service';
import type { ChatSummaryVectorIndexManifest_ACU, ChatSummaryVectorIndexState_ACU } from './summary-vector-index-types';

export interface SummaryVectorIndexCachePreloadResult_ACU {
    success: boolean;
    skipped: boolean;
    reason?: string;
    chunkCount: number;
    indexId?: string;
    error?: string;
    cacheCleared?: boolean;
    chatStateCleared?: boolean;
}

function normalizeErrorMessage_ACU(error: unknown): string {
    if (error instanceof Error) return error.message || error.name || '未知错误';
    if (typeof error === 'string') return error;
    try {
        const json = JSON.stringify(error);
        return json && json !== '{}' ? json : String(error || '未知错误');
    } catch (_jsonError) {
        return String(error || '未知错误');
    }
}

export function isMissingExternalVectorFileError_ACU(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return text.includes('交火向量索引分片读取失败')
        && (text.includes('404') || text.includes('not found') || text.includes('读取失败'));
}

async function clearLatestSummaryVectorIndexState_ACU(params: { messageIndex: number; isolationKey: string }): Promise<boolean> {
    const chat = getChatArray_ACU();
    const message = chat?.[params.messageIndex];
    if (!message || message.is_user) return false;
    const tagData = readIsolatedTagData_ACU(message, params.isolationKey);
    if (!tagData) return false;
    assignSummaryVectorIndexStateToTagData_ACU(tagData, null);
    writeIsolatedTagData_ACU(message, params.isolationKey, tagData);
    await saveChatToHost_ACU();
    return true;
}

export async function clearLatestSummaryVectorIndexStateForMissingExternalFiles_ACU(params: {
    messageIndex: number;
    isolationKey: string;
    indexId: string;
}): Promise<boolean> {
    await deleteVectorIndexCacheByIndex_ACU(params.indexId);
    return clearLatestSummaryVectorIndexState_ACU({
        messageIndex: params.messageIndex,
        isolationKey: params.isolationKey,
    });
}

export async function clearLatestSummaryVectorIndexStateForInvalidExternalFiles_ACU(params: {
    messageIndex: number;
    isolationKey: string;
    indexId: string;
}): Promise<boolean> {
    await deleteVectorIndexCacheByIndex_ACU(params.indexId);
    return clearLatestSummaryVectorIndexState_ACU({
        messageIndex: params.messageIndex,
        isolationKey: params.isolationKey,
    });
}

export function isInvalidExternalVectorFileError_ACU(message: string): boolean {
    const text = String(message || '').toLowerCase();
    return text.includes('交火向量索引分片身份不匹配')
        || text.includes('交火向量索引分片校验失败');
}

export async function persistLatestSummaryVectorIndexManifestRepair_ACU(params: {
    messageIndex: number;
    isolationKey: string;
    currentState: ChatSummaryVectorIndexState_ACU;
    manifest: ChatSummaryVectorIndexManifest_ACU;
    repairs: SummaryVectorIndexManifestRepair_ACU[];
}): Promise<ChatSummaryVectorIndexManifest_ACU | null> {
    if (!params.repairs?.length) return null;
    const chat = getChatArray_ACU();
    const message = chat?.[params.messageIndex];
    if (!message || message.is_user) return null;
    const tagData = readIsolatedTagData_ACU(message, params.isolationKey);
    if (!tagData) return null;
    const repairedManifest = applySummaryVectorIndexManifestRepairs_ACU(params.manifest, params.repairs);
    assignSummaryVectorIndexStateToTagData_ACU(tagData, params.currentState, repairedManifest);
    writeIsolatedTagData_ACU(message, params.isolationKey, tagData);
    await saveChatToHost_ACU();
    logWarn_ACU(`[交火向量索引] 已修复 manifest 分片校验信息并写回聊天记录：indexId=${repairedManifest.indexId}, repairs=${params.repairs.length}`);
    return repairedManifest;
}

export async function preloadSummaryVectorIndexCacheForCurrentChat_ACU(): Promise<SummaryVectorIndexCachePreloadResult_ACU> {
    const snapshot = getLatestSummaryVectorIndexSnapshotState_ACU();
    const latestLayer = snapshot?.layers?.[0] || null;
    const manifest = snapshot?.summaryVectorIndexState?.manifest || null;
    if (!manifest) {
        return {
            success: true,
            skipped: true,
            reason: 'no_manifest',
            chunkCount: 0,
        };
    }

    if (manifest.status !== 'ready') {
        return {
            success: true,
            skipped: true,
            reason: `manifest_status_${manifest.status || 'unknown'}`,
            chunkCount: 0,
            indexId: manifest.indexId,
        };
    }

    try {
        const repairs: SummaryVectorIndexManifestRepair_ACU[] = [];
        const chunks = await loadSummaryVectorIndexChunksFromManifest_ACU(manifest, {
            preferExternalFiles: true,
            allowChecksumRepair: true,
            repairs,
        });
        if (repairs.length > 0 && latestLayer && snapshot?.summaryVectorIndexState) {
            await persistLatestSummaryVectorIndexManifestRepair_ACU({
                messageIndex: latestLayer.messageIndex,
                isolationKey: latestLayer.isolationKey,
                currentState: snapshot.summaryVectorIndexState,
                manifest,
                repairs,
            });
        }
        logDebug_ACU(`[交火向量索引] 当前聊天向量缓存预热完成：indexId=${manifest.indexId}, chunks=${chunks.length}`);
        return {
            success: true,
            skipped: false,
            chunkCount: chunks.length,
            indexId: manifest.indexId,
        };
    } catch (error) {
        const message = normalizeErrorMessage_ACU(error);
        if (isMissingExternalVectorFileError_ACU(message)) {
            const chatStateCleared = latestLayer
                ? await clearLatestSummaryVectorIndexStateForMissingExternalFiles_ACU({
                    messageIndex: latestLayer.messageIndex,
                    isolationKey: latestLayer.isolationKey,
                    indexId: manifest.indexId,
                })
                : false;
            logWarn_ACU('[交火向量索引] 当前聊天外置向量文件缺失，已清空对应缓存与聊天索引状态:', message);
            return {
                success: true,
                skipped: true,
                reason: 'external_files_missing_cache_cleared',
                chunkCount: 0,
                indexId: manifest.indexId,
                error: message,
                cacheCleared: true,
                chatStateCleared,
            };
        }
        if (isInvalidExternalVectorFileError_ACU(message)) {
            const chatStateCleared = latestLayer
                ? await clearLatestSummaryVectorIndexStateForInvalidExternalFiles_ACU({
                    messageIndex: latestLayer.messageIndex,
                    isolationKey: latestLayer.isolationKey,
                    indexId: manifest.indexId,
                })
                : false;
            logWarn_ACU('[交火向量索引] 当前聊天外置向量文件校验失败且不可自愈，已清空对应缓存与聊天索引状态:', message);
            return {
                success: true,
                skipped: true,
                reason: 'external_files_invalid_cache_cleared',
                chunkCount: 0,
                indexId: manifest.indexId,
                error: message,
                cacheCleared: true,
                chatStateCleared,
            };
        }
        logWarn_ACU('[交火向量索引] 当前聊天向量缓存预热失败:', message);
        return {
            success: false,
            skipped: false,
            reason: 'preload_failed',
            chunkCount: 0,
            indexId: manifest.indexId,
            error: message,
        };
    }
}
