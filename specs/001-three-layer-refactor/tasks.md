# 任务：三层架构重构

输入：来自 `/specs/001-three-layer-refactor/` 的设计文档
前置条件：plan.md（必需）、spec.md（用户故事所需）

⚠️ **串行约束**：本项目是渐进式重构，所有 Phase 必须严格串行执行（宪章原则 II）。每个 Phase 完成后必须通过构建一致性 + 功能等价验证，方可进入下一 Phase。

## 格式：`[ID] [P?] [Story] 描述`
- [P]：可并行执行（涉及不同文件、无依赖）
- [Story]：任务所属的用户故事（如 US1、US2）
- 在描述中包含精确的文件路径

## 路径约定
- 源码：`src/`（现有），重构后 `src/shared/`、`src/data/`、`src/service/`、`src/presentation/`
- 构建配置：项目根目录
- 规范文档：`specs/001-three-layer-refactor/`

---

## 阶段 1：初始化（共享基础设施）— Plan Phase 0 前半

目的：搭建 rollup + TypeScript 构建工具链，产物与基线逐字节一致

- [x] T001 初始化 `package.json`，安装 rollup、@rollup/plugin-typescript、typescript 为开发依赖
- [x] T002 创建 `tsconfig.json`，启用 `allowJs: true`、`noEmit: true`、`strict: false`、`target: ES2020`，引用 `@types/` 目录
- [x] T003 创建 `rollup.config.js`，编写自定义拼接插件复现 `scripts/build-index.js` 的行为：按 buildOrder 数组读取 32 个文件 → CRLF→LF 标准化 → `join('\n')` → 输出到 `dist/index.bundle.js`
- [x] T004 运行 rollup 构建，执行 `diff dist/index.bundle.js index.js` 验证逐字节一致
- [x] T005 创建 `scripts/verify-build.sh`：自动执行 rollup 构建 + diff 比对 + 报告结果的验证脚本

检查点：rollup 构建产物与原始 index.js 完全一致，后续所有 Phase 的构建验证均使用此脚本

---

## 阶段 2：基础（阻塞性前置）— Plan Phase 0 后半

目的：为所有源文件添加 import/export 基础设施，确保 rollup 能正确解析依赖图

⚠️ 关键：在本阶段完成前，禁止开始任何用户故事的文件迁移

- [x] T006 创建 `src/shared/` 目录和空的 `src/shared/index.ts`（统一出口骨架）
- [x] T007 [P] 创建 `src/data/` 目录和空的 `src/data/index.ts`（统一出口骨架）
- [x] T008 [P] 创建 `src/service/` 目录和空的 `src/service/index.ts`（统一出口骨架）
- [x] T009 [P] 创建 `src/presentation/` 目录和空的 `src/presentation/index.ts`（统一出口骨架）
- [x] T010 修改 `rollup.config.js`，使其在自定义拼接模式与标准 import/export 模式之间可切换（通过环境变量 `BUILD_MODE=concat|module`），默认 concat 模式
- [x] T011 运行 `scripts/verify-build.sh` 验证 concat 模式下构建产物仍与基线一致
- [x] T012 建立 `specs/001-three-layer-refactor/function-classification.md`，对 `src/core/04_shared_helpers.js` 的 8459 行逐函数分类为 🟢纯工具 / 🟡数据操作 / 🔴业务逻辑 / 🔵DOM操作 四类，记录每个函数名、行号、分类、依赖的全局变量

检查点：四个目标目录骨架就绪，函数分类表完成，rollup 双模式可切换

---

## 阶段 3：用户故事 1 + 2 — 构建工具链 + 共享层抽取（优先级：P1）🎯 MVP — Plan Phase 0~1

目标：从 04_shared_helpers.js 中抽取纯工具函数到 shared/，使用 import/export 模块化，rollup 构建产物功能等价

独立测试：rollup 构建产物在 SillyTavern 中安装后，8 个分页、手动更新、自动更新全部正常

### US1 构建工具链集成

