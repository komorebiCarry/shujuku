  function cleanChatName_ACU(fileName) {
    if (!fileName || typeof fileName !== 'string') return 'unknown_chat_source';
    let cleanedName = fileName;
    if (fileName.includes('/') || fileName.includes('\\')) {
      const parts = fileName.split(/[\\/]/);
      cleanedName = parts[parts.length - 1];
    }
    return cleanedName.replace(/\.jsonl$/, '').replace(/\.json$/, '');
  }

  // A utility for deep merging objects, used for loading settings.
  function deepMerge_ACU(target, source) {
      const isObject = (obj) => obj && typeof obj === 'object' && !Array.isArray(obj);
      let output = { ...target };
      if (isObject(target) && isObject(source)) {
          Object.keys(source).forEach(key => {
              if (isObject(source[key])) {
                  if (!(key in target))
                      Object.assign(output, { [key]: source[key] });
                  else
                      output[key] = deepMerge_ACU(target[key], source[key]);
              } else {
                  Object.assign(output, { [key]: source[key] });
              }
          });
      }
      return output;
  }

  // [关键修复] 解析表格模板：支持去注释，并可选择“仅保留表头行”
  // 目的：模板允许携带示例/预置数据，但这些数据不应在“当前对话/角色卡没有数据库记录”时被当作真实数据注入世界书。
  function stripSeedRowsFromTemplate_ACU(templateObj) {
      if (!templateObj || typeof templateObj !== 'object') return templateObj;
      Object.keys(templateObj).forEach(k => {
          if (!k.startsWith('sheet_')) return;
          const table = templateObj[k];
          if (!table || !Array.isArray(table.content) || table.content.length === 0) return;
          const headerRow = table.content[0];
          // 仅保留表头行，移除所有数据行（包括模板自带的示例/预置数据）
          table.content = [headerRow];
      });
      return templateObj;
  }

  function parseTableTemplateJson_ACU({ stripSeedRows = false } = {}) {
      try {
          let cleanTemplate = TABLE_TEMPLATE_ACU.trim();
          cleanTemplate = cleanTemplate.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
          
          // [调试] 输出模板字符串的前100个字符，帮助诊断问题
          logDebug_ACU('[模板解析] cleanTemplate前100字符:', cleanTemplate.substring(0, 100));
          logDebug_ACU('[模板解析] cleanTemplate长度:', cleanTemplate.length);
          logDebug_ACU('[模板解析] 首字符:', JSON.stringify(cleanTemplate[0]));
          logDebug_ACU('[模板解析] 尾字符:', JSON.stringify(cleanTemplate[cleanTemplate.length - 1]));
          
          // [修复2026-03-06] 处理DEFAULT_TABLE_TEMPLATE_ACU的双重JSON编码问题
          // DEFAULT_TABLE_TEMPLATE_ACU 使用模板字符串定义，格式是：`"{...}"`
          // 问题：模板字符串中的 \n 会被解释为实际换行符，\t 被解释为制表符等
          // 而JSON规范不允许字符串中包含未转义的控制字符
          // 解决方案：先将实际的控制字符转义回JSON兼容格式
          
          function escapeStringForJson_ACU(str) {
              // 将字符串中的控制字符转义为JSON兼容格式
              // 注意顺序很重要：先转义反斜杠，再转义双引号，最后转义控制字符
              return str
                  .replace(/\\/g, '\\\\')  // 先转义反斜杠
                  .replace(/"/g, '\\"')    // 转义双引号
                  .replace(/\n/g, '\\n')   // 换行符
                  .replace(/\r/g, '\\r')   // 回车符
                  .replace(/\t/g, '\\t');  // 制表符
          }
          
          let obj = null;
          
          // 如果模板字符串以双引号开头和结尾，说明是被引号包围的JSON字符串
          if (cleanTemplate.startsWith('"') && cleanTemplate.endsWith('"')) {
              logDebug_ACU('[模板解析] 检测到双引号包围格式');
              try {
                  // 方案1：尝试直接解析（如果模板字符串中的转义序列正确）
                  try {
                      logDebug_ACU('[模板解析] 尝试方案1：直接解析...');
                      const unquoted = JSON.parse(cleanTemplate);
                      logDebug_ACU('[模板解析] 方案1第一次解析成功，类型:', typeof unquoted);
                      if (typeof unquoted === 'string') {
                          obj = safeJsonParse_ACU(unquoted, null);
                          logDebug_ACU('[模板解析] 方案1第二次解析结果:', obj ? '成功' : '失败');
                          if (obj) {
                              logDebug_ACU('[模板解析] 方案1成功！');
                              return stripSeedRows ? stripSeedRowsFromTemplate_ACU(obj) : obj;
                          }
                      } else if (typeof unquoted === 'object' && unquoted !== null) {
                          logDebug_ACU('[模板解析] 方案1直接得到对象！');
                          return stripSeedRows ? stripSeedRowsFromTemplate_ACU(unquoted) : unquoted;
                      }
                  } catch (e1) {
                      logDebug_ACU('[模板解析] 方案1失败:', e1.message);
                  }
                  
                  // 方案2：转义控制字符后再解析
                  logDebug_ACU('[模板解析] 尝试方案2：转义后解析...');
                  // 去掉首尾引号，转义内部的控制字符，然后解析
                  const innerContent = cleanTemplate.slice(1, -1);
                  const escapedContent = escapeStringForJson_ACU(innerContent);
                  const rewrapped = '"' + escapedContent + '"';
                  
                  try {
                      const unquoted = JSON.parse(rewrapped);
                      logDebug_ACU('[模板解析] 方案2第一次解析成功，类型:', typeof unquoted);
                      if (typeof unquoted === 'string') {
                          obj = safeJsonParse_ACU(unquoted, null);
                          logDebug_ACU('[模板解析] 方案2第二次解析结果:', obj ? '成功' : '失败');
                          if (obj) {
                              logDebug_ACU('[模板解析] 方案2成功！');
                              return stripSeedRows ? stripSeedRowsFromTemplate_ACU(obj) : obj;
                          }
                          // 如果safeJsonParse失败，尝试直接JSON.parse
                          try {
                              obj = JSON.parse(unquoted);
                              if (obj) {
                                  logDebug_ACU('[模板解析] 方案2（fallback）成功！');
                                  return stripSeedRows ? stripSeedRowsFromTemplate_ACU(obj) : obj;
                              }
                          } catch (e3) {
                              logDebug_ACU('[模板解析] 方案2 fallback失败:', e3.message);
                          }
                      } else if (typeof unquoted === 'object' && unquoted !== null) {
                          logDebug_ACU('[模板解析] 方案2直接得到对象！');
                          return stripSeedRows ? stripSeedRowsFromTemplate_ACU(unquoted) : unquoted;
                      }
                  } catch (e2) {
                      logDebug_ACU('[模板解析] 方案2失败:', e2.message);
                  }
              } catch (e) {
                  logDebug_ACU('[模板解析] 双引号格式处理失败:', e.message);
              }
          } else {
              logDebug_ACU('[模板解析] 不是双引号包围格式，尝试常规解析...');
          }
          
          // 如果上述处理失败，尝试常规解析
          if (!obj) {
              logDebug_ACU('[模板解析] 尝试safeJsonParse_ACU...');
              obj = safeJsonParse_ACU(cleanTemplate, null);
              logDebug_ACU('[模板解析] safeJsonParse_ACU结果:', obj ? '成功' : '失败');
          }
          
          // 如果还是失败，尝试转义后解析
          if (!obj && typeof cleanTemplate === 'string') {
              logDebug_ACU('[模板解析] 尝试转义后解析...');
              try {
                  const escaped = escapeStringForJson_ACU(cleanTemplate);
                  obj = safeJsonParse_ACU(escaped, null);
                  logDebug_ACU('[模板解析] 转义后解析结果:', obj ? '成功' : '失败');
              } catch (e) {
                  logDebug_ACU('[模板解析] 转义后解析异常:', e.message);
              }
          }
          
          if (!obj) {
              logError_ACU('Failed to parse TABLE_TEMPLATE_ACU: safeJsonParse returned null');
              return null;
          }
          logDebug_ACU('[模板解析] 最终成功！');
          return stripSeedRows ? stripSeedRowsFromTemplate_ACU(obj) : obj;
      } catch (e) {
          logError_ACU('Failed to parse TABLE_TEMPLATE_ACU.', e);
          return null;
      }
  }

  // [表格顺序新机制] 在数据对象上应用“按给定 keys 顺序重编号”
  function applySheetOrderNumbers_ACU(dataObj, orderedKeys) {
      if (!dataObj || typeof dataObj !== 'object') return false;
      const keys = Array.isArray(orderedKeys) ? orderedKeys : [];
      let changed = false;
      keys.forEach((k, idx) => {
          const sheet = dataObj[k];
          if (!sheet || typeof sheet !== 'object') return;
          if (sheet[TABLE_ORDER_FIELD_ACU] !== idx) {
              sheet[TABLE_ORDER_FIELD_ACU] = idx;
              changed = true;
          }
      });
      return changed;
  }

  // [表格顺序新机制] 确保对象里的所有 sheet_ 都有合法编号（用于模板载入/导入/兼容旧数据）
  function ensureSheetOrderNumbers_ACU(dataObj, { baseOrderKeys = null, forceRebuild = false } = {}) {
      if (!dataObj || typeof dataObj !== 'object') return false;
      const sheetKeys = Array.isArray(baseOrderKeys) && baseOrderKeys.length
          ? baseOrderKeys.filter(k => k && k.startsWith('sheet_') && dataObj[k])
          : Object.keys(dataObj).filter(k => k.startsWith('sheet_'));
      if (sheetKeys.length === 0) return false;

      // 检查现有编号是否合法且不重复
      const seen = new Set();
      let needRebuild = !!forceRebuild;
      for (const k of sheetKeys) {
          const v = dataObj?.[k]?.[TABLE_ORDER_FIELD_ACU];
          if (!Number.isFinite(v)) { needRebuild = true; break; }
          const iv = Math.trunc(v);
          if (seen.has(iv)) { needRebuild = true; break; }
          seen.add(iv);
      }

      if (!needRebuild) return false;
      return applySheetOrderNumbers_ACU(dataObj, sheetKeys);
  }

  // [表格顺序新机制] 读取模板里 sheet_ keys 的顺序（按编号升序；缺失则按当前键顺序并补齐编号）
  function getTemplateSheetKeys_ACU() {
      const templateObj = parseTableTemplateJson_ACU({ stripSeedRows: false });
      if (!templateObj || typeof templateObj !== 'object') return [];

      const keys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
      if (keys.length === 0) return [];

      // 如果模板缺编号（或重复），按现有键顺序补齐。
      // 注意：当前运行态可能来自“全局模板”也可能来自“当前聊天模板覆写”，
      // 因此这里不能无条件回写到 profile，否则会把聊天专属模板误污染到全局模板存储里。
      const changed = ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: keys, forceRebuild: false });
      if (changed) {
          try {
              const normalizedTemplateStr = JSON.stringify(templateObj);
              TABLE_TEMPLATE_ACU = normalizedTemplateStr;
              const currentChatTemplateScope = getCurrentChatTemplateScopeState_ACU() || migrateLegacyTemplateScopeForCurrentChat_ACU();
              if (currentChatTemplateScope?.templateStr) {
                  const updatedGuideData = buildChatSheetGuideDataFromTemplateObj_ACU(templateObj, { stripSeedRows: false });
                  const nextState = buildChatTemplateScopeStateFromCurrent_ACU({
                      isolationKey: currentChatTemplateScope.isolationKey,
                      presetName: currentChatTemplateScope.presetName,
                      source: currentChatTemplateScope.source || 'inherit',
                      originGlobalName: currentChatTemplateScope.originGlobalName,
                      originGlobalRevision: currentChatTemplateScope.originGlobalRevision,
                      updatedAt: currentChatTemplateScope.updatedAt || Date.now(),
                      templateSource: normalizedTemplateStr,
                      guideData: updatedGuideData || currentChatTemplateScope.guideData,
                  });
                  if (nextState) {
                      setCurrentChatTemplateScopeState_ACU(nextState, {
                          isolationKey: currentChatTemplateScope.isolationKey,
                          reason: 'template_scope_order_no_init',
                      });
                  }
                  logDebug_ACU('[OrderNo] Chat template order numbers initialized and persisted to current chat scope.');
              } else {
                  // [Profile] 模板随“标识代码(profile)”保存
                  saveCurrentProfileTemplate_ACU(TABLE_TEMPLATE_ACU);
                  logDebug_ACU('[OrderNo] Global template order numbers initialized and persisted.');
              }
          } catch (e) {
              logWarn_ACU('[OrderNo] Failed to persist initialized template order numbers:', e);
          }
      }

      // 按 orderNo 排序输出 keys
      return keys.sort((a, b) => {
          const ao = Number.isFinite(templateObj[a]?.[TABLE_ORDER_FIELD_ACU]) ? templateObj[a][TABLE_ORDER_FIELD_ACU] : Infinity;
          const bo = Number.isFinite(templateObj[b]?.[TABLE_ORDER_FIELD_ACU]) ? templateObj[b][TABLE_ORDER_FIELD_ACU] : Infinity;
          if (ao !== bo) return ao - bo;
          return String(templateObj[a]?.name || a).localeCompare(String(templateObj[b]?.name || b));
      });
  }

  // =========================
  // [新增] 聊天记录第一层：空白“指导表”（仅表头+参数，无数据行）
  // 目标：
  // - 不再维护“表头清单”这种轻量结构，而是保存一份“包含所有表格的更新参数/表头/顺序”的空白表集合
  // - 仅用于本插件：为表格编辑/填表参数提供稳定来源；不暴露到 exportTableAsJson 等外部接口
  // - 保存位置：chat[0]（第一层消息对象）上挂载一个内部字段
  // - 按隔离标签分槽：tags[isolationKey]
  // 备注：此处的“空白表”指 content 只保留表头行（content[0]），不含任何数据行
  // =========================
  const CHAT_SHEET_GUIDE_FIELD_ACU = 'TavernDB_ACU_InternalSheetGuide';
  // v2: 在“空白指导表”中额外保存模板的基础数据（seedRows），用于“空数据回溯/占位符注入”时的基底恢复
  const CHAT_SHEET_GUIDE_VERSION_ACU = 2;
  // 兼容：若用户曾使用过旧“表头清单”字段，可在读取时迁移
  const LEGACY_CHAT_TABLE_HEADER_GUIDE_FIELD_ACU = 'TavernDB_ACU_TableHeaderGuide';
  const CHAT_SCOPED_CONFIG_FIELD_ACU = 'TavernDB_ACU_ScopedConfig';
  const CHAT_SCOPED_CONFIG_VERSION_ACU = 1;
  const CHAT_TEMPLATE_ARCHIVE_OPTION_PREFIX_ACU = '__acu_chat_archive__:';
  const MAX_CHAT_TEMPLATE_ARCHIVES_PER_TAG_ACU = 8;

  function getChatFirstLayerMessage_ACU(chat) {
      if (!Array.isArray(chat) || chat.length === 0) return null;
      return chat[0] || null;
  }

  function cloneScopedConfigData_ACU(value, fallback = null) {
      if (value === undefined) return fallback;
      try {
          return JSON.parse(JSON.stringify(value));
      } catch (e) {
          return fallback;
      }
  }

  function getChatScopedConfigContainer_ACU(chat) {
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return null;
      const raw = first[CHAT_SCOPED_CONFIG_FIELD_ACU];
      if (!raw) return null;
      const obj = (typeof raw === 'string') ? safeJsonParse_ACU(raw, null) : raw;
      return (obj && typeof obj === 'object' && !Array.isArray(obj)) ? obj : null;
  }

  function normalizeChatScopedConfigContainer_ACU(container) {
      const cloned = cloneScopedConfigData_ACU(container, {});
      const normalized = (cloned && typeof cloned === 'object' && !Array.isArray(cloned)) ? cloned : {};
      normalized.version = Number.isFinite(normalized.version)
          ? Math.max(CHAT_SCOPED_CONFIG_VERSION_ACU, Math.trunc(normalized.version))
          : CHAT_SCOPED_CONFIG_VERSION_ACU;
      return normalized;
  }

  function normalizePlotScopeMode_ACU(mode) {
      return mode === 'chat_override' ? 'chat_override' : 'inherit_global';
  }

  function normalizeChatScopedConfigSource_ACU(source, fallback = 'inherit') {
      if (typeof source !== 'string') return fallback;
      const normalized = source.trim();
      return normalized || fallback;
  }

  function sanitizePlotSettingsSnapshotForChat_ACU(plotSettings) {
      if (!plotSettings || typeof plotSettings !== 'object') return null;
      const snapshot = cloneScopedConfigData_ACU(plotSettings, null);
      if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;

      delete snapshot.promptPresets;
      delete snapshot.lastUsedPresetName;
      delete snapshot.enabled;

      ensurePlotPromptsArray_ACU(snapshot);
      ensureLoopPromptsArray_ACU(snapshot);
      ensurePlotTasksCompat_ACU(snapshot, { syncLegacy: true });
      snapshot.finalSystemDirective = getPlotFinalDirectiveFromSource_ACU(snapshot);
      setPlotPromptContentByIdForSettings_ACU(snapshot, 'finalSystemDirective', snapshot.finalSystemDirective || '');
      return snapshot;
  }

  function normalizeChatPlotScopeState_ACU(rawState) {
      const state = (rawState && typeof rawState === 'object' && !Array.isArray(rawState)) ? rawState : {};
      const snapshot = sanitizePlotSettingsSnapshotForChat_ACU(state.snapshot);
      return {
          mode: normalizePlotScopeMode_ACU(state.mode),
          presetName: normalizePlotPresetSelectionValue_ACU(state.presetName || ''),
          snapshot,
          originGlobalName: normalizePlotPresetSelectionValue_ACU(state.originGlobalName || ''),
          originGlobalRevision: Number.isFinite(state.originGlobalRevision) ? Math.max(0, Math.trunc(state.originGlobalRevision)) : 0,
          updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : 0,
          source: normalizeChatScopedConfigSource_ACU(state.source, 'inherit'),
      };
  }

  function getCurrentChatPlotScopeState_ACU(chat = SillyTavern_API_ACU?.chat) {
      const container = getChatScopedConfigContainer_ACU(chat);
      const rawState = container?.plot;
      if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return null;

      const normalizedState = normalizeChatPlotScopeState_ACU(rawState);
      if (normalizedState.mode !== 'chat_override' || !normalizedState.snapshot) {
          return null;
      }
      return normalizedState;
  }

  function buildChatPlotScopeStateFromSettings_ACU(plotSettings, { presetName = '', source = 'ui', originGlobalName = '', originGlobalRevision = 0, updatedAt = Date.now() } = {}) {
      const snapshot = sanitizePlotSettingsSnapshotForChat_ACU(plotSettings);
      if (!snapshot) return null;

      return normalizeChatPlotScopeState_ACU({
          mode: 'chat_override',
          presetName,
          snapshot,
          originGlobalName,
          originGlobalRevision,
          updatedAt,
          source,
      });
  }

  function setCurrentChatPlotScopeState_ACU(plotState, { reason = '' } = {}) {
      const chat = SillyTavern_API_ACU?.chat;
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return null;

      const container = normalizeChatScopedConfigContainer_ACU(getChatScopedConfigContainer_ACU(chat));
      const normalizedState = normalizeChatPlotScopeState_ACU(plotState);

      if (normalizedState.mode === 'chat_override' && normalizedState.snapshot) {
          container.plot = {
              ...normalizedState,
              reason: String(reason || ''),
          };
      } else {
          delete container.plot;
      }

      const hasPayload = Object.keys(container).some(key => key !== 'version');
      if (hasPayload) {
          first[CHAT_SCOPED_CONFIG_FIELD_ACU] = container;
      } else {
          delete first[CHAT_SCOPED_CONFIG_FIELD_ACU];
      }

      return getCurrentChatPlotScopeState_ACU(chat);
  }

  function clearCurrentChatPlotScopeState_ACU() {
      return setCurrentChatPlotScopeState_ACU({ mode: 'inherit_global' }, { reason: 'clear_plot_override' });
  }

  function normalizeTemplateScopeMode_ACU(mode) {
      if (mode === 'chat_override') return 'chat_override';
      if (mode === 'preset_link') return 'preset_link';
      return 'inherit_global';
  }

  function normalizeTemplateScopeIsolationKey_ACU(isolationKey = getCurrentIsolationKey_ACU()) {
      return String(isolationKey ?? '');
  }

  function sanitizeTemplateSnapshotForChat_ACU(templateSource) {
      let templateObj = null;
      if (typeof templateSource === 'string') {
          templateObj = safeJsonParse_ACU(templateSource, null);
      } else if (templateSource && typeof templateSource === 'object' && !Array.isArray(templateSource)) {
          templateObj = cloneScopedConfigData_ACU(templateSource, null);
      }

      if (!templateObj || typeof templateObj !== 'object' || Array.isArray(templateObj)) return null;

      try {
          const sheetKeys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
          ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: sheetKeys, forceRebuild: false });
      } catch (e) {}

      const sanitized = sanitizeChatSheetsObject_ACU(templateObj, { ensureMate: true });
      const templateStr = safeJsonStringify_ACU(sanitized, '');
      if (!templateStr) return null;

      return {
          templateStr,
          templateObj: safeJsonParse_ACU(templateStr, null),
      };
  }

  function normalizeChatTemplateScopeState_ACU(rawState, { isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const state = (rawState && typeof rawState === 'object' && !Array.isArray(rawState)) ? rawState : {};
      const templateSnapshot = sanitizeTemplateSnapshotForChat_ACU(state.templateStr || state.templateObj || state.template || null);
      const guideData = normalizeGuideData_ACU(state.guideData);
      return {
          mode: normalizeTemplateScopeMode_ACU(state.mode),
          isolationKey: normalizeTemplateScopeIsolationKey_ACU(state.isolationKey ?? isolationKey),
          presetName: normalizeTemplatePresetSelectionValue_ACU(state.presetName || ''),
          templateStr: templateSnapshot?.templateStr || '',
          guideData,
          originGlobalName: normalizeTemplatePresetSelectionValue_ACU(state.originGlobalName || ''),
          originGlobalRevision: Number.isFinite(state.originGlobalRevision) ? Math.max(0, Math.trunc(state.originGlobalRevision)) : 0,
          updatedAt: Number.isFinite(state.updatedAt) ? state.updatedAt : 0,
          source: normalizeChatScopedConfigSource_ACU(state.source, 'inherit'),
      };
  }

  function buildChatTemplatePresetSlotKey_ACU(presetName) {
      return normalizeTemplatePresetSelectionValue_ACU(presetName) || DEFAULT_TEMPLATE_PRESET_OPTION_VALUE_ACU;
  }

  function listChatTemplatePresetEntries_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const entryMap = new Map();
      getChatTemplateArchiveEntries_ACU({ chat, isolationKey: normalizedKey }).forEach(entry => {
          const slotKey = buildChatTemplatePresetSlotKey_ACU(entry?.presetName || '');
          const previousEntry = entryMap.get(slotKey);
          const currentTs = Number(entry?.updatedAt) || Number(entry?.archivedAt) || 0;
          const previousTs = Number(previousEntry?.updatedAt) || Number(previousEntry?.archivedAt) || 0;
          if (!previousEntry || currentTs >= previousTs) {
              entryMap.set(slotKey, entry);
          }
      });
      return Array.from(entryMap.values()).sort((a, b) => {
          const ta = Number(a?.updatedAt) || Number(a?.archivedAt) || 0;
          const tb = Number(b?.updatedAt) || Number(b?.archivedAt) || 0;
          return tb - ta;
      });
  }

  function findChatTemplatePresetEntry_ACU(presetName, { chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const slotKey = buildChatTemplatePresetSlotKey_ACU(presetName);
      return listChatTemplatePresetEntries_ACU({ chat, isolationKey }).find(entry => buildChatTemplatePresetSlotKey_ACU(entry?.presetName || '') === slotKey) || null;
  }

  function upsertChatTemplatePresetEntry_ACU(templateState, { chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const normalizedState = normalizeChatTemplateScopeState_ACU(templateState, { isolationKey: normalizedKey });
      if (normalizedState.mode !== 'chat_override' || !normalizedState.templateStr) return null;

      const slotKey = buildChatTemplatePresetSlotKey_ACU(normalizedState.presetName || '');
      const archivedAt = Date.now();
      const nextEntries = [
          {
              ...normalizedState,
              archiveKey: slotKey,
              archivedAt,
              updatedAt: normalizedState.updatedAt || archivedAt,
          },
          ...getChatTemplateArchiveEntries_ACU({ chat, isolationKey: normalizedKey }).filter(entry => buildChatTemplatePresetSlotKey_ACU(entry?.presetName || '') !== slotKey),
      ];
      setChatTemplateArchiveEntries_ACU(nextEntries, { chat, isolationKey: normalizedKey });
      return findChatTemplatePresetEntry_ACU(normalizedState.presetName || '', { chat, isolationKey: normalizedKey });
  }

  function ensureCurrentChatTemplatePresetEntry_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const currentState = getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey }) || migrateLegacyTemplateScopeForCurrentChat_ACU({ chat, isolationKey: normalizedKey });
      const normalizedState = normalizeChatTemplateScopeState_ACU(currentState, { isolationKey: normalizedKey });
      if (normalizedState.mode !== 'chat_override' || !normalizedState.templateStr) return null;

      const existingEntry = findChatTemplatePresetEntry_ACU(normalizedState.presetName || '', { chat, isolationKey: normalizedKey });
      const currentFingerprint = buildChatTemplateArchiveFingerprint_ACU(normalizedState, { isolationKey: normalizedKey });
      const existingFingerprint = existingEntry ? buildChatTemplateArchiveFingerprint_ACU(existingEntry, { isolationKey: normalizedKey }) : '';
      if (existingEntry && currentFingerprint && existingFingerprint === currentFingerprint) {
          return existingEntry;
      }
      return upsertChatTemplatePresetEntry_ACU(normalizedState, { chat, isolationKey: normalizedKey });
  }

  function buildChatTemplatePresetLinkState_ACU({ isolationKey = getCurrentIsolationKey_ACU(), presetName = '', source = 'ui', originGlobalName = '', originGlobalRevision = 0, updatedAt = Date.now() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      return normalizeChatTemplateScopeState_ACU({
          mode: 'preset_link',
          isolationKey: normalizedKey,
          presetName,
          originGlobalName,
          originGlobalRevision,
          updatedAt,
          source,
      }, { isolationKey: normalizedKey });
  }

  async function activateChatTemplatePresetSelection_ACU(presetName, { source = 'ui_chat_select', refreshUi = false, save = true } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(getCurrentIsolationKey_ACU());
      const normalizedPresetName = normalizeTemplatePresetSelectionValue_ACU(presetName);
      const localEntry = findChatTemplatePresetEntry_ACU(normalizedPresetName, { isolationKey: normalizedKey });
      const hasGlobalPreset = !normalizedPresetName || !!getTemplatePreset_ACU(normalizedPresetName)?.templateStr;

      try {
          ensureCurrentChatTemplatePresetEntry_ACU({ isolationKey: normalizedKey });
      } catch (e) {}

      if (localEntry?.templateStr) {
          persistTemplateScopeSelectionState_ACU(normalizedPresetName, {
              source,
              updateGlobal: false,
              save,
              persistChatScope: true,
              templateSource: localEntry.templateStr,
              guideData: localEntry.guideData,
              scopeMode: 'chat_override',
              registerChatPresetEntry: false,
          });
      } else {
          if (!hasGlobalPreset) return false;
          const linkState = buildChatTemplatePresetLinkState_ACU({
              isolationKey: normalizedKey,
              presetName: normalizedPresetName,
              source,
              originGlobalName: getCurrentTemplatePresetName_ACU({ requireExisting: false }),
              originGlobalRevision: 0,
              updatedAt: Date.now(),
          });
          setCurrentChatTemplateScopeState_ACU(linkState, {
              isolationKey: normalizedKey,
              reason: `template_scope_${source}`,
          });
          try {
              clearChatSheetGuideDataForIsolationKey_ACU({ isolationKey: normalizedKey });
          } catch (e) {}
          if (save && typeof SillyTavern_API_ACU?.saveChat === 'function') {
              try {
                  await SillyTavern_API_ACU.saveChat();
              } catch (error) {
                  logWarn_ACU('[TemplateScope] 保存聊天级模板预设引用失败:', error);
              }
          }
      }

      applyTemplateScopeForCurrentChat_ACU({ isolationKey: normalizedKey });
      if ($popupInstance_ACU && refreshUi) {
          loadTemplatePresetSelect_ACU({ keepGlobalValue: true });
      }
      try { await refreshMergedDataAndNotify_ACU(); } catch (e) {}
      return {
          presetName: normalizedPresetName,
          mode: localEntry?.templateStr ? 'chat_override' : 'preset_link',
          fromLocalSnapshot: !!localEntry?.templateStr,
      };
  }

  function buildChatTemplateArchiveFingerprint_ACU(templateState, { isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedState = normalizeChatTemplateScopeState_ACU(templateState, { isolationKey });
      if (normalizedState.mode !== 'chat_override' || !normalizedState.templateStr) return '';
      const raw = safeJsonStringify_ACU({
          presetName: normalizedState.presetName || '',
          source: normalizedState.source || '',
          templateStr: normalizedState.templateStr || '',
          guideData: normalizeGuideData_ACU(normalizedState.guideData),
      }, '');
      return raw ? hashUserInput_ACU(raw) : '';
  }

  function getChatTemplateArchiveBaseLabel_ACU(templateState, { fallback = '聊天模板快照' } = {}) {
      const normalizedState = normalizeChatTemplateScopeState_ACU(templateState);
      if (normalizedState.source === 'legacy_history_frozen') return '旧对话历史模板快照';
      if (normalizedState.source === 'legacy_header_frozen') return '旧版表头冻结模板';
      if (normalizedState.source === 'legacy_frozen') return '旧版聊天冻结模板';
      const presetName = normalizeTemplatePresetSelectionValue_ACU(normalizedState.presetName || '');
      return presetName ? getTemplatePresetDisplayName_ACU(presetName) : fallback;
  }

  function normalizeChatTemplateArchiveEntry_ACU(rawEntry, { isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedState = normalizeChatTemplateScopeState_ACU(rawEntry, { isolationKey });
      if (normalizedState.mode !== 'chat_override' || !normalizedState.templateStr) return null;
      const archiveKey = String(rawEntry?.archiveKey || buildChatTemplateArchiveFingerprint_ACU(normalizedState, { isolationKey: normalizedState.isolationKey }) || '').trim();
      if (!archiveKey) return null;
      return {
          archiveKey,
          isolationKey: normalizedState.isolationKey,
          presetName: normalizedState.presetName,
          templateStr: normalizedState.templateStr,
          guideData: normalizedState.guideData,
          originGlobalName: normalizedState.originGlobalName,
          originGlobalRevision: normalizedState.originGlobalRevision,
          updatedAt: normalizedState.updatedAt,
          archivedAt: Number.isFinite(rawEntry?.archivedAt) ? rawEntry.archivedAt : Date.now(),
          source: normalizedState.source,
          mode: 'chat_override',
      };
  }

  function getChatTemplateArchiveEntries_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const container = getChatScopedConfigContainer_ACU(chat);
      const rawSlots = container?.templateArchives;
      if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return [];
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const rawEntries = Array.isArray(rawSlots[normalizedKey]) ? rawSlots[normalizedKey] : [];
      return rawEntries
          .map(entry => normalizeChatTemplateArchiveEntry_ACU(entry, { isolationKey: normalizedKey }))
          .filter(Boolean)
          .sort((a, b) => (Number(b.archivedAt) || 0) - (Number(a.archivedAt) || 0));
  }

  function setChatTemplateArchiveEntries_ACU(entries, { chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return [];
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const container = normalizeChatScopedConfigContainer_ACU(getChatScopedConfigContainer_ACU(chat));
      const normalizedEntries = (Array.isArray(entries) ? entries : [])
          .map(entry => normalizeChatTemplateArchiveEntry_ACU(entry, { isolationKey: normalizedKey }))
          .filter(Boolean)
          .sort((a, b) => (Number(b.archivedAt) || 0) - (Number(a.archivedAt) || 0))
          .slice(0, MAX_CHAT_TEMPLATE_ARCHIVES_PER_TAG_ACU);

      if (normalizedEntries.length > 0) {
          if (!container.templateArchives || typeof container.templateArchives !== 'object' || Array.isArray(container.templateArchives)) {
              container.templateArchives = {};
          }
          container.templateArchives[normalizedKey] = normalizedEntries;
      } else if (container.templateArchives && typeof container.templateArchives === 'object' && !Array.isArray(container.templateArchives)) {
          delete container.templateArchives[normalizedKey];
          if (Object.keys(container.templateArchives).length === 0) delete container.templateArchives;
      }

      const hasPayload = Object.keys(container).some(key => key !== 'version');
      if (hasPayload) {
          first[CHAT_SCOPED_CONFIG_FIELD_ACU] = container;
      } else {
          delete first[CHAT_SCOPED_CONFIG_FIELD_ACU];
      }

      return getChatTemplateArchiveEntries_ACU({ chat, isolationKey: normalizedKey });
  }

  function archiveCurrentChatTemplateScopeState_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU(), nextTemplateState = null, reason = '' } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const currentState = getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey }) || migrateLegacyTemplateScopeForCurrentChat_ACU({ chat, isolationKey: normalizedKey });
      const normalizedCurrentState = normalizeChatTemplateScopeState_ACU(currentState, { isolationKey: normalizedKey });
      if (normalizedCurrentState.mode !== 'chat_override' || !normalizedCurrentState.templateStr) return false;

      const currentArchiveKey = buildChatTemplateArchiveFingerprint_ACU(normalizedCurrentState, { isolationKey: normalizedKey });
      if (!currentArchiveKey) return false;

      const normalizedNextState = nextTemplateState
          ? normalizeChatTemplateScopeState_ACU(nextTemplateState, { isolationKey: normalizedKey })
          : null;
      const nextArchiveKey = normalizedNextState?.templateStr
          ? buildChatTemplateArchiveFingerprint_ACU(normalizedNextState, { isolationKey: normalizedKey })
          : '';
      if (nextArchiveKey && currentArchiveKey === nextArchiveKey) return false;

      const archivedAt = Date.now();
      const nextEntries = [
          {
              ...normalizedCurrentState,
              archiveKey: currentArchiveKey,
              archivedAt,
              updatedAt: normalizedCurrentState.updatedAt || archivedAt,
              source: normalizedCurrentState.source || normalizeChatScopedConfigSource_ACU(reason, 'inherit'),
          },
          ...getChatTemplateArchiveEntries_ACU({ chat, isolationKey: normalizedKey }).filter(entry => entry.archiveKey !== currentArchiveKey),
      ];
      setChatTemplateArchiveEntries_ACU(nextEntries, { chat, isolationKey: normalizedKey });
      return true;
  }

  function buildChatTemplateArchiveOptionValue_ACU(archiveKey) {
      const normalizedKey = String(archiveKey || '').trim();
      return normalizedKey ? `${CHAT_TEMPLATE_ARCHIVE_OPTION_PREFIX_ACU}${normalizedKey}` : '';
  }

  function isChatTemplateArchiveOptionValue_ACU(value) {
      return typeof value === 'string' && value.startsWith(CHAT_TEMPLATE_ARCHIVE_OPTION_PREFIX_ACU);
  }

  function parseChatTemplateArchiveOptionValue_ACU(value) {
      return isChatTemplateArchiveOptionValue_ACU(value)
          ? String(value.slice(CHAT_TEMPLATE_ARCHIVE_OPTION_PREFIX_ACU.length)).trim()
          : '';
  }

  function getChatTemplateArchiveOptionLabel_ACU(entry) {
      const normalizedEntry = normalizeChatTemplateArchiveEntry_ACU(entry);
      if (!normalizedEntry) return '聊天历史模板快照';
      const baseLabel = getChatTemplateArchiveBaseLabel_ACU(normalizedEntry);
      const archivedAtText = (typeof formatPlotScopeUpdatedAt_ACU === 'function') ? formatPlotScopeUpdatedAt_ACU(normalizedEntry.archivedAt || normalizedEntry.updatedAt) : '';
      return archivedAtText
          ? `${baseLabel}（聊天历史快照，${archivedAtText}）`
          : `${baseLabel}（聊天历史快照）`;
  }

  async function restoreChatTemplateArchiveEntry_ACU(archiveKey, { chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU(), refreshUi = false, save = true } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const normalizedArchiveKey = String(archiveKey || '').trim();
      if (!normalizedArchiveKey) return false;
      const entry = getChatTemplateArchiveEntries_ACU({ chat, isolationKey: normalizedKey }).find(item => item.archiveKey === normalizedArchiveKey);
      if (!entry?.templateStr) return false;

      persistTemplateScopeSelectionState_ACU(entry.presetName, {
          source: entry.source || 'ui_chat_archive_restore',
          updateGlobal: false,
          save,
          persistChatScope: true,
          templateSource: entry.templateStr,
          guideData: entry.guideData,
          archivePreviousChatScope: true,
      });
      applyTemplateScopeForCurrentChat_ACU({ isolationKey: normalizedKey });

      if ($popupInstance_ACU && refreshUi) {
          loadTemplatePresetSelect_ACU({ keepGlobalValue: true });
      }
      try { await refreshMergedDataAndNotify_ACU(); } catch (e) {}
      return {
          archiveKey: normalizedArchiveKey,
          presetName: entry.presetName || '',
          label: getChatTemplateArchiveOptionLabel_ACU(entry),
          templateStr: entry.templateStr,
      };
  }

  function getCurrentChatTemplateScopeState_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const container = getChatScopedConfigContainer_ACU(chat);
      const rawSlots = container?.template;
      if (!rawSlots || typeof rawSlots !== 'object' || Array.isArray(rawSlots)) return null;

      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const rawState = rawSlots[normalizedKey];
      if (!rawState || typeof rawState !== 'object' || Array.isArray(rawState)) return null;

      const normalizedState = normalizeChatTemplateScopeState_ACU(rawState, { isolationKey: normalizedKey });
      if (normalizedState.mode === 'preset_link') {
          return normalizedState;
      }
      if (normalizedState.mode !== 'chat_override' || !normalizedState.templateStr) {
          return null;
      }
      return normalizedState;
  }

  function buildChatTemplateScopeStateFromCurrent_ACU({ isolationKey = getCurrentIsolationKey_ACU(), presetName = '', source = 'ui', originGlobalName = '', originGlobalRevision = 0, updatedAt = Date.now(), templateSource = TABLE_TEMPLATE_ACU, guideData = null } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const templateSnapshot = sanitizeTemplateSnapshotForChat_ACU(templateSource);
      if (!templateSnapshot?.templateStr) return null;

      const resolvedGuideData = normalizeGuideData_ACU(guideData || getChatSheetGuideDataForIsolationKey_ACU(normalizedKey));
      return normalizeChatTemplateScopeState_ACU({
          mode: 'chat_override',
          isolationKey: normalizedKey,
          presetName,
          templateStr: templateSnapshot.templateStr,
          guideData: resolvedGuideData,
          originGlobalName,
          originGlobalRevision,
          updatedAt,
          source,
      }, { isolationKey: normalizedKey });
  }

  function setCurrentChatTemplateScopeState_ACU(templateState, { isolationKey = getCurrentIsolationKey_ACU(), reason = '' } = {}) {
      const chat = SillyTavern_API_ACU?.chat;
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return null;

      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const container = normalizeChatScopedConfigContainer_ACU(getChatScopedConfigContainer_ACU(chat));
      const normalizedState = normalizeChatTemplateScopeState_ACU(templateState, { isolationKey: normalizedKey });

      if (!container.template || typeof container.template !== 'object' || Array.isArray(container.template)) {
          container.template = {};
      }

      if (normalizedState.mode === 'chat_override' && normalizedState.templateStr) {
          container.template[normalizedKey] = {
              ...normalizedState,
              reason: String(reason || ''),
          };
      } else if (normalizedState.mode === 'preset_link') {
          container.template[normalizedKey] = {
              ...normalizedState,
              templateStr: '',
              guideData: null,
              reason: String(reason || ''),
          };
      } else {
          delete container.template[normalizedKey];
          if (Object.keys(container.template).length === 0) {
              delete container.template;
          }
      }

      const hasPayload = Object.keys(container).some(key => key !== 'version');
      if (hasPayload) {
          first[CHAT_SCOPED_CONFIG_FIELD_ACU] = container;
      } else {
          delete first[CHAT_SCOPED_CONFIG_FIELD_ACU];
      }

      return getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey });
  }

  function clearCurrentChatTemplateScopeState_ACU({ isolationKey = getCurrentIsolationKey_ACU(), clearGuide = true, archiveCurrent = true } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      if (archiveCurrent) {
          try {
              archiveCurrentChatTemplateScopeState_ACU({ isolationKey: normalizedKey, reason: 'clear_template_override' });
          } catch (e) {}
      }
      const result = setCurrentChatTemplateScopeState_ACU({ mode: 'inherit_global' }, {
          isolationKey: normalizedKey,
          reason: 'clear_template_override',
      });
      if (clearGuide) {
          try {
              clearChatSheetGuideDataForIsolationKey_ACU({ isolationKey: normalizedKey });
          } catch (e) {}
      }
      return result;
  }

  function getGlobalTemplateSnapshotForCurrentProfile_ACU() {
      const code = normalizeIsolationCode_ACU(settings_ACU?.dataIsolationCode || '');
      const previousTemplate = TABLE_TEMPLATE_ACU;
      const savedTemplate = readProfileTemplateFromStorage_ACU(code);
      let snapshot = sanitizeTemplateSnapshotForChat_ACU(savedTemplate || previousTemplate);
      if (snapshot?.templateStr) {
          return snapshot;
      }

      try {
          TABLE_TEMPLATE_ACU = savedTemplate || DEFAULT_TABLE_TEMPLATE_ACU;
          const parsedTemplate = parseTableTemplateJson_ACU({ stripSeedRows: false });
          snapshot = sanitizeTemplateSnapshotForChat_ACU(parsedTemplate);
      } catch (e) {
          snapshot = null;
      } finally {
          TABLE_TEMPLATE_ACU = previousTemplate;
      }

      return snapshot || sanitizeTemplateSnapshotForChat_ACU(previousTemplate);
  }

  function applyTemplateScopeForCurrentChat_ACU({ isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const migratedScopeState = migrateLegacyTemplateScopeForCurrentChat_ACU({ isolationKey: normalizedKey });
      const scopeState = getCurrentChatTemplateScopeState_ACU({ isolationKey: normalizedKey }) || migratedScopeState;
      const selectedPresetName = normalizeTemplatePresetSelectionValue_ACU(scopeState?.presetName || '');
      let targetSnapshot = null;

      if (scopeState?.mode === 'chat_override' && scopeState?.templateStr) {
          targetSnapshot = sanitizeTemplateSnapshotForChat_ACU(scopeState.templateStr);
      } else if (scopeState?.mode === 'preset_link') {
          if (selectedPresetName) {
              targetSnapshot = sanitizeTemplateSnapshotForChat_ACU(getTemplatePreset_ACU(selectedPresetName)?.templateStr || null);
          } else {
              targetSnapshot = getDefaultTemplateSnapshot_ACU();
          }
      }

      if (!targetSnapshot?.templateStr) {
          targetSnapshot = getGlobalTemplateSnapshotForCurrentProfile_ACU();
      }
      if (!targetSnapshot?.templateStr) return null;

      TABLE_TEMPLATE_ACU = targetSnapshot.templateStr;
      if (scopeState?.mode === 'chat_override' && scopeState?.templateStr) {
          logDebug_ACU(`[TemplateScope] Applied chat template override for key [${normalizedKey || '默认'}].`);
          return {
              mode: 'chat_override',
              isolationKey: normalizedKey,
              presetName: scopeState.presetName || '',
          };
      }
      if (scopeState?.mode === 'preset_link') {
          logDebug_ACU(`[TemplateScope] Applied linked global preset for key [${normalizedKey || '默认'}]: ${selectedPresetName || '默认预设'}.`);
          return {
              mode: 'preset_link',
              isolationKey: normalizedKey,
              presetName: selectedPresetName,
          };
      }

      logDebug_ACU(`[TemplateScope] Applied global template for key [${normalizedKey || '默认'}].`);
      return {
          mode: 'inherit_global',
          isolationKey: normalizedKey,
          presetName: getCurrentTemplatePresetName_ACU({ requireExisting: false }),
      };
  }

  function getChatSheetGuideContainer_ACU(chat) {
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return null;
      const raw = first[CHAT_SHEET_GUIDE_FIELD_ACU];
      if (!raw) return null;
      const obj = (typeof raw === 'string') ? safeJsonParse_ACU(raw, null) : raw;
      return (obj && typeof obj === 'object') ? obj : null;
  }

  const CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU = 'seedRows';

  function normalizeGuideData_ACU(dataObj) {
      if (!dataObj || typeof dataObj !== 'object') return null;
      const out = { mate: { type: 'chatSheets', version: CHAT_SHEET_GUIDE_VERSION_ACU } };
      // mate 允许覆盖
      if (dataObj.mate && typeof dataObj.mate === 'object') {
          out.mate = dataObj.mate;
      }
      // 兜底补齐 mate 关键字段（避免旧调用方传入 version=1 导致无法识别新结构）
      if (!out.mate || typeof out.mate !== 'object') out.mate = { type: 'chatSheets', version: CHAT_SHEET_GUIDE_VERSION_ACU };
      if (!out.mate.type) out.mate.type = 'chatSheets';
      if (!Number.isFinite(out.mate.version) || Math.trunc(out.mate.version) < CHAT_SHEET_GUIDE_VERSION_ACU) out.mate.version = CHAT_SHEET_GUIDE_VERSION_ACU;
      Object.keys(dataObj).forEach(k => {
          if (!k.startsWith('sheet_')) return;
          const s = dataObj[k];
          if (!s || typeof s !== 'object') return;
          // content 只保留表头行
          const headerRow = Array.isArray(s.content) && Array.isArray(s.content[0]) ? s.content[0] : [null];
          const keep = {
              uid: s.uid || k,
              name: s.name || k,
              sourceData: s.sourceData || { note: '', initNode: '', insertNode: '', updateNode: '', deleteNode: '' },
              content: [headerRow],
              updateConfig: s.updateConfig || { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
              exportConfig: ensureExportConfigDefaults_ACU(s.exportConfig, s.name || k),
          };
          // v2: 基础数据（仅模板预置/seedRows）；注意：这里绝不从 content 派生，避免把真实数据误当作“基础数据”写入指导表
          if (Array.isArray(s[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU])) {
              try {
                  keep[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(s[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU]));
              } catch (e) {
                  keep[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = [];
              }
          }
          if (s[TABLE_ORDER_FIELD_ACU] !== undefined) keep[TABLE_ORDER_FIELD_ACU] = s[TABLE_ORDER_FIELD_ACU];
          out[k] = keep;
      });
      return out;
  }

  function materializeDataFromSheetGuide_ACU(guideData, { includeSeedRows = true } = {}) {
      const normalized = normalizeGuideData_ACU(guideData);
      if (!normalized) return { mate: { type: 'chatSheets', version: 1 } };
      const out = { mate: normalized.mate || { type: 'chatSheets', version: 1 } };
      Object.keys(normalized).forEach(k => {
          if (!k.startsWith('sheet_')) return;
          const s = normalized[k];
          const headerRow = Array.isArray(s?.content?.[0]) ? JSON.parse(JSON.stringify(s.content[0])) : [null];
          const next = JSON.parse(JSON.stringify(s));
          // content: header + (可选) seedRows
          const seedRows = includeSeedRows && Array.isArray(s?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU])
              ? JSON.parse(JSON.stringify(s[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU]))
              : [];
          next.content = [headerRow, ...seedRows];
          // 保留 seedRows 字段本身（便于后续再次写回/二次处理），但不会影响表格使用者（他们只看 content）
          out[k] = next;
      });
      return out;
  }

  function getLegacyHeaderGuideDataForIsolationKey_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = String(isolationKey ?? '');
      try {
          const first = getChatFirstLayerMessage_ACU(chat);
          const legacyRaw = first ? first[LEGACY_CHAT_TABLE_HEADER_GUIDE_FIELD_ACU] : null;
          const legacyObj = legacyRaw ? ((typeof legacyRaw === 'string') ? safeJsonParse_ACU(legacyRaw, null) : legacyRaw) : null;
          const legacyTags = legacyObj?.tags;
          const legacySlot = (legacyTags && typeof legacyTags === 'object') ? legacyTags[normalizedKey] : null;
          const legacyHeaders = Array.isArray(legacySlot?.headers) ? legacySlot.headers : null;
          if (!legacyHeaders || legacyHeaders.length === 0) return null;

          const orderedUids = legacyHeaders
              .map(h => h?.uid)
              .filter(uid => typeof uid === 'string' && uid.startsWith('sheet_'));
          if (orderedUids.length === 0) return null;

          const templateObj = parseTableTemplateJson_ACU({ stripSeedRows: false });
          const out = { mate: { type: 'chatSheets', version: CHAT_SHEET_GUIDE_VERSION_ACU } };
          orderedUids.forEach((uid, idx) => {
              const base = (templateObj && templateObj[uid])
                  ? JSON.parse(JSON.stringify(templateObj[uid]))
                  : { uid, name: uid, content: [[null]], sourceData: {}, updateConfig: {}, exportConfig: {} };
              if (Array.isArray(base.content) && base.content.length > 1) {
                  base[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(base.content.slice(1)));
                  base.content = [base.content[0]];
              }
              if (!Array.isArray(base.content) || base.content.length === 0) base.content = [[null]];
              base.uid = uid;
              if (!Number.isFinite(base[TABLE_ORDER_FIELD_ACU])) base[TABLE_ORDER_FIELD_ACU] = idx;
              out[uid] = base;
          });
          return normalizeGuideData_ACU(out);
      } catch (e) {
          return null;
      }
  }

  function getHistoricalTemplateGuideDataForIsolationKey_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      if (!Array.isArray(chat) || chat.length === 0) return null;

      const historicalData = { mate: { type: 'chatSheets', version: 1 } };
      const encounteredKeys = [];
      const encounteredSet = new Set();
      const appendTables = (dataObj, { summaryOnly = null } = {}) => {
          if (!dataObj || typeof dataObj !== 'object' || Array.isArray(dataObj)) return;
          Object.keys(dataObj).forEach(key => {
              if (!key.startsWith('sheet_') || encounteredSet.has(key)) return;
              const sheet = dataObj[key];
              if (!sheet || typeof sheet !== 'object' || Array.isArray(sheet)) return;
              const isSummary = !!sheet.name && isSummaryOrOutlineTable_ACU(sheet.name);
              if (summaryOnly === true && !isSummary) return;
              if (summaryOnly === false && isSummary) return;
              historicalData[key] = JSON.parse(JSON.stringify(sheet));
              encounteredKeys.push(key);
              encounteredSet.add(key);
          });
      };

      for (let i = chat.length - 1; i >= 0; i--) {
          const message = chat[i];
          if (!message || message.is_user) continue;

          const isolatedContainer = typeof message.TavernDB_ACU_IsolatedData === 'string'
              ? safeJsonParse_ACU(message.TavernDB_ACU_IsolatedData, null)
              : message.TavernDB_ACU_IsolatedData;
          appendTables(isolatedContainer?.[normalizedKey]?.independentData);

          const msgIdentity = message.TavernDB_ACU_Identity;
          const isLegacyMatch = settings_ACU.dataIsolationEnabled
              ? (msgIdentity === settings_ACU.dataIsolationCode)
              : !msgIdentity;
          if (!isLegacyMatch) continue;

          appendTables(message.TavernDB_ACU_IndependentData);
          appendTables(message.TavernDB_ACU_Data, { summaryOnly: false });
          appendTables(message.TavernDB_ACU_SummaryData, { summaryOnly: true });
      }

      if (encounteredKeys.length === 0) return null;

      const orderedKeys = encounteredKeys
          .map((key, index) => ({
              key,
              index,
              order: Number.isFinite(historicalData?.[key]?.[TABLE_ORDER_FIELD_ACU])
                  ? Math.trunc(historicalData[key][TABLE_ORDER_FIELD_ACU])
                  : null,
          }))
          .sort((a, b) => {
              if (a.order !== null && b.order !== null && a.order !== b.order) return a.order - b.order;
              if (a.order !== null && b.order === null) return -1;
              if (a.order === null && b.order !== null) return 1;
              return a.index - b.index;
          })
          .map(item => item.key);

      applySheetOrderNumbers_ACU(historicalData, orderedKeys);
      return buildChatSheetGuideDataFromData_ACU(historicalData, {
          preserveSeedRowsFromGuideData: null,
          seedRowsFromTemplateObj: null,
          orderedKeys,
      });
  }

  function getLegacyTemplateSnapshotLabel_ACU(source = 'legacy_frozen') {
      if (source === 'legacy_history_frozen') return '旧对话历史模板快照';
      if (source === 'legacy_header_frozen') return '旧版表头冻结模板';
      return '旧版聊天冻结模板';
  }

  function buildChatTemplateScopeStateFromGuideData_ACU({ isolationKey = getCurrentIsolationKey_ACU(), presetName = '', source = 'legacy_frozen', originGlobalName = '', originGlobalRevision = 0, updatedAt = Date.now(), guideData = null } = {}) {
      const normalizedGuideData = normalizeGuideData_ACU(guideData);
      if (!normalizedGuideData || !Object.keys(normalizedGuideData).some(k => k.startsWith('sheet_'))) return null;
      const templateObj = materializeDataFromSheetGuide_ACU(normalizedGuideData, { includeSeedRows: true });
      return buildChatTemplateScopeStateFromCurrent_ACU({
          isolationKey,
          presetName,
          source,
          originGlobalName,
          originGlobalRevision,
          updatedAt,
          templateSource: templateObj,
          guideData: normalizedGuideData,
      });
  }

  function migrateLegacyTemplateScopeForCurrentChat_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const normalizedKey = normalizeTemplateScopeIsolationKey_ACU(isolationKey);
      const existingScopeState = getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey });
      if (existingScopeState) return existingScopeState;

      const persistMigratedState = (guideData, { source = 'legacy_frozen', updatedAt = Date.now() } = {}) => {
          const templateState = buildChatTemplateScopeStateFromGuideData_ACU({
              isolationKey: normalizedKey,
              presetName: getLegacyTemplateSnapshotLabel_ACU(source),
              source,
              originGlobalName: '',
              originGlobalRevision: 0,
              updatedAt,
              guideData,
          });
          if (!templateState) return null;
          return setCurrentChatTemplateScopeState_ACU(templateState, {
              isolationKey: normalizedKey,
              reason: `template_scope_${source}`,
          });
      };

      const container = getChatSheetGuideContainer_ACU(chat);
      const legacySlot = container?.tags?.[normalizedKey];
      const hasExplicitLegacyScopeMode = typeof legacySlot?.templateScopeMode === 'string' && legacySlot.templateScopeMode.trim() !== '';
      const legacySlotMode = hasExplicitLegacyScopeMode
          ? normalizeTemplateScopeMode_ACU(legacySlot.templateScopeMode)
          : 'chat_override';
      const legacyGuideData = normalizeGuideData_ACU(legacySlot?.data);
      if (legacySlotMode === 'chat_override' && legacyGuideData && Object.keys(legacyGuideData).some(k => k.startsWith('sheet_'))) {
          return persistMigratedState(legacyGuideData, {
              source: 'legacy_frozen',
              updatedAt: Number(legacySlot?.updatedAt) || Date.now(),
          });
      }

      const historicalGuideData = getHistoricalTemplateGuideDataForIsolationKey_ACU({ chat, isolationKey: normalizedKey });
      if (historicalGuideData && Object.keys(historicalGuideData).some(k => k.startsWith('sheet_'))) {
          return persistMigratedState(historicalGuideData, {
              source: 'legacy_history_frozen',
              updatedAt: Date.now(),
          });
      }

      const legacyHeaderGuideData = getLegacyHeaderGuideDataForIsolationKey_ACU({ chat, isolationKey: normalizedKey });
      if (legacyHeaderGuideData && Object.keys(legacyHeaderGuideData).some(k => k.startsWith('sheet_'))) {
          return persistMigratedState(legacyHeaderGuideData, {
              source: 'legacy_header_frozen',
              updatedAt: Date.now(),
          });
      }

      return null;
  }

  function clearChatSheetGuideDataForIsolationKey_ACU({ chat = SillyTavern_API_ACU?.chat, isolationKey = getCurrentIsolationKey_ACU() } = {}) {
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return false;

      const container = getChatSheetGuideContainer_ACU(chat);
      if (!container || typeof container !== 'object' || !container.tags || typeof container.tags !== 'object') return false;

      const normalizedKey = String(isolationKey ?? '');
      if (!Object.prototype.hasOwnProperty.call(container.tags, normalizedKey)) return false;

      const nextContainer = cloneScopedConfigData_ACU(container, null) || { version: CHAT_SHEET_GUIDE_VERSION_ACU, tags: {} };
      if (!nextContainer.tags || typeof nextContainer.tags !== 'object') nextContainer.tags = {};
      delete nextContainer.tags[normalizedKey];

      if (Object.keys(nextContainer.tags).length === 0) {
          delete first[CHAT_SHEET_GUIDE_FIELD_ACU];
      } else {
          nextContainer.version = CHAT_SHEET_GUIDE_VERSION_ACU;
          first[CHAT_SHEET_GUIDE_FIELD_ACU] = nextContainer;
      }
      return true;
  }

  function getChatSheetGuideDataForIsolationKey_ACU(isolationKey) {
      const chat = SillyTavern_API_ACU?.chat;
      const normalizedKey = String(isolationKey ?? '');
      const scopedTemplateState = getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey })
          || migrateLegacyTemplateScopeForCurrentChat_ACU({ chat, isolationKey: normalizedKey });
      const scopedGuideData = normalizeGuideData_ACU(scopedTemplateState?.guideData);
      if (scopedGuideData && Object.keys(scopedGuideData).some(k => k.startsWith('sheet_'))) {
          return scopedGuideData;
      }

      const buildGuideDataFromTemplateSource_ACU = (templateSource) => {
          const templateSnapshot = sanitizeTemplateSnapshotForChat_ACU(templateSource);
          const guideData = buildChatSheetGuideDataFromTemplateObj_ACU(templateSnapshot?.templateObj, { stripSeedRows: false });
          return (guideData && Object.keys(guideData).some(k => k.startsWith('sheet_'))) ? guideData : null;
      };

      if (scopedTemplateState?.mode === 'chat_override' && scopedTemplateState?.templateStr) {
          const overrideGuideData = buildGuideDataFromTemplateSource_ACU(scopedTemplateState.templateStr);
          if (overrideGuideData) {
              return overrideGuideData;
          }
      }

      if (scopedTemplateState?.mode === 'preset_link') {
          const linkedPresetName = normalizeTemplatePresetSelectionValue_ACU(scopedTemplateState?.presetName || '');
          const linkedTemplateSource = linkedPresetName
              ? (getTemplatePreset_ACU(linkedPresetName)?.templateStr || null)
              : getDefaultTemplateSnapshot_ACU()?.templateStr;
          const linkedGuideData = buildGuideDataFromTemplateSource_ACU(linkedTemplateSource);
          if (linkedGuideData) {
              return linkedGuideData;
          }
      }

      const activeTemplateGuideData = buildGuideDataFromTemplateSource_ACU(TABLE_TEMPLATE_ACU);
      if (activeTemplateGuideData) {
          return activeTemplateGuideData;
      }

      const globalSnapshot = getGlobalTemplateSnapshotForCurrentProfile_ACU();
      const globalGuideData = buildChatSheetGuideDataFromTemplateObj_ACU(globalSnapshot?.templateObj, { stripSeedRows: false });
      if (globalGuideData && Object.keys(globalGuideData).some(k => k.startsWith('sheet_'))) {
          return globalGuideData;
      }

      return null;
  }

  function setChatSheetGuideDataForIsolationKey_ACU(isolationKey, guideData, { reason = '', syncTemplateScope = false, templateSource = null, presetName = '', source = '', updatedAt = Date.now() } = {}) {
      const chat = SillyTavern_API_ACU?.chat;
      const first = getChatFirstLayerMessage_ACU(chat);
      if (!first) return false;

      const normalized = normalizeGuideData_ACU(guideData);
      if (!normalized || !Object.keys(normalized).some(k => k.startsWith('sheet_'))) return false;

      const normalizedKey = String(isolationKey ?? '');
      const existingTemplateScopeState = getCurrentChatTemplateScopeState_ACU({ chat, isolationKey: normalizedKey });
      const normalizedScopeMode = normalizeTemplateScopeMode_ACU(existingTemplateScopeState?.mode);
      const shouldSyncTemplateScope = !!syncTemplateScope || normalizedScopeMode === 'chat_override' || normalizedScopeMode === 'preset_link';
      const container = getChatSheetGuideContainer_ACU(chat) || { version: CHAT_SHEET_GUIDE_VERSION_ACU, tags: {} };
      if (!container.tags || typeof container.tags !== 'object') container.tags = {};
      container.version = CHAT_SHEET_GUIDE_VERSION_ACU;
      container.tags[normalizedKey] = {
          data: normalized,
          updatedAt,
          reason: String(reason || ''),
          templateScopeMode: shouldSyncTemplateScope ? 'chat_override' : 'inherit_global',
      };
      first[CHAT_SHEET_GUIDE_FIELD_ACU] = container;
      if (shouldSyncTemplateScope) {
          const fallbackTemplateSource = existingTemplateScopeState?.templateStr || materializeDataFromSheetGuide_ACU(normalized, { includeSeedRows: true });
          const resolvedTemplateSource = templateSource || fallbackTemplateSource;
          const currentGlobalPresetName = normalizeTemplatePresetSelectionValue_ACU(getCurrentTemplatePresetName_ACU({ requireExisting: false }));
          const resolvedPresetName = normalizeTemplatePresetSelectionValue_ACU(
              presetName || existingTemplateScopeState?.presetName || currentGlobalPresetName,
          );
          const resolvedSource = normalizeChatScopedConfigSource_ACU(
              source,
              existingTemplateScopeState?.source || (syncTemplateScope ? 'ui' : 'inherit'),
          );
          const templateState = buildChatTemplateScopeStateFromCurrent_ACU({
              isolationKey: normalizedKey,
              presetName: resolvedPresetName,
              source: resolvedSource,
              originGlobalName: normalizeTemplatePresetSelectionValue_ACU(
                  existingTemplateScopeState?.originGlobalName || currentGlobalPresetName,
              ),
              originGlobalRevision: Number.isFinite(existingTemplateScopeState?.originGlobalRevision)
                  ? existingTemplateScopeState.originGlobalRevision
                  : 0,
              updatedAt,
              templateSource: resolvedTemplateSource,
              guideData: normalized,
          });
          if (templateState) {
              setCurrentChatTemplateScopeState_ACU(templateState, {
                  isolationKey: normalizedKey,
                  reason: String(reason || `template_scope_${resolvedSource}`),
              });
              try {
                  upsertChatTemplatePresetEntry_ACU(templateState, { isolationKey: normalizedKey });
              } catch (e) {}
          }
      }
      return true;
  }

  // =========================
  // [新增] seedRows 解析/兜底：用于 $0 注入与“无数据初始化”场景
  // 目标：
  // - 新对话首次填表时，即使 currentJsonTableData_ACU 仅有表结构，也能从“内部指导表/模板”取到 seedRows
  // - 支持隔离标签切换或初始化早期 chat 尚未加载导致的“指导表未命中”情况
  // 注意：这里只把 seedRows 挂在表对象字段上，不会写入 content（不把模板基础数据当作真实聊天数据）
  // =========================
  let _seedRowsTemplateCacheStr_ACU = null;
  let _seedRowsTemplateCacheObj_ACU = null;

  function getTemplateObjForSeedRows_ACU() {
      try {
          if (_seedRowsTemplateCacheStr_ACU === TABLE_TEMPLATE_ACU && _seedRowsTemplateCacheObj_ACU) return _seedRowsTemplateCacheObj_ACU;
          const obj = parseTableTemplateJson_ACU({ stripSeedRows: false });
          _seedRowsTemplateCacheStr_ACU = TABLE_TEMPLATE_ACU;
          _seedRowsTemplateCacheObj_ACU = obj;
          return obj;
      } catch (e) {
          return null;
      }
  }

  async function ensureChatSheetGuideSeeded_ACU({ reason = 'auto_seed_seedRows', force = false } = {}) {
      try {
          const isolationKey = getCurrentIsolationKey_ACU();
          const existing = getChatSheetGuideDataForIsolationKey_ACU(isolationKey);
          const hasExisting = !!(existing && typeof existing === 'object' && Object.keys(existing).some(k => k.startsWith('sheet_')));
          if (hasExisting && !force) return existing;

          const chat = SillyTavern_API_ACU?.chat;
          if (!chat || !Array.isArray(chat) || chat.length === 0) return existing || null;

          const templateObj = getTemplateObjForSeedRows_ACU();
          if (!templateObj) return existing || null;

          // 用模板构建指导表（content 保留表头；seedRows 写入字段）
          const guideData = buildChatSheetGuideDataFromTemplateObj_ACU(templateObj, { stripSeedRows: true });
          if (!guideData) return existing || null;

          const ok = setChatSheetGuideDataForIsolationKey_ACU(isolationKey, guideData, { reason });
          if (ok) {
              try { await SillyTavern_API_ACU.saveChat(); } catch (e) {}
              logDebug_ACU(`[SheetGuide] Auto-seeded chat sheet guide for tag [${isolationKey || '无标签'}], reason=${reason}`);
          }
          return guideData;
      } catch (e) {
          return null;
      }
  }

  function pickAnyGuideSeedRowsSlot_ACU(sheetKey) {
      try {
          const chat = SillyTavern_API_ACU?.chat;
          let best = null; // { ts, seedRows }
          const applyCandidate = (ts, data) => {
              const sr = data?.[sheetKey]?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
              if (!Array.isArray(sr) || sr.length === 0) return;
              if (!best || ts > best.ts) {
                  best = { ts, seedRows: sr };
              }
          };

          const scopedContainer = getChatScopedConfigContainer_ACU(chat);
          const scopedTemplateSlots = scopedContainer?.template;
          if (scopedTemplateSlots && typeof scopedTemplateSlots === 'object' && !Array.isArray(scopedTemplateSlots)) {
              Object.keys(scopedTemplateSlots).forEach(tagKey => {
                  const slotState = normalizeChatTemplateScopeState_ACU(scopedTemplateSlots[tagKey], { isolationKey: tagKey });
                  if (slotState.mode !== 'chat_override') return;
                  applyCandidate(Number(slotState.updatedAt) || 0, normalizeGuideData_ACU(slotState.guideData));
              });
          }
          if (best) {
              return JSON.parse(JSON.stringify(best.seedRows));
          }

          const container = getChatSheetGuideContainer_ACU(chat);
          const tags = container?.tags;
          if (!tags || typeof tags !== 'object') return null;
          Object.keys(tags).forEach(tagKey => {
              const slot = tags[tagKey];
              const ts = Number(slot?.updatedAt) || 0;
              applyCandidate(ts, normalizeGuideData_ACU(slot?.data));
          });
          return best ? JSON.parse(JSON.stringify(best.seedRows)) : null;
      } catch (e) {
          return null;
      }
  }

  function getEffectiveSeedRowsForSheet_ACU(sheetKey, { guideData = null, allowTemplateFallback = true } = {}) {
      try {
          if (!sheetKey || !String(sheetKey).startsWith('sheet_')) return [];
          const direct = currentJsonTableData_ACU?.[sheetKey]?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
          if (Array.isArray(direct) && direct.length > 0) return JSON.parse(JSON.stringify(direct));

          const g = guideData || (() => {
              const isolationKey = getCurrentIsolationKey_ACU();
              return getChatSheetGuideDataForIsolationKey_ACU(isolationKey);
          })();
          const sr1 = g?.[sheetKey]?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
          if (Array.isArray(sr1) && sr1.length > 0) return JSON.parse(JSON.stringify(sr1));

          const any = pickAnyGuideSeedRowsSlot_ACU(sheetKey);
          if (Array.isArray(any) && any.length > 0) return any;

          if (!allowTemplateFallback) return [];
          const templateObj = getTemplateObjForSeedRows_ACU();
          const tplRows = templateObj?.[sheetKey]?.content;
          if (Array.isArray(tplRows) && tplRows.length > 1) return JSON.parse(JSON.stringify(tplRows.slice(1)));
          return [];
      } catch (e) {
          return [];
      }
  }

  function attachSeedRowsToCurrentDataFromGuide_ACU(guideData) {
      try {
          if (!currentJsonTableData_ACU || typeof currentJsonTableData_ACU !== 'object') return false;
          const g = normalizeGuideData_ACU(guideData);
          if (!g) return false;
          let changed = false;
          Object.keys(currentJsonTableData_ACU).forEach(k => {
              if (!k.startsWith('sheet_')) return;
              const table = currentJsonTableData_ACU[k];
              if (!table || typeof table !== 'object') return;
              const existing = table?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
              if (Array.isArray(existing) && existing.length > 0) return;
              const sr = g?.[k]?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
              if (Array.isArray(sr) && sr.length > 0) {
                  table[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(sr));
                  changed = true;
              }
          });
          return changed;
      } catch (e) {
          return false;
      }
  }

  // [新增] 用“当前数据”构建空白指导表：只保留表头行 + 参数（顺序由 getSortedSheetKeys_ACU 的旧逻辑决定，避免递归）
  function buildChatSheetGuideDataFromData_ACU(dataObj, { preserveSeedRowsFromGuideData = null, seedRowsFromTemplateObj = null, orderedKeys = null } = {}) {
      if (!dataObj || typeof dataObj !== 'object') return null;
      const keys = Array.isArray(orderedKeys) && orderedKeys.length
          ? orderedKeys.filter(k => typeof k === 'string' && k.startsWith('sheet_') && dataObj[k])
          : getSortedSheetKeys_ACU(dataObj, { ignoreChatGuide: true });
      const out = { mate: { type: 'chatSheets', version: CHAT_SHEET_GUIDE_VERSION_ACU } };
      if (dataObj.mate && typeof dataObj.mate === 'object') {
          out.mate = JSON.parse(JSON.stringify(dataObj.mate));
      }
      out.mate.globalInjectionConfig = ensureGlobalInjectionConfigDefaults_ACU(out.mate.globalInjectionConfig);
      keys.forEach(k => {
          const s = dataObj[k];
          if (!s) return;
          const headerRow = Array.isArray(s.content) && Array.isArray(s.content[0]) ? JSON.parse(JSON.stringify(s.content[0])) : [null];
          const blank = {
              uid: s.uid || k,
              name: s.name || k,
              sourceData: s.sourceData ? JSON.parse(JSON.stringify(s.sourceData)) : { note: '', initNode: '', insertNode: '', updateNode: '', deleteNode: '' },
              content: [headerRow],
              updateConfig: s.updateConfig ? JSON.parse(JSON.stringify(s.updateConfig)) : { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
              exportConfig: ensureExportConfigDefaults_ACU(
                  s.exportConfig ? JSON.parse(JSON.stringify(s.exportConfig)) : null,
                  s.name || k
              ),
          };
          // 需求4：结构/表名/参数变更时，仅更新指导表元信息，不修改“基础数据(seedRows)”
          const preserved = preserveSeedRowsFromGuideData?.[k]?.[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU];
          if (Array.isArray(preserved)) {
              blank[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(preserved));
          } else {
              // 需求1：首次生成指导表时，把模板预置数据写入 seedRows（仅在未能从既有指导表继承时）
              const tplRows = seedRowsFromTemplateObj?.[k]?.content;
              if (Array.isArray(tplRows) && tplRows.length > 1) {
                  blank[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(tplRows.slice(1)));
              }
          }
          if (Number.isFinite(s?.[TABLE_ORDER_FIELD_ACU])) blank[TABLE_ORDER_FIELD_ACU] = Math.trunc(s[TABLE_ORDER_FIELD_ACU]);
          out[k] = blank;
      });
      return normalizeGuideData_ACU(out);
  }

  // [新增] 用“模板对象”构建空白指导表：只保留表头行 + 参数（模板已有顺序编号）
  function buildChatSheetGuideDataFromTemplateObj_ACU(templateObj, { stripSeedRows = true } = {}) {
      if (!templateObj || typeof templateObj !== 'object') return null;
      const keys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
      if (keys.length === 0) return null;
      // 确保模板编号稳定（缺失则补齐）
      try { ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: keys, forceRebuild: false }); } catch (e) {}
      const sorted = keys.sort((a, b) => {
          const ao = Number.isFinite(templateObj?.[a]?.[TABLE_ORDER_FIELD_ACU]) ? Math.trunc(templateObj[a][TABLE_ORDER_FIELD_ACU]) : Infinity;
          const bo = Number.isFinite(templateObj?.[b]?.[TABLE_ORDER_FIELD_ACU]) ? Math.trunc(templateObj[b][TABLE_ORDER_FIELD_ACU]) : Infinity;
          if (ao !== bo) return ao - bo;
          return String(a).localeCompare(String(b));
      });
      const out = { mate: { type: 'chatSheets', version: CHAT_SHEET_GUIDE_VERSION_ACU } };
      if (templateObj.mate && typeof templateObj.mate === 'object') {
          out.mate = JSON.parse(JSON.stringify(templateObj.mate));
      }
      out.mate.globalInjectionConfig = ensureGlobalInjectionConfigDefaults_ACU(out.mate.globalInjectionConfig);
      sorted.forEach((k, idx) => {
          const base = JSON.parse(JSON.stringify(templateObj[k] || {}));
          base.uid = base.uid || k;
          base.name = base.name || k;
          if (!Array.isArray(base.content) || base.content.length === 0) base.content = [[null]];
          // v2: 保存模板预置数据为 seedRows，但指导表本体 content 仍只保留表头
          if (Array.isArray(base.content) && base.content.length > 1) {
              base[CHAT_SHEET_GUIDE_SEED_ROWS_FIELD_ACU] = JSON.parse(JSON.stringify(base.content.slice(1)));
          }
          if (stripSeedRows && Array.isArray(base.content) && base.content.length > 1) base.content = [base.content[0]];
          if (!Number.isFinite(base[TABLE_ORDER_FIELD_ACU])) base[TABLE_ORDER_FIELD_ACU] = idx;
          out[k] = base;
      });
      return normalizeGuideData_ACU(out);
  }

  // [新增] 覆盖式更新：用模板写入当前聊天第一层"空白指导表"
  async function overwriteChatSheetGuideFromTemplate_ACU(templateObj, { reason = 'template_changed', stripSeedRows = true, presetName = '', source = 'ui', syncTemplateScope = false, registerPreset = false } = {}) {
      const guideData = buildChatSheetGuideDataFromTemplateObj_ACU(templateObj, { stripSeedRows });
      if (!guideData) return false;
      const isolationKey = getCurrentIsolationKey_ACU();
      const templateSnapshot = sanitizeTemplateSnapshotForChat_ACU(templateObj);
      const normalizedPresetName = deriveTemplatePresetNameForImport_ACU({ presetName });
      if (registerPreset && normalizedPresetName && templateSnapshot?.templateStr) {
          try {
              const savePresetOk = upsertTemplatePreset_ACU(normalizedPresetName, templateSnapshot.templateStr);
              if (!savePresetOk) {
                  logWarn_ACU(`[TemplateScope] 保存模板预设失败：${normalizedPresetName}`);
              }
          } catch (e) {
              logWarn_ACU('[TemplateScope] 保存模板预设失败:', e);
          }
      }
      const ok = setChatSheetGuideDataForIsolationKey_ACU(isolationKey, guideData, {
          reason,
          syncTemplateScope,
          templateSource: templateSnapshot?.templateStr || templateObj,
          presetName: normalizedPresetName,
          source,
      });
      if (!ok) return false;
      if (syncTemplateScope) {
          try { applyTemplateScopeForCurrentChat_ACU(); } catch (e) {}
      }
      try { await SillyTavern_API_ACU.saveChat(); } catch (e) {}
      try { await refreshMergedDataAndNotify_ACU(); } catch (e) {}
      return true;
  }

  // [表格顺序新机制] 获取表格 keys：
  // - 若当前聊天已存在“空白指导表”：优先按指导表的 orderNo 顺序（可过滤不在指导表里的表）
  // - 否则：按“编号(orderNo)从小到大”排序；缺编号则回退到模板编号/模板顺序
  function getSortedSheetKeys_ACU(dataObj, { ignoreChatGuide = false, includeMissingFromGuide = false } = {}) {
      if (!dataObj || typeof dataObj !== 'object') return [];
      const existingKeys = Object.keys(dataObj).filter(k => k.startsWith('sheet_'));
      if (existingKeys.length === 0) return [];

      // [新增] 聊天级空白指导表：一旦存在，则该聊天不再按模板顺序合并/显示，而是按此指导表作为总指导
      if (!ignoreChatGuide) {
          try {
              const isolationKey = (typeof getCurrentIsolationKey_ACU === 'function') ? getCurrentIsolationKey_ACU() : '';
              const guideData = getChatSheetGuideDataForIsolationKey_ACU(isolationKey);
              if (guideData && typeof guideData === 'object') {
                  const guideKeys = Object.keys(guideData).filter(k => k.startsWith('sheet_'));
                  if (guideKeys.length > 0) {
                      const sorted = guideKeys.sort((a, b) => {
                          const ao = Number.isFinite(guideData?.[a]?.[TABLE_ORDER_FIELD_ACU]) ? Math.trunc(guideData[a][TABLE_ORDER_FIELD_ACU]) : Infinity;
                          const bo = Number.isFinite(guideData?.[b]?.[TABLE_ORDER_FIELD_ACU]) ? Math.trunc(guideData[b][TABLE_ORDER_FIELD_ACU]) : Infinity;
                          if (ao !== bo) return ao - bo;
                          return String(a).localeCompare(String(b));
                      });
                      return includeMissingFromGuide ? sorted : sorted.filter(k => dataObj[k]);
                  }
              }
          } catch (e) {
              // ignore guide failures; fallback to legacy ordering
          }
      }

      // 尝试拿模板做兜底（比如老数据/导入数据缺编号）
      const templateObj = parseTableTemplateJson_ACU({ stripSeedRows: false });

      // 先对 dataObj 补齐缺失编号（仅在确实缺失/重复时重建）
      // baseOrderKeys 的优先级：模板顺序 > 当前对象键顺序（保证“载入模板编好号”后的稳定性）
      const baseKeys = (() => {
          const tk = templateObj && typeof templateObj === 'object'
              ? Object.keys(templateObj).filter(k => k.startsWith('sheet_'))
              : [];
          return tk.length ? tk : existingKeys;
      })();
      ensureSheetOrderNumbers_ACU(dataObj, { baseOrderKeys: baseKeys, forceRebuild: false });

      const orderValueOf = (k) => {
          const v = dataObj?.[k]?.[TABLE_ORDER_FIELD_ACU];
          if (Number.isFinite(v)) return Math.trunc(v);
          const tv = templateObj?.[k]?.[TABLE_ORDER_FIELD_ACU];
          if (Number.isFinite(tv)) return Math.trunc(tv);
          return Infinity;
      };

      return existingKeys.sort((a, b) => {
          const ao = orderValueOf(a);
          const bo = orderValueOf(b);
          if (ao !== bo) return ao - bo;
          // 稳定排序：同编号时按名称/键
          const an = String(dataObj?.[a]?.name || templateObj?.[a]?.name || a);
          const bn = String(dataObj?.[b]?.name || templateObj?.[b]?.name || b);
          const c = an.localeCompare(bn);
          if (c !== 0) return c;
          return String(a).localeCompare(String(b));
      });
  }

  // [新增] 基于“空白指导表”构建可合并的骨架数据（深拷贝，避免后续修改污染原对象）
  function buildGuidedBaseDataFromSheetGuide_ACU(guideData) {
      const normalized = normalizeGuideData_ACU(guideData);
      if (!normalized) return { mate: { type: 'chatSheets', version: 1 } };
      try { return JSON.parse(JSON.stringify(normalized)); } catch (e) { return normalized; }
  }

  // [修复] 按指定顺序重建对象键，避免 Object.keys()/合并/深拷贝导致的顺序漂移
  function reorderDataBySheetKeys_ACU(dataObj, orderedSheetKeys) {
      if (!dataObj || typeof dataObj !== 'object') return dataObj;
      const out = {};
      // 先保留非 sheet_ 键（mate 等）
      Object.keys(dataObj).forEach(k => {
          if (!k.startsWith('sheet_')) out[k] = dataObj[k];
      });
      // 再按顺序插入 sheet_ 键
      const keys = Array.isArray(orderedSheetKeys) ? orderedSheetKeys : getSortedSheetKeys_ACU(dataObj);
      keys.forEach(k => {
          if (dataObj[k]) out[k] = dataObj[k];
      });
      return out;
  }

  // =========================
  // [瘦身/兼容] ChatSheets 表格对象清洗（用于：导出、写入聊天记录、持久化模板）
  // 目标：
  // - 与旧模板/旧存档兼容：导入时允许存在冗余字段
  // - 从现在开始：导出/保存时不再携带历史遗留冗余字段，降低体积
  // =========================
  const SHEET_KEEP_KEYS_ACU = new Set([
      'uid',
      'name',
      'sourceData',
      'content',
      // [重要] 可视化编辑器/表格配置（更新频率、上下文深度等）依赖该字段
      'updateConfig',
      'exportConfig',
      TABLE_ORDER_FIELD_ACU, // orderNo
  ]);

  function sanitizeSheetForStorage_ACU(sheet) {
      if (!sheet || typeof sheet !== 'object') return sheet;
      const out = {};
      SHEET_KEEP_KEYS_ACU.forEach(k => {
          if (sheet[k] !== undefined) out[k] = sheet[k];
      });
      // 兜底：保证结构可被模板导入验证通过
      if (!out.name && sheet.name) out.name = sheet.name;
      if (!out.content && Array.isArray(sheet.content)) out.content = sheet.content;
      if (!out.sourceData && sheet.sourceData) out.sourceData = sheet.sourceData;
      out.exportConfig = ensureExportConfigDefaults_ACU(out.exportConfig, out.name || sheet.name || sheet.uid || '');
      return out;
  }

  function sanitizeChatSheetsObject_ACU(dataObj, { ensureMate = false } = {}) {
      if (!dataObj || typeof dataObj !== 'object') return dataObj;
      const out = {};
      Object.keys(dataObj).forEach(k => {
          if (k.startsWith('sheet_')) {
              out[k] = sanitizeSheetForStorage_ACU(dataObj[k]);
          } else if (k === 'mate') {
              out.mate = dataObj.mate;
          } else {
              // 其它顶层键：为兼容保留
              out[k] = dataObj[k];
          }
      });
      if (ensureMate) {
          if (!out.mate || typeof out.mate !== 'object') out.mate = { type: 'chatSheets', version: 1 };
          if (!out.mate.type) out.mate.type = 'chatSheets';
          if (!out.mate.version) out.mate.version = 1;
      }
      return out;
  }

  function lightenDarkenColor_ACU(col, amt) {
    let usePound = false;
    if (col.startsWith('#')) {
      col = col.slice(1);
      usePound = true;
    }
    let num = parseInt(col, 16);
    let r = (num >> 16) + amt;
    if (r > 255) r = 255;
    else if (r < 0) r = 0;
    let b = ((num >> 8) & 0x00ff) + amt;
    if (b > 255) b = 255;
    else if (b < 0) b = 0;
    let g = (num & 0x0000ff) + amt;
    if (g > 255) g = 255;
    else if (g < 0) g = 0;
    return (usePound ? '#' : '') + ('000000' + ((r << 16) | (b << 8) | g).toString(16)).slice(-6);
  }
  function getContrastYIQ_ACU(hexcolor) {
    if (hexcolor.startsWith('#')) hexcolor = hexcolor.slice(1);
    var r = parseInt(hexcolor.substr(0, 2), 16);
    var g = parseInt(hexcolor.substr(2, 2), 16);
    var b = parseInt(hexcolor.substr(4, 2), 16);
    var yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#000000' : '#FFFFFF';
  }


  // [新增] 辅助函数：从上下文中提取指定标签的内容（正文标签提取）
  function extractContextTags_ACU(text, tagNames, excludeUserMessages = false) {
      if (!text || !tagNames || tagNames.length === 0) {
          return text;
      }
      
      let result = text;

      // 如果排除用户消息，则需要按行处理
      if (excludeUserMessages) {
          const lines = result.split('\n');
          const processedLines = lines.map(line => {
              // 检查是否是用户消息行（通常以特定格式标识）
              if (line.includes('[User]') || line.includes('User:') || line.includes('用户:')) {
                  return line; // 用户消息不处理
              }
              // 对非用户消息行进行标签提取
              return extractTagsFromLine(line, tagNames);
          });
          result = processedLines.join('\n');
      } else {
          result = extractTagsFromLine(result, tagNames);
      }

      return result;
  }

  // 辅助函数：从单行文本中提取标签内容
  function extractTagsFromLine(text, tagNames) {
      if (!text || !tagNames || tagNames.length === 0) {
          return text;
      }
      
      let result = text;
      const extractedParts = [];

      tagNames.forEach(tagName => {
          const content = extractLastTagContent(text, tagName);
          if (content !== null) {
              extractedParts.push(`<${tagName}>${content}</${tagName}>`);
          }
      });

      if (extractedParts.length > 0) {
          result = extractedParts.join('\n\n');
      }

      return result;
  }

  // 辅助函数：提取文本中最后一个指定标签的内容
  function extractLastTagContent(text, tagName) {
      if (!text || !tagName) return null;
      const lower = text.toLowerCase();
      const open = `<${tagName.toLowerCase()}>`;
      const close = `</${tagName.toLowerCase()}>`;

      const closeIdx = lower.lastIndexOf(close);
      if (closeIdx === -1) return null;

      const openIdx = lower.lastIndexOf(open, closeIdx);
      if (openIdx === -1) return null;

      const contentStart = openIdx + open.length;
      const content = text.slice(contentStart, closeIdx);
      return content;
  }

  // [新增] 标签列表解析：支持英文逗号/中文逗号/空格分隔
  function parseTagList_ACU(input) {
      if (!input || typeof input !== 'string') return [];
      return input
          .split(/[,，\s]+/g)
          .map(t => t.trim())
          .filter(Boolean)
          .map(t => t.replace(/[<>]/g, '')); // 防止用户输入 <tag>
  }

  // [新增] 兼容旧“标签提取/排除”字符串：tagA,tagB -> [{start:"<tagA", end:"</tagA>"}, ...]
  function buildBoundaryRulesFromLegacyTags_ACU(tagsText = '') {
      const tags = parseTagList_ACU(tagsText);
      return tags.map(tag => ({ start: `<${tag}`, end: `</${tag}>` }));
  }

  // [新增] 标准化标签排除规则：支持数组对象/字符串行/旧标签字符串兜底
  function normalizeExcludeRules_ACU(excludeRulesInput, legacyExcludeTags = '') {
      const normalized = [];
      const dedup = new Set();

      const pushRule = (startRaw, endRaw) => {
          const start = String(startRaw || '').trim();
          const end = String(endRaw || '').trim();
          if (!start || !end) return;
          const key = `${start}\u0000${end}`;
          if (dedup.has(key)) return;
          dedup.add(key);
          normalized.push({ start, end });
      };

      if (Array.isArray(excludeRulesInput)) {
          excludeRulesInput.forEach(rule => {
              if (!rule) return;
              if (typeof rule === 'string') {
                  const parts = rule.split('|');
                  if (parts.length >= 2) {
                      const start = parts.shift();
                      const end = parts.join('|');
                      pushRule(start, end);
                  }
                  return;
              }
              if (typeof rule === 'object') {
                  pushRule(rule.start ?? rule.begin ?? rule.open, rule.end ?? rule.close ?? rule.finish);
              }
          });
      }

      // 兼容旧配置：若未提供新规则，则回退旧标签字符串
      if (normalized.length === 0) {
          buildBoundaryRulesFromLegacyTags_ACU(legacyExcludeTags).forEach(rule => pushRule(rule.start, rule.end));
      }

      return normalized;
  }

  // [新增] 标准化正文标签提取规则，结构与排除规则一致
  function normalizeExtractRules_ACU(extractRulesInput, legacyExtractTags = '') {
      return normalizeExcludeRules_ACU(extractRulesInput, legacyExtractTags);
  }

  function getDefaultPlotContextExtractRules_ACU() {
      return normalizeExtractRules_ACU(
          DEFAULT_PLOT_SETTINGS_ACU.contextExtractRules,
          DEFAULT_PLOT_SETTINGS_ACU.contextExtractTags || '',
      );
  }

  function getDefaultPlotContextExcludeRules_ACU() {
      return normalizeExcludeRules_ACU(
          DEFAULT_PLOT_SETTINGS_ACU.contextExcludeRules,
          DEFAULT_PLOT_SETTINGS_ACU.contextExcludeTags || '',
      );
  }

  // [新增] 按“开始词 + 结束词”删除最后一个命中区间
  function removeLastMatchedBoundary_ACU(text, startBoundary, endBoundary) {
      const source = String(text ?? '');
      const start = String(startBoundary || '');
      const end = String(endBoundary || '');
      if (!source || !start || !end) return source;

      const lowerSource = source.toLowerCase();
      const lowerStart = start.toLowerCase();
      const lowerEnd = end.toLowerCase();

      const endIdx = lowerSource.lastIndexOf(lowerEnd);
      if (endIdx === -1) return source;

      const startIdx = lowerSource.lastIndexOf(lowerStart, Math.max(0, endIdx - 1));
      if (startIdx === -1) return source;

      const removeTo = endIdx + end.length;
      if (removeTo <= startIdx) return source;

      return source.slice(0, startIdx) + source.slice(removeTo);
  }

  // [新增] 对文本应用排除规则：每组规则仅移除“最后一个”命中区间
  function applyExcludeRulesToText_ACU(text, { excludeRules = [], excludeTags = '' } = {}) {
      let result = String(text ?? '');
      const rules = normalizeExcludeRules_ACU(excludeRules, excludeTags);
      if (!result || rules.length === 0) return result;

      rules.forEach(rule => {
          result = removeLastMatchedBoundary_ACU(result, rule.start, rule.end);
      });

      return result.replace(/\n{3,}/g, '\n\n').trim();
  }

  // [新增] 提取“开始词 + 结束词”最后一组命中区间（保留区间文本）
  function extractLastMatchedBoundary_ACU(text, startBoundary, endBoundary) {
      const source = String(text ?? '');
      const start = String(startBoundary || '');
      const end = String(endBoundary || '');
      if (!source || !start || !end) return null;

      const lowerSource = source.toLowerCase();
      const lowerStart = start.toLowerCase();
      const lowerEnd = end.toLowerCase();

      const endIdx = lowerSource.lastIndexOf(lowerEnd);
      if (endIdx === -1) return null;
      const startIdx = lowerSource.lastIndexOf(lowerStart, Math.max(0, endIdx - 1));
      if (startIdx === -1) return null;

      const rangeEnd = endIdx + end.length;
      if (rangeEnd <= startIdx) return null;
      return source.slice(startIdx, rangeEnd);
  }

  // [新增] 对文本应用提取规则：每组规则提取最后一组命中并拼接返回；若无命中则保留原文本
  function applyExtractRulesToText_ACU(text, { extractRules = [], extractTags = '' } = {}) {
      const source = String(text ?? '');
      const rules = normalizeExtractRules_ACU(extractRules, extractTags);
      if (!source || rules.length === 0) return source;

      const parts = [];
      rules.forEach(rule => {
          const matched = extractLastMatchedBoundary_ACU(source, rule.start, rule.end);
          if (matched !== null) parts.push(matched);
      });
      if (parts.length === 0) return source;
      return parts.join('\n\n');
  }

  // [新增] 上下文筛选：标签提取 + 标签排除（可单独生效，也可叠加）
  function applyContextTagFilters_ACU(text, { extractTags = '', extractRules = [], excludeTags = '', excludeRules = [] } = {}) {
      let result = String(text ?? '');
      result = applyExtractRulesToText_ACU(result, { extractRules, extractTags });
      result = applyExcludeRulesToText_ACU(result, { excludeRules, excludeTags });
      return result;
  }

  // [新增] 辅助函数：判断表格是否是总结表、总体大纲表或纪要表（这些表拥有索引编码锁定功能）
  function isSummaryOrOutlineTable_ACU(tableName) {
      if (!tableName || typeof tableName !== 'string') return false;
      const trimmedName = tableName.trim();
      return trimmedName === '总结表' || trimmedName === '总体大纲' || trimmedName === '纪要表';
  }

  // [新增] 辅助函数：判断表格是否是标准表（非总结表和总体大纲表）
  function isStandardTable_ACU(tableName) {
      return !isSummaryOrOutlineTable_ACU(tableName);
  }

  // =========================
  // [新增] 表格更新锁定与总结索引锁定（按聊天+隔离标签存储）
  // =========================
  function getTableLockScopeKey_ACU() {
      const chatKey = (currentChatFileIdentifier_ACU || 'default').trim() || 'default';
      const isolationKey = getCurrentIsolationKey_ACU() || '';
      return `${chatKey}::${isolationKey}`;
  }

  function ensureTableLockStore_ACU() {
      if (!settings_ACU.tableUpdateLocks || typeof settings_ACU.tableUpdateLocks !== 'object') {
          settings_ACU.tableUpdateLocks = {};
      }
      if (!settings_ACU.specialIndexLocks || typeof settings_ACU.specialIndexLocks !== 'object') {
          settings_ACU.specialIndexLocks = {};
      }
  }

  function getTableLocksForSheet_ACU(sheetKey) {
      const scopeKey = getTableLockScopeKey_ACU();
      const bucket = settings_ACU?.tableUpdateLocks?.[scopeKey]?.[sheetKey] || {};
      return {
          rows: new Set(Array.isArray(bucket.rows) ? bucket.rows : []),
          cols: new Set(Array.isArray(bucket.cols) ? bucket.cols : []),
          cells: new Set(Array.isArray(bucket.cells) ? bucket.cells : []),
      };
  }

  function saveTableLocksForSheet_ACU(sheetKey, lockState) {
      if (!sheetKey) return;
      ensureTableLockStore_ACU();
      const scopeKey = getTableLockScopeKey_ACU();
      if (!settings_ACU.tableUpdateLocks[scopeKey]) settings_ACU.tableUpdateLocks[scopeKey] = {};
      settings_ACU.tableUpdateLocks[scopeKey][sheetKey] = {
          rows: Array.from(lockState.rows || []),
          cols: Array.from(lockState.cols || []),
          cells: Array.from(lockState.cells || []),
      };
      saveSettings_ACU();
  }

  function toggleRowLock_ACU(sheetKey, rowIndex) {
      const lockState = getTableLocksForSheet_ACU(sheetKey);
      if (lockState.rows.has(rowIndex)) lockState.rows.delete(rowIndex);
      else lockState.rows.add(rowIndex);
      saveTableLocksForSheet_ACU(sheetKey, lockState);
  }

  function toggleColLock_ACU(sheetKey, colIndex) {
      const lockState = getTableLocksForSheet_ACU(sheetKey);
      if (lockState.cols.has(colIndex)) lockState.cols.delete(colIndex);
      else lockState.cols.add(colIndex);
      saveTableLocksForSheet_ACU(sheetKey, lockState);
  }

  function toggleCellLock_ACU(sheetKey, rowIndex, colIndex) {
      const lockState = getTableLocksForSheet_ACU(sheetKey);
      const key = `${rowIndex}:${colIndex}`;
      if (lockState.cells.has(key)) lockState.cells.delete(key);
      else lockState.cells.add(key);
      saveTableLocksForSheet_ACU(sheetKey, lockState);
  }

  function isSpecialIndexLockEnabled_ACU(sheetKey) {
      const scopeKey = getTableLockScopeKey_ACU();
      const bucket = settings_ACU?.specialIndexLocks?.[scopeKey] || {};
      if (typeof bucket[sheetKey] === 'boolean') return bucket[sheetKey];
      return true; // 默认锁定
  }

  function setSpecialIndexLockEnabled_ACU(sheetKey, enabled) {
      if (!sheetKey) return;
      ensureTableLockStore_ACU();
      const scopeKey = getTableLockScopeKey_ACU();
      if (!settings_ACU.specialIndexLocks[scopeKey]) settings_ACU.specialIndexLocks[scopeKey] = {};
      settings_ACU.specialIndexLocks[scopeKey][sheetKey] = !!enabled;
      saveSettings_ACU();
  }

  function getSummaryIndexColumnIndex_ACU(table) {
      try {
          if (!table || !Array.isArray(table.content) || !Array.isArray(table.content[0])) return -1;
          const headers = table.content[0].slice(1);
          if (!headers.length) return -1;
          let idx = headers.findIndex(h => {
              if (typeof h !== 'string') return false;
              return /编码|索引/.test(h);
          });
          if (idx === -1) idx = headers.length - 1;
          return idx;
      } catch (e) {
          return -1;
      }
  }

  function formatSummaryIndexCode_ACU(num) {
      const n = Math.max(1, parseInt(num, 10) || 1);
      return `AM${String(n).padStart(4, '0')}`;
  }

  function applySummaryIndexSequenceToTable_ACU(table, colIndex) {
      if (!table || !Array.isArray(table.content) || colIndex < 0) return;
      for (let i = 1; i < table.content.length; i++) {
          const row = table.content[i];
          if (!Array.isArray(row)) continue;
          row[colIndex + 1] = formatSummaryIndexCode_ACU(i);
      }
  }

  function applySpecialIndexSequenceToSummaryTables_ACU(dataObj) {
      if (!dataObj || typeof dataObj !== 'object') return;
      Object.keys(dataObj).forEach(sheetKey => {
          if (!sheetKey.startsWith('sheet_')) return;
          const table = dataObj[sheetKey];
          if (!table || !isSummaryOrOutlineTable_ACU(table.name)) return;
          if (!isSpecialIndexLockEnabled_ACU(sheetKey)) return;
          const colIndex = getSummaryIndexColumnIndex_ACU(table);
          if (colIndex < 0) return;
          applySummaryIndexSequenceToTable_ACU(table, colIndex);
      });
  }

  // [重构] 辅助函数：全表数据合并 (从独立存储中恢复完整状态)
  // [数据隔离核心] 严格按照当前隔离标签读取数据，无标签也是标签的一种
  async function mergeAllIndependentTables_ACU() {
      const chat = SillyTavern_API_ACU.chat;
      if (!chat || chat.length === 0) {
          logDebug_ACU('Cannot merge data: Chat history is empty.');
          return null;
      }

      // [数据隔离核心] 获取当前隔离标签键名
      const currentIsolationKey = getCurrentIsolationKey_ACU();
      logDebug_ACU(`[Merge] Loading data for isolation key: [${currentIsolationKey || '无标签'}]`);

      // [新增] 聊天级“空白指导表”：一旦存在，本聊天合并/显示顺序都按指导表，不再按模板
      // 注意：该指导表按隔离标签分槽，因此切换标识时可拥有不同的“参数/表头/顺序总指导”
      const sheetGuideData = getChatSheetGuideDataForIsolationKey_ACU(currentIsolationKey);
      const hasSheetGuide = !!(sheetGuideData && typeof sheetGuideData === 'object' && Object.keys(sheetGuideData).some(k => k.startsWith('sheet_')));

      // [新增] 获取当前模板/指导表的表格键列表，用于过滤非当前模板的数据
      // 优先使用指导表（如果存在），否则使用当前模板
      // 这样可以确保：切换/导入新模板后，只读取当前模板中存在的表格数据
      const templateSheetKeys = (() => {
          if (hasSheetGuide) {
              // 存在指导表：使用指导表的表格键（指导表已在导入/切换模板时更新）
              return Object.keys(sheetGuideData).filter(k => k.startsWith('sheet_'));
          }
          // 不存在指导表：使用当前模板的表格键
          return getTemplateSheetKeys_ACU();
      })();
      const templateSheetKeySet = new Set(templateSheetKeys);
      logDebug_ACU(`[Merge] Template/Guide filter: ${templateSheetKeys.length} tables allowed (${hasSheetGuide ? 'guide' : 'template'})`);

      // 1. [优化] 不使用模板作为基础，动态收集聊天记录中的所有实际数据
      let mergedData = {};
      const foundSheets = {};

      for (let i = chat.length - 1; i >= 0; i--) {
          const message = chat[i];
          if (message.is_user) continue;

          // [优先级1] 检查新版按标签分组存储 TavernDB_ACU_IsolatedData
          if (message.TavernDB_ACU_IsolatedData && message.TavernDB_ACU_IsolatedData[currentIsolationKey]) {
              const tagData = message.TavernDB_ACU_IsolatedData[currentIsolationKey];
              const independentData = tagData.independentData || {};
              const modifiedKeys = tagData.modifiedKeys || [];
              const updateGroupKeys = tagData.updateGroupKeys || [];

              Object.keys(independentData).forEach(storedSheetKey => {
                  // [新增] 只处理当前模板/指导表中存在的表格
                  if (!templateSheetKeySet.has(storedSheetKey)) {
                      logDebug_ACU(`[Merge] Skipping sheet [${storedSheetKey}] - not in current template/guide`);
                      return;
                  }
                  if (!foundSheets[storedSheetKey]) {
                      mergedData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                      foundSheets[storedSheetKey] = true;

                      // 更新表格状态
                      let wasUpdated = false;
                      if (updateGroupKeys.length > 0 && modifiedKeys.length > 0) {
                          wasUpdated = updateGroupKeys.includes(storedSheetKey);
                      } else if (modifiedKeys.length > 0) {
                          wasUpdated = modifiedKeys.includes(storedSheetKey);
                      } else {
                          wasUpdated = true;
                      }

                      if (wasUpdated) {
                          if (!independentTableStates_ACU[storedSheetKey]) {
                              independentTableStates_ACU[storedSheetKey] = {};
                          }
                          const currentAiFloor = chat.slice(0, i + 1).filter(m => !m.is_user).length;
                          independentTableStates_ACU[storedSheetKey].lastUpdatedAiFloor = currentAiFloor;
                      }
                  }
              });
          }

          // [优先级2] 兼容旧版存储格式 - 严格匹配隔离标签
          // [数据隔离核心逻辑] 无标签也是标签的一种，严格隔离不同标签的数据
          const msgIdentity = message.TavernDB_ACU_Identity;
          let isLegacyMatch = false;
          if (settings_ACU.dataIsolationEnabled) {
              // 开启隔离：严格匹配标识代码
              isLegacyMatch = (msgIdentity === settings_ACU.dataIsolationCode);
          } else {
              // 关闭隔离（无标签模式）：只匹配无标识数据
              isLegacyMatch = !msgIdentity;
          }

          if (isLegacyMatch) {
              // 检查旧版独立数据格式
              if (message.TavernDB_ACU_IndependentData) {
                  const independentData = message.TavernDB_ACU_IndependentData;
                  const modifiedKeys = message.TavernDB_ACU_ModifiedKeys || [];
                  const updateGroupKeys = message.TavernDB_ACU_UpdateGroupKeys || [];

                  Object.keys(independentData).forEach(storedSheetKey => {
                      // [新增] 只处理当前模板/指导表中存在的表格
                      if (!templateSheetKeySet.has(storedSheetKey)) {
                          logDebug_ACU(`[Merge] Skipping sheet [${storedSheetKey}] (legacy) - not in current template/guide`);
                          return;
                      }
                      if (!foundSheets[storedSheetKey]) {
                          mergedData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                          foundSheets[storedSheetKey] = true;

                          let wasUpdated = false;
                          if (updateGroupKeys.length > 0 && modifiedKeys.length > 0) {
                              wasUpdated = updateGroupKeys.includes(storedSheetKey);
                          } else if (modifiedKeys.length > 0) {
                              wasUpdated = modifiedKeys.includes(storedSheetKey);
                          } else {
                              wasUpdated = true;
                          }

                          if (wasUpdated) {
                              if (!independentTableStates_ACU[storedSheetKey]) independentTableStates_ACU[storedSheetKey] = {};
                              const currentAiFloor = chat.slice(0, i + 1).filter(m => !m.is_user).length;
                              independentTableStates_ACU[storedSheetKey].lastUpdatedAiFloor = currentAiFloor;
                          }
                      }
                  });
              }

              // 检查旧版标准表/总结表格式
              if (message.TavernDB_ACU_Data) {
                  const standardData = message.TavernDB_ACU_Data;
                  Object.keys(standardData).forEach(k => {
                      // [新增] 只处理当前模板/指导表中存在的表格
                      if (!templateSheetKeySet.has(k)) {
                          return;
                      }
                      if (k.startsWith('sheet_') && !foundSheets[k] && standardData[k].name && !isSummaryOrOutlineTable_ACU(standardData[k].name)) {
                          mergedData[k] = JSON.parse(JSON.stringify(standardData[k]));
                          foundSheets[k] = true;
                          if (!independentTableStates_ACU[k]) independentTableStates_ACU[k] = {};
                          const currentAiFloor = chat.slice(0, i + 1).filter(m => !m.is_user).length;
                          independentTableStates_ACU[k].lastUpdatedAiFloor = currentAiFloor;
                      }
                  });
              }
              if (message.TavernDB_ACU_SummaryData) {
                  const summaryData = message.TavernDB_ACU_SummaryData;
                  Object.keys(summaryData).forEach(k => {
                      // [新增] 只处理当前模板/指导表中存在的表格
                      if (!templateSheetKeySet.has(k)) {
                          return;
                      }
                      if (k.startsWith('sheet_') && !foundSheets[k] && summaryData[k].name && isSummaryOrOutlineTable_ACU(summaryData[k].name)) {
                          mergedData[k] = JSON.parse(JSON.stringify(summaryData[k]));
                          foundSheets[k] = true;
                          if (!independentTableStates_ACU[k]) independentTableStates_ACU[k] = {};
                          const currentAiFloor = chat.slice(0, i + 1).filter(m => !m.is_user).length;
                          independentTableStates_ACU[k].lastUpdatedAiFloor = currentAiFloor;
                      }
                  });
              }
          }
      }

      const foundCount = Object.keys(foundSheets).length;
      logDebug_ACU(`[Merge] Found ${foundCount} tables for tag [${currentIsolationKey || '无标签'}] from chat history.`);

      // 如果没有任何数据：
      // - 若存在"空白指导表"：优先返回“指导表物化结构”（表头+参数；seedRows 仅保留字段，不默认展开到 content）
      // - 否则返回 null，让调用方按旧逻辑处理（例如用完整模板结构作为占位符）
      if (foundCount <= 0) {
          if (hasSheetGuide) {
              // 直接物化：仅表头（seedRows 保留在字段中，但不作为“当前对话真实数据行”展示）
              const base = materializeDataFromSheetGuide_ACU(sheetGuideData, { includeSeedRows: false });
              const orderedKeys = getSortedSheetKeys_ACU(base);
              return reorderDataBySheetKeys_ACU(base, orderedKeys);
          }
          return null;
      }

      // [兼容迁移] 旧版：updateConfig 的 0 表示“沿用UI”；新版：-1 表示“沿用UI”
      // 注意：聊天记录里保存的是“单表对象”，没有 mate 标记，因此用 updateConfig.uiSentinel 作为表级标记。
      Object.keys(mergedData).forEach(k => {
          if (!k.startsWith('sheet_')) return;
          const sheet = mergedData[k];
          const uc = (sheet && typeof sheet === 'object') ? sheet.updateConfig : null;
          if (!uc || typeof uc !== 'object') return;
          if (uc.uiSentinel === -1) return; // 已是新语义
          for (const field of ['contextDepth', 'updateFrequency', 'batchSize', 'skipFloors']) {
              if (Object.prototype.hasOwnProperty.call(uc, field) && uc[field] === 0) {
                  uc[field] = -1;
              }
          }
          uc.uiSentinel = -1;
      });

      // [新增] 若存在"空白指导表"，则：
      // 1) 过滤掉不在指导表里的表（UI/填表只以指导表为准，避免旧表复活）
      // 2) 对指导表中缺失的表：使用指导表结构作为初始值（seedRows 仅保留字段，不默认展开到 content）
      // 3) 对于存在历史数据的表：以历史数据为主，但表名/表头/参数/顺序以指导表为准；不把 seedRows 合并进真实数据行
      if (hasSheetGuide) {
          const guided = materializeDataFromSheetGuide_ACU(sheetGuideData, { includeSeedRows: false });
          const guideKeys = getSortedSheetKeys_ACU(guided, { ignoreChatGuide: true, includeMissingFromGuide: true });
          guideKeys.forEach(k => {
              if (!k || !k.startsWith('sheet_')) return;
              const guideSheet = guided[k];
              const hist = mergedData[k];
              if (hist && typeof hist === 'object') {
                  const next = JSON.parse(JSON.stringify(hist));
                  next.uid = k;
                  // 需求4（视觉编辑器改名/改表头/改参数）：合并展示以指导表为准（不影响历史真实数据行，仅覆盖“元信息/表头/参数/顺序”）
                  if (guideSheet?.name) next.name = guideSheet.name;
                  if (guideSheet?.sourceData) next.sourceData = JSON.parse(JSON.stringify(guideSheet.sourceData));
                  if (guideSheet?.updateConfig) next.updateConfig = JSON.parse(JSON.stringify(guideSheet.updateConfig));
                  if (guideSheet?.exportConfig) next.exportConfig = JSON.parse(JSON.stringify(guideSheet.exportConfig));
                  // 表头：以指导表为准，并对行做简单对齐（pad/truncate）
                  const guideHeader = (guideSheet && Array.isArray(guideSheet.content) && Array.isArray(guideSheet.content[0]))
                      ? JSON.parse(JSON.stringify(guideSheet.content[0]))
                      : null;
                  if (!Array.isArray(next.content)) next.content = guideHeader ? [guideHeader] : [[null]];
                  if (guideHeader) {
                      next.content[0] = guideHeader;
                      const targetLen = guideHeader.length;
                      for (let r = 1; r < next.content.length; r++) {
                          const row = next.content[r];
                          if (!Array.isArray(row)) continue;
                          // [修复] 在对齐行长度之前，保留 auto_merged 标签
                          const hasAutoMergedTag = row.length > 0 && row[row.length - 1] === 'auto_merged';
                          if (row.length < targetLen) {
                              while (row.length < targetLen) row.push('');
                              // 如果原本有 auto_merged 标签，在填充后重新添加
                              if (hasAutoMergedTag && row[row.length - 1] !== 'auto_merged') {
                                  row.push('auto_merged');
                              }
                          } else if (row.length > targetLen) {
                              // [修复] 截断时保留 auto_merged 标签
                              row.splice(targetLen);
                              if (hasAutoMergedTag) {
                                  row.push('auto_merged');
                              }
                          }
                      }
                  }
                  // 顺序编号以指导表为准
                  if (Number.isFinite(guideSheet?.[TABLE_ORDER_FIELD_ACU])) next[TABLE_ORDER_FIELD_ACU] = Math.trunc(guideSheet[TABLE_ORDER_FIELD_ACU]);
                  // 保留 seedRows 字段（不参与实际 content 合并）
                  if (Array.isArray(guideSheet?.seedRows)) next.seedRows = JSON.parse(JSON.stringify(guideSheet.seedRows));
                  guided[k] = next;
              } else {
                  // 无历史数据：直接使用指导表物化结果（不展开 seedRows）
                  if (Number.isFinite(guideSheet?.[TABLE_ORDER_FIELD_ACU])) guided[k][TABLE_ORDER_FIELD_ACU] = Math.trunc(guideSheet[TABLE_ORDER_FIELD_ACU]);
              }
          });
          mergedData = guided;
      }

      // [修复] 合并结果按“用户手动顺序/模板顺序”重排，避免合并过程导致的随机乱序
      const orderedKeys = getSortedSheetKeys_ACU(mergedData);
      mergedData = reorderDataBySheetKeys_ACU(mergedData, orderedKeys);
      return mergedData;
  }

  // [重构] 刷新合并数据并通知前端和更新世界书
  async function refreshMergedDataAndNotify_ACU() {
      // 重新加载聊天记录
    await loadAllChatMessages_ACU();
      
    // 合并数据 (使用新的独立表合并逻辑)
    let mergedData = await mergeAllIndependentTables_ACU();

    // 当回溯找不到任何表格数据时（mergedData 为 null），
    // 优先用“已保存指导表的物化结构（不展开 seedRows）”作为基底；
    // 若不存在指导表，才使用“模板结构（不展开预置数据）”。
    if (!mergedData) {
        const currentIsolationKey = getCurrentIsolationKey_ACU();
        const guide = getChatSheetGuideDataForIsolationKey_ACU(currentIsolationKey);
        if (guide && typeof guide === 'object' && Object.keys(guide).some(k => k.startsWith('sheet_'))) {
            logDebug_ACU('[回溯空数据] 无历史表格数据：使用已保存指导表物化结构（不展开 seedRows）作为基底。');
            mergedData = materializeDataFromSheetGuide_ACU(guide, { includeSeedRows: false });
            currentJsonTableData_ACU = mergedData;
        } else {
            logDebug_ACU('[回溯空数据] 无历史表格数据且无指导表：使用模板结构（不展开预置数据）。');
            const templateData = parseTableTemplateJson_ACU({ stripSeedRows: true }); // 仅结构，不携带模板预置数据行
            if (templateData) {
                mergedData = templateData;
                currentJsonTableData_ACU = templateData;
            } else {
                // 极端兜底：模板也解析失败，设为空对象
                currentJsonTableData_ACU = { mate: { type: 'chatSheets', version: 1 } };
                logWarn_ACU('[回溯空数据] 模板解析失败，currentJsonTableData_ACU 设为最小空结构。');
            }
        }
        // 刷新 UI 选择器
        if ($manualTableSelector_ACU) {
            renderManualTableSelector_ACU();
        }
        if ($importTableSelector_ACU) {
            renderImportTableSelector_ACU();
        }
    } else {
        // 更新内存中的数据
        // [新增] 数据完整性检查：在加载数据时为AM编码的条目自动添加auto_merged标记
        let integrityFixed = false;
        Object.keys(mergedData).forEach(sheetKey => {
            if (mergedData[sheetKey] && mergedData[sheetKey].content && Array.isArray(mergedData[sheetKey].content)) {
                const table = mergedData[sheetKey];
                table.content.slice(1).forEach((row, idx) => {
                    if (row && row.length > 1 && row[1] && row[1].startsWith('AM') && row[row.length - 1] !== 'auto_merged') {
                        // 发现AM开头的条目缺少auto_merged标记，自动修复
                        row.push('auto_merged');
                        integrityFixed = true;
                        logDebug_ACU(`[数据修复] 为表格${sheetKey}的第${idx + 1}条AM开头的条目添加auto_merged标记`);
                    }
                });
            }
        });

        if (integrityFixed) {
            logDebug_ACU('数据完整性已自动修复，添加了缺失的auto_merged标记');
        }

        // [修复] 强制稳定顺序（用户手动顺序优先，否则模板顺序）
        const stableKeys = getSortedSheetKeys_ACU(mergedData);
        currentJsonTableData_ACU = reorderDataBySheetKeys_ACU(mergedData, stableKeys);
        logDebug_ACU('Updated currentJsonTableData_ACU with independently merged data.');
        if ($manualTableSelector_ACU) {
            renderManualTableSelector_ACU();
        }
        if ($importTableSelector_ACU) {
            renderImportTableSelector_ACU();
        }
    }
          
    // 更新世界书（此时 currentJsonTableData_ACU 已是最新状态，空数据也会被正确处理）
    await updateReadableLorebookEntry_ACU(true);
    logDebug_ACU('Updated worldbook entries with merged data.');
          
    // 通知前端进行UI刷新，并等待前端完成数据读取
    return new Promise((resolve) => {
        // 1. 通知前端 (iframe context)
        if (topLevelWindow_ACU.AutoCardUpdaterAPI) {
            topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
            logDebug_ACU('Notified frontend to refresh UI after data merge.');
        }
        
        // 2. [修复] 独立检查并刷新可视化编辑器
        // 使用新定义的全局刷新函数，确保逻辑一致性
        setTimeout(() => {
             if (typeof window.ACU_Visualizer_Refresh === 'function') {
                 window.ACU_Visualizer_Refresh();
                 logDebug_ACU('Triggered global visualizer refresh.');
             } else if (jQuery_API_ACU('#acu-visualizer-content').length || ACU_WindowManager.isOpen(`${SCRIPT_ID_PREFIX_ACU}-visualizer-window`)) {
                 // Fallback
                 jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data');
             }
        }, 200); // 稍微增加延迟

        // 3. 刷新当前打开的插件设置弹窗 (UI context)
        if ($popupInstance_ACU && $popupInstance_ACU.is(':visible')) {
             // 刷新状态显示 (消息计数)
             if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
                 updateCardUpdateStatusDisplay_ACU();
             }
        }
              
        // [修复] 等待足够的时间，确保前端完成数据读取和UI刷新
        // 使用较长的延迟，确保前端有足够时间处理数据
        setTimeout(() => {
            logDebug_ACU('UI refresh wait period completed. Frontend should have finished reading data.');
            resolve();
        }, 800); // 增加到 800ms，确保前端有足够时间读取数据
    });
  }

  function formatJsonToReadable_ACU(jsonData) {
    if (!jsonData) return { readableText: "数据库为空。", importantPersonsTable: null, summaryTable: null, outlineTable: null };

    let readableText = '';
    let importantPersonsTable = null;
    let summaryTable = null;
    let outlineTable = null;
    // No longer need globalDataTable here as it's part of the main text.

    const tableIndexes = getSortedSheetKeys_ACU(jsonData);
    
    tableIndexes.forEach((sheetKey, tableIndex) => {
        const table = jsonData[sheetKey];
        if (!table || !table.name || !table.content) return;

        // Extract special tables
        switch (table.name.trim()) {
            case '重要人物表':
                importantPersonsTable = table;
                return; // Skip from main output
            case '总结表':
                summaryTable = table;
                return; // Skip from main output
            case '总体大纲':
                outlineTable = table;
                return; // Skip from main output
        }

        // [新增] 检查是否启用了单独注入（Custom Export），如果启用了，则不包含在基础条目中
        // [新增] 检查是否允许注入世界书 (injectIntoWorldbook)，如果为 false，则不包含在基础条目中
        if (table.exportConfig) {
            if (table.exportConfig.enabled) return; // Skip from main output because it will be exported separately
            if (table.exportConfig.injectIntoWorldbook === false) return; // Skip if injection is disabled
        }
        
        // All other tables, including '全局数据表', are added to the readable text
        readableText += `# ${table.name}\n\n`;
        const headers = table.content[0] ? table.content[0].slice(1) : [];
        if (headers.length > 0) {
            readableText += `| ${headers.join(' | ')} |\n`;
            readableText += `|${headers.map(() => '---').join('|')}|\n`;
        }
        
        const rows = table.content.slice(1);
        if (rows.length > 0) {
            rows.forEach(row => {
                const rowData = row.slice(1);
                readableText += `| ${rowData.join(' | ')} |\n`;
            });
        }
        readableText += '\n';
    });
    
    return { readableText, importantPersonsTable, summaryTable, outlineTable };
  }

  // =========================
  // [新功能] 新建对话：将模板基础状态写入“楼层本地数据”（而非拼接到消息文本）
  // 目标：像填表一样，开场白楼层就拥有一份“当前模板”的数据库基底（模板有数据就带数据，没有就为空表）
  // 注意：此动作不触发世界书注入链路，只做本地数据写入 + 前端显示刷新
  // =========================
  const GREETING_LOCAL_BASE_STATE_MARKER_ACU = 'ACU_TEMPLATE_BASE_STATE_LOCAL_V1';

  function isNewChatGreetingStage_ACU(chat) {
      if (!Array.isArray(chat) || chat.length === 0) return false;
      const hasAnyUserMessage = chat.some(m => m && m.is_user);
      if (hasAnyUserMessage) return false;
      const firstAiIndex = chat.findIndex(m => m && !m.is_user);
      return firstAiIndex !== -1;
  }

  // [健全性] 你要求的监视点：任何“仅单一AI楼层、没有任何User回复”的聊天记录，都不进行世界书注入
  function isSingleAiNoUserChat_ACU(chat) {
      if (!Array.isArray(chat) || chat.length === 0) return false;
      const userCount = chat.filter(m => m && m.is_user).length;
      const aiCount = chat.filter(m => m && !m.is_user).length;
      return userCount === 0 && aiCount === 1;
  }

  function shouldSuppressWorldbookInjection_ACU() {
      // 用户要求：取消“首楼填表后不注入书”的限制。
      // 是否创建条目，改由各条目更新逻辑自身基于“真实有效数据”判定，避免一刀切拦截整个链路。
      return false;
  }

  function maybeLiftWorldbookSuppression_ACU() {
      if (!suppressWorldbookInjectionInGreeting_ACU) return;
      const chat = SillyTavern_API_ACU?.chat;
      if (!Array.isArray(chat)) return;
      const hasAnyUserMessage = chat.some(m => m && m.is_user);
      if (hasAnyUserMessage) {
          suppressWorldbookInjectionInGreeting_ACU = false;
          logDebug_ACU('[Worldbook] Greeting-stage suppression lifted (user message detected).');
      }
  }

  function buildTemplateBaseStateDataForLocalStorage_ACU(templateObj) {
      if (!templateObj || typeof templateObj !== 'object') return null;
      const out = { mate: { type: 'chatSheets', version: 1 } };
      const sheetKeys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
      if (sheetKeys.length === 0) return null;
      sheetKeys.forEach(k => {
          out[k] = JSON.parse(JSON.stringify(templateObj[k]));
      });
      return out;
  }

  async function seedGreetingLocalDataFromTemplate_ACU() {
      try {
          const chat = SillyTavern_API_ACU?.chat;
          if (!isNewChatGreetingStage_ACU(chat)) return false;

          const firstAiIndex = chat.findIndex(m => m && !m.is_user);
          const greetingMsg = chat[firstAiIndex];
          if (!greetingMsg) return false;

          // 幂等：避免重复写入
          if (greetingMsg._acu_local_template_base_state_seeded === GREETING_LOCAL_BASE_STATE_MARKER_ACU) return false;

          const templateObj = parseTableTemplateJson_ACU({ stripSeedRows: false }); // 模板有数据就带数据
          if (!templateObj) return false;

          // 确保模板编号稳定（不改变内容，只补齐 orderNo）
          const sheetKeys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
          ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: sheetKeys, forceRebuild: false });

          const baseData = buildTemplateBaseStateDataForLocalStorage_ACU(templateObj);
          if (!baseData) return false;

          const isolationKey = getCurrentIsolationKey_ACU();
          if (!greetingMsg.TavernDB_ACU_IsolatedData) greetingMsg.TavernDB_ACU_IsolatedData = {};
          if (!greetingMsg.TavernDB_ACU_IsolatedData[isolationKey]) {
              greetingMsg.TavernDB_ACU_IsolatedData[isolationKey] = {
                  independentData: {},
                  modifiedKeys: [],
                  updateGroupKeys: []
              };
          }
          const tagData = greetingMsg.TavernDB_ACU_IsolatedData[isolationKey];

          // 写入 independentData（只写 sheet_，不强制 modifiedKeys）
          const indep = {};
          Object.keys(baseData).forEach(k => {
              if (!k.startsWith('sheet_')) return;
              indep[k] = JSON.parse(JSON.stringify(baseData[k]));
          });
          tagData.independentData = indep;
          // 这是一份“基底”，不应被认为是AI更新结果，因此 modifiedKeys 留空
          tagData.modifiedKeys = [];
          tagData.updateGroupKeys = [];
          tagData._acu_base_state = GREETING_LOCAL_BASE_STATE_MARKER_ACU;

          // 同步旧格式（兼容老逻辑）
          greetingMsg.TavernDB_ACU_IndependentData = JSON.parse(JSON.stringify(indep));
          greetingMsg.TavernDB_ACU_ModifiedKeys = [];
          greetingMsg.TavernDB_ACU_UpdateGroupKeys = [];

          // 标记幂等
          greetingMsg._acu_local_template_base_state_seeded = GREETING_LOCAL_BASE_STATE_MARKER_ACU;

          // 不在这里做全局注入抑制；
          // 是否真正创建世界书条目，交给后续各条目逻辑按“是否存在真实有效数据”决定。
          suppressWorldbookInjectionInGreeting_ACU = false;

          await SillyTavern_API_ACU.saveChat();

          // [关键] 新开对话时应清理旧的世界书条目，但仍不能创建新条目。
          // 这里主动清理一次，确保“开场白阶段不注入，但旧条目会被清掉”。
          try {
              await deleteAllGeneratedEntries_ACU();
              logDebug_ACU('[Worldbook] Deleted generated entries on new chat greeting seed (cleanup-only).');
          } catch (e) {
              logWarn_ACU('[Worldbook] Cleanup on greeting seed failed:', e);
          }

          // 仅触发前端显示刷新（更新该楼层的UI）
          if (SillyTavern_API_ACU?.eventSource?.emit && SillyTavern_API_ACU?.eventTypes?.MESSAGE_UPDATED) {
              SillyTavern_API_ACU.eventSource.emit(SillyTavern_API_ACU.eventTypes.MESSAGE_UPDATED, firstAiIndex);
          }
          // 额外通知前端表格刷新（可视化/面板读取本地数据）
          if (topLevelWindow_ACU.AutoCardUpdaterAPI) {
              topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
          }

          // 更新内存（但不触发世界书注入）
          currentJsonTableData_ACU = reorderDataBySheetKeys_ACU(JSON.parse(JSON.stringify(baseData)), getSortedSheetKeys_ACU(baseData));
          return true;
      } catch (e) {
          logWarn_ACU('[GreetingLocalBaseState] Failed to seed greeting local data from template:', e);
          return false;
      }
  }

  // [新增] 直接将模板数据填充到第一楼的实际表格数据
  // 用于 initGameSession 场景，确保模板中的所有表格数据（包括种子数据）都被写入第一楼
  async function fillFirstLayerWithTemplateData_ACU(templateObj, { reason = 'game_init', presetName = '', source = 'game_init', registerPreset = true } = {}) {
      try {
          const chat = SillyTavern_API_ACU?.chat;
          if (!chat || !Array.isArray(chat) || chat.length === 0) {
              logWarn_ACU('[FillFirstLayer] 聊天记录为空，无法填充数据');
              return false;
          }

          // 找到第一条AI消息（第一楼）
          const firstAiIndex = chat.findIndex(m => m && !m.is_user);
          if (firstAiIndex === -1) {
              logWarn_ACU('[FillFirstLayer] 找不到第一楼AI消息');
              return false;
          }
          const firstMsg = chat[firstAiIndex];

          // 确保模板编号稳定
          const sheetKeys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
          if (sheetKeys.length === 0) {
              logWarn_ACU('[FillFirstLayer] 模板中没有表格数据');
              return false;
          }
          ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: sheetKeys, forceRebuild: false });

          const templateSnapshot = sanitizeTemplateSnapshotForChat_ACU(templateObj);
          const normalizedPresetName = deriveTemplatePresetNameForImport_ACU({ presetName });
          if (registerPreset && normalizedPresetName && templateSnapshot?.templateStr) {
              try {
                  const savePresetOk = upsertTemplatePreset_ACU(normalizedPresetName, templateSnapshot.templateStr);
                  if (!savePresetOk) {
                      logWarn_ACU(`[TemplateScope] 保存模板预设失败：${normalizedPresetName}`);
                  }
              } catch (e) {
                  logWarn_ACU('[TemplateScope] 保存模板预设失败:', e);
              }
          }

          // 构建完整的表格数据（包含所有种子数据）
          const fullData = { mate: { type: 'chatSheets', version: 1 } };
          sheetKeys.forEach(k => {
              fullData[k] = JSON.parse(JSON.stringify(templateObj[k]));
          });

          const isolationKey = getCurrentIsolationKey_ACU();

          // 写入 TavernDB_ACU_IsolatedData（新版格式）
          if (!firstMsg.TavernDB_ACU_IsolatedData) firstMsg.TavernDB_ACU_IsolatedData = {};
          if (!firstMsg.TavernDB_ACU_IsolatedData[isolationKey]) {
              firstMsg.TavernDB_ACU_IsolatedData[isolationKey] = {
                  independentData: {},
                  modifiedKeys: [],
                  updateGroupKeys: []
              };
          }
          const tagData = firstMsg.TavernDB_ACU_IsolatedData[isolationKey];

          // 写入 independentData（包含所有表格的完整数据）
          const indep = {};
          sheetKeys.forEach(k => {
              indep[k] = JSON.parse(JSON.stringify(fullData[k]));
          });
          tagData.independentData = indep;
          tagData.modifiedKeys = [];
          tagData.updateGroupKeys = [];

          // 同步旧格式（兼容老逻辑）
          firstMsg.TavernDB_ACU_IndependentData = JSON.parse(JSON.stringify(indep));
          firstMsg.TavernDB_ACU_ModifiedKeys = [];
          firstMsg.TavernDB_ACU_UpdateGroupKeys = [];

          // 同时更新指导表与聊天级模板快照（确保表头、参数、预设名同步）
          const guideData = buildChatSheetGuideDataFromTemplateObj_ACU(templateObj, { stripSeedRows: false });
          if (guideData) {
              setChatSheetGuideDataForIsolationKey_ACU(isolationKey, guideData, {
                  reason,
                  syncTemplateScope: true,
                  templateSource: templateSnapshot?.templateStr || templateObj,
                  presetName: normalizedPresetName,
                  source,
              });
              applyTemplateScopeForCurrentChat_ACU();
          }

          // 保存聊天
          await SillyTavern_API_ACU.saveChat();

          // 更新内存数据
          currentJsonTableData_ACU = reorderDataBySheetKeys_ACU(JSON.parse(JSON.stringify(fullData)), getSortedSheetKeys_ACU(fullData));

          // 通知前端刷新
          if (SillyTavern_API_ACU?.eventSource?.emit && SillyTavern_API_ACU?.eventTypes?.MESSAGE_UPDATED) {
              SillyTavern_API_ACU.eventSource.emit(SillyTavern_API_ACU.eventTypes.MESSAGE_UPDATED, firstAiIndex);
          }
          if (topLevelWindow_ACU.AutoCardUpdaterAPI) {
              topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
          }

          logDebug_ACU(`[FillFirstLayer] 成功将模板数据填充到第一楼，共 ${sheetKeys.length} 个表格`);
          return true;
      } catch (e) {
          logError_ACU('[FillFirstLayer] 填充第一楼数据失败:', e);
          return false;
      }
  }

  function parseReadableToJson_ACU(text) {
    if (!currentJsonTableData_ACU) {
        logError_ACU("Parsing failed: currentJsonTableData_ACU is not available.");
        return null;
    }

    try {
        // Create a deep clone to safely modify, preserving original metadata.
        const newJsonData = JSON.parse(JSON.stringify(currentJsonTableData_ACU)); 
        const tablesText = text.trim().split('# ').slice(1);

        const parsedSheetContents = {};

        for (const tableText of tablesText) {
            const lines = tableText.trim().split('\n');
            const tableName = lines[0].trim();
            
            const sheetKey = getSortedSheetKeys_ACU(newJsonData).find(k => newJsonData[k].name === tableName);
            if (!sheetKey) {
                logWarn_ACU(`Table "${tableName}" from text not found in current JSON structure. Skipping.`);
                continue;
            }

            const originalSheet = newJsonData[sheetKey];
            const originalHeaderRow = originalSheet.content[0];
            const newContent = [originalHeaderRow]; // Start with the original header row.

            // Find all valid markdown table row lines, skipping the format line.
            const dataLines = lines.filter(line => line.trim().startsWith('|') && !line.includes('---'));

            // The first markdown row is the header text, which we ignore since we use the original header.
            for (let i = 1; i < dataLines.length; i++) {
                const line = dataLines[i];
                // Split by '|', remove the first and last empty elements, and trim whitespace.
                const columns = line.split('|').slice(1, -1).map(c => c.trim());
                
                // Start row with null placeholder
                const newRow = [null, ...columns];
                
                // Pad or truncate the row to match the header's column count for consistency.
                if (newRow.length < originalHeaderRow.length) {
                     while(newRow.length < originalHeaderRow.length) newRow.push('');
                } else if (newRow.length > originalHeaderRow.length) {
                    newRow.splice(originalHeaderRow.length);
                }
                newContent.push(newRow);
            }
            parsedSheetContents[sheetKey] = newContent;
        }

        // Update the cloned JSON object only with sheets that were successfully parsed.
        for (const sheetKey in parsedSheetContents) {
            newJsonData[sheetKey].content = parsedSheetContents[sheetKey];
        }

        return newJsonData;

    } catch (error) {
        logError_ACU("Error parsing readable text back to JSON:", error);
        return null;
    }
  }

  function getEffectiveAutoUpdateThreshold_ACU(calledFrom = 'system') {
    let threshold = Number(settings_ACU.autoUpdateThreshold); // Start with the in-memory setting, ensure number
    if (isNaN(threshold)) threshold = 3; // Default fallback

    // 移除：不再从 UI 输入框实时获取值
    // 原因：UI 可能处于隐藏状态或者未初始化完成，导致获取到的值为空或过时
    // 我们应完全信任 settings_ACU 中的值，因为 UI 修改后会同步到 settings_ACU
    /*
    if (
      $autoUpdateThresholdInput_ACU &&
      $autoUpdateThresholdInput_ACU.length > 0 &&
      $autoUpdateThresholdInput_ACU.is(':visible')
    ) {
      const uiThresholdVal = $autoUpdateThresholdInput_ACU.val();
      if (uiThresholdVal) {
        const parsedUiInput = parseInt(uiThresholdVal, 10);
        if (!isNaN(parsedUiInput) && parsedUiInput >= 1) {
          threshold = parsedUiInput;
        } 
        // ...
      }
    }
    */
    
    // logDebug_ACU(`getEffectiveAutoUpdateThreshold_ACU (calledFrom: ${calledFrom}): final threshold = ${threshold}`);
    return threshold;
  }

  function saveSettings_ACU() {
    try {
        const store = getConfigStorage_ACU();
        const code = normalizeIsolationCode_ACU(settings_ACU?.dataIsolationCode || globalMeta_ACU?.activeIsolationCode || '');
        // 同步 globalMeta 的当前标识（避免刷新后回到旧标识）
        if (globalMeta_ACU && typeof globalMeta_ACU === 'object') {
            globalMeta_ACU.activeIsolationCode = code;
            if (code) addDataIsolationHistory_ACU(code, { save: false });
            normalizeDataIsolationHistory_ACU(globalMeta_ACU.isolationCodeList);
            saveGlobalMeta_ACU();
        }
        const payloadObj = sanitizeSettingsForProfileSave_ACU(settings_ACU);
        payloadObj.dataIsolationCode = code;
        const payload = JSON.stringify(payloadObj);
        // [Profile] 按标识码保存“整套设置”
        store.setItem(getProfileSettingsKey_ACU(code), payload);
        if (store && store._isTavern) {
            logDebug_ACU(`[Profile] Settings saved for code: ${code || '(default)'}`);
        } else {
            if (isIndexedDbAvailable_ACU()) {
                console.warn(`[${SCRIPT_ID_PREFIX_ACU}] 未连接到酒馆服务端设置：已保存到 IndexedDB（仅本浏览器可用，跨浏览器不同步）。请检查顶层 bridge 是否注入成功。`);
                try { showToastr_ACU('info', '当前未连接酒馆设置：已保存到 IndexedDB（仅本浏览器可用）。', { timeOut: 6000 }); } catch (e) {}
            } else {
                console.warn(`[${SCRIPT_ID_PREFIX_ACU}] 未连接到可持久化的 extension_settings，且 IndexedDB 不可用：本次保存仅在内存中生效，刷新会丢失。`);
                try { showToastr_ACU('warning', '⚠️ 当前未连接酒馆设置且 IndexedDB 不可用，本次修改刷新后会丢失。', { timeOut: 8000 }); } catch (e) {}
            }
            // 异步再尝试一次初始化（不阻塞 UI）
            void initTavernSettingsBridge_ACU();
        }
    } catch (error) {
        logError_ACU('Failed to save settings:', error);
        showToastr_ACU('error', '保存设置时发生浏览器存储错误。');
    }
  }

  // --- [剧情推进] 核心函数 ---

  /**
   * 剧情推进统一的API调用函数
   */
  async function callApi_ACU(messages, apiSettings, abortSignal = null) {
    // [新增] 获取剧情推进使用的API配置（支持API预设）
    const apiPresetConfig = getApiConfigByPreset_ACU(settings_ACU.plotApiPreset);
    const effectiveApiMode = apiPresetConfig.apiMode;
    const effectiveApiConfig = apiPresetConfig.apiConfig;
    
    logDebug_ACU(`[剧情推进] 使用API预设: ${settings_ACU.plotApiPreset || '当前配置'}, 模式: ${effectiveApiMode}`);

    if (effectiveApiMode === 'tavern' || effectiveApiConfig.useMainApi) {
      // 使用主API或酒馆预设（流式传输）
      logDebug_ACU('[剧情推进] 通过酒馆主API发送请求（流式传输）...');
      if (typeof TavernHelper_API_ACU.generateRaw !== 'function') {
        throw new Error('TavernHelper.generateRaw 函数不存在。请检查酒馆版本。');
      }
      const response = await TavernHelper_API_ACU.generateRaw({
        ordered_prompts: messages,
        should_stream: settings_ACU.streamingEnabled || false,
      });
      if (typeof response !== 'string') {
        throw new Error('主API调用未返回预期的文本响应。');
      }
      return response.trim();
    } else {
      // 使用自定义API（流式传输）
      if (!effectiveApiConfig.url || !effectiveApiConfig.model) {
        throw new Error('自定义API的URL或模型未配置。');
      }

      const requestBody = {
        messages: messages,
        model: effectiveApiConfig.model.replace(/^models\//, ''),
        max_tokens: effectiveApiConfig.maxTokens || effectiveApiConfig.max_tokens || 20000,
        temperature: effectiveApiConfig.temperature || 0.7,
        top_p: effectiveApiConfig.topP || effectiveApiConfig.top_p || 0.95,
        stream: settings_ACU.streamingEnabled || false,
        chat_completion_source: 'custom',
        group_names: [],
        include_reasoning: false,
        reasoning_effort: 'medium',
        enable_web_search: false,
        request_images: false,
        custom_prompt_post_processing: 'strict',
        reverse_proxy: effectiveApiConfig.url,
        proxy_password: '',
        custom_url: effectiveApiConfig.url,
        custom_include_headers: effectiveApiConfig.apiKey ? `Authorization: Bearer ${effectiveApiConfig.apiKey}` : '',
      };

      const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      });

      if (!response.ok) {
        const errTxt = await response.text();
        throw new Error(`API请求失败: ${response.status} ${errTxt}`);
      }

      // 根据streamingEnabled设置选择响应处理方式
      const content = await handleApiResponse_ACU(response, abortSignal);
      if (content) {
        return content.trim();
      }

      throw new Error(`API调用返回无效响应`);
    }
  }

  /**
   * 将表格JSON数据转换为更适合LLM读取的文本格式。
   * @param {object} jsonData - 表格数据对象（例如本插件的 currentJsonTableData_ACU）。
   * @returns {string} - 格式化后的文本字符串。
   */
  function formatTableDataForLLM_ACU(jsonData) {
    if (!jsonData || typeof jsonData !== 'object' || Object.keys(jsonData).length === 0) {
      return '当前无任何可用的表格数据。';
    }

    let output = '以下是当前角色聊天记录中，由st-memory-enhancement插件保存的全部表格数据：\n';

    for (const sheetId in jsonData) {
      if (Object.prototype.hasOwnProperty.call(jsonData, sheetId)) {
        const sheet = jsonData[sheetId];
        // 确保表格有名称，且内容至少包含表头和一行数据
        if (sheet && sheet.name && sheet.content && sheet.content.length > 1) {
          output += `\n## 表格: ${sheet.name}\n`;
          const headers = sheet.content[0].slice(1); // 第一行是表头，第一个元素通常为空
          const rows = sheet.content.slice(1);

          rows.forEach((row, rowIndex) => {
            const rowData = row.slice(1);
            let rowOutput = '';
            let hasContent = false;
            headers.forEach((header, index) => {
              const cellValue = rowData[index];
              if (cellValue !== null && cellValue !== undefined && String(cellValue).trim() !== '') {
                rowOutput += `  - ${header}: ${cellValue}\n`;
                hasContent = true;
              }
            });

            if (hasContent) {
              output += `\n### ${sheet.name} - 第 ${rowIndex + 1} 条记录\n${rowOutput}`;
            }
          });
        }
      }
    }
    output += '\n--- 表格数据结束 ---\n';
    return output;
  }

  // [新增] 从世界书获取"纪要索引"条目内容（用于$5优先替换）
  async function getSummaryIndexContentForPlot_ACU(plotSettings) {
    try {
      const plotCfg = plotSettings?.plotWorldbookConfig;
      const worldbookSource = plotCfg?.source || 'character';
      let bookNames = [];
      
      if (worldbookSource === 'manual' && plotCfg?.manualSelection?.length) {
        bookNames = plotCfg.manualSelection;
      } else {
        try {
          const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
          if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
          if (charLorebooks.secondary) bookNames.push(charLorebooks.secondary);
        } catch (e) {
          return null;
        }
      }
      
      const isoPrefix = getIsolationPrefix_ACU();
      const targetComment = isoPrefix + 'TavernDB-ACU-CustomExport-纪要索引';
      
      for (const bookName of bookNames) {
        try {
          const entries = await TavernHelper_API_ACU.getLorebookEntries(bookName);
          // [修复] 移除&& e.enabled检查，让$5占位符在0TK模式下仍能读取被禁用的纪要索引条目内容
          // 该函数仅被用于$5占位符，不影响其他逻辑的enabled状态检查
          const indexEntry = entries?.find(e => e.comment === targetComment);
          if (indexEntry?.content) {
            logDebug_ACU('[剧情推进] $5 从世界书纪要索引条目获取成功' + (indexEntry.enabled ? '' : '(条目已禁用)'));
            return indexEntry.content;
          }
        } catch (e) {
          continue;
        }
      }
      return null;
    } catch (error) {
      logError_ACU('[剧情推进] 获取纪要索引条目失败:', error);
      return null;
    }
  }

  // [剧情推进专用] $5 只注入"总体大纲"表（含表头）。不影响填表侧任何逻辑。
  function formatOutlineTableForPlot_ACU(allTablesJson) {
    try {
      if (!allTablesJson || typeof allTablesJson !== 'object') {
        return '总体大纲表：未获取到表格数据。';
      }
      const sheets = Object.values(allTablesJson).filter(x => x && typeof x === 'object' && x.name && x.content);
      const outline = sheets.find(s => String(s.name || '').trim() === '总体大纲');
      if (!outline || !Array.isArray(outline.content) || outline.content.length === 0) {
        return '总体大纲表：未找到该表或表结构为空。';
      }

      const headerRow = Array.isArray(outline.content[0]) ? outline.content[0] : [];
      const headers = headerRow.slice(1).map(h => String(h ?? '').trim()).filter(Boolean);
      let out = `## 表格: 总体大纲\n`;
      out += headers.length ? `Columns: ${headers.join(', ')}\n` : 'Columns: (无表头)\n';

      const rows = outline.content.slice(1).filter(r => Array.isArray(r));
      if (rows.length === 0) {
        out += '(无数据行)\n';
        return out;
      }

      rows.forEach((row, idx) => {
        const cells = row.slice(1);
        // 只输出非空单元格，避免噪声；但保留行号便于引用
        const parts = [];
        for (let i = 0; i < headers.length; i++) {
          const v = cells[i];
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            parts.push(`${headers[i]}: ${String(v)}`);
          }
        }
        out += parts.length ? `- [${idx}] ${parts.join(' | ')}\n` : `- [${idx}] (空行)\n`;
      });
      return out;
    } catch (e) {
      return '总体大纲表：格式化时发生错误。';
    }
  }

  // [剧情推进专用] $5 从纪要表本地数据读取概要和编码索引两列（不再从世界书纪要索引条目读取）
  // 只读取纪要表的"概览/概要"列和"编码索引"列，不读取其他内容（时间跨度、地点、纪要等）
  // 返回格式：{ success: boolean, content: string }，方便调用方判断是否成功
  function formatSummaryIndexForPlot_ACU(allTablesJson) {
    try {
      if (!allTablesJson || typeof allTablesJson !== 'object') {
        logDebug_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 未获取到表格数据');
        return { success: false, content: '纪要索引：未获取到表格数据。' };
      }
      const sheets = Object.values(allTablesJson).filter(x => x && typeof x === 'object' && x.name && x.content);
      // 查找纪要表（兼容旧数据"总结表"）
      const summaryTable = sheets.find(s => {
        const name = String(s.name || '').trim();
        return name === '纪要表' || name === '总结表';
      });
      
      if (!summaryTable) {
        logDebug_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 未找到纪要表，可用表格:', sheets.map(s => s.name));
        return { success: false, content: '纪要索引：未找到纪要表。' };
      }
      
      if (!Array.isArray(summaryTable.content) || summaryTable.content.length <= 1) {
        logDebug_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 纪要表为空，content长度:', summaryTable.content?.length);
        return { success: false, content: '纪要索引：纪要表为空。' };
      }

      const headerRow = Array.isArray(summaryTable.content[0]) ? summaryTable.content[0] : [];
      logDebug_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 纪要表表头:', JSON.stringify(headerRow));
      
      // 找到概要列和编码索引列的索引（兼容"概览"和"概要"两种列名）
      const summaryColIdx = headerRow.findIndex(h => {
        const name = String(h ?? '').trim();
        return name === '概览' || name === '概要';
      });
      const indexColIdx = headerRow.findIndex(h => String(h ?? '').trim() === '编码索引');
      
      if (summaryColIdx === -1 || indexColIdx === -1) {
        logWarn_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 未找到概要列或编码索引列，概要列索引=', summaryColIdx, ', 编码索引列索引=', indexColIdx);
        return { success: false, content: '纪要索引：未找到概要列或编码索引列。' };
      }

      let out = `## 表格: 纪要索引\n`;
      out += `Columns: 概要, 编码索引\n`;

      const rows = summaryTable.content.slice(1).filter(r => Array.isArray(r));
      if (rows.length === 0) {
        out += '(无数据行)\n';
        return { success: true, content: out };
      }

      rows.forEach((row, idx) => {
        const summary = row[summaryColIdx] ? String(row[summaryColIdx]).trim() : '';
        const indexCode = row[indexColIdx] ? String(row[indexColIdx]).trim() : '';
        if (summary || indexCode) {
          out += `- [${idx}] 概要: ${summary} | 编码索引: ${indexCode}\n`;
        }
      });
      logDebug_ACU('[剧情推进] formatSummaryIndexForPlot_ACU: 成功生成纪要索引，行数=', rows.length);
      return { success: true, content: out };
    } catch (e) {
      logError_ACU('[剧情推进] 格式化纪要索引时出错:', e);
      return { success: false, content: '纪要索引：格式化时发生错误。' };
    }
  }

  // =========================
  // [剧情推进] 随机数生成功能
  // 语法：<random min="1" max="100" />
  // 在提示词中生成指定范围内的随机整数
  // 新增：支持 id 属性存储随机数变量，可用 $random:id 引用
  // =========================

  // 随机数变量存储（每次处理时重置）
  let randomVariables_ACU = {};

  // 计算变量存储（每次处理时重置）
  let calcVariables_ACU = {};

  // 最大值变量存储（每次处理时重置）
  let maxVariables_ACU = {};

  // 最小值变量存储（每次处理时重置）
  let minVariables_ACU = {};

  /**
   * 解析随机数标签，生成随机整数
   * 语法：
   * - <random min="1" max="100" /> - 生成随机数并替换标签
   * - <random id="dice" min="1" max="6" /> - 生成随机数并存储为变量
   * @param {string} content - 包含随机数标签的内容
   * @returns {string} - 替换随机数标签后的内容
   */
  function parseRandomTags_ACU(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // 重置随机数变量存储
    randomVariables_ACU = {};

    // 匹配 <random id="xxx" min="X" max="Y" /> 或 <random min="X" max="Y" id="xxx" />
    // 也支持不带 id 的传统格式
    const randomRegex = /<random\s+([^>]*?)\s*\/?>/gi;

    return content.replace(randomRegex, (match, attrs) => {
      // 解析属性
      const idMatch = attrs.match(/id\s*=\s*"([^"]*)"/i);
      const minMatch = attrs.match(/min\s*=\s*"(\d+)"/i);
      const maxMatch = attrs.match(/max\s*=\s*"(\d+)"/i);

      if (!minMatch || !maxMatch) {
        logWarn_ACU('[随机函数] 缺少 min 或 max 参数:', attrs);
        return match; // 保持原样
      }

      const id = idMatch ? idMatch[1].trim() : null;
      const min = parseInt(minMatch[1], 10);
      const max = parseInt(maxMatch[1], 10);

      if (isNaN(min) || isNaN(max)) {
        logWarn_ACU('[随机函数] 无效的随机参数:', minMatch[1], maxMatch[1]);
        return match; // 保持原样
      }

      let randomValue;
      if (min > max) {
        logWarn_ACU('[随机函数] 最小值大于最大值，自动交换:', min, max);
        randomValue = Math.floor(Math.random() * (min - max + 1)) + max;
      } else {
        randomValue = Math.floor(Math.random() * (max - min + 1)) + min;
      }

      // 如果有 id，存储到变量中
      if (id) {
        randomVariables_ACU[id] = randomValue;
        logDebug_ACU('[随机函数] 生成随机数变量:', id, '=', randomValue, '范围:', min, '-', max);
        // 返回空字符串，不显示在文本中（用户可以用 $random:id 引用）
        return '';
      } else {
        logDebug_ACU('[随机函数] 生成随机数:', randomValue, '范围:', min, '-', max);
        return String(randomValue);
      }
    });
  }

  /**
   * 替换随机数变量引用 $random:id
   * @param {string} content - 包含随机数变量引用的内容
   * @returns {string} - 替换后的内容
   */
  function replaceRandomVariables_ACU(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // 匹配 $random:id 或 $random:id 格式
    return content.replace(/\$random:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (randomVariables_ACU.hasOwnProperty(id)) {
        return String(randomVariables_ACU[id]);
      }
      logWarn_ACU('[随机函数] 未找到随机数变量:', id);
      return match; // 保持原样
    });
  }

  /**
   * 获取随机数变量值（用于条件判断）
   * @param {string} id - 随机数变量 ID
   * @returns {number|null} - 随机数值，不存在返回 null
   */
  function getRandomVariable_ACU(id) {
    if (randomVariables_ACU.hasOwnProperty(id)) {
      return randomVariables_ACU[id];
    }
    return null;
  }

  // =========================
  // [剧情推进] 计算变量功能
  // 语法：<calc id="变量名" expr="计算表达式" />
  // 支持四则运算、表格引用、随机数引用、其他计算变量引用
  // =========================

  /**
   * 解析表达式中的变量引用，返回数值
   * 支持：cell:表名/行名/列名、$random:id、$calc:id、$max:id、$min:id
   * @param {string} expr - 表达式
   * @param {object} context - 上下文（包含 allTablesJson 等）
   * @returns {object} - { success: boolean, value: number|null, error: string|null }
   */
  function parseCalcExpressionValue_ACU(expr, context) {
    if (!expr || typeof expr !== 'string') {
      return { success: false, value: null, error: '表达式为空' };
    }

    const trimmed = expr.trim();
    
    // 检查是否是纯数字
    if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
      return { success: true, value: parseFloat(trimmed), error: null };
    }

    // 检查是否是 cell:表名/行名/列名 格式
    if (trimmed.startsWith('cell:')) {
      const cellPath = trimmed.substring(5).trim();
      const parts = cellPath.split('/');
      if (parts.length !== 3) {
        return { success: false, value: null, error: `cell 路径格式错误: ${cellPath}` };
      }
      const [tableName, rowName, colName] = parts.map(p => p.trim());
      const cellValue = getCellValue_ACU(tableName, rowName, colName, context.allTablesJson);
      if (cellValue === null || cellValue === undefined || cellValue === '') {
        return { success: false, value: null, error: `cell 值不存在: ${cellPath}` };
      }
      const numValue = parseFloat(cellValue);
      if (isNaN(numValue)) {
        return { success: false, value: null, error: `cell 值不是数字: ${cellPath} = ${cellValue}` };
      }
      return { success: true, value: numValue, error: null };
    }

    // 检查是否是 $random:id 格式
    const randomMatch = trimmed.match(/^\$random:([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (randomMatch) {
      const randomId = randomMatch[1];
      const randomValue = getRandomVariable_ACU(randomId);
      if (randomValue === null) {
        return { success: false, value: null, error: `随机数变量不存在: ${randomId}` };
      }
      return { success: true, value: randomValue, error: null };
    }

    // 检查是否是 $calc:id 格式
    const calcMatch = trimmed.match(/^\$calc:([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (calcMatch) {
      const calcId = calcMatch[1];
      if (calcVariables_ACU.hasOwnProperty(calcId)) {
        return { success: true, value: calcVariables_ACU[calcId], error: null };
      }
      return { success: false, value: null, error: `计算变量不存在: ${calcId}` };
    }

    // 检查是否是 $max:id 格式
    const maxMatch = trimmed.match(/^\$max:([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (maxMatch) {
      const maxId = maxMatch[1];
      if (maxVariables_ACU.hasOwnProperty(maxId)) {
        return { success: true, value: maxVariables_ACU[maxId], error: null };
      }
      return { success: false, value: null, error: `最大值变量不存在: ${maxId}` };
    }

    // 检查是否是 $min:id 格式
    const minMatch = trimmed.match(/^\$min:([a-zA-Z_][a-zA-Z0-9_]*)$/i);
    if (minMatch) {
      const minId = minMatch[1];
      if (minVariables_ACU.hasOwnProperty(minId)) {
        return { success: true, value: minVariables_ACU[minId], error: null };
      }
      return { success: false, value: null, error: `最小值变量不存在: ${minId}` };
    }

    return { success: false, value: null, error: `无法解析表达式: ${trimmed}` };
  }

  /**
   * 计算表达式（支持四则运算和括号）
   * @param {string} expr - 计算表达式
   * @param {object} context - 上下文
   * @returns {object} - { success: boolean, value: number|null, error: string|null }
   */
  function evaluateCalcExpression_ACU(expr, context) {
    if (!expr || typeof expr !== 'string') {
      return { success: false, value: null, error: '表达式为空' };
    }

    let processedExpr = expr.trim();
    
    // 替换所有变量引用为数值
    // 先替换 cell: 引用
    processedExpr = processedExpr.replace(/cell:([^+\-*/%()\s]+)/gi, (match, cellPath) => {
      const parts = cellPath.split('/');
      if (parts.length !== 3) {
        return 'NaN';
      }
      const [tableName, rowName, colName] = parts.map(p => p.trim());
      const cellValue = getCellValue_ACU(tableName, rowName, colName, context.allTablesJson);
      if (cellValue === null || cellValue === undefined || cellValue === '') {
        return 'NaN';
      }
      const numValue = parseFloat(cellValue);
      return isNaN(numValue) ? 'NaN' : String(numValue);
    });

    // 替换 $random:id 引用
    processedExpr = processedExpr.replace(/\$random:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      const value = getRandomVariable_ACU(id);
      return value === null ? 'NaN' : String(value);
    });

    // 替换 $calc:id 引用
    processedExpr = processedExpr.replace(/\$calc:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (calcVariables_ACU.hasOwnProperty(id)) {
        return String(calcVariables_ACU[id]);
      }
      return 'NaN';
    });

    // 替换 $max:id 引用
    processedExpr = processedExpr.replace(/\$max:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (maxVariables_ACU.hasOwnProperty(id)) {
        return String(maxVariables_ACU[id]);
      }
      return 'NaN';
    });

    // 替换 $min:id 引用
    processedExpr = processedExpr.replace(/\$min:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (minVariables_ACU.hasOwnProperty(id)) {
        return String(minVariables_ACU[id]);
      }
      return 'NaN';
    });

    // 检查是否包含 NaN（表示有变量不存在）
    if (processedExpr.includes('NaN')) {
      return { success: false, value: null, error: `表达式包含无效变量: ${processedExpr}` };
    }

    // 检查是否包含除零
    if (/\/\s*0(?![.\d])/.test(processedExpr)) {
      return { success: false, value: null, error: '除数为零' };
    }

    // 安全计算表达式
    try {
      // 只允许数字、运算符、括号和小数点
      if (!/^[\d+\-*/%().\s]+$/.test(processedExpr)) {
        return { success: false, value: null, error: `表达式包含非法字符: ${processedExpr}` };
      }
      
      // 使用 Function 安全计算
      const result = new Function('return ' + processedExpr)();
      
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return { success: false, value: null, error: `计算结果无效: ${result}` };
      }

      // 只保留整数
      const intResult = Math.floor(result);
      return { success: true, value: intResult, error: null };
    } catch (e) {
      return { success: false, value: null, error: `计算错误: ${e.message}` };
    }
  }

  /**
   * 解析计算变量标签 <calc id="xxx" expr="表达式" />
   * @param {string} content - 包含计算变量标签的内容
   * @param {object} context - 上下文
   * @returns {string} - 替换计算变量标签后的内容
   */
  function parseCalcTags_ACU(content, context) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // 重置计算变量存储
    calcVariables_ACU = {};

    // 匹配 <calc id="xxx" expr="表达式" />
    const calcRegex = /<calc\s+([^>]*?)\s*\/?>/gi;

    return content.replace(calcRegex, (match, attrs) => {
      const idMatch = attrs.match(/id\s*=\s*"([^"]*)"/i);
      const exprMatch = attrs.match(/expr\s*=\s*"([^"]*)"/i);

      if (!idMatch || !exprMatch) {
        logWarn_ACU('[计算变量] 缺少 id 或 expr 参数:', attrs);
        return match; // 保持原样
      }

      const id = idMatch[1].trim();
      const expr = exprMatch[1].trim();

      const result = evaluateCalcExpression_ACU(expr, context);
      
      if (result.success) {
        calcVariables_ACU[id] = result.value;
        logDebug_ACU('[计算变量] 定义成功:', id, '=', result.value, '表达式:', expr);
        return ''; // 成功定义，返回空字符串
      } else {
        logWarn_ACU('[计算变量] 定义失败:', id, '-', result.error);
        return match; // 保持原样，让后续条件判断失败
      }
    });
  }

  /**
   * 解析最大值变量标签 <max id="xxx" values="值1, 值2, ..." />
   * @param {string} content - 包含最大值变量标签的内容
   * @param {object} context - 上下文
   * @returns {string} - 替换最大值变量标签后的内容
   */
  function parseMaxTags_ACU(content, context) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // 重置最大值变量存储
    maxVariables_ACU = {};

    // 匹配 <max id="xxx" values="值列表" />
    const maxRegex = /<max\s+([^>]*?)\s*\/?>/gi;

    return content.replace(maxRegex, (match, attrs) => {
      const idMatch = attrs.match(/id\s*=\s*"([^"]*)"/i);
      const valuesMatch = attrs.match(/values\s*=\s*"([^"]*)"/i);

      if (!idMatch || !valuesMatch) {
        logWarn_ACU('[最大值变量] 缺少 id 或 values 参数:', attrs);
        return match;
      }

      const id = idMatch[1].trim();
      const valuesStr = valuesMatch[1].trim();

      // 解析值列表
      const valueExprs = valuesStr.split(',').map(v => v.trim()).filter(v => v);
      if (valueExprs.length === 0) {
        logWarn_ACU('[最大值变量] 值列表为空:', id);
        return match;
      }

      // 获取所有值
      const values = [];
      for (const expr of valueExprs) {
        const result = parseCalcExpressionValue_ACU(expr, context);
        if (!result.success) {
          logWarn_ACU('[最大值变量] 解析值失败:', id, '-', result.error, '表达式:', expr);
          return match; // 任一值失败，整个变量无效
        }
        values.push(result.value);
      }

      const maxValue = Math.max(...values);
      maxVariables_ACU[id] = maxValue;
      logDebug_ACU('[最大值变量] 定义成功:', id, '=', maxValue, '值列表:', values);
      return '';
    });
  }

  /**
   * 解析最小值变量标签 <min id="xxx" values="值1, 值2, ..." />
   * @param {string} content - 包含最小值变量标签的内容
   * @param {object} context - 上下文
   * @returns {string} - 替换最小值变量标签后的内容
   */
  function parseMinTags_ACU(content, context) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    // 重置最小值变量存储
    minVariables_ACU = {};

    // 匹配 <min id="xxx" values="值列表" />
    const minRegex = /<min\s+([^>]*?)\s*\/?>/gi;

    return content.replace(minRegex, (match, attrs) => {
      const idMatch = attrs.match(/id\s*=\s*"([^"]*)"/i);
      const valuesMatch = attrs.match(/values\s*=\s*"([^"]*)"/i);

      if (!idMatch || !valuesMatch) {
        logWarn_ACU('[最小值变量] 缺少 id 或 values 参数:', attrs);
        return match;
      }

      const id = idMatch[1].trim();
      const valuesStr = valuesMatch[1].trim();

      // 解析值列表
      const valueExprs = valuesStr.split(',').map(v => v.trim()).filter(v => v);
      if (valueExprs.length === 0) {
        logWarn_ACU('[最小值变量] 值列表为空:', id);
        return match;
      }

      // 获取所有值
      const values = [];
      for (const expr of valueExprs) {
        const result = parseCalcExpressionValue_ACU(expr, context);
        if (!result.success) {
          logWarn_ACU('[最小值变量] 解析值失败:', id, '-', result.error, '表达式:', expr);
          return match; // 任一值失败，整个变量无效
        }
        values.push(result.value);
      }

      const minValue = Math.min(...values);
      minVariables_ACU[id] = minValue;
      logDebug_ACU('[最小值变量] 定义成功:', id, '=', minValue, '值列表:', values);
      return '';
    });
  }

  /**
   * 替换计算变量引用 $calc:id
   * @param {string} content - 包含计算变量引用的内容
   * @returns {string} - 替换后的内容
   */
  function replaceCalcVariables_ACU(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    return content.replace(/\$calc:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (calcVariables_ACU.hasOwnProperty(id)) {
        return String(calcVariables_ACU[id]);
      }
      logWarn_ACU('[计算变量] 未找到变量:', id);
      return match; // 保持原样
    });
  }

  /**
   * 替换最大值变量引用 $max:id
   * @param {string} content - 包含最大值变量引用的内容
   * @returns {string} - 替换后的内容
   */
  function replaceMaxVariables_ACU(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    return content.replace(/\$max:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (maxVariables_ACU.hasOwnProperty(id)) {
        return String(maxVariables_ACU[id]);
      }
      logWarn_ACU('[最大值变量] 未找到变量:', id);
      return match;
    });
  }

  /**
   * 替换最小值变量引用 $min:id
   * @param {string} content - 包含最小值变量引用的内容
   * @returns {string} - 替换后的内容
   */
  function replaceMinVariables_ACU(content) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }

    return content.replace(/\$min:([a-zA-Z_][a-zA-Z0-9_]*)/gi, (match, id) => {
      if (minVariables_ACU.hasOwnProperty(id)) {
        return String(minVariables_ACU[id]);
      }
      logWarn_ACU('[最小值变量] 未找到变量:', id);
      return match;
    });
  }

  /**
   * 获取计算变量值（用于条件判断）
   * @param {string} id - 计算变量 ID
   * @returns {number|null} - 计算值，不存在返回 null
   */
  function getCalcVariable_ACU(id) {
    if (calcVariables_ACU.hasOwnProperty(id)) {
      return calcVariables_ACU[id];
    }
    return null;
  }

  /**
   * 获取最大值变量值（用于条件判断）
   * @param {string} id - 最大值变量 ID
   * @returns {number|null} - 最大值，不存在返回 null
   */
  function getMaxVariable_ACU(id) {
    if (maxVariables_ACU.hasOwnProperty(id)) {
      return maxVariables_ACU[id];
    }
    return null;
  }

  /**
   * 获取最小值变量值（用于条件判断）
   * @param {string} id - 最小值变量 ID
   * @returns {number|null} - 最小值，不存在返回 null
   */
  function getMinVariable_ACU(id) {
    if (minVariables_ACU.hasOwnProperty(id)) {
      return minVariables_ACU[id];
    }
    return null;
  }

  // =========================
  // [剧情推进] 条件模板解析功能
  // 语法：<if seed="关键词表达式">条件提示词内容</if>
  // 支持与（&）、或（,）、非（!）三种逻辑及其组合
  // 检测范围：除纪要表以外的所有数据库表格内容 + $6上轮规划数据
  // =========================

  /**
   * 解析关键词表达式并判断是否匹配
   * 支持的语法：
   * - 简单匹配：战斗
   * - 或逻辑：战斗,打架
   * - 与逻辑：战斗&主角
   * - 非逻辑：!战斗
   * - 组合逻辑：(战斗&主角),感情
   * @param {string} expression - 关键词表达式
   * @param {string} content - 待检测的内容（最新一层的AI回复正文）
   * @param {string} plotContent - 最新一层的推进数据（$6），可选
   * @returns {boolean} - 是否匹配
   */
  function evaluateSeedExpression_ACU(expression, content, plotContent = '') {
    if (!expression || typeof expression !== 'string') return false;
    if (!content || typeof content !== 'string') return false;
    if (!plotContent || typeof plotContent !== 'string') {
      plotContent = '';
    }
    
    const expr = expression.trim();
    if (!expr) return false;
    
    // 拼接最新一层AI回复正文和最新一层推进数据，在两者中查找关键词
    const combinedContent = content + '\n' + plotContent;
    const lowerContent = combinedContent.toLowerCase();
    
    // 检查单个关键词是否匹配
    const checkKeyword = (keyword) => {
      const kw = keyword.trim();
      if (!kw) return false;
      
      // 非逻辑：!关键词
      if (kw.startsWith('!')) {
        const actualKw = kw.slice(1).trim();
        if (!actualKw) return true; // 空的非逻辑视为匹配
        return !lowerContent.includes(actualKw.toLowerCase());
      }
      
      // 普通匹配
      return lowerContent.includes(kw.toLowerCase());
    };
    
    // 检查与逻辑组：A&B&C
    const checkAndGroup = (group) => {
      const keywords = group.split('&').map(k => k.trim()).filter(k => k);
      if (keywords.length === 0) return false;
      return keywords.every(kw => checkKeyword(kw));
    };
    
    // 处理括号内的组合
    // 使用局部变量存储括号结果，避免浏览器环境中 global 未定义的问题
    const _parenResults = {};
    
    const processExpression = (expr) => {
      // 先处理括号内的表达式
      // 简单处理：找到 ( ) 包裹的内容，递归处理
      let processed = expr;
      const parenRegex = /\(([^()]+)\)/g;
      let match;
      let idx = 0;
      
      while ((match = parenRegex.exec(expr)) !== null) {
        const innerExpr = match[1];
        const innerResult = processExpression(innerExpr);
        // 用占位符替换括号表达式
        processed = processed.replace(match[0], `__PAREN_${idx}__`);
        // 存储结果到局部变量
        _parenResults[`__PAREN_${idx}__`] = innerResult;
        idx++;
      }
      
      // 处理或逻辑（逗号分隔）
      const orParts = processed.split(',').map(p => p.trim()).filter(p => p);
      
      // 如果有多个或部分，任一匹配即可
      if (orParts.length > 1) {
        return orParts.some(part => {
          // 检查是否是占位符
          if (_parenResults[part] !== undefined) {
            return _parenResults[part];
          }
          // 检查是否是与逻辑组
          if (part.includes('&')) {
            return checkAndGroup(part);
          }
          return checkKeyword(part);
        });
      }
      
      // 单个部分
      const singlePart = orParts[0] || '';
      if (_parenResults[singlePart] !== undefined) {
        return _parenResults[singlePart];
      }
      if (singlePart.includes('&')) {
        return checkAndGroup(singlePart);
      }
      return checkKeyword(singlePart);
    };
    
    
    return processExpression(expr);
  }

  // =========================
  // [剧情推进] 条件模板扩展：表格数值定位与比较
  // 语法：<if cell="表格名::行名::列名 比较运算符 数值">条件提示词内容</if>
  // 支持的比较运算符：>、<、>=、<=、==、!=
  // 示例：<if cell="重要人物表::威尔逊::好感度 > 50">威尔逊好感度超过50时的提示词</if>
  // =========================

  /**
   * 从表格数据中获取指定单元格的值
   * @param {object} allTablesJson - 完整的表格数据对象
   * @param {string} tableName - 表格名称
   * @param {string} rowName - 行标识文本（会在该表任意列中查找）
   * @param {string} colName - 列名称
   * @returns {object} - { success: boolean, value: string|number, error?: string }
   */
  function getCellValue_ACU(allTablesJson, tableName, rowName, colName) {
    try {
      if (!allTablesJson || typeof allTablesJson !== 'object') {
        return { success: false, value: null, error: '表格数据为空' };
      }
      
      // 查找目标表格
      const sheets = Object.values(allTablesJson).filter(x => x && typeof x === 'object' && x.name && x.content);
      const targetTable = sheets.find(s => String(s.name || '').trim() === tableName.trim());
      
      if (!targetTable) {
        return { success: false, value: null, error: `未找到表格: ${tableName}` };
      }
      
      if (!Array.isArray(targetTable.content) || targetTable.content.length < 1) {
        return { success: false, value: null, error: `表格 ${tableName} 没有数据` };
      }
      
      // 获取表头
      const headerRow = targetTable.content[0];
      if (!Array.isArray(headerRow)) {
        return { success: false, value: null, error: `表格 ${tableName} 表头格式错误` };
      }
      
      // 查找列索引（表头中匹配列名的索引）
      const colIndex = headerRow.findIndex(h => String(h || '').trim() === colName.trim());
      if (colIndex === -1) {
        return { success: false, value: null, error: `未找到列: ${colName}` };
      }
      
      // 查找行：只要任意列有单元格匹配 rowName，就视为命中该行
      const normalizedRowName = String(rowName || '').trim();
      const dataRows = targetTable.content.slice(1);
      const targetRow = dataRows.find(row => {
        if (!Array.isArray(row)) return false;
        return row.some(cell => String(cell || '').trim() === normalizedRowName);
      });
      
      if (!targetRow) {
        return { success: false, value: null, error: `未找到行标识: ${rowName}` };
      }
      
      // 获取单元格值
      const cellValue = targetRow[colIndex];
      
      // 尝试转换为数值
      const numValue = parseFloat(cellValue);
      if (!isNaN(numValue) && isFinite(numValue)) {
        return { success: true, value: numValue, rawValue: String(cellValue) };
      }
      
      // 返回字符串值
      return { success: true, value: String(cellValue || ''), rawValue: String(cellValue || '') };
      
    } catch (e) {
      logError_ACU('[剧情推进] getCellValue_ACU 出错:', e);
      return { success: false, value: null, error: String(e.message || e) };
    }
  }

  /**
   * 规范化运算符表达式（将全角运算符转换为半角）
   * 支持：＞、＜、＝、≥、≦、≠ 等全角符号
   * @param {string} expression - 原始表达式
   * @returns {string} - 规范化后的表达式
   */
  function normalizeOperators_ACU(expression) {
    if (!expression || typeof expression !== 'string') return expression;
    return expression
      .replace(/＞/g, '>')    // 全角大于
      .replace(/＜/g, '<')    // 全角小于
      .replace(/＝/g, '==')   // 全角等于（转换为双等号）
      .replace(/≥/g, '>=')   // 大于等于
      .replace(/≦/g, '<=')   // 小于等于
      .replace(/≤/g, '<=')   // 小于等于
      .replace(/≠/g, '!=');  // 不等于
  }

  /**
   * 执行单个值的比较
   * @param {number|string} cellValue - 单元格值
   * @param {string} operator - 比较运算符
   * @param {number|string} compareValue - 比较值
   * @returns {boolean} - 是否满足条件
   */
  function compareValue_ACU(cellValue, operator, compareValue) {
    const numCompareValue = parseFloat(compareValue);
    const isNumericComparison = !isNaN(numCompareValue) && isFinite(numCompareValue);
    
    if (isNumericComparison && typeof cellValue === 'number') {
      // 数值比较
      switch (operator) {
        case '>': return cellValue > numCompareValue;
        case '<': return cellValue < numCompareValue;
        case '>=': return cellValue >= numCompareValue;
        case '<=': return cellValue <= numCompareValue;
        case '==': return cellValue === numCompareValue;
        case '!=': return cellValue !== numCompareValue;
        default: return false;
      }
    } else {
      // 字符串比较
      const strCellValue = String(cellValue);
      const strCompareValue = String(compareValue);
      switch (operator) {
        case '==': return strCellValue === strCompareValue;
        case '!=': return strCellValue !== strCompareValue;
        case '>': return strCellValue > strCompareValue;
        case '<': return strCellValue < strCompareValue;
        case '>=': return strCellValue >= strCompareValue;
        case '<=': return strCellValue <= strCompareValue;
        default: return false;
      }
    }
  }

  /**
   * 解析数值比较表达式（简化版）
   * 支持格式：
   * - 精确匹配：表格名/行标识/列名 > 50（先在任意列定位行，再读取目标列；允许行列颠倒后再整体匹配）
   * - 模糊匹配（某行）：表格名/行名 > 50（检查该行所有数值列）
   * - 模糊匹配（某列）：表格名/列名 > 50（检查该列所有数值行）
   * @param {string} expression - 比较表达式
   * @param {object} allTablesJson - 完整的表格数据对象
   * @returns {boolean} - 是否满足条件（任一匹配即返回true）
   */
  function evaluateCellExpression_ACU(expression, allTablesJson) {
    if (!expression || typeof expression !== 'string') return false;
    
    // 【新增】将全角运算符转换为半角运算符
    const normalizedExpr = normalizeOperators_ACU(expression);
    
    // 支持的比较运算符：>、<、>=、<=、==、!=
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    let matchedOperator = null;
    let cellRef = '';
    let compareValue = '';
    
    // 查找匹配的运算符（使用规范化后的表达式）
    for (const op of operators) {
      const opIndex = normalizedExpr.indexOf(op);
      if (opIndex !== -1) {
        cellRef = normalizedExpr.substring(0, opIndex).trim();
        compareValue = normalizedExpr.substring(opIndex + op.length).trim();
        matchedOperator = op;
        break;
      }
    }
    
    if (!matchedOperator) {
      logWarn_ACU('[剧情推进] evaluateCellExpression_ACU: 未找到有效的比较运算符, expression=', expression);
      return false;
    }
    
    // 解析单元格引用：用斜杠分隔
    const parts = cellRef.split('/').map(p => p.trim()).filter(p => p);
    
    if (parts.length < 2 || parts.length > 3) {
      logWarn_ACU('[剧情推进] evaluateCellExpression_ACU: 单元格引用格式错误, cellRef=', cellRef);
      return false;
    }
    
    const [tableName, name1, name2] = parts;
    
    // 查找目标表格
    if (!allTablesJson || typeof allTablesJson !== 'object') {
      // 表格数据不存在时：== 返回 false，!= 返回 true
      return matchedOperator === '!=';
    }
    
    const sheets = Object.values(allTablesJson).filter(x => x && typeof x === 'object' && x.name && x.content);
    const targetTable = sheets.find(s => String(s.name || '').trim() === tableName.trim());
    
    if (!targetTable || !Array.isArray(targetTable.content) || targetTable.content.length < 1) {
      logDebug_ACU('[剧情推进] evaluateCellExpression_ACU: 未找到表格或表格为空, tableName=', tableName);
      // 表格不存在时：== 返回 false，!= 返回 true
      return matchedOperator === '!=';
    }
    
    const headerRow = targetTable.content[0];
    if (!Array.isArray(headerRow)) {
      return false;
    }
    
    const dataRows = targetTable.content.slice(1);
    
    // 根据参数数量决定匹配模式
    if (parts.length === 3) {
      // 精确匹配：表格名/行标识/列名
      // 先在任意列中定位到包含“行标识”的整行，再读取目标列；允许将“行标识/列名”整体交换后再次尝试
      const rowName = name1;
      const colName = name2;
      let cellResult = getCellValue_ACU(allTablesJson, tableName, rowName, colName);
      
      if (cellResult.success) {
        return compareValue_ACU(cellResult.value, matchedOperator, compareValue);
      }

      // 允许行列颠倒，但仍要求“交换后”的行与列都同时存在才算命中
      cellResult = getCellValue_ACU(allTablesJson, tableName, colName, rowName);
      if (cellResult.success) {
        return compareValue_ACU(cellResult.value, matchedOperator, compareValue);
      }
      
      // 单元格不存在时：== 返回 false，!= 返回 true
      return matchedOperator === '!=';
      
    } else if (parts.length === 2) {
      // 模糊匹配：表格名/名称（检查该名称是行名还是列名）
      const targetName = name1;
      let foundAnyCell = false; // 标记是否找到了任何单元格
      
      // 检查是否是行名（第一列匹配）
      const targetRow = dataRows.find(row => {
        if (!Array.isArray(row)) return false;
        return String(row[0] || '').trim() === targetName.trim();
      });
      
      if (targetRow) {
        foundAnyCell = true;
        // 是行名，检查该行所有列（支持数值和字符串比较）
        for (let colIdx = 1; colIdx < targetRow.length; colIdx++) {
          const cellValue = targetRow[colIdx];
          if (compareValue_ACU(cellValue, matchedOperator, compareValue)) {
            return true;
          }
        }
      }
      
      // 检查是否是列名（表头匹配）
      const colIndex = headerRow.findIndex(h => String(h || '').trim() === targetName.trim());
      
      if (colIndex !== -1) {
        foundAnyCell = true;
        // 是列名，检查该列所有行（支持数值和字符串比较）
        for (const row of dataRows) {
          if (!Array.isArray(row)) continue;
          const cellValue = row[colIndex];
          if (compareValue_ACU(cellValue, matchedOperator, compareValue)) {
            return true;
          }
        }
      }
      
      // 如果找到了单元格但比较失败，返回 false
      // 如果没找到任何单元格，== 返回 false，!= 返回 true
      if (foundAnyCell) {
        return false;
      } else {
        return matchedOperator === '!=';
      }
    }
    
    return false;
  }

  // =========================
  // [剧情推进] 条件模板扩展：统一条件表达式（cond属性）
  // 语法：<if cond="条件表达式">条件提示词内容</if>
  // 支持的子条件：seed:关键词表达式 | cell:表格条件
  // 支持的逻辑运算符：& (AND) | , (OR)
  // 支持括号分组：(A & B) , C
  // 示例：<if cond="(seed:战斗 & cell:状态表/主角/魔力值 > 30) , cell:关系表/陈默/好感度 > 80">...</if>
  // =========================

  /**
   * 解析单个子条件（seed:、cell:、random:、calc:、max:、min:）
   * @param {string} subCondition - 子条件字符串，如 "seed:战斗" 或 "cell:状态表/主角/魔力值 > 30" 或 "random:dice > 3"
   * @param {object} context - 上下文对象，包含 seedContent, allTablesJson, plotContent
   * @returns {boolean} - 是否满足条件
   */
  function evaluateSubCondition_ACU(subCondition, context) {
    if (!subCondition || typeof subCondition !== 'string') return false;
    
    const trimmed = subCondition.trim();
    if (!trimmed) return false;
    
    // 检查是否是取反条件（以 ! 开头）
    let isNegated = false;
    let actualCondition = trimmed;
    
    if (trimmed.startsWith('!')) {
      isNegated = true;
      actualCondition = trimmed.slice(1).trim();
    }
    
    // 解析子条件类型
    if (actualCondition.startsWith('seed:')) {
      // 关键词匹配
      const keywordExpr = actualCondition.slice(5).trim(); // 去掉 "seed:" 前缀
      let result = evaluateSeedExpression_ACU(keywordExpr, context.seedContent || '', context.plotContent || '');
      return isNegated ? !result : result;
      
    } else if (actualCondition.startsWith('cell:')) {
      // 表格数值比较
      const cellExpr = actualCondition.slice(5).trim(); // 去掉 "cell:" 前缀
      let result = evaluateCellExpression_ACU(cellExpr, context.allTablesJson);
      return isNegated ? !result : result;
      
    } else if (actualCondition.startsWith('random:')) {
      // 随机数条件判断
      const randomExpr = actualCondition.slice(7).trim(); // 去掉 "random:" 前缀
      let result = evaluateRandomExpression_ACU(randomExpr);
      return isNegated ? !result : result;
      
    } else if (actualCondition.startsWith('calc:')) {
      // 计算变量条件判断
      const calcExpr = actualCondition.slice(5).trim(); // 去掉 "calc:" 前缀
      let result = evaluateCalcCondition_ACU(calcExpr);
      return isNegated ? !result : result;
      
    } else if (actualCondition.startsWith('max:')) {
      // 最大值变量条件判断
      const maxExpr = actualCondition.slice(4).trim(); // 去掉 "max:" 前缀
      let result = evaluateMaxCondition_ACU(maxExpr);
      return isNegated ? !result : result;
      
    } else if (actualCondition.startsWith('min:')) {
      // 最小值变量条件判断
      const minExpr = actualCondition.slice(4).trim(); // 去掉 "min:" 前缀
      let result = evaluateMinCondition_ACU(minExpr);
      return isNegated ? !result : result;
      
    } else {
      // 尝试作为关键词匹配（向后兼容，不带前缀的情况）
      logWarn_ACU('[条件模板] 子条件缺少前缀，默认作为关键词匹配:', actualCondition);
      let result = evaluateSeedExpression_ACU(actualCondition, context.seedContent || '', context.plotContent || '');
      return isNegated ? !result : result;
    }
  }

  /**
   * 解析计算变量条件表达式
   * 格式：calc:id > 50
   * @param {string} expression - 计算变量条件表达式
   * @returns {boolean} - 是否满足条件
   */
  function evaluateCalcCondition_ACU(expression) {
    if (!expression || typeof expression !== 'string') return false;
    
    // 规范化运算符（支持全角符号）
    const expr = normalizeOperators_ACU(expression).trim();
    if (!expr) return false;
    
    // 支持的比较运算符：>=、<=、!=、==、>、<
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    let matchedOperator = null;
    let varRef = '';
    let compareValue = '';
    
    // 查找匹配的运算符
    for (const op of operators) {
      const opIndex = expr.indexOf(op);
      if (opIndex !== -1) {
        varRef = expr.substring(0, opIndex).trim();
        compareValue = expr.substring(opIndex + op.length).trim();
        matchedOperator = op;
        break;
      }
    }
    
    if (!matchedOperator) {
      logWarn_ACU('[条件模板] evaluateCalcCondition_ACU: 未找到有效的比较运算符, expression=', expression);
      return false;
    }
    
    // 获取计算变量值
    const calcValue = getCalcVariable_ACU(varRef);
    if (calcValue === null) {
      logWarn_ACU('[条件模板] evaluateCalcCondition_ACU: 未找到计算变量:', varRef);
      return false;
    }
    
    // 执行比较
    const numCompareValue = parseFloat(compareValue);
    if (isNaN(numCompareValue)) {
      logWarn_ACU('[条件模板] evaluateCalcCondition_ACU: 无效的比较值:', compareValue);
      return false;
    }
    
    return compareValue_ACU(calcValue, matchedOperator, numCompareValue);
  }

  /**
   * 解析最大值变量条件表达式
   * 格式：max:id > 50
   * @param {string} expression - 最大值变量条件表达式
   * @returns {boolean} - 是否满足条件
   */
  function evaluateMaxCondition_ACU(expression) {
    if (!expression || typeof expression !== 'string') return false;
    
    // 规范化运算符（支持全角符号）
    const expr = normalizeOperators_ACU(expression).trim();
    if (!expr) return false;
    
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    let matchedOperator = null;
    let varRef = '';
    let compareValue = '';
    
    for (const op of operators) {
      const opIndex = expr.indexOf(op);
      if (opIndex !== -1) {
        varRef = expr.substring(0, opIndex).trim();
        compareValue = expr.substring(opIndex + op.length).trim();
        matchedOperator = op;
        break;
      }
    }
    
    if (!matchedOperator) {
      logWarn_ACU('[条件模板] evaluateMaxCondition_ACU: 未找到有效的比较运算符, expression=', expression);
      return false;
    }
    
    const maxValue = getMaxVariable_ACU(varRef);
    if (maxValue === null) {
      logWarn_ACU('[条件模板] evaluateMaxCondition_ACU: 未找到最大值变量:', varRef);
      return false;
    }
    
    const numCompareValue = parseFloat(compareValue);
    if (isNaN(numCompareValue)) {
      logWarn_ACU('[条件模板] evaluateMaxCondition_ACU: 无效的比较值:', compareValue);
      return false;
    }
    
    return compareValue_ACU(maxValue, matchedOperator, numCompareValue);
  }

  /**
   * 解析最小值变量条件表达式
   * 格式：min:id < 50
   * @param {string} expression - 最小值变量条件表达式
   * @returns {boolean} - 是否满足条件
   */
  function evaluateMinCondition_ACU(expression) {
    if (!expression || typeof expression !== 'string') return false;
    
    // 规范化运算符（支持全角符号）
    const expr = normalizeOperators_ACU(expression).trim();
    if (!expr) return false;
    
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    let matchedOperator = null;
    let varRef = '';
    let compareValue = '';
    
    for (const op of operators) {
      const opIndex = expr.indexOf(op);
      if (opIndex !== -1) {
        varRef = expr.substring(0, opIndex).trim();
        compareValue = expr.substring(opIndex + op.length).trim();
        matchedOperator = op;
        break;
      }
    }
    
    if (!matchedOperator) {
      logWarn_ACU('[条件模板] evaluateMinCondition_ACU: 未找到有效的比较运算符, expression=', expression);
      return false;
    }
    
    const minValue = getMinVariable_ACU(varRef);
    if (minValue === null) {
      logWarn_ACU('[条件模板] evaluateMinCondition_ACU: 未找到最小值变量:', varRef);
      return false;
    }
    
    const numCompareValue = parseFloat(compareValue);
    if (isNaN(numCompareValue)) {
      logWarn_ACU('[条件模板] evaluateMinCondition_ACU: 无效的比较值:', compareValue);
      return false;
    }
    
    return compareValue_ACU(minValue, matchedOperator, numCompareValue);
  }

  /**
   * 解析随机数条件表达式
   * 支持两种格式：
   * 1. random:id > 50 - 引用已生成的随机数变量
   * 2. random:1-100 > 50 - 内联随机数（生成并判断）
   * @param {string} expression - 随机数条件表达式
   * @returns {boolean} - 是否满足条件
   */
  function evaluateRandomExpression_ACU(expression) {
    if (!expression || typeof expression !== 'string') return false;
    
    // 规范化运算符（支持全角符号）
    const expr = normalizeOperators_ACU(expression).trim();
    if (!expr) return false;
    
    // 支持的比较运算符：>=、<=、!=、==、>、<
    const operators = ['>=', '<=', '!=', '==', '>', '<'];
    
    let matchedOperator = null;
    let randomRef = '';
    let compareValue = '';
    
    // 查找匹配的运算符
    for (const op of operators) {
      const opIndex = expr.indexOf(op);
      if (opIndex !== -1) {
        randomRef = expr.substring(0, opIndex).trim();
        compareValue = expr.substring(opIndex + op.length).trim();
        matchedOperator = op;
        break;
      }
    }
    
    if (!matchedOperator) {
      logWarn_ACU('[条件模板] evaluateRandomExpression_ACU: 未找到有效的比较运算符, expression=', expression);
      return false;
    }
    
    // 获取随机数值
    let randomValue = null;
    
    // 检查是否是内联随机数格式（如 1-100）
    const inlineMatch = randomRef.match(/^(\d+)-(\d+)$/);
    if (inlineMatch) {
      // 内联随机数：生成并判断
      const min = parseInt(inlineMatch[1], 10);
      const max = parseInt(inlineMatch[2], 10);
      if (!isNaN(min) && !isNaN(max)) {
        randomValue = Math.floor(Math.random() * (Math.abs(max - min) + 1)) + Math.min(min, max);
        logDebug_ACU('[条件模板] 内联随机数生成:', randomValue, '范围:', min, '-', max);
      }
    } else {
      // 引用随机数变量
      randomValue = getRandomVariable_ACU(randomRef);
      if (randomValue === null) {
        logWarn_ACU('[条件模板] evaluateRandomExpression_ACU: 未找到随机数变量:', randomRef);
        return false;
      }
    }
    
    // 执行比较
    const numCompareValue = parseFloat(compareValue);
    if (isNaN(numCompareValue)) {
      logWarn_ACU('[条件模板] evaluateRandomExpression_ACU: 无效的比较值:', compareValue);
      return false;
    }
    
    return compareValue_ACU(randomValue, matchedOperator, numCompareValue);
  }

  /**
   * 解析统一条件表达式（支持括号分组、& 和 , 运算符）
   * 运算优先级：括号 > & (AND) > , (OR)
   * @param {string} expression - 条件表达式
   * @param {object} context - 上下文对象
   * @returns {boolean} - 是否满足条件
   */
  function evaluateCondExpression_ACU(expression, context) {
    if (!expression || typeof expression !== 'string') return false;
    
    const expr = expression.trim();
    if (!expr) return false;
    
    // 使用递归下降解析器处理表达式
    // 语法：Expression = OrExpr
    //        OrExpr = AndExpr (',' AndExpr)*
    //        AndExpr = Primary ('&' Primary)*
    //        Primary = '(' Expression ')' | SubCondition
    //        SubCondition = ('!'? ('seed:' | 'cell:')? [^()&,]+)
    
    let pos = 0;
    
    // 跳过空白
    const skipWhitespace = () => {
      while (pos < expr.length && /\s/.test(expr[pos])) {
        pos++;
      }
    };
    
    // 解析或表达式（最低优先级）
    const parseOrExpr = () => {
      skipWhitespace();
      let result = parseAndExpr();
      
      while (pos < expr.length) {
        skipWhitespace();
        if (expr[pos] === ',') {
          pos++; // 跳过 ','
          skipWhitespace();
          const right = parseAndExpr();
          result = result || right; // OR 逻辑
        } else {
          break;
        }
      }
      
      return result;
    };
    
    // 解析与表达式
    const parseAndExpr = () => {
      skipWhitespace();
      let result = parsePrimary();
      
      while (pos < expr.length) {
        skipWhitespace();
        if (expr[pos] === '&') {
          pos++; // 跳过 '&'
          skipWhitespace();
          const right = parsePrimary();
          result = result && right; // AND 逻辑
        } else {
          break;
        }
      }
      
      return result;
    };
    
    // 解析基本元素（括号表达式或子条件）
    const parsePrimary = () => {
      skipWhitespace();
      
      if (pos >= expr.length) return false;
      
      // 检查是否是取反操作（!）
      let isNegated = false;
      if (expr[pos] === '!') {
        isNegated = true;
        pos++; // 跳过 '!'
        skipWhitespace();
      }
      
      // 括号表达式
      if (expr[pos] === '(') {
        pos++; // 跳过 '('
        skipWhitespace();
        const result = parseOrExpr();
        skipWhitespace();
        if (pos < expr.length && expr[pos] === ')') {
          pos++; // 跳过 ')'
        }
        return isNegated ? !result : result;
      }
      
      // 子条件：提取直到遇到运算符或括号
      let subCond = '';
      while (pos < expr.length && expr[pos] !== '(' && expr[pos] !== ')' && expr[pos] !== '&' && expr[pos] !== ',') {
        subCond += expr[pos];
        pos++;
      }
      
      const result = evaluateSubCondition_ACU(subCond, context);
      return isNegated ? !result : result;
    };
    
    try {
      const result = parseOrExpr();
      skipWhitespace();
      return result;
    } catch (e) {
      logError_ACU('[条件模板] evaluateCondExpression_ACU 解析出错:', e, 'expression:', expression);
      return false;
    }
  }

  /**
   * 解析条件模板，根据关键词匹配或表格数值比较决定是否包含条件提示词内容
   * 支持三种语法：
   * 1. <if seed="关键词表达式">内容</if> - 关键词匹配
   * 2. <if cell="表格名/行名/列名 > 50">内容</if> - 表格数值比较
   * 3. <if cond="条件表达式">内容</if> - 统一条件表达式（新增）
   * @param {string} templateContent - 包含条件模板的提示词内容
   * @param {string} seedContent - 用于关键词检测的内容（表格内容）
   * @param {object} allTablesJson - 完整的表格数据对象（用于表格数值比较）
   * @param {string} plotContent - 上轮规划数据（$6），用于关键词检测
   * @returns {string} - 解析后的提示词内容
   */
  function parseConditionalTemplate_ACU(templateContent, seedContent, allTablesJson, plotContent = '') {
    if (!templateContent || typeof templateContent !== 'string') {
      return templateContent || '';
    }
    
    if (!seedContent || typeof seedContent !== 'string') {
      seedContent = '';
    }
    
    if (!plotContent || typeof plotContent !== 'string') {
      plotContent = '';
    }
    
    // 构建上下文对象
    const context = { seedContent, allTablesJson, plotContent };
    
    // 正则匹配 <if seed="表达式">内容</if> 或 <if cell="表达式">内容</if> 或 <if cond="表达式">内容</if>
    // 使用非贪婪匹配，支持多行内容
    const ifRegex = /<if\s+(seed|cell|cond)\s*=\s*"([^"]*)"\s*>([\s\S]*?)<\/if>/gi;
    
    let result = templateContent;
    let match;
    
    // 收集所有匹配项并处理
    const matches = [];
    while ((match = ifRegex.exec(templateContent)) !== null) {
      matches.push({
        fullMatch: match[0],
        type: match[1].toLowerCase(), // 'seed'、'cell' 或 'cond'
        expression: match[2],
        content: match[3],
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // 从后向前替换，避免索引偏移问题
    for (let i = matches.length - 1; i >= 0; i--) {
      const m = matches[i];
      let shouldInclude = false;
      
      if (m.type === 'seed') {
        // 关键词匹配（在表格内容和上轮规划数据中查找）
        shouldInclude = evaluateSeedExpression_ACU(m.expression, seedContent, plotContent);
      } else if (m.type === 'cell') {
        // 表格数值比较
        shouldInclude = evaluateCellExpression_ACU(m.expression, allTablesJson);
      } else if (m.type === 'cond') {
        // 统一条件表达式（支持 seed: 和 cell: 混合，支持括号分组）
        shouldInclude = evaluateCondExpression_ACU(m.expression, context);
      }
      
      if (shouldInclude) {
        // 匹配成功，保留条件提示词内容（不包含包裹符号）
        result = result.slice(0, m.startIndex) + m.content + result.slice(m.endIndex);
      } else {
        // 匹配失败，移除整个条件模板块
        result = result.slice(0, m.startIndex) + result.slice(m.endIndex);
      }
    }
    
    return result;
  }

  /**
   * 解析条件模板（支持 else 和嵌套）
   * 递归解析 <if ...>...</if> 结构，支持 <else> 分支和嵌套条件
   * @param {string} content - 包含条件模板的内容
   * @param {object} context - 上下文对象，包含 seedContent 和 allTablesJson
   * @param {number} depth - 当前递归深度
   * @returns {string} - 解析后的内容
   */
  function parseIfBlockRecursive_ACU(content, context, depth = 0) {
    if (!content || typeof content !== 'string') {
      return content || '';
    }
    
    // 防止无限递归
    const maxDepth = settings_ACU?.promptTemplateSettings?.maxNestingDepth || 10;
    if (depth > maxDepth) {
      logWarn_ACU(`[条件模板] 超过最大嵌套深度 ${maxDepth}，停止解析`);
      return content;
    }
    
    // 使用正则匹配最外层的 <if ...>...</if>
    // 注意：这个正则需要处理嵌套，所以我们使用一个更智能的方法
    const result = parseIfBlocksInContent_ACU(content, context, depth);
    
    return result;
  }

  /**
   * 解析内容中的所有 if 块（支持嵌套）
   * @param {string} content - 内容
   * @param {object} context - 上下文
   * @param {number} depth - 当前深度
   * @returns {string} - 解析后的内容
   */
  function parseIfBlocksInContent_ACU(content, context, depth) {
    let result = '';
    let currentIndex = 0;
    
    while (currentIndex < content.length) {
      // 查找下一个 <if 开始标签
      // 支持三种格式：
      // 1. <if seed="表达式">
      // 2. <if cell="表达式">
      // 3. <if cond="表达式"> (新增)
      const ifStartMatch = content.slice(currentIndex).match(/<if\s+(seed|cell|cond)\s*=\s*"([^"]*)"\s*>/i);
      
      if (!ifStartMatch) {
        // 没有更多的 if 块，添加剩余内容
        result += content.slice(currentIndex);
        break;
      }
      
      // 添加 if 标签之前的内容
      const ifStartIndex = currentIndex + ifStartMatch.index;
      result += content.slice(currentIndex, ifStartIndex);
      
      // 解析这个 if 块
      const ifBlock = parseSingleIfBlock_ACU(
        content,
        ifStartIndex,
        ifStartMatch[1], // type
        ifStartMatch[2], // expression
        context,
        depth
      );
      
      if (ifBlock) {
        result += ifBlock.content;
        currentIndex = ifBlock.endIndex;
      } else {
        // 解析失败，跳过这个标签
        result += ifStartMatch[0];
        currentIndex = ifStartIndex + ifStartMatch[0].length;
      }
    }
    
    return result;
  }

  /**
   * 解析单个 if 块（包括 else 分支和嵌套）
   * @param {string} content - 完整内容
   * @param {number} startIndex - if 块开始索引
   * @param {string} type - 条件类型 (seed、cell 或 cond)
   * @param {string} expression - 条件表达式
   * @param {object} context - 上下文
   * @param {number} depth - 当前深度
   * @returns {object|null} - { content: 解析后的内容, endIndex: 结束索引 }
   */
  function parseSingleIfBlock_ACU(content, startIndex, type, expression, context, depth) {
    // 找到 if 开始标签的结束位置
    // 支持 seed、cell、cond 三种类型
    const ifStartMatch = content.slice(startIndex).match(/<if\s+(?:seed|cell|cond)\s*=\s*"[^"]*"\s*>/i);
    if (!ifStartMatch) return null;
    
    const ifStartTagEnd = startIndex + ifStartMatch[0].length;
    
    // 查找匹配的 </if> 结束标签（需要处理嵌套）
    let nestingLevel = 1;
    let currentIndex = ifStartTagEnd;
    let elseIndex = -1;
    
    while (currentIndex < content.length && nestingLevel > 0) {
      // 查找下一个 <if 或 </if> 或 <else>
      const remainingContent = content.slice(currentIndex);
      
      // 匹配嵌套的 <if 开始标签（支持 seed、cell、cond 三种类型）
      const nestedIfMatch = remainingContent.match(/<if\s+(?:seed|cell|cond)\s*=\s*"[^"]*"\s*>/i);
      // 匹配 </if> 结束标签
      const endIfMatch = remainingContent.match(/<\/if>/i);
      // 匹配 <else> 标签（只在当前层级有效）
      const elseMatch = remainingContent.match(/<else>/i);
      
      // 找到最近的一个
      const positions = [];
      if (nestedIfMatch) positions.push({ type: 'if', index: currentIndex + nestedIfMatch.index, length: nestedIfMatch[0].length });
      if (endIfMatch) positions.push({ type: 'endif', index: currentIndex + endIfMatch.index, length: endIfMatch[0].length });
      if (elseMatch && nestingLevel === 1) positions.push({ type: 'else', index: currentIndex + elseMatch.index, length: elseMatch[0].length });
      
      if (positions.length === 0) {
        // 没有找到任何标签，格式错误
        return null;
      }
      
      // 按索引排序，找到最近的
      positions.sort((a, b) => a.index - b.index);
      const nearest = positions[0];
      
      if (nearest.type === 'if') {
        nestingLevel++;
        currentIndex = nearest.index + nearest.length;
      } else if (nearest.type === 'endif') {
        nestingLevel--;
        if (nestingLevel === 0) {
          // 找到匹配的结束标签
          const ifBody = content.slice(ifStartTagEnd, nearest.index);
          const endIndex = nearest.index + nearest.length;
          
          // 处理 else 分支
          let ifContent, elseContent;
          const elsePos = ifBody.indexOf('<else>');
          if (elsePos !== -1) {
            ifContent = ifBody.slice(0, elsePos);
            elseContent = ifBody.slice(elsePos + 6); // '<else>'.length = 6
          } else {
            ifContent = ifBody;
            elseContent = '';
          }
          
          // 评估条件
          let conditionMet = false;
          const typeLower = type.toLowerCase();
          
          if (typeLower === 'seed') {
            // 关键词匹配（在表格内容和上轮规划数据中查找）
            conditionMet = evaluateSeedExpression_ACU(expression, context.seedContent || '', context.plotContent || '');
          } else if (typeLower === 'cell') {
            // 表格数值比较
            conditionMet = evaluateCellExpression_ACU(expression, context.allTablesJson);
          } else if (typeLower === 'cond') {
            // 统一条件表达式（支持 seed: 和 cell: 混合，支持括号分组）
            conditionMet = evaluateCondExpression_ACU(expression, context);
          }
          
          // 选择内容并递归处理嵌套
          const selectedContent = conditionMet ? ifContent : elseContent;
          const processedContent = parseIfBlocksInContent_ACU(selectedContent, context, depth + 1);
          
          return { content: processedContent, endIndex };
        } else {
          currentIndex = nearest.index + nearest.length;
        }
      } else if (nearest.type === 'else') {
        // 只在 nestingLevel === 1 时记录 else 位置
        currentIndex = nearest.index + nearest.length;
      }
    }
    
    return null;
  }

  /**
   * 获取用于提示词处理的数据库表格数据
   * @returns {object} - 表格数据对象
   */
  function getTableDataForPrompt_ACU() {
    return currentJsonTableData_ACU || {};
  }

  /**
   * 获取最新一条AI消息的正文内容，用于条件模板的 seed 关键词检测
   * @returns {string} - 最新AI消息正文；若不存在则返回空字符串
   */
  function getLatestAIMessageContent_ACU() {
    const chat = SillyTavern_API_ACU.chat;
    if (!chat || chat.length === 0) {
      return '';
    }

    for (let i = chat.length - 1; i >= 0; i--) {
      const message = chat[i];
      if (message && !message.is_user) {
        return typeof message.mes === 'string' ? message.mes : '';
      }
    }

    return '';
  }

  /**
   * 处理酒馆提示词（CHAT_COMPLETION_SETTINGS_READY 事件处理）
   * @param {object} data - 事件数据，包含 messages 数组
   */
  async function handleChatCompletionReady_ACU(data) {
    logDebug_ACU('[提示词模板] handleChatCompletionReady_ACU 被调用');
    logDebug_ACU('[提示词模板] settings_ACU?.promptTemplateSettings:', settings_ACU?.promptTemplateSettings);
    
    // 检查功能是否启用
    if (!settings_ACU?.promptTemplateSettings?.enabled) {
      logDebug_ACU('[提示词模板] 功能未启用，跳过处理');
      return;
    }
    
    if (!data || !data.messages || !Array.isArray(data.messages)) {
      return;
    }
    
    const startTime = Date.now();
    logDebug_ACU('[提示词模板] 开始处理酒馆提示词...');
    
    // 获取最新一层推进数据（$6）
    const lastPlotContent = getPlotFromHistory_ACU();
    logDebug_ACU('[提示词模板] $6 最新一层推进数据:', lastPlotContent ? `长度=${lastPlotContent.length}` : '(空)');
    
    // 获取上下文数据
    const context = {
      seedContent: getLatestAIMessageContent_ACU(),
      allTablesJson: getTableDataForPrompt_ACU(),
      plotContent: lastPlotContent
    };

    const processPromptTemplateContent_ACU = (content) => {
      if (typeof content !== 'string' || !content) {
        return typeof content === 'string' ? content : '';
      }

      let processedContent = content;

      // [随机函数] 先处理随机数标签与随机变量引用，确保正文提示词中也能生效
      processedContent = parseRandomTags_ACU(processedContent);
      processedContent = replaceRandomVariables_ACU(processedContent);

      // [计算变量] 再处理计算/最大值/最小值标签与变量引用
      const contextForCalc = { allTablesJson: context.allTablesJson };
      processedContent = parseCalcTags_ACU(processedContent, contextForCalc);
      processedContent = parseMaxTags_ACU(processedContent, contextForCalc);
      processedContent = parseMinTags_ACU(processedContent, contextForCalc);
      processedContent = replaceCalcVariables_ACU(processedContent);
      processedContent = replaceMaxVariables_ACU(processedContent);
      processedContent = replaceMinVariables_ACU(processedContent);

      // [条件模板] 最后处理 if/else 逻辑
      processedContent = parseIfBlockRecursive_ACU(processedContent, context, 0);
      return processedContent;
    };
    
    // 遍历处理消息
    let processedCount = 0;
    for (const message of data.messages) {
      if (typeof message.content === 'string') {
        const originalContent = message.content;
        message.content = processPromptTemplateContent_ACU(message.content);
        if (message.content !== originalContent) {
          processedCount++;
        }
      } else if (Array.isArray(message.content)) {
        for (const part of message.content) {
          if (part.type === 'text' && part.text) {
            const originalText = part.text;
            part.text = processPromptTemplateContent_ACU(part.text);
            if (part.text !== originalText) {
              processedCount++;
            }
          }
        }
      }
    }
    
    const endTime = Date.now();
    logDebug_ACU(`[提示词模板] 处理完成，共处理 ${processedCount} 个消息块，耗时 ${endTime - startTime}ms`);
  }

  /**
   * 转义正则表达式特殊字符。
   * @param {string} string - 需要转义的字符串.
   * @returns {string} - 转义后的字符串.
   */
  function escapeRegExp_ACU(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& 表示匹配到的整个字符串
  }

  function getNormalizedPlotMessageRole_ACU(role) {
    const ru = String(role || '').toUpperCase();
    if (ru === 'AI' || ru === 'ASSISTANT') return 'assistant';
    if (ru === 'SYSTEM') return 'system';
    if (ru === 'USER') return 'user';
    return String(role || 'user').toLowerCase();
  }

  async function tryRenderPlotTemplateWithEjs_ACU(content) {
    if (!content) return '';
    if (window.EjsTemplate && typeof window.EjsTemplate.evalTemplate === 'function') {
      try {
        const context = await window.EjsTemplate.prepareContext();
        if (typeof window.Mvu !== 'undefined' && window.Mvu.getMvuData) {
          try {
            const mvuObj = window.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
            if (mvuObj && mvuObj.stat_data) {
              context.mvu = mvuObj.stat_data;
            }
          } catch (e) {
            logWarn_ACU('[剧情推进] 获取 MVU 数据失败:', e);
          }
        }
        return await window.EjsTemplate.evalTemplate(content, context);
      } catch (e) {
        logWarn_ACU('[剧情推进] 提示词模板渲染失败，将使用原始文本:', e);
        return content;
      }
    }
    return content;
  }

  function clonePlotTemplateVariableMap_ACU(store) {
    return store && typeof store === 'object' ? { ...store } : {};
  }

  function capturePlotTemplateVariables_ACU() {
    return {
      randomVariables: clonePlotTemplateVariableMap_ACU(randomVariables_ACU),
      calcVariables: clonePlotTemplateVariableMap_ACU(calcVariables_ACU),
      maxVariables: clonePlotTemplateVariableMap_ACU(maxVariables_ACU),
      minVariables: clonePlotTemplateVariableMap_ACU(minVariables_ACU),
    };
  }

  function restorePlotTemplateVariables_ACU(snapshot) {
    randomVariables_ACU = clonePlotTemplateVariableMap_ACU(snapshot?.randomVariables);
    calcVariables_ACU = clonePlotTemplateVariableMap_ACU(snapshot?.calcVariables);
    maxVariables_ACU = clonePlotTemplateVariableMap_ACU(snapshot?.maxVariables);
    minVariables_ACU = clonePlotTemplateVariableMap_ACU(snapshot?.minVariables);
  }

  function runWithIsolatedPlotTemplateVariables_ACU(callback) {
    const previousSnapshot = capturePlotTemplateVariables_ACU();
    restorePlotTemplateVariables_ACU(null);
    try {
      return callback();
    } finally {
      restorePlotTemplateVariables_ACU(previousSnapshot);
    }
  }

  function renderPlotTaskContentWithIsolatedVariables_ACU(content, sharedContext) {
    const contextForCalc = { allTablesJson: sharedContext.allTablesJson };
    const contextForIf = {
      seedContent: sharedContext.seedContentForConditional,
      allTablesJson: sharedContext.allTablesJson,
      plotContent: sharedContext.lastPlotContent || '',
    };

    return runWithIsolatedPlotTemplateVariables_ACU(() => {
      let renderedContent = content;
      renderedContent = parseRandomTags_ACU(renderedContent);
      renderedContent = replaceRandomVariables_ACU(renderedContent);
      renderedContent = parseCalcTags_ACU(renderedContent, contextForCalc);
      renderedContent = parseMaxTags_ACU(renderedContent, contextForCalc);
      renderedContent = parseMinTags_ACU(renderedContent, contextForCalc);
      renderedContent = replaceCalcVariables_ACU(renderedContent);
      renderedContent = replaceMaxVariables_ACU(renderedContent);
      renderedContent = replaceMinVariables_ACU(renderedContent);
      return parseIfBlockRecursive_ACU(renderedContent, contextForIf, 0);
    });
  }

  function extractLastTagContent_ACU(text, rawTagName) {
    if (!text || !rawTagName) return null;
    const tagName = String(rawTagName).trim();
    if (!tagName) return null;

    const lower = String(text).toLowerCase();
    const open = `<${tagName.toLowerCase()}>`;
    const close = `</${tagName.toLowerCase()}>`;

    const closeIdx = lower.lastIndexOf(close);
    if (closeIdx === -1) return null;

    const openIdx = lower.lastIndexOf(open, closeIdx);
    if (openIdx === -1) return null;

    const contentStart = openIdx + open.length;
    return String(text).slice(contentStart, closeIdx);
  }

  function extractPlotTagsFromResponse_ACU(text, extractTags) {
    const tagNames = String(extractTags || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    const extractedTags = {};
    const injectedFragments = [];

    tagNames.forEach(tagName => {
      const content = extractLastTagContent_ACU(text, tagName);
      if (content !== null) {
        extractedTags[tagName] = content;
        injectedFragments.push(`<${tagName}>${content}</${tagName}>`);
      }
    });

    return {
      tagNames,
      extractedTags,
      injectedFragments,
    };
  }

  function extractAllTagContents_ACU(text, rawTagName) {
    if (!text || !rawTagName) return [];
    const tagName = String(rawTagName).trim();
    if (!tagName) return [];

    const source = String(text);
    const lower = source.toLowerCase();
    const open = `<${tagName.toLowerCase()}>`;
    const close = `</${tagName.toLowerCase()}>`;
    const contents = [];
    let searchIndex = 0;

    while (searchIndex < lower.length) {
      const openIdx = lower.indexOf(open, searchIndex);
      if (openIdx === -1) break;
      const contentStart = openIdx + open.length;
      const closeIdx = lower.indexOf(close, contentStart);
      if (closeIdx === -1) break;
      contents.push(source.slice(contentStart, closeIdx));
      searchIndex = closeIdx + close.length;
    }

    return contents;
  }

  function getPlotPlaceholderTagNames_ACU(text) {
    const placeholderPattern = /\{\{(\w+)\}\}/g;
    const names = [];
    let match;

    while ((match = placeholderPattern.exec(String(text || ''))) !== null) {
      const tagName = String(match[1] || '').trim();
      if (tagName) names.push(tagName);
    }

    return [...new Set(names)];
  }

  function buildPlotTagMapFromText_ACU(text, requestedTagNames = null) {
    const sourceText = String(text || '');
    const tagMap = new Map();
    if (!sourceText.trim()) return tagMap;

    if (Array.isArray(requestedTagNames) && requestedTagNames.length > 0) {
      [...new Set(requestedTagNames.map(tagName => String(tagName || '').trim()).filter(Boolean))].forEach(tagName => {
        const contents = extractAllTagContents_ACU(sourceText, tagName);
        if (contents.length > 0) {
          tagMap.set(tagName, contents);
        }
      });
      return tagMap;
    }

    const tagPattern = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let match;
    while ((match = tagPattern.exec(sourceText)) !== null) {
      const tagName = String(match[1] || '').trim();
      if (!tagName) continue;
      if (!tagMap.has(tagName)) tagMap.set(tagName, []);
      tagMap.get(tagName).push(match[2] ?? '');
    }

    return tagMap;
  }

  function buildPlotTagBlock_ACU(tagName, contents) {
    const normalizedTagName = String(tagName || '').trim();
    if (!normalizedTagName) return '';
    const normalizedContents = (Array.isArray(contents) ? contents : [contents]).map(content => content ?? '');
    if (!normalizedContents.length) return '';
    return `<${normalizedTagName}>${normalizedContents.join('\n\n')}</${normalizedTagName}>`;
  }

  function replacePlotTagPlaceholders_ACU(text, tagSourceMap) {
    const sourceText = String(text || '');
    if (!sourceText) return '';
    const placeholderPattern = /\{\{(\w+)\}\}/g;

    return sourceText.replace(placeholderPattern, (placeholder, tagName) => {
      if (!(tagSourceMap instanceof Map)) return '';
      return buildPlotTagBlock_ACU(tagName, tagSourceMap.get(tagName));
    });
  }

  function sortPlotTaskResults_ACU(results) {
    return (Array.isArray(results) ? [...results] : [])
      .filter(Boolean)
      .sort((a, b) => (normalizePositiveInteger_ACU(a?.stage, 1) - normalizePositiveInteger_ACU(b?.stage, 1)) || ((a?.order ?? 0) - (b?.order ?? 0)));
  }

  function aggregatePlotTaskTags_ACU(taskResults) {
    const aggregated = new Map();
    const sortedResults = sortPlotTaskResults_ACU(taskResults);

    sortedResults.forEach(result => {
      if (!result?.success || !result.extractedTags || typeof result.extractedTags !== 'object') return;
      Object.entries(result.extractedTags).forEach(([tagName, content]) => {
        if (!aggregated.has(tagName)) aggregated.set(tagName, []);
        aggregated.get(tagName).push(content ?? '');
      });
    });

    return aggregated;
  }

  function buildAggregatedPlotTagBlocks_ACU(aggregatedTags) {
    if (!(aggregatedTags instanceof Map) || aggregatedTags.size === 0) return '';
    const blocks = [];
    aggregatedTags.forEach((contents, tagName) => {
      const block = buildPlotTagBlock_ACU(tagName, contents);
      if (block) blocks.push(block);
    });
    return blocks.join('\n\n');
  }

  function buildPlotRawFallbackText_ACU(taskResults) {
    const successfulResults = sortPlotTaskResults_ACU(taskResults)
      .filter(result => result?.success && typeof result.rawResponse === 'string' && result.rawResponse.trim());

    if (successfulResults.length === 0) return '';
    if (successfulResults.length === 1) {
      return successfulResults[0].rawResponse.trim();
    }

    return successfulResults
      .map(result => `【剧情任务：${result.taskName || result.taskId || '未命名任务'}】\n${result.rawResponse.trim()}`)
      .join('\n\n');
  }

  function buildPlotSaveContentFromTaskResults_ACU(taskResults) {
    return buildPlotRawFallbackText_ACU(taskResults);
  }

  function buildFinalPlotInjectionMessage_ACU(finalSystemDirectiveContent, taskResults, aggregatedTags) {
    const defaultDirective = '[SYSTEM_DIRECTIVE: You are a storyteller. The following <plot> block is your absolute script for this turn. You MUST follow the <directive> within it to generate the story.]';
    const baseDirective = String(finalSystemDirectiveContent || '').trim() || defaultDirective;
    const rawFallbackText = buildPlotRawFallbackText_ACU(taskResults);
    const placeholderPattern = /\{\{(\w+)\}\}/g;
    const placeholderNames = [];
    let match;

    while ((match = placeholderPattern.exec(baseDirective)) !== null) {
      placeholderNames.push(match[1]);
    }

    if (aggregatedTags instanceof Map && aggregatedTags.size > 0) {
      if (placeholderNames.length > 0) {
        const matchedTags = new Set();
        const finalDirectiveWithTags = baseDirective.replace(placeholderPattern, (placeholder, tagName) => {
          matchedTags.add(tagName);
          const contents = aggregatedTags.get(tagName);
          if (Array.isArray(contents) && contents.length > 0) {
            return `<${tagName}>${contents.map(content => content ?? '').join('\n\n')}</${tagName}>`;
          }
          return '';
        });

        const unusedTagBlocks = [];
        aggregatedTags.forEach((contents, tagName) => {
          if (matchedTags.has(tagName)) return;
          unusedTagBlocks.push(`<${tagName}>${(Array.isArray(contents) ? contents : [contents]).map(content => content ?? '').join('\n\n')}</${tagName}>`);
        });

        return [finalDirectiveWithTags.trim(), unusedTagBlocks.join('\n\n').trim()]
          .filter(Boolean)
          .join('\n');
      }

      const aggregatedTagBlocks = buildAggregatedPlotTagBlocks_ACU(aggregatedTags);
      return [baseDirective, aggregatedTagBlocks].filter(Boolean).join('\n');
    }

    if (placeholderNames.length > 0) {
      const finalDirectiveWithoutTags = baseDirective.replace(placeholderPattern, '');
      return [finalDirectiveWithoutTags.trim(), rawFallbackText].filter(Boolean).join('\n');
    }

    return [baseDirective, rawFallbackText].filter(Boolean).join('\n');
  }

  function checkPlotAbortRequested_ACU() {
    if (abortController_ACU && abortController_ACU.signal.aborted) {
      throw new Error('TaskAbortedByUser');
    }
  }

  function willPlotUseMainApiGenerateRaw_ACU() {
    try {
      const apiPresetConfig = getApiConfigByPreset_ACU(settings_ACU.plotApiPreset) || {};
      const effectiveApiMode = apiPresetConfig.apiMode ?? settings_ACU.apiMode;
      const effectiveApiConfig = apiPresetConfig.apiConfig || settings_ACU.apiConfig || {};
      return effectiveApiMode !== 'tavern' && !!effectiveApiConfig.useMainApi;
    } catch (e) {
      return settings_ACU.apiMode !== 'tavern' && !!settings_ACU.useMainApi;
    }
  }

  function sortPlotTasksForRuntime_ACU(tasks) {
    return (Array.isArray(tasks) ? [...tasks] : [])
      .filter(Boolean)
      .sort((a, b) => (normalizePositiveInteger_ACU(a?.stage, 1) - normalizePositiveInteger_ACU(b?.stage, 1)) || ((a?.order ?? 0) - (b?.order ?? 0)));
  }

  function groupPlotTasksByStage_ACU(tasks) {
    const stageGroups = [];
    sortPlotTasksForRuntime_ACU(tasks).forEach(task => {
      const stageNo = normalizePositiveInteger_ACU(task?.stage, 1);
      let currentGroup = stageGroups[stageGroups.length - 1];
      if (!currentGroup || currentGroup.stage !== stageNo) {
        currentGroup = { stage: stageNo, tasks: [] };
        stageGroups.push(currentGroup);
      }
      currentGroup.tasks.push(task);
    });
    return stageGroups;
  }

  function getEnabledPlotTasks_ACU(plotSettings) {
    return sortPlotTasksForRuntime_ACU(
      normalizePlotTasks_ACU(plotSettings)
        .filter(task => task && task.enabled !== false),
    );
  }

  async function buildPlotSharedContext_ACU(plotSettings, userMessage, runtimeOptions = {}) {
    const chat = SillyTavern_API_ACU.chat || [];
    const contextTurnCount = plotSettings.contextTurnCount ?? 1;
    let slicedContext = [];

    if (contextTurnCount > 0) {
      let aiCount = 0;
      const extracted = [];

      let i = (chat?.length || 0) - 1;
      if (i >= 0 && chat[i] && chat[i].is_user) {
        if (String(chat[i].mes || '') === String(userMessage || '')) {
          i -= 1;
        }
      }

      for (; i >= 0 && aiCount < contextTurnCount; i--) {
        const msg = chat[i];
        if (!msg) continue;
        if (msg.is_user) continue;
        if (msg._qrf_from_planning) continue;

        let content = msg.mes;
        const extractTags = (plotSettings.contextExtractTags || '').trim();
        const extractRules = normalizeExtractRules_ACU(plotSettings.contextExtractRules, extractTags);
        const excludeTags = (plotSettings.contextExcludeTags || '').trim();
        const excludeRules = normalizeExcludeRules_ACU(plotSettings.contextExcludeRules, excludeTags);
        if (extractTags || extractRules.length > 0 || excludeTags || excludeRules.length > 0) {
          content = applyContextTagFilters_ACU(content, { extractTags, extractRules, excludeTags, excludeRules });
        }

        extracted.unshift({ role: 'assistant', content });
        aiCount++;
      }

      slicedContext = extracted;
    }

    const historyAnchorText = String(runtimeOptions.inputForHash ?? userMessage ?? '');
    const historyLookupOptions = runtimeOptions.hasExistingUserMessage && historyAnchorText.trim()
      ? {
        beforeUserInputHash: hashUserInput_ACU(historyAnchorText),
        beforeUserInputText: historyAnchorText,
      }
      : {};
    const lastPlotContent = getPlotFromHistory_ACU(historyLookupOptions);
    logDebug_ACU('[剧情推进] $6 上轮规划数据:', lastPlotContent ? `长度=${lastPlotContent.length}` : '(空)');

    let worldbookContent = await getWorldbookContentForPlot_ACU(plotSettings, userMessage, lastPlotContent);
    logDebug_ACU('[剧情推进] $1 世界书内容(原始):', worldbookContent ? `长度=${worldbookContent.length}` : '(空)');

    let outlineTableContent = '';
    try {
      if (!currentJsonTableData_ACU || typeof currentJsonTableData_ACU !== 'object') {
        try {
          const merged = await mergeAllIndependentTables_ACU();
          if (merged && typeof merged === 'object') {
            currentJsonTableData_ACU = merged;
          }
        } catch (e) {}
      }
      if (currentJsonTableData_ACU && typeof currentJsonTableData_ACU === 'object') {
        const summaryIndexResult = formatSummaryIndexForPlot_ACU(currentJsonTableData_ACU);
        if (summaryIndexResult.success) {
          outlineTableContent = summaryIndexResult.content;
          logDebug_ACU('[剧情推进] $5 使用纪要表的概要和编码索引列');
        } else {
          logDebug_ACU('[剧情推进] $5 纪要表读取失败，回退使用总体大纲表。原因:', summaryIndexResult.content);
          outlineTableContent = formatOutlineTableForPlot_ACU(currentJsonTableData_ACU);
          logDebug_ACU('[剧情推进] $5 回退使用总体大纲表内容');
        }
      } else {
        outlineTableContent = '纪要索引：当前未加载到数据库数据。';
      }
    } catch (error) {
      logError_ACU('[剧情推进] 生成纪要索引($5)时出错:', error);
      outlineTableContent = '{"error": "加载表格数据时发生错误"}';
    }

    const plotExcludeTags = (plotSettings.contextExcludeTags || '').trim();
    const plotExcludeRules = normalizeExcludeRules_ACU(plotSettings.contextExcludeRules, plotExcludeTags);
    const filterPlotInjectedContent = (value, placeholderKey = '') => {
      const text = value !== undefined && value !== null ? String(value) : '';
      if (!['$1', '$5', '$6', '$7', '$8', '$U', '$C'].includes(placeholderKey)) return text;
      return applyExcludeRulesToText_ACU(text, { excludeRules: plotExcludeRules, excludeTags: plotExcludeTags });
    };

    const sanitizeHtml = htmlString => {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = htmlString;
      return tempDiv.textContent || tempDiv.innerText || '';
    };

    const formattedHistory = (slicedContext && Array.isArray(slicedContext) ? slicedContext : [])
      .map(msg => `assistant："${sanitizeHtml(msg.content)}"`)
      .join(' \n ');

    const contextInjectionText = formattedHistory && formattedHistory.trim()
      ? `以下是前文的故事发展（AI输出），给你用作参考：\n ${formattedHistory}`
      : '';

    let userInfoContent_Plot = '';
    try {
      const stContext = window.SillyTavern?.getContext?.();
      userInfoContent_Plot = stContext?.powerUserSettings?.persona_description
        || window.power_user?.persona_description
        || SillyTavern_API_ACU?.powerUserSettings?.persona_description
        || '';
      logDebug_ACU(`[剧情推进] $U (persona_description) 获取结果: ${userInfoContent_Plot ? '成功' : '为空'}`);
    } catch (e) {
      logWarn_ACU('[剧情推进] 获取用户设定描述时出错:', e);
      userInfoContent_Plot = '';
    }

    let charInfoContent_Plot = '';
    try {
      const stContext = window.SillyTavern?.getContext?.();
      let character = null;
      if (TavernHelper_API_ACU?.getCharData) {
        character = TavernHelper_API_ACU.getCharData('current');
      }
      if (!character) {
        character = SillyTavern_API_ACU?.characters?.[SillyTavern_API_ACU?.this_chid]
          || stContext?.characters?.[stContext?.characterId]
          || (typeof characters !== 'undefined' && typeof this_chid !== 'undefined' ? characters[this_chid] : null);
      }

      charInfoContent_Plot = character?.description
        || character?.data?.description
        || stContext?.name2_description
        || '';
      logDebug_ACU(`[剧情推进] $C (char_description) 获取结果: ${charInfoContent_Plot ? '成功，长度=' + charInfoContent_Plot.length : '为空'}`);
    } catch (e) {
      logWarn_ACU('[剧情推进] 获取角色描述时出错:', e);
      charInfoContent_Plot = '';
    }

    const replacements = {
      sulv1: plotSettings.rateMain,
      sulv2: plotSettings.ratePersonal,
      sulv3: plotSettings.rateErotic,
      sulv4: plotSettings.rateCuckold,
      zhaohui: plotSettings.recallCount,
      $5: outlineTableContent,
      $6: lastPlotContent,
      $7: contextInjectionText,
      $8: userMessage,
      $U: userInfoContent_Plot,
      $C: charInfoContent_Plot,
    };

    const performReplacements = text => {
      if (!text) return '';
      let processed = text;

      const worldbookReplacement = worldbookContent
        ? `\n<worldbook_context>\n${filterPlotInjectedContent(worldbookContent, '$1')}\n</worldbook_context>\n`
        : '';
      processed = processed.replace(/(?<!\\)\$1/g, worldbookReplacement);

      for (const key in replacements) {
        const value = replacements[key];
        const regex = new RegExp(escapeRegExp_ACU(key), 'g');
        const filteredValue = filterPlotInjectedContent(value, key);
        processed = processed.replace(regex, () => filteredValue);
      }
      return processed;
    };

    worldbookContent = await tryRenderPlotTemplateWithEjs_ACU(worldbookContent);
    logDebug_ACU('[剧情推进] $1 世界书内容(渲染后):', worldbookContent ? `长度=${worldbookContent.length}` : '(空)');
    worldbookContent = parseRandomTags_ACU(worldbookContent);
    worldbookContent = replaceRandomVariables_ACU(worldbookContent);

    const defaultDirective = '[SYSTEM_DIRECTIVE: You are a storyteller. The following <plot> block is your absolute script for this turn. You MUST follow the <directive> within it to generate the story.]';
    let finalSystemDirectiveContent = defaultDirective;
    let rawFinal = getPlotPromptContentByIdFromSettings_ACU(plotSettings, 'finalSystemDirective')
      || plotSettings.finalSystemDirective
      || '';
    rawFinal = await tryRenderPlotTemplateWithEjs_ACU(rawFinal);
    const plotFinalDirective = performReplacements(rawFinal);
    let finalWithRandom = parseRandomTags_ACU(plotFinalDirective);
    finalWithRandom = replaceRandomVariables_ACU(finalWithRandom);
    if (finalWithRandom && finalWithRandom.trim()) {
      finalSystemDirectiveContent = finalWithRandom.trim();
    }

    let seedContentForConditional = '';
    try {
      seedContentForConditional = getLatestAIMessageContent_ACU();
      logDebug_ACU('[剧情推进] 条件模板检测内容长度:', seedContentForConditional.length);
    } catch (e) {
      logWarn_ACU('[剧情推进] 准备条件模板检测内容时出错:', e);
    }

    return {
      plotSettings,
      userMessage,
      lastPlotContent,
      performReplacements,
      finalSystemDirectiveContent,
      seedContentForConditional,
      allTablesJson: currentJsonTableData_ACU,
    };
  }

  async function renderPlotTaskMessages_ACU(task, sharedContext, runtimeOptions = {}) {
    const promptGroup = JSON.parse(JSON.stringify(task?.promptGroup || []));
    const messagesToUse = Array.isArray(promptGroup) ? promptGroup : [];

    for (const seg of messagesToUse) {
      if (!seg || typeof seg.content !== 'string') continue;
      let c = seg.content;
      c = await tryRenderPlotTemplateWithEjs_ACU(c);
      c = sharedContext.performReplacements(c);
      const relayTagMap = runtimeOptions.useHistoryRelay
        ? buildPlotTagMapFromText_ACU(sharedContext.lastPlotContent, getPlotPlaceholderTagNames_ACU(c))
        : (runtimeOptions.relayTagMap instanceof Map ? runtimeOptions.relayTagMap : new Map());
      c = replacePlotTagPlaceholders_ACU(c, relayTagMap);
      c = renderPlotTaskContentWithIsolatedVariables_ACU(c, sharedContext);
      seg.__renderedContent = c;
    }

    return messagesToUse
      .filter(seg => seg && typeof seg.__renderedContent === 'string' && seg.__renderedContent.trim().length > 0)
      .map(seg => ({ role: getNormalizedPlotMessageRole_ACU(seg.role), content: seg.__renderedContent }));
  }

  async function executeSinglePlotTask_ACU(task, sharedContext, runtimeOptions = {}) {
    const normalizedTask = normalizePlotTask_ACU(task, { index: task?.order ?? 0, fallbackTask: task || null });
    const taskLabel = normalizedTask.name || normalizedTask.id || '未命名任务';
    const taskStage = normalizePositiveInteger_ACU(normalizedTask.stage, 1);
    const maxRetries = normalizePositiveInteger_ACU(
      normalizedTask.maxRetries,
      sharedContext?.plotSettings?.loopSettings?.maxRetries ?? DEFAULT_PLOT_SETTINGS_ACU.loopSettings?.maxRetries ?? 3,
    );
    const minLength = normalizeNonNegativeInteger_ACU(normalizedTask.minLength, 0);

    try {
      checkPlotAbortRequested_ACU();
      const messages = await renderPlotTaskMessages_ACU(normalizedTask, sharedContext, runtimeOptions);
      checkPlotAbortRequested_ACU();

      if (!messages.length) {
        return {
          taskId: normalizedTask.id,
          taskName: taskLabel,
          success: false,
          rawResponse: '',
          extractedTags: {},
          injectedFragments: [],
          error: '任务未生成任何有效提示词消息。',
          stage: taskStage,
          order: normalizedTask.order ?? 0,
        };
      }

      let rawResponse = '';
      let lastErrorMessage = '';

      for (let attemptIndex = 0; attemptIndex < maxRetries; attemptIndex++) {
        checkPlotAbortRequested_ACU();

        if (runtimeOptions.willUseMainApiGenerateRaw) {
          planningGuard_ACU.ignoreNextGenerationEndedCount++;
        }

        let tempMessage = null;
        let apiError = null;
        try {
          tempMessage = await callApi_ACU(messages, settings_ACU, abortController_ACU?.signal || null);
        } catch (apiCallError) {
          if (apiCallError?.name === 'AbortError' || String(apiCallError?.message || '').toLowerCase().includes('aborted')) {
            throw apiCallError;
          }
          apiError = apiCallError;
          lastErrorMessage = apiCallError?.message || 'API调用失败';
          logWarn_ACU(`[剧情推进] [阶段:${taskStage}] [任务:${taskLabel}] 第 ${attemptIndex + 1} 次API调用失败:`, lastErrorMessage);
        }

        checkPlotAbortRequested_ACU();

        if (!apiError && tempMessage) {
          if (minLength <= 0 || tempMessage.length >= minLength) {
            rawResponse = tempMessage;
            logDebug_ACU(`[剧情推进] [阶段:${taskStage}] [任务:${taskLabel}] 在第 ${attemptIndex + 1} 次尝试中成功完成。`);
            break;
          }
          lastErrorMessage = `回复长度不足（${tempMessage.length}/${minLength}）`;
          logWarn_ACU(`[剧情推进] [阶段:${taskStage}] [任务:${taskLabel}] 第 ${attemptIndex + 1} 次回复过短: ${tempMessage.length}/${minLength}`);
        }

        if (attemptIndex < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
      }

      if (!rawResponse) {
        return {
          taskId: normalizedTask.id,
          taskName: taskLabel,
          success: false,
          rawResponse: '',
          extractedTags: {},
          injectedFragments: [],
          error: lastErrorMessage || '任务在最大重试次数后仍未返回有效结果。',
          stage: taskStage,
          order: normalizedTask.order ?? 0,
        };
      }

      const { tagNames, extractedTags, injectedFragments } = extractPlotTagsFromResponse_ACU(rawResponse, normalizedTask.extractTags);
      if (tagNames.length > 0 && Object.keys(extractedTags).length > 0) {
        logDebug_ACU(`[剧情推进] [阶段:${taskStage}] [任务:${taskLabel}] 成功摘取标签: ${Object.keys(extractedTags).join(', ')}`);
      }

      return {
        taskId: normalizedTask.id,
        taskName: taskLabel,
        success: true,
        rawResponse,
        extractedTags,
        injectedFragments,
        error: null,
        stage: taskStage,
        order: normalizedTask.order ?? 0,
      };
    } catch (error) {
      if (error?.message === 'TaskAbortedByUser' || error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted')) {
        throw error;
      }
      logError_ACU(`[剧情推进] [阶段:${taskStage}] [任务:${taskLabel}] 执行失败:`, error);
      return {
        taskId: normalizedTask.id,
        taskName: taskLabel,
        success: false,
        rawResponse: '',
        extractedTags: {},
        injectedFragments: [],
        error: error?.message || '任务执行失败。',
        stage: taskStage,
        order: normalizedTask.order ?? 0,
      };
    }
  }

  async function runPlotTasksRuntime_ACU(plotSettings, userMessage, runtimeOptions = {}) {
    const { inputForHash = userMessage, $toast = null, hasExistingUserMessage = false } = runtimeOptions;

    ensurePlotTasksCompat_ACU(plotSettings, { syncLegacy: true });

    const enabledTasks = getEnabledPlotTasks_ACU(plotSettings);
    if (!enabledTasks.length) {
      logWarn_ACU('[剧情推进] 当前没有可执行的启用任务。');
      return {
        finalMessage: null,
        successfulResults: [],
        failedResults: [],
        aggregatedTags: new Map(),
        enabledTaskCount: 0,
      };
    }

    const stageGroups = groupPlotTasksByStage_ACU(enabledTasks);

    try {
      if ($toast?.find) {
        $toast.find('.toastr-message').text(`正在读取过往的记忆并分析，请稍后...（共 ${enabledTasks.length} 个任务，${stageGroups.length} 个阶段）`);
      }
    } catch (e) {}

    const sharedContext = await buildPlotSharedContext_ACU(plotSettings, userMessage, {
      inputForHash,
      hasExistingUserMessage,
    });
    checkPlotAbortRequested_ACU();

    const willUseMainApiGenerateRaw = willPlotUseMainApiGenerateRaw_ACU();
    const successfulResults = [];
    const failedResults = [];
    let aggregatedTags = new Map();

    for (let stageIndex = 0; stageIndex < stageGroups.length; stageIndex++) {
      const stageGroup = stageGroups[stageIndex];
      try {
        if ($toast?.find) {
          $toast.find('.toastr-message').text(`正在读取过往的记忆并分析，请稍后...（第 ${stageIndex + 1}/${stageGroups.length} 阶段，阶段号 ${stageGroup.stage}，本阶段 ${stageGroup.tasks.length} 个任务）`);
        }
      } catch (e) {}

      const stageResults = await Promise.all(
        stageGroup.tasks.map(task =>
          executeSinglePlotTask_ACU(task, sharedContext, {
            willUseMainApiGenerateRaw,
            relayTagMap: aggregatedTags,
            useHistoryRelay: stageIndex === 0,
          }),
        ),
      );
      checkPlotAbortRequested_ACU();

      const stageSuccessfulResults = stageResults.filter(result => result?.success);
      const stageFailedResults = stageResults.filter(result => result && !result.success);
      successfulResults.push(...stageSuccessfulResults);
      failedResults.push(...stageFailedResults);

      if (stageFailedResults.length > 0) {
        stageFailedResults.forEach(result => {
          logWarn_ACU(
            `[剧情推进] [阶段:${result.stage ?? stageGroup.stage}] [任务:${result.taskName || result.taskId || '未命名任务'}] 未产出有效结果: ${result.error || '未知错误'}`,
          );
        });
        const failedTaskNames = stageFailedResults.map(result => result.taskName || result.taskId || '未命名任务').join('、');
        return {
          finalMessage: null,
          successfulResults,
          failedResults,
          aggregatedTags,
          enabledTaskCount: enabledTasks.length,
          abortedByStageFailure: true,
          failedStage: stageGroup.stage,
          errorMessage: `剧情任务阶段 ${stageGroup.stage} 执行失败（${failedTaskNames}），后续阶段已停止。`,
        };
      }

      aggregatedTags = aggregatePlotTaskTags_ACU(successfulResults);
      logDebug_ACU(`[剧情推进] 阶段 ${stageGroup.stage} 已完成，成功任务数: ${stageSuccessfulResults.length}`);
    }

    if (!successfulResults.length) {
      return {
        finalMessage: null,
        successfulResults,
        failedResults,
        aggregatedTags: new Map(),
        enabledTaskCount: enabledTasks.length,
      };
    }

    const saveContent = buildPlotSaveContentFromTaskResults_ACU(successfulResults);
    const userInputHash = hashUserInput_ACU(inputForHash);
    tempPlotToSave_ACU = {
      content: saveContent,
      userInputHash,
      userInputText: inputForHash,
    };
    logDebug_ACU('[剧情推进] [Plot] 已暂存plot数据，用户输入哈希:', userInputHash, '，原始文本长度:', inputForHash?.length || 0);

    const finalMessage = buildFinalPlotInjectionMessage_ACU(
      sharedContext.finalSystemDirectiveContent,
      successfulResults,
      aggregatedTags,
    );

    await savePlotToLatestMessage_ACU(true);

    return {
      finalMessage,
      successfulResults,
      failedResults,
      aggregatedTags,
      enabledTaskCount: enabledTasks.length,
    };
  }

  /**
   * 加载上次使用的预设到全局设置，并清除当前角色卡上冲突的陈旧设置。
   * 这是为了确保在切换角色或新开对话时，预设能够被正确应用，而不是被角色卡上的"幽灵数据"覆盖。
   */
  async function loadPresetAndCleanCharacterData_ACU() {
    const plotSettings = settings_ACU.plotSettings;
    if (!plotSettings) return;

    ensurePlotTasksCompat_ACU(plotSettings, { syncLegacy: true });
    ensurePlotPresetBindingsStore_ACU();

    const chatScopeState = getCurrentChatPlotScopeState_ACU();
    if (chatScopeState?.snapshot) {
      logDebug_ACU(`[剧情推进] Applying chat override snapshot for chat "${currentChatFileIdentifier_ACU || 'unknown'}".`);
      replaceCurrentPlotSettingsWithSnapshot_ACU(plotSettings, chatScopeState.snapshot);
      currentPlotTaskEditorId_ACU = '';
      syncCurrentEditablePlotPresetState_ACU({ source: 'load_chat_override' });

      if (clearPlotPresetBindingForChat_ACU(currentChatFileIdentifier_ACU)) {
        logDebug_ACU('[剧情推进] Cleared legacy plotPresetBindings entry because chat metadata override is authoritative.');
      }

      saveSettings_ACU();
      if ($popupInstance_ACU) {
        loadPlotSettingsToUI_ACU();
      }
      logDebug_ACU('[剧情推进] Chat override snapshot restored from chat history.');
      return;
    }

    let globalPresetName = normalizePlotPresetSelectionValue_ACU(plotSettings.lastUsedPresetName || '');
    let globalPresetToLoad = findPlotPresetByName_ACU(globalPresetName);
    if (globalPresetName && !globalPresetToLoad) {
      logWarn_ACU(`[剧情推进] Global preset "${globalPresetName}" no longer exists. Falling back to default preset.`);
      globalPresetName = '';
      plotSettings.lastUsedPresetName = '';
    }

    const legacyBinding = getPlotPresetBindingForChat_ACU();
    if (legacyBinding) {
      const legacyPresetName = normalizePlotPresetSelectionValue_ACU(legacyBinding.presetName || '');
      const bindingMatchesGlobal = legacyPresetName === globalPresetName;
      const bindingIsImplicitInherit = legacyBinding.isExplicit !== true || legacyBinding.source === 'inherit';

      if (bindingIsImplicitInherit || bindingMatchesGlobal) {
        if (clearPlotPresetBindingForChat_ACU(currentChatFileIdentifier_ACU)) {
          logDebug_ACU('[剧情推进] Cleared legacy inherit-style plot preset binding for current chat.');
        }
      } else {
        const legacyPresetToLoad = findPlotPresetByName_ACU(legacyPresetName);
        const canMigrateToChatSnapshot = isDefaultPlotPresetSelection_ACU(legacyPresetName) || !!legacyPresetToLoad;

        if (canMigrateToChatSnapshot) {
          if (legacyPresetToLoad) {
            logDebug_ACU(`[剧情推进] Migrating legacy binding to chat snapshot for chat "${currentChatFileIdentifier_ACU || 'unknown'}": "${legacyPresetName}"`);
            applyPlotPresetToSettings_ACU(plotSettings, legacyPresetToLoad);
          } else {
            logDebug_ACU(`[剧情推进] Migrating legacy default binding to chat snapshot for chat "${currentChatFileIdentifier_ACU || 'unknown'}".`);
            resetPlotSettingsToDefault_ACU(plotSettings);
          }

          currentPlotTaskEditorId_ACU = '';
          const migratedScopeState = buildChatPlotScopeStateFromSettings_ACU(plotSettings, {
            presetName: legacyPresetName,
            source: `legacy_binding_${legacyBinding.source || 'inherit'}`,
            originGlobalName: globalPresetName,
            originGlobalRevision: getPlotGlobalRevision_ACU(),
            updatedAt: legacyBinding.updatedAt || Date.now(),
          });

          if (migratedScopeState) {
            setCurrentChatPlotScopeState_ACU(migratedScopeState, { reason: 'migrate_legacy_plot_binding' });
            clearPlotPresetBindingForChat_ACU(currentChatFileIdentifier_ACU);
            syncCurrentEditablePlotPresetState_ACU({ source: 'migrate_legacy_plot_binding' });
            saveSettings_ACU();

            if (typeof SillyTavern_API_ACU?.saveChat === 'function') {
              try {
                await SillyTavern_API_ACU.saveChat();
              } catch (error) {
                logWarn_ACU('[剧情推进] 保存迁移后的聊天级剧情推进快照失败:', error);
              }
            }

            if ($popupInstance_ACU) {
              loadPlotSettingsToUI_ACU();
            }

            logDebug_ACU('[剧情推进] Legacy plotPresetBindings entry migrated to chat metadata snapshot.');
            return;
          }
        }

        logWarn_ACU(`[剧情推进] Legacy binding preset "${legacyPresetName}" could not be migrated. Falling back to inherit global/default.`);
        clearPlotPresetBindingForChat_ACU(currentChatFileIdentifier_ACU);
      }
    }

    if (globalPresetToLoad) {
      logDebug_ACU(`[剧情推进] Applying inherited global preset for chat "${currentChatFileIdentifier_ACU || 'unknown'}": "${globalPresetName}"`);
      applyPlotPresetToSettings_ACU(plotSettings, globalPresetToLoad);
    } else {
      logDebug_ACU(`[剧情推进] Applying inherited default preset for chat "${currentChatFileIdentifier_ACU || 'unknown'}".`);
      resetPlotSettingsToDefault_ACU(plotSettings);
    }

    currentPlotTaskEditorId_ACU = '';
    syncCurrentEditablePlotPresetState_ACU({ source: globalPresetToLoad ? 'load_inherit_global' : 'load_inherit_default' });
    saveSettings_ACU();

    if ($popupInstance_ACU) {
      loadPlotSettingsToUI_ACU();
    }

    logDebug_ACU('[剧情推进] Current chat is inheriting the active global plot preset state.');
  }

  /**
   * 开始自动化循环
   */
  async function startAutoLoop_ACU() {
    const plotSettings = settings_ACU.plotSettings;
    
    // 确保循环提示词格式正确（兼容旧版本）
    ensureLoopPromptsArray_ACU(plotSettings);
    
    const loopSettings = plotSettings.loopSettings;
    const loopDuration = (loopSettings.loopTotalDuration || 0) * 60 * 1000;

    // 检查是否有有效的提示词
    if (!loopSettings.quickReplyContent || !Array.isArray(loopSettings.quickReplyContent) || loopSettings.quickReplyContent.length === 0) {
      showToastr_ACU('error', '请先添加至少一个循环提示词', '无法启动循环');
      stopAutoLoop_ACU();
      return;
    }
    
    // 重置索引到第一个
    loopSettings.currentPromptIndex = 0;

    if (loopDuration <= 0) {
        showToastr_ACU('error', '请设置有效的总倒计时 (大于0分钟)', '无法启动循环');
        stopAutoLoop_ACU();
        return;
    }

    loopState_ACU.isLooping = true;
    loopState_ACU.isRetrying = false; // 初始状态非重试
    loopState_ACU.startTime = Date.now();
    loopState_ACU.totalDuration = loopDuration;
    loopState_ACU.retryCount = 0; // 重置重试计数

    logDebug_ACU('[剧情推进] Auto Loop Started. Duration: ' + loopDuration + 'ms');

    // 更新UI状态
    updateLoopUIStatus_ACU(true);

    // 启动倒计时更新
    loopState_ACU.tickInterval = setInterval(() => {
        const elapsed = Date.now() - loopState_ACU.startTime;
        const remaining = Math.max(0, loopState_ACU.totalDuration - elapsed);

        if (remaining <= 0) {
            stopAutoLoop_ACU();
            showToastr_ACU('info', '总倒计时结束，自动化循环已停止。', '循环结束');
            return;
        }

        // 格式化剩余时间 mm:ss
        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);
        const formatted = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        // 更新倒计时显示
        updateLoopTimerDisplay_ACU(formatted);
    }, 1000);

    // 立即触发一次生成
    triggerLoopGeneration_ACU();
  }

  /**
   * 更新循环UI状态
   */
  function updateLoopUIStatus_ACU(isRunning) {
    if (!$popupInstance_ACU) return;
    const $startBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-start-loop-btn`);
    const $stopBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-stop-loop-btn`);
    const $statusText = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-status-text`);
    const $timerDisplay = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-timer-display`);

    if (isRunning) {
      $startBtn.hide();
      $stopBtn.css('display', 'inline-flex').show();
      $statusText.text('运行中').css('color', 'var(--green, #4CAF50)');
      $timerDisplay.show();
    } else {
      $stopBtn.hide();
      $startBtn.css('display', 'inline-flex').show();
      $statusText.text('已停止').css('color', 'var(--red, #f44336)');
      $timerDisplay.hide().text('');
    }
  }

  /**
   * 更新循环倒计时显示
   */
  function updateLoopTimerDisplay_ACU(timeLeftFormatted) {
    if (!$popupInstance_ACU) return;
    $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-timer-display`).text(`(剩余: ${timeLeftFormatted})`);
  }

  /**
   * 停止自动化循环
   */
  function stopAutoLoop_ACU() {
    loopState_ACU.isLooping = false;
    loopState_ACU.isRetrying = false; // 确保停止时重置重试状态
    loopState_ACU.awaitingReply = false;
    if (loopState_ACU.timerId) {
      clearTimeout(loopState_ACU.timerId);
      loopState_ACU.timerId = null;
    }
    if (loopState_ACU.tickInterval) {
        clearInterval(loopState_ACU.tickInterval);
        loopState_ACU.tickInterval = null;
    }
    // 更新UI状态
    updateLoopUIStatus_ACU(false);
    logDebug_ACU('[剧情推进] Auto Loop Stopped.');
  }

  /**
   * 触发循环中的单次生成
   */
  async function triggerLoopGeneration_ACU() {
    if (!loopState_ACU.isLooping) return;

    const plotSettings = settings_ACU.plotSettings;
    ensureLoopPromptsArray_ACU(plotSettings);
    
    const loopSettings = plotSettings.loopSettings;
    const prompts = loopSettings.quickReplyContent || [];

    if (!prompts || prompts.length === 0) {
      logWarn_ACU('[剧情推进] Loop prompts array is empty, stopping loop.');
      stopAutoLoop_ACU();
      return;
    }

    // 获取当前提示词（循环使用）
    const currentIndex = loopSettings.currentPromptIndex || 0;
    const quickReplyContent = prompts[currentIndex] || prompts[0];
    
    if (!quickReplyContent || !quickReplyContent.trim()) {
      logWarn_ACU('[剧情推进] Current prompt is empty, stopping loop.');
      stopAutoLoop_ACU();
      return;
    }

    // 更新索引，为下次循环做准备（循环到下一个提示词）
    loopSettings.currentPromptIndex = (currentIndex + 1) % prompts.length;
    
    logDebug_ACU(`[剧情推进] 使用提示词 ${currentIndex + 1}/${prompts.length}: ${quickReplyContent.substring(0, 50)}...`);

    // 模拟用户输入并发送
    loopState_ACU.awaitingReply = true;
    jQuery_API_ACU('#send_textarea').val(quickReplyContent);
    jQuery_API_ACU('#send_textarea').trigger('input');

    // 给一点时间让UI更新，然后点击发送
    setTimeout(() => {
      if (loopState_ACU.isLooping) {
          jQuery_API_ACU('#send_but').click();
      }
    }, 100);
  }

  /**
   * 验证AI回复是否包含所需标签
   * @param {string} content - AI回复内容
   * @param {string} tags - 逗号分隔的标签列表
   * @returns {boolean} - 是否验证通过
   */
  function validateLoopTags_ACU(content, tags) {
      if (!tags || !tags.trim()) return true; // 如果未设置标签，默认通过

      const tagList = tags.split(/[,，]/).map(t => t.trim()).filter(t => t);
      if (tagList.length === 0) return true;

      for (const tag of tagList) {
          if (!content.includes(tag)) {
              logDebug_ACU(`[剧情推进] Loop validation failed: missing tag "${tag}"`);
              return false;
          }
      }
      return true;
  }

  async function triggerDirectRegenerateForLoop_ACU(loopSettings) {
    // 标记：本轮依然在等待回复（重试）
    loopState_ACU.awaitingReply = true;

    // 使用酒馆正规生成入口触发回复，确保消息入库+渲染
    if (window.TavernHelper?.triggerSlash) {
      await window.TavernHelper.triggerSlash('/trigger await=true');
      return;
    }
    if (window.original_TavernHelper_generate) {
      window.original_TavernHelper_generate({ user_input: '' });
      return;
    }
    window.TavernHelper?.generate?.({ user_input: '' });
  }

  async function enterLoopRetryFlow_ACU({ loopSettings, shouldDeleteAiReply }) {
    loopState_ACU.isRetrying = true;
    loopState_ACU.retryCount++;
    const maxRetries = loopSettings.maxRetries ?? 3;

    logDebug_ACU(`[剧情推进] 进入重试流程: ${loopState_ACU.retryCount}/${maxRetries}.`);

    if (loopState_ACU.retryCount > maxRetries) {
      showToastr_ACU('error', `连续失败超过 ${maxRetries} 次，自动化循环已停止。`, '循环中止');
      stopAutoLoop_ACU();
      return;
    }

    // 需要删除AI楼层时，先删最后一条（仅当最后一条确实是AI）
    if (shouldDeleteAiReply) {
      const chat = SillyTavern_API_ACU.chat;
      const last = chat?.length ? chat[chat.length - 1] : null;
      if (last && !last.is_user) {
        logDebug_ACU('[剧情推进] [重试] 删除缺失标签的AI楼层...');
        try {
          if (typeof SillyTavern_API_ACU.deleteLastMessage === 'function') {
            await SillyTavern_API_ACU.deleteLastMessage();
          } else if (window.SillyTavern?.deleteLastMessage) {
            await window.SillyTavern.deleteLastMessage();
          }
        } catch (e) {
          logError_ACU('[剧情推进] 删除楼层失败:', e);
        }
      } else {
        logDebug_ACU('[剧情推进] [重试] 不需要删除：最新楼层不是AI。');
      }
    }

    // 延迟后重试生成
    loopState_ACU.timerId = setTimeout(async () => {
      // 等待系统空闲
      let busyWait = 0;
      while (window.SillyTavern?.generating && busyWait < 20) {
        await new Promise(r => setTimeout(r, 500));
        busyWait++;
      }
      try {
        await triggerDirectRegenerateForLoop_ACU(loopSettings);
      } catch (err) {
        logError_ACU('[剧情推进] [重试] 触发生成失败:', err);
        // 如果仍在循环中，则按重试逻辑继续（不删除楼层，因为没有生成成功）
        if (loopState_ACU.isLooping) {
          await enterLoopRetryFlow_ACU({ loopSettings, shouldDeleteAiReply: false });
        }
      }
    }, (loopSettings.retryDelay || 3) * 1000);
  }

  /**
   * 循环逻辑的核心事件监听器：生成结束时触发
   */
  async function onLoopGenerationEnded_ACU() {
    if (!loopState_ACU.isLooping) return;
    if (!loopState_ACU.awaitingReply) return;

    // 忽略规划阶段触发的生成结束事件
    if (planningGuard_ACU.inProgress) {
      logDebug_ACU('[剧情推进] [Loop] Planning in progress, ignoring GENERATION_ENDED.');
      return;
    }
    if (planningGuard_ACU.ignoreNextGenerationEndedCount > 0) {
      planningGuard_ACU.ignoreNextGenerationEndedCount--;
      logDebug_ACU(`[剧情推进] [Loop] Ignoring planning-triggered GENERATION_ENDED (${planningGuard_ACU.ignoreNextGenerationEndedCount} left).`);
      return;
    }

    // 等待一下让消息同步
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!loopState_ACU.isLooping || !loopState_ACU.awaitingReply) return;

    const loopSettings = settings_ACU.plotSettings.loopSettings || DEFAULT_PLOT_SETTINGS_ACU.loopSettings;
    const chat = SillyTavern_API_ACU.chat;

    if (!chat || chat.length === 0) return;

    // 获取最新消息
    let lastMessage = chat[chat.length - 1];

    // 如果最新消息是用户消息，且带有规划标记，说明这是规划层，应该忽略
    if (lastMessage.is_user && lastMessage._qrf_from_planning) {
      logDebug_ACU('[剧情推进] [Loop] 检测到规划层(user with _qrf_from_planning)，忽略，继续等待AI回复。');
      return;
    }

    // 如果依然是用户消息（但没有规划标记），说明生成未产生有效AI回复，视为验证失败
    if (lastMessage.is_user) {
      logWarn_ACU('[剧情推进] [Loop] 生成结束但最后一条是用户消息（无规划标记），等待2s后重试检测...');
      await new Promise(resolve => setTimeout(resolve, 2000));
      const updatedChat = SillyTavern_API_ACU.chat;
      lastMessage = updatedChat?.length ? updatedChat[updatedChat.length - 1] : null;
    }

    // 如果还是没有AI回复，进入重试
    if (!lastMessage || lastMessage.is_user) {
      logWarn_ACU('[剧情推进] [Loop] 未找到AI回复楼层，进入重试。');
      loopState_ACU.awaitingReply = false; // 本次检测结束
      await enterLoopRetryFlow_ACU({ loopSettings, shouldDeleteAiReply: false });
      return;
    }

    // 忽略来自其他扩展 / 虚拟角色的 AI 回复
    const activeChar = SillyTavern_API_ACU.characters?.[SillyTavern_API_ACU.this_chid];
    const activeCharName = activeChar?.name;
    if (activeCharName && lastMessage.name && lastMessage.name !== activeCharName) {
      logDebug_ACU(
        `[剧情推进] [Loop] 检测到来自其他角色/扩展的AI回复(name=${lastMessage.name})，与当前角色(${activeCharName})不符，忽略本次 GENERATION_ENDED。`
      );
      return;
    }

    // 进行标签检测
    const ok = validateLoopTags_ACU(lastMessage.mes, loopSettings.loopTags);
    if (ok) {
      logDebug_ACU('[剧情推进] 标签检测通过。继续循环。');
      loopState_ACU.isRetrying = false;
      loopState_ACU.retryCount = 0;
      loopState_ACU.awaitingReply = false;
      // 通过后等待 loopDelay 再进入下一轮
      loopState_ACU.timerId = setTimeout(() => {
        triggerLoopGeneration_ACU();
      }, (loopSettings.loopDelay || 5) * 1000);
      return;
    }

    // 标签检测未通过，进入重试
    logDebug_ACU('[剧情推进] 标签检测未通过。进入重试。');
    loopState_ACU.awaitingReply = false; // 本次检测结束
    await enterLoopRetryFlow_ACU({ loopSettings, shouldDeleteAiReply: true });
  }

  /**
   * 从聊天记录中反向查找最新的plot。
   * @param {Object} options - 检索选项
   * @param {number} [options.beforeIndex] - 仅检索该索引之前的消息（不含该索引）
   * @param {string} [options.beforeUserInputHash] - 作为当前用户楼层锚点的原始输入哈希
   * @param {string} [options.beforeUserInputText] - 作为当前用户楼层锚点的原始输入文本
   * @returns {string} - 返回找到的plot文本，否则返回空字符串。
   */
  function findPlotHistoryAnchorIndex_ACU(chat, options = {}) {
    if (!Array.isArray(chat) || chat.length === 0) return -1;
    const beforeUserInputHash = String(options?.beforeUserInputHash || '').trim();
    const beforeUserInputText = String(options?.beforeUserInputText || '');
    if (!beforeUserInputHash && !beforeUserInputText.trim()) return -1;

    for (let i = chat.length - 1; i >= 0; i--) {
      const message = chat[i];
      if (!message?.is_user) continue;
      if (beforeUserInputHash && message._qrf_plot_pending_hash === beforeUserInputHash) {
        return i;
      }
      const messageText = String(message.mes || '');
      if (beforeUserInputHash && hashUserInput_ACU(messageText) === beforeUserInputHash) {
        return i;
      }
      if (!beforeUserInputHash && beforeUserInputText && messageText === beforeUserInputText) {
        return i;
      }
    }

    return -1;
  }

  function getPlotHistorySearchUpperBound_ACU(chat, options = {}) {
    if (!Array.isArray(chat) || chat.length === 0) return -1;

    if (Number.isFinite(options?.beforeIndex)) {
      return Math.min(chat.length - 1, Math.floor(options.beforeIndex) - 1);
    }

    const anchorIndex = findPlotHistoryAnchorIndex_ACU(chat, options);
    if (anchorIndex >= 0) {
      return anchorIndex - 1;
    }

    return chat.length - 1;
  }

  function getPlotFromHistory_ACU(options = {}) {
    const chat = SillyTavern_API_ACU.chat;
    logDebug_ACU('[剧情推进] [Plot] getPlotFromHistory_ACU 被调用，聊天记录长度:', chat?.length || 0, '，检索选项:', options || {});
    if (!chat || chat.length === 0) {
      logDebug_ACU('[剧情推进] [Plot] 聊天记录为空');
      return '';
    }

    const currentPresetName = getCurrentRuntimePlotPresetName_ACU({ fallbackToGlobal: true });
    logDebug_ACU('[剧情推进] [Plot] 当前聊天实际预设名称:', currentPresetName || '(默认预设)');

    const upperBound = getPlotHistorySearchUpperBound_ACU(chat, options);
    if (upperBound < 0) {
      logDebug_ACU('[剧情推进] [Plot] 当前楼层之前没有更早的用户消息或可检索范围为空，返回空字符串');
      return '';
    }

    let latestPlotContent = '';
    let latestPlotIndex = -1;

    for (let i = upperBound; i >= 0; i--) {
      const message = chat[i];
      if (message && message.qrf_plot) {
        const plotPresetName = message.qrf_plot_preset || '';

        if (currentPresetName === '') {
          latestPlotContent = message.qrf_plot;
          latestPlotIndex = i;
          logDebug_ACU(`[剧情推进] [Plot] (无预设模式) ✓ 在消息 ${i} 找到最新的plot数据，检索上界: ${upperBound}`);
          break;
        }

        if (plotPresetName === currentPresetName) {
          latestPlotContent = message.qrf_plot;
          latestPlotIndex = i;
          logDebug_ACU(`[剧情推进] [Plot] ✓ 在消息 ${i} (is_user=${message.is_user}) 找到精确匹配预设 "${currentPresetName}" 的plot数据，检索上界: ${upperBound}`);
          break;
        }
      }
    }

    if (!latestPlotContent && currentPresetName !== '') {
      logDebug_ACU(`[剧情推进] [Plot] 未找到精确匹配预设 "${currentPresetName}" 的数据，尝试在上界 ${upperBound} 之前寻找无标签旧数据...`);
      for (let i = upperBound; i >= 0; i--) {
        const message = chat[i];
        if (message && message.qrf_plot) {
          const plotPresetName = message.qrf_plot_preset || '';
          if (plotPresetName === '') {
            latestPlotContent = message.qrf_plot;
            latestPlotIndex = i;
            logDebug_ACU(`[剧情推进] [Plot] (兼容模式) ✓ 在消息 ${i} 找到无标签的旧plot数据作为回退，检索上界: ${upperBound}`);
            break;
          }
        }
      }
    }

    if (latestPlotContent) {
      logDebug_ACU(`[剧情推进] [Plot] 返回匹配预设 "${currentPresetName || '(无)'}" 的最新剧情规划数据，消息索引: ${latestPlotIndex}, 检索上界: ${upperBound}, 长度: ${latestPlotContent.length}`);
      return latestPlotContent;
    }

    logDebug_ACU(`[剧情推进] [Plot] 未找到匹配预设 "${currentPresetName || '(无)'}" 的plot数据，检索上界: ${upperBound}`);
    return '';
  }

  /**
   * 生成用户输入文本的哈希值，用于精确匹配目标消息
   * 归一化处理：去除首尾空白，统一换行符
   */
  function hashUserInput_ACU(text) {
    if (!text) return '';
    // 归一化：去除首尾空白，统一换行符为 \n
    const normalized = String(text).trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    // 使用简单的哈希算法（FNV-1a变体）
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    }
    return hash.toString(36);
  }

  /**
   * 将plot附加到对应的用户消息上。
   * 使用用户输入文本哈希精确匹配，避免保存到错误的楼层。
   */
  async function savePlotToLatestMessage_ACU(force = false) {
    logDebug_ACU('[剧情推进] [Plot] savePlotToLatestMessage_ACU 被调用');
    logDebug_ACU('[剧情推进] [Plot] planningGuard_ACU.inProgress:', planningGuard_ACU.inProgress);
    logDebug_ACU('[剧情推进] [Plot] planningGuard_ACU.ignoreNextGenerationEndedCount:', planningGuard_ACU.ignoreNextGenerationEndedCount);
    logDebug_ACU('[剧情推进] [Plot] tempPlotToSave_ACU:', tempPlotToSave_ACU ? (typeof tempPlotToSave_ACU === 'string' ? `长度=${tempPlotToSave_ACU.length}` : `content长度=${tempPlotToSave_ACU.content?.length}, hash=${tempPlotToSave_ACU.userInputHash}`) : '(空)');

    // 忽略规划阶段触发的生成结束事件，避免把 plot 附加到错误楼层
    if (!force && planningGuard_ACU.inProgress) {
      logDebug_ACU('[剧情推进] [Plot] Planning in progress, ignoring GENERATION_ENDED.');
      return;
    }
    if (planningGuard_ACU.ignoreNextGenerationEndedCount > 0) {
      planningGuard_ACU.ignoreNextGenerationEndedCount--;
      logDebug_ACU(`[剧情推进] [Plot] Ignoring planning-triggered GENERATION_ENDED (${planningGuard_ACU.ignoreNextGenerationEndedCount} left).`);
      return;
    }

    if (!tempPlotToSave_ACU) {
      logDebug_ACU('[剧情推进] [Plot] tempPlotToSave_ACU 为空，无需保存');
      return;
    }

    // [兼容性] 处理旧格式（字符串）和新格式（对象）
    let plotContent, userInputHash, userInputText;
    if (typeof tempPlotToSave_ACU === 'string') {
      // 旧格式：只有内容，没有哈希（向后兼容）
      plotContent = tempPlotToSave_ACU;
      userInputHash = null;
      userInputText = null;
      logDebug_ACU('[剧情推进] [Plot] 检测到旧格式数据，使用回退匹配逻辑');
    } else {
      // 新格式：包含内容和用户输入哈希
      plotContent = tempPlotToSave_ACU.content;
      userInputHash = tempPlotToSave_ACU.userInputHash;
      userInputText = tempPlotToSave_ACU.userInputText;
      logDebug_ACU('[剧情推进] [Plot] 使用新格式，用户输入哈希:', userInputHash, '，原始文本长度:', userInputText?.length || 0);
    }

    if (!plotContent) {
      logWarn_ACU('[剧情推进] [Plot] plotContent 为空，无法保存');
      tempPlotToSave_ACU = null;
      return;
    }

    // [优化] 使用轮询等待机制，确保用户楼层已写入chat数组
    const MAX_POLL_ATTEMPTS = 20; // 最多轮询20次（2秒）
    const POLL_INTERVAL_MS = 100; // 每100ms轮询一次
    let pollAttempts = 0;
    let target = null;

    const tryFindTarget = () => {
      const chat = SillyTavern_API_ACU.chat;
      if (!chat || chat.length === 0) {
        return null;
      }

      // [精确匹配] 优先使用用户输入文本哈希匹配
      if (userInputHash) {
        for (let i = chat.length - 1; i >= 0; i--) {
          const msg = chat[i];
          if (msg && msg.is_user) {
            // [优化] 优先检查消息对象上保存的原始输入哈希（策略1场景）
            if (msg._qrf_plot_pending_hash === userInputHash) {
              // 找到匹配的消息，清理临时标记
              delete msg._qrf_plot_pending_hash;
              if (!msg.qrf_plot) {
                logDebug_ACU(`[剧情推进] [Plot] ✓ 通过消息对象上的哈希标记找到目标用户消息（索引 ${i}，哈希: ${userInputHash}）`);
                return { msg, index: i };
              } else {
                logDebug_ACU(`[剧情推进] [Plot] 索引 ${i} 的消息哈希标记匹配但已有plot，继续查找`);
              }
            }
            
            // [回退] 如果消息对象上没有哈希标记，尝试计算当前消息文本的哈希（策略2场景）
            const msgText = msg.mes || '';
            const msgHash = hashUserInput_ACU(msgText);
            
            // 精确匹配哈希
            if (msgHash === userInputHash) {
              // 额外检查：如果该消息已有plot，且不是本次规划的目标，跳过（可能是重复文本）
              // 但如果该消息没有plot，则一定是目标
              if (!msg.qrf_plot) {
                logDebug_ACU(`[剧情推进] [Plot] ✓ 通过消息文本哈希精确匹配找到目标用户消息（索引 ${i}，哈希: ${userInputHash}）`);
                return { msg, index: i };
              } else {
                // 已有plot，可能是更早的重复文本，继续查找
                logDebug_ACU(`[剧情推进] [Plot] 索引 ${i} 的消息哈希匹配但已有plot，继续查找`);
              }
            }
          }
        }
      }

      // [回退逻辑] 如果没有哈希或哈希匹配失败，使用原逻辑（向后兼容）
      // 寻找最新的、且【尚未附加plot数据】的用户消息
      for (let i = chat.length - 1; i >= 0; i--) {
        const msg = chat[i];
        if (msg && msg.is_user && !msg.qrf_plot) {
          logDebug_ACU(`[剧情推进] [Plot] 使用回退逻辑找到目标用户消息于索引 ${i}`);
          return { msg, index: i };
        }
      }

      return null;
    };

    const pollForTarget = () => {
      pollAttempts++;
      const result = tryFindTarget();
      
      if (result) {
        target = result.msg;
        logDebug_ACU(`[剧情推进] [Plot] 在第 ${pollAttempts} 次轮询中找到目标消息`);
        
        // 保存plot数据
        target.qrf_plot = plotContent;
        const currentPresetName = getCurrentRuntimePlotPresetName_ACU({ fallbackToGlobal: true });
        target.qrf_plot_preset = currentPresetName;
        logDebug_ACU('[剧情推进] [Plot] ✓ Plot数据已精确附加到目标用户消息，长度:', plotContent.length, '，预设:', currentPresetName || '(默认预设)');
        
        // 清空临时变量
        tempPlotToSave_ACU = null;
        return true; // 成功
      }

      if (pollAttempts >= MAX_POLL_ATTEMPTS) {
        // 超时，记录警告但不清空tempPlotToSave_ACU，允许后续重试
        logWarn_ACU(`[剧情推进] [Plot] 轮询 ${MAX_POLL_ATTEMPTS} 次后仍未找到目标用户消息。用户输入哈希: ${userInputHash || '(无)'}，原始文本: ${userInputText ? `长度=${userInputText.length}` : '(无)'}。将在下一次事件中重试。`);
        return false; // 失败，但保留数据等待重试
      }

      // 继续轮询
      setTimeout(pollForTarget, POLL_INTERVAL_MS);
      return null; // 继续中
    };

    // 开始轮询（首次延迟100ms，给SillyTavern一些时间写入消息）
    setTimeout(() => {
      pollForTarget();
    }, 100);
  }

  /**
   * 核心优化逻辑，可被多处调用。
   * @param {string} userMessage - 需要被优化的用户输入文本。
   * @param {Object} options - 可选参数
   * @param {string} options.originalUserInput - 原始用户输入文本（用于哈希匹配，如果与userMessage不同）
   * @returns {Promise<string|null>} - 返回优化后的完整消息体，如果失败或跳过则返回null。
   */
  async function runOptimizationLogic_ACU(userMessage, options = {}) {
    const { originalUserInput, hasExistingUserMessage = false } = options;
    // 用于哈希匹配的原始用户输入（如果未提供，使用userMessage）
    const inputForHash = originalUserInput || userMessage;
    // 如果当前处于重试流程，绝对禁止触发剧情规划
    if (loopState_ACU.isRetrying) {
        logDebug_ACU('[剧情推进] 当前处于重试流程，跳过剧情规划逻辑。');
        return null;
    }

    // [关键修复] 硬互斥：同一时刻只允许一个剧情规划在跑，防止重复触发导致“成功但刷一堆规划失败 toast”
    if (runOptimizationLogic_ACU.__inFlight) {
      const inflightText = String(runOptimizationLogic_ACU.__inFlightText || '');
      const t = String(userMessage || '');
      if (t && inflightText && t === inflightText) {
        logDebug_ACU('[剧情推进] Duplicate planning call skipped (same text, in-flight).');
      } else {
        logDebug_ACU('[剧情推进] Planning skipped (another planning in-flight).');
      }
      return { skipped: true };
    }
    runOptimizationLogic_ACU.__inFlight = true;
    runOptimizationLogic_ACU.__inFlightText = String(userMessage || '');

    let $toast = null;
    // [中止回退] 记录本次规划对应的原始用户文本，用于“用户手动终止”时回填
    let originalUserInputForAbort_ACU = userMessage || '';
    try {
      // 标记进入规划阶段：用于忽略规划触发的生成事件
      planningGuard_ACU.inProgress = true;

      // 在每次执行前，都重新进行一次深度合并，以获取最新、最完整的设置状态
      const currentSettings = settings_ACU.plotSettings || {};
      const plotSettings = {
        ...DEFAULT_PLOT_SETTINGS_ACU,
        ...currentSettings,
      };

      if (!plotSettings.enabled) {
        return null; // 剧情推进功能未启用，直接返回
      }

      // 重置中止控制器
      abortController_ACU = new AbortController();

      // 创建带中止按钮的 Toast（使用 ACU 主题 toast class，保证风格统一）
      const toastMsg = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
              <span class="toastr-message" style="margin-right: 10px;">正在读取过往的记忆并分析，请稍后...</span>
              <button class="qrf-abort-btn">终止</button>
          </div>
      `;

      // “正在规划”属于白名单提示：无论是否开启静默都允许显示
      $toast = showToastr_ACU('info', toastMsg, {
            timeOut: 0,
            extendedTimeOut: 0,
            escapeHtml: false,
            tapToDismiss: false,
            closeButton: false,
            progressBar: false,
          toastClass: 'toast acu-toast acu-toast--info',
          acuToastCategory: ACU_TOAST_CATEGORY_ACU.PLANNING,
        });

      // 确保中止按钮绑定生效 - 在toast显示后立即绑定（绑定到本 toast 内按钮，避免误绑/绑到旧 toast）
      setTimeout(() => {
        // 优先绑定当前 toast 内的按钮
        const $abortBtn = ($toast && $toast.find) ? $toast.find('.qrf-abort-btn') : jQuery_API_ACU('.qrf-abort-btn');
        if ($abortBtn.length > 0) {
          $abortBtn.off('click').on('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            logDebug_ACU('[剧情推进] 用户点击了中止按钮。');

            if (abortController_ACU) {
              abortController_ACU.abort();
              logDebug_ACU('[剧情推进] 用户手动中止了规划任务。');
            }

            // 仅移除本次规划 toast（不要清空其它 toast；不同 toastr 封装可能不存在 remove()）
            try {
              // 先尝试 clear 当前 toast 对象
              if ($toast) toastr_API_ACU.clear($toast);
              // 再兜底：从按钮回溯到 toast DOM 并直接移除（避免 clear 无效导致残留）
              const $toastDom = jQuery_API_ACU(this).closest('.toast');
              if ($toastDom && $toastDom.length) $toastDom.remove();
            } catch (e) {}
            isProcessing_Plot_ACU = false; // 强制释放锁

            setTimeout(() => {
              // 用户主动中止属于正常流程，不应触发“错误”类提示
              showToastr_ACU('info', '规划任务已被用户中止。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.PLANNING });
            }, 500);
          });
          logDebug_ACU('[剧情推进] 中止按钮事件已绑定。');
        } else {
          logWarn_ACU('[剧情推进] 未找到中止按钮元素。');
        }
      }, 200);

      const runtimeResult = await runPlotTasksRuntime_ACU(plotSettings, userMessage, {
        inputForHash,
        $toast,
        hasExistingUserMessage,
      });

      try { if ($toast) toastr_API_ACU.clear($toast); } catch (e) {}

      if (!runtimeResult?.finalMessage) {
        if (runtimeResult?.abortedByStageFailure) {
          showToastr_ACU(
            'error',
            runtimeResult.errorMessage || `剧情任务阶段 ${runtimeResult.failedStage ?? '?'} 执行失败，后续阶段已停止。`,
            '规划失败',
            { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR },
          );
        } else if (runtimeResult?.enabledTaskCount > 0) {
          showToastr_ACU(
            'error',
            `共 ${runtimeResult.enabledTaskCount} 个剧情任务均未返回有效结果，操作已取消。`,
            '规划失败',
            { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR },
          );
        } else {
          showToastr_ACU('error', '当前没有可执行的剧情任务。', '规划失败', {
            acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR,
          });
        }
        return null;
      }

      const aggregatedTagNames = runtimeResult.aggregatedTags instanceof Map
        ? Array.from(runtimeResult.aggregatedTags.keys())
        : [];
      if (aggregatedTagNames.length > 0) {
        logDebug_ACU(`[剧情推进] 成功聚合标签: ${aggregatedTagNames.join(', ')}`);
        showToastr_ACU('info', `已成功聚合 [${aggregatedTagNames.join(', ')}] 标签内容并注入。`, '标签摘取');
      }

      if (runtimeResult.failedResults.length > 0) {
        showToastr_ACU(
          'warning',
          `剧情规划完成，${runtimeResult.successfulResults.length}/${runtimeResult.enabledTaskCount} 个任务成功。`,
          '部分成功',
          { acuToastCategory: ACU_TOAST_CATEGORY_ACU.PLAN_OK },
        );
      } else {
        showToastr_ACU(
          'success',
          `剧情规划成功，共完成 ${runtimeResult.successfulResults.length} 个任务。`,
          '规划成功',
          { acuToastCategory: ACU_TOAST_CATEGORY_ACU.PLAN_OK },
        );
      }

      return runtimeResult.finalMessage;
    } catch (error) {
      if (error.message === 'TaskAbortedByUser') {
          // 用户中止，返回特殊标记对象
          return { aborted: true, manual: true, restoreText: originalUserInputForAbort_ACU };
      }
      // 兼容 AbortController/浏览器的标准取消错误（不应当弹红框）
      if (error?.name === 'AbortError' || String(error?.message || '').toLowerCase().includes('aborted')) {
          return { aborted: true, manual: true, restoreText: originalUserInputForAbort_ACU };
      }
      logError_ACU('[剧情推进] 在核心优化逻辑中发生错误:', error);
      try { if ($toast) toastr_API_ACU.clear($toast); } catch (e) {}
      showToastr_ACU('error', '剧情规划大师在处理时发生错误。', '规划失败', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
      return null;
    } finally {
        planningGuard_ACU.inProgress = false;
        abortController_ACU = null;
        runOptimizationLogic_ACU.__inFlight = false;
        runOptimizationLogic_ACU.__inFlightText = '';
    }
  }

  /**
   * 获取剧情推进功能的世界书内容（默认开启，无需检查 worldbookEnabled）
   */
  async function getWorldbookContentForPlot_ACU(apiSettings, userMessage, extraBaseText = '') {
    if (!apiSettings) {
      logWarn_ACU('[剧情推进] apiSettings 为空，无法获取世界书');
      return '';
    }

    logDebug_ACU('[剧情推进] Starting to get combined worldbook content with shared placeholder pipeline...');

    try {
      let bookNames = [];

      // 1. 确定要扫描的世界书（剧情推进使用“独立 worldbookConfig”，与填表世界书选择互不干扰）
      const plotCfg = (apiSettings && apiSettings.plotWorldbookConfig) ? apiSettings.plotWorldbookConfig : null;
      const worldbookSource = plotCfg?.source || apiSettings.worldbookSource || 'character';
      logDebug_ACU('[剧情推进] 世界书来源模式:', worldbookSource);

      if (worldbookSource === 'manual') {
        bookNames = plotCfg?.manualSelection || apiSettings.selectedWorldbooks || [];
        logDebug_ACU('[剧情推进] 手动选择的世界书:', bookNames);
      } else {
        logDebug_ACU('[剧情推进] 使用角色绑定的世界书模式');
        try {
          const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
          logDebug_ACU('[剧情推进] 获取到的角色世界书:', charLorebooks);
          if (charLorebooks.primary) bookNames.push(charLorebooks.primary);
          if (charLorebooks.additional?.length) bookNames.push(...charLorebooks.additional);
        } catch (error) {
          logError_ACU('[剧情推进] 获取角色世界书失败:', error);
          return '';
        }
      }

      bookNames = [...new Set((Array.isArray(bookNames) ? bookNames : []).filter(Boolean))];
      logDebug_ACU('[剧情推进] 最终要扫描的世界书列表:', bookNames);
      if (bookNames.length === 0) {
        logWarn_ACU('[剧情推进] 没有找到任何世界书，$1 将为空');
        return '';
      }

      const historyLimit = Number.isFinite(apiSettings.contextTurnCount)
        ? Math.max(1, apiSettings.contextTurnCount)
        : 3;
      const chatArray = Array.isArray(SillyTavern_API_ACU.chat) ? SillyTavern_API_ACU.chat : [];
      const recentMessages = historyLimit > 0 ? chatArray.slice(-historyLimit) : chatArray;
      const historyAndUserText = `${recentMessages.map(message => message.mes || '').join('\n')}\n${userMessage || ''}`;
      const enabledMap = plotCfg?.enabledEntries;
      const hasAnySelection = enabledMap && typeof enabledMap === 'object' && Object.keys(enabledMap).length > 0;

      return await buildCombinedWorldbookContentByStrategy_ACU({
        logPrefix: '[剧情推进]',
        bookNames,
        baseScanText: [historyAndUserText, extraBaseText || ''].filter(Boolean).join('\n'),
        includeConstantEntriesInBaseScan: true,
        includeEntry: entry => {
          const normalizedComment = entry.normalizedComment || '';
          const isOutlineEntry = normalizedComment.startsWith('TavernDB-ACU-OutlineTable');
          const isSummaryIndexEntry = normalizedComment.startsWith('TavernDB-ACU-CustomExport-纪要索引');
          if (isOutlineEntry || isSummaryIndexEntry) {
            return false;
          }

          const isDbGenerated =
            normalizedComment.startsWith('TavernDB-ACU-') ||
            normalizedComment.startsWith('总结条目') ||
            normalizedComment.startsWith('小总结条目') ||
            normalizedComment.startsWith('重要人物条目');
          if (!isDbGenerated && isEntryBlocked_ACU(entry)) {
            logDebug_ACU(`[剧情推进] 条目被屏蔽: "${entry.rawComment || entry.comment || entry.name || ''}"`);
            return false;
          }
          return true;
        },
        isSelected: entry => {
          const normalizedComment = entry.normalizedComment || '';
          const isDbGenerated =
            normalizedComment.startsWith('TavernDB-ACU-') ||
            normalizedComment.startsWith('总结条目') ||
            normalizedComment.startsWith('小总结条目') ||
            normalizedComment.startsWith('重要人物条目');
          if (!hasAnySelection) return true;
          if (isDbGenerated) return true;
          const list = enabledMap?.[entry.bookName];
          if (typeof list === 'undefined') return true;
          if (!Array.isArray(list)) return true;
          return list.includes(entry.uid);
        },
        onEntriesFiltered: entries => {
          logDebug_ACU('[剧情推进] 过滤后的条目总数:', entries.length);
        },
        onSelectedEntries: entries => {
          logDebug_ACU('[剧情推进] SillyTavern中启用的条目数量:', entries.length);
        },
      });
    } catch (error) {
      logError_ACU('[剧情推进] 处理世界书内容时发生错误:', error);
      return '';
    }
  }

  function loadTemplateFromStorage_ACU(codeOverride = null) {
      const code = normalizeIsolationCode_ACU(
          (codeOverride !== null && typeof codeOverride !== 'undefined')
              ? codeOverride
              : (settings_ACU?.dataIsolationCode || globalMeta_ACU?.activeIsolationCode || ''),
      );

      // [更新参数哨兵迁移] 旧版本：0 表示“沿用UI”；新版本：-1 表示“沿用UI”，0 表示“禁用/不参与”（仅 updateFrequency 参与禁用语义）
      function migrateTemplateUpdateConfigSentinel_ACU(templateObj) {
          if (!templateObj || typeof templateObj !== 'object') return { changed: false, obj: templateObj };

          const mate = (templateObj.mate && typeof templateObj.mate === 'object') ? templateObj.mate : null;
          const alreadyMigrated = !!(mate && mate.updateConfigUiSentinel === -1);
          if (alreadyMigrated) return { changed: false, obj: templateObj };

          let changed = false;
          const sheetKeys = Object.keys(templateObj).filter(k => k.startsWith('sheet_'));
          for (const k of sheetKeys) {
              const sheet = templateObj[k];
              if (!sheet || typeof sheet !== 'object') continue;
              const uc = sheet.updateConfig;
              if (!uc || typeof uc !== 'object') continue;
              // sheet 级标记：用于聊天记录里的表格对象（没有 mate）也能识别新语义
              if (uc.uiSentinel !== -1) { uc.uiSentinel = -1; changed = true; }
              for (const field of ['contextDepth', 'updateFrequency', 'batchSize', 'skipFloors']) {
                  if (Object.prototype.hasOwnProperty.call(uc, field) && uc[field] === 0) {
                      uc[field] = -1;
                      changed = true;
                  }
              }
          }

          // 写入标记，避免后续把用户显式设置的 0(禁用) 再次误迁移
          if (!templateObj.mate || typeof templateObj.mate !== 'object') {
              templateObj.mate = { type: 'chatSheets', version: 1 };
              changed = true;
          } else {
              if (!templateObj.mate.type) templateObj.mate.type = 'chatSheets';
              if (!templateObj.mate.version) templateObj.mate.version = 1;
          }
          if (templateObj.mate.updateConfigUiSentinel !== -1) {
              templateObj.mate.updateConfigUiSentinel = -1;
              changed = true;
          }
          return { changed, obj: templateObj };
      }

      try {
          const savedTemplate = readProfileTemplateFromStorage_ACU(code);
          if (savedTemplate) {
              // [修复] 使用 safeJsonParse_ACU 静默处理解析失败，避免误报错误提示
              const parsedTemplate = safeJsonParse_ACU(savedTemplate, null);
              if (parsedTemplate && parsedTemplate.mate && Object.keys(parsedTemplate).some(k => k.startsWith('sheet_'))) {
                  // [迁移] 0(沿用UI) -> -1(沿用UI)，并写入标记
                  migrateTemplateUpdateConfigSentinel_ACU(parsedTemplate);
                  // [Profile] 模板载入时先补齐/修复顺序编号，并回写（编号可随导出/导入迁移）
                  const sheetKeys = Object.keys(parsedTemplate).filter(k => k.startsWith('sheet_'));
                  ensureSheetOrderNumbers_ACU(parsedTemplate, { baseOrderKeys: sheetKeys, forceRebuild: false });
                  // [瘦身] 无论是否 changed，都清洗模板（去掉 domain/type/enable/triggerSend*/config/customStyles 等冗余字段）
                  const sanitizedTemplate = sanitizeChatSheetsObject_ACU(parsedTemplate, { ensureMate: true });
                  TABLE_TEMPLATE_ACU = JSON.stringify(sanitizedTemplate);
                  writeProfileTemplateToStorage_ACU(code, TABLE_TEMPLATE_ACU);
                  logDebug_ACU(`[Profile] Template loaded for code: ${code || '(default)'}`);
                  return;
              } else if (parsedTemplate) {
                  // 解析成功但格式不正确，静默回退到默认模板
                  logDebug_ACU(`[Profile] Template format invalid for code: ${code || '(default)'}, using default.`);
              }
              // parsedTemplate 为 null 时表示解析失败，静默跳过（可能是旧的/其他标识的损坏数据）
          }
      } catch (error) {
          // 静默处理异常，避免误报错误提示困扰用户
          logDebug_ACU('[Profile] Template load skipped due to error, using default.', error?.message || error);
      }

      // No valid template found -> default
      TABLE_TEMPLATE_ACU = DEFAULT_TABLE_TEMPLATE_ACU;
      // [新机制] 默认模板也补齐一次编号（仅写入当前 profile，不改源码常量）
      try {
          const obj = JSON.parse(TABLE_TEMPLATE_ACU);
          // 默认模板也写入哨兵标记（便于后续识别新语义）
          try { migrateTemplateUpdateConfigSentinel_ACU(obj); } catch (e) {}
          const sheetKeys = Object.keys(obj).filter(k => k.startsWith('sheet_'));
          if (ensureSheetOrderNumbers_ACU(obj, { baseOrderKeys: sheetKeys, forceRebuild: false })) {
              const sanitizedTemplate = sanitizeChatSheetsObject_ACU(obj, { ensureMate: true });
              TABLE_TEMPLATE_ACU = JSON.stringify(sanitizedTemplate);
          }
      } catch (e) {
          // ignore
      }
      try { writeProfileTemplateToStorage_ACU(code, TABLE_TEMPLATE_ACU); } catch (e) {}
      logDebug_ACU(`[Profile] No valid template found, default persisted for code: ${code || '(default)'}`);
  }

  function buildDefaultSettings_ACU() {
      return {
          apiConfig: { url: '', apiKey: '', model: '', useMainApi: true, max_tokens: 60000, temperature: 1.0 },
          apiMode: 'custom',
          tavernProfile: '',
          streamingEnabled: false, // [新增] 流式传输开关（默认关闭）
          apiPresets: [],
          tableApiPreset: '',
          plotApiPreset: '',
          charCardPrompt: DEFAULT_CHAR_CARD_PROMPT_ACU,
          autoUpdateThreshold: DEFAULT_AUTO_UPDATE_THRESHOLD_ACU,
          autoUpdateFrequency: DEFAULT_AUTO_UPDATE_FREQUENCY_ACU,
          autoUpdateTokenThreshold: DEFAULT_AUTO_UPDATE_TOKEN_THRESHOLD_ACU,
          updateBatchSize: 3,
          maxConcurrentGroups: 1,
          autoUpdateEnabled: true,
          standardizedTableFillEnabled: true, // [新增] 规范填表功能
          toastMuteEnabled: false,
          // [剧情推进] 设置
          plotSettings: JSON.parse(JSON.stringify(DEFAULT_PLOT_SETTINGS_ACU)),
          plotPresetBindings: {}, // [剧情推进] 按聊天记录绑定剧情推进预设
          currentTemplatePresetName: '', // [模板预设] 当前模板预设名，空表示默认预设
          // [填表功能] 正文标签提取，从上下文中提取指定标签的内容发送给AI，User回复不受影响
          tableContextExtractTags: '',
          tableContextExtractRules: [],
          // [填表功能] 正文标签排除：将指定标签内容从上下文中移除
          tableContextExcludeTags: '',
          tableContextExcludeRules: [],
          // [填表功能] 仅识别最后一对 <tableEdit> 标签
          tableEditLastPairOnly: true,
          removeTags: '',
          importSplitSize: 10000,
          importPromptExcludeImportedWorldbookEntries: true, // [新增] 仅外部导入时，填表提示词中的世界书占位符屏蔽所有带“外部导入-”标签的条目
          skipUpdateFloors: 0, // 跳过更新楼层（全局）
          retainRecentLayers: 100, // [新增] 保留最近N层本地数据 (0或空=全部保留)
          manualSelectedTables: [],
          // [新增] 表格更新锁定（按聊天+隔离标签存储；仅对 updateRow 生效）
          tableUpdateLocks: {},
          // [新增] 总结表/总体大纲“编码索引列”特殊锁定（默认锁定）
          specialIndexLocks: {},
          // [新增] 0TK占用模式全局默认值：新对话会继承这个值
          zeroTkOccupyModeDefault: false,
          // [Profile] dataIsolationEnabled/code 由当前 profile 决定；history 走 globalMeta
          dataIsolationCode: '',
          dataIsolationHistory: [], // legacy 字段保留但不再持久化
          characterSettings: {}, // Start with an empty object
          knownCustomEntryNames: [], // [新增] 记录已创建的自定义条目名称，用于清理
          mergeSummaryPrompt: DEFAULT_MERGE_SUMMARY_PROMPT_ACU, // [新增] 合并总结提示词
          mergeTargetCount: 1, // [新增] 合并目标条数
          mergeBatchSize: 5, // [新增] 合并批次大小
          mergeStartIndex: 1, // [新增] 合并起始条数
          mergeEndIndex: null, // [新增] 合并终止条数
          autoMergeEnabled: false, // [新增] 是否开启自动合并总结
          autoMergeThreshold: 20, // [新增] 自动合并总结楼层数
          autoMergeReserve: 0, // [新增] 保留固定楼层数
          deleteStartFloor: null, // [新增] 删除起始楼层 (null表示从头开始)
          deleteEndFloor: null, // [新增] 删除终止楼层 (null表示到末尾)
          // [新增] 酒馆提示词模板功能
          promptTemplateSettings: {
            enabled: true,           // 总开关
            maxNestingDepth: 10,     // 最大嵌套深度
            debugMode: false         // 调试模式
          },
          // [新增] 正文优化功能
          contentOptimizationSettings: {
            enabled: false,                    // 是否启用正文优化
            apiPreset: '',                     // 优化使用的API预设（为空则使用当前配置）
            seamlessMode: true,                // 无感替换模式：显示遮罩，优化完成后直接显示结果
            autoApply: true,                   // 是否自动应用优化结果（关闭时显示对比让用户选择）
            showDiff: true,                    // 是否显示优化对比（非无感模式下有效）
            parallelMode: false,               // 填表与正文替换并行执行（默认关闭）
            minLength: 100,                    // 最小优化长度阈值
            maxOptimizations: 10,              // 单次最大优化项数
            loopCount: 1,                      // 循环优化次数
            retryCount: 3,                     // 自动重试次数（API调用失败时自动重试，默认3次）
            extractTags: '',                   // 正文标签提取（从正文中提取指定标签内容进行优化）
            extractRules: [],                  // 正文标签提取规则（结构化）
            excludeTags: '',                   // 标签排除（优化时排除指定标签内容）
            excludeRules: [],                  // 标签排除规则（结构化）
            promptGroup: buildDefaultContentOptimizationPromptGroup_ACU(), // 提示词组（段落编辑器）
            promptPresets: [],                 // 提示词组预设列表
          },
      };
  }

  function loadSettings_ACU() {
      // 确保酒馆设置桥接已就绪（best-effort，不阻塞）
      void initTavernSettingsBridge_ACU();
      // 尝试预载 IndexedDB 配置缓存（best-effort，不阻塞）
      void ensureConfigIdbCacheLoaded_ACU().then(() => {
          if (pendingSettingsReloadFromIdb_ACU) {
              pendingSettingsReloadFromIdb_ACU = false;
              loadSettings_ACU();
          }
      });
      // 可选迁移：把旧 localStorage 的设置/模板搬迁到酒馆设置（迁移开关默认为 false）
      migrateKeyToTavernStorageIfNeeded_ACU(STORAGE_KEY_ALL_SETTINGS_ACU);
      migrateKeyToTavernStorageIfNeeded_ACU(STORAGE_KEY_CUSTOM_TEMPLATE_ACU);

      // 1) 读取全局元信息（跨标识共享：标识列表/当前标识）
      loadGlobalMeta_ACU();

      const store = getConfigStorage_ACU();
      const legacySettingsJson = store?.getItem?.(STORAGE_KEY_ALL_SETTINGS_ACU);
      if (!legacySettingsJson && !configIdbCacheLoaded_ACU && isIndexedDbAvailable_ACU()) {
          if (!pendingSettingsReloadFromIdb_ACU) {
              pendingSettingsReloadFromIdb_ACU = true;
              void ensureConfigIdbCacheLoaded_ACU().then(() => {
                  if (pendingSettingsReloadFromIdb_ACU) {
                      pendingSettingsReloadFromIdb_ACU = false;
                      loadSettings_ACU();
                  }
              });
          }
      }
      const legacySettingsObj = legacySettingsJson ? safeJsonParse_ACU(legacySettingsJson, null) : null;
      const legacyCode = normalizeIsolationCode_ACU(legacySettingsObj?.dataIsolationCode || '');

      // 2) 一次性迁移：旧版“单份设置/单份模板” -> 当前标识对应 profile
      if (!globalMeta_ACU.migratedLegacySingleStore && (legacySettingsObj || store?.getItem?.(STORAGE_KEY_CUSTOM_TEMPLATE_ACU))) {
          const targetCode = legacyCode; // 旧版 code 就是当时的隔离标识
          const hasProfileSettings = !!readProfileSettingsFromStorage_ACU(targetCode);
          const hasProfileTemplate = !!readProfileTemplateFromStorage_ACU(targetCode);
          try {
              if (!hasProfileSettings && legacySettingsObj) {
                  const toSave = sanitizeSettingsForProfileSave_ACU(legacySettingsObj);
                  toSave.dataIsolationCode = targetCode;
                  writeProfileSettingsToStorage_ACU(targetCode, toSave);
              }
              if (!hasProfileTemplate) {
                  const legacyTemplate = store?.getItem?.(STORAGE_KEY_CUSTOM_TEMPLATE_ACU);
                  if (legacyTemplate && String(legacyTemplate).trim()) {
                      writeProfileTemplateToStorage_ACU(targetCode, legacyTemplate);
                  }
              }
              // 同步迁移“标识列表”到 globalMeta（跨标识共享）
              if (Array.isArray(legacySettingsObj?.dataIsolationHistory)) {
                  globalMeta_ACU.isolationCodeList = legacySettingsObj.dataIsolationHistory;
              }
              if (targetCode) {
                  globalMeta_ACU.activeIsolationCode = targetCode;
                  // 确保 active 在列表里
                  globalMeta_ACU.isolationCodeList = [targetCode, ...(globalMeta_ACU.isolationCodeList || [])];
              }
              normalizeDataIsolationHistory_ACU(globalMeta_ACU.isolationCodeList);
              globalMeta_ACU.migratedLegacySingleStore = true;
              saveGlobalMeta_ACU();
              // 迁移完成后移除 legacy 键，避免后续反复读取造成混乱
              try { store?.removeItem?.(STORAGE_KEY_ALL_SETTINGS_ACU); } catch (e) {}
              try { store?.removeItem?.(STORAGE_KEY_CUSTOM_TEMPLATE_ACU); } catch (e) {}
              logDebug_ACU(`[Profile] Migrated legacy single-store -> profile: ${targetCode || '(default)'}`);
          } catch (e) {
              logWarn_ACU('[Profile] Legacy migration failed (will keep legacy keys):', e);
          }
      }

      // 3) 决定本次启动要加载的标识 code（优先 globalMeta.active，其次 legacyCode）
      const activeCode = normalizeIsolationCode_ACU(globalMeta_ACU.activeIsolationCode || legacyCode || '');
      globalMeta_ACU.activeIsolationCode = activeCode;
      if (activeCode) addDataIsolationHistory_ACU(activeCode, { save: false });
      normalizeDataIsolationHistory_ACU(globalMeta_ACU.isolationCodeList);
      saveGlobalMeta_ACU();

      // 4) 加载模板（按标识 profile）
      loadTemplateFromStorage_ACU(activeCode);

      // 5) 加载设置（按标识 profile）
      const defaultSettings = buildDefaultSettings_ACU();

      try {
          const savedSettings = readProfileSettingsFromStorage_ACU(activeCode);
          if (savedSettings) {

              // [迁移逻辑] 检查旧的顶层 worldbookConfig
              if (savedSettings.worldbookConfig) {
                  logDebug_ACU('Migrating legacy worldbookConfig to character-specific settings.');
                  // 如果存在，并且没有 characterSettings，则创建一个
                  if (!savedSettings.characterSettings) {
                      savedSettings.characterSettings = {};
                  }
                  // 将旧配置迁移到 'default' 或一个通用的键下，以便初次加载时使用
                  // 这里我们假设它应该成为所有未配置角色的基础，但为了简单起见，我们只处理当前角色
                  const charId = currentChatFileIdentifier_ACU || 'default';
                  if (!savedSettings.characterSettings[charId]) {
                       savedSettings.characterSettings[charId] = { worldbookConfig: savedSettings.worldbookConfig };
                  }
                  // 删除顶层配置
                  delete savedSettings.worldbookConfig;
              }
              
              // Deep merge saved settings into defaults to ensure new properties are added
              settings_ACU = deepMerge_ACU(defaultSettings, savedSettings);

              // [剧情推进] 迁移/兜底：确保 plotWorldbookConfig 存在且结构完整
              if (!settings_ACU.plotSettings) settings_ACU.plotSettings = JSON.parse(JSON.stringify(DEFAULT_PLOT_SETTINGS_ACU));
              if (!settings_ACU.plotSettings.plotWorldbookConfig) {
                  // 兼容旧字段迁移：worldbookSource/selectedWorldbooks -> plotWorldbookConfig
                  const legacySource = settings_ACU.plotSettings.worldbookSource || 'character';
                  const legacyBooks = Array.isArray(settings_ACU.plotSettings.selectedWorldbooks) ? settings_ACU.plotSettings.selectedWorldbooks : [];
                  settings_ACU.plotSettings.plotWorldbookConfig = buildDefaultPlotWorldbookConfig_ACU();
                  settings_ACU.plotSettings.plotWorldbookConfig.source = (legacySource === 'manual') ? 'manual' : 'character';
                  settings_ACU.plotSettings.plotWorldbookConfig.manualSelection = legacyBooks;
              }
              if (!settings_ACU.plotPresetBindings || typeof settings_ACU.plotPresetBindings !== 'object' || Array.isArray(settings_ACU.plotPresetBindings)) {
                  settings_ACU.plotPresetBindings = {};
              }
              settings_ACU.currentTemplatePresetName = normalizeTemplatePresetSelectionValue_ACU(settings_ACU.currentTemplatePresetName || '');
              if (typeof settings_ACU.plotSettings.lastUsedPresetName !== 'string') {
                  settings_ACU.plotSettings.lastUsedPresetName = '';
              }

              // [Profile] 强制以 globalMeta.activeIsolationCode 作为当前标识
              settings_ACU.dataIsolationCode = activeCode;
              settings_ACU.dataIsolationEnabled = (activeCode !== '');

              // 0TK 全局偏好：优先 globalMeta；若缺失则从旧 profile 字段迁移
              if (typeof globalMeta_ACU.zeroTkOccupyModeGlobal === 'boolean') {
                  settings_ACU.zeroTkOccupyModeDefault = (globalMeta_ACU.zeroTkOccupyModeGlobal === true);
              } else {
                  globalMeta_ACU.zeroTkOccupyModeGlobal = (settings_ACU.zeroTkOccupyModeDefault === true);
                  saveGlobalMeta_ACU();
              }

              // 确保当前角色有配置
              getCurrentCharSettings_ACU();
              
          } else {
              // No saved settings, use the defaults
              settings_ACU = defaultSettings;
              // [剧情推进] 默认兜底
              if (!settings_ACU.plotSettings.plotWorldbookConfig) {
                  settings_ACU.plotSettings.plotWorldbookConfig = buildDefaultPlotWorldbookConfig_ACU();
              }
              // [Profile] 强制以 globalMeta.activeIsolationCode 作为当前标识
              settings_ACU.dataIsolationCode = activeCode;
              settings_ACU.dataIsolationEnabled = (activeCode !== '');
              if (typeof globalMeta_ACU.zeroTkOccupyModeGlobal === 'boolean') {
                  settings_ACU.zeroTkOccupyModeDefault = (globalMeta_ACU.zeroTkOccupyModeGlobal === true);
              } else {
                  globalMeta_ACU.zeroTkOccupyModeGlobal = (settings_ACU.zeroTkOccupyModeDefault === true);
                  saveGlobalMeta_ACU();
              }
          }
      } catch (error) {
          logError_ACU('Failed to load or parse settings, using defaults:', error);
          settings_ACU = buildDefaultSettings_ACU();
          settings_ACU.dataIsolationCode = activeCode;
          settings_ACU.dataIsolationEnabled = (activeCode !== '');
      }

      // [兼容] 旧标签排除字段自动迁移为新规则组结构
      ensureTagRulesCompat_ACU(settings_ACU);

      if (!Number.isFinite(settings_ACU.maxConcurrentGroups) || settings_ACU.maxConcurrentGroups < 1) {
          settings_ACU.maxConcurrentGroups = 1;
      }
      logDebug_ACU('Settings loaded:', settings_ACU);

      // Update UI if it's open
      if ($popupInstance_ACU) {
          if ($customApiUrlInput_ACU) $customApiUrlInput_ACU.val(settings_ACU.apiConfig.url);
          if ($customApiKeyInput_ACU) $customApiKeyInput_ACU.val(settings_ACU.apiConfig.apiKey);
          if ($maxTokensInput_ACU) $maxTokensInput_ACU.val(settings_ACU.apiConfig.max_tokens);
          if ($temperatureInput_ACU) $temperatureInput_ACU.val(settings_ACU.apiConfig.temperature);
          if ($customApiModelInput_ACU) {
              $customApiModelInput_ACU.val(settings_ACU.apiConfig.model || '');
          }
          if ($customApiModelSelect_ACU) {
              // 清空现有选项并添加默认选项
              $customApiModelSelect_ACU.empty().append('<option value="">-- 请先加载模型列表 --</option>');
              if (settings_ACU.apiConfig.model) {
                  // 将已保存的模型添加到select中
                  $customApiModelSelect_ACU.append(`<option value="${escapeHtml_ACU(settings_ACU.apiConfig.model)}">${escapeHtml_ACU(settings_ACU.apiConfig.model)}</option>`);
              }
          }
          updateApiStatusDisplay_ACU();

          // 使用新的渲染函数
          if ($charCardPromptSegmentsContainer_ACU) renderPromptSegments_ACU(settings_ACU.charCardPrompt);
          if ($autoUpdateThresholdInput_ACU) $autoUpdateThresholdInput_ACU.val(settings_ACU.autoUpdateThreshold);
          if ($autoUpdateFrequencyInput_ACU) $autoUpdateFrequencyInput_ACU.val(settings_ACU.autoUpdateFrequency);
          if ($autoUpdateTokenThresholdInput_ACU) $autoUpdateTokenThresholdInput_ACU.val(settings_ACU.autoUpdateTokenThreshold);
          if ($updateBatchSizeInput_ACU) $updateBatchSizeInput_ACU.val(settings_ACU.updateBatchSize); // [新增]
          if ($maxConcurrentGroupsInput_ACU) $maxConcurrentGroupsInput_ACU.val(settings_ACU.maxConcurrentGroups || 1);
          if ($skipUpdateFloorsInput_ACU) $skipUpdateFloorsInput_ACU.val(settings_ACU.skipUpdateFloors || 0);
          if ($retainRecentLayersInput_ACU) $retainRecentLayersInput_ACU.val(settings_ACU.retainRecentLayers || '');
          renderExcludeRuleRows_ACU(
            `#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules`,
            normalizeExtractRules_ACU(settings_ACU.tableContextExtractRules, settings_ACU.tableContextExtractTags || ''),
            { startPlaceholder: '开始词（例如：<think）', endPlaceholder: '结束词（例如：</think>）' },
          );
          renderExcludeRuleRows_ACU(
            `#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules`,
            normalizeExcludeRules_ACU(settings_ACU.tableContextExcludeRules, settings_ACU.tableContextExcludeTags || ''),
            { startPlaceholder: '开始词（例如：<thinking）', endPlaceholder: '结束词（例如：</thinking>）' },
          );
          const $importSplitSizeInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-split-size`);
          if ($importSplitSizeInput.length) $importSplitSizeInput.val(settings_ACU.importSplitSize);
          const $importPromptExcludeImportedEntriesToggle = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-prompt-exclude-imported-worldbook-entries`);
          if ($importPromptExcludeImportedEntriesToggle.length) {
              $importPromptExcludeImportedEntriesToggle.prop('checked', settings_ACU.importPromptExcludeImportedWorldbookEntries !== false);
          }
          if ($autoUpdateEnabledCheckbox_ACU) $autoUpdateEnabledCheckbox_ACU.prop('checked', settings_ACU.autoUpdateEnabled);
          if ($standardizedTableFillEnabledCheckbox_ACU) $standardizedTableFillEnabledCheckbox_ACU.prop('checked', settings_ACU.standardizedTableFillEnabled !== false);
          if ($toastMuteEnabledCheckbox_ACU) $toastMuteEnabledCheckbox_ACU.prop('checked', !!settings_ACU.toastMuteEnabled);
          if ($promptTemplateEnabledCheckbox_ACU) $promptTemplateEnabledCheckbox_ACU.prop('checked', settings_ACU.promptTemplateSettings?.enabled !== false);
          if ($tableEditLastPairOnlyCheckbox_ACU) $tableEditLastPairOnlyCheckbox_ACU.prop('checked', settings_ACU.tableEditLastPairOnly !== false);
          if ($tableMaxRetriesInput_ACU) $tableMaxRetriesInput_ACU.val(settings_ACU.tableMaxRetries || 3); // [新增] 填表重试次数

          // [新增] 更新所有合并相关设置
          const $mergePromptInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-prompt-template`);
          const $mergeTargetCount = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-target-count`);
          const $mergeBatchSize = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-batch-size`);
          const $mergeStartIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-start-index`);
          const $mergeEndIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-end-index`);
          const $autoMergeEnabled = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-enabled`);
          const $autoMergeThreshold = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-threshold`);
          const $autoMergeReserve = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-reserve`);

          if ($mergePromptInput.length) $mergePromptInput.val(settings_ACU.mergeSummaryPrompt || DEFAULT_MERGE_SUMMARY_PROMPT_ACU);
          if ($mergeTargetCount.length) $mergeTargetCount.val(settings_ACU.mergeTargetCount || 1);
          if ($mergeBatchSize.length) $mergeBatchSize.val(settings_ACU.mergeBatchSize || 5);
          if ($mergeStartIndex.length) $mergeStartIndex.val(settings_ACU.mergeStartIndex || 1);
          if ($mergeEndIndex.length) $mergeEndIndex.val(settings_ACU.mergeEndIndex || '');
          if ($autoMergeEnabled.length) $autoMergeEnabled.prop('checked', settings_ACU.autoMergeEnabled || false);
          if ($autoMergeThreshold.length) $autoMergeThreshold.val(settings_ACU.autoMergeThreshold || 20);
          if ($autoMergeReserve.length) $autoMergeReserve.val(settings_ACU.autoMergeReserve || 0);

          // [新增] 删除楼层范围设置
          const $deleteStartFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-start-floor`);
          const $deleteEndFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-end-floor`);

          if ($deleteStartFloor.length) $deleteStartFloor.val(settings_ACU.deleteStartFloor || 1);
          if ($deleteEndFloor.length) $deleteEndFloor.val(settings_ACU.deleteEndFloor || '');

          // [重构] 更新UI以使用新的角色专属世界书配置
          const worldbookConfig = getCurrentWorldbookConfig_ACU();
          const $worldbookSourceRadios = $popupInstance_ACU.find(`input[name="${SCRIPT_ID_PREFIX_ACU}-worldbook-source"]`);
          $worldbookSourceRadios.filter(`[value="${worldbookConfig.source}"]`).prop('checked', true);
          updateWorldbookSourceView_ACU();
          populateInjectionTargetSelector_ACU();
          // [新增] 同步“总结大纲(总体大纲)”条目启用开关
          const $outlineEnabledToggle = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-outline-entry-enabled`);
          if ($outlineEnabledToggle.length) {
              // UI 显示的是“0TK占用模式”，默认不勾选
              // 兼容：若 zeroTkOccupyMode 未设置，则从旧字段 outlineEntryEnabled 反推
              let mode = worldbookConfig.zeroTkOccupyMode;
              if (typeof mode === 'undefined' && typeof worldbookConfig.outlineEntryEnabled !== 'undefined') {
                  mode = (worldbookConfig.outlineEntryEnabled === false);
              }
              $outlineEnabledToggle.prop('checked', mode === true);
          }
          
          if ($useMainApiCheckbox_ACU) {
            $useMainApiCheckbox_ACU.prop('checked', settings_ACU.apiConfig.useMainApi);
            updateCustomApiInputsState_ACU(); // Update disabled state on load
          }
          // [新增] 加载流式传输开关状态
          if ($streamingEnabledCheckbox_ACU) {
            $streamingEnabledCheckbox_ACU.prop('checked', settings_ACU.streamingEnabled || false);
          }
          if ($manualTableSelector_ACU) {
              renderManualTableSelector_ACU();
          }
          if ($importTableSelector_ACU) {
              renderImportTableSelector_ACU();
          }
      if ($manualTableSelectAll_ACU && $manualTableSelectAll_ACU.length) {
          $manualTableSelectAll_ACU.on('click', function(e) {
              e.preventDefault();
              handleManualSelectAll_ACU();
          });
      }
      if ($manualTableSelectNone_ACU && $manualTableSelectNone_ACU.length) {
          $manualTableSelectNone_ACU.on('click', function(e) {
              e.preventDefault();
              handleManualSelectNone_ACU();
          });
      }
      if ($importTableSelectAll_ACU && $importTableSelectAll_ACU.length) {
          $importTableSelectAll_ACU.on('click', function(e) {
              e.preventDefault();
              handleImportSelectAll_ACU();
          });
      }
      if ($importTableSelectNone_ACU && $importTableSelectNone_ACU.length) {
          $importTableSelectNone_ACU.on('click', function(e) {
              e.preventDefault();
              handleImportSelectNone_ACU();
          });
      }
          
          if ($popupInstance_ACU) {
            $popupInstance_ACU.find(`input[name="${SCRIPT_ID_PREFIX_ACU}-api-mode"][value="${settings_ACU.apiMode}"]`).prop('checked', true);
            updateApiModeView_ACU(settings_ACU.apiMode);
          }

      }
  }

  // Removed applyActualMessageVisibility_ACU function

  function updateApiModeView_ACU(apiMode) {
    if (!$popupInstance_ACU) return;
    const $customApiBlock = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-custom-api-settings-block`);
    const $tavernApiBlock = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-block`);

    if (apiMode === 'tavern') {
        $customApiBlock.hide();
        $tavernApiBlock.show();
        loadTavernApiProfiles_ACU();
    } else { // custom
        $customApiBlock.show();
        $tavernApiBlock.hide();
    }
  }

  function updateCustomApiInputsState_ACU() {
    if (!$popupInstance_ACU) return;
    const useMainApi = settings_ACU.apiConfig.useMainApi;
    const $customApiFields = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-custom-api-fields`);
    if (useMainApi) {
        $customApiFields.css('opacity', '0.5');
        $customApiFields.find('input, select, button').prop('disabled', true);
    } else {
        $customApiFields.css('opacity', '1.0');
        $customApiFields.find('input, select, button').prop('disabled', false);
    }
  }

  async function loadTavernApiProfiles_ACU() {
    if (!$popupInstance_ACU) return;
    const $select = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-select`);
    const currentProfileId = settings_ACU.tavernProfile;
    
    $select.empty().append('<option value="">-- 请选择一个酒馆预设 --</option>');

    try {
        const tavernProfiles = SillyTavern_API_ACU.extensionSettings?.connectionManager?.profiles || [];
        if (!tavernProfiles || tavernProfiles.length === 0) {
            $select.append($('<option>', { value: '', text: '未找到酒馆预设', disabled: true }));
            return;
        }

        let foundCurrentProfile = false;
        tavernProfiles.forEach(profile => {
            if (profile.api && profile.preset) { // Ensure it's a valid API profile
                const option = $('<option>', {
                    value: profile.id,
                    text: profile.name || profile.id,
                    selected: profile.id === currentProfileId
                });
                $select.append(option);
                if (profile.id === currentProfileId) {
                    foundCurrentProfile = true;
                }
            }
        });

        if (currentProfileId && foundCurrentProfile) {
             $select.val(currentProfileId);
        }

    } catch (error) {
        logError_ACU('加载酒馆API预设失败:', error);
        showToastr_ACU('error', '无法加载酒馆API预设列表。');
    }
  }

  function saveApiConfig_ACU() {
    if (!$popupInstance_ACU || !$customApiUrlInput_ACU || !$customApiKeyInput_ACU || !$customApiModelInput_ACU) {
      logError_ACU('保存API配置失败：UI元素未初始化。');
      return;
    }
    const url = $customApiUrlInput_ACU.val().trim();
    const apiKey = $customApiKeyInput_ACU.val();
    const model = $customApiModelInput_ACU.val().trim();
    const max_tokens = parseInt($maxTokensInput_ACU.val(), 10);
    const temperature = parseFloat($temperatureInput_ACU.val());


    if (!url) {
      showToastr_ACU('warning', 'API URL 不能为空。');
      return;
    }
    if (!model) {
      showToastr_ACU('warning', '请输入或选择一个模型。');
      return;
    }

    Object.assign(settings_ACU.apiConfig, {
        url,
        apiKey,
        model,
        max_tokens: isNaN(max_tokens) ? 120000 : max_tokens,
        temperature: isNaN(temperature) ? 0.9 : temperature,
    });
    // 将新保存的模型添加到select中（如果不存在）
    if ($customApiModelSelect_ACU && $customApiModelSelect_ACU.find(`option[value="${escapeHtml_ACU(model)}"]`).length === 0) {
        $customApiModelSelect_ACU.append(`<option value="${escapeHtml_ACU(model)}">${escapeHtml_ACU(model)}</option>`);
    }
    saveSettings_ACU();
    showToastr_ACU('success', 'API配置已保存！');
    loadSettings_ACU();
  }

  function clearApiConfig_ACU() {
    Object.assign(settings_ACU.apiConfig, { url: '', apiKey: '', model: '', max_tokens: 120000, temperature: 0.9 });
    saveSettings_ACU();
    showToastr_ACU('info', 'API配置已清除！');
    loadSettings_ACU();
  }

  // --- [新增] API预设管理函数 ---
  function saveApiPreset_ACU(presetName) {
    if (!presetName || !presetName.trim()) {
      showToastr_ACU('warning', '请输入预设名称。');
      return false;
    }
    presetName = presetName.trim();
    
    const newPreset = {
      name: presetName,
      apiMode: settings_ACU.apiMode,
      apiConfig: JSON.parse(JSON.stringify(settings_ACU.apiConfig)),
      tavernProfile: settings_ACU.tavernProfile
    };
    
    // 检查是否已存在同名预设
    const existingIndex = settings_ACU.apiPresets.findIndex(p => p.name === presetName);
    if (existingIndex >= 0) {
      settings_ACU.apiPresets[existingIndex] = newPreset;
      showToastr_ACU('success', `API预设 "${presetName}" 已更新。`);
    } else {
      settings_ACU.apiPresets.push(newPreset);
      showToastr_ACU('success', `API预设 "${presetName}" 已保存。`);
    }
    
    saveSettings_ACU();
    refreshApiPresetSelectors_ACU();
    return true;
  }

  function loadApiPreset_ACU(presetName) {
    const preset = settings_ACU.apiPresets.find(p => p.name === presetName);
    if (!preset) {
      showToastr_ACU('error', `未找到预设 "${presetName}"。`);
      return false;
    }
    
    settings_ACU.apiMode = preset.apiMode;
    settings_ACU.apiConfig = JSON.parse(JSON.stringify(preset.apiConfig));
    settings_ACU.tavernProfile = preset.tavernProfile;
    
    saveSettings_ACU();
    loadSettings_ACU();
    showToastr_ACU('success', `已加载API预设 "${presetName}"。`);
    return true;
  }

  function deleteApiPreset_ACU(presetName) {
    const index = settings_ACU.apiPresets.findIndex(p => p.name === presetName);
    if (index < 0) {
      showToastr_ACU('error', `未找到预设 "${presetName}"。`);
      return false;
    }
    
    settings_ACU.apiPresets.splice(index, 1);
    
    // 清除使用该预设的引用
    if (settings_ACU.tableApiPreset === presetName) {
      settings_ACU.tableApiPreset = '';
    }
    if (settings_ACU.plotApiPreset === presetName) {
      settings_ACU.plotApiPreset = '';
    }
    
    saveSettings_ACU();
    refreshApiPresetSelectors_ACU();
    showToastr_ACU('info', `API预设 "${presetName}" 已删除。`);
    return true;
  }

  function refreshApiPresetSelectors_ACU() {
    if (!$popupInstance_ACU) return;
    
    const presets = settings_ACU.apiPresets || [];
    
    // 刷新API配置页面的预设选择器
    const $apiPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-preset-select`);
    if ($apiPresetSelect.length) {
      $apiPresetSelect.empty().append('<option value="">-- 选择预设 --</option>');
      presets.forEach(p => {
        $apiPresetSelect.append(`<option value="${p.name}">${p.name}</option>`);
      });
    }
    
    // 刷新填表的API预设选择器
    const $tableApiPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-table-api-preset-select`);
    if ($tableApiPresetSelect.length) {
      $tableApiPresetSelect.empty().append('<option value="">使用当前API配置</option>');
      presets.forEach(p => {
        $tableApiPresetSelect.append(`<option value="${p.name}">${p.name}</option>`);
      });
      $tableApiPresetSelect.val(settings_ACU.tableApiPreset || '');
    }
    
    // 刷新剧情推进的API预设选择器
    const $plotApiPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-api-preset-select`);
    if ($plotApiPresetSelect.length) {
      $plotApiPresetSelect.empty().append('<option value="">使用当前API配置</option>');
      presets.forEach(p => {
        $plotApiPresetSelect.append(`<option value="${p.name}">${p.name}</option>`);
      });
      $plotApiPresetSelect.val(settings_ACU.plotApiPreset || '');
    }

    // 刷新正文替换的API预设选择器
    const $optimizationApiPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-api-preset`);
    if ($optimizationApiPresetSelect.length) {
      $optimizationApiPresetSelect.empty().append('<option value="">使用当前API配置</option>');
      presets.forEach(p => {
        $optimizationApiPresetSelect.append(`<option value="${p.name}">${p.name}</option>`);
      });
      $optimizationApiPresetSelect.val(settings_ACU.contentOptimizationSettings?.apiPreset || '');
    }
  }

  /**
   * 根据预设名称获取API配置
   * @param {string} presetName - 预设名称，空字符串表示使用当前配置
   * @returns {object} - 包含 apiMode, apiConfig, tavernProfile 的配置对象
   */
  function getApiConfigByPreset_ACU(presetName) {
    if (!presetName) {
      // 使用当前配置
      return {
        apiMode: settings_ACU.apiMode,
        apiConfig: settings_ACU.apiConfig,
        tavernProfile: settings_ACU.tavernProfile
      };
    }
    
    const preset = settings_ACU.apiPresets.find(p => p.name === presetName);
    if (preset) {
      return {
        apiMode: preset.apiMode,
        apiConfig: preset.apiConfig,
        tavernProfile: preset.tavernProfile
      };
    }
    
    // 预设不存在，回退到当前配置
    logWarn_ACU(`API预设 "${presetName}" 不存在，使用当前配置。`);
    return {
      apiMode: settings_ACU.apiMode,
      apiConfig: settings_ACU.apiConfig,
      tavernProfile: settings_ACU.tavernProfile
    };
  }

  function saveCustomCharCardPrompt_ACU() {
    if (!$popupInstance_ACU || !$charCardPromptSegmentsContainer_ACU) {
      logError_ACU('保存更新预设失败：UI元素未初始化。');
      return;
    }
    let newPromptSegments = getCharCardPromptFromUI_ACU();
    if (!newPromptSegments || newPromptSegments.length === 0 || (newPromptSegments.length === 1 && !newPromptSegments[0].content.trim())) {
      showToastr_ACU('warning', '更新预设不能为空。');
      return;
    }

    // [健全性] 主提示词槽位去重：A/B 各最多一个（多余的自动降级为普通段落）
    try {
      const seen = { A: false, B: false };
      newPromptSegments = newPromptSegments.map(seg => {
        const slot = String(seg?.mainSlot || (seg?.isMain ? 'A' : (seg?.isMain2 ? 'B' : ''))).toUpperCase();
        if (slot === 'A' || slot === 'B') {
          if (seen[slot]) {
            const cleaned = { ...seg };
            delete cleaned.mainSlot;
            delete cleaned.isMain;
            delete cleaned.isMain2;
            cleaned.deletable = cleaned.deletable !== false;
            return cleaned;
          }
          seen[slot] = true;
        }
        return seg;
      });
    } catch (e) {}

    // 保存为JSON数组格式
    settings_ACU.charCardPrompt = newPromptSegments;
    saveSettings_ACU();
    showToastr_ACU('success', '更新预设已保存！');
    loadSettings_ACU(); // This will re-render from the saved data.
  }

  function resetDefaultCharCardPrompt_ACU() {
    settings_ACU.charCardPrompt = DEFAULT_CHAR_CARD_PROMPT_ACU;
    saveSettings_ACU();
    showToastr_ACU('info', '更新预设已恢复为默认值！');
    // loadSettings will trigger renderPromptSegments_ACU which correctly handles the string default
    loadSettings_ACU();
  }

  function loadCharCardPromptFromJson_ACU() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = readerEvent => {
            const content = readerEvent.target.result;
            let jsonData;

            try {
                jsonData = JSON.parse(content);
            } catch (error) {
                logError_ACU('导入提示词模板失败：JSON解析错误。', error);
                showToastr_ACU('error', '文件不是有效的JSON格式。', { timeOut: 5000 });
                return;
            }
            
            try {
                // Basic validation: must be an array of objects with role and content
                if (!Array.isArray(jsonData) || jsonData.some(item => typeof item.role === 'undefined' || typeof item.content === 'undefined')) {
                    throw new Error('JSON格式不正确。它必须是一个包含 "role" 和 "content" 键的对象的数组。');
                }
                
                // Add deletable: true and normalize roles for consistency
                const segments = jsonData.map(item => {
                    let normalizedRole = 'USER'; // Default to USER
                    if (item.role) {
                        const roleLower = item.role.toLowerCase();
                        if (roleLower === 'system') {
                            normalizedRole = 'SYSTEM';
                        } else if (roleLower === 'assistant' || roleLower === 'ai') {
                            normalizedRole = 'assistant';
                        }
                    }
                    const slot = String(item?.mainSlot || (item?.isMain ? 'A' : (item?.isMain2 ? 'B' : ''))).toUpperCase();
                    const normalizedSlot = (slot === 'A' || slot === 'B') ? slot : '';
                    return {
                        ...item,
                        role: normalizedRole,
                        mainSlot: normalizedSlot || item.mainSlot,
                        // 主提示词A/B不可删除
                        deletable: (normalizedSlot ? false : (item.deletable !== false)),
                    };
                });

                // Use the existing render function
                renderPromptSegments_ACU(segments);
                showToastr_ACU('success', '提示词模板已成功加载！');
                logDebug_ACU('New prompt template loaded from JSON file.');

            } catch (error) {
                logError_ACU('导入提示词模板失败：结构验证失败。', error);
                showToastr_ACU('error', `导入失败: ${error.message}`, { timeOut: 10000 });
            }
        };
        reader.readAsText(file, 'UTF-8');
    };
    input.click();
  }

  // [新增] 导出“填表提示词组(更新预设/AI指令预设)”为 JSON（与 loadCharCardPromptFromJson_ACU 联动）
  function exportCharCardPromptToJson_ACU() {
    try {
      const segments = getCharCardPromptFromUI_ACU();
      if (!Array.isArray(segments) || segments.length === 0) {
        showToastr_ACU('warning', '没有可导出的提示词模板。');
        return;
      }
      // 基础校验：必须包含 role/content
      const invalid = segments.some(s => !s || typeof s !== 'object' || typeof s.role === 'undefined' || typeof s.content === 'undefined');
      if (invalid) {
        showToastr_ACU('error', '导出失败：提示词结构不完整（缺少 role 或 content）。');
        return;
      }

      const jsonString = JSON.stringify(segments, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'TavernDB_TablePromptGroup.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToastr_ACU('success', '提示词模板已导出为JSON！', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE });
    } catch (e) {
      logError_ACU('导出提示词模板失败:', e);
      showToastr_ACU('error', '导出提示词模板失败，请检查控制台获取详情。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
    }
  }
  function saveAutoUpdateThreshold_ACU({ silent = false, skipReload = false } = {}) {
    if (!$popupInstance_ACU || !$autoUpdateThresholdInput_ACU) {
      logError_ACU('保存阈值失败：UI元素未初始化。');
      return;
    }
    const valStr = $autoUpdateThresholdInput_ACU.val();
    const newT = parseInt(valStr, 10);

    if (!isNaN(newT) && newT >= 0) {
      settings_ACU.autoUpdateThreshold = newT;
      saveSettings_ACU();
      if (!silent) {
        if (newT === 0) showToastr_ACU('success', '自动更新阈值已保存！标准表自动更新已禁用。');
        else showToastr_ACU('success', '自动更新阈值已保存！');
      }
      if (!skipReload) loadSettings_ACU();
    } else {
      if (!silent) showToastr_ACU('warning', `阈值 "${valStr}" 无效。请输入一个大于等于0的整数。恢复为: ${settings_ACU.autoUpdateThreshold}`);
      $autoUpdateThresholdInput_ACU.val(settings_ACU.autoUpdateThreshold);
    }
  }

  function saveAutoUpdateTokenThreshold_ACU({ silent = false, skipReload = false } = {}) {
    if (!$popupInstance_ACU || !$autoUpdateTokenThresholdInput_ACU) {
      logError_ACU('保存Token阈值失败：UI元素未初始化。');
      return;
    }
    const valStr = $autoUpdateTokenThresholdInput_ACU.val();
    const newT = parseInt(valStr, 10);

    if (!isNaN(newT) && newT >= 0) {
      settings_ACU.autoUpdateTokenThreshold = newT;
      saveSettings_ACU();
      if (!silent) showToastr_ACU('success', '自动更新Token阈值已保存！');
      if (!skipReload) loadSettings_ACU();
    } else {
      if (!silent) showToastr_ACU('warning', `Token阈值 "${valStr}" 无效。请输入一个大于等于0的整数。恢复为: ${settings_ACU.autoUpdateTokenThreshold}`);
      $autoUpdateTokenThresholdInput_ACU.val(settings_ACU.autoUpdateTokenThreshold);
    }
  }

  // [新增] 保存填表自动重试次数的函数
  function saveTableMaxRetries_ACU({ silent = false, skipReload = false } = {}) {
    if (!$popupInstance_ACU || !$tableMaxRetriesInput_ACU) {
      logError_ACU('保存填表重试次数失败：UI元素未初始化。');
      return;
    }
    const valStr = $tableMaxRetriesInput_ACU.val();
    const newR = parseInt(valStr, 10);

    if (!isNaN(newR) && newR >= 1 && newR <= 10) {
      settings_ACU.tableMaxRetries = newR;
      saveSettings_ACU();
      if (!silent) showToastr_ACU('success', '填表自动重试次数已保存！');
      if (!skipReload) loadSettings_ACU();
    } else {
      if (!silent) showToastr_ACU('warning', `重试次数 "${valStr}" 无效。请输入1-10之间的整数。恢复为: ${settings_ACU.tableMaxRetries || 3}`);
      $tableMaxRetriesInput_ACU.val(settings_ACU.tableMaxRetries || 3);
    }
  }

  function saveAutoUpdateFrequency_ACU({ silent = false, skipReload = false } = {}) {
    if (!$popupInstance_ACU || !$autoUpdateFrequencyInput_ACU) {
      logError_ACU('保存更新频率失败：UI元素未初始化。');
      return;
    }
    const valStr = $autoUpdateFrequencyInput_ACU.val();
    const newF = parseInt(valStr, 10);

    if (!isNaN(newF) && newF >= 1) {
      settings_ACU.autoUpdateFrequency = newF;
      saveSettings_ACU();
      if (!silent) showToastr_ACU('success', '自动更新频率已保存！');
      if (!skipReload) loadSettings_ACU();
    } else {
      if (!silent) showToastr_ACU('warning', `更新频率 "${valStr}" 无效。请输入一个大于0的整数。恢复为: ${settings_ACU.autoUpdateFrequency}`);
      $autoUpdateFrequencyInput_ACU.val(settings_ACU.autoUpdateFrequency);
    }
  }


  // [新增] 保存批处理大小的函数
  function saveUpdateBatchSize_ACU({ silent = false, skipReload = false } = {}) {
      if (!$popupInstance_ACU || !$updateBatchSizeInput_ACU) {
          logError_ACU('保存批处理大小失败：UI元素未初始化。');
          return;
      }
      const valStr = $updateBatchSizeInput_ACU.val();
      const newBatchSize = parseInt(valStr, 10);

      if (!isNaN(newBatchSize) && newBatchSize >= 1) {
          settings_ACU.updateBatchSize = newBatchSize;
          saveSettings_ACU();
          if (!silent) showToastr_ACU('success', '批处理大小已保存！');
          if (!skipReload) loadSettings_ACU();
      } else {
          if (!silent) showToastr_ACU('warning', `批处理大小 "${valStr}" 无效。请输入一个大于0的整数。恢复为: ${settings_ACU.updateBatchSize}`);
          $updateBatchSizeInput_ACU.val(settings_ACU.updateBatchSize);
      }
  }

  // [新增] 保存最大并发组数
  function saveMaxConcurrentGroups_ACU({ silent = false, skipReload = false } = {}) {
      if (!$popupInstance_ACU || !$maxConcurrentGroupsInput_ACU) {
          logError_ACU('保存最大并发数失败：UI元素未初始化。');
          return;
      }
      const valStr = $maxConcurrentGroupsInput_ACU.val();
      const newLimit = parseInt(valStr, 10);

      if (!isNaN(newLimit) && newLimit >= 1) {
          settings_ACU.maxConcurrentGroups = newLimit;
          saveSettings_ACU();
          if (!silent) showToastr_ACU('success', '最大并发数已保存！');
          if (!skipReload) loadSettings_ACU();
      } else {
          if (!silent) showToastr_ACU('warning', `最大并发数 "${valStr}" 无效。请输入一个大于0的整数。恢复为: ${settings_ACU.maxConcurrentGroups || 1}`);
          $maxConcurrentGroupsInput_ACU.val(settings_ACU.maxConcurrentGroups || 1);
      }
  }

   // [新增] 保存跳过更新楼层（全局）
   function saveSkipUpdateFloors_ACU({ silent = false, skipReload = false } = {}) {
       if (!$popupInstance_ACU || !$skipUpdateFloorsInput_ACU) {
           logError_ACU('保存跳过更新楼层失败：UI元素未初始化。');
           return;
       }
       const valStr = $skipUpdateFloorsInput_ACU.val();
       const newSkip = parseInt(valStr, 10);
 
       if (!isNaN(newSkip) && newSkip >= 0) {
           settings_ACU.skipUpdateFloors = newSkip;
           saveSettings_ACU();
           if (!silent) showToastr_ACU('success', '跳过更新楼层已保存！');
           if (!skipReload) loadSettings_ACU();
       } else {
           if (!silent) showToastr_ACU('warning', `跳过更新楼层 "${valStr}" 无效。请输入一个大于等于0的整数。恢复为: ${settings_ACU.skipUpdateFloors || 0}`);
           $skipUpdateFloorsInput_ACU.val(settings_ACU.skipUpdateFloors || 0);
       }
   }

   // [新增] 保存"保留最近N层数据"（全局）
   function saveRetainRecentLayers_ACU({ silent = false, skipReload = false } = {}) {
       if (!$popupInstance_ACU || !$retainRecentLayersInput_ACU) {
           logError_ACU('保存保留层数失败：UI元素未初始化。');
           return;
       }
       const valStr = $retainRecentLayersInput_ACU.val();
       const parsed = parseInt(valStr, 10);
       // 空字符串或无效值视为0（全部保留）
       const newRetain = (!valStr || valStr.trim() === '' || isNaN(parsed)) ? 0 : Math.max(0, parsed);

       settings_ACU.retainRecentLayers = newRetain;
       saveSettings_ACU();
       if (!silent) {
           if (newRetain === 0) {
               showToastr_ACU('success', '保留层数已清空（将保留全部历史数据）！');
           } else {
               showToastr_ACU('success', `保留层数已保存：最近 ${newRetain} 层！`);
           }
       }
       if (!skipReload) loadSettings_ACU();
   }

   // [新增] 清理超出保留层数的旧本地数据（表格数据 + 剧情推进数据）
   // 按AI楼层计数，仅保留最近N层的数据，更早楼层的 TavernDB_ACU_* 和 qrf_plot 字段将被删除
   // [重要] 此函数不会删除聊天第一层的"空白指导表"（TavernDB_ACU_InternalSheetGuide），
   //        指导表用于保存表头结构和填表参数，作为该聊天的总指导。
   async function purgeOldLayerData_ACU() {
       const retainCount = settings_ACU.retainRecentLayers || 0;
       // 0 或空 = 全部保留，不执行清理
       if (retainCount <= 0) {
           logDebug_ACU('[数据清理] retainRecentLayers 为 0 或未设置，跳过清理。');
           return;
       }

       const chat = SillyTavern_API_ACU?.chat;
       if (!chat || !Array.isArray(chat) || chat.length === 0) {
           logDebug_ACU('[数据清理] 聊天记录为空，跳过清理。');
           return;
       }

       // 1) 收集所有 包含本地数据(TavernDB_ACU_Data/qrf_plot) 的消息索引（按时间顺序，从旧到新）
       // [保护] 排除 chat[0]，确保第一层的指导表数据不被触及
       // [修改] 适配用户层保存逻辑：不再仅检查 AI 消息，而是检查所有可能包含数据的消息（包括用户消息）
       const dataMessageIndices = [];
       for (let i = 1; i < chat.length; i++) {
           const msg = chat[i];
           // 检查是否包含本插件生成的任何本地数据
           if (msg && (
               msg.TavernDB_ACU_Data ||
               msg.TavernDB_ACU_SummaryData ||
               msg.qrf_plot
           )) {
               dataMessageIndices.push(i);
           }
       }

       if (dataMessageIndices.length <= retainCount) {
           logDebug_ACU(`[数据清理] 含数据消息总数(${dataMessageIndices.length}) <= 保留层数(${retainCount})，无需清理。`);
           return;
       }

       // 2) 确定需要清理的楼层：保留最近 retainCount 层，清理更早的
      const cutoffIndex = dataMessageIndices.length - retainCount; // 从这个位置开始是要保留的
      // [优化] 移除"永远保留第一层"的逻辑，严格按照填写的楼层数来保留数据
      const indicesToPurge = dataMessageIndices.slice(0, cutoffIndex); // 这些是要清理的

      if (indicesToPurge.length === 0) {
          logDebug_ACU('[数据清理] 无需清理的楼层。');
           return;
       }

       logDebug_ACU(`[数据清理] 将清理 ${indicesToPurge.length} 层消息的本地数据（保留最近 ${retainCount} 层）...`);

       // 3) 遍历需要清理的楼层，删除本地数据字段
       let purgedCount = 0;
       const keysToDelete = [
           'TavernDB_ACU_Data',
           'TavernDB_ACU_SummaryData',
           'TavernDB_ACU_IndependentData',
           'TavernDB_ACU_ModifiedKeys',
           'TavernDB_ACU_UpdateGroupKeys',
           'TavernDB_ACU_IsolatedData',
           'TavernDB_ACU_Identity',
           'qrf_plot',
           'qrf_plot_preset'  // [新增] 清理剧情规划预设名称标签
       ];

       for (const idx of indicesToPurge) {
           const msg = chat[idx];
           if (!msg) continue;

           let modified = false;
           for (const key of keysToDelete) {
               if (msg.hasOwnProperty(key)) {
                   delete msg[key];
                   modified = true;
               }
           }

           if (modified) {
               purgedCount++;
           }
       }

       if (purgedCount > 0) {
           // 4) 保存聊天记录
           try {
               await SillyTavern_API_ACU.saveChat();
               logDebug_ACU(`[数据清理] 已清理 ${purgedCount} 层AI消息的本地数据，聊天记录已保存。`);
               // [优化] 移除自动清理后的提示框，避免打扰用户
           } catch (e) {
               logError_ACU('[数据清理] 保存聊天记录失败:', e);
           }
       } else {
           logDebug_ACU('[数据清理] 目标楼层中未发现需要清理的数据字段。');
       }
   }
 
   function saveImportSplitSize_ACU() {
       if (!$popupInstance_ACU) return;
      const $input = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-split-size`);
      if (!$input.length) {
          logError_ACU('保存导入分割大小失败：UI元素未初始化。');
          return;
      }
      const valStr = $input.val();
      const newSize = parseInt(valStr, 10);

      if (!isNaN(newSize) && newSize >= 100) {
          settings_ACU.importSplitSize = newSize;
          saveSettings_ACU();
          showToastr_ACU('success', '导入分割大小已保存！');
          loadSettings_ACU();
      } else {
          showToastr_ACU('warning', `导入分割大小 "${valStr}" 无效。请输入一个大于等于100的整数。恢复为: ${settings_ACU.importSplitSize}`);
          $input.val(settings_ACU.importSplitSize);
      }
  }

  async function fetchModelsAndConnect_ACU() {
    if (
      !$popupInstance_ACU ||
      !$customApiUrlInput_ACU ||
      !$customApiKeyInput_ACU ||
      !$customApiModelSelect_ACU ||
      !$apiStatusDisplay_ACU
    ) {
      logError_ACU('加载模型列表失败：UI元素未初始化。');
      showToastr_ACU('error', 'UI未就绪。');
      return;
    }
    const apiUrl = $customApiUrlInput_ACU.val().trim();
    const apiKey = $customApiKeyInput_ACU.val();
    if (!apiUrl) {
      showToastr_ACU('warning', '请输入API基础URL。');
      $apiStatusDisplay_ACU.text('状态:请输入API基础URL').css('color', 'orange');
      return;
    }
    const statusUrl = `/api/backends/chat-completions/status`;
    $apiStatusDisplay_ACU.text('状态: 正在检查API端点状态...').css('color', '#61afef');
    showToastr_ACU('info', '正在检查自定义API端点状态...');

    try {
        const body = {
            "reverse_proxy": apiUrl,
            "proxy_password": "",
            "chat_completion_source": "custom",
            "custom_url": apiUrl,
            "custom_include_headers": apiKey ? `Authorization: Bearer ${apiKey}` : ""
        };

        const response = await fetch(statusUrl, {
            method: 'POST',
            headers: { ...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = `API端点状态检查失败: ${response.status} ${response.statusText}.`;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage += ` 详情: ${errorJson.error || errorJson.message || errorText}`;
            } catch (e) {
                errorMessage += ` 详情: ${errorText}`;
            }
            throw new Error(errorMessage);
        }

      const data = await response.json();
      logDebug_ACU('获取到的模型数据:', data);
      // 保存当前选中的模型
      const currentSelectedModel = settings_ACU.apiConfig.model || '';
      // 清空select并添加默认选项
      $customApiModelSelect_ACU.empty().append('<option value="">-- 请选择模型 --</option>');
      let modelsFound = false;
      let modelsList = [];
      if (data && data.models && Array.isArray(data.models)) {
          // Format from Tavern's status endpoint: { models: [...] }
          modelsList = data.models;
      } else if (data && data.data && Array.isArray(data.data)) {
          // Format from OpenAI /v1/models endpoint: { data: [{id: ...}] }
          modelsList = data.data;
      } else if (Array.isArray(data)) {
          // Format from some providers that return a direct array: [...]
          modelsList = data;
      }

      if (modelsList.length > 0) {
        modelsFound = true;
        modelsList.forEach(model => {
          const modelName = typeof model === 'string' ? model : model.id;
          if (modelName) {
            const selected = modelName === currentSelectedModel ? ' selected' : '';
            $customApiModelSelect_ACU.append(`<option value="${escapeHtml_ACU(modelName)}"${selected}>${escapeHtml_ACU(modelName)}</option>`);
          }
        });
      }

      if (modelsFound) {
        // 如果之前保存的模型不在列表中，也添加进去
        if (currentSelectedModel && $customApiModelSelect_ACU.find(`option[value="${escapeHtml_ACU(currentSelectedModel)}"]`).length === 0) {
            $customApiModelSelect_ACU.append(`<option value="${escapeHtml_ACU(currentSelectedModel)}" selected>${escapeHtml_ACU(currentSelectedModel)} (已保存)</option>`);
        }
        showToastr_ACU('success', `模型列表加载成功！共加载 ${modelsList.length} 个模型。`);
      } else {
        showToastr_ACU('warning', '未能解析模型数据或列表为空。');
        $apiStatusDisplay_ACU.text('状态: 未能解析模型数据或列表为空。').css('color', 'orange');
      }
    } catch (error) {
      logError_ACU('加载模型列表时出错:', error);
      showToastr_ACU('error', `加载模型列表失败: ${error.message}`);
      $apiStatusDisplay_ACU.text(`状态: 加载模型失败 - ${error.message}`).css('color', '#ff6b6b');
    }
    updateApiStatusDisplay_ACU();
  }
  function updateApiStatusDisplay_ACU() {
    if (!$popupInstance_ACU || !$apiStatusDisplay_ACU) return;
    if (settings_ACU.apiConfig.url && settings_ACU.apiConfig.model)
      $apiStatusDisplay_ACU.html(
        `当前URL: <span style="color:lightgreen;word-break:break-all;">${escapeHtml_ACU(
          settings_ACU.apiConfig.url,
        )}</span><br>已选模型: <span style="color:lightgreen;">${escapeHtml_ACU(settings_ACU.apiConfig.model)}</span>`,
      );
    else if (settings_ACU.apiConfig.url)
      $apiStatusDisplay_ACU.html(
        `当前URL: ${escapeHtml_ACU(settings_ACU.apiConfig.url)} - <span style="color:orange;">请加载并选择模型</span>`,
      );
    else $apiStatusDisplay_ACU.html(`<span style="color:#ffcc80;">未配置自定义API。数据库更新功能可能不可用。</span>`);
  }
  function attemptToLoadCoreApis_ACU() {
    const parentWin = typeof window.parent !== 'undefined' ? window.parent : window;
    SillyTavern_API_ACU = typeof SillyTavern !== 'undefined' ? SillyTavern : parentWin.SillyTavern;
    TavernHelper_API_ACU = typeof TavernHelper !== 'undefined' ? TavernHelper : parentWin.TavernHelper;
    jQuery_API_ACU = typeof $ !== 'undefined' ? $ : parentWin.jQuery;
    toastr_API_ACU = parentWin.toastr || (typeof toastr !== 'undefined' ? toastr : null);
    coreApisAreReady_ACU = !!(
      SillyTavern_API_ACU &&
      TavernHelper_API_ACU &&
      jQuery_API_ACU &&
      TavernHelper_API_ACU.getChatMessages &&
      TavernHelper_API_ACU.getLastMessageId &&
      TavernHelper_API_ACU.getCurrentCharPrimaryLorebook &&
      TavernHelper_API_ACU.getLorebookEntries &&
      typeof TavernHelper_API_ACU.triggerSlash === 'function'
    );
    if (!toastr_API_ACU) logWarn_ACU('toastr_API_ACU is MISSING.');
    if (coreApisAreReady_ACU) logDebug_ACU('Core APIs successfully loaded/verified for AutoCardUpdater.');
    else logError_ACU('Failed to load one or more critical APIs for AutoCardUpdater.');
    return coreApisAreReady_ACU;
  }

  async function handleNewMessageDebounced_ACU(eventType = 'unknown_acu') {
    logDebug_ACU(
      `New message event (${eventType}) detected for ACU, debouncing for ${NEW_MESSAGE_DEBOUNCE_DELAY_ACU}ms...`,
    );
    clearTimeout(newMessageDebounceTimer_ACU);
    newMessageDebounceTimer_ACU = setTimeout(async () => {
      // [健全性] 如果用户已经开始对话，则解除“开场白阶段世界书注入抑制”
      try { maybeLiftWorldbookSuppression_ACU(); } catch (e) {}

      // [修复] 检查更新是否被用户手动终止，如果是，则跳过本次因终止操作而触发的更新检查
      // 注意：不要在这里重置标志，由终止按钮处理逻辑负责重置
      if (wasStoppedByUser_ACU) {
          logDebug_ACU('ACU: Skipping update check after user abort.');
          return;
      }
      logDebug_ACU('Debounced new message processing triggered for ACU.');
      if (isAutoUpdatingCard_ACU) {
        logDebug_ACU('ACU: Auto-update already in progress. Skipping.');
        return;
      }
      if (!coreApisAreReady_ACU) {
        logDebug_ACU('ACU: Core APIs not ready. Skipping.');
        return;
      }

      // [优化] 等待确认是当前角色的AI回复后再触发更新（类似剧情推进的逻辑）
      const liveChat = SillyTavern_API_ACU.chat;
      if (!liveChat || liveChat.length === 0) {
        logDebug_ACU('ACU: No chat data available. Skipping.');
        return;
      }

      const lastMessage = liveChat[liveChat.length - 1];
      
      // 如果最新消息不是AI回复，跳过
      if (!lastMessage || lastMessage.is_user) {
        logDebug_ACU('ACU: Last message is not an AI reply. Skipping.');
        return;
      }

      // 检查是否来自当前角色
      const activeChar = SillyTavern_API_ACU.characters?.[SillyTavern_API_ACU.this_chid];
      const activeCharName = activeChar?.name;
      if (activeCharName && lastMessage.name && lastMessage.name !== activeCharName) {
        logDebug_ACU(`ACU: AI reply from different character (${lastMessage.name} != ${activeCharName}). Skipping.`);
        return;
      }

      await loadAllChatMessages_ACU();
      // Removed call to applyActualMessageVisibility_ACU();
      
      // [新增] 正文优化：在填表之前执行
      const config = settings_ACU.contentOptimizationSettings || {};
      if (config.enabled) {
        const lastMessageIndex = liveChat.length - 1;
        logDebug_ACU('[正文优化] 检测到AI回复，准备执行正文优化...');
        
        if (config.parallelMode) {
          // 并行执行：正文优化和填表同时进行
          logDebug_ACU('[正文优化] 并行模式已启用，正文优化与填表将同时进行...');
          await Promise.all([
            executeContentOptimization_ACU(lastMessageIndex),
            triggerAutomaticUpdateIfNeeded_ACU()
          ]);
        } else if (!config.autoApply && !config.seamlessMode) {
          // 手动确认模式：只执行正文优化，填表在用户点击应用/取消后触发
          logDebug_ACU('[正文优化] 手动确认模式：等待用户确认后再填表...');
          await executeContentOptimization_ACU(lastMessageIndex);
          // 注意：不在这里触发填表，填表在 showOptimizationDiffDialog_ACU 中用户点击应用/取消后触发
        } else {
          // 顺序执行：先完成正文优化，再进行填表
          await executeContentOptimization_ACU(lastMessageIndex);
          await triggerAutomaticUpdateIfNeeded_ACU();
        }
      } else {
        await triggerAutomaticUpdateIfNeeded_ACU();
      }
    }, NEW_MESSAGE_DEBOUNCE_DELAY_ACU);
  }

  // [重构] 核心触发逻辑：基于独立表格参数的触发检查
  async function triggerAutomaticUpdateIfNeeded_ACU() {
    logDebug_ACU('ACU Auto-Trigger: Starting independent check...');

    if (!settings_ACU.autoUpdateEnabled) {
      logDebug_ACU('ACU Auto-Trigger: Auto update is disabled via settings. Skipping.');
      return;
    }

    const apiIsConfigured = (settings_ACU.apiMode === 'custom' && (settings_ACU.apiConfig.useMainApi || (settings_ACU.apiConfig.url && settings_ACU.apiConfig.model))) || (settings_ACU.apiMode === 'tavern' && settings_ACU.tavernProfile);

    if (!coreApisAreReady_ACU || isAutoUpdatingCard_ACU || !apiIsConfigured || !currentJsonTableData_ACU) {
      logDebug_ACU('ACU Auto-Trigger: Pre-flight checks failed.');
      return;
    }
    
    if (allChatMessages_ACU.length < 2) {
      logDebug_ACU('ACU Auto-Trigger: Chat history too short.');
      return;
    }

    let liveChat = SillyTavern_API_ACU.chat;
    if (!liveChat || liveChat.length === 0) return;
    const lastLiveMessage = liveChat[liveChat.length - 1];

    let totalAiMessages = liveChat.filter(m => !m.is_user).length;

    // Floor increase delay logic...
    if (totalAiMessages > lastTotalAiMessages_ACU) {
        logDebug_ACU(`ACU: AI Message count increased (${lastTotalAiMessages_ACU} -> ${totalAiMessages}). Waiting ${AUTO_UPDATE_FLOOR_INCREASE_DELAY_ACU}ms...`);
        await new Promise(resolve => setTimeout(resolve, AUTO_UPDATE_FLOOR_INCREASE_DELAY_ACU));
        
        liveChat = SillyTavern_API_ACU.chat;
        if (!liveChat || liveChat.length === 0) return;
        totalAiMessages = liveChat.filter(m => !m.is_user).length;
        
        lastTotalAiMessages_ACU = totalAiMessages;
    } else if (totalAiMessages < lastTotalAiMessages_ACU) {
         lastTotalAiMessages_ACU = totalAiMessages;
    }

    // 独立表格检查
    const tablesToUpdate = []; // [{sheetKey, updateConfig, indicesToUpdate}]
      const sheetKeys = getSortedSheetKeys_ACU(currentJsonTableData_ACU);

    // 预计算所有 AI 消息索引
    const allAiMessageIndices = liveChat
        .map((msg, index) => !msg.is_user ? index : -1)
        .filter(index => index !== -1);

    // [新增] 检查数据库是否为空（初始化状态）
    let isDatabaseEmpty = true;
    for (const key of sheetKeys) {
        const table = currentJsonTableData_ACU[key];
        // 只要有一个表有数据（行数 > 1），就不算空
        if (table && table.content && table.content.length > 1) {
            isDatabaseEmpty = false;
            break;
        }
    }

    if (isDatabaseEmpty && allAiMessageIndices.length > 0) {
        logDebug_ACU('ACU Auto-Trigger: Database is empty (First Floor scenario). Will use normal frequency-based update logic.');
        // [优化] 不再强制触发所有表格的更新
        // 因为在 proceedWithCardUpdate_ACU 中已经优化了首次初始化时保存完整模板结构的逻辑
        // 即使某些表因为频率设置没有被触发，也会以空表的形式保存到聊天记录中
        // 这样后续更新就有了完整的基底
    }
    
    // [优化] 统一使用频率逻辑，无论是否是首次初始化
    {
        // 遍历每个表格，检查是否满足其独立更新条件
        for (const sheetKey of sheetKeys) {
            const table = currentJsonTableData_ACU[sheetKey];
            if (!table) continue;

            const tableConfig = table.updateConfig || {};
            const isSummary = isSummaryOrOutlineTable_ACU(table.name);
            
            // 统一的全局默认参数（不再区分标准/总结）
            const globalFrequency = settings_ACU.autoUpdateFrequency || 1;
            const globalSkip = settings_ACU.skipUpdateFloors || 0;

            // 获取该表的更新配置 (优先使用表内配置，否则使用全局默认)
            // -1 = 沿用UI全局；0 = 合法值（其中 updateFrequency=0 表示该表不参与自动更新）
            const rawDepth = Number.isFinite(tableConfig.contextDepth) ? tableConfig.contextDepth : -1;
            const rawFreq = Number.isFinite(tableConfig.updateFrequency) ? tableConfig.updateFrequency : -1;
            const rawSkip = Number.isFinite(tableConfig.skipFloors) ? tableConfig.skipFloors : -1;
            const rawBatch = Number.isFinite(tableConfig.batchSize) ? tableConfig.batchSize : -1;
            const rawGroupId = Number.isFinite(tableConfig.groupId) ? Math.trunc(tableConfig.groupId) : -1;

            // contextDepth: -1=沿用UI；0 视为“未设置/沿用UI”（避免与“禁用自动更新”的语义混淆）
            const threshold = (rawDepth === -1 || rawDepth === 0) ? (settings_ACU.autoUpdateThreshold || 3) : Math.max(0, rawDepth);
            const frequency = (rawFreq === -1) ? globalFrequency : rawFreq;
            const skipFloors = Math.max(0, (rawSkip === -1) ? globalSkip : rawSkip);
            const groupId = rawGroupId;
            // batchSize 在实际执行时使用，这里仅用于分组

            // [修复] 获取该表上次更新的 AI 楼层数：不再依赖缓存，而是直接扫描聊天记录
            // 参考 updateCardUpdateStatusDisplay_ACU 的逻辑，确保判断一致性
            let lastUpdatedAiFloor = 0;
            
            // [数据隔离核心] 获取当前隔离标签键名
            const triggerIsolationKey = getCurrentIsolationKey_ACU();

            for (let i = liveChat.length - 1; i >= 0; i--) {
                const msg = liveChat[i];
                if (msg.is_user) continue;

                let wasUpdated = false;
                
                // [优先级1] 检查新版按标签分组存储 TavernDB_ACU_IsolatedData
                if (msg.TavernDB_ACU_IsolatedData && msg.TavernDB_ACU_IsolatedData[triggerIsolationKey]) {
                    const tagData = msg.TavernDB_ACU_IsolatedData[triggerIsolationKey];
                    const modifiedKeys = tagData.modifiedKeys || [];
                    const updateGroupKeys = tagData.updateGroupKeys || [];
                    const independentData = tagData.independentData || {};
                    
                    if (updateGroupKeys.length > 0 && modifiedKeys.length > 0) {
                        wasUpdated = updateGroupKeys.includes(sheetKey);
                    } else if (modifiedKeys.length > 0) {
                        wasUpdated = modifiedKeys.includes(sheetKey);
                    } else if (independentData[sheetKey]) {
                        wasUpdated = true;
                    }
                }
                
                // [优先级2] 兼容旧版存储格式 - 严格匹配隔离标签
                if (!wasUpdated) {
                    const msgIdentity = msg.TavernDB_ACU_Identity;
                    let isLegacyMatch = false;
                    if (settings_ACU.dataIsolationEnabled) {
                        isLegacyMatch = (msgIdentity === settings_ACU.dataIsolationCode);
                    } else {
                        // 关闭隔离（无标签模式）：只匹配无标识数据
                        isLegacyMatch = !msgIdentity;
                    }
                    
                    if (isLegacyMatch) {
                        const modifiedKeys = msg.TavernDB_ACU_ModifiedKeys || [];
                        const updateGroupKeys = msg.TavernDB_ACU_UpdateGroupKeys || [];
                        
                        if (updateGroupKeys.length > 0 && modifiedKeys.length > 0) {
                            wasUpdated = updateGroupKeys.includes(sheetKey);
                        } else if (modifiedKeys.length > 0) {
                            wasUpdated = modifiedKeys.includes(sheetKey);
                        } else {
                            // 旧版兼容：没有 ModifiedKeys 字段时，回退到检查数据是否存在
                            if (msg.TavernDB_ACU_IndependentData && msg.TavernDB_ACU_IndependentData[sheetKey]) {
                                wasUpdated = true;
                            }
                            else if (isSummary && msg.TavernDB_ACU_SummaryData && msg.TavernDB_ACU_SummaryData[sheetKey]) {
                                wasUpdated = true;
                            }
                            else if (!isSummary && msg.TavernDB_ACU_Data && msg.TavernDB_ACU_Data[sheetKey]) {
                                wasUpdated = true;
                            }
                        }
                    }
                }

                if (wasUpdated) {
                    // 计算这是第几个 AI 回复
                    lastUpdatedAiFloor = liveChat.slice(0, i + 1).filter(m => !m.is_user).length;
                    break;
                }
            }
            
            // 计算未记录楼层数
            // [修复] 根据用户反馈，触发判断必须考虑跳过楼层。
            // 逻辑：(当前总层数 - 跳过层数) - 上次更新层数 >= 频率
            // 例如：Last=12, Freq=2, Skip=1. NextTrigger = 12 + 2 + 1 = 15.
            // 当 Total=15 时, (15 - 1) - 12 = 2 >= 2. 触发。
            
            const effectiveUnrecordedFloors = Math.max(0, (totalAiMessages - skipFloors) - lastUpdatedAiFloor);

            logDebug_ACU(`[Trigger Check] Table: ${table.name}, TotalAI: ${totalAiMessages}, Skip: ${skipFloors}, LastUpdated: ${lastUpdatedAiFloor}, Unrecorded: ${effectiveUnrecordedFloors}, Freq: ${frequency}`);

            // updateFrequency=0：该表不参与自动更新
            if (frequency > 0 && effectiveUnrecordedFloors >= frequency && threshold > 0) {
                // 需要更新
                // 计算需要更新的具体消息索引
                // 范围：从 (lastUpdatedAiFloor 对应的索引 + 1) 开始，到最新
                // 且必须在 Context Depth 范围内
                
                // 计算有效范围的截止点（跳过楼层处理）
                // 注意：globalSkip 意味着最新的 N 条消息不应被考虑进更新范围，或者说更新应该滞后 N 条。
                // 但实际上，我们通常希望跳过的是“不计算在触发条件内”的楼层，一旦触发，还是应该读取最新的。
                // 不过根据“跳过更新楼层”的定义，通常是指最新的 N 层暂不更新。
                // [修复] 计算 effectiveAiIndices 时，如果 globalSkip 为 0，slice(0, length) 是对的。
                // 但如果 globalSkip > 0，slice(0, length - skip) 也是对的。
                // 问题在于，当 globalSkip 很大，或者总楼层很少时，可能导致 effectiveAiIndices 为空。
                // 此外，contextScopeIndices 应该是基于 effectiveAiIndices 的末尾往前推，还是基于实际最新消息往前推？
                // 通常 Context Depth 是指 AI 能看到的“最新”上下文。
                // 如果我们跳过了最新的 N 层，那么 AI 看到的应该是“被跳过之后的最新”？
                // 不，contextDepth 是物理限制。AI 只能看到最新的 M 条消息。
                // 如果我们跳过了最新的 N 条，且 N < M，那么我们实际上是让 AI 去更新它“能看到但还未更新”的部分。
                // 如果 N >= M，那么我们要更新的内容已经超出了 AI 的可视范围（太旧了），理论上无法更新。
                
                // [核心重构] 跳过楼层的上下文处理逻辑
                // 用户反馈：跳过楼层参数被设置时，上下文读取就应该以跳过楼层参数设置后的对应楼层为基数往上进行读取
                
                // 1. 计算有效范围的截止点（跳过楼层处理）
                const effectiveAiIndices = skipFloors > 0
                    ? allAiMessageIndices.slice(0, -skipFloors)
                    : allAiMessageIndices;
                
                // 确定该表上次更新在 chat history 中的 index
                // lastUpdatedAiFloor 是数量，作为索引正好指向“下一个”
                const startIndexInAiArray = lastUpdatedAiFloor;
                
                logDebug_ACU(`[Trigger Check] EffIndicesLen: ${effectiveAiIndices.length}, StartIndex: ${startIndexInAiArray}`);

                if (startIndexInAiArray < effectiveAiIndices.length) {
                    const unupdatedAiIndices = effectiveAiIndices.slice(startIndexInAiArray);
                    
                    // [修复] Context Scope 的计算基准
                    // 根据用户要求，上下文读取应该以“跳过楼层后的有效末尾”为基准，往上回溯 threshold 层。
                    // 这样即使 globalSkip 很大，我们处理旧楼层时，也能读取到以该旧楼层为终点的上下文，
                    // 而不是被迫去读它可能够不着的最新实时消息。
                    
                    const contextScopeIndices = effectiveAiIndices.slice(-threshold);
                    const contextScopeSet = new Set(contextScopeIndices);
                    
                    logDebug_ACU(`[Trigger Check] Unupdated: ${unupdatedAiIndices.length}, ContextScope: ${contextScopeIndices.length}`);

                    const indicesToUpdate = unupdatedAiIndices.filter(idx => contextScopeSet.has(idx));
                    
                    if (indicesToUpdate.length > 0) {
                        tablesToUpdate.push({
                            sheetKey,
                            sheetName: table.name,
                            indices: indicesToUpdate,
                            groupId,
                            // batchSize: -1=沿用UI；<=0 兜底到 UI，避免 0 导致死循环切片
                            batchSize: (rawBatch === -1) ? (settings_ACU.updateBatchSize || 3) : ((rawBatch > 0) ? rawBatch : (settings_ACU.updateBatchSize || 3))
                        });
                    }
                } else {
                    // [调试] 如果没有需要更新的索引，记录原因
                    // logDebug_ACU(`Table ${table.name}: Skipped. Unupdated indices [${unupdatedAiIndices.join(',')}] are outside context scope [${contextScopeIndices.join(',')}].`);
                }
            }
        }
    }

    if (tablesToUpdate.length === 0) return;

    // [优化] 分组执行
    // 将待更新的表按 (groupId + indices + batchSize) 进行分组，以便不同编号的表拆分并发
    // Key: groupId + '|' + indices.join(',') + '|' + batchSize
    const updateGroups = {};
    
    tablesToUpdate.forEach(item => {
        const key = item.groupId + '|' + item.indices.join(',') + '|' + item.batchSize;
        if (!updateGroups[key]) {
            updateGroups[key] = {
                indices: item.indices,
                batchSize: item.batchSize,
                groupId: item.groupId,
                sheetKeys: [],
                sheetNames: []
            };
        }
        updateGroups[key].sheetKeys.push(item.sheetKey);
        updateGroups[key].sheetNames.push(item.sheetName);
    });

    // 执行更新
    const groupKeys = Object.keys(updateGroups);
    if (groupKeys.length > 0) {
        const totalGroups = groupKeys.length;
        const maxConcurrentGroups = Math.max(1, settings_ACU.maxConcurrentGroups || 1);
        const needsChunking = totalGroups > maxConcurrentGroups;
        if (needsChunking) {
            showToastr_ACU('info', `检测到 ${tablesToUpdate.length} 个表格需要更新，将分批并发处理 ${totalGroups} 组（每批最多 ${maxConcurrentGroups} 组）。`);
        } else {
            showToastr_ACU('info', `检测到 ${tablesToUpdate.length} 个表格需要更新，将并发处理 ${totalGroups} 组。`);
        }
        
        isAutoUpdatingCard_ACU = true;
        
        const failedGroupKeys = [];
        for (let start = 0; start < groupKeys.length; start += maxConcurrentGroups) {
            const chunkKeys = groupKeys.slice(start, start + maxConcurrentGroups);
            const groupPromises = chunkKeys.map(key => (async () => {
                const group = updateGroups[key];
                // 构造一个临时的 updateMode 对象或字符串，传递给 processUpdates_ACU
                // 这里我们需要一种方式告诉 processUpdates_ACU 只更新特定的 sheetKeys
                // 我们将通过一个新的参数 'specific_sheets' 传递
                
                logDebug_ACU(`[Parallel] Processing group update for groupId=${group.groupId}, sheets: ${group.sheetNames.join(', ')}`);
                
                const success = await processUpdates_ACU(group.indices, 'auto_independent', {
                    targetSheetKeys: group.sheetKeys,
                    batchSize: group.batchSize,
                    requestOptions: { skipProfileSwitch: true, forceDirectApi: true }
                });
                
                return { key, success, sheetNames: group.sheetNames };
            })());
            
            const results = await Promise.allSettled(groupPromises);
            results.forEach((result, idx) => {
                if (result.status === 'rejected' || !result.value?.success) {
                    failedGroupKeys.push(chunkKeys[idx]);
                }
            });
        }
        
        if (failedGroupKeys.length > 0) {
            logWarn_ACU(`并发分组更新失败 ${failedGroupKeys.length}/${totalGroups} 组。`);
            showToastr_ACU('warning', `并发分组更新有 ${failedGroupKeys.length} 组失败，请查看日志。`);
        }
        
        // [核心修复] 并发更新完成后统一刷新数据链条
        logDebug_ACU(`All group updates completed. Forcing data refresh...`);
        await loadAllChatMessages_ACU();
        await refreshMergedDataAndNotify_ACU();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        isAutoUpdatingCard_ACU = false;
        // 最后再刷新一次，确保 UI 状态最新
        await refreshMergedDataAndNotify_ACU();

        // [新增] 在自动更新全部完成后检测自动合并总结
        try {
            await checkAndTriggerAutoMergeSummary_ACU();
        } catch (e) {
            logWarn_ACU('自动合并总结检测失败:', e);
        }

        // [新增] 自动更新完成后，检查并清理超出保留层数的旧数据
        try {
            await purgeOldLayerData_ACU();
        } catch (e) {
            logWarn_ACU('清理旧层数据失败:', e);
        }
    }
  }

  // [新增] 手动更新时采集一次性额外提示词
  function collectManualExtraHint_ACU() {
      manualExtraHint_ACU = '';
      if (!$manualExtraHintCheckbox_ACU || !$manualExtraHintCheckbox_ACU.length) return;
      if (!$manualExtraHintCheckbox_ACU.is(':checked')) return;

      const userInput = prompt('请输入本次手动填表的额外提示词（可留空）：', '');
      const trimmed = (userInput || '').trim();
      if (!trimmed) return;

      manualExtraHint_ACU = `以下为用户的额外填表要求，请严格遵守：${trimmed}`;
  }

  // [新增] 获取当前选中的手动更新表格列表（无效或为空则回退为全部表）
  function getSelectedManualSheetKeys_ACU() {
      if (!currentJsonTableData_ACU) return [];
      const availableKeys = getSortedSheetKeys_ACU(currentJsonTableData_ACU);
      const saved = Array.isArray(settings_ACU.manualSelectedTables) ? settings_ACU.manualSelectedTables : [];

      // 未曾手动选择过：默认全选
      if (!settings_ACU.hasManualSelection) return availableKeys;

      const validSaved = saved.filter(k => availableKeys.includes(k));

      // 已手动选择过：严格按保存的交集，不再自动补全新表，防止回退全选
      return validSaved;
  }

  // [新增] 渲染手动更新表格复选框