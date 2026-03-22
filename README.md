# AutoCardUpdater 插件更新日志

## 2026-03-22 更新

### 1. 手机端按钮显示优化
**问题描述**：正文优化对比对话框底部的按钮在手机端会超出屏幕且无法点击。

**修复内容**：
- 修改按钮容器样式，添加 `flex-wrap: wrap` 和 `padding-bottom: 10px`
- 为每个按钮添加 `min-width` 和 `flex-shrink: 0`，确保按钮不会被压缩
- 增大按钮内边距从 `8px 16px` 改为 `10px 16px`，提升触控体验

**修改位置**：
- [`showOptimizationDiffDialogForLoop_ACU()`](index.js:2703-2731) - 循环优化对话框按钮样式
- [`showOptimizationDiffDialog_ACU()`](index.js:2825-2844) - 普通优化对话框按钮样式

---

### 2. JSON结构调整：reason → plan
**问题描述**：正文优化返回的JSON结构中，`reason` 字段名称不够直观，且位置在最后，不符合用户阅读习惯。

**修改内容**：
1. **字段重命名**：将 `reason`（原因）改为 `plan`（修改方案）
2. **字段顺序调整**：`original` → `plan` → `optimized`
3. **显示样式优化**：`plan` 字段添加浅蓝色背景高亮显示

**新的JSON格式**：
```json
{
  "optimizations": [
    {
      "type": "replace",
      "original": "原文中需要优化的句子或段落",
      "plan": "修改方案说明",
      "optimized": "优化后的句子或段落"
    }
  ],
  "summary": "本次优化的总体说明"
}
```

**修改位置**：
- 默认提示词模板 [`index.js:1919-1921`](index.js:1919) - 更新JSON格式说明
- 对话框显示 [`index.js:2697-2698`](index.js:2697) - 支持新字段显示
- 对话框显示 [`index.js:2816-2817`](index.js:2816) - 支持新字段显示
- 日志输出 [`index.js:20968-20969`](index.js:20968) - 支持新字段显示

**向后兼容**：
- 显示代码使用 `opt.plan || opt.reason || '未说明'`，确保同时支持新旧格式
- 核心替换逻辑 `applyOptimizations_ACU()` 只依赖 `original` 和 `optimized` 字段，不受影响

---

## 2026-03-21 更新

### 1. 正文优化MAX Token参数修复
**问题描述**：正文替换功能切换使用API配置的预设时，没有使用对应的MAX Token参数。

**修复内容**：移除硬编码的 `max_tokens: 4000`，让 `callAI()` 使用预设配置中的值。

**修改位置**：[`performContentOptimization_ACU()`](index.js:2057-2195)

---

### 2. 剧情推进占位符支持
**新增功能**：正文优化支持以下占位符：
- `$1` - 世界书内容
- `$5` - 纪要表数据
- `$6` - 上轮规划
- `$7` - 前文上下文
- `$8` - 用户输入
- `$U` - 用户设定
- `$C` - 角色描述

**修改位置**：
- 新增 [`getOptimizationPlaceholders_ACU()`](index.js:2000) 函数
- 修改 [`performContentOptimization_ACU()`](index.js:2057) 调用占位符替换

---

### 3. 循环优化功能
**新增功能**：支持多轮循环优化，每轮使用上一轮优化后的内容作为输入。

**新增设置**：
- `loopCount` - 循环优化次数（默认1次，范围1-10次）

**修改位置**：
- 设置结构 [`index.js:3130-3135`](index.js:3130)
- 核心逻辑 [`executeContentOptimization_ACU()`](index.js:2368-2534)
- UI输入框 [`index.js:18459-18468`](index.js:18459)

---

### 4. 自动重试功能
**新增功能**：正文优化API调用失败时自动重试，采用指数退避策略。

**新增设置**：
- `retryCount` - 自动重试次数（默认3次，范围1-10次）

**重试策略**：指数退避（1秒、2秒、4秒...，最大10秒）

**修改位置**：
- 设置结构 [`index.js:3134`](index.js:3134)
- 核心逻辑 [`performContentOptimization_ACU()`](index.js:2057)
- UI输入框 [`index.js:18464-18468`](index.js:18464)

---

### 5. 循环优化与对比显示冲突修复
**问题描述**：设置循环优化次数后，关闭"自动应用优化结果"时，所有轮次执行完才显示对比对话框。

**修复内容**：区分自动应用模式和手动确认模式：
- **自动应用模式**：所有循环完成后统一应用
- **手动确认模式**：每轮优化后都显示对比对话框，支持用户逐轮确认

**新增函数**：
- [`executeContentOptimizationWithConfirm_ACU()`](index.js:2536) - 逐轮确认逻辑
- [`showOptimizationDiffDialogForLoop_ACU()`](index.js:2657) - 支持循环优化的对话框

**操作选项**：
- "应用并继续"：应用本轮优化，继续下一轮
- "跳过本轮"：跳过本轮优化，继续下一轮
- "取消优化"：结束优化流程

---

### 6. 手机页面对话框显示优化
**问题描述**：对话框使用 `top: 50%; transform: translate(-50%, -50%)` 居中时，内容过高会导致顶部超出屏幕。

**修复内容**：
- 将 `top: 50%` 改为 `top: 10px`
- 将 `transform: translate(-50%, -50%)` 改为 `transform: translateX(-50%)`
- 添加 `width: calc(100% - 20px)` 确保手机上有边距
- 调整 `max-height` 确保不超出屏幕底部

**修改位置**：
- [`showOptimizationDiffDialogForLoop_ACU()`](index.js:2661-2679)
- [`showOptimizationDiffDialog_ACU()`](index.js:2775-2796)