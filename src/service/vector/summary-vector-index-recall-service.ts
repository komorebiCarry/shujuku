import type {
    ChatSummaryVectorIndexChunk_ACU,
    ChatSummaryVectorIndexRow_ACU,
    ChatSummaryVectorIndexState_ACU,
} from '../../data/models/chat-message-data';
import { createEmbeddings_ACU } from '../../data/gateways/vector-embedding-gateway';
import { createRerankScores_ACU } from '../../data/gateways/vector-rerank-gateway';
import { logWarn_ACU } from '../../shared/utils';
import {
    getEffectiveSummaryVectorIndexConfig_ACU,
    SummaryVectorIndexEffectiveConfig_ACU,
    validateSummaryVectorIndexConfig_ACU,
    validateVectorMemoryRerankConfig_ACU,
} from './vector-memory-config';

export interface SummaryVectorIndexRecallMatch_ACU {
    row: ChatSummaryVectorIndexRow_ACU;
    score: number;
    maxChunkScore: number;
    avgChunkScore: number;
    matchedChunkIds: string[];
    bestChunkText: string;
    rerankScore?: number;
}

export interface SummaryVectorIndexRecallResult_ACU {
    enabled: boolean;
    skipped: boolean;
    queryText: string;
    matches: SummaryVectorIndexRecallMatch_ACU[];
    errors: string[];
    warnings: string[];
}

interface ScoredSummaryChunkCandidate_ACU {
    row: ChatSummaryVectorIndexRow_ACU;
    chunk: ChatSummaryVectorIndexChunk_ACU;
    score: number;
}

interface AggregatedSummaryRowCandidate_ACU {
    row: ChatSummaryVectorIndexRow_ACU;
    chunkMatches: ScoredSummaryChunkCandidate_ACU[];
    maxChunkScore: number;
    avgChunkScore: number;
    finalScore: number;
    rerankScore?: number;
}

function normalizeText_ACU(value: any): string {
    return typeof value === 'string' ? value.trim() : '';
}

function normalizeCandidateLimit_ACU(config: SummaryVectorIndexEffectiveConfig_ACU): number {
    const limit = Number(config.summaryIndexCandidateLimit);
    if (!Number.isFinite(limit) || limit <= 0) {
        return 100;
    }
    return Math.max(1, Math.floor(limit));
}

function normalizeMinScore_ACU(config: SummaryVectorIndexEffectiveConfig_ACU): number {
    const minScore = Number(config.summaryIndexMinScore);
    if (!Number.isFinite(minScore)) {
        return 0.4;
    }
    return Math.min(1, Math.max(0, minScore));
}

function cosineSimilarity_ACU(left: number[], right: number[]): number {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || left.length !== right.length) {
        return -1;
    }
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;
    for (let index = 0; index < left.length; index += 1) {
        const leftValue = Number(left[index]);
        const rightValue = Number(right[index]);
        if (!Number.isFinite(leftValue) || !Number.isFinite(rightValue)) {
            return -1;
        }
        dot += leftValue * rightValue;
        leftNorm += leftValue * leftValue;
        rightNorm += rightValue * rightValue;
    }
    if (leftNorm <= 0 || rightNorm <= 0) {
        return -1;
    }
    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function buildRowMap_ACU(rows: ChatSummaryVectorIndexRow_ACU[]): Map<string, ChatSummaryVectorIndexRow_ACU> {
    const rowMap = new Map<string, ChatSummaryVectorIndexRow_ACU>();
    rows.forEach((row) => {
        const rowKey = normalizeText_ACU(row?.rowKey);
        if (rowKey) {
            rowMap.set(rowKey, row);
        }
    });
    return rowMap;
}

function collectScoredChunkCandidates_ACU(
    state: ChatSummaryVectorIndexState_ACU,
    queryEmbedding: number[],
    config: SummaryVectorIndexEffectiveConfig_ACU,
): ScoredSummaryChunkCandidate_ACU[] {
    const rowMap = buildRowMap_ACU(Array.isArray(state.rows) ? state.rows : []);
    const minScore = normalizeMinScore_ACU(config);
    const candidates: ScoredSummaryChunkCandidate_ACU[] = [];
    (Array.isArray(state.chunks) ? state.chunks : []).forEach((chunk) => {
        const row = rowMap.get(normalizeText_ACU(chunk?.rowKey));
        if (!row) {
            return;
        }
        const score = cosineSimilarity_ACU(queryEmbedding, Array.isArray(chunk?.vector) ? chunk.vector : []);
        if (score >= minScore) {
            candidates.push({ row, chunk, score });
        }
    });
    return candidates.sort((left, right) => right.score - left.score);
}

