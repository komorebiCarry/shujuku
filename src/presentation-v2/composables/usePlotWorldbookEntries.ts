/**
 * usePlotWorldbookEntries — 剧情推进世界书条目级启用/禁用
 *
 * 从 service 层加载条目列表，过滤掉数据库生成条目和屏蔽词条目，
 * 暴露 reactive 分组列表 + selectAll / deselectAll / toggleEntry，
 * 持久化到 plotWorldbookConfig.enabledEntries。
 */
import { ref, shallowRef } from 'vue';
import { getLorebookEntriesByNames_ACU } from '../../service/worldbook/pipeline';
import { settings_ACU } from '../../service/runtime/state-manager';
import { saveSettings_ACU } from '../../service/settings/settings-service';
import type { AgentWorldbookControlSnapshot_ACU } from '../../shared/models/agent-worldbook-model';
import {
  getPlotAgentWorldbookSnapshot_ACU,
} from '../../service/agent/agent-worldbook-takeover';
import type {
  WorldbookSkillMeta_ACU,
  WorldbookSkillMetaUpdatedBy_ACU,
} from '../../service/agent/agent-worldbook-skill-meta';
import {
  deleteWorldbookEntrySkillMeta_ACU,
  parseWorldbookSkillMetaFromComment_ACU,
  saveWorldbookEntrySkillMeta_ACU,
  stripWorldbookSkillMetaBlock_ACU,
} from '../../service/agent/agent-worldbook-skill-meta';
import {
  getWorldbookEntryKeywordsForSkillify_ACU,
  isDatabaseGeneratedWorldbookEntryForAgent_ACU,
  isWorldbookEntrySkillifyCandidate_ACU,
} from '../../service/agent/agent-skillify-service';
import { logError_ACU } from '../../shared/utils';

export type WorldbookEntryAgentTakeoverState = 'native' | 'skill_ready' | 'taken_over' | 'final_greenlight' | 'initial_disabled';

export interface WorldbookEntryItem {
  uid: number;
  bookName: string;
  label: string;
  comment: string;
  skillMeta: WorldbookSkillMeta_ACU | null;
  hasSkill: boolean;
  agentTakeoverState: WorldbookEntryAgentTakeoverState;
  checked: boolean;
  skillifySelected: boolean;
  skillifySelectable: boolean;
  disabled: boolean;
}

export interface WorldbookSkillifySelectedEntry {
  bookName: string;
  uid: number;
}

export interface WorldbookEntryGroup {
  bookName: string;
  entries: WorldbookEntryItem[];
  expanded: boolean;
}

export interface UsePlotWorldbookEntriesOptions {
  onSkillMetaChanged?: () => Promise<unknown> | unknown;
}

export type EntryLoadStatus = 'idle' | 'loading' | 'success' | 'error';

const BLOCKED_KEYWORDS = [
  '规则', '思维链', 'cot', 'MVU', 'mvu', '变量', '状态',
  'Status', 'Rule', 'rule', '检定', '判断', '叙事', '文风',
  'InitVar', '格式',
];

function isDbGenerated(comment: string): boolean {
  const normalized = comment
    .replace(/^ACU-\[[^\]]+\]-/, '')
    .replace(/^外部导入-(?:[^-]+-)?/, '');
  if (String(comment || '').trim().startsWith('外部导入-')) return false;
  if (normalized.startsWith('TavernDB-ACU-OutlineTable')) return true;
  if (normalized.startsWith('TavernDB-ACU-')) return true;
  if (normalized.startsWith('重要人物条目')) return true;
  if (normalized.startsWith('总结条目')) return true;
  if (normalized.startsWith('小总结条目')) return true;
  return false;
}

function isBlocked(comment: string): boolean {
  return BLOCKED_KEYWORDS.some(kw => comment.includes(kw));
}

function isConstantWorldbookEntry_ACU(entry: any): boolean {
  return String(entry?.type || '').trim().toLowerCase() === 'constant';
}

