/**
 * data/storage/config-storage.ts — 统一配置存储门面
 *
 * 对应初版设计 plans/three_layer_refactor_plan.md §3.1 的 config-storage.js。
 * 提供统一的配置存储接口，封装自动降级策略：
 *   酒馆设置 → IndexedDB 缓存 → localStorage（如未禁用）
 *
 * 实际实现在 tavern-storage.ts 的 getConfigStorage_ACU 中。
 * 本文件作为门面层，为未来解耦提供接口稳定性。
 */

export { getConfigStorage_ACU } from './tavern-storage';
export { migrateKeyToTavernStorageIfNeeded_ACU } from './tavern-storage';

/**
 * 纯数据层的 settings 持久化（不含 UI 通知）
 * data 层的 repo 调用此函数，不调用 service 层的 saveSettings_ACU
 */
function persistSettingsToStorage_ACU() {
    try {
        const store = (getConfigStorage_ACU as any)();
        const code = (normalizeIsolationCode_ACU as any)((settings_ACU as any)?.dataIsolationCode || (globalMeta_ACU as any)?.activeIsolationCode || '');
        if (globalMeta_ACU && typeof globalMeta_ACU === 'object') {
            (globalMeta_ACU as any).activeIsolationCode = code;
            if (code) (addDataIsolationHistory_ACU as any)(code, { save: false });
            (normalizeDataIsolationHistory_ACU as any)((globalMeta_ACU as any).isolationCodeList);
            (saveGlobalMeta_ACU as any)();
        }
        const payloadObj = (sanitizeSettingsForProfileSave_ACU as any)(settings_ACU);
        payloadObj.dataIsolationCode = code;
        const payload = JSON.stringify(payloadObj);
        store.setItem((getProfileSettingsKey_ACU as any)(code), payload);
    } catch (error) {
        (logError_ACU as any)('Failed to persist settings to storage:', error);
    }
}
