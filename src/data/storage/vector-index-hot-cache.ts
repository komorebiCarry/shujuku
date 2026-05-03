import type { ChatSummaryVectorIndexChunk_ACU, ChatSummaryVectorIndexManifest_ACU } from '../../service/vector/summary-vector-index-types';

const DB_NAME_ACU = 'TavernDB_ACU_VectorHotCache';
const DB_VERSION_ACU = 1;
const STORE_NAME_ACU = 'chunks';

export interface VectorIndexHotCacheScope_ACU {
    chatKey?: string;
    isolationKey?: string;
    sourceTableKey?: string;
}

export interface VectorIndexHotCacheWriteOptions_ACU {
    manifest: ChatSummaryVectorIndexManifest_ACU;
    chunks: ChatSummaryVectorIndexChunk_ACU[];
}

export interface VectorIndexHotCacheLoadOptions_ACU {
    manifest: ChatSummaryVectorIndexManifest_ACU;
}

interface VectorIndexHotCacheChunkRecord_ACU {
    key: string;
    chatKey: string;
    isolationKey: string;
    sourceTableKey: string;
    indexId: string;
    checkpointId: string;
    chunkKey: string;
    chunkId: string;
    rowKey: string;
    embeddingModel: string;
    dimension: number;
    checksum: string;
    chunk: ChatSummaryVectorIndexChunk_ACU;
    byteSize: number;
    createdAt: number;
    updatedAt: number;
    lastAccessAt: number;
}

function isIdbAvailable_ACU(): boolean {
    return typeof indexedDB !== 'undefined';
}

function normalizeKeyPart_ACU(value: any): string {
    return String(value || '').trim();
}

function buildRecordKey_ACU(indexId: string, chunkId: string, chunkKey: string): string {
    return `${normalizeKeyPart_ACU(indexId)}::${normalizeKeyPart_ACU(chunkId)}::${normalizeKeyPart_ACU(chunkKey)}`;
}

function openDb_ACU(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (!isIdbAvailable_ACU()) {
            reject(new Error('IndexedDB 不可用'));
            return;
        }
        const request = indexedDB.open(DB_NAME_ACU, DB_VERSION_ACU);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME_ACU)) {
                const store = db.createObjectStore(STORE_NAME_ACU, { keyPath: 'key' });
                store.createIndex('indexId', 'indexId', { unique: false });
                store.createIndex('checkpointId', 'checkpointId', { unique: false });
                store.createIndex('scope', ['chatKey', 'isolationKey', 'sourceTableKey'], { unique: false });
                store.createIndex('lastAccessAt', 'lastAccessAt', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('打开交火向量热缓存失败'));
    });
}

function cloneChunk_ACU(chunk: ChatSummaryVectorIndexChunk_ACU): ChatSummaryVectorIndexChunk_ACU {
    return {
        ...chunk,
        vector: Array.isArray(chunk.vector) ? chunk.vector.map((value) => Number(value) || 0) : [],
        chunkKeys: Array.isArray(chunk.chunkKeys) ? [...chunk.chunkKeys] : chunk.chunkKeys,
    };
}

function getManifestCheckpointId_ACU(manifest: ChatSummaryVectorIndexManifest_ACU): string {
    return normalizeKeyPart_ACU(manifest.checkpoint?.checkpointId || manifest.indexId);
}

function getActiveChunkRefs_ACU(manifest: ChatSummaryVectorIndexManifest_ACU) {
    const refs = Array.isArray(manifest.contentAddressed?.chunkRefs) ? manifest.contentAddressed!.chunkRefs : [];
    const activeChunkKeys = new Set((manifest.contentAddressed?.activeChunkKeys || []).map((item) => normalizeKeyPart_ACU(item)).filter(Boolean));
    return refs.filter((ref) => {
        const chunkKey = normalizeKeyPart_ACU(ref?.chunkKey);
        return chunkKey && (activeChunkKeys.size === 0 || activeChunkKeys.has(chunkKey));
    });
}