function buildSnapshotUidSetByBookForUI_ACU(snapshot: AgentWorldbookControlSnapshot_ACU): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  if (snapshot.active !== true) return result;
  for (const [bookName, entries] of Object.entries(snapshot.books || {})) {
    if (!Array.isArray(entries)) continue;
    const uidSet = new Set(entries.map(entry => String(entry?.uid ?? '')).filter(Boolean));
    if (uidSet.size > 0) result.set(bookName, uidSet);
  }
  return result;
}

function isSnapshotControlledEntry_ACU(snapshotUidSetByBook: Map<string, Set<string>>, bookName: string, entry: any): boolean {
  return snapshotUidSetByBook.get(bookName)?.has(String(entry?.uid)) === true;
}

function isEntryVisibleForPlotInjectionUI_ACU(bookName: string, entry: any, snapshotUidSetByBook: Map<string, Set<string>>): boolean {
  if (isSnapshotControlledEntry_ACU(snapshotUidSetByBook, bookName, entry)) return true;
  if (isConstantWorldbookEntry_ACU(entry)) return false;
  const comment = String(entry?.comment || entry?.name || '');
  if (isDbGenerated(comment)) return false;
  if (isBlocked(comment)) return false;
  return true;
}

function isEntryVisibleForAgentSettingsUI_ACU(bookName: string, entry: any, snapshotUidSetByBook: Map<string, Set<string>>): boolean {
  if (isSnapshotControlledEntry_ACU(snapshotUidSetByBook, bookName, entry)) return true;
  const rawComment = String(entry?.comment || entry?.name || '');
  const skillMeta = parseWorldbookSkillMetaFromComment_ACU(rawComment);
  if (rawComment.trim().startsWith('外部导入-')) return true;
  if (isDatabaseGeneratedWorldbookEntryForAgent_ACU(entry)) return false;
  if (skillMeta) return true;
  if (getWorldbookEntryKeywordsForSkillify_ACU(entry).length > 0) return true;
  return !isConstantWorldbookEntry_ACU(entry);
}

function resolveEntryAgentTakeoverState_ACU(
  bookName: string,
  entry: any,
  hasSkill: boolean,
  snapshotUidSetByBook: Map<string, Set<string>>,
): WorldbookEntryAgentTakeoverState {
  if (isSnapshotControlledEntry_ACU(snapshotUidSetByBook, bookName, entry)) {
    return entry?.enabled !== false && isConstantWorldbookEntry_ACU(entry) ? 'final_greenlight' : 'taken_over';
  }
  if (entry?.enabled === false) return 'initial_disabled';
  return hasSkill ? 'skill_ready' : 'native';
}

function buildWorldbookEntryLabel_ACU(entry: any): string {
  const rawComment = String(entry?.comment || entry?.name || '');
  const label = stripWorldbookSkillMetaBlock_ACU(rawComment).trim();
  return label || `条目 ${entry?.uid}`;
}

function ensurePlotWorldbookConfig(): Record<string, any> {
  if (!settings_ACU.plotSettings || typeof settings_ACU.plotSettings !== 'object') {
    settings_ACU.plotSettings = {} as Record<string, any>;
  }
  const plot = settings_ACU.plotSettings as Record<string, any>;
  if (!plot.plotWorldbookConfig || typeof plot.plotWorldbookConfig !== 'object') {
    plot.plotWorldbookConfig = { source: 'character', manualSelection: [], enabledEntries: {} };
  }
  const cfg = plot.plotWorldbookConfig;
  if (!cfg.enabledEntries || typeof cfg.enabledEntries !== 'object') {
    cfg.enabledEntries = {};
  }
  return cfg;
}