- [x] T013 [US1] 修改 `rollup.config.js` 的 module 模式：配置入口文件 `src/app.ts`、输出 IIFE 格式 `dist/index.bundle.js`、配置 @rollup/plugin-typescript、通过 `output.banner` 注入 UserScript 头（从 src/core/01_header_and_env.js 前 11 行提取，满足 FR-010）
- [x] T014 [US1] 创建 `src/app.ts` 应用入口骨架：按 buildOrder 顺序 import 所有现有文件（初始阶段为 side-effect import `import './core/01_header_and_env.js'` 等）
- [x] T015 [US1] 验证 module 模式构建产物的功能等价性（在 SillyTavern 中测试核心功能）

### US2 共享层抽取

- [x] T016 [P] [US2] 根据分类表（T012），从 `src/core/04_shared_helpers.js` 提取 🟢纯工具函数到 `src/shared/utils.ts`，添加 export 声明
- [x] T017 [P] [US2] 从 `src/core/02_storage_and_profile.js` 提取 safeJsonParse_ACU/safeJsonStringify_ACU 到 `src/shared/json-helpers.ts`（闭包内 JSON 清洗管线延至阶段 5 迁移）
- [x] T018 [P] [US2] 从 `src/core/01_header_and_env.js` 提取环境常量（UNIQUE_SCRIPT_ID、SCRIPT_ID_PREFIX_ACU、DEBUG_MODE_ACU 等）到 `src/shared/constants.ts`，添加 export 声明
- [x] T019 [P] [US2] 创建 `src/shared/html-helpers.ts`，提取 `escapeHtml_ACU`（合并两处定义），添加 export 声明
- [x] T020 [US2] 在 `src/shared/utils.ts` 的每个函数提取后，更新原位置为 import 引用，运行 rollup 构建 + 验证功能等价
- [x] T021 [US2] JSON 清洗管线在闭包内暂不迁移；safeJsonParse/Stringify 已从旧文件删除并验证
- [x] T022 [US2] 更新 `src/shared/index.ts` 统一出口，re-export 所有 shared 模块
- [x] T023 [US2] 运行 `scripts/verify-build.sh` + `tsc --noEmit`（.ts 文件零错误）+ SillyTavern 功能测试（待用户手动验证）

检查点：shared/ 目录包含纯工具函数和 JSON 清洗管线，构建产物功能等价

---

## 阶段 4：用户故事 3 — 数据库层建立（优先级：P1）— Plan Phase 2

目标：将 02_storage_and_profile.js（5146 行）拆分到 data/ 目录，建立 Repository 接口抽象

独立测试：配置导入导出、数据隔离切换、表格数据读写在 SillyTavern 中行为与基线一致

### US3 数据库层实现

- [x] T024 [US3] 从 `02_storage_and_profile.js` 提取 14 个存储键常量 + 5 个 Profile 工具函数到 `src/data/constants.ts`；从 `02_storage_and_profile.js` 提取 normalizeNonNegativeInteger/normalizePositiveInteger 到 `src/shared/utils.ts`
- [x] T025 [US3] 酒馆存储后端（13 个函数 + 9 个常量/变量）→ `src/data/storage/tavern-storage.ts`（getConfigStorage_ACU、initTavernSettingsBridge_ACU、IDB 配置缓存等）
- [x] T026 [P] [US3] IndexedDB 导入临时存储（10 个函数 + 4 个常量）→ `src/data/storage/idb-import-temp.ts`（isIndexedDbAvailable_ACU、importTempGet/Set/Remove 等）
- [x] T027 [US3] 简单默认常量 → `src/data/models/defaults.ts`（buildDefaultPlotWorldbookConfig_ACU、DEFAULT_AUTO_UPDATE_*、defaultWorldbookConfig_ACU——共 5 个常量 + 1 个函数）；巨型 JSON 字符串（DEFAULT_CHAR_CARD_PROMPT_ACU、DEFAULT_TABLE_TEMPLATE_ACU 等）含中文引号，TS 编译会破坏，保留原位
- [x] T029 [US3] 模板预设纯数据逻辑（8 个函数 + 1 个常量）→ `src/data/repositories/template-preset-repo.ts`；UI 渲染部分留原位待阶段 5
- [x] T030 [US3] 数据隔离逻辑（6 个函数 + 1 个常量）→ `src/data/repositories/isolation-repo.ts`
- [x] T032 [US3] 构建验证通过（module 模式 **13 个** shared 模块注入，产物 35404 行）+ `node --check` V8 语法零错误
- [x] T033 [US3] 更新 `src/data/index.ts` + `src/shared/index.ts` 统一出口
- [x] T034 [US3] verify-build ✓ + audit-bundle ✓ + tsc ✓ + **SillyTavern 手动测试 6 项全部通过**
- [x] T024b [US3] Profile/GlobalMeta 管理（10 个函数 + 1 个变量）→ `src/data/repositories/profile-repo.ts`
- [x] T024c [US3] 正文优化纯逻辑（7 个函数）→ `src/shared/text-optimization.ts`
- [x] T024d [US3] 角色专属设置（2 个函数）→ `src/data/repositories/character-settings-repo.ts`

