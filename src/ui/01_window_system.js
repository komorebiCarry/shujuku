  const ACU_WindowManager = {
    windows: new Map(), // id -> { $el, zIndex, ... }
    baseZIndex: 10000,
    topZIndex: 10000,
    
    register(id, $el) {
      this.topZIndex++;
      this.windows.set(id, { $el, zIndex: this.topZIndex });
      $el.css('z-index', this.topZIndex);
    },
    
    unregister(id) {
      this.windows.delete(id);
    },
    
    bringToFront(id) {
      const win = this.windows.get(id);
      if (!win) return;
      this.topZIndex++;
      win.zIndex = this.topZIndex;
      win.$el.css('z-index', this.topZIndex);
    },
    
    getWindow(id) {
      return this.windows.get(id)?.$el || null;
    },
    
    isOpen(id) {
      return this.windows.has(id);
    },
    
    closeAll() {
      this.windows.forEach((_, id) => {
        const $el = this.windows.get(id)?.$el;
        if ($el) $el.remove();
      });
      this.windows.clear();
    }
  };

  // 独立窗口样式（只注入一次）
  const ACU_WINDOW_STYLES_INJECTED_FLAG = `${SCRIPT_ID_PREFIX_ACU}_window_styles_injected`;
  const ACU_UI_THEME_STORAGE_KEY = `${SCRIPT_ID_PREFIX_ACU}_ui_theme_v1`;

  function getACUTheme_ACU() {
    try {
      const store = getConfigStorage_ACU();
      const savedTheme = String(store?.getItem?.(ACU_UI_THEME_STORAGE_KEY) || '').trim().toLowerCase();
      return savedTheme === 'silk' ? 'silk' : 'ink';
    } catch (e) {
      return 'ink';
    }
  }

  function setACUTheme_ACU(theme) {
    const normalizedTheme = theme === 'silk' ? 'silk' : 'ink';
    try {
      const store = getConfigStorage_ACU();
      store?.setItem?.(ACU_UI_THEME_STORAGE_KEY, normalizedTheme);
    } catch (e) {
      console.warn('[ACU] Failed to persist UI theme:', e);
    }
    return normalizedTheme;
  }

  function applyACUThemeToDocument_ACU(targetDoc, theme = null) {
    const doc = targetDoc || (topLevelWindow_ACU?.document || document);
    const activeTheme = theme === 'silk' || theme === 'ink' ? theme : getACUTheme_ACU();
    const body = doc?.body;
    if (!body || !body.classList) return activeTheme;
    body.classList.toggle('acu-theme-silk', activeTheme === 'silk');
    body.setAttribute('data-acu-theme', activeTheme);
    return activeTheme;
  }

  function syncACUThemeButtons_ACU(targetDoc) {
    const doc = targetDoc || (topLevelWindow_ACU?.document || document);
    const activeTheme = applyACUThemeToDocument_ACU(doc);
    const nextThemeLabel = activeTheme === 'silk' ? '墨纸' : '素纱';
    const nextThemeTitle = activeTheme === 'silk' ? '切换为墨纸主题' : '切换为素纱主题';
    try {
      doc.querySelectorAll('.acu-window-btn.theme-toggle .acu-theme-toggle-text').forEach((el) => {
        el.textContent = nextThemeLabel;
      });
      doc.querySelectorAll('.acu-window-btn.theme-toggle').forEach((el) => {
        el.setAttribute('title', nextThemeTitle);
      });
    } catch (e) {
      console.warn('[ACU] Failed to sync theme buttons:', e);
    }
    return activeTheme;
  }

  function toggleACUTheme_ACU(targetDoc) {
    const nextTheme = getACUTheme_ACU() === 'silk' ? 'ink' : 'silk';
    setACUTheme_ACU(nextTheme);
    applyACUThemeToDocument_ACU(targetDoc, nextTheme);
    syncACUThemeButtons_ACU(targetDoc);
    return nextTheme;
  }

  function injectACUWindowStyles() {
    // 始终往酒馆主窗口注入样式
    const targetWin = topLevelWindow_ACU || window;
    const targetDoc = targetWin.document;
    
    if (targetWin[ACU_WINDOW_STYLES_INJECTED_FLAG]) return;
    targetWin[ACU_WINDOW_STYLES_INJECTED_FLAG] = true;
    
    const css = `
      /* ═══════════════════════════════════════════════════════════════
         星·数据库 独立窗口系统
         古卷双主题：墨色 / 素纱
         ═══════════════════════════════════════════════════════════════ */
      
      .acu-window-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(17, 15, 13, 0.56);
        backdrop-filter: blur(3px);
        -webkit-backdrop-filter: blur(3px);
        z-index: 9999;
        animation: acuOverlayFadeIn 0.24s ease-out;
      }
      body.acu-theme-silk .acu-window-overlay {
        background: rgba(94, 84, 69, 0.16);
      }
      @keyframes acuOverlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      
      .acu-window {
        --acu-panel-bg: #24221f;
        --acu-panel-border: #36332e;
        --acu-panel-text: #c1b9ad;
        --acu-panel-text-dim: #9e978e;
        --acu-panel-text-mute: #645e55;
        --acu-panel-accent: #7d4940;
        --acu-panel-hover: #2a2824;
        position: fixed;
        display: flex;
        flex-direction: column;
        background-color: var(--acu-panel-bg);
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E"),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 30%);
        border: 1px solid var(--acu-panel-border);
        border-radius: 2px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
        overflow: hidden;
        min-width: 400px;
        min-height: 300px;
        animation: acuWindowSlideIn 0.25s ease-out;
        color-scheme: dark;
        font-family: "Noto Serif SC", "Source Han Serif CN", "Songti SC", "STSong", "SimSun", serif;
        font-weight: 500;
        color: var(--acu-panel-text);
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      body.acu-theme-silk .acu-window {
        --acu-panel-bg: #f4f1eb;
        --acu-panel-border: #e0dacb;
        --acu-panel-text: #4a453f;
        --acu-panel-text-dim: #6e675e;
        --acu-panel-text-mute: #9e978e;
        --acu-panel-accent: #8a6b5e;
        --acu-panel-hover: #ebe7de;
        color-scheme: light;
        box-shadow: 0 18px 42px rgba(72, 59, 43, 0.16);
      }
      @keyframes acuWindowSlideIn {
        from { opacity: 0; transform: scale(0.97) translateY(-14px); }
        to { opacity: 1; transform: scale(1) translateY(0); }
      }
      
      .acu-window.maximized {
        top: 10px !important;
        left: 10px !important;
        width: calc(100vw - 20px) !important;
        height: calc(100vh - 20px) !important;
        border-radius: 12px;
      }
      
      /* 窄屏模式下全屏时减小边距，确保头部完全可见 */
      @media screen and (max-width: 1100px) {
        .acu-window.maximized {
          top: 5px !important;
          left: 5px !important;
          width: calc(100vw - 10px) !important;
          height: calc(100vh - 10px) !important;
          border-radius: 8px;
        }
        .acu-window-header {
          padding: 10px 12px;
        }
        .acu-window-controls {
          gap: 6px;
          margin-right: 0; /* 窄屏模式下关闭按钮靠右 */
        }
        .acu-window-btn {
          width: 32px;
          height: 32px;
        }
        .acu-window {
          min-width: 320px; /* 窄屏下允许更小的最小宽度 */
        }
      }
      
      /* 超窄屏模式下全屏时进一步优化 */
      @media screen and (max-width: 768px) {
        .acu-window {
          min-width: min(320px, calc(100vw - 12px)) !important; /* 手机端保留边距，避免遮挡底层界面 */
          min-height: min(360px, calc(100dvh - 12px)) !important;
          max-width: calc(100vw - 12px) !important;
          max-height: calc(100vh - 12px) !important;
          max-height: calc(100dvh - 12px) !important; /* 使用动态视口高度，避免移动浏览器地址栏问题 */
        }
        .acu-window.maximized {
          top: 6px !important;
          left: 6px !important;
          width: calc(100vw - 12px) !important;
          height: calc(100vh - 12px) !important;
          height: calc(100dvh - 12px) !important; /* 优先使用动态视口高度 */
          max-width: calc(100vw - 12px) !important;
          max-height: calc(100vh - 12px) !important;
          max-height: calc(100dvh - 12px) !important;
          border-radius: 10px;
          border: 1px solid var(--acu-panel-border);
        }
        .acu-window-header {
          padding: 8px 10px;
          min-height: 44px; /* 确保头部高度足够 */
          flex-shrink: 0;
        }
        .acu-window-controls {
          margin-right: 0; /* 超窄屏模式下关闭按钮靠右 */
        }
        .acu-window-title {
          font-size: 13px;
        }
        .acu-window-btn {
          width: 36px;
          height: 36px;
          font-size: 16px;
        }
        .acu-window-body {
          max-width: 100vw;
          overflow-x: hidden;
          overflow-y: auto;
          /* 确保body能正确滚动，使用flex布局撑满剩余空间 */
          flex: 1 1 0;
          min-height: 0; /* 关键：允许flex子元素收缩 */
        }
      }
      
      /* 极窄屏模式（≤480px）进一步压缩 */
      @media screen and (max-width: 480px) {
        .acu-window-header {
          padding: 6px 8px;
          min-height: 40px;
        }
        .acu-window-title {
          font-size: 12px;
          gap: 6px;
        }
        .acu-window-title i {
          font-size: 14px;
        }
        .acu-window-btn {
          width: 32px;
          height: 32px;
          font-size: 14px;
        }
        .acu-window-controls {
          gap: 4px;
          margin-right: 0; /* 极窄屏模式下关闭按钮靠右 */
        }
      }
      
      /* 超小屏模式（≤360px）最小化头部占用 */
      @media screen and (max-width: 360px) {
        .acu-window-header {
          padding: 4px 6px;
          min-height: 36px;
        }
        .acu-window-title {
          font-size: 11px;
          gap: 4px;
        }
        .acu-window-title i {
          font-size: 12px;
        }
        .acu-window-btn {
          width: 28px;
          height: 28px;
          font-size: 12px;
          border-radius: 6px;
        }
        .acu-window-controls {
          margin-right: 0; /* 超小屏模式下关闭按钮靠右 */
        }
      }
      
      .acu-window-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: transparent;
        border-bottom: 1px solid var(--acu-panel-border);
        cursor: move;
        user-select: none;
        flex-shrink: 0;
      }
      
      .acu-window-title {
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 1px;
        color: var(--acu-panel-text);
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
      }
      .acu-window-title i {
        color: var(--acu-panel-accent);
        flex-shrink: 0;
      }
      .acu-window-title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .acu-window-controls {
        display: flex;
        gap: 6px;
        flex-shrink: 0;
        margin-left: 8px;
      }
      
      .acu-window-btn {
        width: 30px;
        height: 30px;
        border: 1px solid transparent;
        border-radius: 1px;
        background: transparent;
        color: var(--acu-panel-text-mute);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.18s ease;
        font-family: "Noto Serif SC", "Source Han Serif CN", "Songti SC", "STSong", "SimSun", serif;
      }
      .acu-window-btn:hover {
        background: var(--acu-panel-hover);
        border-color: var(--acu-panel-border);
        color: var(--acu-panel-text);
      }
      .acu-window-btn.maximize:hover {
        color: var(--acu-panel-accent);
      }
      .acu-window-btn.close:hover {
        background: rgba(125, 73, 64, 0.10);
        border-color: var(--acu-panel-accent);
        color: var(--acu-panel-accent);
      }
      .acu-window-btn.theme-toggle {
        width: auto;
        min-width: 58px;
        padding: 0 10px;
        font-size: 11px;
        letter-spacing: 1px;
      }
      .acu-theme-toggle-text {
        display: inline-block;
        line-height: 1;
        transform: translateY(-0.5px);
      }
      
      .acu-window-body {
        flex: 1 1 0;
        min-height: 0; /* 关键：允许flex子元素收缩到小于内容高度 */
        overflow: auto;
        overflow-x: hidden;
        padding: 0;
        /* 确保内容不会撑破容器 */
        display: flex;
        flex-direction: column;
      }
      
      /* 窗口body内的内容容器 */
      .acu-window-body > * {
        flex: 1 1 0;
        min-height: 0;
        overflow-y: auto;
        box-sizing: border-box;
      }
      
      /* 窗口大小调整手柄 */
      .acu-window-resize-handle {
        position: absolute;
        background: transparent;
      }
      .acu-window-resize-handle.se {
        right: 0; bottom: 0;
        width: 20px; height: 20px;
        cursor: se-resize;
      }
      .acu-window-resize-handle.se::after {
        content: '';
        position: absolute;
        right: 4px; bottom: 4px;
        width: 10px; height: 10px;
        border-right: 2px solid var(--acu-panel-border);
        border-bottom: 2px solid var(--acu-panel-border);
        opacity: 0.72;
      }
      .acu-window-resize-handle.e {
        right: 0; top: 40px; bottom: 20px;
        width: 6px;
        cursor: e-resize;
      }
      .acu-window-resize-handle.s {
        left: 20px; right: 20px; bottom: 0;
        height: 6px;
        cursor: s-resize;
      }
      .acu-window-resize-handle.w {
        left: 0; top: 40px; bottom: 20px;
        width: 6px;
        cursor: w-resize;
      }
      .acu-window-resize-handle.n {
        left: 20px; right: 20px; top: 0;
        height: 6px;
        cursor: n-resize;
      }
      .acu-window-resize-handle.nw {
        left: 0; top: 0;
        width: 20px; height: 20px;
        cursor: nw-resize;
      }
      .acu-window-resize-handle.ne {
        right: 0; top: 0;
        width: 20px; height: 20px;
        cursor: ne-resize;
      }
      .acu-window-resize-handle.sw {
        left: 0; bottom: 0;
        width: 20px; height: 20px;
        cursor: sw-resize;
      }
    `;
    
    const style = targetDoc.createElement('style');
    style.id = `${SCRIPT_ID_PREFIX_ACU}-window-styles`;
    style.textContent = css;
    (targetDoc.head || targetDoc.documentElement).appendChild(style);
  }

  // ═══ 窗口状态存储键 ═══
  const ACU_WINDOW_STATE_STORAGE_KEY = `${SCRIPT_ID_PREFIX_ACU}_windowStates`;
  
  /**
   * 获取窗口状态存储对象
   */
  function getWindowStates_ACU() {
    try {
      const store = getConfigStorage_ACU();
      const raw = store?.getItem?.(ACU_WINDOW_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = safeJsonParse_ACU(raw, {});
        return (typeof parsed === 'object' && parsed !== null) ? parsed : {};
      }
    } catch (e) {
      console.warn('[ACU] Failed to read window states:', e);
    }
    return {};
  }
  
  /**
   * 保存窗口状态
   * @param {string} windowId - 窗口ID
   * @param {object} state - 窗口状态 { width, height, isMaximized }
   */
  function saveWindowState_ACU(windowId, state) {
    try {
      const states = getWindowStates_ACU();
      states[windowId] = state;
      const store = getConfigStorage_ACU();
      store?.setItem?.(ACU_WINDOW_STATE_STORAGE_KEY, safeJsonStringify_ACU(states, '{}'));
      // 触发酒馆设置持久化
      persistTavernSettings_ACU();
    } catch (e) {
      console.warn('[ACU] Failed to save window state:', e);
    }
  }
  
  /**
   * 获取指定窗口的状态
   * @param {string} windowId - 窗口ID
   * @returns {object|null} 窗口状态或null
   */
  function getWindowState_ACU(windowId) {
    const states = getWindowStates_ACU();
    return states[windowId] || null;
  }

  /**
   * 创建独立浮动窗口
   * @param {object} options
   * @param {string} options.id - 窗口唯一ID
   * @param {string} options.title - 窗口标题
   * @param {string} options.content - 窗口内容HTML
   * @param {number} [options.width=900] - 初始宽度
   * @param {number} [options.height=700] - 初始高度
   * @param {boolean} [options.modal=false] - 是否为模态窗口（带遮罩）
   * @param {boolean} [options.resizable=true] - 是否可调整大小
   * @param {boolean} [options.maximizable=true] - 是否可最大化
   * @param {boolean} [options.startMaximized=false] - 是否启动时全屏
   * @param {boolean} [options.rememberState=true] - 是否记住窗口状态
   * @param {function} [options.onClose] - 关闭回调
   * @param {function} [options.onReady] - 窗口就绪回调（DOM已插入）
   * @returns {jQuery} 窗口jQuery对象
   */
  function createACUWindow(options) {
    const {
      id,
      title = '窗口',
      content = '',
      width = 900,
      height = 700,
      modal = false,
      resizable = true,
      maximizable = true,
      startMaximized = false,
      rememberState = true, // 默认记住窗口状态
      onClose,
      onReady
    } = options;
    
    // 确保样式已注入
    injectACUWindowStyles();
    
    // 如果窗口已存在，直接显示并置顶
    if (ACU_WindowManager.isOpen(id)) {
      ACU_WindowManager.bringToFront(id);
      return ACU_WindowManager.getWindow(id);
    }
    
    // ═══ 关键：始终挂载到酒馆主窗口（topLevelWindow_ACU）═══
    const targetWin = topLevelWindow_ACU || window;
    const targetDoc = targetWin.document;
    const $ = targetWin.jQuery || (typeof jQuery_API_ACU !== 'undefined' ? jQuery_API_ACU : null);
    if (!$) {
      console.error('[ACU] jQuery not available for window creation');
      return null;
    }
    
    // 计算初始位置（居中）—— 使用主窗口的尺寸
    const viewW = targetWin.innerWidth || 1200;
    const viewH = targetWin.innerHeight || 800;
    
    // ═══ 窄屏检测：≤1100px 视为窄屏，≤768px 视为手机屏 ═══
    const isNarrowScreen = viewW <= 1100;
    const isPhoneScreen = viewW <= 768;
    
    // ═══ 恢复上次保存的窗口状态 ═══
    let savedState = null;
    let useSavedState = false;
    if (rememberState) {
      savedState = getWindowState_ACU(id);
      // 只有在非窄屏模式下才使用保存的状态，窄屏始终使用响应式尺寸
      if (savedState && !isNarrowScreen) {
        useSavedState = true;
      }
    }
    
    // 确保宽高不超过视口；手机端使用更紧凑的浮层尺寸，避免遮挡过多聊天内容
    let initialW, initialH;
    if (useSavedState && savedState.width && savedState.height) {
      // 使用保存的窗口尺寸（确保不超过当前视口）
      initialW = Math.max(400, Math.min(savedState.width, viewW - 40));
      initialH = Math.max(300, Math.min(savedState.height, viewH - 40));
    } else if (isPhoneScreen) {
      const phoneHorizontalMargin = 12;
      const phoneVerticalMargin = 12;
      const phoneMinWidth = Math.min(320, Math.max(280, viewW - phoneHorizontalMargin));
      const phoneMinHeight = Math.min(360, Math.max(280, viewH - phoneVerticalMargin));
      initialW = Math.max(phoneMinWidth, Math.min(460, viewW - phoneHorizontalMargin));
      initialH = Math.max(phoneMinHeight, Math.min(Math.round(viewH * 0.82), viewH - phoneVerticalMargin));
    } else {
      initialW = Math.max(400, Math.min(width, viewW - 40));
      initialH = Math.max(300, Math.min(height, viewH - 40));
    }
    // 居中并确保不跑出屏幕
    const screenEdgePadding = isPhoneScreen ? 6 : 20;
    const initialX = Math.max(screenEdgePadding, Math.min((viewW - initialW) / 2, viewW - initialW - screenEdgePadding));
    const initialY = Math.max(screenEdgePadding, Math.min((viewH - initialH) / 2, viewH - initialH - screenEdgePadding));
    
    // 构建窗口HTML
    // ═══ 窄屏模式下不显示全屏按钮，只显示关闭按钮 ═══
    const showMaximizeBtn = maximizable && !isNarrowScreen;
    const windowHtml = `
      <div class="acu-window" id="${id}" style="left:${initialX}px; top:${initialY}px; width:${initialW}px; height:${initialH}px;">
        <div class="acu-window-header">
          <div class="acu-window-title">
            <i class="fa-solid fa-database"></i>
            <span>${title}</span>
          </div>
          <div class="acu-window-controls">
            <button class="acu-window-btn theme-toggle" title="切换主题"><span class="acu-theme-toggle-text">素纱</span></button>
            ${showMaximizeBtn ? '<button class="acu-window-btn maximize" title="最大化/还原"><i class="fa-solid fa-expand"></i></button>' : ''}
            <button class="acu-window-btn close" title="关闭"><i class="fa-solid fa-times"></i></button>
          </div>
        </div>
        <div class="acu-window-body">${content}</div>
        ${resizable ? `
          <div class="acu-window-resize-handle se"></div>
          <div class="acu-window-resize-handle e"></div>
          <div class="acu-window-resize-handle s"></div>
          <div class="acu-window-resize-handle w"></div>
          <div class="acu-window-resize-handle n"></div>
          <div class="acu-window-resize-handle nw"></div>
          <div class="acu-window-resize-handle ne"></div>
          <div class="acu-window-resize-handle sw"></div>
        ` : ''}
      </div>
    `;
    
    // 创建遮罩层（模态窗口）—— 挂载到主窗口 body
    let $overlay = null;
    if (modal) {
      $overlay = $(`<div class="acu-window-overlay" data-for="${id}"></div>`);
      $(targetDoc.body).append($overlay);
    }
    
    // 插入窗口 —— 挂载到主窗口 body
    const $window = $(windowHtml);
    $(targetDoc.body).append($window);
    applyACUThemeToDocument_ACU(targetDoc);
    syncACUThemeButtons_ACU(targetDoc);
    
    // 注册到窗口管理器
    ACU_WindowManager.register(id, $window);
    
    // 点击窗口置顶
    $window.on('mousedown', () => ACU_WindowManager.bringToFront(id));

    // 主题切换
    $window.find('.acu-window-btn.theme-toggle').on('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleACUTheme_ACU(targetDoc);
    });
    
    // 关闭按钮
    $window.find('.acu-window-btn.close').on('click', () => {
      // ═══ 关闭时保存窗口状态 ═══
      if (rememberState && maximizable) {
        const currentState = {
          width: isMaximized ? restoreState.width : $window.width(),
          height: isMaximized ? restoreState.height : $window.height(),
          isMaximized: isMaximized
        };
        saveWindowState_ACU(id, currentState);
      }
      
      if (onClose) onClose();
      if ($overlay) $overlay.remove();
      $window.remove();
      ACU_WindowManager.unregister(id);
      // 清理事件
      $(targetDoc).off('.acuWindowDrag' + id);
      $(targetDoc).off('.acuWindowResize' + id);
    });
    
    // 遮罩层点击关闭（可选）
    if ($overlay) {
      $overlay.on('click', (e) => {
        if (e.target === $overlay[0]) {
          // 可以选择不关闭，或者关闭
          // 这里选择不关闭，用户必须点击关闭按钮
        }
      });
    }
    
    // 最大化/还原
    let isMaximized = false;
    let restoreState = { left: initialX, top: initialY, width: initialW, height: initialH };
    
    const doMaximize = () => {
      restoreState = {
        left: parseInt($window.css('left')),
        top: parseInt($window.css('top')),
        width: $window.width(),
        height: $window.height()
      };
      $window.addClass('maximized');
      $window.find('.acu-window-btn.maximize i').removeClass('fa-expand').addClass('fa-compress');
      isMaximized = true;
    };
    
    const doRestore = () => {
      $window.removeClass('maximized');
      $window.css({
        left: restoreState.left + 'px',
        top: restoreState.top + 'px',
        width: restoreState.width + 'px',
        height: restoreState.height + 'px'
      });
      $window.find('.acu-window-btn.maximize i').removeClass('fa-compress').addClass('fa-expand');
      isMaximized = false;
    };
    
    $window.find('.acu-window-btn.maximize').on('click', () => {
      if (isMaximized) {
        doRestore();
      } else {
        doMaximize();
      }
    });
    
    // ═══ 启动时全屏逻辑（优先级：窄屏强制全屏 > 保存的状态 > startMaximized参数）═══
    // 平板窄屏默认全屏；手机模式保留边距式浮层，避免遮挡过多内容
    if (isNarrowScreen && !isPhoneScreen && maximizable) {
      doMaximize();
    } else if (useSavedState && savedState.isMaximized && maximizable) {
      // 恢复上次的全屏状态
      doMaximize();
    } else if (startMaximized && maximizable) {
      // 使用传入的 startMaximized 参数
      doMaximize();
    }
    
    // 拖拽移动 —— 事件绑定到主窗口 document
    let isDragging = false;
    let dragStartX, dragStartY, windowStartX, windowStartY;
    
    $window.find('.acu-window-header').on('mousedown', (e) => {
      if ($(e.target).closest('.acu-window-controls').length) return;
      if (isMaximized) return;
      
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      windowStartX = parseInt($window.css('left'));
      windowStartY = parseInt($window.css('top'));
      
      $(targetDoc.body).css('user-select', 'none');
    });
    
    $(targetDoc).on('mousemove.acuWindowDrag' + id, (e) => {
      if (!isDragging) return;
      
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      
      $window.css({
        left: Math.max(0, windowStartX + dx) + 'px',
        top: Math.max(0, windowStartY + dy) + 'px'
      });
    });
    
    $(targetDoc).on('mouseup.acuWindowDrag' + id, () => {
      if (isDragging) {
        isDragging = false;
        $(targetDoc.body).css('user-select', '');
      }
    });
    
    // 调整大小 —— 事件绑定到主窗口 document
    if (resizable) {
      let isResizing = false;
      let resizeType = '';
      let resizeStartX, resizeStartY, startWidth, startHeight, startLeft, startTop;
      
      $window.find('.acu-window-resize-handle').on('mousedown', function(e) {
        if (isMaximized) return;
        
        isResizing = true;
        resizeType = '';
        if ($(this).hasClass('se')) resizeType = 'se';
        else if ($(this).hasClass('e')) resizeType = 'e';
        else if ($(this).hasClass('s')) resizeType = 's';
        else if ($(this).hasClass('w')) resizeType = 'w';
        else if ($(this).hasClass('n')) resizeType = 'n';
        else if ($(this).hasClass('nw')) resizeType = 'nw';
        else if ($(this).hasClass('ne')) resizeType = 'ne';
        else if ($(this).hasClass('sw')) resizeType = 'sw';
        
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;
        startWidth = $window.width();
        startHeight = $window.height();
        startLeft = parseInt($window.css('left'));
        startTop = parseInt($window.css('top'));
        
        $(targetDoc.body).css('user-select', 'none');
        e.stopPropagation();
      });
      
      $(targetDoc).on('mousemove.acuWindowResize' + id, (e) => {
        if (!isResizing) return;
        
        const dx = e.clientX - resizeStartX;
        const dy = e.clientY - resizeStartY;
        const minW = 400, minH = 300;
        
        let newW = startWidth, newH = startHeight, newL = startLeft, newT = startTop;
        
        if (resizeType.includes('e')) newW = Math.max(minW, startWidth + dx);
        if (resizeType.includes('s')) newH = Math.max(minH, startHeight + dy);
        if (resizeType.includes('w')) {
          const proposedW = startWidth - dx;
          if (proposedW >= minW) {
            newW = proposedW;
            newL = startLeft + dx;
          }
        }
        if (resizeType.includes('n')) {
          const proposedH = startHeight - dy;
          if (proposedH >= minH) {
            newH = proposedH;
            newT = startTop + dy;
          }
        }
        
        $window.css({
          width: newW + 'px',
          height: newH + 'px',
          left: newL + 'px',
          top: newT + 'px'
        });
      });
      
      $(targetDoc).on('mouseup.acuWindowResize' + id, () => {
        if (isResizing) {
          isResizing = false;
          $(targetDoc.body).css('user-select', '');
        }
      });
    }
    
    // 清理事件（窗口关闭时）
    $window.on('remove', () => {
      $(targetDoc).off('.acuWindowDrag' + id);
      $(targetDoc).off('.acuWindowResize' + id);
    });
    
    // 回调
    if (onReady) {
      setTimeout(() => onReady($window), 50);
    }
    
    return $window;
  }

  /**
   * 关闭指定窗口
   */
  function closeACUWindow(id) {
    const $window = ACU_WindowManager.getWindow(id);
    if ($window) {
      // 获取主窗口 jQuery
      const targetWin = topLevelWindow_ACU || window;
      const $ = targetWin.jQuery || (typeof jQuery_API_ACU !== 'undefined' ? jQuery_API_ACU : null);
      if ($) {
        $(`.acu-window-overlay[data-for="${id}"]`).remove();
        // 清理事件
        $(targetWin.document).off('.acuWindowDrag' + id);
        $(targetWin.document).off('.acuWindowResize' + id);
      }
      $window.remove();
      ACU_WindowManager.unregister(id);
    }
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ 独立窗口系统结束 ███
  // ═══════════════════════════════════════════════════════════════════════════════

  // --- [Legacy] 旧版"单份设置/单份模板"存储键（仅用于迁移；新版本不再直接读写它们） ---