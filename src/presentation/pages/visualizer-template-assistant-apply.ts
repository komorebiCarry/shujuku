import { showToastr_ACU } from '../theme/toast';
import { applySheetOrderNumbers_ACU } from '../../shared/utils';
import {
    buildTemplateAssistantFingerprint_ACU,
    getTemplateAssistantApplyBaselineFingerprint_ACU,
    type TemplateAssistantGenerateResult_ACU,
} from '../../service/template-assistant/service';
import { renderVisualizerMain_ACU } from './visualizer-main-render';
import { renderVisualizerSidebar_ACU } from './visualizer-sidebar';
import { _acuVisState } from './visualizer';

function clone_ACU<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

export function applyTemplateAssistantDraftToVisualizer_ACU(result: TemplateAssistantGenerateResult_ACU) {
    const baselineFingerprint = getTemplateAssistantApplyBaselineFingerprint_ACU(result);
    const currentFingerprint = buildTemplateAssistantFingerprint_ACU(_acuVisState.tempData || {});
    if (!baselineFingerprint || currentFingerprint !== baselineFingerprint) {
        showToastr_ACU('warning', '当前结构已变化，assistant 草稿已失效，请重新生成。');
        return false;
    }

    const nextTempData = clone_ACU(result.compileResult.candidateData || {});
    const nextSheetOrder = Array.isArray(result.compileResult.orderedSheetKeys)
        ? [...result.compileResult.orderedSheetKeys]
        : [];
    const nextDeletedKeys = new Set<string>(Array.isArray(_acuVisState.deletedSheetKeys) ? _acuVisState.deletedSheetKeys : []);
    (result.compileResult.deletedSheetKeys || []).forEach((key) => nextDeletedKeys.add(key));

    _acuVisState.tempData = nextTempData;
    _acuVisState.sheetOrder = nextSheetOrder;
    applySheetOrderNumbers_ACU(_acuVisState.tempData, _acuVisState.sheetOrder);
    _acuVisState.deletedSheetKeys = Array.from(nextDeletedKeys);

    const currentSheetKey = _acuVisState.currentSheetKey;
    if (currentSheetKey && _acuVisState.tempData?.[currentSheetKey]) {
        _acuVisState.currentSheetKey = currentSheetKey;
    } else if (result.compileResult.focusSheetKey && _acuVisState.tempData?.[result.compileResult.focusSheetKey]) {
        _acuVisState.currentSheetKey = result.compileResult.focusSheetKey;
    } else {
        _acuVisState.currentSheetKey = _acuVisState.sheetOrder[0] || null;
    }

    renderVisualizerSidebar_ACU();
    renderVisualizerMain_ACU();
    showToastr_ACU('success', 'assistant 草稿已应用到当前编辑器临时态。');
    return true;
}