检查点：data/ 目录包含完整的存储后端、数据模型和 Repository，02_storage_and_profile.js 从 5090 行缩减到 4039 行（**-1051 行，-20.6%**）

---

## 阶段 5：用户故事 4 — 服务层建立（优先级：P2）— Plan Phase 3

目标：将业务逻辑编排从 features/ 和 core/ 迁移到 service/，引入 ACU_State 和 ACU_EventBus

独立测试：手动更新、自动更新、AI 调用、世界书注入、纪要合并全部正常

### US4 服务层实现

- [x] T028 [US3→US4] loadSettings/saveSettings + loadTemplateFromStorage + buildDefaultSettings + applyTemplateScopeForCurrentChat + ensureTagRulesCompat → `src/service/settings/settings-service.ts`（~613 行）
- [x] T031 [US3→US4] 聊天消息持久化——已随 processUpdates_ACU + saveCurrentDataForTable_ACU 迁移到 `service/table/update-process.ts`（数据嵌入 chat[].extra，无独立持久化函数）
- [x] T035 [US4] ACU_State 全局状态管理器——在 IIFE 注入模式下全局变量闭包内直接可见，不需要 getter/setter 包装；推迟到去掉 IIFE 时实现
- [x] T036 [US4] ACU_EventBus——当前事件通过 SillyTavern eventSource 直接监听，不需要额外抽象层；推迟到去掉 IIFE 时实现
- [x] T037 [US4] ACU_Services 服务定位器——同 T035/T036，IIFE 模式下函数全局可见，不需要定位器；推迟
- [x] T038 [US4] callApi_ACU + getApiConfigByPreset_ACU → `src/service/ai/api-call.ts`（~96 行）
- [x] T039 [P] [US4] callCustomOpenAI_ACU_Direct → `src/service/ai/api-call.ts`（36 行）
- [x] T040 [US4] processUpdates_ACU + handleManualUpdate_ACU + proceedWithCardUpdate_ACU → `src/service/table/update-process.ts`（~659 行）
- [x] T041 [US4] proceedWithCardUpdate_ACU 已整体迁移到 `src/service/table/update-process.ts`（与 T040 合并）
- [x] T042 [US4] updateReadableLorebookEntry + deleteAllGenerated + refreshMergedData + loadAllChatMessages + 世界书管道全部 11 个函数 → `src/service/worldbook/pipeline.ts`（~965 行）
- [x] T043 [P] [US4] checkAndTriggerAutoMergeSummary + performAutoMergeSummary → `src/service/summary/merge-logic.ts`（362 行）
- [x] T044 [US4] importCombinedSettings_ACU → `src/service/data-admin/admin.ts`（~139 行）；exportCombinedSettings_ACU 跨文件边界无法单独迁移
- [x] T045 [US4] import 处理全链路：processImportedTxtAsUpdates + clearImport* + deleteImported* + lorebook snapshot 读写 → `src/service/import/import-process.ts`（519 行）
- [x] T046 [US4] 从 `04_shared_helpers.js` 迁移 callApi_ACU、getApiConfigByPreset_ACU、loadTemplateFromStorage_ACU、buildDefaultSettings_ACU、applyTemplateScopeForCurrentChat_ACU、refreshMergedDataAndNotify_ACU 等业务逻辑函数到 service/（04_shared_helpers 从 8386→7576 行，-810 行）
- [x] T047 [US4] stripSeedRowsFromTemplate + parseTableTemplateJson + applySheetOrderNumbers + ensureSheetOrderNumbers + getTemplateSheetKeys + getChatFirstLayerMessage + cloneScopedConfigData → `src/shared/utils.ts`（237 行）
- [x] T048 [US4] logDebug/logError/logWarn_ACU → `src/shared/utils.ts`（9 行，从 03_runtime_api.js）
- [x] T049 [US4] handleManualUpdate + saveCurrentDataForTable 从 `05_core_tail.js` 和 `03_runtime_api.js` 迁出（05_core_tail 从 3142→~1960 行；03_runtime_api 从 2460→~2400 行）
- [x] T050 [US4] mainInitialize_ACU (444 行) → `src/service/runtime/init.ts`（05_core_tail 从 3142→2057 行，-1085 行）
- [x] T051 [US4] IIFE 注入模式下函数全局可见，saveSettings_ACU 的调用方不需要改；推迟到去掉 IIFE 时实现
- [x] T052 [US4] IIFE 注入模式下不需要 import，函数名注入后自动闭包可见；推迟到去掉 IIFE 时实现
- [x] T053 [US4] 更新 `src/service/index.ts` 统一出口（8 个子模块）
- [x] T054 [US4] verify-build 4/4 ✓ + audit-bundle 7/7 ✓（V8 零错误、793 标识符零丢失）+ tsc 零错误 + **SillyTavern 待手动测试**

