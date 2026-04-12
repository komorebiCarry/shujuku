// ═══════════════════════════════════════════════════════════════
// data/repositories/template-preset-repo.ts — 模板预设纯数据工具函数
// 从 02_storage_and_profile.js 行 18~101 迁入
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_TEMPLATE_PRESET_OPTION_VALUE_ACU = '__ACU_DEFAULT_TEMPLATE_PRESET__';

export function normalizeTemplatePresetSelectionValue_ACU(presetName: any): string {
    const normalizedName = String(presetName ?? '').trim();
    return normalizedName === DEFAULT_TEMPLATE_PRESET_OPTION_VALUE_ACU ? '' : normalizedName;
}

export function isDefaultTemplatePresetSelection_ACU(presetName: any): boolean {
    return normalizeTemplatePresetSelectionValue_ACU(presetName) === '';
}

export function getCurrentTemplatePresetName_ACU({ requireExisting = false } = {}): string {
    const presetName = normalizeTemplatePresetSelectionValue_ACU((settings_ACU as any)?.currentTemplatePresetName || '');
    if (!presetName) return '';
    if (!requireExisting) return presetName;
    return (getTemplatePreset_ACU as any)(presetName)?.templateStr ? presetName : '';
}

export function persistCurrentTemplatePresetName_ACU(presetName: any, { save = true } = {}): string {
    if (!settings_ACU || typeof settings_ACU !== 'object') return '';
    const normalizedPresetName = normalizeTemplatePresetSelectionValue_ACU(presetName);
    (settings_ACU as any).currentTemplatePresetName = normalizedPresetName;
    if (save) {
        (saveSettings_ACU as any)();
    }
    return normalizedPresetName;
}

export function derivePresetNameFromFilename_ACU(filename: any): string {
    const raw = String(filename || '').trim();
    if (!raw) return '';
    const idx = raw.lastIndexOf('.');
    const base = (idx > 0 ? raw.slice(0, idx) : raw).trim();
    return base;
}

export function getCurrentCharacterCardName_ACU(): string {
    try {
        const stContext = (window as any).SillyTavern?.getContext?.();
        let character = null;
        if ((TavernHelper_API_ACU as any)?.getCharData) {
            character = (TavernHelper_API_ACU as any).getCharData('current');
        }
        if (!character) {
            character = (SillyTavern_API_ACU as any)?.characters?.[(SillyTavern_API_ACU as any)?.this_chid]
                || stContext?.characters?.[stContext?.characterId]
                || (typeof characters !== 'undefined' && typeof this_chid !== 'undefined' ? (characters as any)[(this_chid as any)] : null);
        }
        return String(
            character?.name
            || character?.data?.name
            || stContext?.name2
            || (SillyTavern_API_ACU as any)?.name2
            || ''
        ).trim();
    } catch (e) {
        return '';
    }
}

export function deriveTemplatePresetNameForImport_ACU({ presetName = '', filename = '', fallbackLabel = '', allowCharacterFallback = true } = {}): string {
    const explicitName = normalizeTemplatePresetSelectionValue_ACU(presetName);
    if (explicitName) return explicitName;

    const filenameDerivedName = normalizeTemplatePresetSelectionValue_ACU(derivePresetNameFromFilename_ACU(filename));
    if (filenameDerivedName) return filenameDerivedName;

    if (allowCharacterFallback) {
        const characterDerivedName = normalizeTemplatePresetSelectionValue_ACU(getCurrentCharacterCardName_ACU());
        if (characterDerivedName) return characterDerivedName;
    }

    return normalizeTemplatePresetSelectionValue_ACU(fallbackLabel);
}

export function sanitizeFilenameComponent_ACU(name: any): string {
    const s = String(name || '').trim();
    const out = s.replace(/[\\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').trim();
    return out.length > 80 ? out.slice(0, 80).trim() : out;
}