function aggregateRowCandidates_ACU(chunkCandidates: ScoredSummaryChunkCandidate_ACU[]): AggregatedSummaryRowCandidate_ACU[] {
    const aggregated = new Map<string, AggregatedSummaryRowCandidate_ACU>();
    chunkCandidates.forEach((candidate) => {
        const rowKey = normalizeText_ACU(candidate.row?.rowKey);
        if (!rowKey) {
            return;
        }
        const existing = aggregated.get(rowKey);
        if (existing) {
            existing.chunkMatches.push(candidate);
            return;
        }
        aggregated.set(rowKey, {
            row: candidate.row,
            chunkMatches: [candidate],
            maxChunkScore: 0,
            avgChunkScore: 0,
            finalScore: 0,
        });
    });

    return Array.from(aggregated.values())
        .map((candidate) => {
            const scores = candidate.chunkMatches.map((item) => item.score).filter((score) => Number.isFinite(score));
            const maxChunkScore = scores.length > 0 ? Math.max(...scores) : 0;
            const avgChunkScore = scores.length > 0
                ? scores.reduce((total, score) => total + score, 0) / scores.length
                : 0;
            const multiChunkBoost = scores.length > 1 ? Math.min(0.08, (scores.length - 1) * 0.02) : 0;
            return {
                ...candidate,
                maxChunkScore,
                avgChunkScore,
                finalScore: maxChunkScore + multiChunkBoost,
            };
        })
        .sort((left, right) => right.finalScore - left.finalScore);
}

function applyRerankScores_ACU(
    candidates: AggregatedSummaryRowCandidate_ACU[],
    rerankResults: { index: number; relevanceScore: number }[],
): AggregatedSummaryRowCandidate_ACU[] {
    if (!Array.isArray(rerankResults) || rerankResults.length === 0) {
        return candidates;
    }
    const rerankMap = new Map<number, number>();
    rerankResults.forEach((item) => {
        const index = Number(item?.index);
        const relevanceScore = Number(item?.relevanceScore);
        if (!Number.isFinite(index) || index < 0 || !Number.isFinite(relevanceScore)) {
            return;
        }
        rerankMap.set(Math.floor(index), relevanceScore);
    });

    return candidates
        .map((candidate, originalIndex) => ({
            candidate,
            originalIndex,
            rerankScore: rerankMap.get(originalIndex),
        }))
        .sort((left, right) => {
            const leftHasRerank = Number.isFinite(left.rerankScore);
            const rightHasRerank = Number.isFinite(right.rerankScore);
            if (leftHasRerank && rightHasRerank) {
                return Number(right.rerankScore) - Number(left.rerankScore);
            }
            if (leftHasRerank) return -1;
            if (rightHasRerank) return 1;
            return left.originalIndex - right.originalIndex;
        })
        .map(({ candidate, rerankScore }) => ({
            ...candidate,
            finalScore: Number.isFinite(rerankScore) ? Number(rerankScore) : candidate.finalScore,
            rerankScore: Number.isFinite(rerankScore) ? Number(rerankScore) : undefined,
        }));
}

function buildRecallMatches_ACU(candidates: AggregatedSummaryRowCandidate_ACU[], limit: number): SummaryVectorIndexRecallMatch_ACU[] {
    return candidates
        .slice(0, limit)
        .sort((left, right) => left.row.rowOrder - right.row.rowOrder)
        .map((candidate) => {
            const sortedChunks = [...candidate.chunkMatches].sort((left, right) => right.score - left.score);
            const bestChunk = sortedChunks[0] || null;
            return {
                row: candidate.row,
                score: candidate.finalScore,
                maxChunkScore: candidate.maxChunkScore,
                avgChunkScore: candidate.avgChunkScore,
                matchedChunkIds: sortedChunks.map((item) => item.chunk.chunkId).filter(Boolean),
                bestChunkText: normalizeText_ACU(bestChunk?.chunk?.text),
                rerankScore: candidate.rerankScore,
            };
        });
}