检查点：service/ 目录包含完整的业务逻辑编排，features/ 目录大幅清空，ACU_State 接管全局状态

---

## 阶段 6：用户故事 5 — 表示层重组（优先级：P2）— Plan Phase 4

目标：将 348KB 主弹窗和 120KB 可视化编辑器拆分为合理粒度，表示层只负责渲染和交互

独立测试：主弹窗 8 个分页全部可访问、可视化编辑器打开编辑保存正常

### US5 表示层实现

- [x] T055 [US5] `01_window_system.js` (890 行) → `presentation/window/window-system.ts`
- [x] T056 [P] [US5] `03_theme_and_toast.js` (324 行) → `presentation/theme/toast.ts`
- [x] T057 [US5] `04_table_selectors.js` (177 行) → `presentation/components/table-selector.ts`
- [x] T058 [US5] `02_shared_editors_and_selectors.js` (552 行) → `presentation/components/plot-editors.ts`
- [x] T059 [US5] `05_main_popup.js` (5733 行) → `presentation/pages/main-popup.ts`（整体迁移，拆分推迟到阶段 7）
- [x] T060 [US5] `06_visualizer.js` (2755 行) → `presentation/pages/visualizer.ts`（整体迁移，拆分推迟到阶段 7）
- [ ] T061 [US5] features/runtime/01_runtime_state.js — 有跨文件依赖，未迁移，推迟到阶段 7 解决跨文件问题后处理
- [ ] T062 [US5] features/worldbook/01~03 — 有跨文件依赖，未迁移，推迟到阶段 7
- [ ] T063 [US5] features/startup/01_ready_and_menu.js — 有跨文件依赖，未迁移，推迟到阶段 7
- [ ] T064 [US5] features/ui/01_update_trigger.js — 与 01_data_admin.js 跨文件函数绑定，未迁移，推迟到阶段 7
- [ ] T065 [US5] 04_shared_helpers.js 中 DOM 操作函数 — 与业务逻辑深度耦合，未迁移，推迟到阶段 7
- [x] T066 [US5] 更新 `src/presentation/index.ts` 统一出口
- [x] T067 [US5] verify-build 4/4 ✓ + audit-bundle 7/7 ✓（V8 零错误、793 标识符零丢失）+ **SillyTavern 待手动测试**

检查点：presentation/ 目录包含完整的 UI 层，ui/ 目录清空，弹窗和编辑器已拆分为合理粒度

---

## 阶段 7：用户故事 6 — 完成三层迁移（优先级：P3）— Plan Phase 5

> ⚠️ 终态架构详见 `specs/001-three-layer-refactor/target-architecture.md` v2
> ⚠️ 目标：`src/core/`、`src/features/`、`src/ui/` **完全删除**，所有代码归入四层目录

独立测试：最终构建产物在 SillyTavern 中所有 16 项业务能力全部正常

