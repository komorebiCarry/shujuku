  // [新增] 填充注入目标选择器
  async function populateInjectionTargetSelector_ACU() {
      if (!$popupInstance_ACU) return;
      const $select = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target`);
      $select.empty();
      try {
          const bookNames = await getWorldbookNames_ACU();
          // 添加默认选项
          $select.append(`<option value="character">角色卡绑定世界书</option>`);
          bookNames.forEach(bookName => {
              $select.append(`<option value="${escapeHtml_ACU(bookName)}">${escapeHtml_ACU(bookName)}</option>`);
          });
          // 设置当前选中的值
          const worldbookConfig = getCurrentWorldbookConfig_ACU();
          $select.val(worldbookConfig.injectionTarget || 'character');
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target-filter`);
              if ($filter.length) applyWorldbookSelectFilter_ACU($select, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('Failed to populate injection target selector:', error);
          $select.append('<option value="character">加载列表失败</option>');
      }
  }

  // [新增] 辅助函数：检查条目是否包含屏蔽词
  function isEntryBlocked_ACU(entry) {
      if (!entry) return false;
      const blockedKeywords = ["规则", "思维链", "cot", "MVU", "mvu", "变量", "状态", "Status", "Rule", "rule", "检定", "判断", "叙事", "文风", "InitVar", "格式"];
      const name = entry.comment || entry.name || ''; // In ST, 'comment' is often the display name
      return blockedKeywords.some(keyword => name.includes(keyword));
  }

  const WORLDBOOK_ENTRY_LAZY_PAGE_SIZE_ACU = 80;

  function buildWorldbookEntryCheckboxId_ACU(prefix, bookName, uid) {
      const safePrefix = String(prefix || 'wb-entry').replace(/[^a-zA-Z0-9_-]+/g, '-');
      const safeBook = String(bookName || 'book')
          .replace(/[^a-zA-Z0-9_-]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .slice(0, 48) || 'book';
      return `${safePrefix}-${safeBook}-${uid}`;
  }

  function createLazyWorldbookEntryViewState_ACU(groups = [], options = {}) {
      const normalizedGroups = (Array.isArray(groups) ? groups : []).map(group => ({
          bookName: String(group?.bookName || ''),
          entries: Array.isArray(group?.entries) ? group.entries.map(entry => ({ ...entry })) : [],
          filteredEntries: null,
          loadedCount: 0,
          expanded: group?.expanded === true,
          expandedBeforeFilter: undefined,
      })).filter(group => group.bookName);

      return {
          groups: normalizedGroups,
          pageSize: Number(options?.pageSize) > 0 ? Number(options.pageSize) : WORLDBOOK_ENTRY_LAZY_PAGE_SIZE_ACU,
          checkboxIdPrefix: String(options?.checkboxIdPrefix || 'wb-entry'),
          emptyText: options?.emptyText || '<em>所选世界书中无条目。</em>',
          emptyGroupText: options?.emptyGroupText || '<em>当前分组没有可显示的条目。</em>',
          isFiltering: false,
      };
  }

  function getLazyWorldbookEntrySource_ACU(group) {
      if (!group) return [];
      if (Array.isArray(group.filteredEntries)) return group.filteredEntries;
      return Array.isArray(group.entries) ? group.entries : [];
  }

  function findLazyWorldbookEntryGroupState_ACU($list, bookName) {
      if (!$list || !$list.length) return null;
      const state = $list.data('acuLazyWorldbookState');
      if (!state || !Array.isArray(state.groups)) return null;
      return state.groups.find(group => String(group.bookName) === String(bookName)) || null;
  }

  function findLazyWorldbookEntryGroupElement_ACU($list, bookName) {
      if (!$list || !$list.length) return jQuery_API_ACU();
      return $list.find('.qrf_worldbook_entry_group').filter(function() {
          return String(jQuery_API_ACU(this).data('book-name') || '') === String(bookName);
      }).first();
  }

  function updateLazyWorldbookEntryGroupMeta_ACU($list, bookName) {
      if (!$list || !$list.length) return;
      const state = $list.data('acuLazyWorldbookState');
      const group = findLazyWorldbookEntryGroupState_ACU($list, bookName);
      const $group = findLazyWorldbookEntryGroupElement_ACU($list, bookName);
      if (!state || !group || !$group.length) return;

      const sourceEntries = getLazyWorldbookEntrySource_ACU(group);
      const loadedCount = Math.min(group.loadedCount || 0, sourceEntries.length);
      const metaText = sourceEntries.length === 0
          ? '0 条'
          : (loadedCount < sourceEntries.length ? `已加载 ${loadedCount} / ${sourceEntries.length} 条` : `共 ${sourceEntries.length} 条`);

      $group.find('.qrf_worldbook_entry_group_meta').text(metaText);
      $group.find('.qrf_worldbook_entry_toggle').text(group.expanded ? '收起' : '展开');
      $group.find('.qrf_worldbook_entry_group_body').toggle(group.expanded);
      $group.find('.qrf_worldbook_entry_group_footer').toggle(group.expanded && sourceEntries.length > 0);
      $group.find('.qrf_worldbook_entry_load_more').toggle(group.expanded && loadedCount < sourceEntries.length);
  }

  function renderLazyWorldbookEntryItems_ACU($list, bookName, options = {}) {
      if (!$list || !$list.length) return;
      const state = $list.data('acuLazyWorldbookState');
      const group = findLazyWorldbookEntryGroupState_ACU($list, bookName);
      const $group = findLazyWorldbookEntryGroupElement_ACU($list, bookName);
      if (!state || !group || !$group.length) return;

      const sourceEntries = getLazyWorldbookEntrySource_ACU(group);
      if (options.reset === true) {
          group.loadedCount = 0;
      }

      const nextCount = options.renderAll === true
          ? sourceEntries.length
          : Math.min(sourceEntries.length, (group.loadedCount || 0) + state.pageSize);
      group.loadedCount = nextCount;

      const visibleEntries = sourceEntries.slice(0, nextCount);
      const html = visibleEntries.length > 0
          ? visibleEntries.map(entry => {
              const checkboxId = entry.checkboxId || buildWorldbookEntryCheckboxId_ACU(state.checkboxIdPrefix, entry.bookName || bookName, entry.uid);
              const labelText = entry.label || `条目 ${entry.uid}`;
              const disabledStyle = entry.disabled ? 'style="opacity:0.6; text-decoration: line-through;"' : '';
              return `
                  <div class="qrf_worldbook_entry_item" data-book-name="${escapeHtml_ACU(String(entry.bookName || bookName))}" data-entry-uid="${escapeHtml_ACU(String(entry.uid ?? ''))}">
                      <input type="checkbox" id="${escapeHtml_ACU(String(checkboxId))}" data-book="${escapeHtml_ACU(String(entry.bookName || bookName))}" data-uid="${escapeHtml_ACU(String(entry.uid ?? ''))}" ${entry.checked ? 'checked' : ''} ${entry.disabled ? 'disabled' : ''}>
                      <label for="${escapeHtml_ACU(String(checkboxId))}" ${disabledStyle}>${escapeHtml_ACU(String(labelText))}</label>
                  </div>`;
          }).join('')
          : state.emptyGroupText;

      $group.find('.qrf_worldbook_entry_group_body').html(html);
      updateLazyWorldbookEntryGroupMeta_ACU($list, bookName);
  }

  function renderLazyWorldbookEntryList_ACU($list, groups, options = {}) {
      if (!$list || !$list.length) return;
      const state = createLazyWorldbookEntryViewState_ACU(groups, options);
      $list.data('acuLazyWorldbookState', state);

      if (!state.groups.length) {
          $list.html(state.emptyText);
          return;
      }

      const html = state.groups.map(group => `
          <div class="qrf_worldbook_entry_group" data-book-name="${escapeHtml_ACU(group.bookName)}" style="margin-bottom: 8px;">
              <div class="qrf_worldbook_entry_header" data-book-name="${escapeHtml_ACU(group.bookName)}" style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px; font-weight: bold; border-bottom: 1px solid; padding-bottom: 4px;">
                  <button type="button" class="qrf_worldbook_entry_toggle button" style="padding: 2px 8px; font-size: 0.8em;">${group.expanded ? '收起' : '展开'}</button>
                  <span class="qrf_worldbook_entry_header_text" style="flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml_ACU(group.bookName)}</span>
                  <span class="qrf_worldbook_entry_group_meta" style="font-weight: normal; font-size: 0.85em; color: var(--text_secondary);"></span>
              </div>
              <div class="qrf_worldbook_entry_group_body" style="display: ${group.expanded ? 'block' : 'none'};"></div>
              <div class="qrf_worldbook_entry_group_footer" style="display: ${group.expanded ? 'block' : 'none'}; margin-top: 6px;">
                  <button type="button" class="qrf_worldbook_entry_load_more button" style="padding: 2px 8px; font-size: 0.8em; display: none;">继续加载</button>
              </div>
          </div>`).join('');

      $list.html(html);
      state.groups.forEach(group => {
          if (group.expanded) {
              renderLazyWorldbookEntryItems_ACU($list, group.bookName, { reset: true });
          } else {
              updateLazyWorldbookEntryGroupMeta_ACU($list, group.bookName);
          }
      });
  }

  function toggleLazyWorldbookEntryGroup_ACU($list, bookName, expanded = null) {
      if (!$list || !$list.length) return;
      const group = findLazyWorldbookEntryGroupState_ACU($list, bookName);
      if (!group) return;
      const nextExpanded = (typeof expanded === 'boolean') ? expanded : !group.expanded;
      group.expanded = nextExpanded;
      if (group.expanded && (group.loadedCount || 0) === 0) {
          renderLazyWorldbookEntryItems_ACU($list, bookName, { reset: true });
      } else {
          updateLazyWorldbookEntryGroupMeta_ACU($list, bookName);
      }
  }

  function updateLazyWorldbookEntryCheckedState_ACU($list, bookName, uid, checked) {
      const group = findLazyWorldbookEntryGroupState_ACU($list, bookName);
      if (!group) return;
      const syncCheckedState = entries => {
          if (!Array.isArray(entries)) return;
          entries.forEach(entry => {
              if (String(entry?.uid) === String(uid)) {
                  entry.checked = checked;
              }
          });
      };
      syncCheckedState(group.entries);
      syncCheckedState(group.filteredEntries);
  }

  function applyLazyWorldbookEntryFilter_ACU($list, rawQuery) {
      if (!$list || !$list.length) return false;
      const state = $list.data('acuLazyWorldbookState');
      if (!state || !Array.isArray(state.groups)) return false;

      const q = normalizeFilterText_ACU(rawQuery);
      const wasFiltering = state.isFiltering === true;

      if (q && !wasFiltering) {
          state.groups.forEach(group => {
              group.expandedBeforeFilter = group.expanded;
          });
      }

      if (!q) {
          state.isFiltering = false;
          state.groups.forEach(group => {
              group.filteredEntries = null;
              group.loadedCount = 0;
              if (typeof group.expandedBeforeFilter === 'boolean') {
                  group.expanded = group.expandedBeforeFilter;
              }
              group.expandedBeforeFilter = undefined;
              const $group = findLazyWorldbookEntryGroupElement_ACU($list, group.bookName);
              if ($group.length) $group.show();
              if (group.expanded) {
                  renderLazyWorldbookEntryItems_ACU($list, group.bookName, { reset: true });
              } else {
                  updateLazyWorldbookEntryGroupMeta_ACU($list, group.bookName);
              }
          });
          return true;
      }

      state.isFiltering = true;
      state.groups.forEach(group => {
          const bookText = String(group.bookName || '').toLowerCase();
          if (bookText.includes(q)) {
              group.filteredEntries = Array.isArray(group.entries) ? group.entries.slice() : [];
          } else {
              group.filteredEntries = (Array.isArray(group.entries) ? group.entries : []).filter(entry => {
                  const hay = String(entry.searchText || entry.label || `条目 ${entry.uid}`).toLowerCase();
                  return hay.includes(q);
              });
          }

          const sourceEntries = getLazyWorldbookEntrySource_ACU(group);
          const $group = findLazyWorldbookEntryGroupElement_ACU($list, group.bookName);
          group.loadedCount = 0;
          group.expanded = sourceEntries.length > 0;
          if ($group.length) $group.toggle(sourceEntries.length > 0);
          if (sourceEntries.length > 0) {
              renderLazyWorldbookEntryItems_ACU($list, group.bookName, { reset: true });
          } else {
              updateLazyWorldbookEntryGroupMeta_ACU($list, group.bookName);
          }
      });
      return true;
  }

  // =========================
  // [UI] 世界书筛选工具：注入目标(select) / 手动选择(list) / 条目列表(entry list)
  // =========================
  function normalizeFilterText_ACU(v) {
      return String(v ?? '').trim().toLowerCase();
  }

  function applyWorldbookSelectFilter_ACU($select, rawQuery) {
      if (!$select || !$select.length) return;
      const q = normalizeFilterText_ACU(rawQuery);
      const currentVal = String($select.val() ?? '');
      $select.find('option').each(function() {
          const val = String(jQuery_API_ACU(this).attr('value') ?? '');
          const text = String(jQuery_API_ACU(this).text() ?? '');
          const hay = (val + ' ' + text).toLowerCase();
          const match = (!q) || hay.includes(q);
          const keepSelected = (val === currentVal);
          this.hidden = !(match || keepSelected);
      });
  }

  function applyWorldbookListFilter_ACU($listContainer, rawQuery) {
      if (!$listContainer || !$listContainer.length) return;
      const q = normalizeFilterText_ACU(rawQuery);
      $listContainer.find('.qrf_worldbook_list_item').each(function() {
          const $it = jQuery_API_ACU(this);
          const name = String($it.data('book-name') || $it.text() || '').toLowerCase();
          $it.toggle(!q || name.includes(q));
      });
  }

  function applyWorldbookEntryFilter_ACU($entryList, rawQuery) {
      if (!$entryList || !$entryList.length) return;
      if (applyLazyWorldbookEntryFilter_ACU($entryList, rawQuery)) return;

      const q = normalizeFilterText_ACU(rawQuery);
      const $items = $entryList.find('.qrf_worldbook_entry_item');
      const $headers = $entryList.find('.qrf_worldbook_entry_header');

      if (!q) {
          $items.show();
          $headers.show();
          return;
      }

      const matchedBooks = new Set();
      $items.each(function() {
          const $row = jQuery_API_ACU(this);
          const $cb = $row.find('input[type="checkbox"]');
          const book = String($cb.data('book') || '');
          const labelText = String($row.find('label').text() || '').toLowerCase();
          const bookText = book.toLowerCase();
          const match = labelText.includes(q) || bookText.includes(q);
          $row.toggle(match);
          if (match) matchedBooks.add(book);
      });

      $headers.each(function() {
          const $h = jQuery_API_ACU(this);
          const book = String($h.data('book-name') || $h.text() || '');
          const bookText = book.toLowerCase();
          const match = bookText.includes(q) || matchedBooks.has(book);
          $h.toggle(match);
      });
  }

  // [新增] 填充外部导入专用的世界书选择器
  async function populateImportWorldbookTargetSelector_ACU() {
      if (!$popupInstance_ACU) return;
      const $select = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target`);
      if (!$select.length) return;
      $select.empty();
      try {
          const bookNames = await getWorldbookNames_ACU();
          // 只添加世界书选项，不添加角色卡绑定和常规更新目标选项
          bookNames.forEach(bookName => {
              $select.append(`<option value="${escapeHtml_ACU(bookName)}">${escapeHtml_ACU(bookName)}</option>`);
          });
          // 设置当前选中的值
          $select.val(settings_ACU.importWorldbookTarget || '');
          // 应用筛选（若存在）
          try {
              const $filter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target-filter`);
              if ($filter.length) applyWorldbookSelectFilter_ACU($select, $filter.val());
          } catch (e) {}
      } catch (error) {
          logError_ACU('Failed to populate import worldbook target selector:', error);
      }
  }
