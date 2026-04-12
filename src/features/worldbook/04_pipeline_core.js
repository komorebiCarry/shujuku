  async function loadAllChatMessages_ACU() {
    if (!coreApisAreReady_ACU || !TavernHelper_API_ACU) return;
    try {
      const lastMessageId = TavernHelper_API_ACU.getLastMessageId
        ? TavernHelper_API_ACU.getLastMessageId()
        : SillyTavern_API_ACU.chat?.length
        ? SillyTavern_API_ACU.chat.length - 1
        : -1;
      if (lastMessageId < 0) {
        allChatMessages_ACU = [];
        logDebug_ACU('No chat messages (ACU).');
        return;
      }
      const messagesFromApi = await TavernHelper_API_ACU.getChatMessages(`0-${lastMessageId}`, {
        include_swipes: false,
      });
      if (messagesFromApi && messagesFromApi.length > 0) {
        allChatMessages_ACU = messagesFromApi.map((msg, idx) => ({ ...msg, id: idx })); // Add simple index for now
        logDebug_ACU(`ACU Loaded ${allChatMessages_ACU.length} messages for: ${currentChatFileIdentifier_ACU}.`);
      } else {
        allChatMessages_ACU = [];
      }
    } catch (error) {
      logError_ACU('ACU获取聊天记录失败: ' + error.message);
      allChatMessages_ACU = [];
    }
  }

  // --- [新增] 世界书相关功能 ---

  async function getWorldbookNames_ACU() {
      if (TavernHelper_API_ACU && typeof TavernHelper_API_ACU.getLorebooks === 'function') {
          const bookNames = await Promise.resolve(TavernHelper_API_ACU.getLorebooks());
          return (Array.isArray(bookNames) ? bookNames : [])
              .map(name => String(name || '').trim())
              .filter(Boolean);
      }
      if (SillyTavern_API_ACU && typeof SillyTavern_API_ACU.getWorldBooks === 'function') {
          const books = await SillyTavern_API_ACU.getWorldBooks();
          return (Array.isArray(books) ? books : [])
              .map(book => String(book?.name || '').trim())
              .filter(Boolean);
      }
      return [];
  }

  async function getLorebookEntriesByNames_ACU(bookNames = []) {
      const uniqueNames = [...new Set((Array.isArray(bookNames) ? bookNames : []).map(name => String(name || '').trim()).filter(Boolean))];
      const entriesMap = {};
      const canUseTavernHelper = TavernHelper_API_ACU && typeof TavernHelper_API_ACU.getLorebookEntries === 'function';
      let fallbackBooks = null;

      if (!canUseTavernHelper && SillyTavern_API_ACU && typeof SillyTavern_API_ACU.getWorldBooks === 'function') {
          fallbackBooks = await SillyTavern_API_ACU.getWorldBooks();
      }

      for (const name of uniqueNames) {
          try {
              let entries = [];
              if (canUseTavernHelper) {
                  entries = await TavernHelper_API_ACU.getLorebookEntries(name);
              } else if (Array.isArray(fallbackBooks)) {
                  const matchedBook = fallbackBooks.find(book => book?.name === name);
                  entries = matchedBook?.entries || [];
              }
              entriesMap[name] = Array.isArray(entries) ? entries.map(entry => ({ ...entry, book: name })) : [];
          } catch (e) {
              logWarn_ACU(`[Worldbook] 获取世界书 "${name}" 条目失败（忽略该书，继续）：`, e);
              entriesMap[name] = [];
          }
      }
      return entriesMap;
  }

  async function getWorldBooks_ACU() {
      const bookNames = await getWorldbookNames_ACU();
      const entriesMap = await getLorebookEntriesByNames_ACU(bookNames);
      return bookNames.map(name => ({
          name,
          entries: Array.isArray(entriesMap[name]) ? entriesMap[name] : [],
      }));
  }

  function isImportTaggedLorebookEntry_ACU(entry) {
    const rawComment = String(entry?.comment || entry?.name || '').trim();
    if (!rawComment) return false;
    const normalizedComment = rawComment.replace(/^ACU-\[[^\]]+\]-/, '');
    return normalizedComment.startsWith(getImportStablePrefix_ACU());
  }

  function getWorldbookCommentInfo_ACU(entry) {
      const rawComment = String(entry?.comment || entry?.name || '').trim();
      let normalizedComment = rawComment.replace(/^ACU-\[[^\]]+\]-/, '');
      normalizedComment = normalizedComment.replace(/^外部导入-(?:[^-]+-)?/, '');
      return { rawComment, normalizedComment };
  }

  function getWorldbookEntryKeywords_ACU(entry) {
      const toStrArray = v => {
          if (Array.isArray(v)) return v.filter(x => typeof x === 'string' && x.trim());
          if (typeof v === 'string' && v.trim()) return [v];
          return [];
      };
      return [...new Set([...toStrArray(entry?.key), ...toStrArray(entry?.keys)])].map(k => k.toLowerCase());
  }

  function getWorldbookEntryPlaceholderSortKey_ACU(entry) {
      const position = normalizeLorebookPosition_ACU(entry?.position, 'at_depth_as_system');
      const order = getEntryOrderNumber_ACU(entry);
      const normalizedOrder = order === null ? Number.MAX_SAFE_INTEGER : order;
      const depthValue = typeof entry?.depth === 'number' ? entry.depth : parseInt(String(entry?.depth ?? ''), 10);
      const normalizedDepth = Number.isFinite(depthValue) ? depthValue : 0;

      if (position === 'before_character_definition') {
          return { segment: 0, depthRank: 0, order: normalizedOrder };
      }
      if (position === 'after_character_definition') {
          return { segment: 1, depthRank: 0, order: normalizedOrder };
      }
      return { segment: 2, depthRank: -normalizedDepth, order: normalizedOrder };
  }

  function compareWorldbookEntriesForPlaceholder_ACU(a, b) {
      const keyA = getWorldbookEntryPlaceholderSortKey_ACU(a);
      const keyB = getWorldbookEntryPlaceholderSortKey_ACU(b);

      if (keyA.segment !== keyB.segment) return keyA.segment - keyB.segment;
      if (keyA.depthRank !== keyB.depthRank) return keyA.depthRank - keyB.depthRank;
      if (keyA.order !== keyB.order) return keyA.order - keyB.order;

      const originalIndexA = Number.isFinite(a?._acuPlaceholderOriginalIndex) ? a._acuPlaceholderOriginalIndex : Number.MAX_SAFE_INTEGER;
      const originalIndexB = Number.isFinite(b?._acuPlaceholderOriginalIndex) ? b._acuPlaceholderOriginalIndex : Number.MAX_SAFE_INTEGER;
      if (originalIndexA !== originalIndexB) return originalIndexA - originalIndexB;

      const bookNameA = String(a?.bookName || '');
      const bookNameB = String(b?.bookName || '');
      if (bookNameA !== bookNameB) return bookNameA.localeCompare(bookNameB, 'zh-Hans-CN');

      const uidA = String(a?.uid ?? '');
      const uidB = String(b?.uid ?? '');
      return uidA.localeCompare(uidB, 'zh-Hans-CN');
  }

  async function buildCombinedWorldbookContentByStrategy_ACU(options = {}) {
      const logPrefix = String(options?.logPrefix || '[Worldbook]');
      const bookNames = [...new Set((Array.isArray(options?.bookNames) ? options.bookNames : []).map(name => String(name || '').trim()).filter(Boolean))];
      const includeEntry = typeof options?.includeEntry === 'function' ? options.includeEntry : () => true;
      const isSelected = typeof options?.isSelected === 'function' ? options.isSelected : () => true;
      const excludeDisabledEntries = options?.excludeDisabledEntries !== false;
      const includeConstantEntriesInBaseScan = options?.includeConstantEntriesInBaseScan === true;
      const formatEntry = typeof options?.formatEntry === 'function'
          ? options.formatEntry
          : (entry => `# ${entry.comment || `Entry from ${entry.bookName}`}\n${entry.content}`);
      const sortEntries = typeof options?.sortEntries === 'function' ? options.sortEntries : compareWorldbookEntriesForPlaceholder_ACU;

      if (bookNames.length === 0) {
          logWarn_ACU(`${logPrefix} 没有找到任何世界书，内容将为空`);
          return '';
      }

      const entriesMap = await getLorebookEntriesByNames_ACU(bookNames);
      let allEntries = [];
      let placeholderOriginalIndex = 0;
      for (const bookName of bookNames) {
          const bookEntries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
          logDebug_ACU(`${logPrefix} 世界书 "${bookName}" 条目数量:`, bookEntries.length);
          bookEntries.forEach(entry => {
              const { rawComment, normalizedComment } = getWorldbookCommentInfo_ACU(entry);
              const decoratedEntry = {
                  ...entry,
                  bookName,
                  rawComment,
                  normalizedComment,
                  _acuPlaceholderOriginalIndex: placeholderOriginalIndex++,
              };
              if (includeEntry(decoratedEntry) === false) return;
              allEntries.push(decoratedEntry);
          });
      }

      if (typeof options?.onEntriesFiltered === 'function') {
          try { options.onEntriesFiltered(allEntries); } catch (e) {}
      }
      if (allEntries.length === 0) {
          logDebug_ACU(`${logPrefix} 所选世界书在过滤后无可用条目。`);
          return '';
      }

      let userEnabledEntries = allEntries.filter(entry => (excludeDisabledEntries ? !!entry.enabled : true));
      userEnabledEntries = userEnabledEntries.filter(entry => isSelected(entry) !== false);
      if (typeof options?.onSelectedEntries === 'function') {
          try { options.onSelectedEntries(userEnabledEntries); } catch (e) {}
      }
      if (userEnabledEntries.length === 0) {
          logDebug_ACU(`${logPrefix} 当前配置下没有启用的世界书条目。`);
          return '';
      }

      let baseScanText = '';
      if (typeof options?.baseScanText === 'string' && options.baseScanText.trim()) {
          baseScanText = options.baseScanText;
      } else if (typeof options?.fallbackScanText === 'string' && options.fallbackScanText.trim()) {
          baseScanText = options.fallbackScanText;
      }
      baseScanText = baseScanText.toLowerCase();

      const constantEntries = userEnabledEntries.filter(entry => entry.type === 'constant');
      let keywordEntries = userEnabledEntries.filter(entry => entry.type !== 'constant');

      if (includeConstantEntriesInBaseScan) {
          const constantBaseText = constantEntries
              .filter(entry => !entry.prevent_recursion)
              .map(entry => entry.content || '')
              .join('\n')
              .toLowerCase();
          if (constantBaseText) {
              baseScanText = [baseScanText, constantBaseText].filter(Boolean).join('\n');
          }
      }

      const triggeredEntries = new Set([...constantEntries]);
      let recursionDepth = 0;
      const MAX_RECURSION_DEPTH = 10;

      while (recursionDepth < MAX_RECURSION_DEPTH) {
          recursionDepth++;
          let hasChangedInThisPass = false;

          const recursionSourceContent = Array.from(triggeredEntries)
              .filter(entry => !entry.prevent_recursion)
              .map(entry => entry.content)
              .join('\n')
              .toLowerCase();
          const fullSearchText = `${baseScanText}\n${recursionSourceContent}`;

          const remainingKeywordEntries = [];
          for (const entry of keywordEntries) {
              const keywords = getWorldbookEntryKeywords_ACU(entry);
              const isTriggered = keywords.length > 0 && keywords.some(keyword =>
                  entry.exclude_recursion ? baseScanText.includes(keyword) : fullSearchText.includes(keyword)
              );

              if (isTriggered) {
                  triggeredEntries.add(entry);
                  hasChangedInThisPass = true;
              } else {
                  remainingKeywordEntries.push(entry);
              }
          }

          if (!hasChangedInThisPass) {
              logDebug_ACU(`${logPrefix} Worldbook recursion stabilized after ${recursionDepth} passes.`);
              break;
          }

          keywordEntries = remainingKeywordEntries;
      }

      if (recursionDepth >= MAX_RECURSION_DEPTH) {
          logWarn_ACU(`${logPrefix} Worldbook recursion reached max depth of ${MAX_RECURSION_DEPTH}. Breaking loop.`);
      }

      let finalEntries = Array.from(triggeredEntries);
      if (sortEntries) {
          finalEntries = finalEntries.sort(sortEntries);
      }

      const finalContent = finalEntries
          .map(entry => formatEntry(entry))
          .filter(chunk => typeof chunk === 'string' && chunk.trim());

      if (finalContent.length === 0) {
          logDebug_ACU(`${logPrefix} No worldbook entries were ultimately triggered.`);
          return '';
      }

      const combinedContent = finalContent.join('\n\n').trim();
      logDebug_ACU(`${logPrefix} Combined worldbook content generated, length: ${combinedContent.length}. ${finalEntries.length} entries triggered.`);
      return combinedContent;
  }

  async function getCombinedWorldbookContent_ACU(initialScanTextOverride = '', options = {}) {
    logDebug_ACU('Starting to get combined worldbook content with advanced logic...');
    const worldbookConfig = getCurrentWorldbookConfig_ACU();
    const excludeImportTaggedEntries = options?.excludeImportTaggedEntries === true;

    if (!TavernHelper_API_ACU || !SillyTavern_API_ACU) {
        logWarn_ACU('[ACU] TavernHelper or SillyTavern API not available, cannot get worldbook content.');
        return '';
    }

    try {
        let bookNames = [];
        
        if (worldbookConfig.source === 'manual') {
            bookNames = worldbookConfig.manualSelection || [];
        } else { // 'character' mode
            try {
                const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
                if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
                if (charLorebooks.additional?.length) bookNames.push(...charLorebooks.additional);
            } catch (e) {
                logError_ACU('[Worldbook] 获取角色世界书失败:', e);
                return '';
            }
        }

        const enabledEntriesMap = worldbookConfig?.enabledEntries;
        const hasAnySelection = enabledEntriesMap && typeof enabledEntriesMap === 'object' && Object.keys(enabledEntriesMap).length > 0;
        return await buildCombinedWorldbookContentByStrategy_ACU({
            logPrefix: '[Worldbook]',
            bookNames,
            baseScanText: (typeof initialScanTextOverride === 'string' && initialScanTextOverride.trim()) ? initialScanTextOverride : '',
            fallbackScanText: allChatMessages_ACU.map(message => message.message).join('\n'),
            includeEntry: entry => {
                const comment = entry.comment || '';
                if (comment.startsWith('TavernDB-ACU-')) return false;
                if (comment.startsWith('重要人物条目')) return false;
                if (comment.startsWith('总结条目')) return false;
                if (excludeImportTaggedEntries && isImportTaggedLorebookEntry_ACU(entry)) return false;
                if (isEntryBlocked_ACU(entry)) return false;
                return true;
            },
            isSelected: entry => {
                if (!hasAnySelection) return true;
                const list = enabledEntriesMap?.[entry.bookName];
                if (typeof list === 'undefined') return true;
                if (!Array.isArray(list)) return true;
                return list.includes(entry.uid);
            },
            onEntriesFiltered: entries => {
                if (excludeImportTaggedEntries) {
                    logDebug_ACU(`[Worldbook][Import] Import prompt exclusion enabled. Remaining entries after excluding import-tagged lorebook items: ${entries.length}`);
                }
            },
        });

    } catch (error) {
        logError_ACU(`[ACU] An error occurred while processing worldbook logic:`, error);
        return ''; // Return empty string on error to prevent breaking the generation.
    }
  }
  // --- [新增] 世界书相关功能结束 ---
