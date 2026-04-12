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
  // [已迁移到 service/import/import-process.ts] getImportWorldbookTarget_ACU

  function getImportJsonStorageComment_ACU(modeSuffix = '-Selected') {
      const IMPORT_PREFIX = '外部导入-';
      return `${IMPORT_PREFIX}TavernDB-ACU-ImportedJsonData${modeSuffix}`;
  }

  // [已迁移到 service/import/import-process.ts] loadImportedJsonDataFromLorebook_ACU

  // [已迁移到 service/import/import-process.ts] saveImportedJsonDataToLorebook_ACU

  // [已迁移到 service/import/import-process.ts] deleteImportedJsonDataFromLorebook_ACU
