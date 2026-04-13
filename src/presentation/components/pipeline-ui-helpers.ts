/**
 * presentation/components/pipeline-ui-helpers.ts
 * 包装 service 层的 pipeline 函数，在调用后自动刷新 UI
 */
import { refreshMergedDataAndNotify_ACU } from '../../service/worldbook/pipeline';
import { $manualTableSelector_ACU, $importTableSelector_ACU } from '../../service/runtime/state-manager';
import { renderManualTableSelector_ACU, renderImportTableSelector_ACU } from './table-selector';
import { updateCardUpdateStatusDisplay_ACU } from './update-status-display';

/**
 * 刷新合并数据后自动刷新 UI 选择器和状态面板
 */
export async function refreshMergedDataAndNotifyWithUI_ACU() {
    await refreshMergedDataAndNotify_ACU();
    // UI 刷新
    if ($manualTableSelector_ACU) {
        try { renderManualTableSelector_ACU(); } catch (e) {}
    }
    if ($importTableSelector_ACU) {
        try { renderImportTableSelector_ACU(); } catch (e) {}
    }
    if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
        updateCardUpdateStatusDisplay_ACU();
    }
}
