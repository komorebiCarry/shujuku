  async function handleManualUpdate_ACU() {
      try {
        if (isAutoUpdatingCard_ACU) {
            showToastr_ACU('warning', '数据库更新正在进行中，请稍候...');
            return;
        }

        if (!coreApisAreReady_ACU) {
            showToastr_ACU('error', 'API未就绪。');
            return;
        }

        const apiIsConfigured = (settings_ACU.apiMode === 'custom' && (settings_ACU.apiConfig.useMainApi || (settings_ACU.apiConfig.url && settings_ACU.apiConfig.model))) || (settings_ACU.apiMode === 'tavern' && settings_ACU.tavernProfile);
        if (!apiIsConfigured) {
            showToastr_ACU('error', 'API未配置，无法更新数据库。');
            return;
        }

        collectManualExtraHint_ACU();

        // [修复] 在填表前先刷新数据，确保 currentJsonTableData_ACU 与聊天记录的指导表一致
        // 这解决了用户切换模板后回到聊天记录时，数据可能不一致的问题
        await loadAllChatMessages_ACU();
        await refreshMergedDataAndNotify_ACU();
        
        if (!currentJsonTableData_ACU) {
            showToastr_ACU('error', '数据库未加载。');
            return;
        }
        const liveChat = SillyTavern_API_ACU.chat;
        if (!liveChat || liveChat.length === 0) {
            showToastr_ACU('warning', '聊天记录为空，无法更新。');
            return;
        }

        const allAiMessageIndices = liveChat
            .map((msg, index) => !msg.is_user ? index : -1)
            .filter(index => index !== -1);

        if (allAiMessageIndices.length === 0) {
            showToastr_ACU('warning', '尚未检测到AI回复，无法执行手动更新。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE });
            return;
        }

        const targetKeys = getManualSelectionFromUI_ACU();
        if (!targetKeys.length) {
            showToastr_ACU('warning', '未选择需要更新的表格。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE });
            return;
        }

        // 手动更新强制使用UI参数，忽略模板参数
        const uiThreshold = settings_ACU.autoUpdateThreshold || 3;
        const uiBatchSize = settings_ACU.updateBatchSize || 3;
        const uiSkip = settings_ACU.skipUpdateFloors || 0;

        const effectiveAiIndices = uiSkip > 0 ? allAiMessageIndices.slice(0, -uiSkip) : allAiMessageIndices.slice();
        const contextScopeIndices = uiThreshold > 0 ? effectiveAiIndices.slice(-uiThreshold) : effectiveAiIndices;

        if (!contextScopeIndices.length) {
            showToastr_ACU('warning', '未找到可用的上下文进行手动更新，请检查阈值或跳过楼层设置。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE });
            return;
        }

        // 手动更新仍使用 UI 的上下文与批次设置，但按模板 groupId 拆成多组并发处理
        const templateData = parseTableTemplateJson_ACU({ stripSeedRows: true }) || {};
        const updateGroups = {};
        targetKeys.forEach(sheetKey => {
            const tableGroupId = Number.isFinite(templateData?.[sheetKey]?.updateConfig?.groupId)
                ? Math.trunc(templateData[sheetKey].updateConfig.groupId)
                : -1;
            const groupKey = `${tableGroupId}|${contextScopeIndices.join(',')}|${uiBatchSize}`;
            if (!updateGroups[groupKey]) {
                updateGroups[groupKey] = {
                    indices: contextScopeIndices,
                    batchSize: uiBatchSize,
                    groupId: tableGroupId,
                    sheetKeys: []
                };
            }
            updateGroups[groupKey].sheetKeys.push(sheetKey);
        });
        const groupKeys = Object.keys(updateGroups);

        isAutoUpdatingCard_ACU = true;
        for (const gKey of groupKeys) {
            const group = updateGroups[gKey];
            logDebug_ACU(`[Manual Parallel] Processing group update for groupId=${group.groupId}, sheets: ${group.sheetKeys.join(', ')}`);
            // 每组严格限制表格范围
            const success = await processUpdates_ACU(group.indices, 'manual_independent', {
                targetSheetKeys: group.sheetKeys,
                batchSize: group.batchSize
            });
            if (!success) {
                isAutoUpdatingCard_ACU = false;
                showToastr_ACU('error', '手动更新失败或被终止。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                return;
            }
            await loadAllChatMessages_ACU();
            await refreshMergedDataAndNotify_ACU();
        }
        isAutoUpdatingCard_ACU = false;
        showToastr_ACU('success', '手动更新完成！', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.TABLE_OK });
        if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
            updateCardUpdateStatusDisplay_ACU();
        }

        // [新增] 在手动更新全部完成后检测自动合并总结
        try {
            await checkAndTriggerAutoMergeSummary_ACU();
        } catch (e) {
            logWarn_ACU('自动合并总结检测失败:', e);
        }
      } finally {
          manualExtraHint_ACU = '';
          isAutoUpdatingCard_ACU = false;
          if ($manualUpdateCardButton_ACU) {
              $manualUpdateCardButton_ACU.prop('disabled', false).text('立即手动更新');
          }
      }
  }

  // [新增] 强制检查并清理角色卡绑定世界书中的残留数据
  async function enforceCleanupOfCharacterWorldbook_ACU() {
      // 延迟一段时间，确保其他操作完成
      await new Promise(resolve => setTimeout(resolve, 1500));

      const worldbookConfig = getCurrentWorldbookConfig_ACU();
      // 如果当前设置明确指定了注入目标不是 'character'（即不是绑定世界书）
      if (worldbookConfig && worldbookConfig.injectionTarget && worldbookConfig.injectionTarget !== 'character') {
          logDebug_ACU('Enforcing cleanup of character bound worldbook...');
          try {
              // 获取当前角色绑定的主世界书
              const charLorebook = await TavernHelper_API_ACU.getCurrentCharPrimaryLorebook();
              if (charLorebook) {
                  // 只有当绑定的世界书与当前配置的目标不同时才清理
                  // (虽然 injectionTarget !== 'character' 已经暗示了这点，但如果用户手动把 injectionTarget 填成了绑定世界书的名字，就要小心了)
                  if (charLorebook !== worldbookConfig.injectionTarget) {
                      logDebug_ACU(`Cleaning up bound worldbook "${charLorebook}" as target is "${worldbookConfig.injectionTarget}"`);
                      await deleteAllGeneratedEntries_ACU(charLorebook);
                  }
              }
          } catch (e) {
              logWarn_ACU('Failed to enforce cleanup of character worldbook:', e);
          }
      }
  }

  async function resetScriptStateForNewChat_ACU(chatFileName) {
    // 修复：当增量更新失败时，chatFileName 可能会暂时变为 null。
    // 之前的逻辑会清除数据库状态，导致“初始化失败”的错误。
    // 新逻辑：如果收到的 chatFileName 无效，则记录一个警告并忽略此事件，
    // 以保留当前的数据库状态，等待一个有效的 CHAT_CHANGED 事件。
    if (!chatFileName || typeof chatFileName !== 'string' || chatFileName.trim() === '' || chatFileName.trim() === 'null') {
        logWarn_ACU(`ACU: Received invalid chat file name: "${chatFileName}". This can happen after an update error. Ignoring event to preserve current state.`);
        // 保持当前状态不变，防止数据库被意外清除
        return;
    }

    logDebug_ACU(`ACU: Resetting script state for new chat: "${chatFileName}"`);
    
    // 直接使用有效的 chatFileName，不再需要调用 /getchatname 或其他回退逻辑。
    currentChatFileIdentifier_ACU = cleanChatName_ACU(chatFileName);

    // [FIX] Reload all settings to ensure template is not stale for new chats.
    // MUST be called AFTER setting currentChatFileIdentifier_ACU so it loads the correct character settings.
    loadSettings_ACU();

    allChatMessages_ACU = [];
    lastTotalAiMessages_ACU = 0; // 重置 AI 消息计数

    logDebug_ACU(
      `ACU: currentChatFileIdentifier FINAL set to: "${currentChatFileIdentifier_ACU}" (Source: CHAT_CHANGED event)`,
    );

    await loadAllChatMessages_ACU();
    applyTemplateScopeForCurrentChat_ACU();
    
    if ($popupInstance_ACU) {
      const $titleElement = $popupInstance_ACU.find('h2#updater-main-title-acu');
      if ($titleElement.length)
        $titleElement.html(`当前聊天：${escapeHtml_ACU(currentChatFileIdentifier_ACU || '未知')}`);
      if ($statusMessageSpan_ACU) $statusMessageSpan_ACU.text('准备就绪');
    }
    
    if (typeof updateCardUpdateStatusDisplay_ACU === 'function') updateCardUpdateStatusDisplay_ACU();

    // 统一走聊天记录加载链路。
    // 新开聊天开场白阶段（只有首条 AI、尚无用户消息）会被 shouldSuppressWorldbookInjection_ACU() 拦截，
    // 此时只清理旧世界书条目，不创建新的注入条目。
    await loadOrCreateJsonTableFromChatHistory_ACU();

  // [核心修复] 切换聊天时，强制刷新可视化编辑器数据
    // 这确保了无论编辑器是否打开（即是否绑定了事件），数据源都被更新，并且如果有监听者则触发
    // [优化] 增加短暂延迟，确保 DOM 渲染完成（尽管是数据层面的刷新）
    setTimeout(() => {
        jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data');
        logDebug_ACU('Triggered visualizer refresh on chat change (with delay).');
    }, 100);

    // [修复] 加载完成后，延迟检查并强制清理角色卡绑定世界书（如果设置了注入到其他目标）
    enforceCleanupOfCharacterWorldbook_ACU();
  }

  // [新增] 获取数据注入目标世界书的函数
  async function getInjectionTargetLorebook_ACU() {
      const worldbookConfig = getCurrentWorldbookConfig_ACU();
      const target = worldbookConfig.injectionTarget;
      if (target === 'character') {
          return await TavernHelper_API_ACU.getCurrentCharPrimaryLorebook();
      }
      return target; // 直接返回世界书名称
  }


  // [新增] 辅助函数：生成带隔离标识的条目前缀/注释
  function getIsolationPrefix_ACU() {
      if (settings_ACU.dataIsolationEnabled && settings_ACU.dataIsolationCode) {
          return `ACU-[${settings_ACU.dataIsolationCode}]-`;
      }
      return '';
  }

  const DEFAULT_ENTRY_PLACEMENT_ACU = Object.freeze({ position: 'at_depth_as_system', depth: 2, order: 10000 });
  const DEFAULT_EXTRA_INDEX_PLACEMENT_ACU = Object.freeze({ position: 'at_depth_as_system', depth: 2, order: 10010 });
  const DEFAULT_FIXED_PLACEMENT_ACU = Object.freeze({ position: 'at_depth_as_system', depth: 2, order: 99990 });
  const DEFAULT_FIXED_INDEX_PLACEMENT_ACU = Object.freeze({ position: 'at_depth_as_system', depth: 2, order: 99991 });

  function normalizeLorebookPosition_ACU(position, fallback = 'at_depth_as_system') {
      const raw = String(position ?? '').trim().toLowerCase();
      if (raw === 'at_depth_as_system' || raw === 'system') return 'at_depth_as_system';
      // [修复] 返回 API 期望的正确值：before_character_definition / after_character_definition
      // 而不是内部简写 before_char / after_char
      if (raw === 'before_char' || raw === 'before_character' || raw === 'before_character_definition' || raw === '0') return 'before_character_definition';
      if (raw === 'after_char' || raw === 'after_character' || raw === 'after_character_definition' || raw === '1') return 'after_character_definition';
      return fallback;
  }

  function normalizePlacementConfig_ACU(rawPlacement, fallbackPlacement) {
      const fallback = fallbackPlacement || DEFAULT_ENTRY_PLACEMENT_ACU;
      const source = (rawPlacement && typeof rawPlacement === 'object') ? rawPlacement : {};
      const depthRaw = parseInt(source.depth, 10);
      const orderRaw = parseInt(source.order, 10);
      return {
          position: normalizeLorebookPosition_ACU(source.position, fallback.position),
          depth: Number.isFinite(depthRaw) ? depthRaw : fallback.depth,
          order: Number.isFinite(orderRaw) ? orderRaw : fallback.order,
      };
  }

  function isSummaryTableName_ACU(name) {
      return String(name || '').trim() === '总结表';
  }

  function isOutlineTableName_ACU(name) {
      return String(name || '').trim() === '总体大纲';
  }

  function isImportantPersonsTableName_ACU(name) {
      return String(name || '').trim() === '重要人物表';
  }

  function isGlobalDataTableName_ACU(name) {
      const n = String(name || '').trim();
      return n === '全局数据表' || n === '全局表';
  }

  function getFixedPlacementDefaultsForTable_ACU(tableName) {
      const name = String(tableName || '').trim();
      if (isSummaryTableName_ACU(name)) {
          return {
              entry: { position: 'at_depth_as_system', depth: 9999, order: 99987 },
              index: { position: 'at_depth_as_system', depth: 9999, order: 99988 },
          };
      }
      if (isOutlineTableName_ACU(name)) {
          return {
              entry: { position: 'at_depth_as_system', depth: 9998, order: 99985 },
              index: { position: 'at_depth_as_system', depth: 9998, order: 99986 },
          };
      }
      if (isImportantPersonsTableName_ACU(name)) {
          return {
              entry: { position: 'at_depth_as_system', depth: 10000, order: 99983 },
              index: { position: 'at_depth_as_system', depth: 10000, order: 99984 },
          };
      }
      if (isGlobalDataTableName_ACU(name)) {
          return {
              // [修复] 使用 API 期望的正确值 before_character_definition
              entry: { position: 'before_character_definition', depth: 2, order: 99981 },
              index: { position: 'before_character_definition', depth: 2, order: 99982 },
          };
      }
      return {
          entry: { ...DEFAULT_FIXED_PLACEMENT_ACU },
          index: { ...DEFAULT_FIXED_INDEX_PLACEMENT_ACU },
      };
  }

  function buildDefaultExportConfig_ACU(tableName = '') {
      const fixedDefaults = getFixedPlacementDefaultsForTable_ACU(tableName);
      return {
          enabled: false,
          splitByRow: false,
          entryName: tableName || '',
          entryType: 'constant',
          keywords: '',
          preventRecursion: true,
          injectionTemplate: '',
          extraIndexEnabled: false,
          extraIndexEntryName: `${tableName || '表格'}-索引`,
          extraIndexColumns: [],
          extraIndexColumnModes: {},
          extraIndexInjectionTemplate: '',
          entryPlacement: { ...DEFAULT_ENTRY_PLACEMENT_ACU },
          extraIndexPlacement: { ...DEFAULT_EXTRA_INDEX_PLACEMENT_ACU },
          fixedEntryPlacement: { ...fixedDefaults.entry },
          fixedIndexPlacement: { ...fixedDefaults.index },
      };
  }

  function buildDefaultGlobalInjectionConfig_ACU() {
      return {
          // [修复] 使用 API 期望的正确值 before_character_definition
          readableEntryPlacement: { position: 'before_character_definition', depth: 2, order: 99981 },
          wrapperPlacement: { position: 'before_character_definition', depth: 2, order: 99980 },
      };
  }

  function ensureGlobalInjectionConfigDefaults_ACU(rawConfig) {
      const base = buildDefaultGlobalInjectionConfig_ACU();
      const raw = (rawConfig && typeof rawConfig === 'object') ? rawConfig : {};
      return {
          readableEntryPlacement: normalizePlacementConfig_ACU(raw.readableEntryPlacement, base.readableEntryPlacement),
          wrapperPlacement: normalizePlacementConfig_ACU(raw.wrapperPlacement, base.wrapperPlacement),
      };
  }

  function getGlobalInjectionConfigFromData_ACU(dataObj, { ensureWriteBack = false } = {}) {
      const defaults = buildDefaultGlobalInjectionConfig_ACU();
      const cfg = ensureGlobalInjectionConfigDefaults_ACU(dataObj?.mate?.globalInjectionConfig);
      if (ensureWriteBack && dataObj && typeof dataObj === 'object') {
          if (!dataObj.mate || typeof dataObj.mate !== 'object') dataObj.mate = { type: 'chatSheets', version: 1 };
          dataObj.mate.globalInjectionConfig = cfg;
          if (!dataObj.mate.type) dataObj.mate.type = 'chatSheets';
          if (!Number.isFinite(dataObj.mate.version)) dataObj.mate.version = 1;
      }
      return {
          readableEntryPlacement: normalizePlacementConfig_ACU(cfg.readableEntryPlacement, defaults.readableEntryPlacement),
          wrapperPlacement: normalizePlacementConfig_ACU(cfg.wrapperPlacement, defaults.wrapperPlacement),
      };
  }

  function ensureExportConfigDefaults_ACU(exportConfig, tableName = '') {
      const base = buildDefaultExportConfig_ACU(tableName);
      const raw = (exportConfig && typeof exportConfig === 'object') ? exportConfig : {};
      const merged = { ...base, ...raw };
      merged.entryPlacement = normalizePlacementConfig_ACU(raw.entryPlacement, base.entryPlacement);
      merged.extraIndexPlacement = normalizePlacementConfig_ACU(raw.extraIndexPlacement, base.extraIndexPlacement);
      merged.fixedEntryPlacement = normalizePlacementConfig_ACU(raw.fixedEntryPlacement, base.fixedEntryPlacement);
      merged.fixedIndexPlacement = normalizePlacementConfig_ACU(raw.fixedIndexPlacement, base.fixedIndexPlacement);
      return merged;
  }

  function ensureSheetExportConfigDefaults_ACU(sheet) {
      if (!sheet || typeof sheet !== 'object') return buildDefaultExportConfig_ACU('');
      sheet.exportConfig = ensureExportConfigDefaults_ACU(sheet.exportConfig, sheet.name || sheet.uid || '');
      return sheet.exportConfig;
  }

  function applyPlacementToEntry_ACU(entry, placement) {
      if (!entry || typeof entry !== 'object') return entry;
      const p = normalizePlacementConfig_ACU(placement, DEFAULT_ENTRY_PLACEMENT_ACU);
      const out = { ...entry, position: p.position };
      if (p.position === 'at_depth_as_system') {
          out.depth = p.depth;
      } else {
          delete out.depth;
      }
      return out;
  }

  function isEntryPlacementMatched_ACU(entry, placement) {
      const p = normalizePlacementConfig_ACU(placement, DEFAULT_ENTRY_PLACEMENT_ACU);
      const ep = normalizeLorebookPosition_ACU(entry?.position, p.position);
      if (ep !== p.position) return false;
      if (p.position === 'at_depth_as_system') {
          const d = typeof entry?.depth === 'number' ? entry.depth : parseInt(String(entry?.depth ?? ''), 10);
          return Number.isFinite(d) && d === p.depth;
      }
      return true;
  }

  // =========================
  // [世界书] 注入位置：强制改为 @D 系统深度（避免默认“角色定义之前”）
  // 说明：
  // - 根据 TavernHelper 的 LorebookEntry 类型定义：
  //   - `position` 使用枚举值（非 @D 符号）
  //   - “@D 系统深度”对应 position='at_depth_as_system' 且 depth 为数字
  // - 仅用于：OutlineTable、总结条目(含外部导入)、MemoryStart/MemoryEnd
  // =========================
  function buildSystemDepthInjection_ACU(depth) {
      const d = parseInt(depth, 10);
      return {
          // @D⚙：系统身份 + 固定深度
          position: 'at_depth_as_system',
          depth: Number.isFinite(d) ? d : 2,
      };
  }

  function applySystemDepthInjection_ACU(entry, depth) {
      if (!entry || typeof entry !== 'object') return entry;
      return { ...entry, ...buildSystemDepthInjection_ACU(depth) };
  }

  function isSystemDepthInjected_ACU(entry, expectedDepth = null) {
      if (!entry || typeof entry !== 'object') return false;
      if (entry.position !== 'at_depth_as_system') return false;
      const d = typeof entry.depth === 'number' ? entry.depth : parseInt(String(entry.depth ?? ''), 10);
      if (!Number.isFinite(d)) return false;
      if (expectedDepth === null || expectedDepth === undefined) return true;
      const exp = parseInt(expectedDepth, 10);
      return Number.isFinite(exp) ? d === exp : true;
  }

  // [说明] 全局可读数据库条目注入位置
  // 原"@D 系统深度"已移除，改回"角色定义之前"（position: 0）
  // 仅重要人物/总结/大纲/记忆包裹保留 @D 系统层注入

  // =========================
  // [世界书] order(插入深度) 分配工具
  // 目标：
  // - 本插件创建的条目之间不重复
  // - 也不与世界书中“任何现有条目”的 order 重复
  // =========================
  function getEntryOrderNumber_ACU(entry) {
      const v = entry?.order;
      const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
      return Number.isFinite(n) ? n : null;
  }

  function buildUsedOrderSet_ACU(entries) {
      const used = new Set();
      if (!Array.isArray(entries)) return used;
      entries.forEach(e => {
          const n = getEntryOrderNumber_ACU(e);
          if (n !== null) used.add(n);
      });
      return used;
  }

  function findFirstFreeOrder_ACU(usedSet, preferred = 1, min = 1, max = 99999) {
      const used = usedSet instanceof Set ? usedSet : new Set();
      let start = parseInt(preferred, 10);
      if (!Number.isFinite(start)) start = min;
      if (start < min) start = min;
      if (start > max) start = max;

      for (let o = start; o <= max; o++) {
          if (!used.has(o)) return o;
      }
      for (let o = min; o < start; o++) {
          if (!used.has(o)) return o;
      }
      return null;
  }

  function allocOrder_ACU(usedSet, preferred = 1, min = 1, max = 99999) {
      const used = usedSet instanceof Set ? usedSet : new Set();
      const o = findFirstFreeOrder_ACU(used, preferred, min, max);
      if (o === null) throw new Error('无法分配可用的世界书条目 order（插入深度）');
      used.add(o);
      return o;
  }

  function allocConsecutiveOrderBlock_ACU(usedSet, blockSize, preferred = 1, min = 1, max = 99999) {
      const used = usedSet instanceof Set ? usedSet : new Set();
      const size = Math.max(1, parseInt(blockSize, 10) || 1);
      const maxStart = max - size + 1;

      const tryFrom = (start) => {
          for (let s = start; s <= maxStart; s++) {
              let ok = true;
              for (let i = 0; i < size; i++) {
                  if (used.has(s + i)) { ok = false; break; }
              }
              if (ok) return s;
          }
          return null;
      };

      let start = parseInt(preferred, 10);
      if (!Number.isFinite(start)) start = min;
      if (start < min) start = min;
      if (start > maxStart) start = maxStart;

      let s = tryFrom(start);
      if (s === null) s = tryFrom(min);
      if (s === null) throw new Error('无法分配连续的世界书条目 order 区间');

      for (let i = 0; i < size; i++) used.add(s + i);
      return s;
  }

  async function deleteAllGeneratedEntries_ACU(targetLorebook = null) {
    const primaryLorebookName = targetLorebook || (await getInjectionTargetLorebook_ACU());
    if (!primaryLorebookName) return;

    try {
        const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
        
        // [修改] 根据隔离状态构建删除逻辑
        const isolationPrefix = getIsolationPrefix_ACU();
        
        const basePrefixes = [
            'TavernDB-ACU-ReadableDataTable',
            'TavernDB-ACU-OutlineTable',
            '重要人物条目',
            'TavernDB-ACU-ImportantPersonsIndex',
            '总结条目',
            '小总结条目',
            'TavernDB-ACU-CustomExport',
            'TavernDB-ACU-WrapperStart',
            'TavernDB-ACU-WrapperEnd',
            'TavernDB-ACU-MemoryStart',
            'TavernDB-ACU-MemoryEnd',
            'TavernDB-ACU-PersonsHeader'
        ];

        // [修改] 使用 knownCustomEntryNames 增强删除逻辑
        const knownNames = settings_ACU.knownCustomEntryNames || [];
        
        // [新增] 获取当前配置的预期前缀作为补充 (防止 knownNames 丢失)
        const currentConfigPrefixes = new Set();
        if (currentJsonTableData_ACU) {
             const tableKeys = getSortedSheetKeys_ACU(currentJsonTableData_ACU);
             tableKeys.forEach(sheetKey => {
                 const table = currentJsonTableData_ACU[sheetKey];
                 if (table && table.exportConfig && table.exportConfig.enabled) {
                     const entryName = table.exportConfig.entryName || table.name;
                     if (entryName) {
                         currentConfigPrefixes.add(entryName);
                     }
                 }
             });
        }

        const uidsToDelete = allEntries
            .filter(entry => {
                if (!entry.comment) return false;

                // [严重问题修复] 外部导入生成的条目一律不参与“自动清理”
                // 说明：切回脚本/读不到聊天表格数据时，可能会触发 deleteAllGeneratedEntries_ACU 清理旧条目；
                // 但外部导入条目应被视为第三方条目，只允许用户手动清理/删除。
                if (settings_ACU.dataIsolationEnabled) {
                    if (isolationPrefix && entry.comment.startsWith(isolationPrefix + '外部导入-')) return false;
                } else {
                    if (entry.comment.startsWith('外部导入-')) return false;
                }
                
                if (settings_ACU.dataIsolationEnabled) {
                    // 隔离模式：只删除匹配当前标识前缀的
                    if (!isolationPrefix) return false;
                    
                    // 1. 基础前缀
                    if (basePrefixes.some(prefix => entry.comment.startsWith(isolationPrefix + prefix))) return true;

                    // 2. 已知自定义条目 (Known List) - 必须匹配隔离前缀
                    if (knownNames.includes(entry.comment) && entry.comment.startsWith(isolationPrefix)) return true;

                    // 3. 当前配置前缀 (Fallback)
                    for (const customPrefix of currentConfigPrefixes) {
                        if (entry.comment.startsWith(isolationPrefix + customPrefix)) return true;
                    }

                    return false;
                } else {
                    // 非隔离模式
                    if (entry.comment.startsWith('ACU-[')) return false; // 避开隔离数据
                    
                    // 1. 基础前缀
                    if (basePrefixes.some(prefix => entry.comment.startsWith(prefix))) return true;

                    // 2. 已知自定义条目 (Known List) - 必须不带隔离前缀(或者说我们假设knownNames存了完整名，这里只需检查它是否不以ACU-[开头)
                    // 其实 knownNames 可能包含带隔离前缀的（如果是切模式过来的）。我们只删非隔离的。
                    if (knownNames.includes(entry.comment) && !entry.comment.startsWith('ACU-[')) return true;

                    // 3. 当前配置前缀 (Fallback)
                    for (const customPrefix of currentConfigPrefixes) {
                        if (entry.comment.startsWith(customPrefix)) return true;
                    }

                    return false;
                }
            })
            .map(entry => entry.uid);

        if (uidsToDelete.length > 0) {
            await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, uidsToDelete);
            logDebug_ACU(`Successfully deleted ${uidsToDelete.length} generated database entries for new chat.`);
            
            // [新增] 清理 knownCustomEntryNames 中属于当前隔离环境的记录
            // 因为我们已经把它们删了。
            // 注意：如果是“新聊天”，我们其实是重置。
            if (settings_ACU.knownCustomEntryNames) {
                if (settings_ACU.dataIsolationEnabled) {
                    settings_ACU.knownCustomEntryNames = settings_ACU.knownCustomEntryNames.filter(n => !n.startsWith(isolationPrefix));
                } else {
                    settings_ACU.knownCustomEntryNames = settings_ACU.knownCustomEntryNames.filter(n => n.startsWith('ACU-[')); // 只保留隔离的
                }
                saveSettings_ACU();
            }
        }
    } catch(error) {
        logError_ACU('Failed to delete generated lorebook entries:', error);
    }
  }

  // =========================
  // [可视化删表-硬删除] 追溯整个聊天记录，删除指定 sheetKey 的所有本地表格数据（新版+旧版）
  // 设计目标：即使后续有“按原楼层写回”的流程，也不会把旧表复活
  // =========================
  async function purgeSheetKeysFromChatHistoryHard_ACU(sheetKeysToPurge) {
      const keys = Array.isArray(sheetKeysToPurge)
          ? [...new Set(sheetKeysToPurge.filter(k => typeof k === 'string' && k.startsWith('sheet_')))]
          : [];
      if (keys.length === 0) return { changed: false, changedCount: 0 };

      const chat = SillyTavern_API_ACU?.chat;
      if (!Array.isArray(chat) || chat.length === 0) return { changed: false, changedCount: 0 };

      const removeKeyFromArray = (arr, key) => {
          if (!Array.isArray(arr) || arr.length === 0) return { arr, changed: false };
          const next = arr.filter(x => x !== key);
          return { arr: next, changed: next.length !== arr.length };
      };
      const hasAnySheetKey = (obj) => obj && typeof obj === 'object' && Object.keys(obj).some(k => k.startsWith('sheet_'));
      const safeClone = (obj) => {
          try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
      };
      const parseMaybeJson = (v) => {
          if (!v) return null;
          if (typeof v === 'string') {
              try { return JSON.parse(v); } catch (e) { return null; }
          }
          if (typeof v === 'object') return v;
          return null;
      };

      let changedAny = false;
      let changedCount = 0;

      // [新增] 同步清理：聊天第一层的“空白指导表”
      try {
          const first = getChatFirstLayerMessage_ACU(chat);
          if (first && first[CHAT_SHEET_GUIDE_FIELD_ACU]) {
              const container = parseMaybeJson(first[CHAT_SHEET_GUIDE_FIELD_ACU]);
              if (container && typeof container === 'object' && container.tags && typeof container.tags === 'object') {
                  const nextContainer = safeClone(container) || {};
                  Object.keys(nextContainer.tags).forEach(tagKey => {
                      const slot = nextContainer.tags[tagKey];
                      if (!slot || typeof slot !== 'object') return;
                      const slotData = parseMaybeJson(slot.data);
                      if (!slotData || typeof slotData !== 'object') return;
                      const nextData = safeClone(slotData) || {};
                      keys.forEach(k => { if (nextData[k]) delete nextData[k]; });
                      slot.data = nextData;
                  });
                  first[CHAT_SHEET_GUIDE_FIELD_ACU] = nextContainer;
                  changedAny = true;
              }
          }
      } catch (e) {
          // ignore
      }

      for (let i = 0; i < chat.length; i++) {
          const msg = chat[i];
          if (!msg || msg.is_user) continue;
          let msgChanged = false;

          // 新版：按标签分组（对该消息内所有标签槽执行删除，确保彻底）
          const isolated = parseMaybeJson(msg.TavernDB_ACU_IsolatedData);
          if (isolated && typeof isolated === 'object') {
              const nextIsolated = safeClone(isolated) || {};
              Object.keys(nextIsolated).forEach(tagKey => {
                  const tagData = nextIsolated[tagKey];
                  if (!tagData || typeof tagData !== 'object') return;
                  if (tagData.independentData && typeof tagData.independentData === 'object') {
                      keys.forEach(k => {
                          if (tagData.independentData[k]) {
                              delete tagData.independentData[k];
                              msgChanged = true;
                          }
                      });
                  }
                  if (Array.isArray(tagData.modifiedKeys)) {
                      keys.forEach(k => {
                          const r = removeKeyFromArray(tagData.modifiedKeys, k);
                          if (r.changed) { tagData.modifiedKeys = r.arr; msgChanged = true; }
                      });
                  }
                  if (Array.isArray(tagData.updateGroupKeys)) {
                      keys.forEach(k => {
                          const r = removeKeyFromArray(tagData.updateGroupKeys, k);
                          if (r.changed) { tagData.updateGroupKeys = r.arr; msgChanged = true; }
                      });
                  }
              });
              if (msgChanged) {
                  msg.TavernDB_ACU_IsolatedData = nextIsolated; // 重新赋值，确保写入
              }
          }

          // 旧版：独立数据
          if (msg.TavernDB_ACU_IndependentData && typeof msg.TavernDB_ACU_IndependentData === 'object') {
              const next = safeClone(msg.TavernDB_ACU_IndependentData) || {};
              keys.forEach(k => {
                  if (next[k]) {
                      delete next[k];
                      msgChanged = true;
                  }
              });
              if (msgChanged) {
                  if (!hasAnySheetKey(next)) {
                      const hasNonSheet = Object.keys(next).some(k => !k.startsWith('sheet_'));
                      if (!hasNonSheet) {
                          delete msg.TavernDB_ACU_IndependentData;
                      } else {
                          msg.TavernDB_ACU_IndependentData = next;
                      }
                  } else {
                      msg.TavernDB_ACU_IndependentData = next;
                  }
              }
          }
          if (Array.isArray(msg.TavernDB_ACU_ModifiedKeys)) {
              let next = [...msg.TavernDB_ACU_ModifiedKeys];
              let any = false;
              keys.forEach(k => {
                  const r = removeKeyFromArray(next, k);
                  if (r.changed) { next = r.arr; any = true; }
              });
              if (any) { msg.TavernDB_ACU_ModifiedKeys = next; msgChanged = true; }
          }
          if (Array.isArray(msg.TavernDB_ACU_UpdateGroupKeys)) {
              let next = [...msg.TavernDB_ACU_UpdateGroupKeys];
              let any = false;
              keys.forEach(k => {
                  const r = removeKeyFromArray(next, k);
                  if (r.changed) { next = r.arr; any = true; }
              });
              if (any) { msg.TavernDB_ACU_UpdateGroupKeys = next; msgChanged = true; }
          }

          // 旧版：标准表/总结表字段
          if (msg.TavernDB_ACU_Data && typeof msg.TavernDB_ACU_Data === 'object') {
              const next = safeClone(msg.TavernDB_ACU_Data) || {};
              keys.forEach(k => {
                  if (next[k]) { delete next[k]; msgChanged = true; }
              });
              if (msgChanged) {
                  if (!hasAnySheetKey(next)) {
                      const hasNonSheet = Object.keys(next).some(k => !k.startsWith('sheet_'));
                      if (!hasNonSheet) delete msg.TavernDB_ACU_Data;
                      else msg.TavernDB_ACU_Data = next;
                  } else {
                      msg.TavernDB_ACU_Data = next;
                  }
              }
          }
          if (msg.TavernDB_ACU_SummaryData && typeof msg.TavernDB_ACU_SummaryData === 'object') {
              const next = safeClone(msg.TavernDB_ACU_SummaryData) || {};
              keys.forEach(k => {
                  if (next[k]) { delete next[k]; msgChanged = true; }
              });
              if (msgChanged) {
                  if (!hasAnySheetKey(next)) {
                      const hasNonSheet = Object.keys(next).some(k => !k.startsWith('sheet_'));
                      if (!hasNonSheet) delete msg.TavernDB_ACU_SummaryData;
                      else msg.TavernDB_ACU_SummaryData = next;
                  } else {
                      msg.TavernDB_ACU_SummaryData = next;
                  }
              }
          }

          if (msgChanged) {
              changedAny = true;
              changedCount++;
          }
      }

      if (changedAny) {
          await SillyTavern_API_ACU.saveChat();
          try { await loadAllChatMessages_ACU(); } catch (e) {}
          // 通知前端刷新
          if (topLevelWindow_ACU.AutoCardUpdaterAPI) topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
          setTimeout(() => { jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data'); }, 200);
      }
      return { changed: changedAny, changedCount };
  }

  async function updateOutlineTableEntry_ACU(outlineTable, isImport = false) { // [外部导入] 添加 isImport 标志
    if (!TavernHelper_API_ACU) return;
    const primaryLorebookName = await getInjectionTargetLorebook_ACU();
    if (!primaryLorebookName) {
        logWarn_ACU('Cannot update outline table entry: No injection target lorebook set.');
        return;
    }

    // [新增] 0TK占用模式：开=世界书条目不启用；关=世界书条目启用
    // 说明：这里控制的是“注入到世界书里的 OutlineTable 条目”的 enabled，而不是读取世界书/剧情推进等其他开关。
    const worldbookConfig = getCurrentWorldbookConfig_ACU();
    const zeroTkOccupyMode = worldbookConfig?.zeroTkOccupyMode === true;
    const outlineEntryEnabled = !zeroTkOccupyMode;

    const IMPORT_PREFIX = getImportBatchPrefix_ACU();
    // [修改] 加入隔离标识前缀
    const isoPrefix = getIsolationPrefix_ACU();
    const baseComment = isImport ? `${IMPORT_PREFIX}TavernDB-ACU-OutlineTable` : 'TavernDB-ACU-OutlineTable';
    const OUTLINE_COMMENT = isoPrefix + baseComment;

    try {
        const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
        const usedOrders = buildUsedOrderSet_ACU(allEntries);
        const existingEntry = allEntries.find(e => e.comment === OUTLINE_COMMENT);

        // If no outline table data, delete the entry if it exists
        if (!outlineTable || outlineTable.content.length < 2) {
            if (existingEntry) {
                await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, [existingEntry.uid]);
                logDebug_ACU('Deleted outline table entry as there is no data.');
            }
            // [修复] 即使没有outlineTable数据，也要同步更新"纪要索引"条目的enabled状态
            // 这样0TK模式切换时，纪要索引条目也会被正确禁用/启用
            try {
                // [修复] 使用endsWith匹配，因为条目名称可能带有隔离前缀
                const existingIndexEntry = allEntries.find(e => e.comment && e.comment.endsWith('TavernDB-ACU-CustomExport-纪要索引'));
                if (existingIndexEntry) {
                    if (existingIndexEntry.enabled !== outlineEntryEnabled) {
                        await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [{
                            uid: existingIndexEntry.uid,
                            enabled: outlineEntryEnabled
                        }]);
                        logDebug_ACU(`Successfully updated 纪要索引 entry (no outline data). enabled=${outlineEntryEnabled}`);
                    }
                }
            } catch (indexError) {
                logWarn_ACU('Failed to update 纪要索引 entry enabled state (no outline data):', indexError);
            }
            return;
        }

        // Format the entire table as markdown
        let content = `# ${outlineTable.name}\n\n`;
        const headers = outlineTable.content[0] ? outlineTable.content[0].slice(1) : [];
        if (headers.length > 0) {
            content += `| ${headers.join(' | ')} |\n`;
            content += `|${headers.map(() => '---').join('|')}|\n`;
        }
        const rows = outlineTable.content.slice(1);
        rows.forEach(row => {
            content += `| ${row.slice(1).join(' | ')} |\n`;
        });

        const finalContent = `<剧情大纲编码索引>\n\n${content.trim()}\n\n</剧情大纲编码索引>`;
        const outlineCfg = ensureExportConfigDefaults_ACU(outlineTable?.exportConfig, outlineTable?.name || '总体大纲');
        const outlineFixedPlacement = normalizePlacementConfig_ACU(
            outlineCfg.fixedEntryPlacement,
            getFixedPlacementDefaultsForTable_ACU(outlineTable?.name || '总体大纲').entry
        );

        if (existingEntry) {
            const needsUpdate =
                existingEntry.content !== finalContent ||
                existingEntry.enabled !== outlineEntryEnabled ||
                existingEntry.type !== 'constant' ||
                existingEntry.prevent_recursion !== true ||
                !isEntryPlacementMatched_ACU(existingEntry, outlineFixedPlacement);

            if (needsUpdate) {
                const updatedEntry = applyPlacementToEntry_ACU({
                    uid: existingEntry.uid,
                    content: finalContent,
                    enabled: outlineEntryEnabled,
                    type: 'constant',
                    prevent_recursion: true,
                }, outlineFixedPlacement);
                await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [updatedEntry]);
                logDebug_ACU(`Successfully updated the outline table lorebook entry. enabled=${outlineEntryEnabled} (0TK占用模式=${zeroTkOccupyMode})`);
            } else {
                logDebug_ACU('Outline table lorebook entry is already up-to-date.');
            }
        } else {
            const newEntry = applyPlacementToEntry_ACU({
                comment: OUTLINE_COMMENT,
                content: finalContent,
                keys: [OUTLINE_COMMENT + '-Key'],
                enabled: outlineEntryEnabled,
                type: 'constant',
                // [优化] order(插入深度) 避免与任何现有条目重复
                order: allocOrder_ACU(usedOrders, outlineFixedPlacement.order, 1, 99999),
                prevent_recursion: true,
            }, outlineFixedPlacement);
            await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [newEntry]);
            logDebug_ACU(`Outline table lorebook entry not found. Created a new one. enabled=${outlineEntryEnabled} (0TK占用模式=${zeroTkOccupyMode})`);
        }

        // [新增] 同步更新"纪要索引"条目的enabled状态
        try {
            // [修复] 使用endsWith匹配，因为条目名称可能带有隔离前缀
            const existingIndexEntry = allEntries.find(e => e.comment && e.comment.endsWith('TavernDB-ACU-CustomExport-纪要索引'));
            if (existingIndexEntry) {
                if (existingIndexEntry.enabled !== outlineEntryEnabled) {
                    await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [{
                        uid: existingIndexEntry.uid,
                        enabled: outlineEntryEnabled
                    }]);
                    logDebug_ACU(`Successfully updated 纪要索引 entry. enabled=${outlineEntryEnabled}`);
                }
            }
        } catch (indexError) {
            logWarn_ACU('Failed to update 纪要索引 entry enabled state:', indexError);
        }
    } catch(error) {
        logError_ACU('Failed to update outline table lorebook entry:', error);
    }
  }

  function splitKeywordsByComma_ACU(text) {
      const raw = String(text || '').trim();
      if (!raw) return [];
      return raw.split(/[,，]/).map(k => k.trim()).filter(Boolean);
  }

  async function updateSummaryTableEntries_ACU(summaryTable, isImport = false) { // [外部导入] 添加 isImport 标志
    if (!TavernHelper_API_ACU) return;
    const primaryLorebookName = await getInjectionTargetLorebook_ACU();
    if (!primaryLorebookName) {
        logWarn_ACU('Cannot update summary entries: No injection target lorebook set.');
        return;
    }

    const IMPORT_PREFIX = getImportBatchPrefix_ACU();
    // [修改] 加入隔离标识前缀
    const isoPrefix = getIsolationPrefix_ACU();
    const baseSummaryPrefix = isImport ? `${IMPORT_PREFIX}总结条目` : '总结条目';
    const SUMMARY_ENTRY_PREFIX = isoPrefix + baseSummaryPrefix;
    // 旧版兼容前缀也要加上隔离判断
    const baseSmallSummaryPrefix = isImport ? `${IMPORT_PREFIX}小总结条目` : '小总结条目';
    const SMALL_SUMMARY_PREFIX = isoPrefix + baseSmallSummaryPrefix;

    try {
        const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
        const usedOrders = buildUsedOrderSet_ACU(allEntries);
        
        // --- 1. Delete old summary entries ---
        // 用户要求：外部导入每次导入前不清理（允许多批并存，避免后一批覆盖前一批）
        if (!isImport) {
            const uidsToDelete = allEntries
                .filter(e => e.comment && (e.comment.startsWith(SUMMARY_ENTRY_PREFIX) || e.comment.startsWith(SMALL_SUMMARY_PREFIX)))
                .map(e => e.uid);

            if (uidsToDelete.length > 0) {
                await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, uidsToDelete);
                logDebug_ACU(`Deleted ${uidsToDelete.length} old summary lorebook entries.`);
            }
        }

        // --- 2. Re-create entries from the table ---
        const summaryRows = (summaryTable?.content?.length > 1) ? summaryTable.content.slice(1) : [];
        if (summaryRows.length === 0) {
            logDebug_ACU('No summary rows to create entries for.');
            return;
        }

        const summaryCfg = ensureExportConfigDefaults_ACU(summaryTable?.exportConfig, summaryTable?.name || '总结表');
        const summaryFixedPlacement = normalizePlacementConfig_ACU(
            summaryCfg.fixedEntryPlacement,
            getFixedPlacementDefaultsForTable_ACU(summaryTable?.name || '总结表').entry
        );
        const headers = summaryTable.content[0].slice(1);
        const keywordColumnIndex = headers.indexOf('编码索引');
        if (keywordColumnIndex === -1) {
            logError_ACU('Cannot find "编码索引" column in 总结表. Cannot process summary entries.');
            return;
        }

        const entriesToCreate = [];
        // [优化] 总结表“按表占深度”：所有总结行共用同一个 order(深度)，避免 N 行占 N 个深度
        // 注意：MemoryStart / MemoryEnd 的“3深度成组”会在 updateReadableLorebookEntry_ACU 中统一对齐并保证连续
        const sharedSummaryDataOrder = allocOrder_ACU(usedOrders, summaryFixedPlacement.order, 1, 99999);
        
        summaryRows.forEach((row, i) => {
            const rowData = row.slice(1);
            const keywordsRaw = rowData[keywordColumnIndex];
            if (!keywordsRaw) return; // Skip if no keywords

            const keywords = splitKeywordsByComma_ACU(keywordsRaw);
            if (keywords.length === 0) return;

            // 行条目只包含行数据，不包含表头
            const content = `| ${rowData.join(' | ')} |\n`;
            const newEntryData = applyPlacementToEntry_ACU({
                comment: `${SUMMARY_ENTRY_PREFIX}${i + 1}`,
                content: content,
                keys: keywords,
                enabled: true,
                type: 'keyword', // Green light entry
                // [优化] 同表所有行条目共用同一深度
                order: sharedSummaryDataOrder,
                prevent_recursion: true
            }, summaryFixedPlacement);
            entriesToCreate.push(newEntryData);
        });
        
        if (entriesToCreate.length > 0) {
            await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, entriesToCreate);
            logDebug_ACU(`Successfully created ${entriesToCreate.length} new summary entries.`);
            // [兜底] 某些实现可能会在创建时自动改写/规范化 order，导致同表行条目仍然各占一个深度。
            // 这里在创建完成后，强制把“总结条目/小总结条目”统一回写到同一个 order。
            try {
                const latest = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
                const toFix = latest.filter(e => {
                    const c = e?.comment || '';
                    return c.startsWith(SUMMARY_ENTRY_PREFIX) || c.startsWith(SMALL_SUMMARY_PREFIX);
                });
                if (toFix.length > 0) {
                    await TavernHelper_API_ACU.setLorebookEntries(
                        primaryLorebookName,
                        toFix.map(e => applyPlacementToEntry_ACU({ uid: e.uid, order: sharedSummaryDataOrder }, summaryFixedPlacement))
                    );
                }
            } catch (e) {
                logWarn_ACU('[SummaryOrderFix] Failed to enforce shared order for summary entries:', e);
            }
        }

    } catch(error) {
        logError_ACU('Failed to update summary lorebook entries:', error);
    }
  }

  async function updateReadableLorebookEntry_ACU(createIfNeeded = false, isImport = false, targetLorebookOverride = null) { // [外部导入] 添加 targetLorebookOverride 参数，避免临时修改 worldbookConfig 被兜底补齐逻辑覆盖
    // [健全性] 新对话开场白阶段：禁止自动创建/更新世界书条目
    // - 仅影响非导入流程（isImport=false）
    // - 仅在“无任何用户消息”的开场白阶段生效
    // - 用户一旦开始对话，会自动解除抑制
    if (!isImport) {
        maybeLiftWorldbookSuppression_ACU();
        if (shouldSuppressWorldbookInjection_ACU()) {
            // 注意：这里必须“只抑制注入/创建”，但不能抑制“清理旧条目/回退导致的删除”。
            // 因此在抑制期间，我们仍然执行一次清理，以确保新开对话会清除旧世界书条目。
            try {
                await deleteAllGeneratedEntries_ACU();
                logDebug_ACU('[Worldbook] Greeting-stage suppression: cleanup-only (no create/update).');
            } catch (e) {
                logWarn_ACU('[Worldbook] Greeting-stage cleanup-only failed:', e);
            }
            return;
        }
    }

    // [新增] 分别从最新的标准表和总结表数据源中拉取数据并合并
    let mergedData = null;
    
    if (isImport) {
        // 外部导入时，直接使用 currentJsonTableData_ACU
        mergedData = currentJsonTableData_ACU;
    } else {
        // 正常更新时，使用全表合并逻辑从整段聊天记录提取每张表的最新版本
        await loadAllChatMessages_ACU();
        const mergedFromHistory = await mergeAllIndependentTables_ACU();
        if (mergedFromHistory) {
            mergedData = mergedFromHistory;
            // 同步内存中的全局数据，确保后续调用保持一致
            currentJsonTableData_ACU = mergedFromHistory;
        } else {
            // 如果合并失败，退回到当前内存数据避免中断
            mergedData = currentJsonTableData_ACU;
        }
    }

    if (!mergedData) {
        logWarn_ACU('Update readable lorebook aborted: no data available.');
        return;
    }
    
    const { readableText, importantPersonsTable, summaryTable, outlineTable } = formatJsonToReadable_ACU(mergedData);
    const hasAnyNonEmptyCell_ACU = data => {
        if (!data) return false;
        const sheetKeys = Object.keys(data).filter(k => k.startsWith('sheet_'));
        for (const sheetKey of sheetKeys) {
            const table = data[sheetKey];
            const content = table?.content;
            if (!Array.isArray(content) || content.length <= 1) continue;
            for (let r = 1; r < content.length; r++) {
                const row = content[r];
                if (!Array.isArray(row)) continue;
                for (let c = 1; c < row.length; c++) {
                    const cell = row[c];
                    if (cell === null || cell === undefined) continue;
                    if (typeof cell === 'string') {
                        if (cell.trim() !== '') return true;
                    } else if (typeof cell === 'number') {
                        if (!Number.isNaN(cell)) return true;
                    } else if (typeof cell === 'boolean') {
                        return true;
                    } else {
                        return true;
                    }
                }
            }
        }
        return false;
    };

    const hasNonEmptyCellData_ACU = hasAnyNonEmptyCell_ACU(mergedData);
    const hasReadableContent_ACU = !!(readableText && readableText.trim() !== '' && !readableText.includes('数据库为空。'));
    let isDatabaseEmpty = false;
    if (isImport) {
        // [修复] 该判空放宽逻辑仅对“外部导入”生效：
        // - 外部导入可能只选择“单独导出到世界书”的表格，此时 readableText 会故意为空；
        // - 重要人物表 / 总结表 / 总体大纲也会被 formatJsonToReadable_ACU 排除在 readableText 之外。
        // 只要 mergedData 里仍有非空单元格，就必须继续走世界书条目创建链路。
        isDatabaseEmpty = !hasNonEmptyCellData_ACU;
        if (!hasReadableContent_ACU && hasNonEmptyCellData_ACU) {
            logDebug_ACU('[Worldbook][Import] readableText 为空，但 mergedData 仍有有效单元格；按“数据库非空”继续创建世界书条目。');
        }
    } else {
        if (!readableText || readableText.trim() === '' || readableText.includes('数据库为空。')) {
            isDatabaseEmpty = true;
        } else if (!hasNonEmptyCellData_ACU) {
            isDatabaseEmpty = true;
        }
    }

    // Call all the individual entry updaters
    await updateImportantPersonsRelatedEntries_ACU(importantPersonsTable, isImport);
    await updateSummaryTableEntries_ACU(summaryTable, isImport);
    await updateOutlineTableEntry_ACU(outlineTable, isImport);

    // [修复] 自定义导出/按行拆分条目是否需要注入，应以 mergedData 中是否存在真实单元格数据为准，
    // 不能再依赖 readableText 判空。
    // 否则当所有表格都开启“按行拆分”后，readableText 会为空，进而误判为“数据库为空”，
    // 导致本应创建的拆分世界书条目被整体跳过。
    if (hasNonEmptyCellData_ACU) {
        await updateCustomTableExports_ACU(mergedData, isImport);
    } else {
        await updateCustomTableExports_ACU(null, isImport); // 仅清理旧自定义导出条目，不创建新条目
    }

    // [修复] 外部导入时优先使用 targetLorebookOverride 参数，避免临时修改 worldbookConfig 被兜底补齐逻辑覆盖
    const primaryLorebookName = targetLorebookOverride || await getInjectionTargetLorebook_ACU();
    if (primaryLorebookName) {
        try {
            const IMPORT_PREFIX = getImportBatchPrefix_ACU();
            // [修改] 加入隔离标识前缀
            const isoPrefix = getIsolationPrefix_ACU();
            const baseReadableComment = isImport ? `${IMPORT_PREFIX}TavernDB-ACU-ReadableDataTable` : 'TavernDB-ACU-ReadableDataTable';
            const READABLE_LOREBOOK_COMMENT = isoPrefix + baseReadableComment;
            // [修复] 外部导入的包裹条目必须带外部导入前缀，避免被 deleteAllGeneratedEntries_ACU 当作“本体注入条目”清理
            const WRAPPER_START_COMMENT = isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-WrapperStart` : 'TavernDB-ACU-WrapperStart');
            const WRAPPER_END_COMMENT = isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-WrapperEnd` : 'TavernDB-ACU-WrapperEnd');
            
            const entries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
            const usedOrders = buildUsedOrderSet_ACU(entries);
            const db2Entry = entries.find(e => e.comment === READABLE_LOREBOOK_COMMENT);
            const templateObjForGlobalCfg = parseTableTemplateJson_ACU({ stripSeedRows: false });
            const globalCfgRaw =
                mergedData?.mate?.globalInjectionConfig
                ?? currentJsonTableData_ACU?.mate?.globalInjectionConfig
                ?? templateObjForGlobalCfg?.mate?.globalInjectionConfig;
            const globalCfgFromData = ensureGlobalInjectionConfigDefaults_ACU(globalCfgRaw);
            const globalDefaults = buildDefaultGlobalInjectionConfig_ACU();
            const globalFixedEntryPlacement = normalizePlacementConfig_ACU(globalCfgFromData?.readableEntryPlacement, globalDefaults.readableEntryPlacement);
            const globalFixedIndexPlacement = normalizePlacementConfig_ACU(globalCfgFromData?.wrapperPlacement, globalDefaults.wrapperPlacement);
            const summaryCfg = ensureExportConfigDefaults_ACU(summaryTable?.exportConfig, summaryTable?.name || '总结表');
            const summaryFixedEntryPlacement = normalizePlacementConfig_ACU(
                summaryCfg.fixedEntryPlacement,
                getFixedPlacementDefaultsForTable_ACU(summaryTable?.name || '总结表').entry
            );
            const summaryFixedIndexPlacement = normalizePlacementConfig_ACU(
                summaryCfg.fixedIndexPlacement,
                getFixedPlacementDefaultsForTable_ACU(summaryTable?.name || '总结表').index
            );

            // [修复] 自定义导出条目与全局条目必须共用同一套“数据库是否为空”判定。
            // 否则会出现：全局条目已正确判空不注入，但自定义导出条目因为更早执行而提前被创建。
            if (isDatabaseEmpty) {
                // 数据库为空：不应在世界书中固定注入任何包裹条目，顺便清理旧条目避免残留
                const toDelete = [];
                if (db2Entry) toDelete.push(db2Entry.uid);

                const wrapperStartOld = entries.find(e => e.comment === WRAPPER_START_COMMENT);
                const wrapperEndOld = entries.find(e => e.comment === WRAPPER_END_COMMENT);
                const memoryStartOld = entries.find(e => e.comment === (isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-MemoryStart` : 'TavernDB-ACU-MemoryStart')));
                const memoryEndOld = entries.find(e => e.comment === (isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-MemoryEnd` : 'TavernDB-ACU-MemoryEnd')));
                if (wrapperStartOld) toDelete.push(wrapperStartOld.uid);
                if (wrapperEndOld) toDelete.push(wrapperEndOld.uid);
                if (memoryStartOld) toDelete.push(memoryStartOld.uid);
                if (memoryEndOld) toDelete.push(memoryEndOld.uid);

                if (toDelete.length > 0) {
                    await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, toDelete);
                    logDebug_ACU(`Deleted ${toDelete.length} lorebook entries because database is empty/reset (readable + wrappers).`);
                }
                return; // 数据库为空时，不再继续创建或更新
            }

            // [修复2026-03-29] 全局条目顺序修正：使用 allocConsecutiveOrderBlock_ACU 分配连续的 3 个 order 区块
            // 确保顺序始终为：包裹上(baseOrder) → 全局内容(baseOrder+1) → 包裹下(baseOrder+2)
            // 即使默认 order 值被占用，也能保证三个条目的 order 是连续的
            const globalWrapperBlockBase = allocConsecutiveOrderBlock_ACU(usedOrders, 3, globalFixedIndexPlacement.order, 1, 99999);
            const wrapperStartOrder = globalWrapperBlockBase;
            const globalContentOrder = globalWrapperBlockBase + 1;
            const wrapperEndOrder = globalWrapperBlockBase + 2;
            
            if (db2Entry) {
                const newContent = readableText;
                const needsUpdate =
                    (db2Entry.content !== newContent) ||
                    (db2Entry.type !== 'constant') ||
                    (db2Entry.enabled !== true) ||
                    (db2Entry.prevent_recursion !== true) ||
                    (getEntryOrderNumber_ACU(db2Entry) !== globalContentOrder) ||
                    !isEntryPlacementMatched_ACU(db2Entry, globalFixedIndexPlacement);
                if (needsUpdate) {
                    const updatedDb2Entry = applyPlacementToEntry_ACU({
                        uid: db2Entry.uid,
                        content: newContent,
                        enabled: true,
                        type: 'constant',
                        order: globalContentOrder,
                        prevent_recursion: true,
                    }, globalFixedIndexPlacement);
                    await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [updatedDb2Entry]);
                    logDebug_ACU('Successfully updated the global readable lorebook entry.');
                } else {
                    logDebug_ACU('Global readable lorebook entry is already up-to-date.');
                }
            } else if (createIfNeeded) {
                const newDb2Entry = applyPlacementToEntry_ACU({
                    comment: READABLE_LOREBOOK_COMMENT,
                    content: readableText,
                    keys: ['TavernDB-ACU-ReadableDataTable-Key'],
                    enabled: true,
                    type: 'constant',
                    order: globalContentOrder,
                    prevent_recursion: true,
                }, globalFixedIndexPlacement);
                await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [newDb2Entry]);
                logDebug_ACU('Global readable lorebook entry not found. Created a new one.');
                showToastr_ACU('success', `已创建全局可读数据库条目。`);
            }

            // [新增] 创建 WrapperStart 条目
            const wrapperStartEntry = entries.find(e => e.comment === WRAPPER_START_COMMENT);
            const wrapperStartContent = '<最新数据与记录>\n以下是在这个时间点，当前场景下剧情相关的最新数据与记录，你在进行剧情分析时必须以此最新的数据为准，以下数据与记录的优先级高于其他任何背景设定：\n\n';
            if (!wrapperStartEntry) {
                await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [applyPlacementToEntry_ACU({
                    comment: WRAPPER_START_COMMENT,
                    content: wrapperStartContent,
                    keys: ['TavernDB-ACU-WrapperStart-Key'],
                    enabled: true,
                    type: 'constant',
                    order: wrapperStartOrder,
                    prevent_recursion: true,
                }, globalFixedIndexPlacement)]);
                logDebug_ACU('Created wrapper start entry.');
            } else {
                const wrapperStartNeedsUpdate =
                    wrapperStartEntry.content !== wrapperStartContent ||
                    wrapperStartEntry.enabled !== true ||
                    wrapperStartEntry.type !== 'constant' ||
                    wrapperStartEntry.prevent_recursion !== true ||
                    getEntryOrderNumber_ACU(wrapperStartEntry) !== wrapperStartOrder ||
                    !isEntryPlacementMatched_ACU(wrapperStartEntry, globalFixedIndexPlacement);
                if (wrapperStartNeedsUpdate) {
                    await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [
                        applyPlacementToEntry_ACU({
                            uid: wrapperStartEntry.uid,
                            content: wrapperStartContent,
                            enabled: true,
                            type: 'constant',
                            order: wrapperStartOrder,
                            prevent_recursion: true,
                        }, globalFixedIndexPlacement)
                    ]);
                }
            }

            // [新增] 创建或更新 MemoryStart 条目（整合总结表表头）
            const MEMORY_START_COMMENT = isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-MemoryStart` : 'TavernDB-ACU-MemoryStart');
            const MEMORY_END_COMMENT = isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-MemoryEnd` : 'TavernDB-ACU-MemoryEnd');
            const memoryStartEntry = entries.find(e => e.comment === MEMORY_START_COMMENT);
            const memoryEndEntry = entries.find(e => e.comment === MEMORY_END_COMMENT);

            // [修复] 检查总结表是否有数据（至少有一行非表头数据）
            const hasSummaryData = summaryTable && summaryTable.content && summaryTable.content.length > 1;
            
            if (!hasSummaryData) {
                // [修复] 没有总结表数据时，删除已存在的 MemoryStart/MemoryEnd 条目
                const memoryEntriesToDelete = [];
                if (memoryStartEntry) memoryEntriesToDelete.push(memoryStartEntry.uid);
                if (memoryEndEntry) memoryEntriesToDelete.push(memoryEndEntry.uid);
                
                if (memoryEntriesToDelete.length > 0) {
                    await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, memoryEntriesToDelete);
                    logDebug_ACU(`Deleted ${memoryEntriesToDelete.length} MemoryStart/MemoryEnd entries because summary table is empty.`);
                }
            } else {
                // 有总结表数据时，正常创建或更新 MemoryStart/MemoryEnd 条目
                // 准备总结表表头内容
                let summaryHeaderContent = '';
                const summaryHeaders = summaryTable.content[0].slice(1);
                if (summaryHeaders.length > 0) {
                    summaryHeaderContent = `# ${summaryTable.name}\n\n| ${summaryHeaders.join(' | ')} |\n|${summaryHeaders.map(() => '---').join('|')}|`;
                }
                
                // 构建 MemoryStart 条目内容
                let memoryStartContent = '<过往记忆>\n\n以下是你回忆起的跟当前剧情有关的过往的记忆，你要特地注意该记忆所标注的时间，以及分析与当前剧情的相关性，完美地将其融入本轮的剧情编写中：\n\n';
                if (summaryHeaderContent) {
                    memoryStartContent += summaryHeaderContent + '\n\n';
                }

                // =========================
                // [总结表] 3-depth 成组对齐：
                // - MemoryStart / 总结行条目 / MemoryEnd 只占用连续 3 个 order(深度)
                // - 这 3 个深度不能与任何已有条目重合，且必须紧挨在一起
                // =========================
                const baseSummaryPrefix2 = isImport ? `${IMPORT_PREFIX}总结条目` : '总结条目';
                const baseSmallSummaryPrefix2 = isImport ? `${IMPORT_PREFIX}小总结条目` : '小总结条目';
                const SUMMARY_ENTRY_PREFIX2 = isoPrefix + baseSummaryPrefix2;
                const SMALL_SUMMARY_PREFIX2 = isoPrefix + baseSmallSummaryPrefix2;
                const summaryOrderBlockBase = allocConsecutiveOrderBlock_ACU(usedOrders, 3, Math.max(1, summaryFixedEntryPlacement.order - 1), 1, 99999);
                const memoryStartOrder = summaryOrderBlockBase;
                const summaryDataOrder = summaryOrderBlockBase + 1;
                const memoryEndOrder = summaryOrderBlockBase + 2;

                // 将"总结条目/小总结条目"统一挪到 summaryDataOrder（多条共用同一深度）
                const summaryEntriesToReorder = entries.filter(e => {
                    const c = e?.comment || '';
                    return c.startsWith(SUMMARY_ENTRY_PREFIX2) || c.startsWith(SMALL_SUMMARY_PREFIX2);
                });
                if (summaryEntriesToReorder.length > 0) {
                    await TavernHelper_API_ACU.setLorebookEntries(
                        primaryLorebookName,
                        summaryEntriesToReorder.map(e => applyPlacementToEntry_ACU({ uid: e.uid, order: summaryDataOrder }, summaryFixedEntryPlacement))
                    );
                }
                
                if (!memoryStartEntry) {
                    // 创建新条目
                    await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [applyPlacementToEntry_ACU({
                            comment: MEMORY_START_COMMENT,
                            content: memoryStartContent,
                            keys: ['AM'],
                            enabled: true,
                            type: 'keyword',
                            order: memoryStartOrder,
                            prevent_recursion: true,
                        }, summaryFixedIndexPlacement)]);
                } else {
                    // 更新现有条目（内容/深度）
                    const needsUpdate =
                        (memoryStartEntry.content !== memoryStartContent) ||
                        (getEntryOrderNumber_ACU(memoryStartEntry) !== memoryStartOrder) ||
                        !isEntryPlacementMatched_ACU(memoryStartEntry, summaryFixedIndexPlacement);
                    if (needsUpdate) {
                        await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [{
                            ...applyPlacementToEntry_ACU({
                                uid: memoryStartEntry.uid,
                                content: memoryStartContent,
                                order: memoryStartOrder,
                                enabled: true,
                                type: 'keyword',
                                prevent_recursion: true,
                                keys: memoryStartEntry.keys || memoryStartEntry.key || ['AM'],
                            }, summaryFixedIndexPlacement)
                        }]);
                    }
                }

                // [新增] 创建 MemoryEnd 条目
                if (!memoryEndEntry) {
                    await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [applyPlacementToEntry_ACU({
                            comment: MEMORY_END_COMMENT,
                            content: '</过往记忆>',
                            keys: ['AM'],
                            enabled: true,
                            type: 'keyword',
                            order: memoryEndOrder,
                            prevent_recursion: true,
                        }, summaryFixedIndexPlacement)]);
                } else {
                    const needsUpdate =
                        (getEntryOrderNumber_ACU(memoryEndEntry) !== memoryEndOrder) ||
                        !isEntryPlacementMatched_ACU(memoryEndEntry, summaryFixedIndexPlacement);
                    if (needsUpdate) {
                        await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [{
                            ...applyPlacementToEntry_ACU({
                                uid: memoryEndEntry.uid,
                                order: memoryEndOrder,
                                enabled: true,
                                type: 'keyword',
                                prevent_recursion: true,
                                keys: memoryEndEntry.keys || memoryEndEntry.key || ['AM'],
                            }, summaryFixedIndexPlacement)
                        }]);
                    }
                }
            } // end of hasSummaryData

            // [新增] 创建 WrapperEnd 条目
            // [修复2026-03-29] 使用 globalWrapperBlockBase + 2 作为 wrapperEndOrder（已在上方通过 allocConsecutiveOrderBlock_ACU 分配）
            const wrapperEndEntry = entries.find(e => e.comment === WRAPPER_END_COMMENT);
            const wrapperEndContent = '</最新数据与记录>';
            if (!wrapperEndEntry) {
                await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, [applyPlacementToEntry_ACU({
                    comment: WRAPPER_END_COMMENT,
                    content: wrapperEndContent,
                    keys: ['TavernDB-ACU-WrapperEnd-Key'],
                    enabled: true,
                    type: 'constant',
                    order: wrapperEndOrder,
                    prevent_recursion: true,
                }, globalFixedIndexPlacement)]);
                logDebug_ACU('Created wrapper end entry.');
            } else {
                const wrapperEndNeedsUpdate =
                    wrapperEndEntry.content !== wrapperEndContent ||
                    wrapperEndEntry.enabled !== true ||
                    wrapperEndEntry.type !== 'constant' ||
                    wrapperEndEntry.prevent_recursion !== true ||
                    getEntryOrderNumber_ACU(wrapperEndEntry) !== wrapperEndOrder ||
                    !isEntryPlacementMatched_ACU(wrapperEndEntry, globalFixedIndexPlacement);
                if (wrapperEndNeedsUpdate) {
                    await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [
                        applyPlacementToEntry_ACU({
                            uid: wrapperEndEntry.uid,
                            content: wrapperEndContent,
                            enabled: true,
                            type: 'constant',
                            order: wrapperEndOrder,
                            prevent_recursion: true,
                        }, globalFixedIndexPlacement)
                    ]);
                }
            }
        } catch(error) {
            logError_ACU('Failed to get or update readable lorebook entry:', error);
        }
    }
  }

  // [新增] 处理自定义表格导出逻辑
  // [修复] 当 mergedData 为空/null 时，仍需执行"清理旧自定义导出条目"逻辑，
  // 避免删除楼层回溯到空数据时旧条目残留在世界书中。
  async function updateCustomTableExports_ACU(mergedData, isImport = false) {
      if (!TavernHelper_API_ACU) return;
      const primaryLorebookName = await getInjectionTargetLorebook_ACU();
      if (!primaryLorebookName) return;

      const IMPORT_PREFIX = getImportBatchPrefix_ACU();
      const isoPrefix = getIsolationPrefix_ACU();
      // [修复] 外部导入的自定义导出条目必须加外部导入前缀，避免被当作普通注入条目/或被清理逻辑误删
      // [修改] 外部导入时只使用"外部导入-"前缀，不再包含"TavernDB-ACU-CustomExport-"
      const exportPrefix = isoPrefix + (isImport ? IMPORT_PREFIX : '');
      // [修复] 外部导入时的条目命名辅助函数：只使用"外部导入-"前缀
      const getImportEntryName = (name) => isImport ? `${exportPrefix}${name}` : `${exportPrefix}TavernDB-ACU-CustomExport-${name}`;
      // [修改] 定义旧版前缀用于清理（非外部导入模式）
      const baseLegacyPrefix = 'TavernDB-ACU-CustomExport';
      const LEGACY_EXPORT_PREFIX = isoPrefix + baseLegacyPrefix;
      
      // [新增] 获取0TK占用模式状态，用于控制"纪要索引"条目的enabled
      const worldbookConfig = getCurrentWorldbookConfig_ACU();
      const zeroTkOccupyMode = worldbookConfig?.zeroTkOccupyMode === true;
      const extraIndexEntryEnabled = !zeroTkOccupyMode; // 0TK模式启用=条目禁用
      logDebug_ACU(`[CustomExport] 0TK模式=${zeroTkOccupyMode}, 纪要索引条目enabled=${extraIndexEntryEnabled}`);

      try {
          const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
          const usedOrders = buildUsedOrderSet_ACU(allEntries);
          
          // 1. Delete entries
          // [修改] 使用 knownCustomEntryNames 和 LEGACY_PREFIX 进行全面清理
          // 即使是回退或改名，只要曾经记录在 knownCustomEntryNames 中，并且符合当前隔离前缀，就会被清理
          
          // 加载已知条目列表（外部导入模式不使用 knownNames，以避免把第三方世界书纳入"本插件管理范围"）
          let knownNames = settings_ACU.knownCustomEntryNames || [];
          if (!Array.isArray(knownNames)) knownNames = [];

          const uidsToDelete = allEntries
              .filter(e => {
                  if (!e.comment) return false;

                  // 用户要求：外部导入每次导入前不清理（允许多批并存）
                  if (isImport) return false;
                  
                  // 1. 检查旧版前缀 (兼容性)
                  // LEGACY_EXPORT_PREFIX 已经包含了 isoPrefix
                  if (e.comment.startsWith(LEGACY_EXPORT_PREFIX)) return true;

                  // 2. 检查是否在已知列表中（仅非外部导入模式）
                  // 只有当条目属于当前隔离环境时才删除
                  if (e.comment.startsWith(isoPrefix)) {
                      if (knownNames.includes(e.comment)) return true;
                  }
                  return false;
              })
              .map(e => e.uid);
            
          // [新增] 还需要把当前配置会生成的名字也加入到"待删除"列表中，以防它们是新生成的但同名
          // 这一步会在后续生成 entriesToCreate 时自然覆盖，但显式删除更干净。
          // 由于我们下面会重新生成并添加到 knownNames，这里先删除所有已知的"本插件生成条目"是安全的。

          if (uidsToDelete.length > 0) {
              await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, uidsToDelete);
              logDebug_ACU(`Deleted ${uidsToDelete.length} custom export entries (Legacy + Known).`);
          }
          
          // 每次更新时，我们重置 knownNames 列表（仅非外部导入模式）
          // 外部导入模式不维护 knownNames，避免影响第三方世界书
          if (!isImport) {
              if (isoPrefix) knownNames = knownNames.filter(name => !name.startsWith(isoPrefix));
              else knownNames = knownNames.filter(name => name.startsWith('ACU-'));
          }

          // [修复] 如果 mergedData 为空，清理完旧条目后直接返回，不再尝试创建新条目
          if (!mergedData) {
              logDebug_ACU('[CustomExport] mergedData 为空，已清理旧条目，跳过创建。');
              // 保存清理后的 knownNames
              if (!isImport) {
                  settings_ACU.knownCustomEntryNames = knownNames;
                  saveSettings_ACU();
              }
              return;
          }

          // 2. Create new entries
          const entriesToCreate = [];
          // [新增] 创建后 order 强制回写计划（按 comment 匹配 uid 再 setLorebookEntries）
          // 目的：防止创建接口把重复 order 自动改写，导致“同表行条目仍然各占一个深度”
          const postCreateOrderFixPlan = []; // [{ comment, order }]
          // [新增] 用于合并同名条目的分组对象
          const mergedEntriesMap = {}; // Key: entryName + type + keywords, Value: { contentParts, config }
          
          // [FIX] 定义 newGeneratedNames 用于收集本次生成的名称
          const newGeneratedNames = [];

          // [FIX] 重新定义 tableKeys (之前的定义在 if 块内，这里无法访问)
          const tableKeys = getSortedSheetKeys_ACU(mergedData);
          
          // [新增] 为“自定义导出条目”分配不重叠的 order 段，避免不同表格的包裹/行条目互相穿插
          // 机制：严格按“用户手动顺序/模板顺序”分配，避免填表/读取后顺序漂移
          const sortedTableKeys = [...tableKeys];
          let nextCustomExportOrder = 10000; // 维持原本“自定义导出”大致优先级区间
          // [优化] 不允许重复 order：为每个条目分配唯一 order，并整体避开世界书现有 order
          const CUSTOM_EXPORT_ORDER_GAP = 1;
          const toIntOrFallback_ACU = (v, fb) => {
              const n = parseInt(v, 10);
              return Number.isFinite(n) ? n : fb;
          };
          const calcPreferredBlockStart_ACU = (baseOrder, leadingSlots = 0, fallback = 1) => {
              const o = toIntOrFallback_ACU(baseOrder, fallback);
              return Math.max(1, o - Math.max(0, toIntOrFallback_ACU(leadingSlots, 0)));
          };
          
          // [新增] 解析注入模板，提取用于前后包裹的常量条目内容
          const parseWrapperTemplate = templateStr => {
              if (!templateStr || typeof templateStr !== 'string') return null;
              const markerIndex = templateStr.indexOf('$1');
              if (markerIndex === -1) return null;
              const before = templateStr.slice(0, markerIndex).trim();
              const after = templateStr.slice(markerIndex + 2).trim();
              if (!before && !after) return null;
              return { before, after };
          };

          // [新增] 统一的条目内容生成器，支持在包裹模式下忽略自定义模板
          const buildEntryContent = (entryName, tableData, template, ignoreTemplate = false, fallbackTemplate = null, isSplitMode = false) => {
              let finalTemplate = ignoreTemplate ? null : template;
              if (!finalTemplate) {
                  if (fallbackTemplate) {
                      finalTemplate = fallbackTemplate;
                  } else if (isSplitMode) {
                      // 拆分模式下，不添加条目名称，只保留内容
                      finalTemplate = `$1`;
                  } else if (entryName === '重要人物表' || entryName === '总结表') {
                      finalTemplate = `# ${entryName}\n\n$1`;
                  } else {
                      finalTemplate = `# ${entryName}\n\n$1`;
                  }
              }
              return finalTemplate.replace('$1', tableData);
          };

          const buildMarkdownTableFromRows_ACU = (headerList, rowList) => {
              if (!Array.isArray(headerList) || headerList.length === 0) return '';
              const lines = [];
              lines.push(`| ${headerList.join(' | ')} |`);
              lines.push(`|${headerList.map(() => '---').join('|')}|`);
              (Array.isArray(rowList) ? rowList : []).forEach(row => {
                  const cells = headerList.map((_, idx) => {
                      const v = Array.isArray(row) ? row[idx] : '';
                      return v === null || v === undefined ? '' : String(v);
                  });
                  lines.push(`| ${cells.join(' | ')} |`);
              });
              return lines.join('\n');
          };

          const resolveExtraIndexSpec_ACU = (cfg, originalHeaders, rawRows, defaultName) => {
              if (!cfg || cfg.extraIndexEnabled !== true) return null;
              if (!Array.isArray(originalHeaders) || originalHeaders.length === 0) return null;
              const selectedRaw = Array.isArray(cfg.extraIndexColumns) ? cfg.extraIndexColumns : [];
              const selectedCols = [...new Set(selectedRaw.filter(col => typeof col === 'string' && originalHeaders.includes(col)))];
              if (selectedCols.length === 0) return null;

              const modeMap = (cfg.extraIndexColumnModes && typeof cfg.extraIndexColumnModes === 'object')
                  ? cfg.extraIndexColumnModes
                  : {};
              const selectedMeta = selectedCols.map(col => {
                  const idx = originalHeaders.indexOf(col);
                  const mode = modeMap[col] === 'index_only' ? 'index_only' : 'both';
                  return { name: col, idx, mode };
              }).filter(m => m.idx >= 0);
              if (selectedMeta.length === 0) return null;

              const indexCols = selectedMeta.map(m => m.name);
              const indexColIndexes = selectedMeta.map(m => m.idx);
              const indexOnlySet = new Set(selectedMeta.filter(m => m.mode === 'index_only').map(m => m.idx));
              const mainColIndexes = originalHeaders
                  .map((_, idx) => idx)
                  .filter(idx => !indexOnlySet.has(idx));
              const mainCols = mainColIndexes.map(idx => originalHeaders[idx]);
              const mapRowsByIndexes = (rows, indexes) => {
                  const safeRows = Array.isArray(rows) ? rows : [];
                  return safeRows.map(row => indexes.map(i => {
                      const v = Array.isArray(row) ? row[i] : '';
                      return v === null || v === undefined ? '' : String(v);
                  }));
              };

              return {
                  entryName: String(cfg.extraIndexEntryName || `${defaultName}-索引`).trim() || `${defaultName}-索引`,
                  indexCols,
                  indexRows: mapRowsByIndexes(rawRows, indexColIndexes),
                  mainCols,
                  mainRows: mapRowsByIndexes(rawRows, mainColIndexes),
              };
          };

          const buildExtraIndexEntryBlock_ACU = ({ exportPrefix, extraIndexSpec, templateStr, startOrder, placement, usedOrderSet, enabled = true }) => {
              if (!extraIndexSpec) return { entries: [], names: [], plans: [], nextOrder: startOrder, span: 0 };
              const cursor = allocOrder_ACU(usedOrderSet || usedOrders, startOrder, 1, 99999);
              const names = [];
              const plans = [];
              const entries = [];
              const fullTable = buildMarkdownTableFromRows_ACU(extraIndexSpec.indexCols, extraIndexSpec.indexRows);
              const fallbackTemplate = `# ${extraIndexSpec.entryName}\n\n$1`;
              // 自定义表格导出的附加索引条目：在注释名中加入统一标记，便于在世界书 UI 中识别为"数据库生成条目"并默认隐藏
              // [修复] 外部导入时只使用"外部导入-"前缀
              const mainComment = getImportEntryName(extraIndexSpec.entryName);
              const mainContent = buildEntryContent(
                  extraIndexSpec.entryName,
                  fullTable,
                  templateStr,
                  false,
                  fallbackTemplate
              );
              names.push(mainComment);
              const normalizedPlacement = normalizePlacementConfig_ACU(placement, DEFAULT_EXTRA_INDEX_PLACEMENT_ACU);
              plans.push({ comment: mainComment, order: cursor, placement: normalizedPlacement });
              // [修复] 0TK模式只控制"纪要索引"条目，其他表格的索引条目始终启用
              const finalEnabled = extraIndexSpec.entryName === '纪要索引' ? enabled : true;
              entries.push(applyPlacementToEntry_ACU({
                  comment: mainComment,
                  content: mainContent,
                  keys: [],
                  enabled: finalEnabled,
                  type: 'constant',
                  prevent_recursion: true,
                  order: cursor
              }, normalizedPlacement));

              return {
                  entries,
                  names,
                  plans,
                  nextOrder: cursor + 1,
                  span: entries.length,
              };
          };

          sortedTableKeys.forEach(sheetKey => {
              const table = mergedData[sheetKey];
              // Check for exportConfig
              // [修改] 增加 injectIntoWorldbook === false 的检查，如果被禁用，即使 enabled 为 true 也不导出
              if (!table || !table.exportConfig || !table.exportConfig.enabled) return;
              
              // [新增] 检查是否只导出索引条目（主条目不注入但索引条目启用）
              const mainEntryDisabled = table.exportConfig.injectIntoWorldbook === false;
              const hasExtraIndexEnabled = table.exportConfig.extraIndexEnabled === true;
              
              // 如果主条目和索引条目都不导出，则跳过
              if (mainEntryDisabled && !hasExtraIndexEnabled) return;

              const config = ensureExportConfigDefaults_ACU(table.exportConfig, table.name || sheetKey);
              const tableName = table.name;
              const entryPlacement = normalizePlacementConfig_ACU(config.entryPlacement, DEFAULT_ENTRY_PLACEMENT_ACU);
              const extraIndexPlacement = normalizePlacementConfig_ACU(config.extraIndexPlacement, DEFAULT_EXTRA_INDEX_PLACEMENT_ACU);
              const headers = table.content[0] ? table.content[0].slice(1) : [];
              const rows = table.content.slice(1).map(row => row.slice(1));
              const hasAnyNonEmptyExportCell_ACU = row => Array.isArray(row) && row.some(cell => {
                  const text = cell === null || cell === undefined ? '' : String(cell);
                  return text.trim() !== '';
              });
              const effectiveRows = rows.filter(hasAnyNonEmptyExportCell_ACU);
              const extraIndexSpec = resolveExtraIndexSpec_ACU(
                  config,
                  headers,
                  effectiveRows,
                  config.entryName || tableName || '表格'
              );
              const mainHeaders = extraIndexSpec ? extraIndexSpec.mainCols : headers;
              const mainRows = extraIndexSpec ? extraIndexSpec.mainRows : effectiveRows;
              
              // [新增] 检查是否有有效的索引条目数据
              const hasExtraIndex = hasExtraIndexEnabled && extraIndexSpec && extraIndexSpec.indexCols.length > 0 && extraIndexSpec.indexRows.length > 0;

              const wrapperParts = parseWrapperTemplate(config.injectionTemplate);
              const useWrapperEntries = !!wrapperParts;

              if (effectiveRows.length === 0 && !hasExtraIndex) return; // 仅存在空白行时不注入任何表格相关条目

              // [新增] 如果主条目禁用但索引条目启用，只处理索引条目
              if (mainEntryDisabled && hasExtraIndex) {
                  // 只导出索引条目
                  const extraBlock = buildExtraIndexEntryBlock_ACU({
                      exportPrefix,
                      extraIndexSpec,
                      templateStr: config.extraIndexInjectionTemplate,
                      startOrder: toIntOrFallback_ACU(extraIndexPlacement.order, nextCustomExportOrder),
                      placement: extraIndexPlacement,
                      usedOrderSet: usedOrders,
                      enabled: extraIndexEntryEnabled,
                  });
                  newGeneratedNames.push(...extraBlock.names);
                  postCreateOrderFixPlan.push(...extraBlock.plans);
                  entriesToCreate.push(...extraBlock.entries);
                  nextCustomExportOrder = extraBlock.nextOrder + CUSTOM_EXPORT_ORDER_GAP;
                  return; // 跳过主条目处理
              }

              // 准备表格数据内容 (Common logic)
              let tableContentMarkdown = "";
              if (config.splitByRow) {
                  // Will be handled inside loop
              } else {
                  // Whole table content
                  tableContentMarkdown = buildMarkdownTableFromRows_ACU(mainHeaders, mainRows);
              }

              if (config.splitByRow) {
                  // Split export: One entry per row
                  const rowEntries = [];
                  const hasWrapperBefore = !!(wrapperParts && wrapperParts.before);
                  const hasWrapperAfter = !!(wrapperParts && wrapperParts.after);
                  const use3DepthWrapperGroup = !!(useWrapperEntries && (hasWrapperBefore || hasWrapperAfter));
                  const needsHeader = (!use3DepthWrapperGroup && mainHeaders.length > 0);
                  const hasExtraIndexEntry = !!(extraIndexSpec && extraIndexSpec.indexCols.length > 0);
                  const blockSpan = (use3DepthWrapperGroup ? 3 : (needsHeader ? 2 : 1));
                  const leadingSlots = (use3DepthWrapperGroup && hasWrapperBefore) ? 1 : ((!useWrapperEntries && mainHeaders.length > 0) ? 1 : 0);
                  const preferredMainOrder = toIntOrFallback_ACU(entryPlacement.order, nextCustomExportOrder);
                  const preferredBlockStart = calcPreferredBlockStart_ACU(preferredMainOrder, leadingSlots, nextCustomExportOrder);
                  const baseOrder = allocConsecutiveOrderBlock_ACU(usedOrders, Math.max(1, blockSpan), preferredBlockStart, 1, 99999);
                  let orderCursor = baseOrder;
                  
                  // 准备表头markdown
                  const headerMarkdown = mainHeaders.length
                      ? `# ${tableName}\n\n${buildMarkdownTableFromRows_ACU(mainHeaders, [])}`
                      : `# ${tableName}`;

                  // 在拆分模式下，如果存在包裹模板，先追加前置常量条目（包含表头）
                  if (use3DepthWrapperGroup && hasWrapperBefore) {
                      // [修复] 外部导入时只使用"外部导入-"前缀
                      const wrapperName = getImportEntryName(`${(config.entryName || tableName)}-包裹-上`);
                      newGeneratedNames.push(wrapperName);
                      postCreateOrderFixPlan.push({ comment: wrapperName, order: orderCursor, placement: entryPlacement });
                      // 将表头添加到上包裹条目的内容中
                      const wrapperContent = [wrapperParts.before, headerMarkdown].filter(Boolean).join('\n\n').trim();
                      rowEntries.push(applyPlacementToEntry_ACU({
                          comment: wrapperName,
                          content: wrapperContent,
                          keys: [],
                          enabled: true,
                          type: 'constant',
                          prevent_recursion: true,
                          order: orderCursor++
                      }, entryPlacement));
                  } else if (!useWrapperEntries && mainHeaders.length > 0) {
                      // 如果没有包裹模板，但需要表头，单独创建一个表头条目
                      // [修复] 外部导入时只使用"外部导入-"前缀
                      const headerName = getImportEntryName(`${(config.entryName || tableName)}-表头`);
                      newGeneratedNames.push(headerName);
                      postCreateOrderFixPlan.push({ comment: headerName, order: orderCursor, placement: entryPlacement });
                      rowEntries.push(applyPlacementToEntry_ACU({
                          comment: headerName,
                          content: headerMarkdown,
                          keys: [],
                          enabled: true,
                          type: 'constant',
                          prevent_recursion: true,
                          order: orderCursor++
                      }, entryPlacement));
                  }

                  const dataOrder = orderCursor++;
                  mainRows.forEach((rowData, i) => {
                      
                      // Determine Entry Name
                      const entryName = config.entryName ? `${config.entryName}-${i + 1}` : `${tableName}-${i + 1}`;
                      
                      // Determine Keywords
                      let keys = [];
                      if (config.keywords) {
                          const keywordList = splitKeywordsByComma_ACU(config.keywords);
                          keywordList.forEach(k => {
                              // Check if keyword matches a column header
                              const colIndex = headers.indexOf(k);
                              if (colIndex !== -1) {
                                  // Use content from that column
                                  const rawRowData = rows[i] || [];
                                  const cellContent = rawRowData[colIndex];
                                  if (cellContent) {
                                      keys.push(...splitKeywordsByComma_ACU(cellContent));
                                  }
                              } else {
                                  // Use the keyword as is
                                  keys.push(k);
                              }
                          });
                      }
                      
                      if (config.entryType === 'keyword' && keys.length === 0) {
                          return; // Skip keyword entries without keywords
                      }

                      // Content Construction - 行条目只包含行数据，不包含表头
                      const rowTableMarkdown = mainHeaders.length > 0
                          ? `| ${rowData.join(' | ')} |\n`
                          : '';
                      const finalContent = buildEntryContent(
                          entryName,
                          rowTableMarkdown,
                          config.injectionTemplate,
                          useWrapperEntries,
                          null,
                          true // 拆分模式，不添加条目名称
                      );
                      
                      // [修复] 外部导入时只使用"外部导入-"前缀
                      const fullComment = getImportEntryName(entryName);
                      newGeneratedNames.push(fullComment); // 记录名称
                      postCreateOrderFixPlan.push({ comment: fullComment, order: dataOrder, placement: entryPlacement });

                      rowEntries.push(applyPlacementToEntry_ACU({
                          comment: fullComment, // [修改] 使用模板设置的名称作为条目名
                          content: finalContent,
                          keys: keys,
                          enabled: true,
                          type: config.entryType || 'constant',
                          prevent_recursion: config.preventRecursion !== false, // Default true
                          // [优化] 所有行条目共用同一个 dataOrder（不再每行占一个深度）
                          order: dataOrder
                      }, entryPlacement));
                  });

                  // 添加后置包裹常量条目
                  if (use3DepthWrapperGroup && hasWrapperAfter) {
                      // [修复] 外部导入时只使用"外部导入-"前缀
                      const wrapperName = getImportEntryName(`${(config.entryName || tableName)}-包裹-下`);
                      newGeneratedNames.push(wrapperName);
                      postCreateOrderFixPlan.push({ comment: wrapperName, order: orderCursor, placement: entryPlacement });
                      rowEntries.push(applyPlacementToEntry_ACU({
                          comment: wrapperName,
                          content: wrapperParts.after,
                          keys: [],
                          enabled: true,
                          type: 'constant',
                          prevent_recursion: true,
                          order: orderCursor++
                      }, entryPlacement));
                  }

                  if (hasExtraIndexEntry) {
                      const extraBlock = buildExtraIndexEntryBlock_ACU({
                          exportPrefix,
                          extraIndexSpec,
                          templateStr: config.extraIndexInjectionTemplate,
                          startOrder: toIntOrFallback_ACU(extraIndexPlacement.order, orderCursor),
                          placement: extraIndexPlacement,
                          usedOrderSet: usedOrders,
                          enabled: extraIndexEntryEnabled, // [修复] 传递0TK模式控制的enabled状态
                      });
                      newGeneratedNames.push(...extraBlock.names);
                      postCreateOrderFixPlan.push(...extraBlock.plans);
                      rowEntries.push(...extraBlock.entries);
                      orderCursor = extraBlock.nextOrder;
                  }

                  entriesToCreate.push(...rowEntries);
                  nextCustomExportOrder = orderCursor + CUSTOM_EXPORT_ORDER_GAP;

              } else {
                  if (extraIndexSpec) {
                      const entryName = config.entryName || tableName;
                      let keys = config.keywords ? splitKeywordsByComma_ACU(config.keywords) : [];
                      if (config.entryType === 'keyword' && keys.length === 0) return;

                      const hasWrapperBefore = !!(wrapperParts && wrapperParts.before);
                      const hasWrapperAfter = !!(wrapperParts && wrapperParts.after);
                      const useWrapperBlock = !!(useWrapperEntries && (hasWrapperBefore || hasWrapperAfter));
                      const needsHeader = (!useWrapperBlock && mainHeaders.length > 0);
                      const blockSize = (useWrapperBlock ? 2 : 0) + (needsHeader ? 1 : 0) + 1;
                      const leadingSlots = (useWrapperBlock && hasWrapperBefore) ? 1 : ((!useWrapperEntries && mainHeaders.length > 0) ? 1 : 0);
                      const preferredMainOrder = toIntOrFallback_ACU(entryPlacement.order, nextCustomExportOrder);
                      const preferredBlockStart = calcPreferredBlockStart_ACU(preferredMainOrder, leadingSlots, nextCustomExportOrder);
                      const baseOrder = allocConsecutiveOrderBlock_ACU(usedOrders, Math.max(1, blockSize), preferredBlockStart, 1, 99999);
                      let cursor = baseOrder;
                      const blockEntries = [];
                      const tableHeader = mainHeaders.length > 0
                          ? `# ${tableName}\n\n${buildMarkdownTableFromRows_ACU(mainHeaders, [])}`
                          : `# ${tableName}`;

                      if (useWrapperBlock && hasWrapperBefore) {
                          // [修复] 外部导入时只使用"外部导入-"前缀
                          const wrapperName = getImportEntryName(`${entryName}-包裹-上`);
                          const wrapperContent = [wrapperParts.before, tableHeader].filter(Boolean).join('\n\n').trim();
                          newGeneratedNames.push(wrapperName);
                          postCreateOrderFixPlan.push({ comment: wrapperName, order: cursor, placement: entryPlacement });
                          blockEntries.push(applyPlacementToEntry_ACU({
                              comment: wrapperName,
                              content: wrapperContent,
                              keys: [],
                              enabled: true,
                              type: 'constant',
                              prevent_recursion: true,
                              order: cursor++
                          }, entryPlacement));
                      } else if (!useWrapperEntries && mainHeaders.length > 0) {
                          // [修复] 外部导入时只使用"外部导入-"前缀
                          const headerName = getImportEntryName(`${entryName}-表头`);
                          newGeneratedNames.push(headerName);
                          postCreateOrderFixPlan.push({ comment: headerName, order: cursor, placement: entryPlacement });
                          blockEntries.push(applyPlacementToEntry_ACU({
                              comment: headerName,
                              content: tableHeader,
                              keys: [],
                              enabled: true,
                              type: 'constant',
                              prevent_recursion: true,
                              order: cursor++
                          }, entryPlacement));
                      }

                      const mainBody = buildMarkdownTableFromRows_ACU(mainHeaders, mainRows);
                      const mainContent = buildEntryContent(
                          entryName,
                          mainBody,
                          config.injectionTemplate,
                          useWrapperBlock,
                          '$1'
                      );
                      // [修复] 外部导入时只使用"外部导入-"前缀
                      const fullComment = getImportEntryName(entryName);
                      newGeneratedNames.push(fullComment);
                      postCreateOrderFixPlan.push({ comment: fullComment, order: cursor, placement: entryPlacement });
                      blockEntries.push(applyPlacementToEntry_ACU({
                          comment: fullComment,
                          content: mainContent,
                          keys: keys,
                          enabled: true,
                          type: config.entryType || 'constant',
                          prevent_recursion: config.preventRecursion !== false,
                          order: cursor++
                      }, entryPlacement));

                      if (useWrapperBlock && hasWrapperAfter) {
                          // [修复] 外部导入时只使用"外部导入-"前缀
                          const wrapperName = getImportEntryName(`${entryName}-包裹-下`);
                          newGeneratedNames.push(wrapperName);
                          postCreateOrderFixPlan.push({ comment: wrapperName, order: cursor, placement: entryPlacement });
                          blockEntries.push(applyPlacementToEntry_ACU({
                              comment: wrapperName,
                              content: wrapperParts.after,
                              keys: [],
                              enabled: true,
                              type: 'constant',
                              prevent_recursion: true,
                              order: cursor++
                          }, entryPlacement));
                      }

                      const extraBlock = buildExtraIndexEntryBlock_ACU({
                          exportPrefix,
                          extraIndexSpec,
                          templateStr: config.extraIndexInjectionTemplate,
                          startOrder: toIntOrFallback_ACU(extraIndexPlacement.order, cursor),
                          placement: extraIndexPlacement,
                          usedOrderSet: usedOrders,
                          enabled: extraIndexEntryEnabled, // [修复] 传递0TK模式控制的enabled状态
                      });
                      newGeneratedNames.push(...extraBlock.names);
                      postCreateOrderFixPlan.push(...extraBlock.plans);
                      blockEntries.push(...extraBlock.entries);
                      cursor = extraBlock.nextOrder;

                      entriesToCreate.push(...blockEntries);
                      nextCustomExportOrder = cursor + CUSTOM_EXPORT_ORDER_GAP;
                      return;
                  }

                  // Whole table export
                  const entryName = config.entryName || tableName;
                  let keys = config.keywords ? splitKeywordsByComma_ACU(config.keywords) : [];
                  
                  if (config.entryType === 'keyword' && keys.length === 0) return;

                  // [合并逻辑] 检查是否可以合并
                  // 条件：未开启 splitByRow (已满足), 相同 entryName, 相同 entryType, 相同 keywords
                  const mergeKey = `${entryName}|${config.entryType || 'constant'}|${keys.sort().join(',')}`;
                  
                  if (!mergedEntriesMap[mergeKey]) {
                      mergedEntriesMap[mergeKey] = {
                          entryName: entryName,
                          entryType: config.entryType || 'constant',
                          keywords: keys,
                          preventRecursion: config.preventRecursion !== false,
                          sheetKeys: [], // Track which sheets are merged
                          tableContents: [], // Store table contents separately
                          injectionTemplate: config.injectionTemplate, // Use the first one found
                          wrapperParts: wrapperParts,
                          useWrapperEntries: useWrapperEntries,
                          entryPlacement: entryPlacement
                      };
                  }
                  // 如果后续表格提供了包裹模板，则优先使用最新的非空包裹设置
                  if (!mergedEntriesMap[mergeKey].wrapperParts && wrapperParts) {
                      mergedEntriesMap[mergeKey].wrapperParts = wrapperParts;
                      mergedEntriesMap[mergeKey].useWrapperEntries = useWrapperEntries;
                  }
                  if (!mergedEntriesMap[mergeKey].injectionTemplate && config.injectionTemplate) {
                      mergedEntriesMap[mergeKey].injectionTemplate = config.injectionTemplate;
                  }
                  if (!mergedEntriesMap[mergeKey].entryPlacement) {
                      mergedEntriesMap[mergeKey].entryPlacement = entryPlacement;
                  }
                  
                  // Add current table content to merge group
                  mergedEntriesMap[mergeKey].sheetKeys.push(sheetKey);
                  // Store table headers for wrapper entry
                  if (!mergedEntriesMap[mergeKey].tableHeaders) {
                      mergedEntriesMap[mergeKey].tableHeaders = [];
                  }
                  mergedEntriesMap[mergeKey].tableHeaders.push({
                      name: tableName,
                      headers: headers
                  });
                  // Store table content without header (header will be in wrapper entry)
                  // tableContentMarkdown already contains header, so we need to extract only the rows
                  const rowsOnly = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
                  mergedEntriesMap[mergeKey].tableContents.push(rowsOnly);
                  
                  // If any merged table enforces recursion prevention, the whole entry should
                  if (config.preventRecursion === false) {
                      mergedEntriesMap[mergeKey].preventRecursion = false;
                  }
              }
          });

          // Process Merged Entries
          Object.keys(mergedEntriesMap).forEach(key => {
              const group = mergedEntriesMap[key];
              
              // Combine all table contents (without headers)
              const combinedTableData = group.tableContents.join('\n\n');

              const wrapperParts = group.useWrapperEntries ? group.wrapperParts : null;
              const useWrapperEntries = !!(group.useWrapperEntries && (wrapperParts?.before || wrapperParts?.after));
              const groupPlacement = normalizePlacementConfig_ACU(group.entryPlacement, DEFAULT_ENTRY_PLACEMENT_ACU);

              // 按需构造包裹与主体条目，保持合并表默认无标题的旧行为
              const blockEntries = [];
              // 准备所有合并表格的表头内容
              const allHeadersContent = group.tableHeaders ? group.tableHeaders.map(th => {
                  return `# ${th.name}\n\n| ${th.headers.join(' | ')} |\n|${th.headers.map(() => '---').join('|')}|`;
              }).join('\n\n') : '';

              // [修复] allHeadersContent 必须先计算，再用于 needsHeader（避免 TDZ/引用错误导致包裹与数据无法正确组合）
              const needsHeader = (!useWrapperEntries && !!allHeadersContent);
              // 合并组：最多 上包裹/表头 + 主体 + 下包裹
              const blockSize = (useWrapperEntries ? 2 : 0) + (needsHeader ? 1 : 0) + 1;
              const leadingSlots = (useWrapperEntries && wrapperParts?.before) ? 1 : ((!useWrapperEntries && !!allHeadersContent) ? 1 : 0);
              const preferredMainOrder = toIntOrFallback_ACU(groupPlacement.order, nextCustomExportOrder);
              const preferredBlockStart = calcPreferredBlockStart_ACU(preferredMainOrder, leadingSlots, nextCustomExportOrder);
              const baseOrder = allocConsecutiveOrderBlock_ACU(usedOrders, Math.max(1, blockSize), preferredBlockStart, 1, 99999);
              let cursor = baseOrder;

              if (useWrapperEntries && wrapperParts?.before) {
                  const wrapperName = `${exportPrefix}${group.entryName}-包裹-上`;
                  newGeneratedNames.push(wrapperName);
                  // 将表头添加到上包裹条目的内容中
                  const wrapperContent = [wrapperParts.before, allHeadersContent].filter(Boolean).join('\n\n').trim();
                  postCreateOrderFixPlan.push({ comment: wrapperName, order: cursor, placement: groupPlacement });
                  blockEntries.push(applyPlacementToEntry_ACU({
                      comment: wrapperName,
                      content: wrapperContent,
                      keys: [],
                      enabled: true,
                      type: 'constant',
                      prevent_recursion: true,
                      order: cursor++
                  }, groupPlacement));
              } else if (!useWrapperEntries && allHeadersContent) {
                  // 如果没有包裹模板，但需要表头，单独创建一个表头条目
                  const headerName = `${exportPrefix}${group.entryName}-表头`;
                  newGeneratedNames.push(headerName);
                  postCreateOrderFixPlan.push({ comment: headerName, order: cursor, placement: groupPlacement });
                  blockEntries.push(applyPlacementToEntry_ACU({
                      comment: headerName,
                      content: allHeadersContent,
                      keys: [],
                      enabled: true,
                      type: 'constant',
                      prevent_recursion: true,
                      order: cursor++
                  }, groupPlacement));
              }

              const finalContent = buildEntryContent(
                  group.entryName,
                  combinedTableData,
                  group.injectionTemplate,
                  useWrapperEntries,
                  '$1'
              );

              const fullComment = `${exportPrefix}${group.entryName}`;
              newGeneratedNames.push(fullComment); // 记录名称

              postCreateOrderFixPlan.push({ comment: fullComment, order: cursor, placement: groupPlacement });
              blockEntries.push(applyPlacementToEntry_ACU({
                  comment: fullComment, // [修改] 使用模板设置的名称作为条目名
                  content: finalContent,
                  keys: group.keywords,
                  enabled: true,
                  type: group.entryType,
                  prevent_recursion: group.preventRecursion,
                  order: cursor++
              }, groupPlacement));

              if (useWrapperEntries && wrapperParts?.after) {
                  const wrapperName = `${exportPrefix}${group.entryName}-包裹-下`;
                  newGeneratedNames.push(wrapperName);
                  postCreateOrderFixPlan.push({ comment: wrapperName, order: cursor, placement: groupPlacement });
                  blockEntries.push(applyPlacementToEntry_ACU({
                      comment: wrapperName,
                      content: wrapperParts.after,
                      keys: [],
                      enabled: true,
                      type: 'constant',
                      prevent_recursion: true,
                      order: cursor++
                  }, groupPlacement));
              }

              entriesToCreate.push(...blockEntries);
              nextCustomExportOrder = cursor + CUSTOM_EXPORT_ORDER_GAP;
          });

          if (entriesToCreate.length > 0) {
              await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, entriesToCreate);
              logDebug_ACU(`Successfully created ${entriesToCreate.length} new custom export entries.`);
              // [兜底] 创建完成后强制回写 order（通过 comment 找 uid）
              if (postCreateOrderFixPlan.length > 0) {
                  try {
                      const latest = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
                      const byComment = new Map();
                      latest.forEach(e => {
                          if (e?.comment) byComment.set(e.comment, e);
                      });
                      const updates = [];
                      postCreateOrderFixPlan.forEach(p => {
                          const e = byComment.get(p.comment);
                          if (e?.uid != null && Number.isFinite(p.order)) {
                              const fixed = applyPlacementToEntry_ACU({ uid: e.uid, order: p.order }, p.placement || DEFAULT_ENTRY_PLACEMENT_ACU);
                              updates.push(fixed);
                          }
                      });
                      if (updates.length > 0) {
                          await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, updates);
                      }
                  } catch (e) {
                      logWarn_ACU('[CustomExportOrderFix] Failed to enforce grouped orders for split exports:', e);
                  }
              }
          }
          
          // [新增] 更新并保存 knownCustomEntryNames（外部导入模式不写入，避免绑定第三方世界书）
          if (!isImport) {
          // 将本次新生成的名称添加到列表 (前面已经过滤掉了旧的同隔离环境名称)
          settings_ACU.knownCustomEntryNames = [...knownNames, ...newGeneratedNames];
              // 去重
          settings_ACU.knownCustomEntryNames = [...new Set(settings_ACU.knownCustomEntryNames)];
          saveSettings_ACU();
          logDebug_ACU(`Updated knownCustomEntryNames. Count: ${settings_ACU.knownCustomEntryNames.length}`);
          }

      } catch (error) {
          logError_ACU('Failed to update custom table export entries:', error);
      }
  }

  async function updateImportantPersonsRelatedEntries_ACU(importantPersonsTable, isImport = false) { // [外部导入] 添加 isImport 标志
    if (!TavernHelper_API_ACU) return;
    const primaryLorebookName = await getInjectionTargetLorebook_ACU();
    if (!primaryLorebookName) {
        logWarn_ACU('Cannot update important persons entries: No injection target lorebook set.');
        return;
    }

    const IMPORT_PREFIX = getImportBatchPrefix_ACU();
    // [修改] 加入隔离标识前缀
    const isoPrefix = getIsolationPrefix_ACU();
    const basePersonEntryPrefix = isImport ? `${IMPORT_PREFIX}重要人物条目` : '重要人物条目';
    const PERSON_ENTRY_PREFIX = isoPrefix + basePersonEntryPrefix;
    const basePersonIndexComment = isImport ? `${IMPORT_PREFIX}TavernDB-ACU-ImportantPersonsIndex` : 'TavernDB-ACU-ImportantPersonsIndex';
    const PERSON_INDEX_COMMENT = isoPrefix + basePersonIndexComment;
    const personsCfg = ensureExportConfigDefaults_ACU(importantPersonsTable?.exportConfig, importantPersonsTable?.name || '重要人物表');
    const personsEntryPlacement = normalizePlacementConfig_ACU(
        personsCfg.fixedEntryPlacement,
        getFixedPlacementDefaultsForTable_ACU(importantPersonsTable?.name || '重要人物表').entry
    );
    const personsIndexPlacement = normalizePlacementConfig_ACU(
        personsCfg.fixedIndexPlacement,
        getFixedPlacementDefaultsForTable_ACU(importantPersonsTable?.name || '重要人物表').index
    );

    try {
        const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
        const usedOrders = buildUsedOrderSet_ACU(allEntries);
        
        // --- 1. 全量删除 ---
        // 用户要求：外部导入每次导入前不清理（允许多批并存，避免后一批覆盖前一批）
        if (!isImport) {
            // 找出所有由插件管理的旧条目 (人物条目 + 索引条目)
            const uidsToDelete = allEntries
                .filter(e => e.comment && (e.comment.startsWith(PERSON_ENTRY_PREFIX) || e.comment === PERSON_INDEX_COMMENT || e.comment.includes('PersonsHeader')))
                .map(e => e.uid);

            if (uidsToDelete.length > 0) {
                await TavernHelper_API_ACU.deleteLorebookEntries(primaryLorebookName, uidsToDelete);
                logDebug_ACU(`Deleted ${uidsToDelete.length} old person-related lorebook entries.`);
            }
        }

        // --- 2. 全量重建 ---
        const personRows = (importantPersonsTable?.content?.length > 1) ? importantPersonsTable.content.slice(1) : [];
        if (personRows.length === 0) {
            logDebug_ACU('No important persons to create entries for.');
            return; // 如果没有人物，删除后直接返回
        }

        const headers = importantPersonsTable.content[0].slice(1);
        const nameColumnIndex = headers.indexOf('姓名') !== -1 ? headers.indexOf('姓名') : headers.indexOf('角色名');
        if (nameColumnIndex === -1) {
            logError_ACU('Cannot find "姓名" or "角色名" column in 重要人物表. Cannot process person entries.');
            return;
        }

        const personEntriesToCreate = [];
        const personNames = [];

        // 2.1 准备要创建的人物条目
        const buildPersonNameKeywords_ACU = (rawName) => {
            const raw = String(rawName || '').trim();
            if (!raw) return [];
            const baseParts = splitKeywordsByComma_ACU(raw);
            const parts = baseParts.length > 0 ? baseParts : [raw];
            const keys = [];
            parts.forEach(part => {
                if (!part) return;
                keys.push(part);
                const bracketMatch = part.match(/^([^（(]+)[（(]/);
                if (bracketMatch) {
                    const nameBeforeBracket = bracketMatch[1].trim();
                    if (nameBeforeBracket && nameBeforeBracket !== part) {
                        keys.push(nameBeforeBracket);
                    }
                }
            });
            return [...new Set(keys)];
        };

        personRows.forEach((row, i) => {
            const rowData = row.slice(1);
            const personName = rowData[nameColumnIndex];
            if (!personName) return;
            personNames.push(personName);

            // [优化] 生成关键词：英文逗号分割为多关键词；每个关键词保留括号前的部分
            const keys = buildPersonNameKeywords_ACU(personName);

            const content = `| ${rowData.join(' | ')} |`
            const newEntryData = applyPlacementToEntry_ACU({
                comment: `${PERSON_ENTRY_PREFIX}${i + 1}`,
                content: content,
                keys: keys,
                enabled: true,
                type: 'keyword',
                // [优化] order(插入深度) 避免与任何现有条目重复（人物条目按序分配）
                order: null,
                prevent_recursion: true
            }, personsEntryPlacement);
            personEntriesToCreate.push(newEntryData);
        });



        // 2.1.5 创建重要人物表表头条目
        const personsHeaderContent = `# ${importantPersonsTable.name}\n\n| ${headers.join(' | ')} |\n|${headers.map(() => '---').join('|')}|`;
        const personsHeaderEntryData = applyPlacementToEntry_ACU({
            // [修复] 外部导入时 PersonsHeader 也必须带外部导入前缀，避免被清理逻辑误删
            comment: isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-PersonsHeader` : 'TavernDB-ACU-PersonsHeader'),
            content: personsHeaderContent,
            keys: [isoPrefix + (isImport ? `${IMPORT_PREFIX}TavernDB-ACU-PersonsHeader-Key` : 'TavernDB-ACU-PersonsHeader-Key')],
            enabled: true,
            type: 'constant',
            order: null,
            prevent_recursion: true
        }, personsEntryPlacement);
        personEntriesToCreate.unshift(personsHeaderEntryData);

        // 2.2 准备要创建的索引条目
        let indexContent = "# 以下是之前剧情中登场过的角色\n\n";
        indexContent += `| ${headers[nameColumnIndex]} |\n|---|\n` + personNames.map(name => `| ${name} |`).join('\n');
        // indexContent 已是纯文本，由 Wrapper 条目包裹

        const indexEntryData = {
            comment: PERSON_INDEX_COMMENT,
            content: indexContent,
            keys: [PERSON_INDEX_COMMENT + "-Key"],
            enabled: true,
            type: 'constant',
            order: null,
            prevent_recursion: true
        };
        
        // 3. 执行创建
        // [优化] 重要人物表 3-depth 成组对齐：
        // - PersonsHeader / 人物行条目 / PersonsIndex 只占用连续 3 个 order(深度)
        // - 人物行条目共用同一个深度（不再每人占一个深度）
        const personsOrderBlockBase = allocConsecutiveOrderBlock_ACU(usedOrders, 3, Math.max(1, personsEntryPlacement.order - 1), 1, 99999);
        personEntriesToCreate[0].order = personsOrderBlockBase; // header
        for (let i = 1; i < personEntriesToCreate.length; i++) {
            personEntriesToCreate[i].order = personsOrderBlockBase + 1; // all persons share
        }
        indexEntryData.order = personsOrderBlockBase + 2; // index/footer
        const allCreates = [...personEntriesToCreate, applyPlacementToEntry_ACU(indexEntryData, personsIndexPlacement)];
        if (allCreates.length > 0) {
            await TavernHelper_API_ACU.createLorebookEntries(primaryLorebookName, allCreates);
            logDebug_ACU(`Successfully created ${allCreates.length} new person-related entries.`);
            // [兜底] 创建完成后强制回写 order，避免创建接口自动改写导致仍然“每人一深度”
            try {
                const latest = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
                const header = latest.find(e => e.comment === personsHeaderEntryData.comment);
                const index = latest.find(e => e.comment === PERSON_INDEX_COMMENT);
                const rows = latest.filter(e => (e?.comment || '').startsWith(PERSON_ENTRY_PREFIX));
                const updates = [];
                if (header?.uid) updates.push(applyPlacementToEntry_ACU({ uid: header.uid, order: personsOrderBlockBase }, personsEntryPlacement));
                rows.forEach(e => { if (e?.uid) updates.push(applyPlacementToEntry_ACU({ uid: e.uid, order: personsOrderBlockBase + 1 }, personsEntryPlacement)); });
                if (index?.uid) updates.push(applyPlacementToEntry_ACU({ uid: index.uid, order: personsOrderBlockBase + 2 }, personsIndexPlacement));
                if (updates.length > 0) {
                    await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, updates);
                }
            } catch (e) {
                logWarn_ACU('[PersonsOrderFix] Failed to enforce grouped orders for important persons:', e);
            }
        }

    } catch(error) {
        logError_ACU('Failed to update important persons related lorebook entries:', error);
    }
  }

  // [重构] 获取当前隔离标签的键名
  // 无标签使用空字符串 "" 作为键名，有标签则使用标签代码
  function getCurrentIsolationKey_ACU() {
      return settings_ACU.dataIsolationEnabled ? (settings_ACU.dataIsolationCode || '') : '';
  }

  // [重构] 独立表格保存逻辑
  // updateGroupKeys: 参与本次合并更新的所有表格 key（用于判断合并更新是否整体成功）
  // [数据隔离核心] 使用按标签分组的存储结构，确保不同标签的数据完全独立
  async function saveIndependentTableToChatHistory_ACU(targetMessageIndex = -1, targetSheetKeys = null, updateGroupKeys = null, skipPostRefresh = false) {
    if (!currentJsonTableData_ACU) {
        logError_ACU('Save aborted: currentJsonTableData_ACU is null.');
        return false;
    }

    const chat = SillyTavern_API_ACU.chat;
    if (!chat || chat.length === 0) {
        logError_ACU('Save failed: Chat history is empty.');
        return false;
    }

    let targetMessage = null;
    let finalIndex = -1;

    if (targetMessageIndex !== -1 && chat[targetMessageIndex] && !chat[targetMessageIndex].is_user) {
        targetMessage = chat[targetMessageIndex];
        finalIndex = targetMessageIndex;
    } else {
        for (let i = chat.length - 1; i >= 0; i--) {
            if (!chat[i].is_user) {
                targetMessage = chat[i];
                finalIndex = i;
                break;
            }
        }
    }

    if (!targetMessage) {
        logWarn_ACU('Save failed: No AI message found.');
        return false;
    }

    // [数据隔离核心] 获取当前隔离标签键名
    // 无标签使用空字符串 ""，有标签使用标签代码
    const currentIsolationKey = getCurrentIsolationKey_ACU();

    // [新增] 首次填表后：在聊天记录第一层写入“空白指导表”（仅表头+参数，无数据行）
    // 说明：只在当前隔离标签槽位未存在时写入；后续不会自动覆盖，避免无意漂移
    try {
        const existingGuide = getChatSheetGuideDataForIsolationKey_ACU(currentIsolationKey);
        if (!existingGuide || !Object.keys(existingGuide).some(k => k.startsWith('sheet_'))) {
            // 需求1：首次生成指导表时，把模板预置数据写入指导表基础数据(seedRows)
            const templateObjForSeed = parseTableTemplateJson_ACU({ stripSeedRows: false });
            const guideData = buildChatSheetGuideDataFromData_ACU(currentJsonTableData_ACU, {
                preserveSeedRowsFromGuideData: null,
                seedRowsFromTemplateObj: templateObjForSeed,
            });
            if (guideData && Object.keys(guideData).some(k => k.startsWith('sheet_'))) {
                setChatSheetGuideDataForIsolationKey_ACU(currentIsolationKey, guideData, { reason: 'first_fill' });
                logDebug_ACU(`[SheetGuide] Created chat sheet guide for tag [${currentIsolationKey || '无标签'}] (tables=${Object.keys(guideData).filter(k => k.startsWith('sheet_')).length}).`);
            }
        }
    } catch (e) {
        logWarn_ACU('[SheetGuide] Failed to create sheet guide on first fill:', e);
    }

    // [数据隔离核心] 使用按标签分组的存储结构
    // 结构: targetMessage.TavernDB_ACU_IsolatedData = { 
    //   "": { independentData: {...}, modifiedKeys: [...], updateGroupKeys: [...] },  // 无标签
    //   "tag1": { independentData: {...}, modifiedKeys: [...], updateGroupKeys: [...] }  // 标签1
    // }
    let isolatedData = targetMessage.TavernDB_ACU_IsolatedData ? JSON.parse(JSON.stringify(targetMessage.TavernDB_ACU_IsolatedData)) : {};
    
    // 获取或创建当前标签的数据槽
    if (!isolatedData[currentIsolationKey]) {
        isolatedData[currentIsolationKey] = {
            independentData: {},
            modifiedKeys: [],
            updateGroupKeys: []
        };
    }
    
    let currentTagData = isolatedData[currentIsolationKey];
    let independentData = currentTagData.independentData || {};

    // [重要] 记录本次实际被修改的表格 key（用于轮次计数）
    const actuallyModifiedKeys = targetSheetKeys ? [...targetSheetKeys] : [];

    // 确定要保存哪些表
    let keysToSave = targetSheetKeys;
    
    // 如果没有指定要更新哪些表，则默认更新所有（兼容旧逻辑）
    if (!keysToSave) {
        keysToSave = getSortedSheetKeys_ACU(currentJsonTableData_ACU);
    }

    keysToSave.forEach(sheetKey => {
        const table = currentJsonTableData_ACU[sheetKey];
        if (table) {
            // [瘦身] 写入聊天记录的本地表格数据时清洗冗余字段
            independentData[sheetKey] = sanitizeSheetForStorage_ACU(JSON.parse(JSON.stringify(table)));
        }
    });

    // 更新当前标签的数据槽
    currentTagData.independentData = independentData;
    
    // 记录实际被修改的表格 key
    if (actuallyModifiedKeys.length > 0) {
        const existingModifiedKeys = currentTagData.modifiedKeys || [];
        currentTagData.modifiedKeys = [...new Set([...existingModifiedKeys, ...actuallyModifiedKeys])];
        logDebug_ACU(`[Tracking] Recorded modified keys for tag [${currentIsolationKey || '无标签'}] at index ${finalIndex}: ${currentTagData.modifiedKeys.join(', ')}`);
    }
    
    // 记录参与合并更新的表格组
    if (updateGroupKeys && updateGroupKeys.length > 0 && actuallyModifiedKeys.length > 0) {
        const existingGroupKeys = currentTagData.updateGroupKeys || [];
        currentTagData.updateGroupKeys = [...new Set([...existingGroupKeys, ...updateGroupKeys])];
        logDebug_ACU(`[Merge Update Success] Group keys for tag [${currentIsolationKey || '无标签'}] recorded at index ${finalIndex}: ${currentTagData.updateGroupKeys.join(', ')}`);
    } else if (updateGroupKeys && updateGroupKeys.length > 0 && actuallyModifiedKeys.length === 0) {
        logDebug_ACU(`[Merge Update Failed] No tables were modified for tag [${currentIsolationKey || '无标签'}]. Group keys NOT recorded: ${updateGroupKeys.join(', ')}`);
    }

    // 写入消息对象（按标签分组存储）
    isolatedData[currentIsolationKey] = currentTagData;
    targetMessage.TavernDB_ACU_IsolatedData = isolatedData;

    // [兼容性] 同时更新旧的存储格式（仅用于当前标签）
    // 设置标识代码以标记这条消息最后是由哪个标签保存的（用于旧版兼容）
    if (settings_ACU.dataIsolationEnabled) {
         targetMessage.TavernDB_ACU_Identity = settings_ACU.dataIsolationCode;
    } else {
         delete targetMessage.TavernDB_ACU_Identity;
    }
    
    // 更新旧格式的独立数据（仅当前标签）
    targetMessage.TavernDB_ACU_IndependentData = independentData;
    targetMessage.TavernDB_ACU_ModifiedKeys = currentTagData.modifiedKeys;
    targetMessage.TavernDB_ACU_UpdateGroupKeys = currentTagData.updateGroupKeys;

    logDebug_ACU(`Saved ${keysToSave.length} tables for tag [${currentIsolationKey || '无标签'}] to message at index ${finalIndex}. Actually modified: ${actuallyModifiedKeys.length} tables.`);

    // [兼容性] 为了保持向后兼容，更新旧的标准表/总结表字段
    const legacyStandardData = { mate: { type: 'chatSheets', version: 1 } };
    const legacySummaryData = { mate: { type: 'chatSheets', version: 1 } };
    
    keysToSave.forEach(sheetKey => {
        const table = currentJsonTableData_ACU[sheetKey];
        if (table) {
            if (isSummaryOrOutlineTable_ACU(table.name)) {
                legacySummaryData[sheetKey] = sanitizeSheetForStorage_ACU(JSON.parse(JSON.stringify(table)));
            } else {
                legacyStandardData[sheetKey] = sanitizeSheetForStorage_ACU(JSON.parse(JSON.stringify(table)));
            }
        }
    });
    
    if (Object.keys(legacyStandardData).some(k => k.startsWith('sheet_'))) {
        targetMessage.TavernDB_ACU_Data = legacyStandardData;
    }
    if (Object.keys(legacySummaryData).some(k => k.startsWith('sheet_'))) {
        targetMessage.TavernDB_ACU_SummaryData = legacySummaryData;
    }

    await SillyTavern_API_ACU.saveChat();
    
    // [修复] 增加延时，确保文件系统写入完成
    await new Promise(resolve => setTimeout(resolve, 500));

    // 保存后刷新内存和通知（可选跳过，用于批量保存时避免中间刷新导致UI回退）
    if (!skipPostRefresh) {
        await refreshMergedDataAndNotify_ACU();
    }

    return true;
  }

  /**
   * [优化] 检查是否是首次初始化（聊天记录中没有任何当前标签的数据库记录）
   * 用于判断是否需要保存完整的模板结构
   */
  async function checkIfFirstTimeInit_ACU() {
    const chat = SillyTavern_API_ACU.chat;
    if (!chat || chat.length === 0) return true;
    
    const currentIsolationKey = getCurrentIsolationKey_ACU();
    
    for (let i = chat.length - 1; i >= 0; i--) {
        const message = chat[i];
        if (message.is_user) continue;
        
        // 检查新版按标签分组存储
        if (message.TavernDB_ACU_IsolatedData && message.TavernDB_ACU_IsolatedData[currentIsolationKey]) {
            const tagData = message.TavernDB_ACU_IsolatedData[currentIsolationKey];
            if (tagData.independentData && Object.keys(tagData.independentData).some(k => k.startsWith('sheet_'))) {
                return false; // 找到了数据，不是首次初始化
            }
        }
        
        // 兼容旧版存储格式
        if (message.TavernDB_ACU_IndependentData) {
            const msgIdentity = message.TavernDB_ACU_Identity;
            let isMatch = false;
            if (settings_ACU.dataIsolationEnabled) {
                isMatch = (msgIdentity === settings_ACU.dataIsolationCode);
            } else {
                isMatch = !msgIdentity;
            }
            if (isMatch && Object.keys(message.TavernDB_ACU_IndependentData).some(k => k.startsWith('sheet_'))) {
                return false; // 找到了数据，不是首次初始化
            }
        }
    }
    
    return true; // 没找到任何数据，是首次初始化
  }

  async function initializeJsonTableInChatHistory_ACU() {
    logDebug_ACU('No database found in chat history. Initializing a new one from template.');
    
    // 步骤2：安全地在内存中创建数据库
    try {
        // [修复] 初始化内存数据库时，只使用“表结构”（避免模板自带数据被当作当前数据）
        currentJsonTableData_ACU = parseTableTemplateJson_ACU({ stripSeedRows: true });
        logDebug_ACU('Successfully initialized database in memory.');
    } catch (error) {
        logError_ACU('Failed to parse template and initialize database in memory:', error);
        showToastr_ACU('error', '从模板解析数据库失败，请检查模板格式。');
        currentJsonTableData_ACU = null;
        return false;
    }
    if (!currentJsonTableData_ACU) {
        showToastr_ACU('error', '从模板解析数据库失败，请检查模板格式。');
        return false;
    }

    // [逻辑优化] 不再将空白模板保存到聊天记录中。
    // 数据库将在内存中初始化，并在第一次成功更新后，连同更新内容一起保存到对应的AI消息中。
    logDebug_ACU('Database initialized in memory. It will be saved to chat history on the first update.');

    // [新增] 新对话初始化阶段：确保"第一层空白指导表"存在，并把模板预置数据写入 seedRows 字段
    // 关键点：只写 seedRows 字段，不写入 content（避免新对话误显示为"已有数据"）
    try {
        const guideData = await ensureChatSheetGuideSeeded_ACU({ reason: 'init_chat_seedrows' });
        // 同步把 seedRows 字段挂到 currentJsonTableData_ACU（只挂字段，不改变 content），确保新对话首次 $0 就能读到
        if (guideData) {
            attachSeedRowsToCurrentDataFromGuide_ACU(guideData);
        }
    } catch (e) {
        logWarn_ACU('[SheetGuide] Failed to ensure sheet guide during initialization:', e);
    }

    // 步骤4：删除所有由本插件生成的旧世界书条目
    try {
        await deleteAllGeneratedEntries_ACU();
        logDebug_ACU('Deleted all generated lorebook entries during initialization.');
    } catch (deleteError) {
        logWarn_ACU('Failed to delete generated lorebook entries during initialization:', deleteError);
    }
    
    return true;
  }

  async function loadOrCreateJsonTableFromChatHistory_ACU() {
    currentJsonTableData_ACU = null; // Reset before loading
    logDebug_ACU('Attempting to load database from chat history...');

    const chat = SillyTavern_API_ACU.chat;
    applyTemplateScopeForCurrentChat_ACU();
    if (!chat || chat.length === 0) {
      logDebug_ACU('Chat history is empty. Initializing new database.');
      await initializeJsonTableInChatHistory_ACU();
      return;
    }

    // [重构] 统一使用按标签合并逻辑读取当前标签的数据
    // 无标签也是标签的一种，因此直接调用 mergeAllIndependentTables_ACU
    const mergedData = await mergeAllIndependentTables_ACU();

    if (mergedData) {
        currentJsonTableData_ACU = mergedData;
        logDebug_ACU('Database content successfully merged (tag-aware) and loaded into memory.');
        await refreshMergedDataAndNotify_ACU();
        return;
    }

    // If we get here, no data was found in the entire chat history
    logDebug_ACU('No database found for current tag in chat history. Initializing a new one.');
    await initializeJsonTableInChatHistory_ACU();
    if (currentJsonTableData_ACU) {
        await refreshMergedDataAndNotify_ACU();
    }
  }

  function mainInitialize_ACU() {
    console.log('ACU_INIT_DEBUG: mainInitialize_ACU called.');
    if (attemptToLoadCoreApis_ACU()) {
      logDebug_ACU('AutoCardUpdater Initialization successful! Core APIs loaded.');
      showToastr_ACU('success', '数据库自动更新脚本已加载！', '脚本启动');

      addAutoCardMenuItem_ACU();
      loadSettings_ACU();
      if (
        SillyTavern_API_ACU &&
        SillyTavern_API_ACU.eventSource &&
        typeof SillyTavern_API_ACU.eventSource.on === 'function' &&
        SillyTavern_API_ACU.eventTypes
      ) {
        // [调试] 检查可用的事件类型
        logDebug_ACU('[提示词模板] 可用的事件类型:', Object.keys(SillyTavern_API_ACU.eventTypes));
        
        // [提示词模板] 监听 CHAT_COMPLETION_SETTINGS_READY 事件，使用 makeLast 确保在 st-prompt-template 之后执行
        if (SillyTavern_API_ACU.eventTypes.CHAT_COMPLETION_SETTINGS_READY) {
          // 检查是否有 makeLast 方法
          if (typeof SillyTavern_API_ACU.eventSource.makeLast === 'function') {
            SillyTavern_API_ACU.eventSource.makeLast(
              SillyTavern_API_ACU.eventTypes.CHAT_COMPLETION_SETTINGS_READY,
              handleChatCompletionReady_ACU
            );
            logDebug_ACU('[提示词模板] 已注册 CHAT_COMPLETION_SETTINGS_READY 事件监听（makeLast）');
          } else {
            // 如果没有 makeLast，使用普通 on
            SillyTavern_API_ACU.eventSource.on(
              SillyTavern_API_ACU.eventTypes.CHAT_COMPLETION_SETTINGS_READY,
              handleChatCompletionReady_ACU
            );
            logDebug_ACU('[提示词模板] 已注册 CHAT_COMPLETION_SETTINGS_READY 事件监听（on）');
          }
        }
        
        SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes.CHAT_CHANGED, async chatFileName => {
          logDebug_ACU(`ACU CHAT_CHANGED event: ${chatFileName}`);
          await resetScriptStateForNewChat_ACU(chatFileName);

          // [触发门控] 切换聊天时清空“用户发送/生成上下文”，避免跨聊天误触发
          generationGate_ACU.lastUserMessageId = null;
          generationGate_ACU.lastUserMessageText = '';
          generationGate_ACU.lastUserMessageAt = 0;
          generationGate_ACU.lastUserSendIntentAt = 0;
          generationGate_ACU.lastGeneration = null;

          // [触发门控] 每次切换聊天都尝试安装一次 capture 钩子（防止 DOM 重新渲染导致丢失）
          installSendIntentCaptureHooks_ACU();

          // [剧情推进] 切换聊天时停止循环并加载预设
          if (loopState_ACU.isLooping) {
            stopAutoLoop_ACU();
            showToastr_ACU('info', '切换聊天，自动化循环已停止。');
          }
          await loadPresetAndCleanCharacterData_ACU();

          // [剧情推进] TavernHelper钩子：拦截直接的JS调用
          if (!window.original_TavernHelper_generate_ACU) {
            if (window.TavernHelper && typeof window.TavernHelper.generate === 'function') {
              window.original_TavernHelper_generate_ACU = window.TavernHelper.generate;
              window.TavernHelper.generate = async function (...args) {
                const options = args[0] || {};

                // 注意：TavernHelper.generate 常用于脚本/插件直接触发，这里不依赖“发送意图”，只过滤 quiet/automatic_trigger。
                if (isQuietLikeGeneration_ACU('tavernhelper', { quiet_prompt: options.quiet_prompt }) || options.automatic_trigger) {
                  return window.original_TavernHelper_generate_ACU.apply(this, args);
                }

                if (!settings_ACU.plotSettings.enabled || isProcessing_Plot_ACU || loopState_ACU.isRetrying || options.should_stream) {
                  return window.original_TavernHelper_generate_ACU.apply(this, args);
                }

                let userMessage = options.user_input || options.prompt;
                if (options.injects?.[0]?.content) {
                  userMessage = options.injects[0].content;
                }
                // 记录本次拦截，供 GENERATION_AFTER_COMMANDS 去重
                markPlotIntercept_ACU(userMessage);

                try {
                  if (userMessage) {
                    isProcessing_Plot_ACU = true;
                    try {
                      // [优化] 传递原始用户输入用于哈希匹配
                      // 注意：在 TavernHelper.generate 钩子中，userMessage 就是原始用户输入
                      const finalMessage = await runOptimizationLogic_ACU(userMessage, {
                        originalUserInput: userMessage,
                        hasExistingUserMessage: false,
                      });

                      // 去重互斥：若本次被判定为重复触发，则不改写 prompt，继续走原始生成
                      if (finalMessage && finalMessage.skipped) {
                        logDebug_ACU('[剧情推进] Planning skipped in TavernHelper.generate hook (duplicate).');
                        isProcessing_Plot_ACU = false;
                        return await window.original_TavernHelper_generate_ACU.apply(this, args);
                      }

                      // 检查是否被中止
                      if (finalMessage && finalMessage.aborted) {
                        logDebug_ACU('[剧情推进] Generation aborted by user.');
                        // 中止剧情规划不应中断酒馆的正常生成流程：直接走原始生成（不改写prompt）
                        isProcessing_Plot_ACU = false;
                        return await window.original_TavernHelper_generate_ACU.apply(this, args);
                      }

                      // 如果是在循环模式下且规划未返回有效字符串，视为规划失败，按循环重试次数重试
                      if (
                        loopState_ACU.isLooping &&
                        loopState_ACU.awaitingReply &&
                        (!finalMessage || typeof finalMessage !== 'string')
                      ) {
                        logWarn_ACU('[剧情推进] [Loop] 规划未产生有效回复，按循环重试规则重试。');
                        const loopSettings = settings_ACU.plotSettings.loopSettings || DEFAULT_PLOT_SETTINGS_ACU.loopSettings;
                        loopState_ACU.awaitingReply = false;
                        await enterLoopRetryFlow_ACU({ loopSettings, shouldDeleteAiReply: false });
                        return;
                      }

                      if (finalMessage && typeof finalMessage === 'string') {
                        // 根据来源写回
                        if (options.injects?.[0]?.content) {
                          options.injects[0].content = finalMessage;
                        } else if (options.prompt) {
                          options.prompt = finalMessage;
                        } else {
                          options.user_input = finalMessage;
                        }
                        // 添加标志，防止 GENERATION_AFTER_COMMANDS 重复处理
                        options._qrf_processed_by_hook = true;
                      }
                    } catch (error) {
                      logError_ACU('[剧情推进] Error in TavernHelper.generate hook:', error);
                    } finally {
                      isProcessing_Plot_ACU = false;
                    }
                  }

                  // 关键：等待原始生成完成后再恢复 AI 指令预设
                  return await window.original_TavernHelper_generate_ACU.apply(this, args);
                } catch (error) {
                  logError_ACU('[剧情推进] Error in TavernHelper.generate hook:', error);
                  return window.original_TavernHelper_generate_ACU.apply(this, args);
                }
              };
              logDebug_ACU('[剧情推进] TavernHelper.generate hook registered.');
            }
          }
          
          // [新增] 切换角色卡（聊天）时，强制从新聊天记录的本地数据读取最新的表格并刷新UI
          logDebug_ACU('ACU: Chat changed, forcing reload of table data from new chat history.');
          const scheduledChatIdentifier_ACU = cleanChatName_ACU(chatFileName);

          // 稍作延迟以确保SillyTavern已完全加载新聊天的消息列表
          setTimeout(async () => {
             if (scheduledChatIdentifier_ACU && currentChatFileIdentifier_ACU !== scheduledChatIdentifier_ACU) {
                 logDebug_ACU(`ACU: Skip delayed chat refresh because active chat already changed to "${currentChatFileIdentifier_ACU || '未知'}".`);
                 return;
             }

             applyTemplateScopeForCurrentChat_ACU();
 
            // 3. 刷新所有UI（包括可视化编辑器）和世界书
            await refreshMergedDataAndNotify_ACU();
            if ($popupInstance_ACU && $popupInstance_ACU.length) {
                loadTemplatePresetSelect_ACU({ keepGlobalValue: false });
            }
            
            // [新增] 再次强制刷新可视化编辑器，确保万无一失
            jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data');
            
            // [新增] 再次强制刷新状态显示，确保UI同步
            if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
                updateCardUpdateStatusDisplay_ACU();
            }
            
            logDebug_ACU('ACU: Chat data reload and UI refresh triggered after chat change (Delayed).');
         }, 1200); // 增加延迟到1200ms，给SillyTavern更多的DOM渲染和上下文切换时间
        });

        // [触发门控] 记录“用户真实发送”的消息ID，用于剧情推进触发判定
        if (SillyTavern_API_ACU.eventTypes.MESSAGE_SENT) {
          SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes.MESSAGE_SENT, (messageId) => {
            try {
              recordLastUserSend_ACU(messageId);
            } catch (e) {}
          });
        }

        // [触发门控] 捕捉“用户发送意图”：使用 capture 钩子，确保先于酒馆自身发送逻辑执行
        installSendIntentCaptureHooks_ACU();

        // [触发门控] 记录最近一次生成的上下文（用于过滤 quiet/后台生成导致的误触发）
        if (SillyTavern_API_ACU.eventTypes.GENERATION_STARTED) {
          SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes.GENERATION_STARTED, (type, params, dryRun) => {
            try {
              recordGenerationContext_ACU(type, params, dryRun);
            } catch (e) {}
          });
        }
        if (SillyTavern_API_ACU.eventTypes.GENERATION_ENDED) {
            SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes.GENERATION_ENDED, (message_id) => {
                logDebug_ACU(`ACU GENERATION_ENDED event for message_id: ${message_id}`);
                if (shouldProcessAutoTableUpdateForGenerationEnded_ACU()) {
                  handleNewMessageDebounced_ACU('GENERATION_ENDED');
                } else {
                  logDebug_ACU('ACU: Skip auto table update due to quiet/background generation.');
                }

                // [剧情推进] 保存Plot到消息和循环检测
                // savePlotToLatestMessage_ACU(); // Moved to runOptimizationLogic_ACU
                onLoopGenerationEnded_ACU();
            });
        }

        // [剧情推进] 拦截用户输入进行剧情规划
        if (SillyTavern_API_ACU.eventTypes.GENERATION_AFTER_COMMANDS) {
          SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes.GENERATION_AFTER_COMMANDS, async (type, params, dryRun) => {
            // 如果消息已被TavernHelper钩子处理，则跳过
            if (params?._qrf_processed_by_hook) {
              return;
            }

            // 只在“用户发送触发的正常生成”时做剧情推进，避免其它插件/后台生成触发
            if (!shouldProcessPlotForGeneration_ACU(type, params, dryRun)) {
              return;
            }
            if (type === 'regenerate' || isProcessing_Plot_ACU) {
              return;
            }

            // [去重] 若同一文本刚被 TavernHelper.generate 钩子处理过，则跳过本事件处理，避免重复规划/重复 toast
            try {
              const lastMsgText = (SillyTavern_API_ACU.chat?.length && SillyTavern_API_ACU.chat[SillyTavern_API_ACU.chat.length - 1]?.is_user)
                ? (SillyTavern_API_ACU.chat[SillyTavern_API_ACU.chat.length - 1].mes || '')
                : '';
              const boxText = jQuery_API_ACU('#send_textarea').val() || '';
              if (shouldSkipPlotIntercept_ACU(lastMsgText) || shouldSkipPlotIntercept_ACU(boxText)) {
                logDebug_ACU('[剧情推进] Skip GENERATION_AFTER_COMMANDS due to recent TavernHelper.generate interception.');
                return;
              }
            } catch (e) {}

            const chat = SillyTavern_API_ACU.chat;
            if (!chat || chat.length === 0) {
              return;
            }

            // [策略1] 检查最新的聊天消息 (主要用于 /send 等命令，这些命令会先创建消息再触发生成)
            const lastMessageIndex = chat.length - 1;
            const lastMessage = chat[lastMessageIndex];

            // 如果是新的用户消息且未被处理，进行剧情规划
            if (lastMessage && lastMessage.is_user && !lastMessage._plot_processed) {
              lastMessage._plot_processed = true;

              const messageToProcess = lastMessage.mes;
              if (messageToProcess && messageToProcess.trim().length > 0) {
                isProcessing_Plot_ACU = true;
                try {
                  // 如果是在循环模式下，给消息打上规划标记
                  const isLoopTriggered = loopState_ACU.isLooping && loopState_ACU.awaitingReply;
                  if (isLoopTriggered) {
                    lastMessage._qrf_from_planning = true;
                    logDebug_ACU('[剧情推进] [Loop] 标记规划层消息: _qrf_from_planning=true');
                  }

                  // [优化] 在修改消息之前，先保存原始用户输入的哈希到消息对象上
                  // 这样即使消息内容被规划结果替换，保存函数也能通过这个哈希找到正确的消息
                  const originalInputHash = hashUserInput_ACU(messageToProcess);
                  lastMessage._qrf_plot_pending_hash = originalInputHash;
                  logDebug_ACU('[剧情推进] [Plot] 在消息对象上保存原始输入哈希:', originalInputHash);

                  // [优化] 传递原始用户输入用于哈希匹配
                  // 注意：在策略1中，lastMessage.mes 就是原始用户输入（还未被规划结果替换）
                  const finalMessage = await runOptimizationLogic_ACU(messageToProcess, {
                    originalUserInput: messageToProcess,
                    hasExistingUserMessage: true,
                  });

                  if (finalMessage && finalMessage.skipped) {
                    logDebug_ACU('[剧情推进] Planning skipped in Strategy 1 (duplicate).');
                    return;
                  }

                  if (finalMessage && finalMessage.aborted) {
                    logDebug_ACU('[剧情推进] Generation aborted by user in Strategy 1.');
                    // [优化] 用户手动中止 => 回退：停止生成 + 删除刚创建的用户楼层（如果是本次输入） + 回填输入框
                    if (finalMessage.manual) {
                      try {
                        if (SillyTavern_API_ACU && typeof SillyTavern_API_ACU.stopGeneration === 'function') {
                          SillyTavern_API_ACU.stopGeneration();
                        } else if (window.SillyTavern?.stopGeneration) {
                          window.SillyTavern.stopGeneration();
                        }
                      } catch (e) {}
                      try {
                        const chatNow = SillyTavern_API_ACU.chat;
                        const lastNow = chatNow?.length ? chatNow[chatNow.length - 1] : null;
                        if (lastNow && lastNow.is_user && String(lastNow.mes || '') === String(messageToProcess || '')) {
                          if (typeof SillyTavern_API_ACU.deleteLastMessage === 'function') {
                            await SillyTavern_API_ACU.deleteLastMessage();
                          } else if (window.SillyTavern?.deleteLastMessage) {
                            await window.SillyTavern.deleteLastMessage();
                          }
                        }
                      } catch (e) {}
                      try {
                        const t = finalMessage.restoreText ?? messageToProcess;
                        jQuery_API_ACU('#send_textarea').val(t);
                        jQuery_API_ACU('#send_textarea').trigger('input');
                      } catch (e) {}
                    }
                    return;
                  }

                  if (finalMessage && typeof finalMessage === 'string') {
                    params.prompt = finalMessage;
                    lastMessage.mes = finalMessage;

                    // 发送消息更新事件以刷新UI
                    SillyTavern_API_ACU.eventSource.emit(SillyTavern_API_ACU.eventTypes.MESSAGE_UPDATED, lastMessageIndex);

                    // 清空输入框
                    if (jQuery_API_ACU('#send_textarea').val() === messageToProcess) {
                      jQuery_API_ACU('#send_textarea').val('');
                      jQuery_API_ACU('#send_textarea').trigger('input');
                    }
                  }
                } catch (error) {
                  logError_ACU('[剧情推进] Error processing last chat message:', error);
                  delete lastMessage._plot_processed; // 允许重试
                } finally {
                  isProcessing_Plot_ACU = false;
                }
                return; // 策略1成功，直接返回，不再执行策略2
              }
            }

            // [策略2 - 受控恢复] 正常发送路径：此时用户楼层还未写入 chat
            // 仅当检测到“近期发送意图”时才读取输入框，避免其它插件触发的生成误伤。
            if (!isRecentUserSendIntent_ACU()) return;
            const textInBox = jQuery_API_ACU('#send_textarea').val();
            if (!textInBox || !String(textInBox).trim()) return;

            isProcessing_Plot_ACU = true;
            try {
              // [优化] 传递原始用户输入用于哈希匹配
              // 注意：在策略2中，textInBox 就是原始用户输入（还未被规划结果替换）
              const originalInputText = String(textInBox);
              const finalMessage = await runOptimizationLogic_ACU(originalInputText, {
                originalUserInput: originalInputText,
                hasExistingUserMessage: false,
              });

              if (finalMessage && finalMessage.skipped) {
                logDebug_ACU('[剧情推进] Planning skipped in Strategy 2 (duplicate).');
                return;
              }

              if (finalMessage && finalMessage.aborted) {
                logDebug_ACU('[剧情推进] Generation aborted by user in Strategy 2.');
                // 用户手动中止：停止生成，保留输入框内容
                if (finalMessage.manual) {
                  try {
                    if (SillyTavern_API_ACU && typeof SillyTavern_API_ACU.stopGeneration === 'function') {
                      SillyTavern_API_ACU.stopGeneration();
                    } else if (window.SillyTavern?.stopGeneration) {
                      window.SillyTavern.stopGeneration();
                    }
                  } catch (e) {}
                }
                return;
              }

              if (finalMessage && typeof finalMessage === 'string') {
                // 关键：写回输入框 + 写回 params.prompt（供本次生成使用），达到“先规划再发送”的效果
                jQuery_API_ACU('#send_textarea').val(finalMessage);
                jQuery_API_ACU('#send_textarea').trigger('input');
                try { params.prompt = finalMessage; } catch (e) {}
              }
            } catch (error) {
              logError_ACU('[剧情推进] Error processing textarea input (Strategy 2):', error);
            } finally {
              isProcessing_Plot_ACU = false;
              // 消费掉本次发送意图，避免同一次生成链路重复触发
              generationGate_ACU.lastUserSendIntentAt = 0;
            }
            });
        }
        const chatModificationEvents = ['MESSAGE_DELETED', 'MESSAGE_SWIPED'];
        chatModificationEvents.forEach(evName => {
            if (SillyTavern_API_ACU.eventTypes[evName]) {
                SillyTavern_API_ACU.eventSource.on(SillyTavern_API_ACU.eventTypes[evName], async (data) => {
                    logDebug_ACU(`ACU ${evName} event detected. Triggering data reload and merge from chat history.`);
                    clearTimeout(newMessageDebounceTimer_ACU);
                    newMessageDebounceTimer_ACU = setTimeout(async () => {
                        // [修复] 重新合并数据并更新UI和世界书
                        await refreshMergedDataAndNotify_ACU();
                    }, 500); // 使用防抖处理快速滑动
                });
            }
        });
        logDebug_ACU('ACU: All event listeners attached using eventSource.');
      } else {
        logWarn_ACU('ACU: Could not attach event listeners because eventSource or eventTypes are missing.');
      }
      // [新增] 移除公用的手动更新按钮，改为两个独立的手动更新按钮
      // if (typeof eventOnButton === 'function') {
      //     eventOnButton('更新数据库', handleManualUpdateCard_ACU);
      //     logDebug_ACU(
      //         "ACU: '更新数据库' button event registered with global eventOnButton.",
      //     );
      // } else {
      //     logWarn_ACU("ACU: Global eventOnButton function is not available.");
      // }
      // 修复：移除启动时的状态重置调用。现在完全依赖于SillyTavern加载后触发的第一个CHAT_CHANGED事件来初始化，避免了竞态条件。
      // [新增修复]：为了解决作为角色脚本加载时可能错过初始CHAT_CHANGED事件的问题，
      // 我们在初始化时主动获取一次当前聊天信息并进行设置。
      // 这确保了无论脚本何时加载，都能正确初始化。
      if (SillyTavern_API_ACU && SillyTavern_API_ACU.chatId) {
          logDebug_ACU(`ACU: Initializing with current chat on load: ${SillyTavern_API_ACU.chatId}`);
          // 修复：将初始加载延迟到下一个事件循环，以避免在SillyTavern完全准备好之前运行初始化，从而解决新聊天的竞态条件。
          // [新增] 使用延迟初始化确保UI就绪
          setTimeout(async () => {
              await resetScriptStateForNewChat_ACU(SillyTavern_API_ACU.chatId);
              await loadPresetAndCleanCharacterData_ACU();
              
              // 再次强制刷新数据和UI，确保初始加载时表格显示正确
              await loadAllChatMessages_ACU();
              await refreshMergedDataAndNotify_ACU();
              
              if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
                 updateCardUpdateStatusDisplay_ACU();
              }
          }, 1000);
      } else {
          logWarn_ACU('ACU: Could not get current chat ID on initial load. Waiting for CHAT_CHANGED event.');
      }
    } else {
      logError_ACU('ACU: Failed to initialize. Core APIs not available on DOM ready.');
      console.error('数据库自动更新脚本初始化失败：核心API加载失败。');
    }
  }

  // Simplified startup logic based on successful patterns from other plugins.
  // We now rely on jQuery's document ready event, which is standard for Tampermonkey scripts
  // running in the SillyTavern environment. This avoids complex and potentially unreliable
  // timing issues with 'app_ready' for background tasks.
  $(function() {