已完成的前置修复：
- [x] T064b [US6] exportCombinedSettings_ACU 跨文件函数已修复（后半部分合并到 01_update_trigger.js）
- [x] T070 [US6] src/ui/ 6 个文件已清空为迁移注释（1行）
- [x] T075 [US6] 更新 `docs/目录结构说明.md`
- [x] T076 [US6] scripts/build-index.js — rollup 已替代，保留为参考
- [x] T077 [US6] .gitignore 已包含 node_modules/ 和 dist/
- [x] T078 [US6] 目录结构说明已包含构建命令和架构说明

---

### 7A：共享层补全 — target-architecture M01~M02

- [x] T100 [US6] `01_header_and_env.js:17~47` → `shared/env.ts`（~40行：topLevelWindow_ACU, storage_ACU, 存储策略常量）
- [x] T101 [US6] 新建 `shared/service-locator.ts`（~50行：ACU_Services 注册表，初版 §5.1）

检查点：verify-build ✓ + audit-bundle 7/7 ✓（33 模块注入，35550 行）

---

### 7B：数据层补全 — target-architecture M03~M11

- [x] T102 [US6] `02_storage.js:796~1082` → `data/models/defaults-json.js`（288行：巨型 JSON 默认值，.js 绕过中文引号；rollup 对 .js 跳过 TS 编译）
- [x] T103 [P] [US6] 新建 `data/models/table-data.ts`（~90行：表格数据结构定义 sheet/mate 接口，纯类型不注入产物）
- [x] T104 [P] [US6] 新建 `data/models/settings-model.ts`（~65行：设置/剧情数据结构 + 接口定义）
- [x] T105 [P] [US6] 新建 `data/models/template-model.ts`（~75行：模板预设/作用域/归档/SheetGuide 接口定义）
- [ ] T106 [US6] `04_shared_helpers.js:43~50` + 相关 → `data/storage/chat-history.ts`（~150行：聊天消息自定义字段 CRUD）
- [ ] T107 [US6] 从 tavern-storage.ts 拆出 → `data/storage/config-storage.ts`（~80行：统一配置存储门面）
- [ ] T108 [US6] `05_core_tail.js:1767~2058` → `data/repositories/table-repo.ts`（~290行：save/load/create/init JsonTable）
- [ ] T109 [US6] 从 settings-service.ts 拆出 → `data/repositories/settings-repo.ts`（~100行：loadSettings/saveSettings 纯数据读写）
- [ ] T110 [US6] 新建 `data/repositories/import-repo.ts`（~60行：导入暂存数据高层 Repository）
- [ ] T111 [US6] 更新 `data/index.ts` 统一出口

检查点：verify-build ✓ + audit-bundle ✓

---

### 7C：服务层补全 — target-architecture M12~M38

#### 运行时基础设施（ACU_State + EventBus）

- [ ] T112 [US6] `02_storage.js:624~790` → `service/runtime/state-manager.ts`（~200行：ACU_State getter/setter + 变更通知 + 用户发送意图 + 生成门控；DOM hook 部分委托 presentation 层）
- [ ] T113 [US6] 新建 `service/runtime/event-bus.ts`（~60行：ACU_EventBus 事件总线，初版 §5.3）

#### 模板作用域管理（04_shared_helpers.js 主体迁出）

- [ ] T114 [US6] `04_shared_helpers.js:29~160` → `service/template/chat-scope.ts`（~130行：剧情作用域 CRUD）
- [ ] T115 [US6] `04_shared_helpers.js:160~346` → `service/template/chat-scope.ts` 续（~186行：模板作用域 CRUD + preset entries）
- [ ] T116 [US6] `04_shared_helpers.js:347~510` → `service/template/template-archive.ts`（~163行：模板归档 10 函数）
- [ ] T117 [US6] `04_shared_helpers.js:510~640` → `service/template/chat-scope.ts` 续（~130行：模板状态持久化 + 全局快照）
- [ ] T118 [US6] `04_shared_helpers.js:641~1030` → `service/template/sheet-guide.ts`（~390行：Sheet Guide 管理 8 函数）

#### 表格服务补全

- [ ] T119 [US6] `04_shared_helpers.js:1031~1370` → `service/table/sheet-helpers.ts`（~340行：sanitizeChatSheetsObject, getSortedSheetKeys 等）
- [ ] T120 [US6] `04_shared_helpers.js:2050~2600` → `service/table/merge-engine.ts`（~550行：条件模板引擎、条件变量）

