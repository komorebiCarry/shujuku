/**
 * presentation/components/settings-ui-helpers.ts
 * 从 settings-service.ts 搬出的 UI 相关便捷函数
 */
import { loadSettings_ACU } from '../../service/settings/settings-service';
import { syncAllSettingsToUI_ACU } from './status-display';
import { settings_ACU } from '../../service/runtime/state-manager';

/**
 * 加载设置后刷新 UI（presentation 层便捷函数）
 */
export function loadSettingsAndRefreshUI_ACU() {
    loadSettings_ACU();
    if (typeof syncAllSettingsToUI_ACU === 'function') syncAllSettingsToUI_ACU(settings_ACU);
}
