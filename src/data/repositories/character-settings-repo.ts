// ═══════════════════════════════════════════════════════════════
// data/repositories/character-settings-repo.ts — 角色专属设置辅助函数
// 从 02_storage_and_profile.js 行 4193~4236 迁入
// ═══════════════════════════════════════════════════════════════

export function getCurrentCharSettings_ACU() {
    const charId = (currentChatFileIdentifier_ACU as any) || 'default';
    if (!(settings_ACU as any).characterSettings) {
        (settings_ACU as any).characterSettings = {};
    }
    const globalZeroTkDefault =
        (typeof (globalMeta_ACU as any)?.zeroTkOccupyModeGlobal === 'boolean')
            ? ((globalMeta_ACU as any).zeroTkOccupyModeGlobal === true)
            : ((settings_ACU as any)?.zeroTkOccupyModeDefault === true);
    if (!(settings_ACU as any).characterSettings[charId]) {
        const worldbookConfigForNewChat = JSON.parse(JSON.stringify(defaultWorldbookConfig_ACU));
        worldbookConfigForNewChat.zeroTkOccupyMode = globalZeroTkDefault;
        worldbookConfigForNewChat.outlineEntryEnabled = !globalZeroTkDefault;
        (settings_ACU as any).characterSettings[charId] = {
            worldbookConfig: worldbookConfigForNewChat,
        };
        (logDebug_ACU as any)(`Created new character settings for: ${charId}`);
    }
    try {
        const existingCfg = (settings_ACU as any).characterSettings[charId].worldbookConfig || {};
        const mergedCfg = (deepMerge_ACU as any)(
            JSON.parse(JSON.stringify(defaultWorldbookConfig_ACU)),
            existingCfg,
        );
        mergedCfg.zeroTkOccupyMode = globalZeroTkDefault;
        mergedCfg.outlineEntryEnabled = !globalZeroTkDefault;
        (settings_ACU as any).characterSettings[charId].worldbookConfig = mergedCfg;
    } catch (e) {
        // ignore
    }
    return (settings_ACU as any).characterSettings[charId];
}

export function getCurrentWorldbookConfig_ACU() {
    return getCurrentCharSettings_ACU().worldbookConfig;
}