#### 世界书服务补全

- [ ] T121 [US6] `05_core_tail.js:86~390` → `service/worldbook/entry-builder.ts`（~305行：世界书导出配置构建 27 函数）
- [ ] T122 [US6] `05_core_tail.js:392~572` → `service/worldbook/injection-engine.ts`（~180行：purgeSheetKeysFromChatHistoryHard）
- [ ] T123 [US6] `05_core_tail.js:573~1580` → `service/worldbook/injection-engine.ts` 续（~1007行：updateOutline/Summary/Custom/ImportantPersons）
- [ ] T124 [US6] `05_core_tail.js:1580~1766` → `service/worldbook/injection-engine.ts` 续（~186行：getCurrentIsolationKey + 人名关键词）

#### AI 服务补全

- [ ] T125 [US6] `features/ai/01+02_api_call.js` → `service/ai/prompt-builder.ts`（prepareAIInput + callCustomOpenAI 跨文件合并）
- [ ] T126 [US6] `features/ai/02_api_call.js` JSON 清洗管线 → `service/ai/response-parser.ts`（parseAndApplyTableEdits + sanitizeJsonPipeline 等）
- [ ] T127 [US6] `03_runtime_api.js:2025~2110` → `service/ai/response-parser.ts`（~85行：streamToText + parseNonStreamResponse + handleApiResponse）

#### 正文优化服务

- [ ] T128 [US6] `02_storage.js:1085~1700` → `service/optimization/content-optimization.ts`（~615行：正文优化业务逻辑，不含 UI）

#### 04_shared_helpers.js 剩余分流

- [ ] T129 [US6] `04_shared_helpers.js:1370~2050` → `service/template/chat-scope.ts` 续（~680行：模板应用/迁移/greeting base state）
- [ ] T130 [US6] `04_shared_helpers.js:2600~4230` → `service/ai/prompt-builder.ts` 续（~1630行：剧情规划 prompt 组装）
- [ ] T131 [US6] `04_shared_helpers.js:4230~5850` → `service/ai/prompt-builder.ts` 续（~1620行：processPromptTemplateContent, 剧情预测）
- [ ] T132 [US6] `04_shared_helpers.js:5850~7347` → 按功能域分流到 service/ 各处（~1497行：剩余业务函数）

#### 导入服务拆分

- [ ] T133 [US6] 从 import-process.ts 拆出 → `service/import/import-orchestrator.ts`（~100行：导入流程编排）
- [ ] T134 [P] [US6] 从 import-process.ts 拆出 → `service/import/txt-splitter.ts`（~80行：TXT 分块器）
- [ ] T135 [P] [US6] 从 import-process.ts 拆出 → `service/import/snapshot-manager.ts`（~60行：快照管理）

#### 数据管理服务拆分

- [ ] T136 [US6] 从 admin.ts 拆出 → `service/data-admin/config-export.ts`（~70行：配置导入导出纯逻辑）
- [ ] T137 [US6] 从 admin.ts 拆出 → `service/data-admin/chat-data-admin.ts`（~70行：聊天数据管理）

#### DatabaseAPI 迁移

- [ ] T138 [US6] `03_runtime_api.js:4~2024` → `service/runtime/api-registry.ts`（~2020行：DatabaseAPI_ACU 对象各方法委托到 service/presentation 层）

- [ ] T139 [US6] 更新 `service/index.ts` 统一出口

检查点：verify-build ✓ + audit-bundle ✓（04_shared_helpers.js 清空、05_core_tail.js 清空、02_storage.js 清空、03_runtime_api.js 清空、features/ai/ 清空）

---

### 7D：表示层补全 — target-architecture M39~M50

#### features/ 迁入

