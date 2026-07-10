import type { WorldbookSkillMeta_ACU } from '../../service/agent/agent-worldbook-skill-meta';

export type WorldbookEntryTakeoverState_ACU =
  | 'native'
  | 'skill_ready'
  | 'taken_over'
  | 'final_greenlight'
  | 'initial_disabled';

export interface WorldbookEntryDisplayItem_ACU {
  uid: number;
  bookName: string;
  label: string;
  comment: string;
  skillMeta: WorldbookSkillMeta_ACU | null;
  hasSkill: boolean;
  agentTakeoverState: WorldbookEntryTakeoverState_ACU;
  checked: boolean;
  skillifySelected: boolean;
  skillifySelectable: boolean;
  isConstant?: boolean;
  disabled: boolean;
}

export interface WorldbookEntryDisplayGroup_ACU {
  bookName: string;
  entries: WorldbookEntryDisplayItem_ACU[];
  expanded: boolean;
}

export interface WorldbookSkillifySelectedEntry_ACU {
  bookName: string;
  uid: number;
}
