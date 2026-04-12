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
  async function clearImportLocalStorage_ACU(notify = true) {
      try {
          const entriesExist = (await importTempGet_ACU(STORAGE_KEY_IMPORTED_ENTRIES_ACU)) !== null;
          await importTempRemove_ACU(STORAGE_KEY_IMPORTED_ENTRIES_ACU);
          await importTempRemove_ACU(STORAGE_KEY_IMPORTED_STATUS_ACU);
          // [新增] 清除所有模式的断点续行状态
          await importTempRemove_ACU(STORAGE_KEY_IMPORTED_STATUS_STANDARD_ACU);
          await importTempRemove_ACU(STORAGE_KEY_IMPORTED_STATUS_SUMMARY_ACU);
          await importTempRemove_ACU(STORAGE_KEY_IMPORTED_STATUS_FULL_ACU);
          if (notify && entriesExist) showToastr_ACU('success', '已成功清除导入暂存缓存（IndexedDB）。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
          else if (notify && !entriesExist) showToastr_ACU('info', '没有需要清除的导入暂存缓存。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
          logDebug_ACU('[外部导入] Cleared imported txt entries and status from temp storage (IndexedDB preferred).');
          // Update the UI to reflect the change
          if (typeof updateImportStatusUI_ACU === 'function') {
              void updateImportStatusUI_ACU();
          }
          return true;
      } catch(error) {
          logError_ACU('[外部导入] Failed to clear import temp storage:', error);
          if (notify) showToastr_ACU('error', '清除导入缓存时出错。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
          return false;
      }
  }

  async function clearImportedEntries_ACU(notify = true) {
    const targetLorebook = await getInjectionTargetLorebook_ACU();
    if (!targetLorebook) {
        showToastr_ACU('error', '无法清除导入条目：未设置数据注入目标。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
        return;
    }

    try {
        const allEntries = await TavernHelper_API_ACU.getLorebookEntries(targetLorebook);
        
        const prefixesToDelete = [
            '外部导入-', // Catches all new prefixed entries
            'TavernDB-ACU-ImportedJsonData', // Catches the non-prefixed JSON backup for safety
            IMPORTED_ENTRY_PREFIX_ACU // Catches old raw txt entries
        ];

        const uidsToDelete = allEntries
            .filter(entry => entry.comment && prefixesToDelete.some(prefix => entry.comment.startsWith(prefix)))
            .map(entry => entry.uid);

        if (uidsToDelete.length > 0) {
            await TavernHelper_API_ACU.deleteLorebookEntries(targetLorebook, uidsToDelete);
            logDebug_ACU(`Successfully deleted ${uidsToDelete.length} imported txt entries.`);
            if (notify) showToastr_ACU('success', `成功清除了 ${uidsToDelete.length} 个导入条目。`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
        } else {
            if (notify) showToastr_ACU('info', '没有找到可清除的已注入世界书条目。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
        }
        // [重构] 调用新的函数来只清除本地存储，而不是在这里重复逻辑
        await clearImportLocalStorage_ACU(false); // notify=false 因为我们已经在上面或下面提供了反馈
    } catch(error) {
        logError_ACU('Failed to delete imported lorebook entries:', error);
        if (notify) showToastr_ACU('error', '清除导入条目时出错。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
    }
  }

  // [新增] 删除外部导入注入的世界书条目
  async function deleteImportedEntries_ACU() {
      const targetLorebook = await getImportWorldbookTarget_ACU();
      if (!targetLorebook) {
          showToastr_ACU('error', '无法删除注入条目：未设置导入数据注入目标世界书。');
          return;
      }

      try {
          const allEntries = await TavernHelper_API_ACU.getLorebookEntries(targetLorebook);
          
          // [修改] 根据隔离标识代码删除对应的条目
          const IMPORT_PREFIX = '外部导入-';
          const isoPrefix = getIsolationPrefix_ACU(); // 获取当前的隔离前缀 (例如 "ACU-[code]-" 或 "")
          
          const uidsToDelete = allEntries
              .filter(entry => {
                  if (!entry.comment) return false;
                  
                  if (settings_ACU.dataIsolationEnabled) {
                      // 开启隔离：只删除带有当前隔离前缀的条目
                      // 目标格式：ACU-[code]-外部导入-...
                      return entry.comment.startsWith(isoPrefix + IMPORT_PREFIX);
                  } else {
                      // 关闭隔离：只删除没有隔离前缀的条目 (即以 "外部导入-" 开头，但不以 "ACU-[" 开头)
                      if (entry.comment.startsWith('ACU-[')) return false;
                      return entry.comment.startsWith(IMPORT_PREFIX);
                  }
              })
              .map(entry => entry.uid);

          if (uidsToDelete.length > 0) {
              await TavernHelper_API_ACU.deleteLorebookEntries(targetLorebook, uidsToDelete);
              logDebug_ACU(`Successfully deleted ${uidsToDelete.length} imported entries from ${targetLorebook} (Isolation: ${settings_ACU.dataIsolationEnabled}).`);
              showToastr_ACU('success', `成功删除了 ${uidsToDelete.length} 个外部导入注入的条目。`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
          } else {
              showToastr_ACU('info', `在世界书 "${targetLorebook}" 中没有找到符合当前标识的外部导入条目。`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
          }
      } catch(error) {
          logError_ACU('Failed to delete imported entries:', error);
          showToastr_ACU('error', '删除注入条目时出错。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
    }
  }

  // --- [新增] 外部导入功能 ---
  