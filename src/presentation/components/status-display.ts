// status-display.ts — 对应源文件有跨文件依赖，保留在原位

  // [T172] 可视化编辑器刷新通知（从 service/worldbook/pipeline.ts 提取）
  function notifyVisualizerRefresh_ACU() {
    try { jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data'); } catch(e) {}
  }
