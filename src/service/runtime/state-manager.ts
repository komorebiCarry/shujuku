/**
 * service/runtime/state-manager.ts — ACU_State 全局状态管理 + 生成门控
 * 从 src/core/02_storage_and_profile.js:624~793 迁移而来。
 */
  const NEW_MESSAGE_DEBOUNCE_DELAY_ACU = 500; // 0.5秒防抖延迟 (可调整)
  
  // --- [表格顺序新机制] ---
  // 旧机制使用 settings_ACU.tableKeyOrder 强制固定对象键顺序；新机制改为：每张表自带编号并按编号排序。
  // 编号会随模板导出/导入，且在可视化编辑器调整顺序时同步更新。
  const TABLE_ORDER_FIELD_ACU = 'orderNo'; // 每张表的顺序编号字段名（越小越靠前）
  // [新机制] 新建对话时，将"当前模板基础状态"注入到开场白（角色第一条AI消息）中，仅用于前端显示刷新
  // 注意：此动作不应触发世界书注入/数据更新链路
  let pendingBaseStatePlacement_ACU = false;
  // [健全性] 新对话开场白阶段抑制世界书注入（防止自动创建全局可见世界书条目）
  // 该抑制仅在"开场白阶段（无任何用户消息）"生效；一旦用户开始对话（出现用户消息）自动解除。
  let suppressWorldbookInjectionInGreeting_ACU = false;

  // --- [剧情推进] 相关常量 ---
  // [已迁移到 src/data/constants.ts] STORAGE_KEY_PLOT_SETTINGS_ACU

  // [剧情推进] 循环状态管理
  const loopState_ACU = {
    isLooping: false,
    isRetrying: false, // 标记当前是否处于重试流程
    timerId: null,
    retryCount: 0,
    startTime: 0, // 循环开始时间
    totalDuration: 0, // 总时长(ms)
    tickInterval: null, // 倒计时更新定时器
    awaitingReply: false, // 是否正在等待本轮生成结果（用于 GENERATION_ENDED 检测）
  };

  // [剧情推进] 规划阶段防护
  const planningGuard_ACU = {
    inProgress: false,
    // 规划阶段如果使用 useMainApi(generateRaw)，通常会触发一次 GENERATION_ENDED。用计数精确忽略。
    ignoreNextGenerationEndedCount: 0,
  };

  // [剧情推进] 规划任务中止控制器
  let abortController_ACU = null;

  // [剧情推进] 防重入锁
  let isProcessing_Plot_ACU = false;

  // [剧情推进] 临时存储plot
  // 结构: { content: string, userInputHash: string, userInputText: string }
  let tempPlotToSave_ACU = null;

  // --- [触发门控] 防止其它插件/后台请求误触发"剧情推进/自动填表" ---
  // 目标：
  // 1) 剧情推进：仅在"用户真正发送了一条用户楼层"时触发（MESSAGE_SENT -> GENERATION_AFTER_COMMANDS）
  // 2) 自动填表：仅在"本次生成不是 quiet/后台生成"时触发（GENERATION_STARTED/AFTER -> GENERATION_ENDED）
  const USER_SEND_TRIGGER_TTL_MS_ACU = 12000; // 用户发送与生成之间的合理窗口
  const generationGate_ACU = {
    lastUserMessageId: null,
    lastUserMessageText: '',
    lastUserMessageAt: 0,
    // 用户"发送意图"时间戳：用于在 GENERATION_AFTER_COMMANDS（写入用户楼层之前）做预发送规划
    lastUserSendIntentAt: 0,
    lastGeneration: null, // { type, params, dryRun, at }
  };

  function markUserSendIntent_ACU() {
    generationGate_ACU.lastUserSendIntentAt = Date.now();
  }

  // 使用原生 capture 监听，确保在酒馆自身的 click/keydown 处理器之前记录"发送意图"
  function installSendIntentCaptureHooks_ACU() {
    try {
      const parentDoc = SillyTavern_API_ACU?.Chat?.document
        ? SillyTavern_API_ACU.Chat.document
        : (window.parent || window).document;
      const doc = parentDoc || document;

      if (!window.__ACU_sendIntentHooksInstalled) {
        window.__ACU_sendIntentHooksInstalled = { send: false, enter: false };
      }

      const sendBtn = doc.getElementById('send_but');
      if (sendBtn && !window.__ACU_sendIntentHooksInstalled.send) {
        sendBtn.addEventListener('click', () => markUserSendIntent_ACU(), true); // capture
        // 兼容：部分环境可能走 pointerup/touchend
        sendBtn.addEventListener('pointerup', () => markUserSendIntent_ACU(), true);
        sendBtn.addEventListener('touchend', () => markUserSendIntent_ACU(), true);
        window.__ACU_sendIntentHooksInstalled.send = true;
      }

      const ta = doc.getElementById('send_textarea');
      if (ta && !window.__ACU_sendIntentHooksInstalled.enter) {
        ta.addEventListener('keydown', (e) => {
          try {
            const key = e.key || e.code;
            if ((key === 'Enter' || key === 'NumpadEnter') && !e.shiftKey) {
              markUserSendIntent_ACU();
            }
          } catch (err) {}
        }, true); // capture
        window.__ACU_sendIntentHooksInstalled.enter = true;
      }

      // 元素可能尚未渲染：延迟重试一次
      if ((!sendBtn || !ta) && !window.__ACU_sendIntentHooksRetryScheduled) {
        window.__ACU_sendIntentHooksRetryScheduled = true;
        setTimeout(() => {
          window.__ACU_sendIntentHooksRetryScheduled = false;
          installSendIntentCaptureHooks_ACU();
        }, 1200);
      }
    } catch (e) {
      // ignore
    }
  }

  function isRecentUserSendIntent_ACU() {
    if (!generationGate_ACU.lastUserSendIntentAt) return false;
    return (Date.now() - generationGate_ACU.lastUserSendIntentAt) <= USER_SEND_TRIGGER_TTL_MS_ACU;
  }

  function recordLastUserSend_ACU(messageId) {
    try {
      const chat = SillyTavern_API_ACU?.chat;
      const msg = (chat && typeof messageId === 'number') ? chat[messageId] : null;
      if (!msg || !msg.is_user) return;
      generationGate_ACU.lastUserMessageId = messageId;
      generationGate_ACU.lastUserMessageText = String(msg.mes || '');
      generationGate_ACU.lastUserMessageAt = Date.now();
    } catch (e) {
      // ignore
    }
  }

  function recordGenerationContext_ACU(type, params, dryRun) {
    generationGate_ACU.lastGeneration = { type, params, dryRun, at: Date.now() };
  }

  function isQuietLikeGeneration_ACU(type, params) {
    // SillyTavern: quiet prompt 会带 quiet_prompt；type 也可能为 'quiet'
    if (type === 'quiet') return true;
    if (params && typeof params.quiet_prompt === 'string' && params.quiet_prompt.trim().length > 0) return true;
    // 某些插件会用 quietToLoud 但仍携带 quiet_prompt；上面已覆盖
    return false;
  }

  function isRecentUserSend_ACU() {
    if (!generationGate_ACU.lastUserMessageAt) return false;
    return (Date.now() - generationGate_ACU.lastUserMessageAt) <= USER_SEND_TRIGGER_TTL_MS_ACU;
  }

  function shouldProcessPlotForGeneration_ACU(type, params, dryRun) {
    if (dryRun) return false;
    if (!settings_ACU?.plotSettings?.enabled) return false;
    if (isQuietLikeGeneration_ACU(type, params)) return false;
    // 剧情推进仅响应"用户发送触发的生成"，避免其它插件/自动模式误触发
    if (params?.automatic_trigger) return false;
    // 允许两种路径：
    // A) /send 等命令：用户楼层已写入 chat（MESSAGE_SENT 已发生）
    // B) 正常发送：此时 user 楼层尚未写入 chat，只能靠"发送意图"来判定
    const chat = SillyTavern_API_ACU?.chat;
    const id = generationGate_ACU.lastUserMessageId;
    const msg = (chat && typeof id === 'number') ? chat[id] : null;
    const hasFreshUserMessage = !!(msg && msg.is_user && id === (chat.length - 1) && isRecentUserSend_ACU());
    const hasFreshIntent = isRecentUserSendIntent_ACU();
    return hasFreshUserMessage || hasFreshIntent;
  }

  function shouldProcessAutoTableUpdateForGenerationEnded_ACU() {
    // 自动填表：只过滤 quiet/后台生成；允许 regenerate/swipe/automatic_trigger（只要确实影响聊天楼层）
    const g = generationGate_ACU.lastGeneration;
    if (!g) return true; // 兼容老行为：无上下文时不强行阻断
    if (g.dryRun) return false;
    if (isQuietLikeGeneration_ACU(g.type, g.params)) return false;
    return true;
  }
