import type { AgentContextSettings_ACU, PromptSegment_ACU } from '../../shared/models/agent-worldbook-model';
import {
  AGENT_CONTEXT_SETTINGS_LIMITS_ACU,
  DEFAULT_AGENT_CONTEXT_SETTINGS_ACU,
  buildDefaultAgentDecisionPromptSegments_ACU,
  buildDefaultAgentSkillifyPromptSegments_ACU,
} from '../../shared/defaults';

export type AgentPromptPlaceholderMap_ACU = Record<string, unknown>;

export function clonePromptSegments_ACU(value: PromptSegment_ACU[]): PromptSegment_ACU[] {
  return JSON.parse(JSON.stringify(value || []));
}

export function normalizeAgentContextSettings_ACU(value: unknown): AgentContextSettings_ACU {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const result: Record<string, number> = {};
  for (const [key, fallback] of Object.entries(DEFAULT_AGENT_CONTEXT_SETTINGS_ACU)) {
    const limits = (AGENT_CONTEXT_SETTINGS_LIMITS_ACU as Record<string, { min: number; max: number }>)[key];
    const raw = Number(source[key]);
    const base = Number.isFinite(raw) ? Math.trunc(raw) : fallback;
    result[key] = Math.max(limits.min, Math.min(limits.max, base));
  }
  return result as unknown as AgentContextSettings_ACU;
}

function normalizeRole_ACU(value: unknown): string {
  const role = String(value || '').trim().toLowerCase();
  return role || 'user';
}

export function normalizeEditablePromptSegments_ACU(value: unknown, fallback: PromptSegment_ACU[]): PromptSegment_ACU[] {
  const raw = Array.isArray(value) ? value : [];
  if (raw.length === 0) return clonePromptSegments_ACU(fallback);
  return raw
    .map(item => item && typeof item === 'object' ? item as Record<string, unknown> : null)
    .filter(Boolean)
    .map(item => ({
      role: normalizeRole_ACU(item?.role),
      content: typeof item?.content === 'string' ? item.content : '',
      deletable: item?.deletable !== false,
      ...(typeof item?.mainSlot === 'string' && item.mainSlot ? { mainSlot: item.mainSlot } : {}),
      ...(item?.isMain === true ? { isMain: true } : {}),
      ...(item?.isMain2 === true ? { isMain2: true } : {}),
    }));
}

export function normalizePromptSegments_ACU(value: unknown, fallback: PromptSegment_ACU[]): PromptSegment_ACU[] {
  const normalized = normalizeEditablePromptSegments_ACU(value, [])
    .filter(item => item.content.trim());
  return normalized.length > 0 ? normalized : clonePromptSegments_ACU(fallback);
}

export function getDefaultAgentDecisionPromptSegments_ACU(): PromptSegment_ACU[] {
  return buildDefaultAgentDecisionPromptSegments_ACU();
}

export function getDefaultAgentSkillifyPromptSegments_ACU(): PromptSegment_ACU[] {
  return buildDefaultAgentSkillifyPromptSegments_ACU();
}

function stringifyPlaceholderValue_ACU(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null || typeof value === 'undefined') return '';
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function renderAgentPromptSegments_ACU(
  segments: PromptSegment_ACU[],
  placeholders: AgentPromptPlaceholderMap_ACU,
): Array<{ role: string; content: string }> {
  return normalizePromptSegments_ACU(segments, [])
    .map(segment => ({
      role: normalizeRole_ACU(segment.role),
      content: segment.content.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (raw, key) => (
        Object.prototype.hasOwnProperty.call(placeholders, key) ? stringifyPlaceholderValue_ACU(placeholders[key]) : raw
      )),
    }))
    .filter(message => message.content.trim());
}
