import type {
  AgentWorldbookControlSnapshot_ACU,
  AgentWorldbookControlSnapshotEntry_ACU,
} from '../../data/models/settings-model';
import {
  deleteLorebookEntries_ACU,
  getLorebookEntries_ACU,
  setLorebookEntries_ACU,
} from '../../data/gateways/worldbook-gateway';
import { persistTavernSettings_ACU } from '../../data/storage/tavern-storage';
import { hashUserInput_ACU } from '../../shared/utils';
import { settings_ACU } from '../runtime/state-manager';
import {
  getWorldbookEntryKeywordsForSkillify_ACU,
  isWorldbookEntrySkillifyCandidate_ACU,
  resolvePlotWorldbookSkillifyBookNames_ACU,
} from './agent-skillify-service';

export interface AgentWorldbookTakeoverEntryUpdate_ACU {
  bookName: string;
  uid: string | number;
}

export interface AgentWorldbookFinalGreenlightRef_ACU {
  bookName: string;
  uid: string | number;
  reason?: string;
}

export interface AgentWorldbookTakeoverResult_ACU {
  updated: boolean;
  reason?: string;
  bookNames: string[];
  selectionSignature: string;
  totalCandidates: number;
  disabled: number;
  failed: number;
  snapshot: AgentWorldbookControlSnapshot_ACU;
  updates: AgentWorldbookTakeoverEntryUpdate_ACU[];
}

export interface AgentWorldbookRestoreResult_ACU {
  updated: boolean;
  reason?: string;
  bookNames: string[];
  selectionSignature: string;
  restored: number;
  skipped: number;
  failed: number;
  updates: AgentWorldbookTakeoverEntryUpdate_ACU[];
}


export const AGENT_WORLDBOOK_SNAPSHOT_COMMENT_ACU = 'TavernDB-ACU-AgentWorldbookSnapshot';
export const AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU = 'TavernDB-ACU-AgentFinalGenerationGreenlights';


