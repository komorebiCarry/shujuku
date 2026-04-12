/**
 * 数据隔离（Isolation）相关函数
 *
 * 管理数据隔离标识的历史记录、Profile 创建和切换。
 * 依赖全局变量：globalMeta_ACU, saveGlobalMeta_ACU, loadGlobalMeta_ACU,
 *   normalizeIsolationCode_ACU, readProfileSettingsFromStorage_ACU, writeProfileSettingsToStorage_ACU,
 *   readProfileTemplateFromStorage_ACU, writeProfileTemplateToStorage_ACU, sanitizeSettingsForProfileSave_ACU,
 *   settings_ACU, TABLE_TEMPLATE_ACU, DEFAULT_TABLE_TEMPLATE_ACU, logWarn_ACU,
 *   saveSettings_ACU, loadSettings_ACU, applyTemplateScopeForCurrentChat_ACU
 */

export const MAX_DATA_ISOLATION_HISTORY = 20;

export function normalizeDataIsolationHistory_ACU(list?: any[]): string[] {
    const seen = new Set<string>();
    const cleaned: string[] = [];
    const sourceList = list !== undefined ? list : (globalMeta_ACU as any).isolationCodeList;
    if (Array.isArray(sourceList)) {
        sourceList.forEach((code: any) => {
            if (typeof code !== 'string') return;
            const trimmed = code.trim();
            if (!trimmed || seen.has(trimmed)) return;
            seen.add(trimmed);
            cleaned.push(trimmed);
        });
    }
    (globalMeta_ACU as any).isolationCodeList = cleaned.slice(0, MAX_DATA_ISOLATION_HISTORY);
    return (globalMeta_ACU as any).isolationCodeList;
}

export function getDataIsolationHistory_ACU(): string[] {
    return normalizeDataIsolationHistory_ACU();
}

export function addDataIsolationHistory_ACU(code: string, { save = true } = {}): void {
    if (typeof code !== 'string') return;
    const trimmed = code.trim();
    if (!trimmed) return;
    const history = getDataIsolationHistory_ACU();
    (globalMeta_ACU as any).isolationCodeList = [trimmed, ...history.filter((item: string) => item !== trimmed)].slice(
        0,
        MAX_DATA_ISOLATION_HISTORY,
    );
    if (save) (saveGlobalMeta_ACU as any)();
}

export function removeDataIsolationHistory_ACU(code: string, { save = true } = {}): void {
    if (typeof code !== 'string') return;
    const history = getDataIsolationHistory_ACU();
    (globalMeta_ACU as any).isolationCodeList = history.filter((item: string) => item !== code);
    if (save) (saveGlobalMeta_ACU as any)();
}

export function ensureProfileExists_ACU(code: string, { seedFromCurrent = true } = {}): void {
    const c = (normalizeIsolationCode_ACU as any)(code);
    const hasSettings = !!(readProfileSettingsFromStorage_ACU as any)(c);
    const hasTemplate = !!(readProfileTemplateFromStorage_ACU as any)(c);

    if (!hasSettings) {
        const seed = seedFromCurrent ? (sanitizeSettingsForProfileSave_ACU as any)((settings_ACU as any)) : {};
        seed.dataIsolationCode = c;
        try { (writeProfileSettingsToStorage_ACU as any)(c, seed); } catch (e) { (logWarn_ACU as any)('[Profile] seed settings failed:', e); }
    }
    if (!hasTemplate) {
        const seedTemplate = seedFromCurrent ? ((TABLE_TEMPLATE_ACU as any) || (DEFAULT_TABLE_TEMPLATE_ACU as any)) : (DEFAULT_TABLE_TEMPLATE_ACU as any);
        try { (writeProfileTemplateToStorage_ACU as any)(c, seedTemplate); } catch (e) { (logWarn_ACU as any)('[Profile] seed template failed:', e); }
    }
}

export async function switchIsolationProfile_ACU(newCodeRaw: string): Promise<void> {
    const newCode = (normalizeIsolationCode_ACU as any)(newCodeRaw);
    const oldCode = (normalizeIsolationCode_ACU as any)((settings_ACU as any)?.dataIsolationCode || '');

    try { (saveSettings_ACU as any)(); } catch (e) {}

    (loadGlobalMeta_ACU as any)();
    if (oldCode) addDataIsolationHistory_ACU(oldCode, { save: false });
    if (newCode) addDataIsolationHistory_ACU(newCode, { save: false });
    (globalMeta_ACU as any).activeIsolationCode = newCode;
    normalizeDataIsolationHistory_ACU((globalMeta_ACU as any).isolationCodeList);
    (saveGlobalMeta_ACU as any)();

    ensureProfileExists_ACU(newCode, { seedFromCurrent: true });

    (loadSettings_ACU as any)();
    (applyTemplateScopeForCurrentChat_ACU as any)({ isolationKey: newCode });
}