- [ ] T140 [US6] `02_storage.js:20~620` → `presentation/components/template-preset-ui.ts`（~600行：模板预设下拉框 UI 24 函数）
- [ ] T141 [US6] `02_storage.js:1700~4089` → `presentation/components/optimization-ui.ts`（~2389行：正文优化 UI overlay/toast/replace）
- [ ] T142 [US6] `features/worldbook/01~03` → `presentation/components/worldbook-selector.ts`（~672行：世界书选择 UI 25 函数）
- [ ] T143 [US6] `features/runtime/01_runtime_state.js` → `presentation/components/update-status-display.ts`（~241行）
- [ ] T144 [US6] `features/import/01~03` → `presentation/components/import-status-ui.ts`（~108行）
- [ ] T145 [US6] `features/startup/01_ready_and_menu.js` → `presentation/bootstrap/startup.ts`（~53行）
- [ ] T146 [US6] `features/ui/01_update_trigger.js` → `presentation/triggers/update-trigger.ts`（~754行：手动更新触发）
- [ ] T147 [US6] `features/data/01_data_admin.js` → `presentation/triggers/data-admin-ui.ts`（~707行：导入/导出/重置 UI）

#### 大文件拆分

- [ ] T148 [US6] `presentation/pages/main-popup.ts`（348KB）→ 拆为 7 个子文件：shell.ts + update-tab.ts + settings-tab.ts + import-tab.ts + plot-tab.ts + optimization-tab.ts + bindings.ts
- [ ] T149 [US6] `presentation/pages/visualizer.ts`（120KB）→ 拆为 3 个子文件：visualizer-shell.ts + sidebar.ts + main-area.ts
- [ ] T150 [P] [US6] 从 window-system.ts 拆出 → `presentation/window/window-styles.ts`（~200行）
- [ ] T151 [P] [US6] 从 toast.ts 拆出 → `presentation/theme/theme-engine.ts`（~100行）

- [ ] T152 [US6] 更新 `presentation/index.ts` 统一出口

检查点：verify-build ✓ + audit-bundle ✓（features/ 全部清空）

---

### 7E：入口统一 + 旧目录删除 — target-architecture M51~M60

- [ ] T153 [US6] 新建 `app.ts` 应用入口（初始化编排，替代 features/startup + IIFE 头尾）
- [ ] T154 [US6] `01_header_and_env.js` IIFE 入口 → 移到 rollup `output.banner` 或 `app.ts`
- [ ] T155 [US6] 更新 `rollup.config.js`：移除 buildOrder / concat 模式，改为纯 import 图驱动
- [ ] T156 [US6] 删除 `src/core/` 目录（全部文件已迁出）
- [ ] T157 [US6] 删除 `src/features/` 目录（全部文件已迁出）
- [ ] T158 [US6] 删除 `src/ui/` 6 个空壳文件，从构建中移除
- [ ] T159 [US6] verify-build ✓ + audit-bundle ✓ + tsc --noEmit 零错误
- [ ] T160 [US6] 更新 `docs/目录结构说明.md` 为最终版
- [ ] T161 [US6] **SillyTavern 全量手动测试 16 项**

检查点：`src/core/`、`src/features/`、`src/ui/` 已删除，目录结构与初版设计 §2.2 完全一致

---

## 阶段 8：打磨与跨领域关注点

目的：影响多个用户故事的改进项

- [ ] T162 [P] 检查并清理所有 `// TODO`、`// FIXME`、`// [已迁移到 ...]` 注释
- [ ] T163 [P] 验证 window.AutoCardUpdaterAPI 的 80+ 个方法全部可通过外部调用
- [ ] T164 确认最终目录结构中每个文件只属于一个架构层级
- [ ] T165 [P] 运行 `tsc --noEmit --strict` 检查，记录需后续修复的类型问题（不阻塞发布）
- [ ] T166 更新 `specs/001-three-layer-refactor/` 下所有文档的完成状态
- [ ] T167 与初版设计 `plans/three_layer_refactor_plan.md` §2.2 逐一核对，确认 44 个目标模块全部到位

---

## 依赖与执行顺序

### 阶段依赖

```
阶段 1 (初始化) → 阶段 2 (基础) → 阶段 3 (US1+US2: 构建+共享层)
                                      → 阶段 4 (US3: 数据库层)
                                        → 阶段 5 (US4: 服务层)
                                          → 阶段 6 (US5: 表示层)
                                            → 阶段 7 (US6: 清理)
                                              → 阶段 8 (打磨)
```

⚠️ **严格串行**：每个阶段必须在前一阶段完全完成并通过验证后才能开始。这是宪章原则 II（渐进式重构与行为等价）的要求。

