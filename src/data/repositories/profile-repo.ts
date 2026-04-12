/**
 * Profile 与 GlobalMeta 管理
 *
 * 全局元信息（跨标识共享）+ Profile 化存储（按标识代码分组的设置/模板）
 * 依赖全局变量：getConfigStorage_ACU, STORAGE_KEY_GLOBAL_META_ACU, safeJsonParse_ACU,
 *   safeJsonStringify_ACU, normalizeIsolationCode_ACU, getProfileSettingsKey_ACU,
 *   getProfileTemplateKey_ACU, settings_ACU, TABLE_TEMPLATE_ACU, logWarn_ACU
 */

export let globalMeta_ACU: any = {
    version: 1,
    activeIsolationCode: '',
    isolationCodeList: [] as string[],
    migratedLegacySingleStore: false,
    zeroTkOccupyModeGlobal: false,
};

export function buildDefaultGlobalMeta_ACU(): any {
    return {
        version: 1,
        activeIsolationCode: '',
        isolationCodeList: [],
        migratedLegacySingleStore: false,
        zeroTkOccupyModeGlobal: false,
    };
}

export function loadGlobalMeta_ACU(): any {
    const store = (getConfigStorage_ACU as any)();
    const raw = store?.getItem?.((STORAGE_KEY_GLOBAL_META_ACU as any));
    if (!raw) {
        globalMeta_ACU = buildDefaultGlobalMeta_ACU();
        return globalMeta_ACU;
    }
    const parsed = (safeJsonParse_ACU as any)(raw, null);
    if (!parsed || typeof parsed !== 'object') {
        globalMeta_ACU = buildDefaultGlobalMeta_ACU();
        return globalMeta_ACU;
    }
    globalMeta_ACU = { ...buildDefaultGlobalMeta_ACU(), ...parsed };
    globalMeta_ACU.activeIsolationCode = (normalizeIsolationCode_ACU as any)(globalMeta_ACU.activeIsolationCode);
    if (!Array.isArray(globalMeta_ACU.isolationCodeList)) globalMeta_ACU.isolationCodeList = [];
    return globalMeta_ACU;
}

export function saveGlobalMeta_ACU(): boolean {
    try {
        const store = (getConfigStorage_ACU as any)();
        const payload = (safeJsonStringify_ACU as any)(globalMeta_ACU, '{}');
        store.setItem((STORAGE_KEY_GLOBAL_META_ACU as any), payload);
        return true;
    } catch (e) {
        (logWarn_ACU as any)('[GlobalMeta] Failed to save:', e);
        return false;
    }
}

export function readProfileSettingsFromStorage_ACU(code: string): any {
    const store = (getConfigStorage_ACU as any)();
    const raw = store?.getItem?.((getProfileSettingsKey_ACU as any)(code));
    if (!raw) return null;
    const parsed = (safeJsonParse_ACU as any)(raw, null);
    return (parsed && typeof parsed === 'object') ? parsed : null;
}

export function writeProfileSettingsToStorage_ACU(code: string, settingsObj: any): void {
    const store = (getConfigStorage_ACU as any)();
    store.setItem((getProfileSettingsKey_ACU as any)(code), (safeJsonStringify_ACU as any)(settingsObj, '{}'));
}

export function readProfileTemplateFromStorage_ACU(code: string): string | null {
    const store = (getConfigStorage_ACU as any)();
    const raw = store?.getItem?.((getProfileTemplateKey_ACU as any)(code));
    return (typeof raw === 'string' && raw.trim()) ? raw : null;
}

export function writeProfileTemplateToStorage_ACU(code: string, templateStr: string): void {
    const store = (getConfigStorage_ACU as any)();
    store.setItem((getProfileTemplateKey_ACU as any)(code), String(templateStr || ''));
}

export function saveCurrentProfileTemplate_ACU(templateStr?: string): void {
    const tpl = templateStr !== undefined ? templateStr : (TABLE_TEMPLATE_ACU as any);
    const code = (normalizeIsolationCode_ACU as any)((settings_ACU as any)?.dataIsolationCode || '');
    writeProfileTemplateToStorage_ACU(code, String(tpl || ''));
}

export function sanitizeSettingsForProfileSave_ACU(settingsObj: any): any {
    const cloned = (safeJsonParse_ACU as any)((safeJsonStringify_ACU as any)(settingsObj, '{}'), {});
    delete cloned.dataIsolationHistory;
    delete cloned.dataIsolationEnabled;
    return cloned;
}
