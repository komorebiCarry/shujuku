import type { AgentWorldbookControlSnapshot_ACU } from '../../shared/models/agent-worldbook-model';
import { getLorebookEntries_ACU, setLorebookEntries_ACU } from '../../data/gateways/worldbook-gateway';
import { hashUserInput_ACU, logWarn_ACU } from '../../shared/utils';
import { buildAgentWorldbookSnapshotSelectionSignature_ACU } from '../../shared/agent-worldbook-snapshot';

const TAKEOVER_META_PATTERN_ACU = /\n?<!--\s*ACU_AGENT_WORLDBOOK_TAKEOVER_META_START\s*\n[\s\S]*?\nACU_AGENT_WORLDBOOK_TAKEOVER_META_END\s*-->\n?/g;
const SKILL_META_PATTERN_ACU = /\n?<!--\s*ACU_SKILL_META_START\s*\n[\s\S]*?\nACU_SKILL_META_END\s*-->\n?/g;

export interface AgentWorldbookSnapshotRestoreResult_ACU {
  restored: number;
  skipped: number;
  failed: number;
  signatureMatched: boolean;
}

export function buildAgentWorldbookSelectionSignature_ACU(bookNames: string[]): string {
  return buildAgentWorldbookSnapshotSelectionSignature_ACU(bookNames);
}

function hasValidUid_ACU(value: unknown): value is string | number {
  return value !== null && value !== undefined && String(value).trim() !== '';
}

function stripTakeoverMeta_ACU(comment: unknown): string {
  return String(comment || '').replace(TAKEOVER_META_PATTERN_ACU, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function comparableComment_ACU(comment: unknown): string {
  return stripTakeoverMeta_ACU(comment).replace(SKILL_META_PATTERN_ACU, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isCommentHashMatched_ACU(snapshotHash: string | undefined, currentComment: unknown): boolean {
  if (!snapshotHash) return true;
  const stripped = stripTakeoverMeta_ACU(currentComment);
  return hashUserInput_ACU(comparableComment_ACU(currentComment)) === snapshotHash
    || hashUserInput_ACU(stripped) === snapshotHash;
}

export async function restoreAgentWorldbookSnapshotEntries_ACU(
  snapshot: AgentWorldbookControlSnapshot_ACU,
  expectedBookNames: string[],
): Promise<AgentWorldbookSnapshotRestoreResult_ACU> {
  const expectedSignature = buildAgentWorldbookSelectionSignature_ACU(expectedBookNames);
  if (snapshot.active !== true || snapshot.selectionSignature !== expectedSignature) {
    return { restored: 0, skipped: 0, failed: 0, signatureMatched: false };
  }

  let restored = 0;
  let skipped = 0;
  let failed = 0;
  for (const [rawBookName, rawSnapshotEntries] of Object.entries(snapshot.books || {})) {
    const bookName = String(rawBookName || '').trim();
    const snapshotEntries = Array.isArray(rawSnapshotEntries) ? rawSnapshotEntries : [];
    if (!bookName || snapshotEntries.length === 0) continue;
    try {
      const entries = await getLorebookEntries_ACU(bookName);
      const currentByUid = new Map((entries || []).map(entry => [String(entry?.uid), entry]));
      const patches: Record<string, any>[] = [];
      let restoredInBook = 0;
      for (const snapshotEntry of snapshotEntries) {
        if (!hasValidUid_ACU(snapshotEntry?.uid)) {
          skipped += 1;
          continue;
        }
        const current = currentByUid.get(String(snapshotEntry.uid));
        if (!current || !isCommentHashMatched_ACU(snapshotEntry.commentHash, current.comment)) {
          if (current) {
            const strippedComment = stripTakeoverMeta_ACU(current.comment);
            if (strippedComment !== String(current.comment || '')) patches.push({ uid: snapshotEntry.uid, comment: strippedComment });
          }
          skipped += 1;
          continue;
        }
        patches.push({
          uid: snapshotEntry.uid,
          comment: stripTakeoverMeta_ACU(current.comment),
          enabled: snapshotEntry.previousEnabled !== false,
          keys: Array.isArray(snapshotEntry.previousKeys) ? snapshotEntry.previousKeys : [],
          type: snapshotEntry.previousType,
        });
        restoredInBook += 1;
      }
      if (patches.length > 0) await setLorebookEntries_ACU(bookName, patches);
      restored += restoredInBook;
    } catch (error) {
      logWarn_ACU(`[Agent世界书] 恢复世界书条目失败：${bookName}`, error);
      failed += snapshotEntries.length;
    }
  }
  return { restored, skipped, failed, signatureMatched: true };
}
