  // [已迁移到 src/shared/utils.ts] cleanChatName_ACU

  // [已迁移到 src/shared/utils.ts] deepMerge_ACU

  // [关键修复] 解析表格模板：支持去注释，并可选择"仅保留表头行"
  // 目的：模板允许携带示例/预置数据，但这些数据不应在"当前对话/角色卡没有数据库记录"时被当作真实数据注入世界书。
  // [已迁移到 shared/utils.ts] stripSeedRowsFromTemplate_ACU

  // [已迁移到 shared/utils.ts] parseTableTemplateJson_ACU

  // [表格顺序新机制] 在数据对象上应用"按给定 keys 顺序重编号"
  // [已迁移到 shared/utils.ts] applySheetOrderNumbers_ACU

  // [表格顺序新机制] 确保对象里的所有 sheet_ 都有合法编号（用于模板载入/导入/兼容旧数据）
  // [已迁移到 shared/utils.ts] ensureSheetOrderNumbers_ACU

  // [表格顺序新机制] 读取模板里 sheet_ keys 的顺序（按编号升序；缺失则按当前键顺序并补齐编号）
  // [已迁移到 shared/utils.ts] getTemplateSheetKeys_ACU

  // =========================
  // [新增] 聊天记录第一层：空白"指导表"（仅表头+参数，无数据行）
  // 目标：
  // - 不再维护"表头清单"这种轻量结构，而是保存一份"包含所有表格的更新参数/表头/顺序"的空白表集合
  // - 仅用于本插件：为表格编辑/填表参数提供稳定来源；不暴露到 exportTableAsJson 等外部接口
  // - 保存位置：chat[0]（第一层消息对象）上挂载一个内部字段
  // - 按隔离标签分槽：tags[isolationKey]
  // 备注：此处的"空白表"指 content 只保留表头行（content[0]），不含任何数据行
  // =========================
  // [已迁移到 data/storage/chat-history.ts] CHAT_SHEET_GUIDE_FIELD_ACU, CHAT_SHEET_GUIDE_VERSION_ACU, LEGACY_CHAT_TABLE_HEADER_GUIDE_FIELD_ACU, CHAT_SCOPED_CONFIG_FIELD_ACU, CHAT_SCOPED_CONFIG_VERSION_ACU, CHAT_TEMPLATE_ARCHIVE_OPTION_PREFIX_ACU, MAX_CHAT_TEMPLATE_ARCHIVES_PER_TAG_ACU

  // [已迁移到 shared/utils.ts] getChatFirstLayerMessage_ACU

  // [已迁移到 shared/utils.ts] cloneScopedConfigData_ACU

  // [已迁移到 data/storage/chat-history.ts] getChatScopedConfigContainer_ACU, normalizeChatScopedConfigContainer_ACU

  // [已迁移到 service/template/chat-scope.ts] 模板/剧情作用域CRUD + Sheet Guide + sanitize (~60个函数)
  // [已迁移到 service/runtime/helpers-remaining.ts] 剩余全部函数 (~143个)