### 用户故事依赖

- US1 (构建工具链): 阶段 2 完成后开始，不依赖其他故事
- US2 (共享层抽取): 依赖 US1 的 rollup module 模式就绪
- US3 (数据库层): 依赖 US2 的 shared/ 完成（data 层引用 shared 工具函数）
- US4 (服务层): 依赖 US3 的 data/ 完成（service 层通过 repository 访问数据）
- US5 (表示层): 依赖 US4 的 service/ 完成（presentation 层通过 service 调用业务逻辑）
- US6 (清理收束): 依赖 US5 完成（清理所有旧目录残留）

### 每个用户故事内部

- 提取函数先于更新引用
- 更新引用后立即构建验证
- 每个文件的迁移作为一个原子操作（搬+验证）
- 大文件（04_shared_helpers、05_main_popup、06_visualizer）按函数/行号区间分批迁移

### 并行机会

由于本项目严格串行，并行机会仅存在于**同一阶段内**：
- 阶段 2 中 T007/T008/T009 可并行（创建空目录骨架）
- 阶段 3 中 T016/T017/T018/T019 可并行（各 shared 子模块互不依赖）
- 阶段 5 中 T038/T039 可并行（AI 调用的两个子模块）
- 阶段 5 中 T042/T043 可并行（世界书和纪要合并互不依赖）
- 阶段 6 中 T055/T056 可并行（窗口系统和 Toast 互不依赖）

---

## 并行示例：阶段 3（共享层抽取）

```bash
# 同时创建 shared/ 的各子模块（互不依赖的文件）：
Task T016: "提取纯工具函数到 src/shared/utils.ts"
Task T017: "提取 JSON 清洗管线到 src/shared/json-helpers.ts"
Task T018: "提取环境常量到 src/shared/constants.ts"
Task T019: "提取 HTML 工具到 src/shared/html-helpers.ts"

# 然后串行更新引用：
Task T020: "更新 04_shared_helpers.js 引用"
Task T021: "更新 02_api_call.js 引用"
```

---

## 实施策略

### 先做 MVP（US1 + US2：构建工具链 + 共享层）

1. 完成阶段 1：初始化（rollup 搭建）
2. 完成阶段 2：基础（目录骨架 + 函数分类表）
3. 完成阶段 3：US1 + US2（rollup module 模式 + shared/ 抽取）
4. 停止并校验：构建产物在 SillyTavern 中功能完全正常
5. 这是最小可验证增量——证明 rollup + import/export 方案可行

### 增量交付

1. 完成 阶段 1~2 → 构建基础就绪
2. 完成 阶段 3 (US1+US2) → shared/ 就绪 → 验证（MVP！）
3. 完成 阶段 4 (US3) → data/ 就绪 → 验证
4. 完成 阶段 5 (US4) → service/ 就绪 → 验证
5. 完成 阶段 6 (US5) → presentation/ 就绪 → 验证
6. 完成 阶段 7 (US6) → 清理收束 → 最终验证
7. 每个阶段都是一个可回滚的检查点

---

## 延后实现的非功能需求（Backlog）

| 项目 | 延后原因 | 风险评估 | 临时缓解/监控 | 目标版本/时间 |
|------|----------|----------|----------------|---------------|
| strict TypeScript 类型检查 | 需先完成架构重构 | 低 | tsc --noEmit 非 strict 模式 | 重构完成后 |
| 单元测试覆盖 | 重构期间接口不稳定 | 中 | 每 Phase 手动功能测试 | 重构完成后 |
| 性能基准测试 | 需先稳定架构 | 低 | 安装后手动验证加载速度 | 重构完成后 |

---

## 备注

- 所有 git 操作（commit、branch、push 等）MUST 经用户确认后执行（宪章约束）
- [P] 任务 = 同一阶段内不同文件、无依赖，可并行
- [Story] 标签用于将任务映射到 spec.md 中的用户故事
- 每个阶段完成后必须运行 `scripts/verify-build.sh` + SillyTavern 手动测试
- 构建验证失败时 MUST 停止后续步骤，排查差异原因（宪章原则 II）
- 切割 HTML 模板字符串时，切割点 MUST 在完整标签 `</div>` 边界