function isRecordCompatible_ACU(record: VectorIndexHotCacheChunkRecord_ACU | null | undefined, manifest: ChatSummaryVectorIndexManifest_ACU, ref: ReturnType<typeof getActiveChunkRefs_ACU>[number]): boolean {
    if (!record?.chunk) return false;
    if (record.chatKey !== normalizeKeyPart_ACU(manifest.chatKey)) return false;
    if (record.isolationKey !== normalizeKeyPart_ACU(manifest.isolationKey)) return false;
    if (record.sourceTableKey !== normalizeKeyPart_ACU(manifest.sourceTableKey)) return false;
    if (record.indexId !== normalizeKeyPart_ACU(manifest.indexId)) return false;
    if (record.checkpointId !== getManifestCheckpointId_ACU(manifest)) return false;
    if (record.chunkKey !== normalizeKeyPart_ACU(ref.chunkKey)) return false;
    if (record.chunkId !== normalizeKeyPart_ACU(ref.chunkId)) return false;
    if (record.rowKey !== normalizeKeyPart_ACU(ref.rowKey)) return false;
    if (record.dimension !== Math.max(0, Number(ref.dimension) || 0)) return false;
    if (ref.checksum && record.checksum && record.checksum !== ref.checksum) return false;
    const vector = Array.isArray(record.chunk.vector) ? record.chunk.vector : [];
    return vector.length > 0 && (!ref.dimension || vector.length === ref.dimension);
}

export async function putSummaryVectorHotCacheChunks_ACU(options: VectorIndexHotCacheWriteOptions_ACU): Promise<void> {
    try {
        const manifest = options.manifest;
        if (!manifest?.indexId || manifest.status !== 'ready') return;
        const refs = getActiveChunkRefs_ACU(manifest);
        if (refs.length === 0 || !Array.isArray(options.chunks) || options.chunks.length === 0) return;
        const refsByChunkId = new Map(refs.map((ref) => [normalizeKeyPart_ACU(ref.chunkId), ref]));
        const db = await openDb_ACU();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME_ACU, 'readwrite');
            const store = tx.objectStore(STORE_NAME_ACU);
            const now = Date.now();
            options.chunks.forEach((chunk) => {
                const chunkId = normalizeKeyPart_ACU(chunk?.chunkId);
                const ref = refsByChunkId.get(chunkId);
                const vector = Array.isArray(chunk?.vector) ? chunk.vector : [];
                if (!ref || vector.length === 0) return;
                const chunkKey = normalizeKeyPart_ACU(ref.chunkKey);
                const normalizedChunk = cloneChunk_ACU({
                    ...chunk,
                    chunkKeys: Array.from(new Set([...(Array.isArray(chunk.chunkKeys) ? chunk.chunkKeys : []), chunkKey].filter(Boolean))),
                });
                const json = JSON.stringify(normalizedChunk);
                const record: VectorIndexHotCacheChunkRecord_ACU = {
                    key: buildRecordKey_ACU(manifest.indexId, ref.chunkId, chunkKey),
                    chatKey: normalizeKeyPart_ACU(manifest.chatKey),
                    isolationKey: normalizeKeyPart_ACU(manifest.isolationKey),
                    sourceTableKey: normalizeKeyPart_ACU(manifest.sourceTableKey),
                    indexId: normalizeKeyPart_ACU(manifest.indexId),
                    checkpointId: getManifestCheckpointId_ACU(manifest),
                    chunkKey,
                    chunkId: normalizeKeyPart_ACU(ref.chunkId),
                    rowKey: normalizeKeyPart_ACU(ref.rowKey),
                    embeddingModel: normalizeKeyPart_ACU(ref.embeddingModel || manifest.embeddingModel),
                    dimension: Math.max(0, Number(ref.dimension || vector.length) || 0),
                    checksum: normalizeKeyPart_ACU(ref.checksum),
                    chunk: normalizedChunk,
                    byteSize: new Blob([json]).size,
                    createdAt: now,
                    updatedAt: now,
                    lastAccessAt: now,
                };
                store.put(record);
            });
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('写入交火向量热缓存事务失败'));
            };
        });
    } catch {
        // 热缓存只是可丢失加速层，失败不能影响外置权威链路。
    }
}

