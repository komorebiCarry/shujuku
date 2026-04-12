  async function populateWorldbookList_ACU() {
      if (!$popupInstance_ACU) return;
      const $listContainer = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-select`);
      $listContainer.empty().html('<em>正在加载...</em>');
      try {
          const bookNames = await getWorldbookNames_ACU();
          $listContainer.empty();
          if (bookNames.length === 0) {
              $listContainer.html('<em>未找到世界书</em>');
              return;
          }
          const worldbookConfig = getCurrentWorldbookConfig_ACU();
          bookNames.forEach(bookName => {
              const isSelected = worldbookConfig.manualSelection.includes(bookName);
              const itemHtml = `
                  <div class="qrf_worldbook_list_item ${isSelected ? 'selected' : ''}" data-book-name="${escapeHtml_ACU(bookName)}">
                      ${escapeHtml_ACU(bookName)}
                  </div>`;
              $listContainer.append(itemHtml);
          });
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-select-filter`);
              if ($filter.length) applyWorldbookListFilter_ACU($listContainer, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('Failed to populate worldbook list:', error);
          $listContainer.html('<em>加载失败</em>');
      }
  }

  async function populateWorldbookEntryList_ACU() {
      if (!$popupInstance_ACU) return;
      const $list = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-list`);
      $list.empty().html('<em>正在加载条目...</em>');
      
      const worldbookConfig = getCurrentWorldbookConfig_ACU();
      const source = worldbookConfig.source;
      let bookNames = [];

      if (source === 'character') {
          const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
          if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
          if (charLorebooks.additional?.length) bookNames.push(...charLorebooks.additional);
      } else if (source === 'manual') {
          bookNames = worldbookConfig.manualSelection || [];
      }

      bookNames = [...new Set((Array.isArray(bookNames) ? bookNames : []).filter(Boolean))];
      if (bookNames.length === 0) {
          $list.html('<em>请先选择世界书或为角色绑定世界书。</em>');
          return;
      }

      try {
          if (!worldbookConfig.enabledEntries) worldbookConfig.enabledEntries = {};
          const entriesMap = await getLorebookEntriesByNames_ACU(bookNames);
          const groups = [];
          const expandByDefault = bookNames.length === 1;
          let settingsChanged = false; // Flag to check if we need to save settings
          for (const bookName of bookNames) {
              const bookEntries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
              // If no setting exists for this book, default to all entries enabled.
              if (typeof worldbookConfig.enabledEntries[bookName] === 'undefined') {
                  // [修改] 默认启用时，过滤掉自动生成的条目
                  worldbookConfig.enabledEntries[bookName] = bookEntries
                      .filter(entry => {
                          const comment = entry.comment || '';
                          // 过滤自动生成的条目
                          if (comment.startsWith('TavernDB-ACU-') || comment.startsWith('重要人物条目') || comment.startsWith('总结条目')) {
                              return false;
                          }
                          // [新增] 过滤屏蔽词条目
                          if (isEntryBlocked_ACU(entry)) {
                              return false;
                          }
                          return true;
                      })
                      .map(entry => entry.uid);
                  settingsChanged = true;
              }
              
              const enabledEntries = Array.isArray(worldbookConfig.enabledEntries[bookName]) ? worldbookConfig.enabledEntries[bookName] : [];
              const visibleEntries = [];
              bookEntries.forEach(entry => {
                  // [新增] 在UI列表显示时，也过滤掉自动生成的条目，不显示给用户
                  const comment = entry.comment || '';
                  if (comment.startsWith('TavernDB-ACU-') || comment.startsWith('重要人物条目') || comment.startsWith('总结条目')) {
                      return;
                  }

                  // [新增] 过滤屏蔽词条目，不显示在列表中
                  if (isEntryBlocked_ACU(entry)) {
                      return;
                  }

                  visibleEntries.push({
                      uid: entry.uid,
                      bookName,
                      label: entry.comment || `条目 ${entry.uid}`,
                      searchText: `${bookName} ${entry.comment || `条目 ${entry.uid}`}`,
                      checked: enabledEntries.includes(entry.uid),
                      disabled: !entry.enabled,
                      checkboxId: buildWorldbookEntryCheckboxId_ACU('wb-entry', bookName, entry.uid),
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
              checkboxIdPrefix: 'wb-entry',
              emptyText: '<em>所选世界书中无条目。</em>',
          });
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-filter`);
              if ($filter.length) applyWorldbookEntryFilter_ACU($list, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('Failed to populate worldbook entry list:', error);
          $list.html('<em>加载条目失败。</em>');
      }
  }