export async function recallSummaryVectorIndex_ACU(
    queryTextInput: any,
    stateInput: ChatSummaryVectorIndexState_ACU | null | undefined,
    configInput?: any,
): Promise<SummaryVectorIndexRecallResult_ACU> {
    const queryText = normalizeText_ACU(queryTextInput);
    const config = getEffectiveSummaryVectorIndexConfig_ACU(configInput);
    const validation = validateSummaryVectorIndexConfig_ACU(config);
    const state = stateInput && typeof stateInput === 'object' ? stateInput : null;

    if (!queryText) {
        return {
            enabled: true,
            skipped: true,
            queryText,
            matches: [],
            errors: [],
            warnings: [],
        };
    }

    if (!validation.valid) {
        return {
            enabled: true,
            skipped: true,
            queryText,
            matches: [],
            errors: [...validation.errors],
            warnings: [],
        };
    }

    if (!state || !Array.isArray(state.rows) || state.rows.length === 0 || !Array.isArray(state.chunks) || state.chunks.length === 0) {
        return {
            enabled: true,
            skipped: true,
            queryText,
            matches: [],
            errors: [],
            warnings: ['当前聊天没有可召回的纪要向量索引归档。'],
        };
    }

    try {
        const embeddings = await createEmbeddings_ACU({
            endpoint: config.embeddingEndpoint,
            apiKey: config.embeddingApiKey,
            model: config.embeddingModel,
            input: [queryText],
        });
        const queryEmbedding = embeddings[0]?.embedding;
        if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
            return {
                enabled: true,
                skipped: true,
                queryText,
                matches: [],
                errors: ['纪要向量索引召回 embedding 结果为空'],
                warnings: [],
            };
        }

        const candidateLimit = normalizeCandidateLimit_ACU(config);
        const chunkCandidates = collectScoredChunkCandidates_ACU(state, queryEmbedding, config);
        const heuristicCandidates = aggregateRowCandidates_ACU(chunkCandidates).slice(0, candidateLimit);
        const warnings: string[] = [];
        let finalCandidates = heuristicCandidates;
        const rerankValidation = validateVectorMemoryRerankConfig_ACU(config);
        const hasRerankConfigInput = !!(config.rerankEndpoint || config.rerankModel || config.rerankApiKey);

        if (heuristicCandidates.length > 1) {
            if (rerankValidation.valid) {
                try {
                    const rerankResults = await createRerankScores_ACU({
                        endpoint: config.rerankEndpoint,
                        apiKey: config.rerankApiKey,
                        model: config.rerankModel,
                        query: queryText,
                        documents: heuristicCandidates.map((candidate) => candidate.row.vectorSourceText || candidate.row.summary),
                    });
                    if (rerankResults.length > 0) {
                        finalCandidates = applyRerankScores_ACU(heuristicCandidates, rerankResults);
                    } else {
                        warnings.push('纪要向量索引 Rerank 结果为空，已回退本地相似度排序。');
                    }
                } catch (error) {
                    logWarn_ACU('[纪要向量索引] Rerank 失败，已回退本地相似度排序:', error);
                    warnings.push(`纪要向量索引 Rerank 失败，已回退本地相似度排序: ${error instanceof Error ? error.message : String(error)}`);
                }
            } else if (hasRerankConfigInput && rerankValidation.errors.length > 0) {
                warnings.push(...rerankValidation.errors.map((item) => `${item}；纪要向量索引已回退本地相似度排序`));
            }
        }

        const matches = buildRecallMatches_ACU(finalCandidates, candidateLimit);
        return {
            enabled: true,
            skipped: false,
            queryText,
            matches,
            errors: [],
            warnings,
        };
    } catch (error) {
        logWarn_ACU('[纪要向量索引] 召回失败:', error);
        return {
            enabled: true,
            skipped: true,
            queryText,
            matches: [],
            errors: [error instanceof Error ? error.message : String(error)],
            warnings: [],
        };
    }
}