export async function getSummaryVectorHotCacheChunks_ACU(options: VectorIndexHotCacheLoadOptions_ACU): Promise<ChatSummaryVectorIndexChunk_ACU[] | null> {
    try {
        const manifest = options.manifest;
        if (!manifest?.indexId || manifest.status !== 'ready') return null;
        const refs = getActiveChunkRefs_ACU(manifest);
        if (refs.length === 0) return null;
        const db = await openDb_ACU();
        const records = await new Promise<Array<VectorIndexHotCacheChunkRecord_ACU | undefined>>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME_ACU, 'readwrite');
            const store = tx.objectStore(STORE_NAME_ACU);
            const loaded: Array<VectorIndexHotCacheChunkRecord_ACU | undefined> = [];
            let pending = refs.length;
            const finishOne = (): void => {
                pending -= 1;
                if (pending === 0) resolve(loaded);
            };
            refs.forEach((ref, index) => {
                const request = store.get(buildRecordKey_ACU(manifest.indexId, ref.chunkId, ref.chunkKey)) as IDBRequest<VectorIndexHotCacheChunkRecord_ACU | undefined>;
                request.onsuccess = () => {
                    const record = request.result;
                    if (record && isRecordCompatible_ACU(record, manifest, ref)) {
                        record.lastAccessAt = Date.now();
                        store.put(record);
                        loaded[index] = record;
                    }
                    finishOne();
                };
                request.onerror = () => reject(request.error || new Error('读取交火向量热缓存失败'));
            });
            tx.oncomplete = () => db.close();
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('读取交火向量热缓存事务失败'));
            };
        });
        if (records.length !== refs.length || records.some((record) => !record)) return null;
        return records
            .map((record) => cloneChunk_ACU(record!.chunk))
            .sort((left, right) => left.sequence - right.sequence || left.chunkId.localeCompare(right.chunkId));
    } catch {
        return null;
    }
}

export async function deleteSummaryVectorHotCacheByIndex_ACU(indexId: string): Promise<void> {
    try {
        const targetIndexId = normalizeKeyPart_ACU(indexId);
        if (!targetIndexId) return;
        const db = await openDb_ACU();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME_ACU, 'readwrite');
            const store = tx.objectStore(STORE_NAME_ACU);
            const index = store.index('indexId');
            const request = index.openCursor(IDBKeyRange.only(targetIndexId));
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            request.onerror = () => reject(request.error || new Error('清理交火向量热缓存失败'));
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('清理交火向量热缓存事务失败'));
            };
        });
    } catch {}
}

export async function deleteSummaryVectorHotCacheByScope_ACU(scope: VectorIndexHotCacheScope_ACU): Promise<void> {
    try {
        const chatKey = normalizeKeyPart_ACU(scope.chatKey);
        const isolationKey = normalizeKeyPart_ACU(scope.isolationKey);
        const sourceTableKey = normalizeKeyPart_ACU(scope.sourceTableKey);
        if (!chatKey && !isolationKey && !sourceTableKey) return;
        const db = await openDb_ACU();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME_ACU, 'readwrite');
            const store = tx.objectStore(STORE_NAME_ACU);
            const request = store.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const record = cursor.value as VectorIndexHotCacheChunkRecord_ACU;
                    const matches = (!chatKey || record.chatKey === chatKey)
                        && (!isolationKey || record.isolationKey === isolationKey)
                        && (!sourceTableKey || record.sourceTableKey === sourceTableKey);
                    if (matches) cursor.delete();
                    cursor.continue();
                }
            };
            request.onerror = () => reject(request.error || new Error('按作用域清理交火向量热缓存失败'));
            tx.oncomplete = () => {
                db.close();
                resolve();
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('按作用域清理交火向量热缓存事务失败'));
            };
        });
    } catch {}
}

export async function clearSummaryVectorHotCache_ACU(): Promise<void> {
    try {
        const db = await openDb_ACU();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_NAME_ACU, 'readwrite');
            const store = tx.objectStore(STORE_NAME_ACU);
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error || new Error('清空交火向量热缓存失败'));
            tx.oncomplete = () => db.close();
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('清空交火向量热缓存事务失败'));
            };
        });
    } catch {}
}

export async function estimateSummaryVectorHotCache_ACU(indexId?: string): Promise<{ bytes: number; count: number }> {
    try {
        const targetIndexId = normalizeKeyPart_ACU(indexId);
        const db = await openDb_ACU();
        return await new Promise((resolve, reject) => {
            let bytes = 0;
            let count = 0;
            const tx = db.transaction(STORE_NAME_ACU, 'readonly');
            const store = tx.objectStore(STORE_NAME_ACU);
            const source = targetIndexId ? store.index('indexId') : store;
            const request = targetIndexId
                ? source.openCursor(IDBKeyRange.only(targetIndexId))
                : source.openCursor();
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    const record = cursor.value as VectorIndexHotCacheChunkRecord_ACU;
                    bytes += Math.max(0, Number(record.byteSize) || 0);
                    count += 1;
                    cursor.continue();
                }
            };
            request.onerror = () => reject(request.error || new Error('估算交火向量热缓存失败'));
            tx.oncomplete = () => {
                db.close();
                resolve({ bytes, count });
            };
            tx.onerror = () => {
                db.close();
                reject(tx.error || new Error('估算交火向量热缓存事务失败'));
            };
        });
    } catch {
        return { bytes: 0, count: 0 };
    }
}
