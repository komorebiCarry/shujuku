  async function processUpdates_ACU(indicesToUpdate, mode = 'auto', options = {}) {
      if (!indicesToUpdate || indicesToUpdate.length === 0) {
          return true;
      }

      const { targetSheetKeys, batchSize: specificBatchSize, requestOptions } = options;

      isAutoUpdatingCard_ACU = true;

      // [新增] 根据更新模式选择不同的批处理大小和阈值
      const isSummaryMode = (mode && (mode.includes('summary') || mode === 'manual_summary')) || false;
      // 优先使用传入的 specificBatchSize，否则使用全局批处理大小
      const batchSize = specificBatchSize || (settings_ACU.updateBatchSize || 2);
      
      const batches = [];
      for (let i = 0; i < indicesToUpdate.length; i += batchSize) {
          batches.push(indicesToUpdate.slice(i, i + batchSize));
      }

      logDebug_ACU(`[${mode}] Processing ${indicesToUpdate.length} updates in ${batches.length} batches of size ${batchSize} (${isSummaryMode ? '总结表模式' : '标准表模式'}). Target Sheets: ${targetSheetKeys ? targetSheetKeys.length : 'All'}`);

      let overallSuccess = true;
      const chatHistory = SillyTavern_API_ACU.chat || [];

          for (let i = 0; i < batches.length; i++) {
              const batchIndices = batches[i];
              const batchNumber = i + 1;
              const totalBatches = batches.length;
              const firstMessageIndexOfBatch = batchIndices[0];
              const lastMessageIndexOfBatch = batchIndices[batchIndices.length - 1];

          // [逻辑修正] 保存目标应始终是当前处理批次的最后一个消息。
          // “跳过楼层”参数仅影响触发时机和读取的上下文，不影响保存位置。
          const finalSaveTargetIndex = lastMessageIndexOfBatch;

          // 1. 加载基础数据库：从当前批次开始的位置往前找每个表格的最新记录
          // [核心修复] 多批次更新时，必须为每个表格单独查找其最新数据
          // 这确保了即使上一批次只更新了部分表格，当前批次也能获得所有表格的完整数据
          
          // Step 1: 优先使用聊天记录的"空白指导表"作为基础，否则回退到模板
          // [关键修复] 用户切换模板后回到聊天记录时，应使用该聊天的指导表，而不是新模板
          let mergedBatchData = null;
          try {
              const batchIsoKey = getCurrentIsolationKey_ACU();
              const sheetGuideForBatch = getChatSheetGuideDataForIsolationKey_ACU(batchIsoKey);
              if (sheetGuideForBatch && typeof sheetGuideForBatch === 'object' && Object.keys(sheetGuideForBatch).some(k => k.startsWith('sheet_'))) {
                  // 使用聊天记录的指导表作为基础（深拷贝）
                  mergedBatchData = buildGuidedBaseDataFromSheetGuide_ACU(sheetGuideForBatch);
                  logDebug_ACU(`[Batch ${batchNumber}] Using chat sheet guide as merge base.`);
              } else {
                  // [兜底] 没有指导表时使用模板（header-only）
                  mergedBatchData = parseTableTemplateJson_ACU({ stripSeedRows: true });
                  logDebug_ACU(`[Batch ${batchNumber}] No chat sheet guide found, using template as merge base.`);
              }
          } catch (e) {
              logError_ACU(`[Batch ${batchNumber}] Failed to build merge base from guide/template.`, e);
              showToastr_ACU('error', "无法构建合并基底，操作已终止。");
              overallSuccess = false;
              break;
          }
          if (!mergedBatchData) {
              showToastr_ACU('error', "无法构建合并基底，操作已终止。");
              overallSuccess = false;
              break;
          }

          // [修复] 使用指导表感知的排序获取 keys
          const batchSheetKeys = getSortedSheetKeys_ACU(mergedBatchData);
          
          // [数据隔离核心] 获取当前隔离标签键名
          const batchIsolationKey = getCurrentIsolationKey_ACU();

          // Step 2: 为每个表格单独查找该批次开始位置之前的最新数据
          // 使用 map 跟踪每个表格是否已找到
          const batchFoundSheets = {};
          batchSheetKeys.forEach(k => batchFoundSheets[k] = false);

          // 遍历当前批次开始位置之前的所有消息
          for (let j = firstMessageIndexOfBatch - 1; j >= 0; j--) {
              const msg = chatHistory[j];
              if (msg.is_user) continue;
              
              // [优先级1] 检查新版按标签分组存储 TavernDB_ACU_IsolatedData
              if (msg.TavernDB_ACU_IsolatedData && msg.TavernDB_ACU_IsolatedData[batchIsolationKey]) {
                  const tagData = msg.TavernDB_ACU_IsolatedData[batchIsolationKey];
                  const independentData = tagData.independentData || {};
                  
                  Object.keys(independentData).forEach(storedSheetKey => {
                      if (batchFoundSheets[storedSheetKey] === false && mergedBatchData[storedSheetKey]) {
                          mergedBatchData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                          batchFoundSheets[storedSheetKey] = true;
                      }
                  });
              }
              
              // [优先级2] 兼容旧版存储格式 - 严格匹配隔离标签
              // [数据隔离核心逻辑] 无标签也是标签的一种，严格隔离不同标签的数据
              const msgIdentity = msg.TavernDB_ACU_Identity;
              let isLegacyMatch = false;
              if (settings_ACU.dataIsolationEnabled) {
                  isLegacyMatch = (msgIdentity === settings_ACU.dataIsolationCode);
              } else {
                  // 关闭隔离（无标签模式）：只匹配无标识数据
                  isLegacyMatch = !msgIdentity;
              }

              if (isLegacyMatch) {
                  // 检查旧版独立数据格式
                  if (msg.TavernDB_ACU_IndependentData) {
                      const independentData = msg.TavernDB_ACU_IndependentData;
                      Object.keys(independentData).forEach(storedSheetKey => {
                          if (batchFoundSheets[storedSheetKey] === false && mergedBatchData[storedSheetKey]) {
                              mergedBatchData[storedSheetKey] = JSON.parse(JSON.stringify(independentData[storedSheetKey]));
                              batchFoundSheets[storedSheetKey] = true;
                          }
                      });
                  }
                  
                  // 检查旧版标准表存储格式
                  if (msg.TavernDB_ACU_Data) {
                      const standardData = msg.TavernDB_ACU_Data;
                      Object.keys(standardData).forEach(k => {
                          if (k.startsWith('sheet_') && batchFoundSheets[k] === false && mergedBatchData[k]) {
                              mergedBatchData[k] = JSON.parse(JSON.stringify(standardData[k]));
                              batchFoundSheets[k] = true;
                          }
                      });
                  }
                  
                  // 检查旧版总结表存储格式
                  if (msg.TavernDB_ACU_SummaryData) {
                      const summaryData = msg.TavernDB_ACU_SummaryData;
                      Object.keys(summaryData).forEach(k => {
                          if (k.startsWith('sheet_') && batchFoundSheets[k] === false && mergedBatchData[k]) {
                              mergedBatchData[k] = JSON.parse(JSON.stringify(summaryData[k]));
                              batchFoundSheets[k] = true;
                          }
                      });
                  }
              }

              // 如果所有表格都找到了，提前结束搜索
              if (Object.values(batchFoundSheets).every(v => v === true)) {
                  break;
              }
          }

          // 将合并后的数据赋值给全局变量
          currentJsonTableData_ACU = mergedBatchData;
          
          // 统计找到的表格数量
          const foundCount = Object.values(batchFoundSheets).filter(v => v === true).length;
          const totalCount = batchSheetKeys.length;
          logDebug_ACU(`[Batch ${batchNumber}] Loaded ${foundCount}/${totalCount} tables from history before index ${firstMessageIndexOfBatch}. Missing tables will use template structure (header-only).`);

          // 2. 计算上下文范围
          // [修复] 在批量处理模式下，上下文应仅包含当前批次的消息（以及其前置的用户消息），
          // 而不是基于 threshold 回溯包含之前批次的消息。
          // 数据库状态已经通过上面的加载逻辑更新到了上一批次的结尾，因此AI只需要阅读当前批次的增量内容。
          
          let sliceStartIndex = firstMessageIndexOfBatch;

          // 尝试包含当前批次第一条AI消息之前的用户消息（如果是用户发言的话）
          // 这有助于AI理解对话上下文
          if (sliceStartIndex > 0 && chatHistory[sliceStartIndex - 1]?.is_user) {
              sliceStartIndex--;
              logDebug_ACU(`[Batch ${batchNumber}] Adjusted slice start to ${sliceStartIndex} to include preceding user message.`);
          }

          const messagesForContext = chatHistory.slice(sliceStartIndex, lastMessageIndexOfBatch + 1);
          
          // [优化] 检测最新AI回复的长度，而非整个上下文
          // 获取当前批次中最后一条AI消息的内容长度
          const lastAiMessageInBatch = chatHistory[lastMessageIndexOfBatch];
          const lastAiMessageContent = lastAiMessageInBatch?.mes || lastAiMessageInBatch?.message || '';
          const lastAiMessageLength = lastAiMessageContent.length;
          const minReplyLength = settings_ACU.autoUpdateTokenThreshold || 0;
                   
          // [新增] 静默模式判断逻辑：
          // - 自动更新模式 (auto_*) + 用户开启静默开关：不显示进度框
          // - 手动更新模式 (manual_*)：无论静默开关如何，始终显示进度框
          const isAutoUpdateMode = mode && mode.startsWith('auto');
          const isManualMode = mode && mode.startsWith('manual');
          const isSilentMode = isAutoUpdateMode && !!settings_ACU.toastMuteEnabled;
                    
          // [修复] 检查最新AI回复长度阈值，仅适用于自动更新模式
                 // 手动更新模式 (manual_*) 强制执行，忽略阈值
                 // [修复 2026-02-28] 使用 isAutoUpdateMode 变量替代硬编码的模式列表，确保所有 auto_* 模式（包括 auto_independent）都被覆盖
          if (isAutoUpdateMode && lastAiMessageLength < minReplyLength) {
              logDebug_ACU(`[Auto] Batch ${batchNumber}/${totalBatches} skipped: Last AI reply length (${lastAiMessageLength}) is below threshold (${minReplyLength}).`);
              // [新增] 静默模式下不显示跳过提示
              if (!isSilentMode) {
                  showToastr_ACU('info', `最新AI回复过短 (${lastAiMessageLength} 字符)，跳过自动更新。`);
              }
              continue; // 跳过此批次，但不算失败
          }

          // 3. 执行更新并保存
          // [修复] 根据 mode 判断更新模式：
          // - 'auto_unified' 表示参数一致时的统一更新模式，使用 'full'，不屏蔽任何表
          // - 'auto_standard' 或 'auto' 表示标准表更新模式，使用 'standard'，屏蔽总结表
          // - 包含 'summary' 或 'manual_summary' 表示总结表更新模式，使用 'summary'，屏蔽标准表
          // [修复] 根据 mode 判断更新模式：
          // - 'auto_unified' 或 'manual_unified' 表示参数一致时的统一更新模式，使用 'full'，不屏蔽任何表
          // - 其他模式保留 auto/manual 前缀，以便 downstream 区分
          let updateMode = 'auto_standard'; // Default
          if (mode === 'auto_unified' || mode === 'manual_unified' || mode === 'full') {
              updateMode = mode;
          } else if (mode === 'auto_summary_silent') {
              updateMode = 'auto_summary_silent';
          } else if (mode && mode.startsWith('manual')) {
            // manual_standard, manual_summary, manual_independent
            if (mode.includes('summary')) updateMode = 'manual_summary';
            else if (mode === 'manual_independent') updateMode = 'manual_independent';
            else updateMode = 'manual_standard';
        } else {
              // auto_independent, auto, etc.
              if (mode && mode.includes('summary')) updateMode = 'auto_summary';
              else updateMode = 'auto_standard';
          }

          // [新增] 总结表静默更新时不显示toast提示
          const toastMessage = isSilentMode ? '' : `正在处理 ${isManualMode ? '手动' : '自动'} 更新 (${batchNumber}/${totalBatches})...`;
          // [修复] 传递 targetSheetKeys 到 proceedWithCardUpdate_ACU
          const success = await proceedWithCardUpdate_ACU(messagesForContext, toastMessage, finalSaveTargetIndex, false, updateMode, isSilentMode, targetSheetKeys, requestOptions);

          if (!success) {
              // [新增] 静默模式下不显示错误提示
              if (!isSilentMode) {
                  showToastr_ACU('error', `批处理在第 ${batchNumber} 批时失败或被终止。`);
              }
              overallSuccess = false;
                          break;
                      }
      }

      // 自动合并总结检测已移至更高层级调用处

      isAutoUpdatingCard_ACU = false;
      return overallSuccess;
  }

  // [新增] 自动合并纪要检测函数