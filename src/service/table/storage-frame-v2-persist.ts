import { getChatArray_ACU, saveChatToHost_ACU, saveChatToHostStrict_ACU } from '../../data/gateways/chat-gateway';
import { cloneIsolatedData_ACU, writeMessageIdentity_ACU } from '../../data/repositories/chat-message-data-repo';
import { getChatScopedConfigContainer_ACU, getChatSheetGuideContainer_ACU, setChatScopedConfigContainer_ACU, setChatSheetGuideContainer_ACU } from '../../data/storage/chat-history';
import type { Sheet_ACU, TableDataObject_ACU } from '../../shared/models/table-data';
import { logDebug_ACU, logWarn_ACU } from '../../shared/utils';
import { getCurrentIsolationKey_ACU, settings_ACU } from '../runtime/state-manager';
import { setChatSheetGuideDataForIsolationKey_ACU } from '../template/chat-scope';
import type { ManualRefillProgressV2_ACU, TableMutationEventV2_ACU, TableMutationLogEntryV2_ACU, TableMutationSourceV2_ACU, TableStorageFrameV2_ACU, TableCheckpointV2_ACU, TableMutationWriteSetV2_ACU, TableMutationOperationV2_ACU, TableSheetCheckpointV2_ACU } from './storage-frame-v2-types';
import { isV2TagData_ACU } from './storage-strategy-resolver';
import { collectScheduleSummaryFromFramesV2_ACU, loadTableStateFromFramesV2_ACU } from './storage-frame-v2-replay';
import { runTableWriteTransaction_ACU, type TableWriteTransactionContext_ACU } from './table-write-transaction';
import { formatCanonicalRowIssues_ACU, normalizeCanonicalTableRows_ACU } from '../../shared/canonical-row-normalizer';
import { createSheetInsertPlan, generateDDL, validateDDLTextAgainstHeaders_ACU } from '../../data/sqlite/schema-mapper';

export interface TableCheckpointGenerationConfig_ACU {
  maxEntriesAfterCheckpoint: number;
  maxOperationKbAfterCheckpoint: number;
  maxOperationBytesAfterCheckpoint: number;
  maxOperationCountAfterCheckpoint: number;
  cumulativeOperationRatioPercent: number;
  singleOperationRatioPercent: number;
  cumulativeOperationRatio: number;
  singleOperationRatio: number;
}

export interface TableCheckpointGenerationStatus_ACU {
  latestCheckpointMessageIndex?: number;
  latestCheckpointAiFloor?: number;
  entryCountAfterCheckpoint: number;
  cumulativeOperationBytes: number;
  cumulativeOperationCount: number;
  fullCheckpointBytes: number;
  nextWriteKind: 'incremental' | 'full';
  config: TableCheckpointGenerationConfig_ACU;
}

export interface PersistTableMutationV2Options_ACU {
  targetMessageIndex?: number;
  source: TableMutationSourceV2_ACU;
  afterData: TableDataObject_ACU;
  operations?: TableMutationOperationV2_ACU[];
  filledSheetKeys?: string[];
  candidateChangedSheetKeys?: string[] | null;
  groupKeys?: string[];
  requestId?: string;
  batchId?: string;
  error?: string;
  forceCheckpoint?: boolean;
  checkpointReason?: TableCheckpointV2_ACU['reason'];
  manualRefillProgress?: ManualRefillProgressV2_ACU;
  isolationKey?: string;
  baseRevision?: string | null;
  parentRevision?: string | null;
  writeSet?: TableMutationWriteSetV2_ACU;
  revisionWriteSet?: TableMutationWriteSetV2_ACU;
  /** 调用方已处于 transactionContext.runCommit 临界区内时使用，避免嵌套 commit 锁。 */
  assumeCommitLock?: boolean;
  /** 对破坏性复合写入要求宿主真实保存；默认保持历史宽松保存语义。 */
  strictSave?: boolean;
  transactionContext?: Pick<TableWriteTransactionContext_ACU, 'runCommit' | 'baseRevision' | 'writeSet' | 'assertFresh'>;
}

export interface PersistTableSheetCheckpointV2Options_ACU {
  targetMessageIndex?: number;
  sheetKey: string;
  sheetData: Sheet_ACU;
  reason?: TableCheckpointV2_ACU['reason'];
  createdAt?: number;
  event?: TableMutationEventV2_ACU;
  manualRefillProgress?: ManualRefillProgressV2_ACU;
  isolationKey?: string;
  baseRevision?: string | null;
  /** 调用方已处于 transactionContext.runCommit 临界区内时使用，避免嵌套 commit 锁。 */
  assumeCommitLock?: boolean;
  transactionContext?: Pick<TableWriteTransactionContext_ACU, 'runCommit' | 'baseRevision' | 'writeSet' | 'assertFresh'>;
}

export interface CommitCurrentFloorTemplateChangesOptions_ACU {
  /** 未指定时选择当前聊天末尾的最新 AI 楼层。 */
  targetMessageIndex?: number;
  isolationKey?: string;
  /** 结构保存只接受完整的单表快照，不能借 operation log 猜测结构变更。 */
  sheetCheckpoints: Array<{
    sheetKey: string;
    sheetData: Sheet_ACU;
    /** 由模板差异分类器确认的新表；writer 据此按 frame 尾部时序写 introduction shard。 */
    isNewSheet?: boolean;
    event?: TableMutationEventV2_ACU;
  }>;
  guideData: Record<string, any>;
  /** 同步当前聊天模板 scope；由 guide setter 生成一致的 chat_override 快照。 */
  syncTemplateScope?: boolean;
  templateSource?: any;
  presetName?: string;
  source?: string;
  reason?: string;
  createdAt?: number;
  baseRevision?: string | null;
}

export interface CommitCurrentFloorTemplateChangesResult_ACU {
  saved: boolean;
  messageIndex?: number;
  checkpoints?: TableSheetCheckpointV2_ACU[];
  removedNullRowCount?: number;
  error?: string;
}

export type NullRowCleanupPersistStatus_ACU =
  | 'persisted'
  | 'skipped_no_changes'
  | 'skipped_no_target'
  | 'skipped_no_anchor'
  | 'skipped_no_v2_target'
  | 'skipped_invalid_data'
  | 'failed';

export interface PersistNullRowCleanupShardsOptions_ACU {
  sheetDataByKey: Record<string, Sheet_ACU>;
  isolationKey?: string;
  createdAt?: number;
}

export interface PersistNullRowCleanupShardsResult_ACU {
  status: NullRowCleanupPersistStatus_ACU;
  messageIndex?: number;
  checkpoints?: TableSheetCheckpointV2_ACU[];
  error?: string;
}

