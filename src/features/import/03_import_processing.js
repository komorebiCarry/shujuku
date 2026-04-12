  // [已迁移到 service/import/import-process.ts] processImportedTxtAsUpdates_ACU

  // [外部导入] 自选表格注入（取代旧的 标准/总结/整体 模式）
  // [已迁移到 service/import/import-process.ts] handleInjectImportedTxtSelected_ACU

  // 兼容旧API/旧按钮调用（仍会走自选表格逻辑）
  async function handleInjectSplitEntriesStandard_ACU() { return await handleInjectImportedTxtSelected_ACU(); }
  async function handleInjectSplitEntriesSummary_ACU() { return await handleInjectImportedTxtSelected_ACU(); }
  async function handleInjectSplitEntriesFull_ACU() { return await handleInjectImportedTxtSelected_ACU(); }