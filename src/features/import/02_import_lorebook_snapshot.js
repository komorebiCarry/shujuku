  async function updateImportStatusUI_ACU() {
      if (!$popupInstance_ACU) return;
      const $statusDisplay = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-status`);
      const $injectButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-inject-imported-txt-button`);
      
      const savedEntriesJson = await importTempGet_ACU(STORAGE_KEY_IMPORTED_ENTRIES_ACU);
      const savedStatusJson = await importTempGet_ACU(STORAGE_KEY_IMPORTED_STATUS_ACU);

      if (savedEntriesJson) {
          try {
              const chunks = JSON.parse(savedEntriesJson);
              if (Array.isArray(chunks) && chunks.length > 0) {
                  // 同步渲染一次表选择器（防止模板/数据变更后列表不刷新）
                  if ($importTableSelector_ACU) renderImportTableSelector_ACU();

                  const currentSelection = getImportSelectionFromUI_ACU();
                  const selectionSig = JSON.stringify(currentSelection || []);

                  if (settings_ACU.hasImportTableSelection && (!currentSelection || currentSelection.length === 0)) {
                      $statusDisplay.text('状态：未选择任何表格，无法注入。').css('color', 'salmon');
                      $injectButton.text('2. 注入（自选表格）').prop('disabled', true);
                      return;
                      }

                  let status = null;
                  if (savedStatusJson) {
                      try { status = JSON.parse(savedStatusJson); } catch (e) { status = null; }
                  }

                  const canResume =
                      status &&
                      typeof status.total === 'number' &&
                      status.total === chunks.length &&
                      typeof status.currentIndex === 'number' &&
                      status.currentIndex < status.total &&
                      (typeof status.selectionSig === 'undefined' || status.selectionSig === selectionSig);

                  if (canResume) {
                      $statusDisplay.text(`状态：已暂停，完成 ${status.currentIndex}/${status.total}。`).css('color', 'orange');
                      $injectButton.text('继续注入（自选表格）').prop('disabled', false);
                      } else {
                  $statusDisplay.text(`状态：已准备好 ${chunks.length} 个条目可供注入。`).css('color', 'lightgreen');
                      $injectButton.text('2. 注入（自选表格）').prop('disabled', false);
                  }
                  return;
              }
          } catch(e) {
             await importTempRemove_ACU(STORAGE_KEY_IMPORTED_ENTRIES_ACU);
             await importTempRemove_ACU(STORAGE_KEY_IMPORTED_STATUS_ACU);
          }
      }
      
      $statusDisplay.text('状态：尚未加载文件。').css('color', '');
      $injectButton.text('2. 注入（自选表格）').prop('disabled', true);
  }

  // [新增] 获取导入专用的世界书目标
  async function getImportWorldbookTarget_ACU() {
      // 优先使用 UI 当前选择（不落盘），以便在“完成后解除绑定”的策略下，“删除外部导入条目”仍可用
      try {
          if ($popupInstance_ACU) {
              const $select = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target`);
              const v = ($select && $select.length) ? String($select.val() || '').trim() : '';
              if (v) return v;
          }
      } catch (e) { /* ignore */ }

      // 回退：旧逻辑（从设置读取）
      if (settings_ACU.importWorldbookTarget) return settings_ACU.importWorldbookTarget;
      return null;
  }

  function getImportJsonStorageComment_ACU(modeSuffix = '-Selected') {
      const IMPORT_PREFIX = '外部导入-';
      return `${IMPORT_PREFIX}TavernDB-ACU-ImportedJsonData${modeSuffix}`;
  }

  async function loadImportedJsonDataFromLorebook_ACU(targetLorebook, modeSuffix = '-Selected') {
      if (!TavernHelper_API_ACU || !targetLorebook) return null;
      const jsonStorageComment = getImportJsonStorageComment_ACU(modeSuffix);
      const allEntries = await TavernHelper_API_ACU.getLorebookEntries(targetLorebook);
      const existingEntry = allEntries.find(entry => entry.comment === jsonStorageComment);
      if (!existingEntry || !existingEntry.content) return null;
      try {
          return JSON.parse(existingEntry.content);
      } catch (error) {
          logError_ACU('[外部导入] Failed to parse ImportedJsonData source entry:', error);
          return null;
      }
  }

  async function saveImportedJsonDataToLorebook_ACU(targetLorebook, jsonData, modeSuffix = '-Selected') {
      if (!TavernHelper_API_ACU || !targetLorebook || !jsonData) return false;
      const jsonStorageComment = getImportJsonStorageComment_ACU(modeSuffix);
      const allEntries = await TavernHelper_API_ACU.getLorebookEntries(targetLorebook);
      const usedOrders = buildUsedOrderSet_ACU(allEntries);
      const existingEntry = allEntries.find(entry => entry.comment === jsonStorageComment);
      const finalJsonString = JSON.stringify(jsonData, null, 2);
      const newEntryData = {
          comment: jsonStorageComment,
          content: finalJsonString,
          keys: [`TavernDB-ACU-ImportedJson-Key${modeSuffix}`],
          enabled: false,
          type: 'keyword',
          order: existingEntry?.order ?? allocOrder_ACU(usedOrders, 10000, 1, 99999),
          prevent_recursion: true,
      };

      if (existingEntry) {
          await TavernHelper_API_ACU.setLorebookEntries(targetLorebook, [{ ...newEntryData, uid: existingEntry.uid }]);
          logDebug_ACU('[外部导入] Updated ImportedJsonData source entry in target lorebook.');
      } else {
          await TavernHelper_API_ACU.createLorebookEntries(targetLorebook, [newEntryData]);
          logDebug_ACU('[外部导入] Created ImportedJsonData source entry in target lorebook.');
      }
      return true;
  }

  async function deleteImportedJsonDataFromLorebook_ACU(targetLorebook, modeSuffix = '-Selected') {
      if (!TavernHelper_API_ACU || !targetLorebook) return false;
      const jsonStorageComment = getImportJsonStorageComment_ACU(modeSuffix);
      const entriesNow = await TavernHelper_API_ACU.getLorebookEntries(targetLorebook);
      const jsonEntry = entriesNow.find(e => e.comment === jsonStorageComment);
      if (!jsonEntry) return false;
      await TavernHelper_API_ACU.deleteLorebookEntries(targetLorebook, [jsonEntry.uid]);
      return true;
  }
