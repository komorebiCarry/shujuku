  // --- [新增] 外部导入功能 ---

  const IMPORTED_ENTRY_PREFIX_ACU = 'TavernDB-ACU-ImportedTxt-';
  // [外部导入] 本次注入的批次ID（用于“每批独立注入，不覆盖上一批”）
  let importBatchId_ACU = null;

  function newImportBatchId_ACU() {
      // 短且可读，避免 comment 过长
      const t = Date.now().toString(36);
      const r = Math.random().toString(36).slice(2, 6);
      return `b${t}${r}`;
  }

  // 外部导入前缀：
  // - stable: 用于 UI 识别/手动删除
  function getImportStablePrefix_ACU() { return '外部导入-'; }
  // 当前按用户要求：外部导入不自动清理，因此无需批次隔离；统一使用稳定前缀即可
  function getImportBatchPrefix_ACU() { return getImportStablePrefix_ACU(); }

  // [新增] 只清除本地存储中的导入缓存
  // [已迁移到 service/import/import-process.ts] clearImportLocalStorage_ACU

  // [已迁移到 service/import/import-process.ts] clearImportedEntries_ACU

  // [新增] 删除外部导入注入的世界书条目
  // [已迁移到 service/import/import-process.ts] deleteImportedEntries_ACU

  // --- [新增] 外部导入功能 ---
  