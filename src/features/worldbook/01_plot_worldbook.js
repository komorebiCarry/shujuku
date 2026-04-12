  async function updateWorldbookSourceView_ACU() {
      if (!$popupInstance_ACU) return;
      const worldbookConfig = getCurrentWorldbookConfig_ACU();
      const source = worldbookConfig.source;
      const $manualBlock = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-manual-select-block`);
      if (source === 'manual') {
          $manualBlock.slideDown();
          await populateWorldbookList_ACU();
      } else {
          $manualBlock.slideUp();
      }
      await populateWorldbookEntryList_ACU();
  }

  // =========================
  // [剧情推进] 世界书选择 UI（独立于填表 worldbookConfig）
  // 复用现有加载逻辑，但使用不同的 DOM id 与不同的配置对象
  // =========================
  function getPlotWorldbookConfig_ACU() {
      if (!settings_ACU.plotSettings) settings_ACU.plotSettings = JSON.parse(JSON.stringify(DEFAULT_PLOT_SETTINGS_ACU));
      if (!settings_ACU.plotSettings.plotWorldbookConfig) {
          settings_ACU.plotSettings.plotWorldbookConfig = buildDefaultPlotWorldbookConfig_ACU();
      }
      return settings_ACU.plotSettings.plotWorldbookConfig;
  }

  async function updatePlotWorldbookSourceView_ACU() {
      if (!$popupInstance_ACU) return;
      const cfg = getPlotWorldbookConfig_ACU();
      const source = cfg.source;
      const $manualBlock = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-manual-select-block`);
      if (source === 'manual') {
          $manualBlock.slideDown();
          await populatePlotWorldbookList_ACU();
      } else {
          $manualBlock.slideUp();
      }
      await populatePlotWorldbookEntryList_ACU();
  }

  async function populatePlotWorldbookList_ACU() {
      if (!$popupInstance_ACU) return;
      const $listContainer = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select`);
      if (!$listContainer.length) return;
      $listContainer.empty().html('<em>正在加载...</em>');
      try {
          const bookNames = await getWorldbookNames_ACU();
          $listContainer.empty();
          if (bookNames.length === 0) {
              $listContainer.html('<em>未找到世界书</em>');
              return;
          }
          const cfg = getPlotWorldbookConfig_ACU();
          bookNames.forEach(bookName => {
              const isSelected = (cfg.manualSelection || []).includes(bookName);
              const itemHtml = `
                  <div class="qrf_worldbook_list_item ${isSelected ? 'selected' : ''}" data-book-name="${escapeHtml_ACU(bookName)}">
                      ${escapeHtml_ACU(bookName)}
                  </div>`;
              $listContainer.append(itemHtml);
          });
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-filter`);
              if ($filter.length) applyWorldbookListFilter_ACU($listContainer, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('[剧情推进] Failed to populate plot worldbook list:', error);
          $listContainer.html('<em>加载失败</em>');
      }
  }

  async function populatePlotWorldbookEntryList_ACU() {
      if (!$popupInstance_ACU) return;
      const $list = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-list`);
      if (!$list.length) return;
      $list.empty().html('<em>正在加载条目...</em>');

      const cfg = getPlotWorldbookConfig_ACU();
      const source = cfg.source;
      let bookNames = [];

      if (source === 'character') {
          const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
          if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
          if (charLorebooks.additional?.length) bookNames.push(...charLorebooks.additional);
      } else if (source === 'manual') {
          bookNames = cfg.manualSelection || [];
      }

      bookNames = [...new Set((Array.isArray(bookNames) ? bookNames : []).filter(Boolean))];
      if (bookNames.length === 0) {
          $list.html('<em>请先选择世界书或为角色绑定世界书。</em>');
          return;
      }

      try {
          if (!cfg.enabledEntries) cfg.enabledEntries = {};
          const entriesMap = await getLorebookEntriesByNames_ACU(bookNames);
          const groups = [];
          const expandByDefault = bookNames.length === 1;
          let settingsChanged = false;

          for (const bookName of bookNames) {
              const bookEntries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
              if (typeof cfg.enabledEntries[bookName] === 'undefined') {
                  // 默认启用时：仅对“非数据库生成条目”做默认勾选（数据库生成条目不在UI显示，也不需要用户勾选）
                  cfg.enabledEntries[bookName] = bookEntries
                      .filter(entry => {
                          const comment = entry?.comment || entry?.name || '';
                          let normalizedComment = String(comment).replace(/^ACU-\[[^\]]+\]-/, '');
                          normalizedComment = normalizedComment.replace(/^外部导入-(?:[^-]+-)?/, '');

                          // UI 不显示：数据库生成条目（含隔离/外部导入前缀），以及 OutlineTable
                          if (normalizedComment.startsWith('TavernDB-ACU-OutlineTable')) return false;
                          const isDbGenerated =
                              normalizedComment.startsWith('TavernDB-ACU-') ||
                              normalizedComment.startsWith('重要人物条目') ||
                              normalizedComment.startsWith('总结条目') ||
                              normalizedComment.startsWith('小总结条目');
                          if (isDbGenerated) return false;

                          if (isEntryBlocked_ACU(entry)) return false;
                          return true;
                      })
                      .map(entry => entry.uid);
                  settingsChanged = true;
              }

              const enabledEntries = Array.isArray(cfg.enabledEntries[bookName]) ? cfg.enabledEntries[bookName] : [];
              const visibleEntries = [];
              bookEntries.forEach(entry => {
                  const comment = entry?.comment || entry?.name || '';
                  let normalizedComment = String(comment).replace(/^ACU-\[[^\]]+\]-/, '');
                  normalizedComment = normalizedComment.replace(/^外部导入-(?:[^-]+-)?/, '');

                  // UI 不显示：数据库生成条目（含隔离/外部导入前缀），以及 OutlineTable
                  if (normalizedComment.startsWith('TavernDB-ACU-OutlineTable')) return;
                  const isDbGenerated =
                      normalizedComment.startsWith('TavernDB-ACU-') ||
                      normalizedComment.startsWith('重要人物条目') ||
                      normalizedComment.startsWith('总结条目') ||
                      normalizedComment.startsWith('小总结条目');
                  if (isDbGenerated) return;

                  if (isEntryBlocked_ACU(entry)) return;

                  visibleEntries.push({
                      uid: entry.uid,
                      bookName,
                      label: entry.comment || `条目 ${entry.uid}`,
                      searchText: `${bookName} ${entry.comment || entry.name || `条目 ${entry.uid}`}`,
                      checked: enabledEntries.includes(entry.uid),
                      disabled: !entry.enabled,
                      checkboxId: buildWorldbookEntryCheckboxId_ACU('plot-wb-entry', bookName, entry.uid),
                  });
              });

              if (visibleEntries.length > 0) {
                  groups.push({
                      bookName,
                      entries: visibleEntries,
                      expanded: expandByDefault,
                  });
              }
          }

          if (settingsChanged) {
              saveSettings_ACU();
          }
          renderLazyWorldbookEntryList_ACU($list, groups, {
              checkboxIdPrefix: 'plot-wb-entry',
              emptyText: '<em>所选世界书中无条目。</em>',
          });
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-filter`);
              if ($filter.length) applyWorldbookEntryFilter_ACU($list, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('[剧情推进] Failed to populate plot worldbook entry list:', error);
          $list.html('<em>加载条目失败。</em>');
      }
  }
