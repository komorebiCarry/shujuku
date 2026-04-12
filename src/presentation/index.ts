// ═══════════════════════════════════════════════════════════════
// presentation/index.ts — 表示层统一出口
// ═══════════════════════════════════════════════════════════════

export * from './window/window-system';
export * from './theme/toast';
export * from './components/table-selector';
export * from './components/plot-editors';
export * from './pages/main-popup';
export * from './pages/visualizer';
// 注意：以下模块因跨文件函数依赖保留在 features/ 原位，未迁入 presentation/
// - status-display (features/runtime/01_runtime_state.js)
// - startup (features/startup/01_ready_and_menu.js)
// - update-controls (features/ui/01_update_trigger.js + features/data/01_data_admin.js)
// - worldbook-selectors (features/worldbook/01~03)
