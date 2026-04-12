/**
 * service/plot/plot-logic.ts — 剧情推进纯逻辑函数
 * 
 * 从 presentation/components/optimization-ui.ts 中提取的纯计算/数据处理函数。
 * 这些函数不操作 DOM，可以被 service 层和 presentation 层共同引用。
 * 
 * 注意：此文件只包含纯逻辑，不 import presentation 层任何模块。
 */

// Re-export 所有纯逻辑函数（当前先做 re-export 桥接，后续逐步搬移函数体）
// 这样 service 层可以立即改为从此处 import，不需要等函数体全部搬完

export {
  // 提示词组兼容
  ensureLoopPromptsArray_ACU,
  ensurePlotPromptsArray_ACU,
  ensurePlotTasksCompat_ACU,
  ensureTagRulesCompat_ACU,
  
  // 预设选择值规范化
  DEFAULT_PRESET_OPTION_VALUE_ACU,
  normalizePlotPresetSelectionValue_ACU,
  isDefaultPlotPresetSelection_ACU,
  
  // 预设绑定
  ensurePlotPresetBindingsStore_ACU,
  getPlotPresetBindingForChat_ACU,
  clearPlotPresetBindingForChat_ACU,
  findPlotPresetByName_ACU,
  getCurrentRuntimePlotPresetName_ACU,
  
  // 任务规范化
  normalizePlotTask_ACU,
  normalizePlotTasks_ACU,
  syncLegacyPlotSettingsFromTask_ACU,
  
  // 预设应用/重置
  applyPlotPresetToSettings_ACU,
  resetPlotSettingsToDefault_ACU,
  replaceCurrentPlotSettingsWithSnapshot_ACU,
  
  // 全局修订
  getPlotGlobalRevision_ACU,
  syncCurrentEditablePlotPresetState_ACU,
  
  // 排除规则
  normalizePlotPresetExcludeRules_ACU,
  stripPlotPresetWorldbookEntrySelectionForExport_ACU,
  
  // Prompt 内容读写
  getPlotFinalDirectiveFromSource_ACU,
  getPlotPromptContentByIdFromSettings_ACU,
  setPlotPromptContentByIdForSettings_ACU,
  getLegacyPromptTextsFromPromptGroup_ACU,
  getPlotPromptGroupFromSource_ACU,
  getLegacyPromptFromThree_ACU,
  
  // 拦截标记
  markPlotIntercept_ACU,
  shouldSkipPlotIntercept_ACU,
  
  // 预设持久化
  persistPlotPresetSelectionState_ACU,
  switchCurrentChatPlotPreset_ACU,
  applyGlobalPlotPresetSelectionForEditor_ACU,
  
  // 编辑器设置
  getActivePlotEditorSettings_ACU,
  setActivePlotEditorSettings_ACU,
  setCurrentEditablePlotPresetState_ACU,
  
  // 优化相关
  getLastOptimizedMessageIndex_ACU,
} from '../../presentation/components/optimization-ui';