function normalizeBookNamesForTakeover_ACU(bookNames: unknown): string[] {
  if (!Array.isArray(bookNames)) return [];
  return [...new Set(bookNames.map(name => String(name || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function hasValidWorldbookUid_ACU(uid: unknown): uid is string | number {
  return uid !== null && uid !== undefined && String(uid).trim() !== '';
}

async function deleteInternalEntryByComment_ACU(bookName: string, comment: string): Promise<boolean> {
  const entries = await getLorebookEntries_ACU(bookName);
  const matched = (entries || []).filter(entry => String(entry?.comment || '').trim() === comment && hasValidWorldbookUid_ACU(entry?.uid));
  if (matched.length === 0) return false;
  await deleteLorebookEntries_ACU(bookName, matched.map(entry => entry.uid));
  return true;
}

async function deleteInternalEntriesByComment_ACU(bookNames: string[], comment: string): Promise<number> {
  let deleted = 0;
  for (const bookName of normalizeBookNamesForTakeover_ACU(bookNames)) {
    if (await deleteInternalEntryByComment_ACU(bookName, comment)) deleted += 1;
  }
  return deleted;
}

function normalizeAgentWorldbookRefs_ACU(greenlights: unknown): AgentWorldbookFinalGreenlightRef_ACU[] {
  if (!Array.isArray(greenlights)) return [];
  const normalized: AgentWorldbookFinalGreenlightRef_ACU[] = [];
  const seen = new Set<string>();

  for (const ref of greenlights) {
    if (!ref || typeof ref !== 'object') continue;
    const bookName = String((ref as any).bookName || '').trim();
    const uid = (ref as any).uid;
    if (!bookName || !hasValidWorldbookUid_ACU(uid)) continue;
    const key = `${bookName}\u0000${String(uid).trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const reason = String((ref as any).reason || '').trim();
    normalized.push(reason ? { bookName, uid, reason } : { bookName, uid });
  }

  return normalized;
}

function buildSnapshotUidSetByBook_ACU(snapshot: AgentWorldbookControlSnapshot_ACU): Map<string, Set<string>> {
  const uidSetByBook = new Map<string, Set<string>>();
  if (snapshot.active !== true) return uidSetByBook;

  for (const [bookName, entries] of Object.entries(snapshot.books || {})) {
    const normalizedBookName = String(bookName || '').trim();
    if (!normalizedBookName || !Array.isArray(entries)) continue;
    const uidSet = new Set<string>();
    for (const entry of entries) {
      if (!hasValidWorldbookUid_ACU(entry?.uid)) continue;
      uidSet.add(String(entry.uid));
    }
    if (uidSet.size > 0) uidSetByBook.set(normalizedBookName, uidSet);
  }

  return uidSetByBook;
}

function buildAllowedFinalGreenlightKeySet_ACU(greenlights: AgentWorldbookFinalGreenlightRef_ACU[], snapshotUidSetByBook: Map<string, Set<string>>): Set<string> {
  const allowed = new Set<string>();
  for (const ref of greenlights) {
    const bookName = String(ref.bookName || '').trim();
    const uid = String(ref.uid).trim();
    if (!snapshotUidSetByBook.get(bookName)?.has(uid)) continue;
    allowed.add(`${bookName}\u0000${uid}`);
  }
  return allowed;
}

function isFinalGenerationBlueLightEntry_ACU(entry: Record<string, any>): boolean {
  return entry?.enabled !== false
    && String(entry?.type || '').trim().toLowerCase() === 'constant'
    && Array.isArray(entry?.keys)
    && entry.keys.length === 0;
}

function buildFinalGreenlightKey_ACU(bookName: string, uid: unknown): string {
  return `${String(bookName || '').trim()}\u0000${String(uid ?? '').trim()}`;
}

async function patchSnapshotEntries_ACU(snapshotUidSetByBook: Map<string, Set<string>>, buildPatch: (bookName: string, entry: Record<string, any>) => Record<string, any> | null): Promise<number> {
  let patched = 0;
  for (const [bookName, uidSet] of snapshotUidSetByBook.entries()) {
    const entries = await getLorebookEntries_ACU(bookName);
    const patches = (entries || [])
      .filter(entry => uidSet.has(String(entry?.uid)))
      .map(entry => buildPatch(bookName, entry))
      .filter(Boolean) as Record<string, any>[];
    if (patches.length === 0) continue;
    await setLorebookEntries_ACU(bookName, patches);
    patched += patches.length;
  }
  return patched;
}

export function buildWorldbookSelectionSignature_ACU(bookNames: string[]): string {
  const normalized = normalizeBookNamesForTakeover_ACU(bookNames);
  return hashUserInput_ACU(JSON.stringify({ scope: 'agent-worldbook-takeover', books: normalized }));
}

function buildActiveSnapshot_ACU(selectionSignature: string, books: Record<string, AgentWorldbookControlSnapshotEntry_ACU[]>): AgentWorldbookControlSnapshot_ACU {
  return { active: true, selectionSignature, createdAt: Date.now(), books };
}

function buildInactiveSnapshot_ACU(selectionSignature = ''): AgentWorldbookControlSnapshot_ACU {
  return { active: false, selectionSignature, createdAt: 0, books: {} };
}

function ensurePlotSettingsContainer_ACU(): Record<string, any> {
  if (!settings_ACU.plotSettings || typeof settings_ACU.plotSettings !== 'object') {
    settings_ACU.plotSettings = {};
  }
  return settings_ACU.plotSettings as Record<string, any>;
}

export function getPlotAgentWorldbookSnapshot_ACU(): AgentWorldbookControlSnapshot_ACU {
  const snapshot = (settings_ACU.plotSettings as any)?.agentWorldbookControlSnapshot;
  if (!snapshot || typeof snapshot !== 'object') return buildInactiveSnapshot_ACU();
  return {
    active: snapshot.active === true,
    selectionSignature: String(snapshot.selectionSignature || ''),
    createdAt: Number(snapshot.createdAt || 0),
    books: snapshot.books && typeof snapshot.books === 'object' ? snapshot.books : {},
  };
}

export function setPlotAgentWorldbookSnapshot_ACU(snapshot: AgentWorldbookControlSnapshot_ACU): void {
  const plotSettings = ensurePlotSettingsContainer_ACU();
  plotSettings.agentWorldbookControlSnapshot = snapshot;
  persistTavernSettings_ACU();
}

export async function refreshPlotAgentWorldbookSnapshotFromWorldbooks_ACU(): Promise<AgentWorldbookControlSnapshot_ACU> {
  const resolvedBookNames = await resolveTakeoverBookNames_ACU();
  const selectionSignature = buildWorldbookSelectionSignature_ACU(resolvedBookNames);
  const currentSnapshot = getPlotAgentWorldbookSnapshot_ACU();
  if (currentSnapshot.active === true && currentSnapshot.selectionSignature === selectionSignature) {
    return currentSnapshot;
  }
  const snapshot = buildInactiveSnapshot_ACU(selectionSignature);
  if (currentSnapshot.active !== false || currentSnapshot.selectionSignature !== selectionSignature) {
    setPlotAgentWorldbookSnapshot_ACU(snapshot);
  }
  return snapshot;
}

export function isWorldbookTakeoverActive_ACU(): boolean {
  return getPlotAgentWorldbookSnapshot_ACU().active === true;
}

async function resolveTakeoverBookNames_ACU(): Promise<string[]> {
  return normalizeBookNamesForTakeover_ACU(await resolvePlotWorldbookSkillifyBookNames_ACU());
}

function buildSnapshotEntry_ACU(entry: Record<string, any>): AgentWorldbookControlSnapshotEntry_ACU | null {
  if (!hasValidWorldbookUid_ACU(entry?.uid)) return null;
  const previousType = entry?.type === undefined || entry?.type === null ? undefined : String(entry.type);
  const comment = typeof entry?.comment === 'string' ? entry.comment : '';
  return {
    uid: entry.uid,
    previousEnabled: entry.enabled !== false,
    previousKeys: getWorldbookEntryKeywordsForSkillify_ACU(entry),
    previousType,
    commentHash: hashUserInput_ACU(comment),
  };
}

async function collectTakeoverCandidates_ACU(bookNames: string[]): Promise<{
  snapshotBooks: Record<string, AgentWorldbookControlSnapshotEntry_ACU[]>;
  updates: AgentWorldbookTakeoverEntryUpdate_ACU[];
}> {
  const snapshotBooks: Record<string, AgentWorldbookControlSnapshotEntry_ACU[]> = {};
  const updates: AgentWorldbookTakeoverEntryUpdate_ACU[] = [];

  for (const bookName of bookNames) {
    const entries = await getLorebookEntries_ACU(bookName);
    const bookSnapshot: AgentWorldbookControlSnapshotEntry_ACU[] = [];
    for (const entry of entries || []) {
      if (!isWorldbookEntrySkillifyCandidate_ACU(entry)) continue;
      const snapshotEntry = buildSnapshotEntry_ACU(entry);
      if (!snapshotEntry) continue;
      bookSnapshot.push(snapshotEntry);
      updates.push({ bookName, uid: snapshotEntry.uid });
    }
    if (bookSnapshot.length > 0) snapshotBooks[bookName] = bookSnapshot;
  }

  return { snapshotBooks, updates };
}

async function disableTakeoverCandidates_ACU(updates: AgentWorldbookTakeoverEntryUpdate_ACU[]): Promise<{ disabled: number; failed: number }> {
  const updatesByBook = new Map<string, Set<string>>();
  for (const update of updates) {
    if (!hasValidWorldbookUid_ACU(update.uid)) continue;
    const bookName = String(update.bookName || '').trim();
    if (!bookName) continue;
    if (!updatesByBook.has(bookName)) updatesByBook.set(bookName, new Set());
    updatesByBook.get(bookName)!.add(String(update.uid));
  }

  let disabled = 0;
  let failed = 0;
  for (const [bookName, uidSet] of updatesByBook.entries()) {
    try {
      const entries = await getLorebookEntries_ACU(bookName);
      const patchEntries = (entries || [])
        .filter(entry => uidSet.has(String(entry?.uid)) && entry?.enabled !== false)
        .map(entry => ({ uid: entry.uid, enabled: false }));
      if (patchEntries.length === 0) continue;
      await setLorebookEntries_ACU(bookName, patchEntries);
      disabled += patchEntries.length;
    } catch (error) {
      failed += uidSet.size;
    }
  }
  return { disabled, failed };
}

async function restoreSnapshotEntries_ACU(snapshot: AgentWorldbookControlSnapshot_ACU): Promise<{ restored: number; skipped: number; failed: number }> {
  let restored = 0;
  let skipped = 0;
  let failed = 0;

  for (const [bookName, snapshotEntries] of Object.entries(snapshot.books || {})) {
    const normalizedBookName = String(bookName || '').trim();
    const entriesToRestore = Array.isArray(snapshotEntries) ? snapshotEntries : [];
    if (!normalizedBookName || entriesToRestore.length === 0) continue;
    try {
      const currentEntries = await getLorebookEntries_ACU(normalizedBookName);
      const currentByUid = new Map((currentEntries || []).map(entry => [String(entry?.uid), entry]));
      const patches: any[] = [];
      for (const snapshotEntry of entriesToRestore) {
        if (!hasValidWorldbookUid_ACU(snapshotEntry?.uid)) {
          skipped += 1;
          continue;
        }
        const currentEntry = currentByUid.get(String(snapshotEntry.uid));
        if (!currentEntry) {
          skipped += 1;
          continue;
        }
        const currentComment = typeof currentEntry.comment === 'string' ? currentEntry.comment : '';
        if (snapshotEntry.commentHash && hashUserInput_ACU(currentComment) !== snapshotEntry.commentHash) {
          skipped += 1;
          continue;
        }
        patches.push({
          uid: snapshotEntry.uid,
          enabled: snapshotEntry.previousEnabled !== false,
          keys: Array.isArray(snapshotEntry.previousKeys) ? snapshotEntry.previousKeys : [],
          type: snapshotEntry.previousType,
        });
      }
      if (patches.length > 0) {
        await setLorebookEntries_ACU(normalizedBookName, patches);
        restored += patches.length;
      }
    } catch (error) {
      failed += entriesToRestore.length;
    }
  }

  return { restored, skipped, failed };
}

export async function writeFinalGenerationGreenlights_ACU(greenlights: unknown): Promise<boolean> {
  const snapshot = getPlotAgentWorldbookSnapshot_ACU();
  const snapshotUidSetByBook = buildSnapshotUidSetByBook_ACU(snapshot);
  if (snapshotUidSetByBook.size === 0) return false;

  const normalizedGreenlights = normalizeAgentWorldbookRefs_ACU(greenlights);
  const allowedKeySet = buildAllowedFinalGreenlightKeySet_ACU(normalizedGreenlights, snapshotUidSetByBook);

  const patched = await patchSnapshotEntries_ACU(snapshotUidSetByBook, (bookName, entry) => {
    if (!hasValidWorldbookUid_ACU(entry?.uid)) return null;
    const isAllowed = allowedKeySet.has(buildFinalGreenlightKey_ACU(bookName, entry.uid));
    if (isAllowed) {
      if (entry.enabled !== false && String(entry.type || '').toLowerCase() === 'constant' && Array.isArray(entry.keys) && entry.keys.length === 0) {
        return null;
      }
      return { uid: entry.uid, enabled: true, type: 'constant', keys: [] };
    }
    if (entry.enabled === false) return null;
    return { uid: entry.uid, enabled: false };
  });

  return patched > 0;
}

export async function readFinalGenerationGreenlights_ACU(): Promise<AgentWorldbookFinalGreenlightRef_ACU[]> {
  const snapshot = getPlotAgentWorldbookSnapshot_ACU();
  const snapshotUidSetByBook = buildSnapshotUidSetByBook_ACU(snapshot);
  const greenlights: AgentWorldbookFinalGreenlightRef_ACU[] = [];
  const seen = new Set<string>();

  for (const [bookName, uidSet] of snapshotUidSetByBook.entries()) {
    const entries = await getLorebookEntries_ACU(bookName);
    for (const entry of entries || []) {
      if (!hasValidWorldbookUid_ACU(entry?.uid) || !uidSet.has(String(entry.uid)) || !isFinalGenerationBlueLightEntry_ACU(entry)) continue;
      const key = buildFinalGreenlightKey_ACU(bookName, entry.uid);
      if (seen.has(key)) continue;
      seen.add(key);
      greenlights.push({ bookName, uid: entry.uid });
    }
  }

  return greenlights;
}

export async function clearFinalGenerationGreenlights_ACU(): Promise<number> {
  const snapshotUidSetByBook = buildSnapshotUidSetByBook_ACU(getPlotAgentWorldbookSnapshot_ACU());
  const patched = await patchSnapshotEntries_ACU(snapshotUidSetByBook, (_bookName, entry) => {
    if (!isFinalGenerationBlueLightEntry_ACU(entry)) return null;
    return { uid: entry.uid, enabled: false };
  });
  const resolvedBookNames = await resolveTakeoverBookNames_ACU();
  const deletedLegacyEntries = await deleteInternalEntriesByComment_ACU(resolvedBookNames, AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU);
  return patched + deletedLegacyEntries;
}

export async function takeoverWorldbookGreenlights_ACU(): Promise<AgentWorldbookTakeoverResult_ACU> {
  const resolvedBookNames = await resolveTakeoverBookNames_ACU();
  const selectionSignature = buildWorldbookSelectionSignature_ACU(resolvedBookNames);

  if (resolvedBookNames.length === 0) {
    const snapshot = buildInactiveSnapshot_ACU(selectionSignature);
    setPlotAgentWorldbookSnapshot_ACU(snapshot);
    return {
      updated: false,
      reason: 'empty_scope',
      bookNames: resolvedBookNames,
      selectionSignature,
      totalCandidates: 0,
      disabled: 0,
      failed: 0,
      snapshot,
      updates: [],
    };
  }

  const { snapshotBooks, updates } = await collectTakeoverCandidates_ACU(resolvedBookNames);
  const totalCandidates = updates.length || Object.values(snapshotBooks || {}).reduce((sum, entries) => sum + (Array.isArray(entries) ? entries.length : 0), 0);
  const existingSnapshot = getPlotAgentWorldbookSnapshot_ACU();
  const shouldKeepExistingActiveSnapshot = totalCandidates === 0 && existingSnapshot.active === true && existingSnapshot.selectionSignature === selectionSignature;
  const snapshot = totalCandidates > 0
    ? buildActiveSnapshot_ACU(selectionSignature, snapshotBooks)
    : (shouldKeepExistingActiveSnapshot ? existingSnapshot : buildInactiveSnapshot_ACU(selectionSignature));
  const { disabled, failed } = await disableTakeoverCandidates_ACU(updates);
  setPlotAgentWorldbookSnapshot_ACU(snapshot);

  return {
    updated: disabled > 0 || failed > 0,
    reason: totalCandidates > 0
      ? 'native_worldbook_trigger_disabled'
      : (shouldKeepExistingActiveSnapshot ? 'native_worldbook_trigger_already_disabled' : 'empty_candidates'),
    bookNames: resolvedBookNames,
    selectionSignature,
    totalCandidates,
    disabled,
    failed,
    snapshot,
    updates,
  };
}

export async function restoreWorldbookGreenlights_ACU(): Promise<AgentWorldbookRestoreResult_ACU> {
  const resolvedBookNames = await resolveTakeoverBookNames_ACU();
  const selectionSignature = buildWorldbookSelectionSignature_ACU(resolvedBookNames);
  const snapshot = getPlotAgentWorldbookSnapshot_ACU();
  const shouldRestoreSnapshot = snapshot.active === true && snapshot.selectionSignature === selectionSignature;
  const restoreResult = shouldRestoreSnapshot
    ? await restoreSnapshotEntries_ACU(snapshot)
    : { restored: 0, skipped: 0, failed: 0 };
  const deletedFinalGreenlights = await deleteInternalEntriesByComment_ACU(resolvedBookNames, AGENT_FINAL_GENERATION_GREENLIGHT_COMMENT_ACU);
  const deletedSnapshots = await deleteInternalEntriesByComment_ACU(resolvedBookNames, AGENT_WORLDBOOK_SNAPSHOT_COMMENT_ACU);
  const cleaned = deletedFinalGreenlights + deletedSnapshots;
  const changed = restoreResult.restored + restoreResult.failed + cleaned;
  setPlotAgentWorldbookSnapshot_ACU(buildInactiveSnapshot_ACU(selectionSignature));

  return {
    updated: changed > 0,
    reason: restoreResult.restored > 0
      ? 'native_worldbook_trigger_restored'
      : (restoreResult.skipped > 0
        ? 'native_worldbook_trigger_restore_skipped'
        : (cleaned > 0 ? 'legacy_artifacts_cleaned' : 'no_active_snapshot')),
    bookNames: resolvedBookNames,
    selectionSignature,
    restored: restoreResult.restored,
    skipped: restoreResult.skipped,
    failed: restoreResult.failed,
    updates: [],
  };
}
