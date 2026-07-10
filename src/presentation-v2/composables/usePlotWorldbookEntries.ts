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
import {
  parseWorldbookSkillMetaFromComment_ACU,
  stripWorldbookSkillMetaBlock_ACU,
} from '../../service/agent/agent-worldbook-skill-meta';
import { logError_ACU } from '../../shared/utils';
import type {
  WorldbookEntryDisplayGroup_ACU,
  WorldbookEntryDisplayItem_ACU,
  WorldbookEntryTakeoverState_ACU,
} from './worldbook-entry-display';

export type WorldbookEntryAgentTakeoverState = WorldbookEntryTakeoverState_ACU;
export type WorldbookEntryItem = WorldbookEntryDisplayItem_ACU;
export type WorldbookEntryGroup = WorldbookEntryDisplayGroup_ACU;

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
  const comment = String(entry?.comment || entry?.name || '');
  if (isDbGenerated(comment)) return false;
  if (isBlocked(comment)) return false;
  return true;
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

export function usePlotWorldbookEntries() {
  const groups = shallowRef<WorldbookEntryGroup[]>([]);
  const status = ref<EntryLoadStatus>('idle');
  const error = ref('');

  async function loadEntries(bookNames: string[]): Promise<void> {
    const unique = [...new Set(bookNames.filter(Boolean))];
    if (unique.length === 0) {
      groups.value = [];
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

      for (const bookName of unique) {
        const bookEntries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
        const visibleBookEntries = bookEntries.filter((entry: any) => isEntryVisibleForPlotInjectionUI_ACU(bookName, entry, snapshotUidSetByBook));
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
          const comment = String(entry?.comment || entry?.name || '');
          const skillMeta = parseWorldbookSkillMetaFromComment_ACU(comment);
          return {
            uid: entry.uid,
            bookName,
            label: buildWorldbookEntryLabel_ACU(entry),
            comment,
            skillMeta,
            hasSkill: !!skillMeta,
            agentTakeoverState: resolveEntryAgentTakeoverState_ACU(bookName, entry, !!skillMeta, snapshotUidSetByBook),
            checked: enabledList.includes(entry.uid),
            skillifySelected: false,
            skillifySelectable: false,
            isConstant: isConstantWorldbookEntry_ACU(entry),
            disabled: entry.enabled === false,
          };
        });

        const visible = buildItems(visibleBookEntries);

        if (visible.length > 0) {
          result.push({ bookName, entries: visible, expanded: false });
        }
      }

      if (settingsChanged) saveSettings_ACU();
      groups.value = result;
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
  }

  function toggleGroupExpanded(bookName: string): void {
    groups.value = groups.value.map(g => {
      if (g.bookName !== bookName) return g;
      return { ...g, expanded: !g.expanded };
    });
  }

  return {
    groups,
    status,
    error,
    loadEntries,
    toggleEntry,
    selectAll,
    deselectAll,
    toggleGroupExpanded,
  };
}