export function usePlotWorldbookEntries(options: UsePlotWorldbookEntriesOptions = {}) {
  const groups = shallowRef<WorldbookEntryGroup[]>([]);
  const agentGroups = shallowRef<WorldbookEntryGroup[]>([]);
  const status = ref<EntryLoadStatus>('idle');
  const error = ref('');
  const selectedForSkillify = ref(new Map<string, WorldbookSkillifySelectedEntry>());

  function getSkillifySelectionKey(bookName: string, uid: number): string {
    return `${bookName}\u0000${String(uid)}`;
  }

  async function loadEntries(bookNames: string[]): Promise<void> {
    const unique = [...new Set(bookNames.filter(Boolean))];
    if (unique.length === 0) {
      groups.value = [];
      agentGroups.value = [];
      selectedForSkillify.value = new Map();
      status.value = 'success';
      return;
    }

    status.value = 'loading';
    error.value = '';

    try {
      const cfg = ensurePlotWorldbookConfig();
      const entriesMap = await getLorebookEntriesByNames_ACU(unique) as Record<string, any[]>;
      const snapshotUidSetByBook = buildSnapshotUidSetByBookForUI_ACU(getPlotAgentWorldbookSnapshot_ACU());
      let settingsChanged = false;
      const result: WorldbookEntryGroup[] = [];
      const agentResult: WorldbookEntryGroup[] = [];

      for (const bookName of unique) {
        const bookEntries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
        const visibleBookEntries = bookEntries.filter((entry: any) => isEntryVisibleForPlotInjectionUI_ACU(bookName, entry, snapshotUidSetByBook));
        const agentVisibleBookEntries = bookEntries.filter((entry: any) => isEntryVisibleForAgentSettingsUI_ACU(bookName, entry, snapshotUidSetByBook));
        const visibleUidSet = new Set(visibleBookEntries.map((entry: any) => String(entry?.uid)));

        if (typeof cfg.enabledEntries[bookName] === 'undefined') {
          cfg.enabledEntries[bookName] = visibleBookEntries.map((e: any) => e.uid);
          settingsChanged = true;
        } else if (Array.isArray(cfg.enabledEntries[bookName])) {
          const cleanedEnabledEntries = cfg.enabledEntries[bookName]
            .filter((uid: any) => visibleUidSet.has(String(uid)));
          if (cleanedEnabledEntries.length !== cfg.enabledEntries[bookName].length) {
            cfg.enabledEntries[bookName] = cleanedEnabledEntries;
            settingsChanged = true;
          }
        }

        const enabledList: number[] = Array.isArray(cfg.enabledEntries[bookName])
          ? cfg.enabledEntries[bookName]
          : [];

        const buildItems = (entries: any[]): WorldbookEntryItem[] => entries.map((entry: any) => {
          const skillifyKey = getSkillifySelectionKey(bookName, entry.uid);
          const comment = String(entry?.comment || entry?.name || '');
          const skillMeta = parseWorldbookSkillMetaFromComment_ACU(comment);
          const skillifySelectable = isWorldbookEntrySkillifyCandidate_ACU(entry);
          return {
            uid: entry.uid,
            bookName,
            label: buildWorldbookEntryLabel_ACU(entry),
            comment,
            skillMeta,
            hasSkill: !!skillMeta,
            agentTakeoverState: resolveEntryAgentTakeoverState_ACU(bookName, entry, !!skillMeta, snapshotUidSetByBook),
            checked: enabledList.includes(entry.uid),
            skillifySelected: skillifySelectable && selectedForSkillify.value.has(skillifyKey),
            skillifySelectable,
            disabled: entry.enabled === false,
          };
        });

        const visible = buildItems(visibleBookEntries);
        const agentVisible = buildItems(agentVisibleBookEntries);

        if (visible.length > 0) {
          result.push({ bookName, entries: visible, expanded: false });
        }
        if (agentVisible.length > 0) agentResult.push({ bookName, entries: agentVisible, expanded: false });
      }

      const nextSelectedForSkillify = new Map<string, WorldbookSkillifySelectedEntry>();
      const allVisibleKeys = new Set(
        agentResult.flatMap(group => group.entries.filter(entry => entry.skillifySelectable).map(entry => getSkillifySelectionKey(entry.bookName, entry.uid))),
      );
      for (const [key, value] of selectedForSkillify.value.entries()) {
        if (allVisibleKeys.has(key)) nextSelectedForSkillify.set(key, value);
      }
      selectedForSkillify.value = nextSelectedForSkillify;

      if (settingsChanged) saveSettings_ACU();
      groups.value = result;
      agentGroups.value = agentResult;
      status.value = 'success';
    } catch (e: any) {
      logError_ACU('[ACU-V2] usePlotWorldbookEntries loadEntries failed', e);
      error.value = e?.message ?? '加载条目失败';
      status.value = 'error';
    }
  }

  function toggleEntry(bookName: string, uid: number, checked: boolean): void {
    const cfg = ensurePlotWorldbookConfig();
    if (!Array.isArray(cfg.enabledEntries[bookName])) {
      cfg.enabledEntries[bookName] = [];
    }
    const list: number[] = cfg.enabledEntries[bookName];
    const idx = list.indexOf(uid);
    if (checked && idx === -1) list.push(uid);
    else if (!checked && idx !== -1) list.splice(idx, 1);
    saveSettings_ACU();

    groups.value = groups.value.map(g => {
      if (g.bookName !== bookName) return g;
      return {
        ...g,
        entries: g.entries.map(e =>
          e.uid === uid ? { ...e, checked } : e,
        ),
      };
    });
    agentGroups.value = agentGroups.value.map(g => {
      if (g.bookName !== bookName) return g;
      return {
        ...g,
        entries: g.entries.map(e => e.uid === uid ? { ...e, checked } : e),
      };
    });
  }

  function syncSkillifySelectionToGroups(): void {
    const sync = (source: WorldbookEntryGroup[]) => source.map(g => ({
      ...g,
      entries: g.entries.map(e => ({
        ...e,
        skillifySelected: selectedForSkillify.value.has(getSkillifySelectionKey(e.bookName, e.uid)),
      })),
    }));
    groups.value = sync(groups.value);
    agentGroups.value = sync(agentGroups.value);
  }

  function toggleSkillifyEntry(bookName: string, uid: number, checked: boolean): void {
    const key = getSkillifySelectionKey(bookName, uid);
    const next = new Map(selectedForSkillify.value);
    const entry = agentGroups.value
      .find(group => group.bookName === bookName)
      ?.entries.find(item => item.uid === uid);
    if (checked) {
      if (!entry?.skillifySelectable) {
        next.delete(key);
      } else {
        next.set(key, { bookName, uid });
      }
    } else {
      next.delete(key);
    }
    selectedForSkillify.value = next;
    syncSkillifySelectionToGroups();
  }

  function selectAllForSkillify(): void {
    const next = new Map<string, WorldbookSkillifySelectedEntry>();
    for (const group of agentGroups.value) {
      for (const entry of group.entries) {
        if (!entry.skillifySelectable) continue;
        next.set(getSkillifySelectionKey(entry.bookName, entry.uid), { bookName: entry.bookName, uid: entry.uid });
      }
    }
    selectedForSkillify.value = next;
    syncSkillifySelectionToGroups();
  }

  function deselectAllForSkillify(): void {
    selectedForSkillify.value = new Map();
    syncSkillifySelectionToGroups();
  }

  function getSelectedSkillifyEntries(): WorldbookSkillifySelectedEntry[] {
    return Array.from(selectedForSkillify.value.values());
  }

  function selectAll(): void {
    const cfg = ensurePlotWorldbookConfig();
    for (const group of groups.value) {
      cfg.enabledEntries[group.bookName] = group.entries
        .filter(e => !e.disabled)
        .map(e => e.uid);
    }
    saveSettings_ACU();

    groups.value = groups.value.map(g => ({
      ...g,
      entries: g.entries.map(e => ({ ...e, checked: !e.disabled })),
    }));
    agentGroups.value = agentGroups.value.map(g => ({
      ...g,
      entries: g.entries.map(e => {
        const enabledList: number[] = Array.isArray(cfg.enabledEntries[g.bookName])
          ? cfg.enabledEntries[g.bookName]
          : [];
        return { ...e, checked: enabledList.includes(e.uid) };
      }),
    }));
  }

  function deselectAll(): void {
    const cfg = ensurePlotWorldbookConfig();
    for (const group of groups.value) {
      cfg.enabledEntries[group.bookName] = [];
    }
    saveSettings_ACU();

    groups.value = groups.value.map(g => ({
      ...g,
      entries: g.entries.map(e => ({ ...e, checked: false })),
    }));
    agentGroups.value = agentGroups.value.map(g => ({
      ...g,
      entries: g.entries.map(e => ({ ...e, checked: false })),
    }));
  }

  function updateEntrySkillMetaLocal(bookName: string, uid: number, comment: string): void {
    const skillMeta = parseWorldbookSkillMetaFromComment_ACU(comment);
    const update = (source: WorldbookEntryGroup[]) => source.map(g => {
      if (g.bookName !== bookName) return g;
      return {
        ...g,
        entries: g.entries.map(e => {
          if (e.uid !== uid) return e;
          const label = stripWorldbookSkillMetaBlock_ACU(comment).trim() || `条目 ${uid}`;
          return {
            ...e,
            comment,
            label,
            skillMeta,
            hasSkill: !!skillMeta,
          };
        }),
      };
    });
    groups.value = update(groups.value);
    agentGroups.value = update(agentGroups.value);
  }

  async function notifySkillMetaChanged(): Promise<void> {
    if (!options.onSkillMetaChanged) return;
    try {
      await options.onSkillMetaChanged();
    } catch (e) {
      logError_ACU('[ACU-V2] sync Agent worldbook takeover after Skill meta change failed', e);
    }
  }

  async function saveEntrySkillMeta(
    bookName: string,
    uid: number,
    draft: Partial<WorldbookSkillMeta_ACU>,
    updatedBy: WorldbookSkillMetaUpdatedBy_ACU = 'manual',
  ): Promise<void> {
    const result = await saveWorldbookEntrySkillMeta_ACU(bookName, uid, draft, updatedBy);
    if (result.entry && typeof result.entry.comment === 'string') {
      updateEntrySkillMetaLocal(bookName, uid, result.entry.comment);
    }
    if (result.updated) {
      await notifySkillMetaChanged();
    }
  }

  async function deleteEntrySkillMeta(bookName: string, uid: number): Promise<void> {
    const result = await deleteWorldbookEntrySkillMeta_ACU(bookName, uid);
    if (result.entry && typeof result.entry.comment === 'string') {
      updateEntrySkillMetaLocal(bookName, uid, result.entry.comment);
    }
    if (result.updated) {
      await notifySkillMetaChanged();
    }
  }

  function toggleGroupExpanded(bookName: string): void {
    groups.value = groups.value.map(g => {
      if (g.bookName !== bookName) return g;
      return { ...g, expanded: !g.expanded };
    });
    agentGroups.value = agentGroups.value.map(g => {
      if (g.bookName !== bookName) return g;
      return { ...g, expanded: !g.expanded };
    });
  }

  return {
    groups,
    agentGroups,
    status,
    error,
    loadEntries,
    toggleEntry,
    toggleSkillifyEntry,
    selectAll,
    deselectAll,
    selectAllForSkillify,
    deselectAllForSkillify,
    getSelectedSkillifyEntries,
    saveEntrySkillMeta,
    deleteEntrySkillMeta,
    toggleGroupExpanded,
  };
}