function safeJsonByteLength_ACU(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function cloneOptionalJson_ACU<T>(value: T): T {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function countOperationUnits_ACU(operations: unknown[]): number {
  return operations.reduce<number>((sum, operation: any) => {
    if ((operation?.kind === 'sql_batch' || operation?.kind === 'sql_sheet_batch') && Array.isArray(operation.statements)) return sum + operation.statements.length;
    if (operation?.kind === 'data_replace' || operation?.kind === 'sheet_replace') return sum + 1;
    return sum + 1;
  }, 0);
}

function normalizePositiveIntegerSetting_ACU(value: unknown, fallback: number): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 1 ? Math.floor(num) : fallback;
}

export function resolveCheckpointGenerationConfig_ACU(): TableCheckpointGenerationConfig_ACU {
  // 单一保留边界 checkpoint 策略下，运行期 full checkpoint 不再由用户阈值触发。
  // 这里保留 status shape 给旧调用方读取日志统计，但这些值不再参与写入判定。
  const maxOperationKbAfterCheckpoint = Number.MAX_SAFE_INTEGER;
  const cumulativeOperationRatioPercent = 100;
  const singleOperationRatioPercent = 100;

  return {
    maxEntriesAfterCheckpoint: Number.MAX_SAFE_INTEGER,
    maxOperationKbAfterCheckpoint,
    maxOperationBytesAfterCheckpoint: maxOperationKbAfterCheckpoint * 1024,
    maxOperationCountAfterCheckpoint: Number.MAX_SAFE_INTEGER,
    cumulativeOperationRatioPercent,
    singleOperationRatioPercent,
    cumulativeOperationRatio: cumulativeOperationRatioPercent / 100,
    singleOperationRatio: singleOperationRatioPercent / 100,
  };
}

function deepClone_ACU<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function generateEntryId_ACU(): string {
  return `v2_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function buildCommitRevision_ACU(seq: number | 'checkpoint', entryId: string): string {
  return `${seq}:${entryId}`;
}

function findTargetAiMessage_ACU(chat: any[], targetMessageIndex: number | undefined): { message: any; index: number } | null {
  if (targetMessageIndex !== undefined && targetMessageIndex !== -1) {
    const message = chat[targetMessageIndex];
    if (message && !message.is_user) {
      return { message, index: targetMessageIndex };
    }
    return null;
  }

  for (let i = chat.length - 1; i >= 0; i -= 1) {
    if (chat[i] && !chat[i].is_user) {
      return { message: chat[i], index: i };
    }
  }

  return null;
}

function countAiFloor_ACU(chat: any[], messageIndex: number): number {
  let count = 0;
  for (let i = 0; i <= messageIndex && i < chat.length; i += 1) {
    if (chat[i] && !chat[i].is_user) count += 1;
  }
  return count;
}

function hasAnyV2Checkpoint_ACU(chat: any[], isolationKey: string): boolean {
  return chat.some(message => {
    const tagData = message?.TavernDB_ACU_IsolatedData?.[isolationKey];
    return isV2TagData_ACU(tagData) && tagData.storageFrame.checkpoint?.kind === 'full';
  });
}

function hasAnyV2Frame_ACU(chat: any[], isolationKey: string): boolean {
  return chat.some(message => {
    const tagData = message?.TavernDB_ACU_IsolatedData?.[isolationKey];
    return isV2TagData_ACU(tagData);
  });
}

export function getLatestTableStorageHeadRevisionV2_ACU(chat: any[] | null | undefined, isolationKey: string): string | null {
  if (!Array.isArray(chat) || chat.length === 0) return null;
  let headRevision: string | null = null;
  for (const message of chat) {
    const tagData = message?.TavernDB_ACU_IsolatedData?.[isolationKey];
    if (isV2TagData_ACU(tagData)) {
      headRevision = tagData.storageFrame.headRevision ?? headRevision;
    }
  }
  return headRevision;
}

function findLatestFullCheckpoint_ACU(
  chat: any[] | null | undefined,
  isolationKey: string,
): { message: any; index: number; checkpoint: TableCheckpointV2_ACU } | null {
  if (!Array.isArray(chat) || chat.length === 0) return null;
  for (let i = chat.length - 1; i >= 0; i -= 1) {
    const tagData = chat[i]?.TavernDB_ACU_IsolatedData?.[isolationKey];
    if (isV2TagData_ACU(tagData) && tagData.storageFrame.checkpoint?.kind === 'full') {
      return { message: chat[i], index: i, checkpoint: tagData.storageFrame.checkpoint };
    }
  }
  return null;
}

function getLogEntriesAfterLatestCheckpoint_ACU(chat: any[], isolationKey: string): TableMutationLogEntryV2_ACU[] {
  const latestCheckpoint = findLatestFullCheckpoint_ACU(chat, isolationKey);
  const latestCheckpointIndex = latestCheckpoint?.index ?? -1;
  const entries: TableMutationLogEntryV2_ACU[] = [];
  for (let i = Math.max(0, latestCheckpointIndex); i < chat.length; i += 1) {
    const tagData = chat[i]?.TavernDB_ACU_IsolatedData?.[isolationKey];
    if (isV2TagData_ACU(tagData)) {
      entries.push(...(tagData.storageFrame.logEntries || []));
    }
  }
  return entries;
}

export function collectCheckpointGenerationStatusV2_ACU(
  chat: any[] | null | undefined,
  isolationKey: string,
  currentData?: TableDataObject_ACU | null,
): TableCheckpointGenerationStatus_ACU {
  const config = resolveCheckpointGenerationConfig_ACU();
  const safeChat = Array.isArray(chat) ? chat : [];
  const latestCheckpoint = findLatestFullCheckpoint_ACU(safeChat, isolationKey);
  const previousEntries = getLogEntriesAfterLatestCheckpoint_ACU(safeChat, isolationKey);
  const previousOperations = previousEntries.flatMap(entry => entry.operations || []);
  const fullCheckpointSource = currentData || latestCheckpoint?.checkpoint?.data || {};
  const fullCheckpointBytes = Math.max(1, safeJsonByteLength_ACU(fullCheckpointSource));
  const cumulativeOperationBytes = safeJsonByteLength_ACU(previousOperations);
  const cumulativeOperationCount = countOperationUnits_ACU(previousOperations);

  return {
    ...(latestCheckpoint ? {
      latestCheckpointMessageIndex: latestCheckpoint.index,
      latestCheckpointAiFloor: countAiFloor_ACU(safeChat, latestCheckpoint.index),
    } : {}),
    entryCountAfterCheckpoint: previousEntries.length,
    cumulativeOperationBytes,
    cumulativeOperationCount,
    fullCheckpointBytes,
    nextWriteKind: latestCheckpoint ? 'incremental' : 'full',
    config,
  };
}

function normalizeKeys_ACU(keys: string[] | null | undefined, data?: TableDataObject_ACU): string[] {
  if (!Array.isArray(keys)) return [];
  return [...new Set(keys.filter(key => typeof key === 'string' && key.startsWith('sheet_') && (!data || Boolean(data[key]))))];
}

function normalizeOperations_ACU(
  operations: TableMutationOperationV2_ACU[] | null | undefined,
  afterData: TableDataObject_ACU,
  source: TableMutationSourceV2_ACU,
): TableMutationOperationV2_ACU[] {
  if (Array.isArray(operations) && operations.length > 0) {
    return deepClone_ACU(operations);
  }
  if (source === 'import') {
    return [{
      kind: 'data_replace',
      data: deepClone_ACU(afterData),
      reason: 'import',
    }];
  }
  return [];
}

function getOrInitV2Frame_ACU(isolatedData: Record<string, any>, isolationKey: string): TableStorageFrameV2_ACU {
  const tagData = isolatedData[isolationKey];
  if (isV2TagData_ACU(tagData)) {
    return tagData.storageFrame;
  }

  const nextTagData: any = {
    storageFrame: {
      version: 2,
      logEntries: [],
    },
    _acu_storage_version: 2,
  };

  if (tagData?.summaryVectorIndexState !== undefined) {
    nextTagData.summaryVectorIndexState = tagData.summaryVectorIndexState;
  }
  if (tagData?.summaryVectorIndexManifest !== undefined) {
    nextTagData.summaryVectorIndexManifest = tagData.summaryVectorIndexManifest;
  }

  isolatedData[isolationKey] = nextTagData;
  return nextTagData.storageFrame;
}

function isObjectRecord_ACU(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function logEntryConflictsWithSheetCheckpoint_ACU(entry: TableMutationLogEntryV2_ACU, sheetKey: string): boolean {
  if ([...(entry.filledSheetKeys || []), ...(entry.changedSheetKeys || []), ...(entry.groupKeys || [])].includes(sheetKey)) {
    return true;
  }

  for (const operation of entry.operations || []) {
    if (operation.kind === 'data_replace' || operation.kind === 'sql_batch' || operation.kind === 'table_edit_dsl') {
      return true;
    }
    if ('sheetKey' in operation && operation.sheetKey === sheetKey) {
      return true;
    }
  }

  return (entry.patches || []).some(patch => patch.sheetKey === sheetKey);
}

function getValidatedFrameLastLogSeq_ACU(frame: TableStorageFrameV2_ACU): number {
  let previousSeq = -1;
  for (const [index, entry] of frame.logEntries.entries()) {
    const seq = entry?.seq;
    if (!Number.isInteger(seq) || seq < 0) {
      throw new Error(`V2 当前楼层模板提交包含非法 log seq: index=${index}, seq=${String(seq)}。`);
    }
    if (seq <= previousSeq) {
      throw new Error(`V2 当前楼层模板提交要求 log seq 唯一且严格递增: previous=${previousSeq}, current=${seq}。`);
    }
    previousSeq = seq;
  }
  return Math.max(0, previousSeq);
}

function checkpointDataContainsSheet_ACU(checkpoint: TableCheckpointV2_ACU | null | undefined, sheetKey: string): boolean {
  return Boolean(checkpoint?.data && Object.prototype.hasOwnProperty.call(checkpoint.data, sheetKey));
}

function recordContainsSheet_ACU(value: unknown, sheetKey: string): boolean {
  return isObjectRecord_ACU(value) && Object.prototype.hasOwnProperty.call(value, sheetKey);
}

function hasV2HistoryMarker_ACU(tagData: unknown): boolean {
  return isObjectRecord_ACU(tagData)
    && (tagData._acu_storage_version === 2 || tagData.storageFrame?.version === 2);
}

const CHECKPOINT_REASONS_FOR_INTRODUCTION_HISTORY_ACU = new Set([
  'init', 'periodic', 'manual', 'schema_change', 'compaction', 'import', 'migration', 'integrity_repair',
]);

function isFiniteNonNegativeNumber_ACU(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isFiniteNonNegativeInteger_ACU(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

const MUTATION_SOURCES_FOR_INTRODUCTION_HISTORY_ACU = new Set<TableMutationSourceV2_ACU>([
  'auto_fill', 'manual_fill', 'group_fill', 'manual_crud', 'raw_sql_mutation', 'raw_sql_batch', 'import', 'merge_summary', 'template_assistant', 'system',
]);

function isStringArray_ACU(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

function eventIsValidForIntroductionHistory_ACU(value: unknown): boolean {
  return value === undefined || (
    isObjectRecord_ACU(value)
    && isStringArray_ACU(value.filledSheetKeys)
    && isStringArray_ACU(value.changedSheetKeys)
    && (value.groupKeys === undefined || isStringArray_ACU(value.groupKeys))
    && (value.requestId === undefined || typeof value.requestId === 'string')
    && (value.batchId === undefined || typeof value.batchId === 'string')
    && (value.error === undefined || typeof value.error === 'string')
  );
}

function scheduleSummaryIsValidForIntroductionHistory_ACU(value: unknown): boolean {
  return value === undefined || (
    isObjectRecord_ACU(value)
    && Object.values(value).every(summary => isObjectRecord_ACU(summary)
      && (summary.lastFilledAiFloor === undefined || isFiniteNonNegativeNumber_ACU(summary.lastFilledAiFloor))
      && (summary.lastChangedAiFloor === undefined || isFiniteNonNegativeNumber_ACU(summary.lastChangedAiFloor)))
  );
}

function manualRefillProgressIsValidForIntroductionHistory_ACU(value: unknown): boolean {
  return value === undefined || (
    isObjectRecord_ACU(value)
    && value.kind === 'manual_refill'
    && (value.status === 'in_progress' || value.status === 'complete')
    && isStringArray_ACU(value.selectedSheetKeys)
    && Array.isArray(value.contextMessageIndices) && value.contextMessageIndices.every(Number.isInteger)
    && ['originalStartMessageIndex', 'targetMessageIndex', 'batchSize', 'completedUntilMessageIndex', 'updatedAt']
      .every(key => isFiniteNonNegativeNumber_ACU(value[key]))
    && (value.completedSheetMessageIndexByKey === undefined || (
      isObjectRecord_ACU(value.completedSheetMessageIndexByKey)
      && Object.values(value.completedSheetMessageIndexByKey).every(Number.isInteger)
    ))
  );
}

function timelineIsValidForIntroductionHistory_ACU(value: unknown): boolean {
  return value === undefined || (
    isObjectRecord_ACU(value)
    && value.kind === 'sheet_introduction'
    && Number.isInteger(value.activateAtMessageIndex) && value.activateAtMessageIndex >= 0
    && Number.isInteger(value.afterSeq) && value.afterSeq >= 0
  );
}

function sheetIsValidForIntroductionHistory_ACU(value: unknown): boolean {
  return isObjectRecord_ACU(value)
    && typeof value.uid === 'string'
    && typeof value.name === 'string'
    && isObjectRecord_ACU(value.sourceData)
    && Array.isArray(value.content)
    && value.content.every(row => Array.isArray(row) && row.every(cell => cell === null || typeof cell === 'string'))
    && isObjectRecord_ACU(value.updateConfig)
    && isObjectRecord_ACU(value.exportConfig)
    && typeof value.orderNo === 'number' && Number.isFinite(value.orderNo);
}

function schemaDescriptorIsValidForIntroductionHistory_ACU(value: unknown, version: 1 | 2): boolean {
  if (!isObjectRecord_ACU(value)
    || value.descriptorVersion !== version
    || !['uid', 'tableName', 'ddl', 'normalizedSql', 'tableSuffix'].every(key => typeof value[key] === 'string')
    || !Array.isArray(value.headers) || !value.headers.every(header => header === null || typeof header === 'string')
    || !isStringArray_ACU(value.tableConstraints)
    || !Array.isArray(value.columns)
  ) return false;

  return value.columns.every(column => isObjectRecord_ACU(column)
    && isFiniteNonNegativeInteger_ACU(column.index)
    && ['physicalName', 'displayHeader', 'normalizedDefinition'].every(key => typeof column[key] === 'string')
    && (version === 1 || column.defaultExpression === null || typeof column.defaultExpression === 'string'));
}

function migrationIsValidForIntroductionHistory_ACU(operation: Record<string, any>): boolean {
  if (typeof operation.sheetKey !== 'string'
    || ![1, 2].includes(operation.contractVersion)
    || typeof operation.beforeSchemaDigest !== 'string'
    || typeof operation.targetSchemaDigest !== 'string'
    || !schemaDescriptorIsValidForIntroductionHistory_ACU(operation.beforeSchema, operation.contractVersion)
    || !schemaDescriptorIsValidForIntroductionHistory_ACU(operation.targetSchema, operation.contractVersion)
  ) return false;

  if (operation.contractVersion === 1) {
    return Array.isArray(operation.columnChanges)
      && operation.columnChanges.every(change => isObjectRecord_ACU(change)
        && ['rename_display', 'add', 'drop'].includes(change.kind)
        && typeof change.physicalName === 'string'
        && ((change.kind === 'rename_display' && typeof change.fromHeader === 'string' && typeof change.toHeader === 'string')
          || (change.kind === 'add' && typeof change.header === 'string' && isFiniteNonNegativeInteger_ACU(change.index))
          || (change.kind === 'drop' && typeof change.header === 'string' && isFiniteNonNegativeInteger_ACU(change.index))))
      && isObjectRecord_ACU(operation.migrationPolicy)
      && typeof operation.migrationPolicy.destructiveChangeConfirmed === 'boolean';
  }

  return Array.isArray(operation.physicalColumnMappings)
    && operation.physicalColumnMappings.every(mapping => isObjectRecord_ACU(mapping)
      && typeof mapping.fromPhysicalName === 'string' && typeof mapping.toPhysicalName === 'string')
    && isObjectRecord_ACU(operation.fills)
    && Array.isArray(operation.conversions)
    && operation.conversions.every(conversion => isObjectRecord_ACU(conversion)
      && typeof conversion.fromPhysicalName === 'string'
      && typeof conversion.toPhysicalName === 'string'
      && isObjectRecord_ACU(conversion.policy)
      && ['identity', 'stringify', 'integer_strict', 'real_strict'].includes(conversion.policy.kind))
    && isObjectRecord_ACU(operation.dryRun)
    && ['convertedRowCount', 'failedRowCount', 'lossyRowCount'].every(key => isFiniteNonNegativeInteger_ACU(operation.dryRun[key]))
    && isObjectRecord_ACU(operation.migrationPolicy)
    && typeof operation.migrationPolicy.destructiveChangeConfirmed === 'boolean'
    && typeof operation.migrationPolicy.lossyConversionConfirmed === 'boolean';
}

function logEntryIsValidForIntroductionHistory_ACU(value: unknown): value is Record<string, any> {
  return isObjectRecord_ACU(value)
    && isFiniteNonNegativeInteger_ACU(value.seq)
    && typeof value.entryId === 'string'
    && isFiniteNonNegativeNumber_ACU(value.createdAt)
    && typeof value.source === 'string' && MUTATION_SOURCES_FOR_INTRODUCTION_HISTORY_ACU.has(value.source as TableMutationSourceV2_ACU)
    && isFiniteNonNegativeInteger_ACU(value.targetMessageIndex)
    && isFiniteNonNegativeInteger_ACU(value.aiFloor)
    && eventIsValidForIntroductionHistory_ACU(value)
    && Array.isArray(value.operations)
    && (value.baseRevision === undefined || value.baseRevision === null || typeof value.baseRevision === 'string')
    && (value.parentRevision === undefined || value.parentRevision === null || typeof value.parentRevision === 'string')
    && (value.commitRevision === undefined || typeof value.commitRevision === 'string');
}

function checkpointIsValidForIntroductionHistory_ACU(value: unknown): value is TableCheckpointV2_ACU {
  return isObjectRecord_ACU(value)
    && value.kind === 'full'
    && isFiniteNonNegativeNumber_ACU(value.createdAt)
    && typeof value.reason === 'string' && CHECKPOINT_REASONS_FOR_INTRODUCTION_HISTORY_ACU.has(value.reason)
    && isObjectRecord_ACU(value.data)
    && scheduleSummaryIsValidForIntroductionHistory_ACU(value.scheduleSummary)
    && eventIsValidForIntroductionHistory_ACU(value.event)
    && manualRefillProgressIsValidForIntroductionHistory_ACU(value.manualRefillProgress);
}

function sheetCheckpointMapIsValidForIntroductionHistory_ACU(value: unknown): value is Record<string, TableSheetCheckpointV2_ACU> {
  return isObjectRecord_ACU(value)
    && Object.entries(value).every(([sheetKey, checkpoint]) => (
      sheetKey.startsWith('sheet_')
      && isObjectRecord_ACU(checkpoint)
      && checkpoint.kind === 'sheet_full'
      && checkpoint.sheetKey === sheetKey
      && isFiniteNonNegativeNumber_ACU(checkpoint.createdAt)
      && typeof checkpoint.reason === 'string' && CHECKPOINT_REASONS_FOR_INTRODUCTION_HISTORY_ACU.has(checkpoint.reason)
      && isObjectRecord_ACU(checkpoint.data)
      && scheduleSummaryIsValidForIntroductionHistory_ACU(checkpoint.scheduleSummary)
      && eventIsValidForIntroductionHistory_ACU(checkpoint.event)
      && manualRefillProgressIsValidForIntroductionHistory_ACU(checkpoint.manualRefillProgress)
      && (checkpoint.baseRevision === undefined || checkpoint.baseRevision === null || typeof checkpoint.baseRevision === 'string')
      && timelineIsValidForIntroductionHistory_ACU(checkpoint.timeline)
    ));
}

function operationContainsOrCannotDisproveSheet_ACU(operation: unknown, sheetKey: string): boolean {
  if (!isObjectRecord_ACU(operation)) return true;
  switch (operation.kind) {
    case 'data_replace':
      return !isObjectRecord_ACU(operation.data) || recordContainsSheet_ACU(operation.data, sheetKey);
    case 'sql_sheet_batch':
      return typeof operation.sheetKey !== 'string'
        || !isStringArray_ACU(operation.statements)
        || (operation.params !== undefined && (!Array.isArray(operation.params)
          || !operation.params.every(params => Array.isArray(params)
            && params.every(value => value === null || typeof value === 'string' || typeof value === 'number'))))
        || (operation.tableName !== undefined && typeof operation.tableName !== 'string')
        || (operation.reason !== undefined && !['manual_crud', 'import', 'system'].includes(operation.reason))
        || operation.sheetKey === sheetKey;
    case 'sheet_replace':
      return typeof operation.sheetKey !== 'string'
        || !sheetIsValidForIntroductionHistory_ACU(operation.sheet)
        || !['manual_crud', 'import', 'system'].includes(operation.reason)
        || operation.sheetKey === sheetKey;
    case 'sheet_schema_migrate':
      return !migrationIsValidForIntroductionHistory_ACU(operation) || operation.sheetKey === sheetKey;
    case 'row_upsert':
      return typeof operation.sheetKey !== 'string'
        || typeof operation.rowId !== 'string'
        || !Array.isArray(operation.cells) || !operation.cells.every(value => value === null || typeof value === 'string')
        || operation.sheetKey === sheetKey;
    case 'row_delete':
      return typeof operation.sheetKey !== 'string'
        || typeof operation.rowId !== 'string'
        || operation.sheetKey === sheetKey;
    case 'meta_update':
      return typeof operation.sheetKey !== 'string'
        || !isObjectRecord_ACU(operation.meta)
        || operation.sheetKey === sheetKey;
    // sql_batch and table_edit_dsl are global replay operations; all unknown
    // kinds are future or malformed persisted contracts and must fail closed.
    default:
      return true;
  }
}

function patchContainsOrCannotDisproveSheet_ACU(patch: unknown, sheetKey: string): boolean {
  if (!isObjectRecord_ACU(patch)) return true;
  switch (patch.kind) {
    case 'sheet_replace':
      return typeof patch.sheetKey !== 'string'
        || !sheetIsValidForIntroductionHistory_ACU(patch.sheet)
        || !['schema_change', 'unstable_row_id', 'raw_sql_export', 'import', 'fallback'].includes(patch.reason)
        || patch.sheetKey === sheetKey;
    case 'row_upsert':
      return typeof patch.sheetKey !== 'string'
        || typeof patch.rowId !== 'string'
        || !Array.isArray(patch.cells) || !patch.cells.every(value => value === null || typeof value === 'string')
        || patch.sheetKey === sheetKey;
    case 'row_delete':
      return typeof patch.sheetKey !== 'string'
        || typeof patch.rowId !== 'string'
        || patch.sheetKey === sheetKey;
    case 'meta_update':
      return typeof patch.sheetKey !== 'string'
        || !isObjectRecord_ACU(patch.meta)
        || patch.sheetKey === sheetKey;
    default:
      return true;
  }
}

/**
 * Introduction shards can only represent genuinely new tables. This scans the
 * persisted V2 history rather than trusting the final replay state, because a
 * later data_replace may have removed a table that existed earlier.
 */
function historyContainsOrCannotDisproveSheet_ACU(
  chat: any[],
  isolationKey: string,
  maxMessageIndex: number,
  sheetKey: string,
): boolean {
  for (let messageIndex = 0; messageIndex <= maxMessageIndex; messageIndex += 1) {
    const tagData = chat[messageIndex]?.TavernDB_ACU_IsolatedData?.[isolationKey];
    if (!hasV2HistoryMarker_ACU(tagData)) continue;

    const frame = tagData.storageFrame as unknown;
    if (!isObjectRecord_ACU(frame) || frame.version !== 2 || !Array.isArray(frame.logEntries)) return true;
    if (frame.checkpoint !== undefined && !checkpointIsValidForIntroductionHistory_ACU(frame.checkpoint)) return true;
    if (checkpointDataContainsSheet_ACU(frame.checkpoint, sheetKey)) return true;
    if (frame.perSheetCheckpoints !== undefined && !sheetCheckpointMapIsValidForIntroductionHistory_ACU(frame.perSheetCheckpoints)) return true;
    if (recordContainsSheet_ACU(frame.perSheetCheckpoints, sheetKey)) return true;

    for (const entry of frame.logEntries) {
      if (!logEntryIsValidForIntroductionHistory_ACU(entry)) return true;

      for (const operation of entry.operations) {
        if (operationContainsOrCannotDisproveSheet_ACU(operation, sheetKey)) return true;
      }

      if (entry.patches === undefined) continue;
      if (!Array.isArray(entry.patches)) return true;
      for (const patch of entry.patches) {
        if (patchContainsOrCannotDisproveSheet_ACU(patch, sheetKey)) return true;
      }
    }
  }
  return false;
}

function validateSheetCheckpointInput_ACU(
  options: PersistTableSheetCheckpointV2Options_ACU,
): { createdAt: number; reason: TableCheckpointV2_ACU['reason'] } | { error: string } {
  if (typeof options.sheetKey !== 'string' || !options.sheetKey.startsWith('sheet_')) {
    return { error: 'V2 sheet checkpoint requires a sheetKey beginning with "sheet_".' };
  }
  if (!isObjectRecord_ACU(options.sheetData)) {
    return { error: `V2 sheet checkpoint requires object sheetData for ${options.sheetKey}.` };
  }
  if (!options.reason) {
    return { error: 'V2 sheet checkpoint requires an explicit checkpoint reason.' };
  }
  const createdAt = options.createdAt ?? Date.now();
  if (!Number.isFinite(createdAt) || createdAt < 0) {
    return { error: 'V2 sheet checkpoint requires a finite non-negative createdAt.' };
  }
  return { createdAt, reason: options.reason };
}

async function persistTableMutationLogV2Core_ACU(
  options: PersistTableMutationV2Options_ACU,
): Promise<{ saved: boolean; messageIndex?: number; entry?: TableMutationLogEntryV2_ACU; error?: string }> {
  const chat = getChatArray_ACU();
  if (!chat || chat.length === 0) {
    return { saved: false, error: 'chat history is empty' };
  }

  const target = findTargetAiMessage_ACU(chat, options.targetMessageIndex);
  if (!target) {
    return { saved: false, error: 'no AI message found' };
  }

  options.transactionContext?.assertFresh?.('persistTableMutationLogV2:before_persist');
  if (!chat[target.index] || chat[target.index] !== target.message || target.message.is_user) {
    return { saved: false, error: 'target AI message changed before persist; abort stale table write.' };
  }

  const isolationKey = options.isolationKey ?? getCurrentIsolationKey_ACU();
  const afterData = deepClone_ACU(options.afterData);
  const normalization = normalizeCanonicalTableRows_ACU(afterData);
  if (normalization.errors.length > 0) {
    return { saved: false, error: `V2 operation log snapshot 行标识不合法：${formatCanonicalRowIssues_ACU(normalization.errors)}` };
  }
  const filledSheetKeys = normalizeKeys_ACU(options.filledSheetKeys, afterData);
  const candidateChangedSheetKeys = normalizeKeys_ACU(options.candidateChangedSheetKeys, afterData);
  const operations = normalizeOperations_ACU(options.operations, afterData, options.source);
  const effectiveChangedSheetKeys = candidateChangedSheetKeys;

  const isolatedData = cloneIsolatedData_ACU(target.message) as Record<string, any>;
  const frame = getOrInitV2Frame_ACU(isolatedData, isolationKey);
  const currentWriteSet = options.writeSet ?? options.transactionContext?.writeSet;
  const revisionWriteSet = options.revisionWriteSet;
  const requestedBaseRevision = options.baseRevision !== undefined
    ? options.baseRevision
    : options.transactionContext?.baseRevision;

  const hasExistingCheckpoint = hasAnyV2Checkpoint_ACU(chat, isolationKey);
  const hasExistingV2Frame = hasAnyV2Frame_ACU(chat, isolationKey);
  const hasMetadataOnlyFillEvent = filledSheetKeys.length > 0 || (Array.isArray(options.groupKeys) && options.groupKeys.length > 0);
  const hasManualRefillProgress = !!options.manualRefillProgress;
  if (operations.length === 0 && !hasMetadataOnlyFillEvent && !hasManualRefillProgress && options.source !== 'import' && hasExistingCheckpoint) {
    return { saved: false, error: `V2 operation log requires explicit operations for source=${options.source}; snapshot diff fallback is not allowed.` };
  }

  const initialCheckpointReason: TableCheckpointV2_ACU['reason'] = options.checkpointReason
    || (hasExistingV2Frame ? 'migration' : 'init');
  const shouldCheckpoint = !hasExistingCheckpoint
    && (initialCheckpointReason === 'init' || initialCheckpointReason === 'migration');

  if (options.forceCheckpoint && !shouldCheckpoint) {
    logWarn_ACU(`[V2 Persist] 单一保留边界 checkpoint 策略已忽略非初次 forceCheckpoint：reason=${options.checkpointReason || 'unspecified'}, source=${options.source}`);
  }

  if (options.manualRefillProgress) {
    frame.manualRefillProgress = deepClone_ACU(options.manualRefillProgress);
  }
  const now = Date.now();
  const aiFloor = countAiFloor_ACU(chat, target.index);
  let entry: TableMutationLogEntryV2_ACU | undefined;

  if (shouldCheckpoint) {
    const checkpointRevision = buildCommitRevision_ACU('checkpoint', generateEntryId_ACU());
    const checkpointEvent = {
      filledSheetKeys,
      changedSheetKeys: effectiveChangedSheetKeys,
      groupKeys: options.groupKeys || [],
      requestId: options.requestId,
      batchId: options.batchId,
      error: options.error,
    };
    frame.checkpoint = {
      kind: 'full',
      createdAt: now,
      reason: initialCheckpointReason,
      data: afterData,
      scheduleSummary: collectScheduleSummaryFromFramesV2_ACU(chat, isolationKey, { maxMessageIndex: target.index }),
      event: checkpointEvent,
    };
    frame.headRevision = checkpointRevision;
    frame.logEntries = [];
    logDebug_ACU(`[V2 Persist] 写入 full checkpoint: messageIndex=${target.index}, revision=${checkpointRevision}, sheets=${Object.keys(afterData).filter(k => k.startsWith('sheet_')).length}`);
  } else {
    const nextSeq = Math.max(0, ...frame.logEntries.map(item => Number(item.seq) || 0)) + 1;
    const entryId = generateEntryId_ACU();
    const parentRevision = options.parentRevision !== undefined ? options.parentRevision : (frame.headRevision ?? null);
    const commitRevision = buildCommitRevision_ACU(nextSeq, entryId);
    entry = {
      seq: nextSeq,
      entryId,
      createdAt: now,
      source: options.source,
      targetMessageIndex: target.index,
      aiFloor,
      filledSheetKeys,
      changedSheetKeys: effectiveChangedSheetKeys,
      groupKeys: options.groupKeys || [],
      requestId: options.requestId,
      batchId: options.batchId,
      error: options.error,
      operations,
      baseRevision: requestedBaseRevision ?? parentRevision,
      parentRevision,
      commitRevision,
      writeSet: currentWriteSet,
    };
    frame.logEntries.push(entry);
    frame.headRevision = commitRevision;
    logDebug_ACU(`[V2 Persist] 追加 operation log entry: messageIndex=${target.index}, seq=${entry.seq}, revision=${commitRevision}, operations=${operations.length}`);
  }

  target.message.TavernDB_ACU_IsolatedData = isolatedData;
  writeMessageIdentity_ACU(target.message, {
    enabled: settings_ACU.dataIsolationEnabled,
    code: settings_ACU.dataIsolationCode,
  });

  if (operations.length === 0 && filledSheetKeys.length === 0 && !shouldCheckpoint) {
    logWarn_ACU(`[V2 Persist] 无 operation 且无 filled 事件，仍保存空日志事件: messageIndex=${target.index}`);
  }

  if (options.strictSave) {
    await saveChatToHostStrict_ACU();
  } else {
    await saveChatToHost_ACU();
  }
  return { saved: true, messageIndex: target.index, entry };
}

export async function persistTableMutationLogV2_ACU(
  options: PersistTableMutationV2Options_ACU,
): Promise<{ saved: boolean; messageIndex?: number; entry?: TableMutationLogEntryV2_ACU; error?: string }> {
  if (!options.transactionContext) {
    return { saved: false, error: 'V2 operation log write requires TableWriteTransactionContext; direct unsafe writes are not allowed.' };
  }
  if (options.assumeCommitLock) {
    return persistTableMutationLogV2Core_ACU(options);
  }
  return options.transactionContext.runCommit(() => persistTableMutationLogV2Core_ACU(options), options.revisionWriteSet);
}

async function persistTableSheetCheckpointV2Core_ACU(
  options: PersistTableSheetCheckpointV2Options_ACU,
): Promise<{ saved: boolean; messageIndex?: number; checkpoint?: TableSheetCheckpointV2_ACU; error?: string }> {
  const validation = validateSheetCheckpointInput_ACU(options);
  if ('error' in validation) return { saved: false, error: validation.error };
  const normalizedSheetData = deepClone_ACU(options.sheetData);
  const normalization = normalizeCanonicalTableRows_ACU({ [options.sheetKey]: normalizedSheetData });
  if (normalization.errors.length > 0) {
    return { saved: false, error: `V2 sheet checkpoint 行标识不合法：${formatCanonicalRowIssues_ACU(normalization.errors)}` };
  }

  const chat = getChatArray_ACU();
  if (!chat || chat.length === 0) {
    return { saved: false, error: 'chat history is empty' };
  }
  const isolationKey = options.isolationKey ?? getCurrentIsolationKey_ACU();
  const latestFullCheckpoint = findLatestFullCheckpoint_ACU(chat, isolationKey);
  if (!latestFullCheckpoint) {
    return { saved: false, error: 'V2 sheet checkpoint requires an existing full checkpoint anchor.' };
  }

  const target = findTargetAiMessage_ACU(chat, options.targetMessageIndex);
  if (!target) {
    return { saved: false, error: 'no AI message found' };
  }
  if (target.index < latestFullCheckpoint.index) {
    return { saved: false, error: `V2 sheet checkpoint target precedes the latest full checkpoint and would never replay: targetMessageIndex=${target.index}, latestFullCheckpointIndex=${latestFullCheckpoint.index}.` };
  }

  options.transactionContext?.assertFresh?.('persistTableSheetCheckpointV2:before_persist');
  if (!chat[target.index] || chat[target.index] !== target.message || target.message.is_user) {
    return { saved: false, error: 'target AI message changed before persist; abort stale sheet checkpoint write.' };
  }

  const isolatedData = cloneIsolatedData_ACU(target.message) as Record<string, any>;
  const frame = getOrInitV2Frame_ACU(isolatedData, isolationKey);
  const conflictingEntry = (frame.logEntries || []).find(entry => logEntryConflictsWithSheetCheckpoint_ACU(entry, options.sheetKey));
  if (conflictingEntry) {
    return {
      saved: false,
      error: `V2 sheet checkpoint cannot be inserted before an existing target-sheet log entry: sheetKey=${options.sheetKey}, entryId=${conflictingEntry.entryId}.`,
    };
  }

  const existingCheckpoint = frame.perSheetCheckpoints?.[options.sheetKey];
  if (existingCheckpoint && Number(existingCheckpoint.createdAt) > validation.createdAt) {
    return {
      saved: false,
      error: `V2 sheet checkpoint cannot replace a newer checkpoint: sheetKey=${options.sheetKey}, existingCreatedAt=${existingCheckpoint.createdAt}, requestedCreatedAt=${validation.createdAt}.`,
    };
  }

  const scheduleSummary = collectScheduleSummaryFromFramesV2_ACU(chat, isolationKey, { maxMessageIndex: target.index })[options.sheetKey];
  const checkpoint: TableSheetCheckpointV2_ACU = {
    kind: 'sheet_full',
    createdAt: validation.createdAt,
    reason: validation.reason,
    sheetKey: options.sheetKey,
    data: normalizedSheetData,
    ...(scheduleSummary ? { scheduleSummary: deepClone_ACU(scheduleSummary) } : {}),
    ...(options.event ? { event: deepClone_ACU(options.event) } : {}),
    ...(options.manualRefillProgress ? { manualRefillProgress: deepClone_ACU(options.manualRefillProgress) } : {}),
    ...(options.baseRevision !== undefined || options.transactionContext?.baseRevision !== undefined
      ? { baseRevision: options.baseRevision !== undefined ? options.baseRevision : options.transactionContext?.baseRevision }
      : {}),
  };

  const hadIsolatedData = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_IsolatedData');
  const previousIsolatedData = target.message.TavernDB_ACU_IsolatedData;
  const hadIdentity = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_Identity');
  const previousIdentity = target.message.TavernDB_ACU_Identity;
  frame.perSheetCheckpoints = {
    ...(frame.perSheetCheckpoints || {}),
    [options.sheetKey]: checkpoint,
  };
  try {
    target.message.TavernDB_ACU_IsolatedData = isolatedData;
    writeMessageIdentity_ACU(target.message, {
      enabled: settings_ACU.dataIsolationEnabled,
      code: settings_ACU.dataIsolationCode,
    });
    await saveChatToHost_ACU();
  } catch (error) {
    if (hadIsolatedData) {
      target.message.TavernDB_ACU_IsolatedData = previousIsolatedData;
    } else {
      delete target.message.TavernDB_ACU_IsolatedData;
    }
    if (hadIdentity) {
      target.message.TavernDB_ACU_Identity = previousIdentity;
    } else {
      delete target.message.TavernDB_ACU_Identity;
    }
    throw error;
  }
  logDebug_ACU(`[V2 Persist] 写入单表 checkpoint: messageIndex=${target.index}, sheetKey=${options.sheetKey}, createdAt=${checkpoint.createdAt}`);
  return { saved: true, messageIndex: target.index, checkpoint };
}

/**
 * Persists normalized sheet snapshots after load-time removal of empty row_id rows.
 * This deliberately updates only per-sheet checkpoints: guide, scope, root checkpoint,
 * operation log and independent data outside the target frame remain untouched.
 */
export async function persistNullRowCleanupShards_ACU(
  options: PersistNullRowCleanupShardsOptions_ACU,
): Promise<PersistNullRowCleanupShardsResult_ACU> {
  const requestedEntries = Object.entries(options.sheetDataByKey || {})
    .filter(([sheetKey]) => sheetKey.startsWith('sheet_'));
  if (requestedEntries.length === 0) return { status: 'skipped_no_changes' };

  const sheetKeys = requestedEntries.map(([sheetKey]) => sheetKey);
  if (new Set(sheetKeys).size !== sheetKeys.length) {
    return { status: 'skipped_invalid_data', error: 'null-row cleanup contains duplicate sheetKey.' };
  }

  const createdAt = options.createdAt ?? Date.now();
  if (!Number.isFinite(createdAt) || createdAt < 0) {
    return { status: 'skipped_invalid_data', error: 'null-row cleanup requires a finite non-negative createdAt.' };
  }

  const isolationKey = options.isolationKey ?? getCurrentIsolationKey_ACU();
  try {
    return await runTableWriteTransaction_ACU({
      source: 'system_cleanup',
      reason: 'persistNullRowCleanupShards',
      isolationKey,
      writeSet: sheetKeys.map(sheetKey => ({ kind: 'schema' as const, sheetKey })),
      maintenanceMode: 'exclusive',
    }, async (transactionContext) => transactionContext.runCommit(async () => {
      const chat = getChatArray_ACU();
      const target = findTargetAiMessage_ACU(chat, undefined);
      if (!target) return { status: 'skipped_no_target' };

      const latestFullCheckpoint = findLatestFullCheckpoint_ACU(chat, isolationKey);
      if (!latestFullCheckpoint) return { status: 'skipped_no_anchor' };
      if (target.index < latestFullCheckpoint.index) {
        return { status: 'failed', error: `null-row cleanup target precedes full checkpoint: targetMessageIndex=${target.index}, latestFullCheckpointIndex=${latestFullCheckpoint.index}.` };
      }

      transactionContext.assertFresh?.('persistNullRowCleanupShards:before_commit');
      if (chat[target.index] !== target.message || target.message.is_user) {
        return { status: 'failed', error: 'target AI message changed before null-row cleanup persist.' };
      }

      const normalizedSheets = new Map<string, Sheet_ACU>();
      for (const [sheetKey, sourceSheet] of requestedEntries) {
        if (!isObjectRecord_ACU(sourceSheet)) {
          return { status: 'skipped_invalid_data', error: `null-row cleanup requires object sheetData: ${sheetKey}.` };
        }
        const sheetData = deepClone_ACU(sourceSheet);
        const normalization = normalizeCanonicalTableRows_ACU({ [sheetKey]: sheetData });
        if (normalization.errors.length > 0) {
          return { status: 'skipped_invalid_data', error: `null-row cleanup sheet 行标识不合法：${formatCanonicalRowIssues_ACU(normalization.errors)}` };
        }
        if (!Array.isArray(sheetData.content?.[0]) || sheetData.content[0][0] !== 'row_id') {
          return { status: 'skipped_invalid_data', error: `null-row cleanup sheet 缺少 row_id 表头：${sheetKey}.` };
        }
        normalizedSheets.set(sheetKey, sheetData);
      }

      const targetTagData = target.message?.TavernDB_ACU_IsolatedData?.[isolationKey];
      if (!isV2TagData_ACU(targetTagData)) {
        return { status: 'skipped_no_v2_target' };
      }

      const isolatedData = cloneIsolatedData_ACU(target.message) as Record<string, any>;
      const frame = isolatedData[isolationKey]?.storageFrame;
      if (!isV2TagData_ACU(isolatedData[isolationKey]) || !frame) {
        return { status: 'failed', error: 'target V2 frame changed while preparing null-row cleanup persist.' };
      }
      const scheduleSummaryBySheet = collectScheduleSummaryFromFramesV2_ACU(chat, isolationKey, { maxMessageIndex: target.index });
      const checkpoints: TableSheetCheckpointV2_ACU[] = [];
      for (const sheetKey of sheetKeys) {
        const conflictingEntry = (frame.logEntries || []).find((entry: TableMutationLogEntryV2_ACU) => logEntryConflictsWithSheetCheckpoint_ACU(entry, sheetKey));
        if (conflictingEntry) {
          return { status: 'failed', error: `null-row cleanup conflicts with target-sheet log entry: sheetKey=${sheetKey}, entryId=${conflictingEntry.entryId}.` };
        }
        const existingCheckpoint = frame.perSheetCheckpoints?.[sheetKey];
        if (existingCheckpoint && Number(existingCheckpoint.createdAt) > createdAt) {
          return { status: 'failed', error: `null-row cleanup cannot replace newer checkpoint: sheetKey=${sheetKey}, existingCreatedAt=${existingCheckpoint.createdAt}, requestedCreatedAt=${createdAt}.` };
        }
        const scheduleSummary = scheduleSummaryBySheet[sheetKey];
        checkpoints.push({
          kind: 'sheet_full',
          createdAt,
          reason: 'integrity_repair',
          sheetKey,
          data: normalizedSheets.get(sheetKey)!,
          ...(scheduleSummary ? { scheduleSummary: deepClone_ACU(scheduleSummary) } : {}),
          event: { filledSheetKeys: [], changedSheetKeys: [sheetKey] },
          baseRevision: transactionContext.baseRevision,
        });
      }

      const hadIsolatedData = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_IsolatedData');
      const previousIsolatedData = target.message.TavernDB_ACU_IsolatedData;
      const hadIdentity = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_Identity');
      const previousIdentity = target.message.TavernDB_ACU_Identity;
      try {
        frame.perSheetCheckpoints = {
          ...(frame.perSheetCheckpoints || {}),
          ...Object.fromEntries(checkpoints.map(checkpoint => [checkpoint.sheetKey, checkpoint])),
        };
        target.message.TavernDB_ACU_IsolatedData = isolatedData;
        writeMessageIdentity_ACU(target.message, {
          enabled: settings_ACU.dataIsolationEnabled,
          code: settings_ACU.dataIsolationCode,
        });
        await saveChatToHostStrict_ACU();
        logDebug_ACU(`[V2 Persist] 空 row_id 自愈 shard 已保存: messageIndex=${target.index}, checkpoints=${checkpoints.length}, isolationKey=${isolationKey}`);
        return { status: 'persisted', messageIndex: target.index, checkpoints };
      } catch (error: any) {
        if (hadIsolatedData) target.message.TavernDB_ACU_IsolatedData = previousIsolatedData;
        else delete target.message.TavernDB_ACU_IsolatedData;
        if (hadIdentity) target.message.TavernDB_ACU_Identity = previousIdentity;
        else delete target.message.TavernDB_ACU_Identity;
        try {
          await saveChatToHostStrict_ACU();
        } catch (rollbackError: any) {
          return { status: 'failed', error: `${error?.message || String(error)}；回滚保存也失败：${rollbackError?.message || String(rollbackError)}` };
        }
        return { status: 'failed', error: error?.message || String(error) };
      }
    }, result => result.status === 'persisted'
      ? sheetKeys.map(sheetKey => ({ kind: 'schema' as const, sheetKey }))
      : []));
  } catch (error: any) {
    return { status: 'failed', error: error?.message || String(error) };
  }
}

/**
 * 在当前最新 AI 楼层原子写入模板结构变更。
 *
 * 单表 checkpoint API 自带宿主保存，不能用于这里；本函数先完成所有内存写入，
 * 再严格保存一次，失败时恢复 storage frame、guide 与 template scope。
 */
export async function commitCurrentFloorTemplateChanges_ACU(
  options: CommitCurrentFloorTemplateChangesOptions_ACU,
): Promise<CommitCurrentFloorTemplateChangesResult_ACU> {
  const requestedCheckpoints = Array.isArray(options.sheetCheckpoints) ? options.sheetCheckpoints : [];
  if (requestedCheckpoints.length === 0) {
    return { saved: false, error: '当前楼层模板提交必须至少包含一个单表 checkpoint。' };
  }
  if (!options.guideData || typeof options.guideData !== 'object' || Array.isArray(options.guideData)) {
    return { saved: false, error: '当前楼层模板提交必须提供有效的 guideData。' };
  }

  const sheetKeys = requestedCheckpoints.map(item => String(item?.sheetKey || ''));
  if (sheetKeys.some(sheetKey => !sheetKey.startsWith('sheet_'))) {
    return { saved: false, error: '当前楼层模板提交包含非法 sheetKey。' };
  }
  if (new Set(sheetKeys).size !== sheetKeys.length) {
    return { saved: false, error: '当前楼层模板提交不能包含重复 sheetKey。' };
  }

  const createdAt = options.createdAt ?? Date.now();
  if (!Number.isFinite(createdAt) || createdAt < 0) {
    return { saved: false, error: '当前楼层模板提交 requires a finite non-negative createdAt.' };
  }

  const isolationKey = options.isolationKey ?? getCurrentIsolationKey_ACU();
  const writeSet = sheetKeys.map(sheetKey => ({ kind: 'schema' as const, sheetKey }));
  try {
    return await runTableWriteTransaction_ACU({
    source: 'template_assistant',
    reason: options.reason || 'commitCurrentFloorTemplateChanges',
    isolationKey,
    writeSet,
    maintenanceMode: 'exclusive',
    baseRevision: options.baseRevision,
  }, async (transactionContext) => transactionContext.runCommit(async () => {
    const chat = getChatArray_ACU();
    if (!Array.isArray(chat) || chat.length === 0) {
      throw new Error('chat history is empty');
    }

    const latestAiTarget = findTargetAiMessage_ACU(chat, undefined);
    const target = findTargetAiMessage_ACU(chat, options.targetMessageIndex);
    if (!latestAiTarget || !target) {
      throw new Error('当前聊天不存在可提交的 AI 楼层。');
    }
    if (target.index !== latestAiTarget.index) {
      throw new Error(`当前楼层模板提交只能写入最新 AI 楼层：requested=${target.index}, latest=${latestAiTarget.index}。`);
    }

    const latestFullCheckpoint = findLatestFullCheckpoint_ACU(chat, isolationKey);
    if (!latestFullCheckpoint) {
      throw new Error('V2 当前楼层模板提交 requires an existing full checkpoint anchor.');
    }
    if (target.index < latestFullCheckpoint.index) {
      throw new Error(`V2 当前楼层模板提交目标早于最近 full checkpoint：targetMessageIndex=${target.index}, latestFullCheckpointIndex=${latestFullCheckpoint.index}。`);
    }

    transactionContext.assertFresh?.('commitCurrentFloorTemplateChanges:before_commit');
    if (chat[target.index] !== target.message || target.message.is_user) {
      throw new Error('target AI message changed before template commit; abort stale table write.');
    }
    const targetTagData = target.message?.TavernDB_ACU_IsolatedData?.[isolationKey];
    if (!isV2TagData_ACU(targetTagData)) {
      throw new Error('当前楼层模板提交要求目标 AI 楼层已存在合法 V2 storage frame；请先完成既有迁移。');
    }

    const normalizedSheets = new Map<string, Sheet_ACU>();
    let removedNullRowCount = 0;
    for (const item of requestedCheckpoints) {
      if (!isObjectRecord_ACU(item?.sheetData)) {
        throw new Error(`当前楼层模板提交缺少可恢复 Sheet：${item.sheetKey}。`);
      }
      const sheetData = deepClone_ACU(item.sheetData);
      if (item.isNewSheet === true && sheetData.content?.length !== 1) {
        throw new Error(`V2 sheet introduction only accepts a header-only sheet: sheetKey=${item.sheetKey}.`);
      }
      const normalization = normalizeCanonicalTableRows_ACU({ [item.sheetKey]: sheetData });
      removedNullRowCount += normalization.removedRows.length;
      if (normalization.errors.length > 0) {
        throw new Error(`V2 当前楼层模板提交行标识不合法：${formatCanonicalRowIssues_ACU(normalization.errors)}`);
      }
      const headers = sheetData.content?.[0];
      if (!Array.isArray(headers) || headers[0] !== 'row_id') {
        throw new Error(`V2 当前楼层模板提交缺少 row_id 表头：${item.sheetKey}。`);
      }
      if (!sheetData.sourceData || typeof sheetData.sourceData !== 'object') sheetData.sourceData = {} as any;
      if (!String(sheetData.sourceData.ddl || '').trim()) {
        sheetData.sourceData.ddl = generateDDL(sheetData, sheetData.uid || item.sheetKey);
      }
      const ddlValidation = validateDDLTextAgainstHeaders_ACU(sheetData.sourceData.ddl, headers);
      if (!ddlValidation.valid) {
        throw new Error(`V2 当前楼层模板提交 DDL 无法 strict hydrate：${item.sheetKey}：${ddlValidation.message}`);
      }
      createSheetInsertPlan(sheetData);
      normalizedSheets.set(item.sheetKey, sheetData);
    }

    const isolatedData = cloneIsolatedData_ACU(target.message) as Record<string, any>;
    const frame = isolatedData[isolationKey]?.storageFrame;
    if (!isV2TagData_ACU(isolatedData[isolationKey]) || !frame) {
      throw new Error('目标 V2 storage frame 在模板提交准备期间发生变化。');
    }
    const activeReplayState = await loadTableStateFromFramesV2_ACU(chat, isolationKey, { maxMessageIndex: target.index, updateRuntimeState: false });
    if (!activeReplayState) {
      throw new Error('V2 当前楼层模板提交无法解析 active full checkpoint replay state。');
    }
    const checkpoints: TableSheetCheckpointV2_ACU[] = [];
    const scheduleSummaryBySheet = collectScheduleSummaryFromFramesV2_ACU(chat, isolationKey, { maxMessageIndex: target.index });
    const targetFrameLastLogSeq = getValidatedFrameLastLogSeq_ACU(frame);
    for (const item of requestedCheckpoints) {
      const isIntroducedSheet = item.isNewSheet === true;
      if (isIntroducedSheet && (
        historyContainsOrCannotDisproveSheet_ACU(chat, isolationKey, target.index, item.sheetKey)
        || Object.prototype.hasOwnProperty.call(activeReplayState, item.sheetKey)
        || Object.prototype.hasOwnProperty.call(frame.perSheetCheckpoints || {}, item.sheetKey)
      )) {
        throw new Error(`V2 sheet introduction requires a genuinely new sheet: sheetKey=${item.sheetKey} already exists in the active checkpoint state.`);
      }
      const conflictingEntry = isIntroducedSheet
        ? undefined
        : (frame.logEntries || []).find((entry: TableMutationLogEntryV2_ACU) => logEntryConflictsWithSheetCheckpoint_ACU(entry, item.sheetKey));
      if (conflictingEntry) {
        throw new Error(`V2 sheet checkpoint cannot be inserted before an existing target-sheet log entry: sheetKey=${item.sheetKey}, entryId=${conflictingEntry.entryId}.`);
      }
      const existingCheckpoint = frame.perSheetCheckpoints?.[item.sheetKey];
      if (existingCheckpoint && Number(existingCheckpoint.createdAt) > createdAt) {
        throw new Error(`V2 sheet checkpoint cannot replace a newer checkpoint: sheetKey=${item.sheetKey}, existingCreatedAt=${existingCheckpoint.createdAt}, requestedCreatedAt=${createdAt}.`);
      }
      const scheduleSummary = scheduleSummaryBySheet[item.sheetKey];
      checkpoints.push({
        kind: 'sheet_full',
        createdAt,
        reason: 'schema_change',
        sheetKey: item.sheetKey,
        data: normalizedSheets.get(item.sheetKey)!,
        ...(scheduleSummary ? { scheduleSummary: deepClone_ACU(scheduleSummary) } : {}),
        event: deepClone_ACU(item.event || { filledSheetKeys: [], changedSheetKeys: [item.sheetKey] }),
        ...(isIntroducedSheet ? {
          timeline: {
            kind: 'sheet_introduction' as const,
            activateAtMessageIndex: target.index,
            afterSeq: targetFrameLastLogSeq,
          },
        } : {}),
        baseRevision: options.baseRevision !== undefined ? options.baseRevision : transactionContext.baseRevision,
      });
    }

    const hadIsolatedData = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_IsolatedData');
    const previousIsolatedData = target.message.TavernDB_ACU_IsolatedData;
    const hadIdentity = Object.prototype.hasOwnProperty.call(target.message, 'TavernDB_ACU_Identity');
    const previousIdentity = target.message.TavernDB_ACU_Identity;
    const previousScopeContainer = cloneOptionalJson_ACU(getChatScopedConfigContainer_ACU(chat));
    const previousGuideContainer = cloneOptionalJson_ACU(getChatSheetGuideContainer_ACU(chat));

    try {
      frame.perSheetCheckpoints = {
        ...(frame.perSheetCheckpoints || {}),
        ...Object.fromEntries(checkpoints.map(checkpoint => [checkpoint.sheetKey, checkpoint])),
      };
      target.message.TavernDB_ACU_IsolatedData = isolatedData;
      writeMessageIdentity_ACU(target.message, {
        enabled: settings_ACU.dataIsolationEnabled,
        code: settings_ACU.dataIsolationCode,
      });
      const guideUpdated = setChatSheetGuideDataForIsolationKey_ACU(isolationKey, options.guideData, {
        reason: options.reason || 'visualizer_v2_schema_change',
        syncTemplateScope: options.syncTemplateScope === true,
        templateSource: options.templateSource,
        presetName: options.presetName,
        source: options.source,
        updatedAt: createdAt,
      });
      if (!guideUpdated) throw new Error('当前楼层模板提交无法写入 guideData。');
      await saveChatToHostStrict_ACU();
      logDebug_ACU(`[V2 Persist] 当前楼层模板提交完成: messageIndex=${target.index}, checkpoints=${checkpoints.length}, isolationKey=${isolationKey}`);
      return { saved: true, messageIndex: target.index, checkpoints, removedNullRowCount };
    } catch (error: any) {
      if (hadIsolatedData) target.message.TavernDB_ACU_IsolatedData = previousIsolatedData;
      else delete target.message.TavernDB_ACU_IsolatedData;
      if (hadIdentity) target.message.TavernDB_ACU_Identity = previousIdentity;
      else delete target.message.TavernDB_ACU_Identity;
      setChatScopedConfigContainer_ACU(chat, previousScopeContainer);
      setChatSheetGuideContainer_ACU(chat, previousGuideContainer);
      try {
        await saveChatToHostStrict_ACU();
      } catch (rollbackError: any) {
        throw new Error(`${error?.message || String(error)}；回滚保存也失败：${rollbackError?.message || String(rollbackError)}`);
      }
      throw error;
    }
  }, writeSet));
  } catch (error: any) {
    return { saved: false, error: error?.message || String(error) };
  }
}

export async function persistTableSheetCheckpointV2_ACU(
  options: PersistTableSheetCheckpointV2Options_ACU,
): Promise<{ saved: boolean; messageIndex?: number; checkpoint?: TableSheetCheckpointV2_ACU; error?: string }> {
  if (!options.transactionContext) {
    return { saved: false, error: 'V2 sheet checkpoint write requires TableWriteTransactionContext; direct unsafe writes are not allowed.' };
  }
  if (options.assumeCommitLock) return persistTableSheetCheckpointV2Core_ACU(options);
  return options.transactionContext.runCommit(() => persistTableSheetCheckpointV2Core_ACU(options), []);
}
