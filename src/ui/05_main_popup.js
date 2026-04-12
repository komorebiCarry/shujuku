  async function openAutoCardPopup_ACU() {
    if (!coreApisAreReady_ACU) {
      showToastr_ACU('error', '核心API未就绪。');
      return;
    }
    showToastr_ACU('info', '正在准备数据库更新工具...', { timeOut: 1000 });
    // The state is managed by background event listeners. The popup should only display the current state.
    // Calling reset here could cause race conditions or incorrect state wipes.
    loadSettings_ACU(); // Load latest settings into UI

    const popupHtml = `
            <div id="${POPUP_ID_ACU}" class="auto-card-updater-popup">
                <style>
                    /* ═══════════════════════════════════════════════════════════════
                       星·数据库 UI 设计系统（仅影响插件自身）
                       目标：大气、简约、高级；超窄屏也能舒服用
                       ═══════════════════════════════════════════════════════════════ */
                    
                    /* 基础隔离：尽量不吃外部样式（但不使用 all: initial，避免破坏第三方组件） */
                    #${POPUP_ID_ACU}, #${POPUP_ID_ACU} * { box-sizing: border-box; }
                    #${POPUP_ID_ACU} { color-scheme: dark; }

                    #${POPUP_ID_ACU} {
                        /* 主题色：深色中性 + 蓝紫高光（不单调，但克制） */
                        --acu-bg-0: #0b0f15;
                        --acu-bg-1: #101826;
                        --acu-bg-2: rgba(255, 255, 255, 0.06);
                        --acu-bg-3: rgba(255, 255, 255, 0.09);
                        --acu-border: rgba(255, 255, 255, 0.12);
                        --acu-border-2: rgba(255, 255, 255, 0.18);
                        --acu-text-1: rgba(255, 255, 255, 0.92);
                        --acu-text-2: rgba(255, 255, 255, 0.74);
                        --acu-text-3: rgba(255, 255, 255, 0.52);

                        --acu-accent: #7bb7ff;
                        --acu-accent-2: #9b7bff;
                        --acu-accent-glow: rgba(123, 183, 255, 0.22);
                        --acu-accent-glow-2: rgba(155, 123, 255, 0.18);

                        --acu-success: #4ad19f;
                        --acu-warning: #ffb85c;
                        --acu-danger: #ff6b6b;

                        --acu-radius-lg: 16px;
                        --acu-radius-md: 12px;
                        --acu-radius-sm: 10px;

                        --acu-shadow: 0 18px 60px rgba(0, 0, 0, 0.55);
                        
                        /* 兼容旧 inline style 里使用的变量名（避免依赖外部主题） */
                        --bg-primary: var(--acu-bg-0);
                        --bg-secondary: var(--acu-bg-1);
                        --background_light: rgba(255, 255, 255, 0.04);
                        --background_default: rgba(255, 255, 255, 0.03);
                        --background-color-light: rgba(255, 255, 255, 0.04);
                        --input-background: rgba(0, 0, 0, 0.26);
                        --input-text-color: var(--acu-text-1);
                        --text-main: var(--acu-text-1);
                        --text_primary: var(--acu-text-1);
                        --text_secondary: var(--acu-text-2);
                        --text_tertiary: var(--acu-text-3);
                        --text-color: var(--acu-text-1);
                        --text-color-dimmed: var(--acu-text-3);
                        --border_color: var(--acu-border);
                        --border_color_light: var(--acu-border);
                        --border-normal: var(--acu-border-2);
                        --warning-color: var(--acu-warning);
                        --error-color: var(--acu-danger);
                        --button-background: rgba(255, 255, 255, 0.06);
                        --button-secondary-background: rgba(255, 255, 255, 0.04);
                        --green: var(--acu-success);
                        --orange: var(--acu-warning);
                        --red: var(--acu-danger);
                        
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "HarmonyOS Sans SC", "MiSans", Roboto, Helvetica, Arial, sans-serif;
                        font-size: 14px;
                        line-height: 1.6;
                        color: var(--acu-text-1);
                        width: 100%;
                        max-width: 100vw;
                        /* 关键：设置高度为100%并启用滚动，确保内容不溢出 */
                        height: 100%;
                        box-sizing: border-box;
                        overflow-x: hidden;
                        overflow-y: auto;
                        padding: 14px;
                        /* 移动端安全区域适配 */
                        padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
                        background:
                            radial-gradient(1200px 600px at 10% -10%, rgba(123, 183, 255, 0.18), transparent 60%),
                            radial-gradient(900px 500px at 100% 0%, rgba(155, 123, 255, 0.14), transparent 55%),
                            linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%),
                            var(--acu-bg-0);
                    }

                    /* 防横向溢出兜底：任何子元素都不应把容器撑出屏幕 */
                    #${POPUP_ID_ACU} * { max-width: 100%; }
                    #${POPUP_ID_ACU} .acu-layout,
                    #${POPUP_ID_ACU} .acu-main,
                    #${POPUP_ID_ACU} .acu-tab-content,
                    #${POPUP_ID_ACU} .acu-card,
                    #${POPUP_ID_ACU} .acu-tabs-nav { min-width: 0; }

                    /* 顶部标题条 */
                    #${POPUP_ID_ACU} .acu-header {
                        display: flex;
                        align-items: flex-start;
                        justify-content: center;
                        gap: 12px;
                        padding: 12px 12px 10px 12px;
                        border: 1px solid var(--acu-border);
                        border-radius: var(--acu-radius-lg);
                        background: rgba(255, 255, 255, 0.03);
                        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.35);
                        backdrop-filter: blur(10px);
                        -webkit-backdrop-filter: blur(10px);
                    }
                    /* 顶部标题块居中（宽屏/窄屏一致） */
                    #${POPUP_ID_ACU} .acu-header > div {
                        width: 100%;
                        text-align: center;
                    }

                    #${POPUP_ID_ACU} h2#updater-main-title-acu {
                        margin: 0;
                        padding: 0;
                        border: none;
                        font-size: 16px;
                        line-height: 1.35;
                        font-weight: 650;
                        letter-spacing: 0.2px;
                        color: var(--acu-text-1);
                        text-align: center;
                    }
                    
                    #${POPUP_ID_ACU} .acu-header-sub {
                        margin-top: 6px;
                        font-size: 12px;
                        color: var(--acu-text-3);
                        text-align: center;
                    }

                    #${POPUP_ID_ACU} .acu-layout {
                        display: grid;
                        grid-template-columns: 240px minmax(0, 1fr);
                        gap: 14px;
                        margin-top: 14px;
                        min-height: 0; /* 允许在flex布局中收缩 */
                    }

                    /* 导航（桌面：侧边栏；移动：顶部横向） */
                    #${POPUP_ID_ACU} .acu-tabs-nav {
                        border: 1px solid var(--acu-border);
                        border-radius: var(--acu-radius-lg);
                        background: rgba(255, 255, 255, 0.03);
                        padding: 10px;
                        display: flex;
                        flex-direction: column;
                        gap: 6px;
                        position: sticky;
                        top: 0;
                        align-self: start;
                        max-height: calc(100vh - 180px);
                        overflow: auto;
                    }

                    #${POPUP_ID_ACU} .acu-nav-section-title {
                        padding: 10px 10px 6px 10px;
                        color: var(--acu-text-3);
                        font-size: 12px;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                        user-select: none;
                    }
                    
                    #${POPUP_ID_ACU} .acu-tab-button {
                        width: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 10px;
                        padding: 10px 12px;
                        border: 1px solid transparent;
                        border-radius: 12px;
                        background: transparent;
                        color: var(--acu-text-2);
                        font-size: 13px;
                        font-weight: 600;
                        letter-spacing: 0.2px;
                        cursor: pointer;
                        transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
                    }
                    #${POPUP_ID_ACU} .acu-tab-button:hover {
                        background: rgba(255, 255, 255, 0.06);
                        border-color: rgba(255, 255, 255, 0.10);
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} .acu-tab-button.active {
                        background:
                            linear-gradient(135deg, rgba(123, 183, 255, 0.22), rgba(155, 123, 255, 0.14));
                        border-color: rgba(123, 183, 255, 0.35);
                        color: var(--acu-text-1);
                        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.35);
                    }
                    #${POPUP_ID_ACU} .acu-tab-button::after {
                        content: "›";
                        opacity: 0.55;
                        font-weight: 700;
                    }
                    #${POPUP_ID_ACU} .acu-tab-button.active::after { opacity: 0.9; }

                    /* 内容区 */
                    #${POPUP_ID_ACU} .acu-main {
                        min-width: 0;
                        min-height: 0; /* 允许在flex布局中收缩 */
                        overflow: visible; /* 让滚动在父容器处理 */
                    }

                    #${POPUP_ID_ACU} .acu-tab-content { display: none; }
                    #${POPUP_ID_ACU} .acu-tab-content.active { display: block; animation: acuFadeUp 160ms ease-out; }
                    @keyframes acuFadeUp {
                        from { opacity: 0; transform: translateY(6px); }
                        to { opacity: 1; transform: translateY(0); }
                    }

                    /* 卡片（统一高级质感） */
                    #${POPUP_ID_ACU} .acu-card {
                        border: 1px solid var(--acu-border);
                        border-radius: var(--acu-radius-lg);
                        background: rgba(255, 255, 255, 0.03);
                        padding: 16px;
                        margin-bottom: 14px;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.25);
                    }
                    #${POPUP_ID_ACU} .acu-card h3 {
                        margin: 0 0 12px 0;
                        padding: 0 0 10px 0;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                        font-size: 14px;
                        letter-spacing: 0.6px;
                        font-weight: 700;
                        color: var(--acu-text-1);
                    }
                    
                    /* 网格 */
                    #${POPUP_ID_ACU} .acu-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
                    #${POPUP_ID_ACU} .acu-grid-2x2 { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
                    
                    /* 表单 */
                    #${POPUP_ID_ACU} label {
                        display: block;
                        margin-bottom: 6px;
                        color: var(--acu-text-2);
                        font-size: 12px;
                        font-weight: 600;
                        letter-spacing: 0.2px;
                    }
                    #${POPUP_ID_ACU} input,
                    #${POPUP_ID_ACU} select,
                    #${POPUP_ID_ACU} textarea {
                        width: 100%;
                        padding: 10px 12px;
                        border-radius: 12px;
                        border: 1px solid var(--acu-border-2);
                        background: rgba(0, 0, 0, 0.35) !important;
                        color: var(--acu-text-1);
                        font-size: 14px;
                        outline: none;
                        transition: border-color 0.12s ease, box-shadow 0.12s ease;
                    }
                    #${POPUP_ID_ACU} input:focus, 
                    #${POPUP_ID_ACU} select:focus, 
                    #${POPUP_ID_ACU} textarea:focus {
                        border-color: rgba(123, 183, 255, 0.55);
                        box-shadow: 0 0 0 3px var(--acu-accent-glow);
                    }
                    #${POPUP_ID_ACU} textarea { min-height: 92px; resize: vertical; line-height: 1.55; }
                    #${POPUP_ID_ACU} input::placeholder, #${POPUP_ID_ACU} textarea::placeholder { color: rgba(255, 255, 255, 0.35); }

                    /* iOS：阻止输入框聚焦缩放 */
                    @media (max-width: 480px) {
                        #${POPUP_ID_ACU} input, #${POPUP_ID_ACU} select, #${POPUP_ID_ACU} textarea { font-size: 16px; }
                    }

                    /* 按钮体系（更克制：更小、更稳，不花哨） */
                    #${POPUP_ID_ACU} button, #${POPUP_ID_ACU} .button {
                        padding: 8px 12px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.16);
                        background: rgba(255, 255, 255, 0.04);
                        color: var(--acu-text-2);
                        cursor: pointer;
                        font-weight: 650;
                        letter-spacing: 0.1px;
                        line-height: 1.1;
                        min-height: 34px;
                        transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
                    }
                    #${POPUP_ID_ACU} button:hover, #${POPUP_ID_ACU} .button:hover {
                        background: rgba(255, 255, 255, 0.06);
                        color: var(--acu-text-1);
                        border-color: rgba(255, 255, 255, 0.22);
                    }
                    #${POPUP_ID_ACU} button:active { transform: translateY(1px); }
                    #${POPUP_ID_ACU} button:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

                    /* 主按钮：去渐变，改为低饱和纯色强调 */
                    #${POPUP_ID_ACU} button.primary, #${POPUP_ID_ACU} .button.primary {
                        border-color: rgba(123, 183, 255, 0.38);
                        background: rgba(123, 183, 255, 0.16);
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} button.primary:hover, #${POPUP_ID_ACU} .button.primary:hover {
                        background: rgba(123, 183, 255, 0.22);
                        border-color: rgba(123, 183, 255, 0.50);
                    }
                    
                    /* 警告/危险：同样克制，保持辨识但不刺眼 */
                    #${POPUP_ID_ACU} .btn-warning {
                        background: rgba(255, 184, 92, 0.14);
                        border-color: rgba(255, 184, 92, 0.28);
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} .btn-danger {
                        background: rgba(255, 107, 107, 0.14);
                        border-color: rgba(255, 107, 107, 0.28);
                        color: var(--acu-text-1);
                    }
                    
                    /* 小按钮样式 - 用于全选/全不选等辅助按钮 */
                    #${POPUP_ID_ACU} .acu-btn-small, #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-manual-table-select-all, #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-manual-table-select-none {
                        padding: 4px 8px;
                        font-size: 0.8em;
                        font-weight: 600;
                        border-radius: 6px;
                        min-width: auto;
                        height: 28px;
                        line-height: 20px;
                    }

                    /* 中等按钮样式 - 用于主要操作按钮但需要控制大小的情况 */
                    #${POPUP_ID_ACU} .acu-btn-medium, #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-open-new-visualizer {
                        padding: 8px 12px;
                        font-size: 0.95em;
                        font-weight: 600;
                        border-radius: 10px;
                        min-width: auto;
                        height: 40px;
                    }

                    /* 数据管理按钮组：2×2 / 3×3 网格，等宽等高（不随文字长度变化） */
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons {
                        display: grid !important; /* 覆盖 .button-group 的 flex，避免变成“一排下来” */
                        gap: 12px !important;
                        align-items: stretch;
                        justify-items: stretch;
                        margin-top: 0;
                        min-width: 0;
                    }
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-2 {
                        grid-template-columns: repeat(2, minmax(0, 1fr));
                    }
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-3 {
                        grid-template-columns: repeat(3, minmax(0, 1fr));
                    }

                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                        width: 100% !important;
                        min-width: 0 !important;
                        height: 44px !important;
                        padding: 0 14px !important;
                        border-radius: 12px !important;
                        font-size: 0.92em !important;
                        font-weight: 750 !important;
                        letter-spacing: 0.12px;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        white-space: nowrap !important;
                        overflow: hidden !important;
                        text-overflow: ellipsis !important;
                        /* 提升对比度：更清晰的底色/边框，不花哨 */
                        background: rgba(255, 255, 255, 0.075) !important;
                        border: 1px solid rgba(255, 255, 255, 0.22) !important;
                        color: rgba(255,255,255,0.92) !important;
                        box-shadow: 0 10px 22px rgba(0,0,0,0.22);
                    }
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button:hover,
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button:hover {
                        background: rgba(255, 255, 255, 0.10) !important;
                        border-color: rgba(255, 255, 255, 0.30) !important;
                    }
                    
                    #${POPUP_ID_ACU} .button-group {
                        display: flex;
                        flex-wrap: wrap;
                        gap: 10px;
                        justify-content: center;
                        margin-top: 14px;
                    }

                    /* 兼容旧类名：保证“只来自插件自身”的统一观感 */
                    #${POPUP_ID_ACU} .menu_button {
                        border-radius: 12px !important;
                        border: 1px solid var(--acu-border-2) !important;
                    }

                    #${POPUP_ID_ACU} hr {
                        border: none;
                        border-top: 1px solid rgba(255, 255, 255, 0.10);
                        margin: 14px 0;
                    }
                    
                    /* 通用布局小组件 */
                    #${POPUP_ID_ACU} .flex-center { display: flex; justify-content: center; align-items: center; }
                    #${POPUP_ID_ACU} .input-group { display: flex; gap: 10px; align-items: center; }
                    #${POPUP_ID_ACU} .input-group input { flex: 1; min-width: 0; }
                    
                    #${POPUP_ID_ACU} .checkbox-group {
                        display: flex;
                        align-items: flex-start;
                        gap: 10px;
                        padding: 12px;
                        border-radius: var(--acu-radius-md);
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        background: rgba(0, 0, 0, 0.18);
                    }
                    
                    /* ✅ 复选框（最高优先级：按主题切换配色；不受浏览器风格影响；仅限插件弹窗作用域） */
                    #${POPUP_ID_ACU} input[type="checkbox"] {
                        -webkit-appearance: none !important;
                        appearance: none !important;
                        accent-color: initial !important;
                        width: 18px !important;
                        height: 18px !important;
                        min-width: 18px !important;
                        min-height: 18px !important;
                        border-radius: 4px !important;
                        border: 1px solid var(--acu-checkbox-border) !important;
                        background-color: var(--acu-checkbox-bg) !important;
                        background-image: none !important;
                        background-repeat: no-repeat !important;
                        background-position: center !important;
                        background-size: 12px 10px !important;
                        box-shadow: var(--acu-checkbox-shadow) !important;
                        margin: 0 !important;
                        cursor: pointer !important;
                        vertical-align: middle !important;
                        transition: background-color 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease !important;
                    }
                    /* 关键：禁用外部/浏览器可能注入的伪元素勾选样式，避免出现“蓝色小勾叠加” */
                    #${POPUP_ID_ACU} input[type="checkbox"]::before,
                    #${POPUP_ID_ACU} input[type="checkbox"]::after {
                        content: none !important;
                        display: none !important;
                    }
                    #${POPUP_ID_ACU} input[type="checkbox"]:checked {
                        border-color: var(--acu-checkbox-bg-checked) !important;
                        background-color: var(--acu-checkbox-bg-checked) !important;
                        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M1 5l3 3 7-7'/%3E%3C/svg%3E") !important;
                    }
                    #${POPUP_ID_ACU} input[type="checkbox"]:disabled {
                        opacity: 0.45 !important;
                        cursor: not-allowed !important;
                    }
                    #${POPUP_ID_ACU} input[type="checkbox"]:focus-visible {
                        outline: 2px solid var(--acu-checkbox-focus) !important;
                        outline-offset: 2px !important;
                    }
                    /* 位置微调（不改变外观规则） */
                    #${POPUP_ID_ACU} .checkbox-group input[type="checkbox"] { margin-top: 2px !important; }
                    #${POPUP_ID_ACU} .checkbox-group label { margin: 0; color: var(--acu-text-1); font-size: 13px; font-weight: 600; }

                    /* Toggle switch（剧情推进） */
                    #${POPUP_ID_ACU} .toggle-switch { position: relative; display: inline-block; width: 46px; height: 26px; flex-shrink: 0; }
                    /* 关键：滑动开关内部的 checkbox 必须保持“隐藏输入”形态，避免被上面的复选框样式接管 */
                    #${POPUP_ID_ACU} .toggle-switch input[type="checkbox"] {
                        -webkit-appearance: auto !important;
                        appearance: auto !important;
                        background: transparent !important;
                        border: 0 !important;
                        box-shadow: none !important;
                        width: 0 !important;
                        height: 0 !important;
                        min-width: 0 !important;
                        min-height: 0 !important;
                        opacity: 0 !important;
                        margin: 0 !important;
                        cursor: pointer !important;
                    }
                    #${POPUP_ID_ACU} .slider {
                        position: absolute; cursor: pointer; inset: 0;
                        background: rgba(255, 255, 255, 0.16);
                        border: 1px solid rgba(255, 255, 255, 0.14);
                        transition: 0.18s ease;
                        border-radius: 999px;
                    }
                    #${POPUP_ID_ACU} .slider:before {
                        content: ""; position: absolute;
                        height: 20px; width: 20px; left: 3px; top: 50%;
                        transform: translateY(-50%);
                        background: rgba(255, 255, 255, 0.92);
                        transition: 0.18s ease;
                        border-radius: 999px;
                    }
                    #${POPUP_ID_ACU} .toggle-switch input:checked + .slider {
                        background: linear-gradient(135deg, rgba(123, 183, 255, 0.55), rgba(155, 123, 255, 0.45));
                        border-color: rgba(123, 183, 255, 0.45);
                    }
                    #${POPUP_ID_ACU} .toggle-switch input:checked + .slider:before { transform: translateY(-50%) translateX(20px); }

                    /* 提示词编辑器 */
                    #${POPUP_ID_ACU} .prompt-segment { 
                        margin-bottom: 12px; 
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        background: rgba(0, 0, 0, 0.18);
                        padding: 12px;
                        border-radius: var(--acu-radius-md);
                    }
                    #${POPUP_ID_ACU} .prompt-segment-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
                    #${POPUP_ID_ACU} .prompt-segment-role { width: 120px !important; flex-grow: 0; }
                    #${POPUP_ID_ACU} .prompt-segment-delete-btn { 
                        width: 28px; height: 28px; padding: 0;
                        border-radius: 999px;
                        border: 1px solid rgba(255, 107, 107, 0.35);
                        background: rgba(255, 107, 107, 0.18);
                        color: var(--acu-text-1);
                        font-weight: 800;
                        line-height: 28px;
                    }
                    #${POPUP_ID_ACU} .${SCRIPT_ID_PREFIX_ACU}-add-prompt-segment-btn { 
                        height: 32px;
                        padding: 0 14px;
                        border-radius: 999px;
                        border-color: rgba(74, 209, 159, 0.35) !important;
                        background: rgba(74, 209, 159, 0.20) !important;
                        color: var(--acu-text-1) !important;
                    }
                    /* 剧情推进独立提示词组编辑器（避免与“数据库更新预设”事件冲突，使用独立 class） */
                    #${POPUP_ID_ACU} .plot-prompt-segment {
                        margin-bottom: 12px;
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        background: rgba(0, 0, 0, 0.18);
                        padding: 12px;
                        border-radius: var(--acu-radius-md);
                    }
                    #${POPUP_ID_ACU} .plot-prompt-segment-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 10px; }
                    #${POPUP_ID_ACU} .plot-prompt-segment-role { width: 120px !important; flex-grow: 0; }
                    #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-header-row,
                    #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-scope-grid,
                    #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-task-layout {
                        min-width: 0;
                    }
                    #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-scope-grid > *,
                    #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-task-layout > * {
                        min-width: 0;
                    }
                    #${POPUP_ID_ACU} .plot-prompt-segment-delete-btn {
                        width: 28px; height: 28px; padding: 0;
                        border-radius: 999px;
                        border: 1px solid rgba(255, 107, 107, 0.35);
                        background: rgba(255, 107, 107, 0.18);
                        color: var(--acu-text-1);
                        font-weight: 800;
                        line-height: 28px;
                    }
                    #${POPUP_ID_ACU} .${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt-segment-btn { 
                        height: 32px;
                        padding: 0 14px;
                        border-radius: 999px;
                        border-color: rgba(74, 209, 159, 0.35) !important;
                        background: rgba(74, 209, 159, 0.20) !important;
                        color: var(--acu-text-1) !important;
                    }

                    /* 世界书 */
                    #${POPUP_ID_ACU} .qrf_radio_group {
                        display: flex;
                        flex-wrap: wrap;
                        justify-content: center;
                        gap: 10px 16px;
                        padding: 12px;
                        border-radius: var(--acu-radius-md);
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        background: rgba(0, 0, 0, 0.16);
                    }
                    #${POPUP_ID_ACU} .qrf_radio_group input[type="radio"] { width: auto !important; margin: 0; accent-color: var(--acu-accent); }
                    #${POPUP_ID_ACU} .qrf_radio_group label { margin: 0 !important; color: var(--acu-text-1); font-weight: 650; }
                    #${POPUP_ID_ACU} .qrf_worldbook_list, #${POPUP_ID_ACU} .qrf_worldbook_entry_list {
                        border: 1px solid rgba(255, 255, 255, 0.10);
                        border-radius: var(--acu-radius-md);
                        background: rgba(0, 0, 0, 0.18);
                        padding: 8px;
                        max-height: 220px;
                        overflow: auto;
                    }
                    #${POPUP_ID_ACU} .qrf_worldbook_list_item { 
                        padding: 10px 10px;
                        border-radius: 10px;
                        cursor: pointer;
                        user-select: none;
                        color: var(--acu-text-2);
                        transition: background 0.12s ease, color 0.12s ease;
                        margin-bottom: 6px;
                        border: 1px solid transparent;
                    }
                    #${POPUP_ID_ACU} .qrf_worldbook_list_item:hover { background: rgba(255, 255, 255, 0.06); color: var(--acu-text-1); }
                    #${POPUP_ID_ACU} .qrf_worldbook_list_item.selected { 
                        background: linear-gradient(135deg, rgba(123, 183, 255, 0.22), rgba(155, 123, 255, 0.14));
                        border-color: rgba(123, 183, 255, 0.25);
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} .qrf_worldbook_entry_item { display: flex; align-items: flex-start; gap: 10px; padding: 8px 6px; }
                    #${POPUP_ID_ACU} .qrf_worldbook_entry_item input[type="checkbox"] { margin: 1px 0 0 0 !important; }
                    #${POPUP_ID_ACU} .qrf_worldbook_entry_item label { margin: 0; font-weight: 600; font-size: 13px; color: var(--acu-text-2); }

                    /* notes/辅助文字 */
                    #${POPUP_ID_ACU} .notes, #${POPUP_ID_ACU} small.notes {
                        display: block;
                        margin-top: 10px;
                        font-size: 12px;
                        line-height: 1.55;
                        color: var(--acu-text-3);
                        text-align: left;
                    }
                    
                    /* 底部状态栏：独立成条，居中不“歪” */
                    #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-status-message {
                        margin: 12px 0 0 0;
                        padding: 10px 12px;
                            width: 100%;
                        text-align: center;
                        border-radius: var(--acu-radius-md);
                        border: 1px solid rgba(255, 255, 255, 0.12);
                        background: rgba(0, 0, 0, 0.18);
                        color: var(--acu-text-2);
                        }
                        
                    /* 状态显示 */
                        #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-card-update-status-display {
                        padding: 10px 12px;
                        border-radius: var(--acu-radius-md);
                        border: 1px dashed rgba(255, 255, 255, 0.18);
                        background: rgba(0, 0, 0, 0.20);
                        color: var(--acu-text-2);
                        }
                    #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-total-messages-display { color: var(--acu-text-3); font-size: 12px; }
                        
                    /* 表格 */
                    #${POPUP_ID_ACU} table { width: 100%; border-collapse: collapse; }
                    #${POPUP_ID_ACU} table th { color: var(--acu-text-3); font-weight: 700; font-size: 12px; letter-spacing: 0.6px; }
                    #${POPUP_ID_ACU} table td { color: var(--acu-text-2); }
                    #${POPUP_ID_ACU} table tr:hover { background: rgba(123, 183, 255, 0.06); }

                    /* 滚动条 */
                    #${POPUP_ID_ACU} ::-webkit-scrollbar { width: 8px; height: 8px; }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.04); border-radius: 999px; }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.14); border-radius: 999px; }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.20); }
                        
                    /* Toast 终止按钮（剧情推进） */
                    #toast-container .qrf-abort-btn {
                        margin-left: 8px;
                        padding: 4px 10px;
                        border-radius: 999px;
                        border: 1px solid rgba(255, 107, 107, 0.35);
                        background: rgba(255, 107, 107, 0.20);
                        color: #fff;
                        cursor: pointer;
                        font-weight: 650;
                        white-space: nowrap;
                    }

                    /* 响应式：移动端优先解决"超窄 + 两侧空白" -> 让内容尽量占满可用宽度 */
                    @media screen and (max-width: 1100px) {
                        #${POPUP_ID_ACU} .acu-layout {
                            grid-template-columns: 1fr;
                            min-height: 0; /* 允许收缩 */
                        }
                        #${POPUP_ID_ACU} .acu-tabs-nav {
                            position: sticky;
                            top: 0;
                            z-index: 10;
                            flex-direction: row;
                            align-items: center;
                            overflow-x: auto;
                            overflow-y: hidden;
                            gap: 8px;
                            padding: 10px;
                            max-height: none; /* 移除高度限制 */
                            flex-shrink: 0; /* 导航条不收缩 */
                            -webkit-overflow-scrolling: touch; /* iOS平滑滚动 */
                            /* 窄屏模式下使用不透明背景，避免滚动时内容透出 */
                            background: #0d1117;
                            border-color: rgba(255, 255, 255, 0.12);
                        }
                        #${POPUP_ID_ACU} .acu-nav-section-title { display: none; }
                        #${POPUP_ID_ACU} .acu-tab-button { width: auto; white-space: nowrap; }
                        #${POPUP_ID_ACU} .acu-main { min-height: 0; }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-data-template-grid {
                            grid-template-columns: 1fr !important;
                            gap: 12px !important;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-data-template-grid > * {
                            min-width: 0;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-template-preset-left,
                        #${POPUP_ID_ACU} #acu-tab-data .acu-template-preset-actions {
                            width: 100%;
                            flex-wrap: wrap;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-template-preset-left .acu-mini-btn,
                        #${POPUP_ID_ACU} #acu-tab-data .acu-template-preset-actions .acu-mini-btn {
                            flex: 1 1 140px;
                            min-width: 0;
                            justify-content: center;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-data-isolation-row {
                            flex-direction: column;
                            align-items: stretch !important;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .acu-data-isolation-row > button {
                            width: 100%;
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .button-group.acu-data-mgmt-buttons.acu-cols-3 {
                            grid-template-columns: repeat(2, minmax(0, 1fr));
                        }
                        #${POPUP_ID_ACU} #acu-tab-data .button-group.acu-data-mgmt-buttons button,
                        #${POPUP_ID_ACU} #acu-tab-data .button-group.acu-data-mgmt-buttons .button {
                            height: auto !important;
                            min-height: 42px !important;
                            padding: 8px 10px !important;
                            white-space: normal !important;
                            line-height: 1.35 !important;
                        }
                    }
                    
                    /* 手机横屏/小平板 (≤768px) */
                    @media screen and (max-width: 768px) {
                        #${POPUP_ID_ACU} {
                            padding: 10px;
                            padding-bottom: calc(10px + env(safe-area-inset-bottom, 0px));
                            max-width: 100vw;
                            overflow-x: hidden;
                            overflow-y: auto;
                            box-sizing: border-box;
                            /* 确保高度不超过容器 */
                            max-height: 100%;
                        }
                        #${POPUP_ID_ACU} .acu-layout {
                            gap: 10px;
                            margin-top: 10px;
                            /* 防止内容溢出 */
                            min-height: 0;
                        }
                        #${POPUP_ID_ACU} .acu-header { padding: 10px; gap: 8px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} h2#updater-main-title-acu { font-size: 14px; }
                        #${POPUP_ID_ACU} .acu-card { padding: 12px; margin-bottom: 10px; }
                        #${POPUP_ID_ACU} .acu-card h3 { font-size: 13px; margin-bottom: 10px; padding-bottom: 8px; }
                        #${POPUP_ID_ACU} .acu-tabs-nav {
                            padding: 8px;
                            gap: 6px;
                            flex-shrink: 0;
                            /* 导航条不应该溢出 */
                            max-height: none;
                            /* 窄屏模式下使用不透明背景 */
                            background: #0d1117;
                            border-color: rgba(255, 255, 255, 0.12);
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-header-row {
                            flex-wrap: wrap;
                            align-items: flex-start !important;
                            gap: 10px !important;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-header-row > div:last-child {
                            width: 100%;
                            justify-content: flex-start !important;
                        }
                    }
                    
                    @media screen and (max-width: 520px) {
                        #${POPUP_ID_ACU} {
                            padding: 8px;
                            padding-bottom: calc(8px + env(safe-area-inset-bottom, 0px));
                        }
                        #${POPUP_ID_ACU} .acu-layout { gap: 8px; margin-top: 8px; min-height: 0; }
                        #${POPUP_ID_ACU} .acu-main { min-height: 0; }
                        #${POPUP_ID_ACU} .acu-grid, #${POPUP_ID_ACU} .acu-grid-2x2 { grid-template-columns: 1fr; gap: 8px; }
                        #${POPUP_ID_ACU} .acu-card[style*="grid-column: span 2"] { grid-column: auto !important; }
                        #${POPUP_ID_ACU} .input-group { flex-direction: column; align-items: stretch; gap: 6px; }
                        #${POPUP_ID_ACU} .input-group button { width: 100%; }
                        #${POPUP_ID_ACU} .button-group { flex-direction: column; gap: 6px; }
                        #${POPUP_ID_ACU} .button-group button { width: 100%; min-height: 32px; padding: 8px 12px; }
                        #${POPUP_ID_ACU} table { display: block; overflow-x: auto; white-space: nowrap; -webkit-overflow-scrolling: touch; font-size: 12px; }
                        #${POPUP_ID_ACU} table th, #${POPUP_ID_ACU} table td { padding: 4px 6px !important; }
                        #${POPUP_ID_ACU} .checkbox-group { padding: 10px; gap: 8px; }
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-scope-grid,
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-task-layout {
                            grid-template-columns: 1fr !important;
                            gap: 10px !important;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .plot-prompt-segment-toolbar {
                            flex-direction: column;
                            align-items: stretch;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .plot-prompt-segment-toolbar > div {
                            width: 100%;
                            justify-content: space-between;
                            flex-wrap: wrap;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .plot-prompt-segment-role {
                            width: 100% !important;
                        }

                        /* 剧情推进：预设下拉框单独占一行（更适合窄屏） */
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-preset-wrapper {
                            width: 100%;
                            flex-wrap: wrap;
                            align-items: stretch !important;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-preset-wrapper select {
                            flex: 1 1 100% !important;
                            width: 100% !important;
                            order: 1;
                        }
                        #${POPUP_ID_ACU} #acu-tab-plot .acu-plot-preset-wrapper button {
                            order: 2;
                            flex: 1 1 44px;
                            min-width: 44px;
                            padding: 8px 10px !important;
                        }

                        /* 小按钮在移动端保持紧凑 */
                        #${POPUP_ID_ACU} .acu-btn-small, #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-manual-table-select-all, #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-manual-table-select-none {
                            padding: 3px 6px;
                            font-size: 0.75em;
                            height: 26px;
                            min-width: 50px;
                            line-height: 18px;
                        }

                        /* 中等按钮在移动端适当缩小 */
                        #${POPUP_ID_ACU} .acu-btn-medium {
                            padding: 6px 10px;
                            font-size: 0.9em;
                            height: 36px;
                        }
                        
                        /* 移动端：仍保持网格（2列更好用），避免变回单列长列表 */
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                            height: 40px !important;
                            font-size: 0.9em !important;
                            padding: 0 12px !important;
                        }
                    }
                    
                    /* 极窄屏模式 (≤420px) */
                    @media screen and (max-width: 420px) {
                        #${POPUP_ID_ACU} { 
                            padding: 6px; 
                            padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
                        }
                        #${POPUP_ID_ACU} .acu-layout { gap: 6px; margin-top: 6px; min-height: 0; }
                        #${POPUP_ID_ACU} .acu-main { min-height: 0; }
                        #${POPUP_ID_ACU} .acu-header { padding: 8px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} h2#updater-main-title-acu { font-size: 13px; line-height: 1.3; }
                        #${POPUP_ID_ACU} .acu-card { padding: 10px; margin-bottom: 8px; border-radius: 10px; }
                        #${POPUP_ID_ACU} .acu-card h3 { font-size: 12px; margin-bottom: 8px; padding-bottom: 6px; }
                        #${POPUP_ID_ACU} .acu-tabs-nav { padding: 6px; gap: 4px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} .acu-tab-button { padding: 8px 10px; font-size: 12px; }
                        #${POPUP_ID_ACU} label { font-size: 11px; margin-bottom: 4px; }
                        #${POPUP_ID_ACU} input, #${POPUP_ID_ACU} select, #${POPUP_ID_ACU} textarea { 
                            padding: 8px 10px; 
                            border-radius: 8px;
                        }
                        #${POPUP_ID_ACU} button, #${POPUP_ID_ACU} .button { 
                            padding: 6px 10px; 
                            min-height: 32px;
                            border-radius: 8px;
                        }
                        #${POPUP_ID_ACU} .checkbox-group { padding: 8px; gap: 6px; border-radius: 8px; }
                        #${POPUP_ID_ACU} .checkbox-group label { font-size: 12px; }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                            height: 36px !important;
                            font-size: 0.85em !important;
                            padding: 0 10px !important;
                            border-radius: 8px !important;
                        }
                    }
                    
                    /* 超小屏幕 (≤360px) */
                    @media screen and (max-width: 360px) {
                        #${POPUP_ID_ACU} { 
                            padding: 4px; 
                            padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
                        }
                        #${POPUP_ID_ACU} .acu-layout { gap: 4px; margin-top: 4px; min-height: 0; }
                        #${POPUP_ID_ACU} .acu-main { min-height: 0; }
                        #${POPUP_ID_ACU} .acu-header { padding: 6px; border-radius: 8px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} h2#updater-main-title-acu { font-size: 12px; }
                        #${POPUP_ID_ACU} .acu-header-sub { font-size: 10px; margin-top: 4px; }
                        #${POPUP_ID_ACU} .acu-card { padding: 8px; margin-bottom: 6px; border-radius: 8px; }
                        #${POPUP_ID_ACU} .acu-card h3 { font-size: 11px; margin-bottom: 6px; padding-bottom: 4px; }
                        #${POPUP_ID_ACU} .acu-tabs-nav { padding: 4px; gap: 3px; border-radius: 8px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} .acu-tab-button { padding: 6px 8px; font-size: 11px; border-radius: 6px; }
                        #${POPUP_ID_ACU} .acu-tab-button::after { display: none; }
                        #${POPUP_ID_ACU} label { font-size: 10px; }
                        #${POPUP_ID_ACU} input, #${POPUP_ID_ACU} select, #${POPUP_ID_ACU} textarea { 
                            padding: 6px 8px; 
                            font-size: 14px; /* 保持16px防止iOS缩放 */
                            border-radius: 6px;
                        }
                        #${POPUP_ID_ACU} button, #${POPUP_ID_ACU} .button { 
                            padding: 5px 8px; 
                            min-height: 28px;
                            font-size: 11px;
                            border-radius: 6px;
                        }
                        #${POPUP_ID_ACU} .checkbox-group { padding: 6px; gap: 4px; border-radius: 6px; }
                        #${POPUP_ID_ACU} .checkbox-group label { font-size: 11px; line-height: 1.3; }
                        #${POPUP_ID_ACU} input[type="checkbox"] { 
                            width: 16px !important; 
                            height: 16px !important;
                            min-width: 16px !important;
                            min-height: 16px !important;
                        }
                        #${POPUP_ID_ACU} table { font-size: 11px; }
                        #${POPUP_ID_ACU} table th, #${POPUP_ID_ACU} table td { padding: 3px 4px !important; }
                        #${POPUP_ID_ACU} .button-group { gap: 4px; }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons { gap: 6px !important; }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-3,
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons.acu-cols-2 { 
                            grid-template-columns: repeat(2, minmax(0, 1fr)); 
                        }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                            height: 32px !important;
                            font-size: 0.8em !important;
                            padding: 0 6px !important;
                            border-radius: 6px !important;
                        }
                        #${POPUP_ID_ACU} hr { margin: 8px 0; }
                        #${POPUP_ID_ACU} .notes { font-size: 10px !important; line-height: 1.4; }
                    }

                    /* 表格模板预设：下拉旁的小工具条按钮（导入/导出/另存为等） */
                    #${POPUP_ID_ACU} .acu-template-presets {
                        border: 1px solid var(--acu-border);
                        background: rgba(255, 255, 255, 0.03);
                        box-shadow: 0 10px 36px rgba(0, 0, 0, 0.22);
                        backdrop-filter: blur(10px);
                        -webkit-backdrop-filter: blur(10px);
                    }
                    #${POPUP_ID_ACU} .acu-template-preset-toolbar {
                        display: flex;
                        gap: 10px;
                        align-items: center;
                        flex-wrap: wrap;
                    }
                    #${POPUP_ID_ACU} .acu-template-preset-toolbar .acu-template-preset-left {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        flex: 1;
                        min-width: 240px;
                    }
                    #${POPUP_ID_ACU} .acu-template-preset-toolbar .acu-template-preset-actions {
                        display: flex;
                        gap: 8px;
                        align-items: center;
                        flex-wrap: wrap;
                        justify-content: flex-end;
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn {
                        height: 32px;
                        padding: 0 10px;
                        border-radius: 10px;
                        border: 1px solid rgba(255, 255, 255, 0.14);
                        background: rgba(255, 255, 255, 0.06);
                        color: var(--acu-text-1);
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 8px;
                        font-size: 12px;
                        font-weight: 650;
                        letter-spacing: 0.2px;
                        transition: transform 0.12s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
                        white-space: nowrap;
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn:hover {
                        transform: translateY(-1px);
                        background: rgba(255, 255, 255, 0.09);
                        border-color: rgba(255, 255, 255, 0.20);
                        box-shadow: 0 10px 26px rgba(0, 0, 0, 0.25);
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn:active {
                        transform: translateY(0px);
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn.primary {
                        border-color: rgba(123, 183, 255, 0.35);
                        background: linear-gradient(180deg, rgba(123, 183, 255, 0.22), rgba(123, 183, 255, 0.10));
                        box-shadow: 0 10px 26px rgba(123, 183, 255, 0.14);
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn.danger {
                        border-color: rgba(255, 107, 107, 0.35);
                        background: linear-gradient(180deg, rgba(255, 107, 107, 0.22), rgba(255, 107, 107, 0.10));
                    }
                    #${POPUP_ID_ACU} .acu-mini-btn .fa-solid { opacity: 0.92; }
                    
                    /* 超极小屏幕 (≤320px) */
                    @media screen and (max-width: 320px) {
                        #${POPUP_ID_ACU} {
                            padding: 2px;
                            padding-bottom: calc(2px + env(safe-area-inset-bottom, 0px));
                        }
                        #${POPUP_ID_ACU} .acu-layout { gap: 2px; margin-top: 2px; min-height: 0; }
                        #${POPUP_ID_ACU} .acu-main { min-height: 0; }
                        #${POPUP_ID_ACU} .acu-header { padding: 4px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} h2#updater-main-title-acu { font-size: 11px; }
                        #${POPUP_ID_ACU} .acu-card { padding: 6px; margin-bottom: 4px; }
                        #${POPUP_ID_ACU} .acu-card h3 { font-size: 10px; margin-bottom: 4px; }
                        #${POPUP_ID_ACU} .acu-tabs-nav { padding: 3px; flex-shrink: 0; }
                        #${POPUP_ID_ACU} .acu-tab-button { padding: 5px 6px; font-size: 10px; }
                        #${POPUP_ID_ACU} .checkbox-group label { font-size: 10px; }
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                        #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                            height: 28px !important;
                            font-size: 0.75em !important;
                        }
                    }

                    /* ═══════════════════════════════════════════════════════════════
                       古典中国风双主题覆盖（墨纸 / 素纱）
                       仅在插件主面板作用域内覆盖，不影响外部页面
                       ═══════════════════════════════════════════════════════════════ */
                    #${POPUP_ID_ACU} {
                        --acu-bg-0: #24221f;
                        --acu-bg-1: #211f1c;
                        --acu-bg-2: #2a2824;
                        --acu-bg-3: rgba(193, 185, 173, 0.06);
                        --acu-border: #36332e;
                        --acu-border-2: rgba(193, 185, 173, 0.16);
                        --acu-text-1: #c1b9ad;
                        --acu-text-2: #9e978e;
                        --acu-text-3: #645e55;
                        --acu-accent: #7d4940;
                        --acu-accent-2: #8f5a4e;
                        --acu-accent-glow: rgba(125, 73, 64, 0.16);
                        --acu-accent-glow-2: rgba(138, 107, 94, 0.12);
                        --acu-success: #85725f;
                        --acu-warning: #9c7e56;
                        --acu-danger: #8b5a55;
                        --acu-radius-lg: 2px;
                        --acu-radius-md: 2px;
                        --acu-radius-sm: 1px;
                        --acu-shadow: 0 14px 32px rgba(0, 0, 0, 0.20);
                        --background_light: rgba(193, 185, 173, 0.04);
                        --background_default: rgba(193, 185, 173, 0.03);
                        --background-color-light: rgba(193, 185, 173, 0.04);
                        --input-background: rgba(26, 24, 22, 0.36);
                        --button-background: rgba(193, 185, 173, 0.03);
                        --button-secondary-background: rgba(193, 185, 173, 0.02);
                        --acu-checkbox-border: rgba(255, 255, 255, 0.22);
                        --acu-checkbox-bg: #000;
                        --acu-checkbox-bg-checked: #000;
                        --acu-checkbox-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
                        --acu-checkbox-focus: rgba(123, 183, 255, 0.75);
                        color-scheme: dark;
                        font-family: "Noto Serif SC", "Source Han Serif CN", "Songti SC", "STSong", "SimSun", serif;
                        font-weight: 500;
                        text-rendering: optimizeLegibility;
                        -webkit-font-smoothing: antialiased;
                        background-color: var(--acu-bg-0);
                        background-image:
                            url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
                    }
                    body.acu-theme-silk #${POPUP_ID_ACU} {
                        --acu-bg-0: #f4f1eb;
                        --acu-bg-1: #f9f8f5;
                        --acu-bg-2: #ebe7de;
                        --acu-bg-3: rgba(74, 69, 63, 0.05);
                        --acu-border: #e0dacb;
                        --acu-border-2: rgba(110, 103, 94, 0.18);
                        --acu-text-1: #4a453f;
                        --acu-text-2: #6e675e;
                        --acu-text-3: #9e978e;
                        --acu-accent: #8a6b5e;
                        --acu-accent-2: #9d7c6f;
                        --acu-accent-glow: rgba(138, 107, 94, 0.14);
                        --acu-accent-glow-2: rgba(138, 107, 94, 0.10);
                        --acu-success: #6f7b62;
                        --acu-warning: #a2835b;
                        --acu-danger: #a06a65;
                        --background_light: rgba(255, 255, 255, 0.58);
                        --background_default: rgba(255, 255, 255, 0.42);
                        --background-color-light: rgba(255, 255, 255, 0.48);
                        --input-background: rgba(255, 255, 255, 0.70);
                        --button-background: rgba(255, 255, 255, 0.50);
                        --button-secondary-background: rgba(255, 255, 255, 0.36);
                        --acu-checkbox-border: rgba(138, 107, 94, 0.42);
                        --acu-checkbox-bg: rgba(255, 255, 255, 0.92);
                        --acu-checkbox-bg-checked: #8a6b5e;
                        --acu-checkbox-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.58);
                        --acu-checkbox-focus: rgba(138, 107, 94, 0.34);
                        color-scheme: light;
                    }
                    #${POPUP_ID_ACU} .acu-header {
                        align-items: center;
                        justify-content: flex-start;
                        gap: 12px;
                        padding: 16px 20px;
                        border: 1px solid var(--acu-border);
                        border-radius: 2px;
                        background: transparent;
                        box-shadow: none;
                        backdrop-filter: none;
                        -webkit-backdrop-filter: none;
                    }
                    #${POPUP_ID_ACU} .acu-header::before {
                        content: '录';
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        width: 22px;
                        height: 22px;
                        border: 1px solid var(--acu-accent);
                        color: var(--acu-accent);
                        font-size: 12px;
                        border-radius: 1px;
                        opacity: 0.85;
                        letter-spacing: 1px;
                        flex-shrink: 0;
                    }
                    #${POPUP_ID_ACU} .acu-header > div {
                        text-align: left;
                    }
                    #${POPUP_ID_ACU} h2#updater-main-title-acu {
                        font-size: 14px;
                        font-weight: 650;
                        letter-spacing: 1.2px;
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} .acu-layout {
                        gap: 12px;
                        margin-top: 12px;
                    }
                    #${POPUP_ID_ACU} .acu-tabs-nav,
                    #${POPUP_ID_ACU} .acu-card,
                    #${POPUP_ID_ACU} .acu-template-presets,
                    #${POPUP_ID_ACU} .qrf_worldbook_list,
                    #${POPUP_ID_ACU} .qrf_worldbook_entry_list,
                    #${POPUP_ID_ACU} .checkbox-group,
                    #${POPUP_ID_ACU} .qrf_radio_group,
                    #${POPUP_ID_ACU} .prompt-segment,
                    #${POPUP_ID_ACU} .plot-prompt-segment,
                    #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-status-message,
                    #${POPUP_ID_ACU} #${SCRIPT_ID_PREFIX_ACU}-card-update-status-display {
                        background: var(--background_light);
                        border-color: var(--acu-border);
                        border-radius: 2px;
                        box-shadow: none;
                    }
                    #${POPUP_ID_ACU} .acu-nav-section-title {
                        color: var(--acu-text-3);
                        font-size: 11px;
                        letter-spacing: 2px;
                    }
                    #${POPUP_ID_ACU} .acu-tab-button {
                        border-radius: 1px;
                        padding: 10px 12px;
                        color: var(--acu-text-2);
                        font-weight: 600;
                        letter-spacing: 0.6px;
                    }
                    #${POPUP_ID_ACU} .acu-tab-button:hover {
                        background: var(--acu-bg-2);
                        border-color: var(--acu-border);
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} .acu-tab-button.active {
                        background: rgba(125, 73, 64, 0.10);
                        border-color: var(--acu-accent);
                        color: var(--acu-accent);
                        box-shadow: none;
                    }
                    #${POPUP_ID_ACU} .acu-tab-button::after {
                        color: var(--acu-text-3);
                    }
                    #${POPUP_ID_ACU} .acu-card h3 {
                        border-bottom-color: var(--acu-border);
                        font-size: 14px;
                        font-weight: 600;
                        letter-spacing: 0.6px;
                    }
                    #${POPUP_ID_ACU} label,
                    #${POPUP_ID_ACU} .notes,
                    #${POPUP_ID_ACU} small.notes {
                        color: var(--acu-text-2);
                    }
                    #${POPUP_ID_ACU} input,
                    #${POPUP_ID_ACU} select,
                    #${POPUP_ID_ACU} textarea {
                        border-radius: 1px;
                        border-color: var(--acu-border);
                        background: var(--input-background) !important;
                        color: var(--acu-text-1);
                    }
                    #${POPUP_ID_ACU} input:focus,
                    #${POPUP_ID_ACU} select:focus,
                    #${POPUP_ID_ACU} textarea:focus {
                        border-color: var(--acu-accent);
                        box-shadow: 0 0 0 2px var(--acu-accent-glow);
                    }
                    #${POPUP_ID_ACU} input::placeholder,
                    #${POPUP_ID_ACU} textarea::placeholder {
                        color: var(--acu-text-3);
                    }
                    #${POPUP_ID_ACU} button,
                    #${POPUP_ID_ACU} .button,
                    #${POPUP_ID_ACU} .menu_button,
                    #${POPUP_ID_ACU} .acu-mini-btn {
                        border-radius: 1px !important;
                        border-color: var(--acu-border-2) !important;
                        background: var(--button-background) !important;
                        color: var(--acu-text-2) !important;
                        box-shadow: none !important;
                        font-weight: 600;
                        letter-spacing: 0.6px;
                    }
                    #${POPUP_ID_ACU} button:hover,
                    #${POPUP_ID_ACU} .button:hover,
                    #${POPUP_ID_ACU} .menu_button:hover,
                    #${POPUP_ID_ACU} .acu-mini-btn:hover {
                        background: var(--acu-bg-2) !important;
                        border-color: var(--acu-border) !important;
                        color: var(--acu-text-1) !important;
                    }
                    #${POPUP_ID_ACU} button.primary,
                    #${POPUP_ID_ACU} .button.primary,
                    #${POPUP_ID_ACU} .acu-mini-btn.primary {
                        border-color: var(--acu-accent) !important;
                        background: rgba(125, 73, 64, 0.12) !important;
                        color: var(--acu-accent) !important;
                    }
                    #${POPUP_ID_ACU} button.primary:hover,
                    #${POPUP_ID_ACU} .button.primary:hover,
                    #${POPUP_ID_ACU} .acu-mini-btn.primary:hover {
                        background: rgba(125, 73, 64, 0.18) !important;
                    }
                    #${POPUP_ID_ACU} .btn-warning {
                        background: rgba(156, 126, 86, 0.14) !important;
                        border-color: rgba(156, 126, 86, 0.28) !important;
                        color: var(--acu-text-1) !important;
                    }
                    #${POPUP_ID_ACU} .btn-danger,
                    #${POPUP_ID_ACU} .acu-mini-btn.danger {
                        background: rgba(139, 90, 85, 0.14) !important;
                        border-color: rgba(139, 90, 85, 0.26) !important;
                        color: var(--acu-text-1) !important;
                    }
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons button,
                    #${POPUP_ID_ACU} .button-group.acu-data-mgmt-buttons .button {
                        background: rgba(193, 185, 173, 0.04) !important;
                        border: 1px solid var(--acu-border) !important;
                        color: var(--acu-text-1) !important;
                    }
                    body.acu-theme-silk #${POPUP_ID_ACU} .acu-tab-button:hover,
                    body.acu-theme-silk #${POPUP_ID_ACU} button:hover,
                    body.acu-theme-silk #${POPUP_ID_ACU} .button:hover,
                    body.acu-theme-silk #${POPUP_ID_ACU} .menu_button:hover,
                    body.acu-theme-silk #${POPUP_ID_ACU} .acu-mini-btn:hover {
                        background: var(--acu-bg-2) !important;
                    }
                    #${POPUP_ID_ACU} table tr:hover {
                        background: rgba(125, 73, 64, 0.06);
                    }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar { width: 4px; height: 4px; }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-track { background: transparent; }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-thumb {
                        background: var(--acu-border);
                        border-radius: 1px;
                    }
                    #${POPUP_ID_ACU} ::-webkit-scrollbar-thumb:hover {
                        background: var(--acu-text-3);
                    }
                    @media screen and (max-width: 768px) {
                        #${POPUP_ID_ACU} .acu-header {
                            padding: 12px 14px;
                            gap: 10px;
                        }
                        #${POPUP_ID_ACU} .acu-tabs-nav {
                            background: var(--background_light);
                            border-color: var(--acu-border);
                        }
                    }
                </style>

                <div class="acu-header">
                    <div>
                        <h2 id="updater-main-title-acu">当前聊天：${escapeHtml_ACU(
                          currentChatFileIdentifier_ACU || '未知',
                        )}</h2>
                    </div>
                </div>

                <div class="acu-layout">
                    <!-- 导航（分组分页） -->
                    <div class="acu-tabs-nav" aria-label="数据库工具导航">
                        <div class="acu-nav-section-title">运行</div>
                    <button class="acu-tab-button active" data-tab="status">状态 & 操作</button>
                        <div class="acu-nav-section-title">配置</div>
                    <button class="acu-tab-button" data-tab="prompt">AI指令预设</button>
                    <button class="acu-tab-button" data-tab="api">API & 连接</button>
                    <button class="acu-tab-button" data-tab="worldbook">世界书</button>
                        <div class="acu-nav-section-title">数据</div>
                    <button class="acu-tab-button" data-tab="data">数据管理</button>
                    <button class="acu-tab-button" data-tab="import">外部导入</button>
                        <div class="acu-nav-section-title">增强</div>
                    <button class="acu-tab-button" data-tab="plot">剧情推进（记忆召回）（必开！）</button>
                    <button class="acu-tab-button" data-tab="optimization" id="${SCRIPT_ID_PREFIX_ACU}-tab-optimization" style="display: none;">正文替换</button>
                </div>

                    <div class="acu-main">
                <!-- Tab内容 -->
                <div id="acu-tab-status" class="acu-tab-content active">
                    <div class="acu-grid">
                        <div class="acu-card" style="grid-column: span 2;">
                            <h3>数据库状态</h3>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-normal);">
                                <span id="${SCRIPT_ID_PREFIX_ACU}-total-messages-display">上下文总层数: N/A (仅计算AI回复楼层)</span>
                                <span id="${SCRIPT_ID_PREFIX_ACU}-card-update-status-display">正在获取状态...</span>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border-normal); color: var(--text-secondary);">
                                        <th style="text-align: left; padding: 5px;">表格名称</th>
                                        <th style="text-align: center; padding: 5px;">更新频率</th>
                                        <th style="text-align: center; padding: 5px;">未记录楼层</th>
                                        <th style="text-align: center; padding: 5px;">上次更新</th>
                                        <th style="text-align: center; padding: 5px;">下次触发</th>
                                    </tr>
                                </thead>
                                <tbody id="${SCRIPT_ID_PREFIX_ACU}-granular-status-table-body">
                                    <tr><td colspan="5" style="text-align: center; padding: 10px;">正在加载数据...</td></tr>
                                </tbody>
                            </table>

                            <p id="${SCRIPT_ID_PREFIX_ACU}-next-update-display" style="border-top: 1px dashed var(--border-normal); padding-top: 10px; margin-top: 10px; font-size: 0.95em; text-align: right;">下一次更新: 计算中...</p>
                        </div>
                        <div class="acu-card" style="grid-column: span 2;">
                            <h3>核心操作</h3>
                            <div class="flex-center" style="flex-direction: column; gap: 15px;">
                                <div style="width: 100%; display: flex; gap: 10px; align-items: center;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">填表API预设:</label>
                                    <select id="${SCRIPT_ID_PREFIX_ACU}-table-api-preset-select" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-normal);">
                                        <option value="">使用当前API配置</option>
                                    </select>
                                </div>
                                <div style="width: 100%; display: flex; flex-direction: column; gap: 6px;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">正文标签提取规则:</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-table-context-extract-add-rule" class="button" style="align-self: flex-start;">添加规则</button>
                                    <small class="notes">每条规则填写开始词和结束词，仅提取最后一组匹配内容（不影响注入词规则）。</small>
                                </div>
                                <div style="width: 100%; display: flex; flex-direction: column; gap: 6px;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">标签排除规则:</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-add-rule" class="button" style="align-self: flex-start;">添加规则</button>
                                    <small class="notes">每条规则填写开始词与结束词，仅移除最后一组匹配内容。</small>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-tableedit-last-pair-only-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-tableedit-last-pair-only-checkbox">仅识别最后一对 &lt;tableEdit&gt; 标签（忽略前面的思维链/草稿）</label>
                                </div>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-manual-update-card" class="primary" style="width:100%;">立即手动更新</button>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-manual-extra-hint-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-manual-extra-hint-checkbox">额外提示词（仅手动更新时临时追加）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-enabled-checkbox">启用自动更新</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-standardized-table-fill-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-standardized-table-fill-enabled-checkbox">规范填表功能（总结表与总体大纲必须同步新增）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-toast-mute-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-toast-mute-enabled-checkbox">静默提示框（除填表/规划/导入/报错外，其它提示不弹窗）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-prompt-template-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-prompt-template-enabled-checkbox">启用条件模板功能（<if>条件判断）</label>
                                </div>
                            </div>
                            <p class="notes" style="margin-top: 10px;">手动更新会使用当前UI参数，对勾选的表进行更新；未勾选则默认更新全部表。</p>
                            <p class="notes" style="margin-top: 6px;">勾选“额外提示词”后，点击手动更新会弹出输入框，内容将写入AI指令预设中的 $8 占位符，仅本次操作生效。</p>
                        </div>
                    </div>
                    <div class="acu-card">
                        <h3>手动更新表选择</h3>
                        <div class="notes" style="margin-bottom:6px;">选择需要手动更新的表（可多选，默认全选新表）：</div>
                        <div class="button-group" style="justify-content:flex-start; gap:8px; margin-bottom:6px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-manual-table-select-all" class="button">全选</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-manual-table-select-none" class="button">全不选</button>
                        </div>
                        <div id="${SCRIPT_ID_PREFIX_ACU}-manual-table-selector" style="min-height:60px;">加载表格列表中...</div>
                    </div>
                     <div class="acu-card">
                        <h3>公用设置</h3>
                            <div class="acu-grid">
                                <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-token-threshold">跳过更新最小回复长度:</label>
                                    <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-token-threshold" min="0" step="100" placeholder="${DEFAULT_AUTO_UPDATE_TOKEN_THRESHOLD_ACU}">
                                    </div>
                                    <small class="notes" style="font-size: 0.85em; color: #888;">AI回复少于此长度时跳过自动填表</small>
                                </div>
                                <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-table-max-retries">填表自动重试次数:</label>
                                    <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-table-max-retries" min="1" max="10" step="1" value="3">
                                    </div>
                                    <small class="notes" style="font-size: 0.85em; color: #888;">错误或空回时自动重试的次数（默认3次）</small>
                                </div>
                                    </div>
                        <p class="notes">当自动更新时，若上下文Token（约等于字符数）低于此值，则跳过本次更新。</p>
                        </div>

                    <div class="acu-card">
                        <h3>更新配置</h3>
                        <div class="acu-grid-2x2">
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-threshold">AI读取上下文层数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-threshold" min="0" step="1" placeholder="${DEFAULT_AUTO_UPDATE_THRESHOLD_ACU}">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-frequency">每N层自动更新一次:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-frequency" min="1" step="1" placeholder="${DEFAULT_AUTO_UPDATE_FREQUENCY_ACU}">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-update-batch-size">每批次更新楼层数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-update-batch-size" min="1" step="1" placeholder="2">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-max-concurrent-groups">最大并发数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-max-concurrent-groups" min="1" step="1" placeholder="1">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-skip-update-floors">保留X层楼不更新:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-skip-update-floors" min="0" step="1" placeholder="0">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-retain-recent-layers">保留最近N层数据:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-retain-recent-layers" min="0" step="1" placeholder="空=全部保留">
                                </div>
                                <div class="notes" style="margin-top:4px;font-size:11px;opacity:0.7;">按AI楼层计数，自动更新后清理超出层数的旧数据</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="acu-tab-prompt" class="acu-tab-content">
                    <div class="acu-card">
                        <h3>数据库更新预设 (任务指令)</h3>
                        <div id="${SCRIPT_ID_PREFIX_ACU}-prompt-constructor-area">
                            <div class="button-group" style="margin-bottom: 10px; justify-content: center;"><button class="${SCRIPT_ID_PREFIX_ACU}-add-prompt-segment-btn" data-position="top" title="在上方添加对话轮次">+</button></div>
                            <div id="${SCRIPT_ID_PREFIX_ACU}-prompt-segments-container">
                                <!-- Segments will be dynamically inserted here -->
                            </div>
                            <div class="button-group" style="margin-top: 10px; justify-content: center;"><button class="${SCRIPT_ID_PREFIX_ACU}-add-prompt-segment-btn" data-position="bottom" title="在下方添加对话轮次">+</button></div>
                        </div>
                        <div class="button-group">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-save-char-card-prompt" class="primary">保存</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-load-char-card-prompt-from-json">读取JSON模板</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-export-char-card-prompt-to-json">导出JSON模板</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-reset-char-card-prompt">恢复默认</button>
                        </div>
                    </div>
                </div>

                <div id="acu-tab-api" class="acu-tab-content">
                     <div class="acu-card">
                        <h3>API设置</h3>
                        <div class="qrf_settings_block_radio">
                            <label>API模式:</label>
                            <div class="qrf_radio_group">
                                <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-api-mode-custom" name="${SCRIPT_ID_PREFIX_ACU}-api-mode" value="custom" checked>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-mode-custom">自定义API</label>
                                <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-api-mode-tavern" name="${SCRIPT_ID_PREFIX_ACU}-api-mode" value="tavern">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-mode-tavern">使用酒馆连接预设</label>
                            </div>
                        </div>

                        <div id="${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-block" style="display: none; margin-top: 15px;">
                            <label for="${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-select">酒馆连接预设:</label>
                             <div class="input-group">
                                <select id="${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-select"></select>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-refresh-tavern-api-profiles" title="刷新预设列表">刷新</button>
                            </div>
                            <small class="notes">选择一个你在酒馆主设置中已经配置好的连接预设。</small>
                        </div>

                        <div id="${SCRIPT_ID_PREFIX_ACU}-custom-api-settings-block" style="margin-top: 15px;">
                             <div class="checkbox-group">
                                <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-use-main-api-checkbox">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-use-main-api-checkbox">使用主API (直接使用酒馆当前API和模型)</label>
                            </div>
                             <div class="checkbox-group" style="margin-top: 10px;">
                                <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-streaming-enabled-checkbox">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-streaming-enabled-checkbox">启用流式传输 (Streaming)</label>
                            </div>
                            <small class="notes" style="display: block; margin-left: 0; margin-bottom: 10px;">开启后，所有AI调用将使用流式传输，可减少首字节响应时间。默认关闭。</small>
                            <div id="${SCRIPT_ID_PREFIX_ACU}-custom-api-fields">
                                <p class="notes" style="color:var(--warning-color);"><b>安全提示:</b>API密钥将保存在浏览器本地存储中。</p>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-url">API基础URL:</label><input type="text" id="${SCRIPT_ID_PREFIX_ACU}-api-url">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-key">API密钥(可选):</label><input type="password" id="${SCRIPT_ID_PREFIX_ACU}-api-key">
                                <div class="acu-grid" style="margin-top: 10px;">
                                    <div>
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-max-tokens">最大Tokens:</label>
                                        <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-max-tokens" min="1" step="1" placeholder="120000">
                                    </div>
                                    <div>
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-temperature">温度:</label>
                                        <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-temperature" min="0" max="2" step="0.05" placeholder="0.9">
                                    </div>
                                </div>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-load-models" style="margin-top: 15px; width: 100%;">加载模型列表</button>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-model-input" style="margin-top: 10px;">模型名称 (手动输入):</label>
                                <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-api-model-input" class="text_pole" placeholder="输入模型名称或从下方选择" style="width: 100%;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-api-model-select" style="margin-top: 8px;">或从列表选择:</label>
                                <select id="${SCRIPT_ID_PREFIX_ACU}-api-model-select" class="text_pole" style="width: 100%;">
                                    <option value="">-- 请先加载模型列表 --</option>
                                </select>
                            </div>
                            <div id="${SCRIPT_ID_PREFIX_ACU}-api-status" class="notes" style="margin-top:15px;">状态: 未配置</div>
                            <div class="button-group">
                                <button id="${SCRIPT_ID_PREFIX_ACU}-save-config" class="primary">保存API</button>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-clear-config">清除API</button>
                            </div>
                            
                            <!-- API预设管理 -->
                            <div style="margin-top: 20px; padding-top: 15px; border-top: 1px dashed var(--border-normal);">
                                <h4 style="margin-bottom: 10px; font-size: 0.95em; color: var(--text-muted);">API预设管理</h4>
                                <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                                    <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-api-preset-name" placeholder="预设名称" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-normal);">
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-save-api-preset" class="primary" style="padding: 6px 12px;">保存为预设</button>
                        </div>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <select id="${SCRIPT_ID_PREFIX_ACU}-api-preset-select" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-normal);">
                                        <option value="">-- 选择预设 --</option>
                                    </select>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-load-api-preset" style="padding: 6px 12px;">加载</button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-delete-api-preset" style="padding: 6px 12px; background: var(--error-color); color: white;">删除</button>
                                </div>
                                <small class="notes" style="display: block; margin-top: 8px;">保存当前API配置为预设，可在填表和剧情推进中分别选用。</small>
                            </div>
                        </div>
                     </div>
                </div>

                <div id="acu-tab-worldbook" class="acu-tab-content">
                    <div class="acu-card">
                        <h3>世界书设置</h3>
                        <div>
                            <label for="${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target">数据注入目标:</label>
                            <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target-filter" placeholder="筛选世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                            <div class="input-group">
                                <select id="${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target" style="width: 100%;"></select>
                            </div>
                            <small class="notes">选择数据库条目（如全局、人物、大纲等）将被创建或更新到哪个世界书里。</small>
                        </div>
                        <div class="qrf_settings_block" style="margin-top: 12px; margin-bottom: 6px;">
                            <label for="${SCRIPT_ID_PREFIX_ACU}-worldbook-outline-entry-enabled"><strong>0TK占用模式</strong></label>
                            <label class="toggle-switch">
                                <input id="${SCRIPT_ID_PREFIX_ACU}-worldbook-outline-entry-enabled" type="checkbox" />
                                <span class="slider"></span>
                            </label>
                        </div>
                        <hr style="border-color: var(--border-normal); margin: 15px 0;">
                         <div class="qrf_settings_block_radio">
                            <label>世界书来源 (用于AI读取上下文):</label>
                            <div class="qrf_radio_group">
                                <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-worldbook-source-character" name="${SCRIPT_ID_PREFIX_ACU}-worldbook-source" value="character" checked>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-worldbook-source-character">角色卡绑定</label>
                                <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-worldbook-source-manual" name="${SCRIPT_ID_PREFIX_ACU}-worldbook-source" value="manual">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-worldbook-source-manual">手动选择</label>
                            </div>
                        </div>
                        <div id="${SCRIPT_ID_PREFIX_ACU}-worldbook-manual-select-block" style="display: none; margin-top: 10px;">
                            <label for="${SCRIPT_ID_PREFIX_ACU}-worldbook-select">选择世界书 (可多选):</label>
                            <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-worldbook-select-filter" placeholder="筛选世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                            <div class="input-group">
                                <div id="${SCRIPT_ID_PREFIX_ACU}-worldbook-select" class="qrf_worldbook_list"></div>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-refresh-worldbooks" title="刷新世界书列表">刷新</button>
                            </div>
                        </div>
                        <div style="margin-top: 15px;">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                <label style="margin-bottom: 0;">启用的世界书条目:</label>
                                <div class="button-group" style="margin: 0;">
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-worldbook-select-all" class="button" style="padding: 2px 8px; font-size: 0.8em;">全选</button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-worldbook-deselect-all" class="button" style="padding: 2px 8px; font-size: 0.8em;">全不选</button>
                                </div>
                            </div>
                            <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-filter" placeholder="筛选条目/世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                            <div id="${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-list" class="qrf_worldbook_entry_list">
                                <!-- 条目将动态加载于此 -->
                            </div>
                        </div>
                    </div>
                </div>
                
                <div id="acu-tab-data" class="acu-tab-content">
                    <div class="acu-card">
                        <h3>数据隔离</h3>
                        <p class="notes">在此处输入特定的标识代码，插件将只读取和保存带有该标识的数据。若留空则使用默认数据。</p>
                        <div class="setting-item" style="margin-bottom: 15px; border-bottom: 1px dashed var(--border-normal); padding-bottom: 15px;">
                            <div id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-input-area" style="margin-top: 10px;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-data-isolation-code">标识代码:</label>
                                <div class="acu-data-isolation-row" style="display: flex; gap: 10px; margin-top: 5px; align-items: flex-start;">
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-combo" style="position: relative; flex-grow: 1; display: flex; align-items: center;">
                                        <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-code" placeholder="输入标识代码 (留空则不隔离)" style="flex-grow: 1; padding-right: 36px;">
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-history-toggle" title="历史标识代码" style="position: absolute; right: 6px; top: 50%; transform: translateY(-50%); border: 1px solid var(--border-normal); background: var(--bg-secondary); color: var(--text-main); padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; line-height: 1;">▼</button>
                                        <ul id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-history-list" style="display: none; position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--bg-primary); border: 1px solid var(--border-normal); border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18); list-style: none; margin: 0; padding: 6px 0; max-height: 220px; overflow-y: auto; z-index: 9999;"></ul>
                                    </div>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-save" class="primary" style="white-space: nowrap;">保存并应用</button>
                                </div>
                                <p class="notes" style="margin-top: 5px;">输入代码并点击保存后，将重新载入对应的本地数据。</p>
                            </div>
                            <div style="margin-top: 10px; text-align: right;">
                        <button id="${SCRIPT_ID_PREFIX_ACU}-data-isolation-delete-entries" class="btn-danger" style="padding: 5px 10px; border-radius: 4px; font-size: 0.9em;">删除当前标识的注入条目</button>
                            </div>
                        </div>

                        <h3>数据管理</h3>
                        <p class="notes">导入/导出当前对话的数据库，或管理全局模板。</p>
                        <div class="button-group acu-data-mgmt-buttons acu-cols-2">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-import-combined-settings" class="primary">合并导入(模板+指令)</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-export-combined-settings" class="primary">合并导出(模板+指令)</button>
                        </div>
                        <hr style="border-color: var(--border-normal); margin: 15px 0;">
                        <div class="button-group acu-data-mgmt-buttons acu-cols-3">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-export-json-data">导出JSON数据</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-reset-all-defaults" class="btn-warning">恢复默认模板及提示词</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-override-with-template" class="btn-danger">模板覆盖最新层数据</button>
                        </div>
                        <hr style="border-color: var(--border-normal); margin: 15px 0;">
                        <div class="acu-template-presets" style="background: var(--background-color-light); padding: 12px; border-radius: 8px;">
                            <h4 style="margin: 0 0 10px 0; font-size: 0.95em; font-weight: 600;">表格模板预设（全局 / 当前聊天）</h4>
                            <div class="acu-data-template-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start;">
                                <div style="padding: 16px; background: var(--background_default); border-radius: 8px; border: 1px solid var(--border_color_light); display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                        <div>
                                            <div style="font-weight: 600; color: var(--text_primary);">全局正在使用</div>
                                            <small id="${SCRIPT_ID_PREFIX_ACU}-template-global-scope-status" class="notes">新聊天会默认继承这里的表格模板</small>
                                        </div>
                                        <span style="padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent-primary) 12%, transparent); color: var(--accent-primary); font-size: 12px; font-weight: 600;">全局</span>
                                    </div>
                                    <div class="qrf_settings_block" style="margin-bottom: 0;">
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-template-preset-select" style="font-weight: 500;">全局模板预设</label>
                                        <select id="${SCRIPT_ID_PREFIX_ACU}-template-preset-select" class="text_pole" style="width: 100%; margin-top: 5px;">
                                            <option value="${DEFAULT_TEMPLATE_PRESET_OPTION_VALUE_ACU}">默认预设</option>
                                        </select>
                                    </div>
                                    <div class="acu-template-preset-toolbar" style="display: flex; flex-direction: column; gap: 10px;">
                                        <div class="acu-template-preset-left">
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-import-template" class="acu-mini-btn" title="导入模板到全局模板库，并切换为当前全局模板；已有当前聊天本地预设的聊天不会被自动清除。">
                                                <i class="fa-solid fa-file-import"></i><span>导入</span>
                                            </button>
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-export-template" class="acu-mini-btn" title="导出当前全局模板（优先导出当前选中的全局预设）">
                                                <i class="fa-solid fa-file-export"></i><span>导出</span>
                                            </button>
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-reset-template" class="acu-mini-btn" title="恢复全局默认模板；未做本地保存或导入的聊天会继续跟随全局模板。">
                                                <i class="fa-solid fa-undo"></i><span>恢复默认</span>
                                            </button>
                                        </div>
                                        <div class="acu-template-preset-actions">
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-template-preset-saveas" class="acu-mini-btn" title="将当前运行中的模板另存为新的全局预设">
                                                <i class="fa-solid fa-copy"></i><span>另存为</span>
                                            </button>
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-template-preset-rename" class="acu-mini-btn" title="重命名当前选中的全局预设">
                                                <i class="fa-solid fa-i-cursor"></i><span>重命名</span>
                                            </button>
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-template-preset-delete" class="acu-mini-btn danger" title="删除当前选中的全局预设">
                                                <i class="fa-solid fa-trash"></i><span>删除</span>
                                            </button>
                                        </div>
                                    </div>
                                    <small class="notes">这里仅做全局模板预设库管理（导入 / 导出 / 另存为 / 重命名 / 删除）；需要覆盖保存全局模板时，请使用可视化编辑器顶部的“保存到全局”。</small>
                                </div>
                                <div style="padding: 16px; background: var(--background_default); border-radius: 8px; border: 1px solid var(--border_color_light); display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                        <div>
                                            <div style="font-weight: 600; color: var(--text_primary);">当前聊天正在使用</div>
                                            <small id="${SCRIPT_ID_PREFIX_ACU}-template-chat-scope-status" class="notes">未做聊天级保存时，这里会直接跟随全局模板</small>
                                        </div>
                                        <span style="padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--green) 14%, transparent); color: var(--green); font-size: 12px; font-weight: 600;">聊天</span>
                                    </div>
                                    <div class="qrf_settings_block" style="margin-bottom: 0;">
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-template-chat-preset-select" style="font-weight: 500;">当前聊天模板预设</label>
                                        <select id="${SCRIPT_ID_PREFIX_ACU}-template-chat-preset-select" class="text_pole" style="width: 100%; margin-top: 5px;">
                                            <option value="${DEFAULT_TEMPLATE_PRESET_OPTION_VALUE_ACU}">默认预设</option>
                                        </select>
                                    </div>
                                    <div class="acu-template-preset-actions">
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-template-chat-import-preset" class="acu-mini-btn" title="导入模板到当前聊天预设列表；同名预设会直接覆盖">
                                            <i class="fa-solid fa-file-import"></i><span>导入到当前聊天</span>
                                        </button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-template-chat-export-preset" class="acu-mini-btn" title="导出当前聊天正在使用的模板预设">
                                            <i class="fa-solid fa-download"></i><span>导出当前聊天</span>
                                        </button>
                                    </div>
                                    <input type="file" id="${SCRIPT_ID_PREFIX_ACU}-template-chat-preset-file-input" style="display: none;" accept=".json">
                                    <small id="${SCRIPT_ID_PREFIX_ACU}-template-chat-origin-status" class="notes">这里仅做当前聊天模板预设的导入 / 导出；需要覆盖保存时，请在可视化编辑器中使用“保存到当前聊天”或“保存到全局”。</small>
                                </div>
                            </div>
                        </div>
                        <!-- 楼层范围选择 -->
                        <div style="background: var(--background-color-light); padding: 12px; border-radius: 6px; margin-bottom: 10px;">
                            <h4 style="margin: 0 0 8px 0; font-size: 0.9em; color: var(--text-color); font-weight: 500;">删除范围设置</h4>
                            <div class="acu-grid">
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-delete-start-floor" style="font-weight: 500; font-size: 0.85em;">起始AI楼层:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-delete-start-floor" min="1" value="1" placeholder="1" style="width: 100%; padding: 4px 8px; border: 1px solid var(--border-normal); border-radius: 4px; background: var(--input-background); color: var(--input-text-color);">
                                </div>
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-delete-end-floor" style="font-weight: 500; font-size: 0.85em;">终止AI楼层:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-delete-end-floor" min="1" placeholder="留空删除到最后" style="width: 100%; padding: 4px 8px; border: 1px solid var(--border-normal); border-radius: 4px; background: var(--input-background); color: var(--input-text-color);">
                                </div>
                            </div>
                            <div style="margin-top: 6px; font-size: 0.8em; color: var(--text-color-dimmed);">
                                默认全选所有AI楼层，可设置范围精确删除（只计算AI回复）
                            </div>
                        </div>

                        <div class="button-group acu-data-mgmt-buttons acu-cols-2" style="margin-top: 10px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-delete-current-local-data" class="btn-warning">删除当前标识本地数据</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-delete-all-local-data" class="btn-danger">删除所有本地数据 (慎用)</button>
                        </div>
                        <div class="button-group" style="margin-top: 20px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-open-new-visualizer" class="primary acu-btn-medium" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 10px;">
                                <i class="fa-solid fa-table-columns"></i> 打开可视化表格编辑器
                            </button>
                        </div>
                        <p class="notes" style="text-align: center; margin-top: 10px;">点击上方按钮打开全新的可视化界面，支持直接编辑数据、修改表头及更新参数。</p>
                    </div>
                    
                    <div class="acu-card">
                        <h3 style="text-align: center; margin-bottom: 15px;">纪要合并 (Medusa)</h3>
                        <p class="notes" style="text-align: center; margin-bottom: 20px;">将当前的纪要表进行批量合并与精简。</p>

                        <!-- 手动合并参数 -->
                        <div style="background: var(--background-color-light); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 1em; color: var(--text-color); border-bottom: 1px solid var(--border-normal); padding-bottom: 8px;">手动合并参数</h4>

                            <div class="acu-grid" style="margin-bottom: 10px;">
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-merge-target-count" style="font-weight: 500;">合并目标条数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-merge-target-count" min="1" value="1" placeholder="1">
                                </div>
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-merge-batch-size" style="font-weight: 500;">每批处理条数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-merge-batch-size" min="1" value="5" placeholder="5">
                                </div>
                            </div>

                            <div class="acu-grid">
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-merge-start-index" style="font-weight: 500;">起始条数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-merge-start-index" min="1" value="1" placeholder="1">
                                </div>
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-merge-end-index" style="font-weight: 500;">终止条数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-merge-end-index" min="1" placeholder="留空处理到最后">
                                </div>
                            </div>
                        </div>

                        <!-- 自动合并设置 -->
                        <div style="background: var(--background-color-light); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 1em; color: var(--text-color); border-bottom: 1px solid var(--border-normal); padding-bottom: 8px;">自动合并设置</h4>

                            <div style="margin-bottom: 12px;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-merge-enabled" style="display: flex; align-items: center; cursor: pointer;">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-auto-merge-enabled" style="width: 14px; height: 14px; margin-right: 8px; cursor: pointer;">
                                    <span style="font-size: 0.9em; font-weight: 500;">开启自动合并纪要</span>
                                </label>
                            </div>

                            <div class="acu-grid">
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-auto-merge-threshold" style="font-weight: 500;">触发楼层数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-merge-threshold" min="1" value="20" placeholder="20">
                                </div>
                                <div>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-auto-merge-reserve" style="font-weight: 500;">保留楼层数:</label>
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-merge-reserve" min="0" value="0" placeholder="0">
                                </div>
                            </div>
                        </div>

                        <!-- 提示词设置 -->
                        <div style="background: var(--background-color-light); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                            <h4 style="margin: 0 0 12px 0; font-size: 1em; color: var(--text-color); border-bottom: 1px solid var(--border-normal); padding-bottom: 8px;">提示词模板</h4>
                            <textarea id="${SCRIPT_ID_PREFIX_ACU}-merge-prompt-template" style="height: 120px; font-size: 0.85em; font-family: monospace; width: 100%; resize: vertical;" placeholder="正在加载提示词模板..."></textarea>
                        </div>

                        <!-- 操作按钮 -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 15px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-save-merge-settings" style="padding: 10px; background: var(--button-background); border: 1px solid var(--border-normal); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">
                                <i class="fa-solid fa-save" style="margin-right: 5px;"></i>保存设置
                            </button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-restore-merge-settings" style="padding: 10px; background: var(--button-secondary-background, #f8f9fa); border: 1px solid var(--border-normal); border-radius: 6px; cursor: pointer; transition: all 0.2s ease;">
                                <i class="fa-solid fa-undo" style="margin-right: 5px;"></i>恢复默认
                            </button>
                        </div>

                        <button id="${SCRIPT_ID_PREFIX_ACU}-start-merge-summary" class="primary" style="width: 100%; padding: 12px; font-size: 1em;">
                            <i class="fa-solid fa-play" style="margin-right: 8px;"></i>开始合并纪要
                        </button>
                    </div>
                </div>

                <div id="acu-tab-import" class="acu-tab-content">
                    <div class="acu-card">
                        <h3>从TXT文件导入</h3>
                        <p class="notes">从外部TXT文件导入内容，按指定字符数分割，并作为独立条目注入指定的世界书。这些条目独立于聊天记录，不会被自动清除。</p>
                        
                        <hr style="border-color: var(--border-normal); margin: 15px 0;">
                        
                        <div>
                            <label for="${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target">导入数据注入目标世界书:</label>
                            <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target-filter" placeholder="筛选世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                            <div class="input-group">
                                <select id="${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target" style="width: 100%;"></select>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-refresh-import-worldbooks" title="刷新世界书列表">刷新</button>
                            </div>
                            <small class="notes">选择导入的数据将被注入到哪个世界书里（独立于常规更新的世界书设置）。<strong>注意：不推荐使用角色卡绑定世界书，建议使用新建的其它世界书。</strong></small>
                        </div>
                        <div class="qrf_settings_block" style="margin-top: 12px; margin-bottom: 12px;">
                            <label for="${SCRIPT_ID_PREFIX_ACU}-import-prompt-exclude-imported-worldbook-entries"><strong>屏蔽外部导入世界书条目占位符</strong></label>
                            <label class="toggle-switch">
                                <input id="${SCRIPT_ID_PREFIX_ACU}-import-prompt-exclude-imported-worldbook-entries" type="checkbox" />
                                <span class="slider"></span>
                            </label>
                            <small class="notes">仅对外部导入流程生效。开启后，填表提示词中的世界书条目占位符会自动屏蔽所有带有“外部导入-”标签的世界书条目，避免导入流程反复读取既有导入条目。</small>
                        </div>
                        
                        <div class="acu-grid" style="grid-template-columns: 1fr 1fr; align-items: end; gap: 20px; margin-bottom: 10px;">
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-import-split-size">每段字符数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-import-split-size" min="100" step="100" value="10000">
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-save-import-split-size">保存</button>
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-import-encoding">文件编码:</label>
                                <select id="${SCRIPT_ID_PREFIX_ACU}-import-encoding">
                                    <option value="UTF-8">UTF-8 (默认)</option>
                                    <option value="GBK" selected>GBK (简体中文)</option>
                                    <option value="Big5">Big5 (繁体中文)</option>
                                </select>
                            </div>
                        </div>
                        
                        <div id="${SCRIPT_ID_PREFIX_ACU}-import-status" class="notes" style="margin-bottom: 15px; font-weight: bold;">状态：尚未加载文件。</div>

                        <div class="button-group">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-import-txt-button" class="primary">1. 选择并拆分TXT文件</button>
                        </div>
                        <div style="margin: 10px 0 8px 0; font-weight: 700;">注入表选择（自选表格）</div>
                        <div class="notes" style="margin-bottom:6px;">选择需要写入世界书的表（可多选；未曾选择过则默认全选）。</div>
                        <div class="button-group" style="justify-content:flex-start; gap:8px; margin-bottom:6px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-import-table-select-all" class="button">全选</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-import-table-select-none" class="button">全不选</button>
                        </div>
                        <div id="${SCRIPT_ID_PREFIX_ACU}-import-table-selector" style="min-height:60px;">加载表格列表中...</div>

                        <div class="button-group" style="margin-top: 10px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-inject-imported-txt-button" disabled>2. 注入（自选表格）</button>
                        </div>
                        <div class="button-group">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-delete-imported-entries" class="btn-danger">删除注入条目</button>
                        </div>
                        <div class="button-group">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-clear-imported-cache-button" class="btn-danger" style="font-weight: bold;">清空导入暂存缓存</button>
                        </div>
                        <input type="file" id="${SCRIPT_ID_PREFIX_ACU}-hidden-file-input" style="display: none;" accept=".txt">
                    </div>
                </div>

                <div id="acu-tab-plot" class="acu-tab-content">
                    <div class="acu-card">
                        <!-- 顶部标题和开关区域 -->
                        <div class="acu-plot-header-row" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border_color);">
                            <div>
                                <h3 style="margin: 0; color: var(--text_primary);">剧情推进设置</h3>
                                <p class="notes" style="margin: 5px 0 0 0;">通过AI预处理用户输入，增强故事叙述质量和剧情连贯性</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-plot-enabled" style="font-weight: 500; cursor: pointer;">启用功能</label>
                                <label class="toggle-switch">
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-enabled" type="checkbox" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- 预设管理区域 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-bookmark"></i> 预设管理
                            </h4>
                            <div class="acu-plot-scope-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 16px; align-items: start;">
                                <div style="padding: 16px; background: var(--background_default); border-radius: 8px; border: 1px solid var(--border_color_light); display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                        <div>
                                            <div style="font-weight: 600; color: var(--text_primary);">全局正在使用</div>
                                            <small id="${SCRIPT_ID_PREFIX_ACU}-plot-global-scope-status" class="notes">新聊天会默认继承这里的剧情推进配置</small>
                                        </div>
                                        <span style="padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--accent-primary) 12%, transparent); color: var(--accent-primary); font-size: 12px; font-weight: 600;">全局</span>
                                    </div>
                                    <div class="qrf_settings_block" style="margin-bottom: 0;">
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-select" style="font-weight: 500;">全局预设</label>
                                        <select id="${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-select" class="text_pole" style="width: 100%; margin-top: 5px;">
                                            <option value="${DEFAULT_PRESET_OPTION_VALUE_ACU}">默认预设</option>
                                        </select>
                                    </div>
                                    <div class="qrf_preset_selector_wrapper acu-plot-preset-wrapper" style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-save-preset" class="menu_button" title="覆盖保存到全局预设" style="padding: 8px 12px;"><i class="fa-solid fa-save"></i></button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-save-as-new-preset" class="menu_button" title="另存为新的全局预设" style="padding: 8px 12px;"><i class="fa-solid fa-file-export"></i></button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-import-presets" class="menu_button" title="导入到全局预设库" style="padding: 8px 12px;"><i class="fa-solid fa-upload"></i></button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-export-presets" class="menu_button" title="导出当前全局预设" style="padding: 8px 12px;"><i class="fa-solid fa-download"></i></button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-reset-defaults" class="menu_button" title="恢复全局默认提示词" style="padding: 8px 12px; background-color: var(--orange); color: white;"><i class="fa-solid fa-undo"></i></button>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-global-delete-preset" class="menu_button" title="删除当前全局选中的预设" style="display: none; padding: 8px 12px; background-color: var(--red);"><i class="fa-solid fa-trash-alt"></i></button>
                                        <input type="file" id="${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-file-input" style="display: none;" accept=".json">
                                    </div>
                                    <small class="notes">全局预设区负责导入、导出、修改与保存；切换这里只会切换全局默认使用的剧情推进预设，不会直接改动当前聊天预设。</small>
                                </div>
                                <div style="padding: 16px; background: var(--background_default); border-radius: 8px; border: 1px solid var(--border_color_light); display: flex; flex-direction: column; gap: 12px;">
                                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
                                        <div>
                                            <div style="font-weight: 600; color: var(--text_primary);">当前聊天正在使用</div>
                                            <small id="${SCRIPT_ID_PREFIX_ACU}-plot-chat-scope-status" class="notes">未单独指定时，这里会直接跟随全局剧情推进预设</small>
                                        </div>
                                        <span style="padding: 2px 8px; border-radius: 999px; background: color-mix(in srgb, var(--green) 14%, transparent); color: var(--green); font-size: 12px; font-weight: 600;">聊天</span>
                                    </div>
                                    <div class="qrf_settings_block" style="margin-bottom: 0;">
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-plot-chat-preset-select" style="font-weight: 500;">当前聊天预设</label>
                                        <select id="${SCRIPT_ID_PREFIX_ACU}-plot-chat-preset-select" class="text_pole" style="width: 100%; margin-top: 5px;">
                                            <option value="${DEFAULT_PRESET_OPTION_VALUE_ACU}">跟随全局</option>
                                        </select>
                                    </div>
                                    <small id="${SCRIPT_ID_PREFIX_ACU}-plot-chat-origin-status" class="notes">当前聊天预设这里只负责切换当前聊天使用的剧情推进预设；导入、导出、保存与修改统一在全局预设侧处理。</small>
                                </div>
                            </div>
                            <div class="qrf_settings_block" style="margin-top: 15px; padding-top: 15px; border-top: 1px dashed var(--border_color_light);">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-plot-api-preset-select" style="font-weight: 500;">剧情推进API预设</label>
                                <select id="${SCRIPT_ID_PREFIX_ACU}-plot-api-preset-select" class="text_pole" style="width: 100%; margin-top: 5px;">
                                    <option value="">使用当前API配置</option>
                                </select>
                                <small class="notes">这里控制剧情推进调用时使用的API配置；剧情推进预设本身则分为全局与当前聊天两条作用域链路。</small>
                            </div>
                        </div>

                        <!-- 提示词设置区域（独立提示词组） -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-edit"></i> 提示词设置
                            </h4>
                            <div style="margin-bottom: 15px; padding: 12px; background: var(--background_default); border-radius: 6px; border-left: 3px solid var(--text_secondary);">
                                <small class="notes" style="color: var(--text_secondary);">
                                    <strong>占位符说明：</strong><br>
                                    <code>$1</code> - 自动替换为世界书内容（默认开启）<br>
                                    <code>$6</code> - 自动替换为上一轮保存的剧情规划数据<br>
                                    <code>$5</code> - 自动替换为“总体大纲”表内容（含表头）<br>
                                    <code>$7</code> - 自动替换为本次实际读取的前文上下文（仅包含历史AI输出，不含任何用户输入）<br>
                                    <code>$8</code> - 自动替换为本轮用户输入（可自由放置）<br>
                                    <code>{{标签名}}</code> - 在剧情任务提示词与最终注入指令中插入标签块内容<br>
                                    <code>sulv1-4</code> - 剧情推进速率设置<br>
                                    <code>zhaohui</code> - 记忆召回数量
                                </small>
                            </div>
                            <div class="acu-plot-task-layout" style="display:grid; grid-template-columns: minmax(240px, 280px) minmax(0, 1fr); gap:16px; align-items:start; margin-bottom:15px;">
                                <div style="padding:12px; background:var(--background_default); border-radius:8px; border:1px solid var(--border_color_light);">
                                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:10px;">
                                        <label style="font-weight:600; margin:0;">剧情任务列表</label>
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-task-add" class="button" style="padding:4px 10px;">新增</button>
                                    </div>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-task-list"></div>
                                    <div class="button-group" style="justify-content:flex-start; gap:8px; margin-top:10px;">
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-task-move-up" class="button">上移</button>
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-task-move-down" class="button">下移</button>
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-task-delete" class="button" style="background:var(--red); color:#fff;">删除</button>
                                    </div>
                                    <small class="notes" style="display:block; margin-top:10px;">每个任务都有独立提示词、独立标签摘取与独立重试次数；任务按阶段号执行：同阶段并发，不同阶段按编号顺序串行。</small>
                                </div>
                                <div style="padding:12px; background:var(--background_default); border-radius:8px; border:1px solid var(--border_color_light);">
                                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:15px;">
                                        <div class="qrf_settings_block" style="margin-bottom:0;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-task-name" style="font-weight:500;">当前任务名称</label>
                                            <input id="${SCRIPT_ID_PREFIX_ACU}-plot-task-name" type="text" class="text_pole" placeholder="例如：记忆召回任务" style="width:100%;">
                                        </div>
                                        <div class="qrf_settings_block" style="margin-bottom:0; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-task-enabled" style="font-weight:500; margin:0;">启用当前任务</label>
                                            <label class="toggle-switch" style="margin:0;">
                                                <input id="${SCRIPT_ID_PREFIX_ACU}-plot-task-enabled" type="checkbox" />
                                                <span class="slider"></span>
                                            </label>
                                        </div>
                                        <div class="qrf_settings_block" style="margin-bottom:0;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-task-stage" style="font-weight:500;">当前任务阶段号</label>
                                            <input id="${SCRIPT_ID_PREFIX_ACU}-plot-task-stage" type="number" class="text_pole" min="1" step="1" value="1" style="width:100%;">
                                            <small class="notes">相同阶段并发，不同阶段按编号顺序串行</small>
                                        </div>
                                        <div class="qrf_settings_block" style="margin-bottom:0;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-task-max-retries" style="font-weight:500;">当前任务最大重试</label>
                                            <input id="${SCRIPT_ID_PREFIX_ACU}-plot-task-max-retries" type="number" class="text_pole" min="1" step="1" value="3" style="width:100%;">
                                        </div>
                                    </div>
                                    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px; margin-bottom:15px;">
                                        <div class="qrf_settings_block" style="margin-bottom:0;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-extract-tags" style="font-weight:500;">当前任务标签摘取</label>
                                            <input id="${SCRIPT_ID_PREFIX_ACU}-plot-extract-tags" type="text" class="text_pole" placeholder="例如: recall,supplement" style="width:100%;">
                                            <small class="notes">仅作用于当前选中的剧情任务</small>
                                        </div>
                                        <div class="qrf_settings_block" style="margin-bottom:0;">
                                            <label for="${SCRIPT_ID_PREFIX_ACU}-plot-min-length" style="font-weight:500;">当前任务最小回复长度</label>
                                            <input id="${SCRIPT_ID_PREFIX_ACU}-plot-min-length" type="number" class="text_pole" min="0" max="2000" step="10" value="0" style="width:100%;">
                                            <small class="notes">当前任务回复少于此长度时自动重试</small>
                                        </div>
                                    </div>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-prompt-constructor-area">
                                        <div class="button-group" style="margin-bottom: 10px; justify-content: center;">
                                            <button class="${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt-segment-btn" data-position="top" title="在上方添加对话轮次">+</button>
                                        </div>
                                        <div id="${SCRIPT_ID_PREFIX_ACU}-plot-prompt-segments-container">
                                            <!-- Plot segments will be dynamically inserted here -->
                                        </div>
                                        <div class="button-group" style="margin-top: 10px; justify-content: center;">
                                            <button class="${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt-segment-btn" data-position="bottom" title="在下方添加对话轮次">+</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="qrf_settings_block" style="margin-top: 15px; margin-bottom: 0;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-plot-final-directive" style="font-weight: 500;">最终注入指令</label>
                                <textarea id="${SCRIPT_ID_PREFIX_ACU}-plot-final-directive" class="text_pole" rows="3" placeholder="输入最终注入指令" style="resize: vertical;"></textarea>
                                <small class="notes">这段内容不会发给“剧情规划API”，只会注入给主AI。你可以用 <code>$8</code> 自行决定是否/放置位置。</small>
                            </div>
                        </div>


                        <!-- 匹配替换设置区域 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-right-left"></i> 匹配替换
                            </h4>
                            <small class="notes" style="display: block; margin-bottom: 15px; color: var(--text_secondary);">
                                在发送前，将下方设置的数值替换掉提示词中的占位符（sulv1-4、zhaohui）
                            </small>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-rate-main" style="font-weight: 500;">主线剧情推进速率</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-rate-main" type="number" class="text_pole" step="0.05" value="1.0" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">占位符: sulv1</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-rate-personal" style="font-weight: 500;">个人线推进速率</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-rate-personal" type="number" class="text_pole" step="0.05" value="1.0" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">占位符: sulv2</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-rate-erotic" style="font-weight: 500;">色情事件推进速率</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-rate-erotic" type="number" class="text_pole" step="0.05" value="0" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">占位符: sulv3</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-rate-cuckold" style="font-weight: 500;">绿帽线推进速率</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-rate-cuckold" type="number" class="text_pole" step="0.05" value="1.0" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">占位符: sulv4</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-recall-count" style="font-weight: 500;">记忆召回数量</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-recall-count" type="number" class="text_pole" step="1" min="1" value="20" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">占位符: zhaohui</small>
                                </div>
                            </div>
                        </div>

                        <!-- 自动循环设置区域 -->
                        <div class="settings-section" style="padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-sync-alt"></i> 自动循环生成
                            </h4>

                            <div style="display: grid; gap: 15px; margin-bottom: 20px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                        <label style="font-weight: 500; margin: 0;">循环提示词列表</label>
                                        <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt" class="button" style="padding: 4px 12px; font-size: 0.85em; display: flex; align-items: center; gap: 4px;">
                                            <i class="fa-solid fa-plus"></i> 添加提示词
                                        </button>
                                    </div>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-prompts-container" style="display: grid; gap: 10px;">
                                        <!-- 提示词项将动态添加到这里 -->
                                    </div>
                                    <small class="notes">可以添加多个提示词，循环时会自动依次使用，增加剧情变化</small>
                                </div>

                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-loop-tags" style="font-weight: 500;">标签验证</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-tags" type="text" class="text_pole" placeholder="例如: content, thinking" style="width: 100%;">
                                    <small class="notes">输入必须存在于AI回复中的标签，多个标签用逗号分隔。缺少任意标签将重试</small>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 15px; margin-bottom: 20px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-loop-delay" style="font-weight: 500;">循环延时</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-delay" type="number" class="text_pole" min="0" step="1" value="5" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">秒</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-loop-total-duration" style="font-weight: 500;">总时长</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-total-duration" type="number" class="text_pole" min="0" step="1" value="0" placeholder="60" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">分钟</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-max-retries" style="font-weight: 500;">自动循环失败上限</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-max-retries" type="number" class="text_pole" min="0" step="1" value="3" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">仅用于自动循环流程，不影响单个任务的 API 重试次数</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-context-turn-count" style="font-weight: 500;">AI上下文</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-plot-context-turn-count" type="number" class="text_pole" min="0" max="20" step="1" value="3" style="width: 100%;">
                                    <small class="notes" style="color: var(--text_secondary);">AI输出楼层数（仅计算AI回复，不含用户输入）</small>
                                </div>
                            </div>

                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 15px; margin-bottom: 25px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label style="font-weight: 500;">正文标签提取规则</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-add-rule" class="button" style="margin-top: 6px;">添加规则</button>
                                    <small class="notes">作用于剧情上下文过滤，不区分任务；每条规则填写开始词和结束词，仅提取最后一组匹配内容</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label style="font-weight: 500;">标签排除规则</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-add-rule" class="button" style="margin-top: 6px;">添加规则</button>
                                    <small class="notes">作用于剧情上下文过滤，不区分任务；仅移除最后一组匹配内容（可与“正文标签提取”叠加）</small>
                                </div>
                            </div>

                            <!-- [新增] 剧情推进世界书选择（与填表世界书选择互不干扰；UI风格与“世界书设置”页一致） -->
                            <div class="qrf_settings_block" style="margin: 10px 0 18px 0; padding-top: 15px; border-top: 1px dashed var(--border_color_light);">
                                <label style="font-weight: 600; display:flex; align-items:center; gap:8px;">
                                    <i class="fa-solid fa-book"></i> 剧情推进世界书选择（独立）
                                </label>
                                <small class="notes">仅影响“剧情推进”，不会影响“填表/读取世界书”的选择。</small>

                                <div class="qrf_settings_block_radio" style="margin-top: 10px;">
                                    <label>世界书来源 (用于剧情推进读取上下文):</label>
                                    <div class="qrf_radio_group">
                                        <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source-character" name="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source" value="character" checked>
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source-character">角色卡绑定</label>
                                        <input type="radio" id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source-manual" name="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source" value="manual">
                                        <label for="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source-manual">手动选择</label>
                                    </div>
                                </div>

                                <div id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-manual-select-block" style="display: none; margin-top: 10px;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select">选择世界书 (可多选):</label>
                                    <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-filter" placeholder="筛选世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                                    <div class="input-group">
                                        <div id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select" class="qrf_worldbook_list"></div>
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-plot-refresh-worldbooks" title="刷新世界书列表">刷新</button>
                                    </div>
                                </div>

                                <div style="margin-top: 15px;">
                                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px;">
                                        <label style="margin-bottom: 0;">启用的世界书条目:</label>
                                        <div class="button-group" style="margin: 0;">
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-all" class="button" style="padding: 2px 8px; font-size: 0.8em;">全选</button>
                                            <button id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-deselect-all" class="button" style="padding: 2px 8px; font-size: 0.8em;">全不选</button>
                                        </div>
                                    </div>
                                    <input type="text" id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-filter" placeholder="筛选条目/世界书..." style="width: 100%; margin: 6px 0 8px 0; padding: 6px 10px; border-radius: 6px; border: 1px solid var(--border-normal); background: var(--input-background); color: var(--input-text-color);">
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-list" class="qrf_worldbook_entry_list">
                                        <!-- 条目将动态加载于此 -->
                                    </div>
                                </div>
                            </div>

                            <!-- 循环控制区域 -->
                            <div style="border-top: 1px solid var(--border_color_light); padding-top: 20px;">
                                <div id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-status-indicator" style="text-align: center; margin-bottom: 15px; padding: 10px; background: var(--background_default); border-radius: 6px; border: 1px solid var(--border_color_light);">
                                    <div style="font-weight: 600; color: var(--text_primary); margin-bottom: 5px;">循环状态</div>
                                    <div style="color: var(--text_secondary);">
                                        <span id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-status-text">未运行</span>
                                        <span id="${SCRIPT_ID_PREFIX_ACU}-plot-loop-timer-display" style="display:none; margin-left: 10px; color: var(--text_tertiary);"></span>
                                    </div>
                                </div>
                                <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-plot-start-loop-btn" class="menu_button" style="padding: 12px 25px; background: var(--green); color: white; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; min-width: 140px; display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
                                        <i class="fas fa-play"></i> 开始循环
                                    </button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-plot-stop-loop-btn" class="menu_button" style="display: none; padding: 12px 25px; background: var(--red); color: white; font-weight: 600; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; min-width: 140px; display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
                                        <i class="fas fa-stop"></i> 停止循环
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 正文替换Tab -->
                <div id="acu-tab-optimization" class="acu-tab-content">
                    <div class="acu-card">
                        <!-- 顶部标题和开关区域 -->
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid var(--border_color);">
                            <div>
                                <h3 style="margin: 0; color: var(--text_primary);">正文替换设置</h3>
                                <p class="notes" style="margin: 5px 0 0 0;">AI生成正文后，自动替换内容（在填表之前执行）</p>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-enabled" style="font-weight: 500; cursor: pointer;">启用功能</label>
                                <label class="toggle-switch">
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-enabled" type="checkbox" />
                                    <span class="slider"></span>
                                </label>
                            </div>
                        </div>

                        <!-- 基础设置区域 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-cog"></i> 基础设置
                            </h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-api-preset" style="font-weight: 500;">API预设</label>
                                    <select id="${SCRIPT_ID_PREFIX_ACU}-optimization-api-preset" class="text_pole" style="width: 100%; margin-top: 5px;">
                                        <option value="">使用当前API配置</option>
                                    </select>
                                    <small class="notes">选择正文替换使用的API配置，留空则使用酒馆当前API</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-min-length" style="font-weight: 500;">最小优化长度</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-min-length" type="number" class="text_pole" min="0" step="10" value="100" style="width: 100%; margin-top: 5px;">
                                    <small class="notes">正文长度小于此值时跳过优化</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-max-items" style="font-weight: 500;">最大优化项数</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-max-items" type="number" class="text_pole" min="1" max="100" step="1" value="10" style="width: 100%; margin-top: 5px;">
                                    <small class="notes">单次优化的最大修改项数（1-100）</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-loop-count" style="font-weight: 500;">循环优化次数</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-loop-count" type="number" class="text_pole" min="1" max="10" step="1" value="1" style="width: 100%; margin-top: 5px;">
                                    <small class="notes">优化完成后再次优化，达到完整优化效果（1-10次）</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-retry-count" style="font-weight: 500;">自动重试次数</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-retry-count" type="number" class="text_pole" min="1" max="10" step="1" value="3" style="width: 100%; margin-top: 5px;">
                                    <small class="notes">API调用失败时自动重试（1-10次，默认3次）</small>
                                </div>
                            </div>
                        </div>

                        <!-- 优化模式设置 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-magic"></i> 优化模式
                            </h4>
                            <div style="display: grid; gap: 15px;">
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-optimization-seamless-mode" checked>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-seamless-mode">无感替换模式</label>
                                    <small class="notes" style="display: block; margin-left: 24px; margin-top: 4px;">显示"正在优化"遮罩，优化完成后直接显示结果，无闪烁</small>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-optimization-auto-apply" checked>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-auto-apply">自动应用优化结果</label>
                                    <small class="notes" style="display: block; margin-left: 24px; margin-top: 4px;">关闭时显示对比对话框，让用户选择是否应用</small>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-optimization-show-diff" checked>
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-show-diff">显示优化对比</label>
                                    <small class="notes" style="display: block; margin-left: 24px; margin-top: 4px;">优化完成后显示修改摘要（非无感模式下有效）</small>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-optimization-parallel-mode">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-parallel-mode">填表与正文替换并行执行</label>
                                    <small class="notes" style="display: block; margin-left: 24px; margin-top: 4px;">勾选后填表不再等待正文替换完成，双方并行进行（默认关闭）</small>
                                </div>
                                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px dashed var(--border_color_light);">
                                    <label style="font-weight: 500; display: block; margin-bottom: 8px;">快捷操作</label>
                                    <div style="display: flex; flex-direction: column; gap: 8px; align-items: stretch;">
                                        <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-reoptimize-latest" class="menu_button" title="对最近一次已执行正文替换的 AI 回复，基于替换前原文重新优化并再次替换" style="width: 100%; min-height: 38px; display: inline-flex; align-items: center; justify-content: center; gap: 8px; white-space: normal; line-height: 1.4; text-align: center; padding: 10px 14px;">
                                            <i class="fa-solid fa-rotate-right"></i><span>重新优化上一次替换结果</span>
                                        </button>
                                    </div>
                                    <small class="notes" style="display: block; margin-top: 6px; line-height: 1.5;">这里会定位“最近一次已经被正文替换过的 AI 回复”，并使用替换前保留的原文重新优化后再次替换。取消正文优化请使用进行中提示框里的“取消优化”按钮。</small>
                                </div>
                            </div>
                        </div>
 
                        <!-- 标签筛选设置 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-filter"></i> 标签筛选
                            </h4>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 15px;">
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-extract-tags" style="font-weight: 500;">标签提取</label>
                                    <input id="${SCRIPT_ID_PREFIX_ACU}-optimization-extract-tags" type="text" class="text_pole" placeholder="例如: think,plot" style="width: 100%; margin-top: 5px;">
                                    <small class="notes">仅提取指定标签内的内容进行优化</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label style="font-weight: 500;">正文标签提取规则</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-optimization-extract-add-rule" class="button" style="margin-top: 6px;">添加规则</button>
                                    <small class="notes">每条规则填写开始词和结束词，仅提取最后一组匹配内容</small>
                                </div>
                                <div class="qrf_settings_block" style="margin-bottom: 0;">
                                    <label style="font-weight: 500;">标签排除规则</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-add-rule" class="button" style="margin-top: 6px;">添加规则</button>
                                    <small class="notes">每条规则填写开始词和结束词，仅移除最后一组匹配内容</small>
                                </div>
                            </div>
                        </div>

                        <!-- 预设管理区域 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-bookmark"></i> 预设管理
                            </h4>
                            <div class="qrf_settings_block" style="margin-bottom: 0;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-preset-select" style="font-weight: 500;">选择预设</label>
                                <div class="qrf_preset_selector_wrapper acu-optimization-preset-wrapper" style="display: flex; gap: 8px; align-items: center; margin-top: 5px;">
                                    <select id="${SCRIPT_ID_PREFIX_ACU}-optimization-preset-select" class="text_pole" style="flex: 1;">
                                        <option value="">-- 选择一个预设 --</option>
                                    </select>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-save-preset" class="menu_button" title="覆盖保存当前预设" style="padding: 8px 12px;"><i class="fa-solid fa-save"></i></button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-save-as-new-preset" class="menu_button" title="另存为新预设" style="padding: 8px 12px;"><i class="fa-solid fa-file-export"></i></button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-import-presets" class="menu_button" title="导入预设" style="padding: 8px 12px;"><i class="fa-solid fa-upload"></i></button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-export-presets" class="menu_button" title="导出当前预设" style="padding: 8px 12px;"><i class="fa-solid fa-download"></i></button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-reset-defaults" class="menu_button" title="恢复默认提示词" style="padding: 8px 12px; background-color: var(--orange); color: white;"><i class="fa-solid fa-undo"></i></button>
                                    <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-delete-preset" class="menu_button" title="删除当前选中的预设" style="display: none; padding: 8px 12px; background-color: var(--red);"><i class="fa-solid fa-trash-alt"></i></button>
                                    <input type="file" id="${SCRIPT_ID_PREFIX_ACU}-optimization-preset-file-input" style="display: none;" accept=".json">
                                </div>
                                <small class="notes">选择预设应用提示词组设置，或保存当前配置为新预设</small>
                            </div>
                        </div>

                        <!-- 提示词设置区域 -->
                        <div class="settings-section" style="margin-bottom: 25px; padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-edit"></i> 优化提示词
                            </h4>
                            <div style="margin-bottom: 15px; padding: 12px; background: var(--background_default); border-radius: 6px; border-left: 3px solid var(--text_secondary);">
                                <small class="notes" style="color: var(--text_secondary);">
                                    <strong>占位符说明：</strong><br>
                                    <code>$CONTENT</code> - 自动替换为需要优化的正文内容<br>
                                    <code>$1</code> - 世界书内容（剧情推进专用）<br>
                                    <code>$5</code> - 纪要表/总体大纲表内容<br>
                                    <code>$6</code> - 上一轮剧情规划数据<br>
                                    <code>$7</code> - 前文上下文（仅AI输出）<br>
                                    <code>$8</code> - 本轮用户输入<br>
                                    <code>$U</code> - 用户设定描述 (persona_description)<br>
                                    <code>$C</code> - 角色描述 (char_description)<br>
                                    <strong>输出格式：</strong>AI需返回JSON格式的优化指令，包含 optimizations 数组
                                </small>
                            </div>
                            <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-prompt-constructor-area">
                                <div class="button-group" style="margin-bottom: 10px; justify-content: center;">
                                    <button class="${SCRIPT_ID_PREFIX_ACU}-optimization-add-prompt-segment-btn" data-position="top" title="在上方添加对话轮次">+</button>
                                </div>
                                <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-prompt-segments-container">
                                    <!-- 优化提示词段将动态插入这里 -->
                                </div>
                                <div class="button-group" style="margin-top: 10px; justify-content: center;">
                                    <button class="${SCRIPT_ID_PREFIX_ACU}-optimization-add-prompt-segment-btn" data-position="bottom" title="在下方添加对话轮次">+</button>
                                </div>
                            </div>
                            <div class="button-group">
                                <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-save-prompt-group" class="primary">保存提示词组</button>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-reset-prompt-group">恢复默认提示词组</button>
                            </div>
                        </div>

                        <!-- 手动测试区域 -->
                        <div class="settings-section" style="padding: 20px; background: var(--background_light); border-radius: 8px; border: 1px solid var(--border_color_light);">
                            <h4 style="margin: 0 0 15px 0; color: var(--text_primary); display: flex; align-items: center; gap: 8px;">
                                <i class="fa-solid fa-flask"></i> 手动测试
                            </h4>
                            <div class="qrf_settings_block" style="margin-bottom: 15px;">
                                <label for="${SCRIPT_ID_PREFIX_ACU}-optimization-test-input" style="font-weight: 500;">测试文本</label>
                                <textarea id="${SCRIPT_ID_PREFIX_ACU}-optimization-test-input" class="text_pole" rows="5" placeholder="输入需要优化的文本进行测试..." style="resize: vertical; margin-top: 5px;"></textarea>
                            </div>
                            <div class="button-group">
                                <button id="${SCRIPT_ID_PREFIX_ACU}-optimization-test-btn" class="primary">执行优化测试</button>
                            </div>
                            <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-test-result" style="margin-top: 15px; display: none;">
                                <label style="font-weight: 500;">优化结果</label>
                                <div id="${SCRIPT_ID_PREFIX_ACU}-optimization-test-output" style="margin-top: 8px; padding: 12px; background: var(--background_default); border-radius: 6px; border: 1px solid var(--border_color_light); max-height: 300px; overflow-y: auto; white-space: pre-wrap; font-size: 0.9em;"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <p id="${SCRIPT_ID_PREFIX_ACU}-status-message" class="notes">准备就绪</p>
                    </div>
                </div>
            </div>`;
    
    // ═══ 使用独立窗口系统代替酒馆弹窗 ═══
    const windowId = `${SCRIPT_ID_PREFIX_ACU}-main-window`;
    
    createACUWindow({
      id: windowId,
      title: '星·数据库 III',
      content: popupHtml,
      width: 1400,  // 基础宽度
      height: 900,  // 基础高度
      modal: false, // 非模态，允许多窗口操作
      resizable: true,
      maximizable: true,
      startMaximized: false, // 由 rememberState 自动管理，首次打开时不全屏
      onClose: () => {
        logDebug_ACU('ACU Window closed');
        $popupInstance_ACU = null;
      },
      onReady: async ($window) => {
        // 从窗口body中找到实际内容
        const $body = $window.find('.acu-window-body');
        const curDlgCnt = $body.find(`#${POPUP_ID_ACU}`);
        
        if (!curDlgCnt || curDlgCnt.length === 0) {
          logError_ACU('Cannot find ACU popup DOM in window');
          showToastr_ACU('error', 'UI初始化失败');
          return;
        }
        $popupInstance_ACU = curDlgCnt;
        $popupInstance_ACU.off('acu_plot_settings_refresh').on('acu_plot_settings_refresh', function(_event, plotSettingsOverride = null) {
          try {
            loadPlotSettingsToUI_ACU(plotSettingsOverride);
          } catch (error) {
            logWarn_ACU('[剧情推进] Plot settings UI refresh handler failed:', error);
          }
        });
 
      // Assign jQuery objects for UI elements
      $apiConfigSectionToggle_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-config-toggle`);
      $apiConfigAreaDiv_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-config-area-div`);
      $customApiUrlInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-url`);
      $customApiKeyInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-key`);
      $customApiModelInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-model-input`);
      $customApiModelSelect_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-model-select`);
      $maxTokensInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-max-tokens`);
      $temperatureInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-temperature`);
      $loadModelsButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-load-models`);
      $saveApiConfigButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-config`);
      $clearApiConfigButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-clear-config`);
      $apiStatusDisplay_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-status`);
      $charCardPromptToggle_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-char-card-prompt-toggle`);
      $charCardPromptAreaDiv_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-char-card-prompt-area-div`);
      $charCardPromptSegmentsContainer_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-prompt-segments-container`);
      $saveCharCardPromptButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-char-card-prompt`);
      $resetCharCardPromptButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-reset-char-card-prompt`);
      const $loadCharCardPromptFromJsonButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-load-char-card-prompt-from-json`);
      const $exportCharCardPromptToJsonButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-export-char-card-prompt-to-json`);
      const $advancedConfigToggle_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-advanced-config-toggle`);
      const $advancedConfigArea_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-advanced-config-area-div`);
      $autoUpdateThresholdInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-update-threshold`);
      $saveAutoUpdateThresholdButton_ACU = $popupInstance_ACU.find(
        `#${SCRIPT_ID_PREFIX_ACU}-save-auto-update-threshold`,
      );
      $autoUpdateTokenThresholdInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-update-token-threshold`);
      $saveAutoUpdateTokenThresholdButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-auto-update-token-threshold`);
      $autoUpdateFrequencyInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-update-frequency`);
      $saveAutoUpdateFrequencyButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-auto-update-frequency`);
      $updateBatchSizeInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-update-batch-size`); // [新增]
      $saveUpdateBatchSizeButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-update-batch-size`); // [新增]
      $maxConcurrentGroupsInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-max-concurrent-groups`); // [新增]
      $skipUpdateFloorsInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-skip-update-floors`);
      $saveSkipUpdateFloorsButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-skip-update-floors`);
      $retainRecentLayersInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-retain-recent-layers`);
      $saveRetainRecentLayersButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-retain-recent-layers`);
      $autoUpdateEnabledCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-update-enabled-checkbox`); // 获取复选框
      $standardizedTableFillEnabledCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-standardized-table-fill-enabled-checkbox`);
      $toastMuteEnabledCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-toast-mute-enabled-checkbox`);
      $promptTemplateEnabledCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-prompt-template-enabled-checkbox`);
      $tableEditLastPairOnlyCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-tableedit-last-pair-only-checkbox`);
      $tableMaxRetriesInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-table-max-retries`); // [新增] 填表重试次数
      $manualExtraHintCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-manual-extra-hint-checkbox`);
      $manualUpdateCardButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-manual-update-card`);
      $manualTableSelectAll_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-manual-table-select-all`);
      $manualTableSelectNone_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-manual-table-select-none`);
      $manualTableSelector_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-manual-table-selector`);
      $importTableSelectAll_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-table-select-all`);
      $importTableSelectNone_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-table-select-none`);
      $importTableSelector_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-table-selector`);
      $statusMessageSpan_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-status-message`);
      $cardUpdateStatusDisplay_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-card-update-status-display`); // Assign new UI element
      $useMainApiCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-use-main-api-checkbox`);
      $streamingEnabledCheckbox_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-streaming-enabled-checkbox`);
      const $importTemplateButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-template`);
      const $exportTemplateButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-export-template`);
      const $resetTemplateButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-reset-template`);
      const $templatePresetSelect_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-preset-select`);
      const $templateChatPresetSelect_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-preset-select`);
      const $templatePresetSaveBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-preset-save`);
      const $templatePresetSaveAsBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-preset-saveas`);
      const $templatePresetRenameBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-preset-rename`);
      const $templatePresetDeleteBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-preset-delete`);
      const $templateChatSaveBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-save-preset`);
      const $templateChatImportBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-import-preset`);
      const $templateChatExportBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-export-preset`);
      const $templateChatClearOverrideBtn_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-clear-override`);
      const $templateChatPresetFileInput_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-template-chat-preset-file-input`);
      const $resetAllDefaultsButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-reset-all-defaults`);
      const $exportJsonDataButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-export-json-data`);
      const $importCombinedSettingsButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-combined-settings`);
      const $exportCombinedSettingsButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-export-combined-settings`);
      const $openNewVisualizerButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-open-new-visualizer`);

      const $apiModeRadios = $popupInstance_ACU.find(`input[name="${SCRIPT_ID_PREFIX_ACU}-api-mode"]`);
      const $tavernProfileSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-tavern-api-profile-select`);
      const $refreshTavernProfilesButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-refresh-tavern-api-profiles`);
      const $worldbookSourceRadios = $popupInstance_ACU.find(`input[name="${SCRIPT_ID_PREFIX_ACU}-worldbook-source"]`);
      const $refreshWorldbooksButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-refresh-worldbooks`);
      const $worldbookSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-select`);
      const $worldbookEntryList = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-list`);
      const $selectAllButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-select-all`);
      const $deselectAllButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-deselect-all`);
      const $importTxtButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-txt-button`);
      const $injectImportedTxtButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-inject-imported-txt-button`);
      const $clearImportedAllButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-clear-imported-all-button`);
      const $clearImportedCacheButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-clear-imported-cache-button`); // [新增]
      const $saveImportSplitSizeButton_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-import-split-size`);
      // Removed $hideCurrentValueDisplay_ACU, $advHideToggle, $advHideArea assignments

      // Load existing settings into UI fields
      loadSettings_ACU(); // This function will populate the fields
      // [新增] 加载世界书UI状态（已移至 loadSettings_ACU）
      // $worldbookSourceRadios.filter(`[value="${getCurrentWorldbookConfig_ACU().source}"]`).prop('checked', true);
      // updateWorldbookSourceView_ACU();
      // [新增] 填充并设置注入目标选择器
      populateInjectionTargetSelector_ACU();
      // [新增] 填充外部导入专用的世界书选择器
      populateImportWorldbookTargetSelector_ACU();

      const $injectionTargetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target`);
      if ($injectionTargetSelect.length) {
          $injectionTargetSelect.on('change', async function() {
              const worldbookConfig = getCurrentWorldbookConfig_ACU();
              const oldTargetSetting = worldbookConfig.injectionTarget;
              const newTargetSetting = $(this).val();

              if (oldTargetSetting === newTargetSetting) return;

              // 异步获取旧的世界书实际名称
              const getOldLorebookName = async () => {
                  if (oldTargetSetting === 'character') {
                      return await TavernHelper_API_ACU.getCurrentCharPrimaryLorebook();
                  }
                  return oldTargetSetting;
              };
              const oldLorebookName = await getOldLorebookName();

              // 1. 从旧目标删除条目
              if (oldLorebookName) {
                  showToastr_ACU('info', `正在从旧目标 [${oldLorebookName}] 中清除条目...`);
                  try {
                      await deleteAllGeneratedEntries_ACU(oldLorebookName);
                      // [修复] 增加短暂延迟，确保后端/API完成删除操作
                      await new Promise(resolve => setTimeout(resolve, 300));
                  } catch (e) {
                      logError_ACU(`Failed to clean up old target ${oldLorebookName}:`, e);
                  }
              } else {
                  logWarn_ACU('Old lorebook name could not be determined, skipping cleanup.');
              }

              // 2. 更新设置为新目标并保存
              worldbookConfig.injectionTarget = newTargetSetting;
              saveSettings_ACU();
              logDebug_ACU(`Injection target changed from "${oldTargetSetting}" to "${newTargetSetting}" for char ${currentChatFileIdentifier_ACU}.`);

              // 3. 向新目标注入条目
              if (currentJsonTableData_ACU) {
                  showToastr_ACU('info', `正在向新目标注入条目...`);
                  await updateReadableLorebookEntry_ACU(true); // `true` to ensure entries are created
                  showToastr_ACU('success', '数据注入目标已成功切换！');
              } else {
                  showToastr_ACU('warning', '数据注入目标已更新，但当前无数据可注入。');
              }
          });
      }

      // [新增] 提示词组 JSON 导入/导出
      if ($loadCharCardPromptFromJsonButton_ACU && $loadCharCardPromptFromJsonButton_ACU.length) {
        $loadCharCardPromptFromJsonButton_ACU.off('click').on('click', function () {
          loadCharCardPromptFromJson_ACU();
        });
      }
      if ($exportCharCardPromptToJsonButton_ACU && $exportCharCardPromptToJsonButton_ACU.length) {
        $exportCharCardPromptToJsonButton_ACU.off('click').on('click', function () {
          exportCharCardPromptToJson_ACU();
        });
      }

      // Attach event listeners

        // --- [新增] Tab切换逻辑 ---
        const $tabButtons = $popupInstance_ACU.find('.acu-tab-button');
        const $tabContents = $popupInstance_ACU.find('.acu-tab-content');
        $tabButtons.on('click', function() {
            const tabId = $(this).data('tab');
            $tabButtons.removeClass('active');
            $(this).addClass('active');
            $tabContents.removeClass('active');
            $popupInstance_ACU.find(`#acu-tab-${tabId}`).addClass('active');
        });
        
        // API Mode switching logic
        if ($apiModeRadios.length) {
            $apiModeRadios.on('change', function() {
                const selectedMode = $(this).val();
                settings_ACU.apiMode = selectedMode;
                saveSettings_ACU();
                updateApiModeView_ACU(selectedMode);
            });
        }
        if ($refreshTavernProfilesButton.length) {
            $refreshTavernProfilesButton.on('click', loadTavernApiProfiles_ACU);
        }
        if ($tavernProfileSelect.length) {
            $tavernProfileSelect.on('change', function() {
                settings_ACU.tavernProfile = $(this).val();
                saveSettings_ACU();
            });
        }

        // [新增] 数据隔离/多副本机制事件绑定
        const $dataIsolationCodeInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-code`);
        const $dataIsolationSaveButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-save`);
        const $dataIsolationDeleteButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-delete-entries`); // [新增]
        const $dataIsolationCombo = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-combo`);
        const $dataIsolationHistoryToggle = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-history-toggle`);
        const $dataIsolationHistoryList = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-data-isolation-history-list`);

        const closeDataIsolationHistoryDropdown_ACU = () => {
            if ($dataIsolationCombo.length && $dataIsolationHistoryList.length) {
                $dataIsolationCombo.removeClass('open');
                $dataIsolationHistoryList.hide();
            }
        };

        const renderDataIsolationHistoryDropdown_ACU = () => {
            if (!$dataIsolationHistoryList.length) return;
            const history = getDataIsolationHistory_ACU();
            $dataIsolationHistoryList.empty();
            if (!history.length) {
                $dataIsolationHistoryList.append(
                    `<li class="acu-history-empty" style="padding: 6px 10px; color: var(--text-dim); user-select: none;">暂无历史记录</li>`,
                );
                return;
            }
            history.forEach(code => {
                const safeCode = escapeHtml_ACU(code);
                $dataIsolationHistoryList.append(
                    `<li class="acu-history-item" data-code="${safeCode}" title="${safeCode}" style="padding: 6px 10px; display: flex; align-items: center; gap: 8px; cursor: pointer;">
                        <span class="acu-history-text" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${safeCode}</span>
                        <button type="button" class="acu-remove-code" data-code="${safeCode}" title="删除该标识" style="border: none; background: transparent; color: var(--error-color); cursor: pointer; font-size: 12px; line-height: 1;">×</button>
                    </li>`,
                );
            });
        };

        // 初始化输入框的值
        if ($dataIsolationCodeInput.length) {
            $dataIsolationCodeInput.val(settings_ACU.dataIsolationCode || '');
        }
        // 初始化历史下拉
        renderDataIsolationHistoryDropdown_ACU();

        // [新增] 删除按钮事件
        if ($dataIsolationDeleteButton.length) {
            $dataIsolationDeleteButton.on('click', async function() {
                if (confirm('确定要删除当前标识下的所有注入世界书条目吗？\n(这不会删除聊天记录中的数据)')) {
                    await deleteAllGeneratedEntries_ACU(); // 此函数已修改为支持隔离逻辑
                    showToastr_ACU('success', '已删除相关世界书条目。');
                }
            });
        }

        // 保存按钮事件 (简化版隔离流程)
        if ($dataIsolationSaveButton.length) {
            $dataIsolationSaveButton.on('click', async function() {
                const code = $dataIsolationCodeInput.val().trim();

                if (code) showToastr_ACU('info', `正在切换到标识 [${code}] 的整套设置/模板/数据...`);
                else showToastr_ACU('info', `标识为空：正在切换到默认整套设置/模板/数据...`);

                // [Profile] 切换标识 = 切换 profile（设置+模板），标识列表跨 profile 共享
                await switchIsolationProfile_ACU(code);

                // 刷新下拉（跨标识共享）
                renderDataIsolationHistoryDropdown_ACU();
                // 同步输入框显示（以当前 profile 为准）
                if ($dataIsolationCodeInput.length) $dataIsolationCodeInput.val(settings_ACU.dataIsolationCode || '');
                
                // 强制重载
                await loadOrCreateJsonTableFromChatHistory_ACU();
                
                // 触发UI刷新
                // 1. 刷新可视化编辑器（如果打开）
                if ($('#acu-visualizer-content').length || ACU_WindowManager.isOpen(`${SCRIPT_ID_PREFIX_ACU}-visualizer-window`)) {
                     jQuery_API_ACU(document).trigger('acu-visualizer-refresh-data');
                }
                
                // 2. [新增] 强制刷新前端UI显示的表格 (如果前端有监听 update 事件)
                if (topLevelWindow_ACU.AutoCardUpdaterAPI) {
                     topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
                }

                // 3. [新增] 强制刷新状态显示 (消息计数)
                if (typeof updateCardUpdateStatusDisplay_ACU === 'function') {
                    updateCardUpdateStatusDisplay_ACU();
                }
                
                showToastr_ACU('success', '数据载入完成！');
            });
        }
        
        // 保留回车键支持
        if ($dataIsolationCodeInput.length) {
            $dataIsolationCodeInput.on('keypress', function(e) {
                if (e.which === 13) { // Enter key
                    $dataIsolationSaveButton.trigger('click');
                }
            });
        }

        if ($dataIsolationHistoryToggle.length) {
            $dataIsolationHistoryToggle.on('click', function(e) {
                e.stopPropagation();
                if (!$dataIsolationHistoryList.length) return;
                const willOpen = !$dataIsolationCombo.hasClass('open');
                if (willOpen) {
                    renderDataIsolationHistoryDropdown_ACU();
                }
                $dataIsolationCombo.toggleClass('open', willOpen);
                $dataIsolationHistoryList.toggle(willOpen);
            });
        }

        if ($dataIsolationHistoryList.length) {
            $dataIsolationHistoryList.on('click', '.acu-history-item', function(e) {
                if ($(e.target).hasClass('acu-remove-code')) return;
                const chosen = $(this).data('code');
                if (chosen && $dataIsolationCodeInput.length) {
                    $dataIsolationCodeInput.val(chosen);
                }
                closeDataIsolationHistoryDropdown_ACU();
            });

            $dataIsolationHistoryList.on('click', '.acu-remove-code', function(e) {
                e.stopPropagation();
                const targetCode = $(this).data('code');
                removeDataIsolationHistory_ACU(targetCode);
                renderDataIsolationHistoryDropdown_ACU();
            });
        }

        if ($dataIsolationCombo.length) {
            jQuery_API_ACU(document).on('click', function(e) {
                if (!$dataIsolationCombo.hasClass('open')) return;
                if ($(e.target).closest($dataIsolationCombo).length === 0) {
                    closeDataIsolationHistoryDropdown_ACU();
                }
            });
        }

      // [新增] 世界书UI事件绑定
      if ($worldbookSourceRadios.length) {
          $worldbookSourceRadios.on('change', async function() {
              const worldbookConfig = getCurrentWorldbookConfig_ACU();
              worldbookConfig.source = $(this).val();
              saveSettings_ACU();
              await updateWorldbookSourceView_ACU();
          });
      }
      // [新增] 世界书筛选：注入目标 / 手动选择列表 / 条目列表
      const $wbTargetFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target-filter`);
      const $wbListFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-select-filter`);
      const $wbEntryFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-entry-filter`);
      if ($wbTargetFilter.length) {
          $wbTargetFilter.on('input', function() {
              const $sel = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-injection-target`);
              applyWorldbookSelectFilter_ACU($sel, $(this).val());
          });
      }
      if ($wbListFilter.length) {
          $wbListFilter.on('input', function() {
              applyWorldbookListFilter_ACU($worldbookSelect, $(this).val());
          });
      }
      if ($wbEntryFilter.length) {
          $wbEntryFilter.on('input', function() {
              applyWorldbookEntryFilter_ACU($worldbookEntryList, $(this).val());
          });
      }
      if ($refreshWorldbooksButton.length) {
          $refreshWorldbooksButton.on('click', populateWorldbookList_ACU);
      }
      // [新增] 外部导入世界书选择器的事件绑定
      const $refreshImportWorldbooksButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-refresh-import-worldbooks`);
      if ($refreshImportWorldbooksButton.length) {
          $refreshImportWorldbooksButton.on('click', populateImportWorldbookTargetSelector_ACU);
      }
      const $importWorldbookTargetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target`);
      const $importWorldbookTargetFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-worldbook-injection-target-filter`);
      const $importPromptExcludeImportedEntriesToggle = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-import-prompt-exclude-imported-worldbook-entries`);
      if ($importWorldbookTargetFilter.length) {
          $importWorldbookTargetFilter.on('input', function() {
              applyWorldbookSelectFilter_ACU($importWorldbookTargetSelect, $(this).val());
          });
      }
      if ($importWorldbookTargetSelect.length) {
          $importWorldbookTargetSelect.on('change', function() {
              settings_ACU.importWorldbookTarget = $(this).val();
              saveSettings_ACU();
              logDebug_ACU(`Import worldbook target changed to: ${settings_ACU.importWorldbookTarget}`);
          });
      }
      if ($importPromptExcludeImportedEntriesToggle.length) {
          $importPromptExcludeImportedEntriesToggle.off('change.acu_import_prompt_filter').on('change.acu_import_prompt_filter', function() {
              settings_ACU.importPromptExcludeImportedWorldbookEntries = $(this).is(':checked');
              saveSettings_ACU();
              logDebug_ACU(`[外部导入] importPromptExcludeImportedWorldbookEntries=${settings_ACU.importPromptExcludeImportedWorldbookEntries}`);
          });
      }
      const resolveWorldbookBookNames_ACU = async () => {
          const worldbookConfig = getCurrentWorldbookConfig_ACU();
          if ((worldbookConfig.source || 'character') === 'manual') {
              return [...new Set((Array.isArray(worldbookConfig.manualSelection) ? worldbookConfig.manualSelection : []).filter(Boolean))];
          }
          const names = [];
          try {
              const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
              if (charLorebooks.primary) names.push(charLorebooks.primary);
              if (charLorebooks.additional?.length) names.push(...charLorebooks.additional);
          } catch (e) {}
          return [...new Set(names.filter(Boolean))];
      };
      const isWorldbookEntryAllowedForUI_ACU = (entry) => {
          if (!entry) return false;
          const comment = entry.comment || '';
          if (comment.startsWith('TavernDB-ACU-') || comment.startsWith('重要人物条目') || comment.startsWith('总结条目')) {
              return false;
          }
          if (isEntryBlocked_ACU(entry)) return false;
          if (!entry.enabled) return false;
          return true;
      };
      const setWorldbookEntriesSelection_ACU = async (mode) => {
          const worldbookConfig = getCurrentWorldbookConfig_ACU();
          const bookNames = await resolveWorldbookBookNames_ACU();
          if (!worldbookConfig.enabledEntries) worldbookConfig.enabledEntries = {};
          const entriesMap = await getLorebookEntriesByNames_ACU(bookNames);
          for (const bookName of bookNames) {
              const entries = Array.isArray(entriesMap[bookName]) ? entriesMap[bookName] : [];
              if (mode === 'none') {
                  worldbookConfig.enabledEntries[bookName] = [];
              } else {
                  worldbookConfig.enabledEntries[bookName] = entries.filter(isWorldbookEntryAllowedForUI_ACU).map(entry => entry.uid);
              }
          }
          saveSettings_ACU();
          await populateWorldbookEntryList_ACU();
      };
      if ($worldbookSelect.length) {
          // New click handler for the custom list
          $worldbookSelect.on('click', '.qrf_worldbook_list_item', async function() {
              const $item = $(this);
              const bookName = $item.data('book-name');
              const worldbookConfig = getCurrentWorldbookConfig_ACU();
              let selection = worldbookConfig.manualSelection || [];

              if ($item.hasClass('selected')) {
                  // Deselect
                  selection = selection.filter(name => name !== bookName);
              } else {
                  // Select
                  selection.push(bookName);
              }
              
              worldbookConfig.manualSelection = selection;
              $item.toggleClass('selected'); // Toggle visual state
              
              saveSettings_ACU();
              await populateWorldbookEntryList_ACU();
          });
      }
      if ($worldbookEntryList.length) {
          $worldbookEntryList.off('change.acu_wb_list').on('change.acu_wb_list', 'input[type="checkbox"]', function() {
              const $checkbox = $(this);
              const bookName = $checkbox.data('book');
              const entryUid = $checkbox.data('uid');
              const worldbookConfig = getCurrentWorldbookConfig_ACU();

              if (!worldbookConfig.enabledEntries[bookName]) {
                  worldbookConfig.enabledEntries[bookName] = [];
              }
              const enabledList = worldbookConfig.enabledEntries[bookName];
              const index = enabledList.indexOf(entryUid);
              const checked = $checkbox.is(':checked');

              if (checked) {
                  if (index === -1) enabledList.push(entryUid);
              } else if (index > -1) {
                  enabledList.splice(index, 1);
              }
              updateLazyWorldbookEntryCheckedState_ACU($worldbookEntryList, bookName, entryUid, checked);
              saveSettings_ACU();
          });
          $worldbookEntryList.off('click.acu_wb_toggle').on('click.acu_wb_toggle', '.qrf_worldbook_entry_toggle', function() {
              const bookName = $(this).closest('.qrf_worldbook_entry_group').data('book-name');
              if (!bookName) return;
              toggleLazyWorldbookEntryGroup_ACU($worldbookEntryList, bookName);
          });
          $worldbookEntryList.off('click.acu_wb_more').on('click.acu_wb_more', '.qrf_worldbook_entry_load_more', function() {
              const bookName = $(this).closest('.qrf_worldbook_entry_group').data('book-name');
              if (!bookName) return;
              renderLazyWorldbookEntryItems_ACU($worldbookEntryList, bookName);
          });
      }

      // [新增] “总结大纲(总体大纲)”条目启用开关
      const $outlineEnabledToggle = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-worldbook-outline-entry-enabled`);
      if ($outlineEnabledToggle.length) {
          $outlineEnabledToggle.off('change.acu_outline_toggle').on('change.acu_outline_toggle', async function() {
              // UI 是“0TK占用模式”
              const modeEnabled = $(this).is(':checked');
              const worldbookConfig = getCurrentWorldbookConfig_ACU();
              worldbookConfig.zeroTkOccupyMode = !!modeEnabled;
              // 兼容：同步旧字段（旧语义：true=条目启用）
              worldbookConfig.outlineEntryEnabled = !modeEnabled;
              settings_ACU.zeroTkOccupyModeDefault = !!modeEnabled;
              globalMeta_ACU.zeroTkOccupyModeGlobal = !!modeEnabled;
              saveGlobalMeta_ACU();
              saveSettings_ACU();
              showToastr_ACU(
                  'info',
                  `0TK占用模式已${modeEnabled ? '启用' : '禁用'}（世界书中该条目显示为 ${modeEnabled ? '禁用' : '启用'}）。`,
              );

              // 尝试立即同步世界书条目 enabled 状态（不强制全量更新）
              try {
                  if (currentJsonTableData_ACU) {
                      const { outlineTable } = formatJsonToReadable_ACU(currentJsonTableData_ACU);
                      await updateOutlineTableEntry_ACU(outlineTable, false);
                  }
                  // [修复] 额外直接更新"纪要索引"条目的enabled状态
                  // 因为该条目可能由updateCustomTableExports_ACU创建，不在updateOutlineTableEntry_ACU控制范围内
                  const primaryLorebookName = await getInjectionTargetLorebook_ACU();
                  if (primaryLorebookName && TavernHelper_API_ACU) {
                      const isoPrefix = getIsolationPrefix_ACU();
                      const allEntries = await TavernHelper_API_ACU.getLorebookEntries(primaryLorebookName);
                      // [修复] 使用endsWith匹配，因为条目名称可能带有隔离前缀
                      const existingIndexEntry = allEntries.find(e => e.comment && e.comment.endsWith('TavernDB-ACU-CustomExport-纪要索引'));
                      if (existingIndexEntry) {
                          const outlineEntryEnabled = !modeEnabled; // 0TK模式启用=条目禁用
                          if (existingIndexEntry.enabled !== outlineEntryEnabled) {
                              await TavernHelper_API_ACU.setLorebookEntries(primaryLorebookName, [{
                                  uid: existingIndexEntry.uid,
                                  enabled: outlineEntryEnabled
                              }]);
                              logDebug_ACU(`0TK mode toggle: updated 纪要索引 entry. enabled=${outlineEntryEnabled}`);
                          }
                      }
                  }
              } catch (e) {
                  logWarn_ACU('Failed to sync outline entry enabled state immediately:', e);
              }
          });
      }

      // [新增] 全选/全不选事件
      if ($selectAllButton.length) {
          $selectAllButton.off('click.acu_wb_bulk').on('click.acu_wb_bulk', async function() {
              await setWorldbookEntriesSelection_ACU('all');
          });
      }

      if ($deselectAllButton.length) {
          $deselectAllButton.off('click.acu_wb_bulk').on('click.acu_wb_bulk', async function() {
              await setWorldbookEntriesSelection_ACU('none');
          });
      }

      // [新增] 外部导入事件绑定
      if ($importTxtButton.length) {
          $importTxtButton.on('click', handleTxtImportAndSplit_ACU);
      }
      // [新增] 外部导入注入按钮（自选表格）在下方统一绑定（使用 $injectImportedTxtButton）
      
      const $restoreMergeSettingsButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-restore-merge-settings`);
      const $saveMergeSettingsButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-merge-settings`);

      if ($saveMergeSettingsButton.length) {
          $saveMergeSettingsButton.on('click', function() {
              // 保存所有合并相关设置
              const $promptInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-prompt-template`);
              const $targetCount = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-target-count`);
              const $batchSize = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-batch-size`);
              const $startIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-start-index`);
              const $endIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-end-index`);
              const $autoEnabled = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-enabled`);
              const $autoThreshold = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-threshold`);
              const $autoReserve = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-reserve`);

              // 验证提示词
              const newPrompt = $promptInput.val();
              if (!newPrompt || !newPrompt.trim()) {
                  showToastr_ACU('warning', '提示词不能为空。');
                  return;
              }

              // 保存所有设置
              settings_ACU.mergeSummaryPrompt = newPrompt;
              settings_ACU.mergeTargetCount = parseInt($targetCount.val()) || 1;
              settings_ACU.mergeBatchSize = parseInt($batchSize.val()) || 5;
              settings_ACU.mergeStartIndex = parseInt($startIndex.val()) || 1;
              settings_ACU.mergeEndIndex = $endIndex.val() ? parseInt($endIndex.val()) : null;
              settings_ACU.autoMergeEnabled = $autoEnabled.is(':checked');
              settings_ACU.autoMergeThreshold = parseInt($autoThreshold.val()) || 20;
              settings_ACU.autoMergeReserve = parseInt($autoReserve.val()) || 0;

              saveSettings_ACU();
              showToastr_ACU('success', '所有合并设置已保存！');
          });
      }

      if ($restoreMergeSettingsButton.length) {
          $restoreMergeSettingsButton.on('click', function() {
              if (confirm('确定要将所有合并设置恢复为默认值吗？')) {
                  const $promptInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-prompt-template`);
                  const $targetCount = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-target-count`);
                  const $batchSize = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-batch-size`);
                  const $startIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-start-index`);
                  const $endIndex = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-end-index`);
                  const $autoEnabled = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-enabled`);
                  const $autoThreshold = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-threshold`);
                  const $autoReserve = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-auto-merge-reserve`);

                  // 恢复所有设置的默认值
                  $promptInput.val(DEFAULT_MERGE_SUMMARY_PROMPT_ACU);
                  $targetCount.val(1);
                  $batchSize.val(5);
                  $startIndex.val(1);
                  $endIndex.val('');
                  $autoEnabled.prop('checked', false);
                  $autoThreshold.val(20);
                  $autoReserve.val(0);

                  // 更新设置对象
                  settings_ACU.mergeSummaryPrompt = DEFAULT_MERGE_SUMMARY_PROMPT_ACU;
                  settings_ACU.mergeTargetCount = 1;
                  settings_ACU.mergeBatchSize = 5;
                  settings_ACU.mergeStartIndex = 1;
                  settings_ACU.mergeEndIndex = null;
                  settings_ACU.autoMergeEnabled = false;
                  settings_ACU.autoMergeThreshold = 20;
                  settings_ACU.autoMergeReserve = 0;

                  saveSettings_ACU();
                  showToastr_ACU('success', '所有合并设置已恢复默认值并保存。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.MERGE_TABLE });
              }
          });
      }

      if ($injectImportedTxtButton && $injectImportedTxtButton.length) {
          $injectImportedTxtButton.on('click', handleInjectImportedTxtSelected_ACU);
      }
      
      // [新增] 删除注入条目按钮的事件绑定
      const $deleteImportedEntriesButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-imported-entries`);
      if ($deleteImportedEntriesButton.length) {
          $deleteImportedEntriesButton.on('click', deleteImportedEntries_ACU);
      }
      
      if ($clearImportedAllButton.length) {
          $clearImportedAllButton.on('click', () => clearImportedEntries_ACU(true));
      }
      // [新增] 绑定新按钮的点击事件
      if ($clearImportedCacheButton.length) {
          $clearImportedCacheButton.on('click', () => clearImportLocalStorage_ACU(true));
      }
      if ($saveImportSplitSizeButton_ACU.length) {
          $saveImportSplitSizeButton_ACU.on('click', saveImportSplitSize_ACU);
      }
      // Initial UI state update for the import tab
      void updateImportStatusUI_ACU();

      if ($useMainApiCheckbox_ACU.length) {
        $useMainApiCheckbox_ACU.on('change', function () {
            settings_ACU.apiConfig.useMainApi = $(this).is(':checked');
            saveSettings_ACU();
            updateCustomApiInputsState_ACU();
            showToastr_ACU('info', `自定义API已切换为 ${settings_ACU.apiConfig.useMainApi ? '使用主API' : '使用独立配置'}`);
        });
      }
      // [新增] 流式传输开关事件监听
      if ($streamingEnabledCheckbox_ACU.length) {
        $streamingEnabledCheckbox_ACU.on('change', function () {
            settings_ACU.streamingEnabled = $(this).is(':checked');
            saveSettings_ACU();
            showToastr_ACU('info', `流式传输已${settings_ACU.streamingEnabled ? '启用' : '关闭'}`);
        });
      }
      if ($loadModelsButton_ACU.length) $loadModelsButton_ACU.on('click', fetchModelsAndConnect_ACU);
      if ($saveApiConfigButton_ACU.length) $saveApiConfigButton_ACU.on('click', saveApiConfig_ACU);
      if ($clearApiConfigButton_ACU.length) $clearApiConfigButton_ACU.on('click', clearApiConfig_ACU);
      
      // [新增] 下拉选择改变时自动覆盖到输入框
      if ($customApiModelSelect_ACU.length) {
          $customApiModelSelect_ACU.on('change', function() {
              const selectedModel = $(this).val();
              if (selectedModel && $customApiModelInput_ACU.length) {
                  $customApiModelInput_ACU.val(selectedModel);
              }
          });
      }

      // --- [新增] API预设管理事件绑定 ---
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-save-api-preset`).on('click', function() {
        const presetName = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-preset-name`).val();
        if (saveApiPreset_ACU(presetName)) {
          $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-preset-name`).val('');
        }
      });

      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-load-api-preset`).on('click', function() {
        const presetName = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-preset-select`).val();
        if (presetName) {
          loadApiPreset_ACU(presetName);
        } else {
          showToastr_ACU('warning', '请先选择一个预设。');
        }
      });

      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-api-preset`).on('click', function() {
        const presetName = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-api-preset-select`).val();
        if (presetName) {
          if (confirm(`确定要删除API预设 "${presetName}" 吗？`)) {
            deleteApiPreset_ACU(presetName);
          }
        } else {
          showToastr_ACU('warning', '请先选择一个预设。');
        }
      });

      // 填表API预设选择器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-table-api-preset-select`).on('change', function() {
        settings_ACU.tableApiPreset = $(this).val();
        saveSettings_ACU();
        logDebug_ACU(`填表API预设已切换为: ${settings_ACU.tableApiPreset || '当前配置'}`);
      });

      // 填表正文标签提取规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules`,
          { startPlaceholder: '开始词（例如：<think）', endPlaceholder: '结束词（例如：</think>）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules .acu-exclude-rule-end`, function() {
        settings_ACU.tableContextExtractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules .acu-exclude-rule-delete`, function() {
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        settings_ACU.tableContextExtractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules`);
        saveSettings_ACU();
      });

      // 填表正文标签排除规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules`,
          { startPlaceholder: '开始词（例如：<thinking）', endPlaceholder: '结束词（例如：</thinking>）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules .acu-exclude-rule-end`, function() {
        settings_ACU.tableContextExcludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules .acu-exclude-rule-delete`, function() {
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        settings_ACU.tableContextExcludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules`);
        saveSettings_ACU();
      });

      // 剧情推进API预设选择器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-api-preset-select`).on('change', function() {
        settings_ACU.plotApiPreset = $(this).val();
        saveSettings_ACU();
        logDebug_ACU(`剧情推进API预设已切换为: ${settings_ACU.plotApiPreset || '当前配置'}`);
      });

      if ($charCardPromptToggle_ACU.length)
        $charCardPromptToggle_ACU.on('click', () => $charCardPromptAreaDiv_ACU.slideToggle());
      if ($saveCharCardPromptButton_ACU.length) $saveCharCardPromptButton_ACU.on('click', saveCustomCharCardPrompt_ACU);
      if ($resetCharCardPromptButton_ACU.length)
        $resetCharCardPromptButton_ACU.on('click', resetDefaultCharCardPrompt_ACU);
      // 由上方“提示词组 JSON 导入/导出”统一做 off/on 绑定，避免重复绑定导致多次触发
      // if ($loadCharCardPromptFromJsonButton_ACU.length) $loadCharCardPromptFromJsonButton_ACU.on('click', loadCharCardPromptFromJson_ACU);
      
      // --- [新增] 对话编辑器事件绑定 ---
      $popupInstance_ACU.on('click', `.${SCRIPT_ID_PREFIX_ACU}-add-prompt-segment-btn`, function() {
          const position = $(this).data('position');
          const newSegment = { role: 'USER', content: '', deletable: true };
          let segments = getCharCardPromptFromUI_ACU();
          if (position === 'top') {
              segments.unshift(newSegment);
          } else {
              segments.push(newSegment);
          }
          renderPromptSegments_ACU(segments);
      });

      $popupInstance_ACU.on('click', '.prompt-segment-delete-btn', function() {
          const indexToDelete = $(this).data('index');
          let segments = getCharCardPromptFromUI_ACU();
          segments.splice(indexToDelete, 1);
          renderPromptSegments_ACU(segments);
      });

      // [新增] 主提示词槽位切换事件（A/B 两个槽位，各自保持唯一）
      $popupInstance_ACU.on('change', '.prompt-segment-main-slot', function() {
          const $currentSegment = $(this).closest('.prompt-segment');
          const selected = String($(this).val() || '').toUpperCase();

          // 1) A/B 槽位唯一：同槽位的其他段落自动改为“普通”
          if (selected === 'A' || selected === 'B') {
            $charCardPromptSegmentsContainer_ACU
              .find('.prompt-segment')
              .not($currentSegment)
              .each(function() {
                const $seg = $(this);
                const v = String($seg.find('.prompt-segment-main-slot').val() || '').toUpperCase();
                if (v === selected) {
                  $seg.find('.prompt-segment-main-slot').val('');
                }
              });
          }

          // 2) 统一刷新样式与删除按钮可见性
          $charCardPromptSegmentsContainer_ACU.find('.prompt-segment').each(function() {
            const $seg = $(this);
            const slot = String($seg.find('.prompt-segment-main-slot').val() || '').toUpperCase();
            const isA = slot === 'A';
            const isB = slot === 'B';
            const isMain = isA || isB;
            const borderColor = isA ? 'var(--accent-primary)' : (isB ? '#ffb74d' : '');
            if (isMain) {
              $seg.css('border-left', `3px solid ${borderColor}`).attr('data-main-slot', slot);
              $seg.find('.prompt-segment-delete-btn').hide();
            } else {
              $seg.css('border-left', '').attr('data-main-slot', '');
              $seg.find('.prompt-segment-delete-btn').show();
            }
          });
      });
      

      // [优化] 填表相关参数：取消“保存按钮”，改为输入后自动保存（与剧情推进一致）
      const bindAutoSaveNumberInput_ACU = ($input, saveFn, debounceMs = 450) => {
          if (!$input || !$input.length || typeof saveFn !== 'function') return;
          let t = null;
          const run = () => saveFn({ silent: true, skipReload: true });
          $input.off('input.acu_autosave change.acu_autosave blur.acu_autosave')
              .on('input.acu_autosave', function() {
                  clearTimeout(t);
                  t = setTimeout(run, debounceMs);
              })
              .on('change.acu_autosave blur.acu_autosave', function() {
                  clearTimeout(t);
                  run();
              });
      };

      bindAutoSaveNumberInput_ACU($autoUpdateTokenThresholdInput_ACU, saveAutoUpdateTokenThreshold_ACU);
      bindAutoSaveNumberInput_ACU($autoUpdateThresholdInput_ACU, saveAutoUpdateThreshold_ACU);
      bindAutoSaveNumberInput_ACU($autoUpdateFrequencyInput_ACU, saveAutoUpdateFrequency_ACU);
      bindAutoSaveNumberInput_ACU($updateBatchSizeInput_ACU, saveUpdateBatchSize_ACU);
      bindAutoSaveNumberInput_ACU($maxConcurrentGroupsInput_ACU, saveMaxConcurrentGroups_ACU);
      bindAutoSaveNumberInput_ACU($skipUpdateFloorsInput_ACU, saveSkipUpdateFloors_ACU);
      bindAutoSaveNumberInput_ACU($retainRecentLayersInput_ACU, saveRetainRecentLayers_ACU);
      bindAutoSaveNumberInput_ACU($tableMaxRetriesInput_ACU, saveTableMaxRetries_ACU); // [新增] 填表重试次数
      if ($autoUpdateEnabledCheckbox_ACU.length) {
        $autoUpdateEnabledCheckbox_ACU.on('change', function () {
          settings_ACU.autoUpdateEnabled = jQuery_API_ACU(this).is(':checked');
          saveSettings_ACU();
          logDebug_ACU('数据库自动更新启用状态已保存:', settings_ACU.autoUpdateEnabled);
          showToastr_ACU('info', `数据库自动更新已 ${settings_ACU.autoUpdateEnabled ? '启用' : '禁用'}`);
        });
      }
      if ($standardizedTableFillEnabledCheckbox_ACU && $standardizedTableFillEnabledCheckbox_ACU.length) {
        $standardizedTableFillEnabledCheckbox_ACU.on('change', function () {
          settings_ACU.standardizedTableFillEnabled = jQuery_API_ACU(this).is(':checked');
          saveSettings_ACU();
          logDebug_ACU('规范填表功能启用状态已保存:', settings_ACU.standardizedTableFillEnabled);
          showToastr_ACU('info', `规范填表功能已 ${settings_ACU.standardizedTableFillEnabled ? '开启' : '关闭'}`, {
            acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE,
          });
        });
      }
      if ($toastMuteEnabledCheckbox_ACU && $toastMuteEnabledCheckbox_ACU.length) {
        $toastMuteEnabledCheckbox_ACU.on('change', function () {
          settings_ACU.toastMuteEnabled = jQuery_API_ACU(this).is(':checked');
          saveSettings_ACU();
          logDebug_ACU('静默提示框启用状态已保存:', settings_ACU.toastMuteEnabled);
          // 该提示属于“导入/手动操作类”允许项，避免用户开启后无反馈
          showToastr_ACU('info', `静默提示框已 ${settings_ACU.toastMuteEnabled ? '开启' : '关闭'}`, {
            acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT,
          });
        });
      }
      if ($promptTemplateEnabledCheckbox_ACU && $promptTemplateEnabledCheckbox_ACU.length) {
        $promptTemplateEnabledCheckbox_ACU.on('change', function () {
          if (!settings_ACU.promptTemplateSettings) {
            settings_ACU.promptTemplateSettings = { enabled: true, maxNestingDepth: 10, debugMode: false };
          }
          settings_ACU.promptTemplateSettings.enabled = jQuery_API_ACU(this).is(':checked');
          saveSettings_ACU();
          logDebug_ACU('条件模板功能启用状态已保存:', settings_ACU.promptTemplateSettings.enabled);
          showToastr_ACU('info', `条件模板功能已 ${settings_ACU.promptTemplateSettings.enabled ? '开启' : '关闭'}`, {
            acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE,
          });
        });
      }
      if ($tableEditLastPairOnlyCheckbox_ACU && $tableEditLastPairOnlyCheckbox_ACU.length) {
        $tableEditLastPairOnlyCheckbox_ACU.on('change', function () {
          settings_ACU.tableEditLastPairOnly = jQuery_API_ACU(this).is(':checked');
          saveSettings_ACU();
          logDebug_ACU('仅识别最后一对 tableEdit 启用状态已保存:', settings_ACU.tableEditLastPairOnly);
          showToastr_ACU('info', `tableEdit 解析将${settings_ACU.tableEditLastPairOnly ? '仅使用最后一对标签' : '按全部标签优先匹配'}`, {
            acuToastCategory: ACU_TOAST_CATEGORY_ACU.MANUAL_TABLE,
          });
        });
      }
      // [新增] 统一的手动更新按钮
      if ($manualUpdateCardButton_ACU && $manualUpdateCardButton_ACU.length) {
          $manualUpdateCardButton_ACU.on('click', handleManualUpdate_ACU);
      }
      // Removed $advHideToggle event listener
        if ($importTemplateButton_ACU.length) {
            $importTemplateButton_ACU.off('click.acu_template_scope').on('click.acu_template_scope', function() {
                importTableTemplate_ACU({ scope: 'global' });
            });
        }
        if ($exportTemplateButton_ACU.length) {
            $exportTemplateButton_ACU.off('click.acu_template_scope').on('click.acu_template_scope', function() {
                exportTableTemplate_ACU({ scope: 'global' });
            });
        }
        if ($resetTemplateButton_ACU.length) {
            $resetTemplateButton_ACU.off('click.acu_template_scope').on('click.acu_template_scope', function() {
                resetTableTemplate_ACU({ source: 'ui_global_reset', scope: 'global' });
            });
        }

        const refreshTemplatePresetUiState_ACU = ({ globalSelectName = null, keepGlobalValue = false } = {}) => {
            if (!$popupInstance_ACU || !$popupInstance_ACU.length) return;
            loadTemplatePresetSelect_ACU({ globalSelectName, keepGlobalValue });
        };

        const persistCurrentTemplateChatSnapshot_ACU = async ({ source = 'ui_chat_save', presetName = null, showToast = true } = {}) => {
            const selectedChatPresetName = normalizeTemplatePresetSelectionValue_ACU(
                jQuery_API_ACU($templateChatPresetSelect_ACU).val(),
            );
            const resolvedPresetName = presetName === null
                ? (selectedChatPresetName || resolveActiveTemplatePresetName_ACU({ fallbackToGlobal: true }))
                : normalizeTemplatePresetSelectionValue_ACU(presetName);
            const guideData = getChatSheetGuideDataForIsolationKey_ACU(getCurrentIsolationKey_ACU());
            persistTemplateScopeSelectionState_ACU(resolvedPresetName, {
                source,
                updateGlobal: false,
                save: true,
                persistChatScope: true,
                templateSource: TABLE_TEMPLATE_ACU,
                guideData,
                scopeMode: 'chat_override',
                registerChatPresetEntry: true,
            });
            applyTemplateScopeForCurrentChat_ACU();
            try { await refreshMergedDataAndNotify_ACU(); } catch (e) {}
            refreshTemplatePresetUiState_ACU({ keepGlobalValue: true });
            if (showToast) {
                showToastr_ACU('success', `当前聊天预设已保存${resolvedPresetName ? `（预设名：${resolvedPresetName}）` : '（默认预设）'}；后续在此聊天再次保存会直接覆盖同名聊天预设。`, {
                    acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT,
                });
            }
            return true;
        };

        const exportCurrentChatTemplateSnapshot_ACU = () => {
            const effectivePresetName = normalizeTemplatePresetSelectionValue_ACU(resolveActiveTemplatePresetName_ACU({ fallbackToGlobal: true }));
            const chatScopeState = getCurrentChatTemplateScopeState_ACU();
            const snapshot = sanitizeTemplateSnapshotForChat_ACU(chatScopeState?.templateStr || TABLE_TEMPLATE_ACU);
            if (!snapshot?.templateObj) {
                showToastr_ACU('error', '读取当前聊天模板快照失败。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                return;
            }

            const jsonString = JSON.stringify(snapshot.templateObj, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `template_chat_snapshot_${(effectivePresetName || 'default').replace(/[^a-z0-9]/gi, '_')}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showToastr_ACU('success', `当前聊天模板快照已导出${effectivePresetName ? `（预设名：${effectivePresetName}）` : ''}。`, {
                acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT,
            });
        };

        refreshTemplatePresetUiState_ACU({ keepGlobalValue: false });

        // --- [模板预设库] 全局 / 当前聊天双作用域 ---
        if ($templatePresetSelect_ACU && $templatePresetSelect_ACU.length) {
            $templatePresetSelect_ACU.off('change.acu_template_preset').on('change.acu_template_preset', async function() {
                const name = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU(this).val());
                const displayName = name || '默认预设';
                showToastr_ACU('info', `正在切换全局模板预设：${displayName}...`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                const result = await applyTemplatePresetToCurrent_ACU(name, {
                    source: 'ui_global_select',
                    updateGlobal: true,
                    refreshUi: true,
                    save: true,
                    persistChatScope: false,
                });
                if (result) {
                    refreshTemplatePresetUiState_ACU({ globalSelectName: name, keepGlobalValue: false });
                    showToastr_ACU('success', `全局模板预设已切换：${displayName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                } else {
                    showToastr_ACU('error', `全局模板预设切换失败：${displayName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    refreshTemplatePresetUiState_ACU({ keepGlobalValue: false });
                }
            });
        }
        if ($templateChatPresetSelect_ACU && $templateChatPresetSelect_ACU.length) {
            $templateChatPresetSelect_ACU.off('change.acu_template_preset').on('change.acu_template_preset', async function() {
                const name = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU(this).val());
                const displayName = name || '默认预设';
                showToastr_ACU('info', `正在切换当前聊天模板预设：${displayName}...`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                const result = await applyTemplatePresetToCurrent_ACU(name, {
                    source: 'ui_chat_select',
                    updateGlobal: false,
                    refreshUi: true,
                    save: true,
                    persistChatScope: true,
                });
                if (result) {
                    refreshTemplatePresetUiState_ACU({ keepGlobalValue: true });
                    if (result.mode === 'chat_override') {
                        showToastr_ACU('success', `当前聊天已切换到本地模板预设：${displayName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    } else {
                        showToastr_ACU('success', `当前聊天已切换到引用预设：${displayName}；当前聊天尚未生成本地快照。`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    }
                } else {
                    showToastr_ACU('error', `当前聊天模板预设切换失败：${displayName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    refreshTemplatePresetUiState_ACU({ keepGlobalValue: true });
                }
            });
        }
        if ($templatePresetSaveBtn_ACU && $templatePresetSaveBtn_ACU.length) {
            $templatePresetSaveBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', async function() {
                const currentSelectedName = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templatePresetSelect_ACU).val());
                let finalName = currentSelectedName;
                if (isDefaultTemplatePresetSelection_ACU(currentSelectedName)) {
                    const promptedName = prompt('请输入要保存的全局模板预设名称：', '新模板预设');
                    if (!promptedName) return;
                    finalName = String(promptedName).trim();
                } else if (!confirm(`确定要用当前模板覆盖全局预设 "${currentSelectedName}" 吗？同名全局预设会被覆盖，当前聊天的本地预设不会被自动清除。`)) {
                    return;
                }
                if (!finalName) return;
                const norm = normalizeTemplateForPresetSave_ACU();
                if (!norm) {
                    showToastr_ACU('error', '保存全局模板预设失败：无法解析当前模板。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const ok = upsertTemplatePreset_ACU(finalName, norm.templateStr);
                if (!ok) {
                    showToastr_ACU('error', '保存全局模板预设失败：无法写入设置存储。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const applied = await applyTemplatePresetToCurrent_ACU(finalName, {
                    source: 'ui_global_save',
                    updateGlobal: true,
                    refreshUi: true,
                    save: true,
                    persistChatScope: false,
                });
                if (!applied) {
                    showToastr_ACU('error', '保存后切换全局模板预设失败。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                showToastr_ACU('success', `已保存全局模板预设：${finalName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
            });
        }
        if ($templatePresetSaveAsBtn_ACU && $templatePresetSaveAsBtn_ACU.length) {
            $templatePresetSaveAsBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', async function() {
                const cur = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templatePresetSelect_ACU).val());
                const defaultName = cur ? `${cur}_副本` : '新模板预设';
                const raw = prompt('另存为全局模板预设名称：', defaultName);
                if (!raw) return;
                const norm = normalizeTemplateForPresetSave_ACU();
                if (!norm) {
                    showToastr_ACU('error', '另存为全局模板预设失败：无法解析当前模板。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const requested = String(raw).trim();
                if (!requested) return;
                const finalName = ensureUniqueTemplatePresetName_ACU(requested);
                if (finalName !== requested) {
                    if (!confirm(`预设名已存在，将自动另存为 "${finalName}"。是否继续？`)) return;
                }
                const ok = upsertTemplatePreset_ACU(finalName, norm.templateStr);
                if (!ok) {
                    showToastr_ACU('error', '另存为全局模板预设失败：无法写入设置存储。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const applied = await applyTemplatePresetToCurrent_ACU(finalName, {
                    source: 'ui_global_save_as',
                    updateGlobal: true,
                    refreshUi: true,
                    save: true,
                    persistChatScope: false,
                });
                if (!applied) {
                    showToastr_ACU('error', '另存为后切换全局模板预设失败。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                showToastr_ACU('success', `已另存为全局模板预设：${finalName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
            });
        }
        if ($templatePresetRenameBtn_ACU && $templatePresetRenameBtn_ACU.length) {
            $templatePresetRenameBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', function() {
                const oldName = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templatePresetSelect_ACU).val());
                if (isDefaultTemplatePresetSelection_ACU(oldName)) {
                    showToastr_ACU('warning', '默认全局预设不能重命名。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    return;
                }
                const preset = getTemplatePreset_ACU(oldName);
                if (!preset?.templateStr) {
                    showToastr_ACU('warning', '找不到当前选中的全局模板预设。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    return;
                }
                const newName = prompt(`将全局模板预设 "${oldName}" 重命名为：`, oldName);
                if (!newName) return;
                const nn = String(newName).trim();
                if (!nn) return;
                const saveOk = upsertTemplatePreset_ACU(nn, preset.templateStr);
                if (!saveOk) {
                    showToastr_ACU('error', '重命名全局模板预设失败：无法写入设置存储。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                if (nn !== oldName) {
                    deleteTemplatePreset_ACU(oldName);
                }
                if (normalizeTemplatePresetSelectionValue_ACU(getCurrentTemplatePresetName_ACU({ requireExisting: false })) === oldName) {
                    persistCurrentTemplatePresetName_ACU(nn, { save: false });
                    saveSettings_ACU();
                }
                refreshTemplatePresetUiState_ACU({ globalSelectName: nn, keepGlobalValue: false });
                showToastr_ACU('success', `全局模板预设已重命名：${oldName} → ${nn}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
            });
        }
        if ($templatePresetDeleteBtn_ACU && $templatePresetDeleteBtn_ACU.length) {
            $templatePresetDeleteBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', function() {
                const name = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templatePresetSelect_ACU).val());
                if (isDefaultTemplatePresetSelection_ACU(name)) {
                    showToastr_ACU('warning', '默认全局预设不能删除。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    return;
                }
                if (!confirm(`确定要删除全局模板预设 "${name}" 吗？此操作不可撤销。`)) return;
                const ok = deleteTemplatePreset_ACU(name);
                refreshTemplatePresetUiState_ACU({ keepGlobalValue: false });
                if (ok) {
                    const activeGlobalName = normalizeTemplatePresetSelectionValue_ACU(getCurrentTemplatePresetName_ACU({ requireExisting: false }));
                    if (activeGlobalName === name) {
                        showToastr_ACU('success', `已从全局模板库删除预设：${name}。当前 profile 仍保留这份模板快照，直到你再次切换或恢复默认。`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    } else {
                        showToastr_ACU('success', `已删除全局模板预设：${name}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                    }
                } else {
                    showToastr_ACU('warning', `删除失败或全局模板预设不存在：${name}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
                }
            });
        }
        if ($templateChatSaveBtn_ACU && $templateChatSaveBtn_ACU.length) {
            $templateChatSaveBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', async function() {
                await persistCurrentTemplateChatSnapshot_ACU({ source: 'ui_chat_save' });
            });
        }
        if ($templateChatExportBtn_ACU && $templateChatExportBtn_ACU.length) {
            $templateChatExportBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', function() {
                exportCurrentChatTemplateSnapshot_ACU();
            });
        }
        if ($templateChatClearOverrideBtn_ACU && $templateChatClearOverrideBtn_ACU.length) {
            $templateChatClearOverrideBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', async function() {
                const currentSelectedName = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templateChatPresetSelect_ACU).val());
                let finalName = currentSelectedName;
                if (isDefaultTemplatePresetSelection_ACU(currentSelectedName)) {
                    const promptedName = prompt('请输入要保存到全局的模板预设名称：', '新模板预设');
                    if (!promptedName) return;
                    finalName = String(promptedName).trim();
                } else if (!confirm(`确定要用当前聊天正在使用的模板覆盖全局预设 "${currentSelectedName}" 吗？`)) {
                    return;
                }
                if (!finalName) return;
                const norm = normalizeTemplateForPresetSave_ACU();
                if (!norm) {
                    showToastr_ACU('error', '保存到全局失败：无法解析当前模板。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const ok = upsertTemplatePreset_ACU(finalName, norm.templateStr);
                if (!ok) {
                    showToastr_ACU('error', '保存到全局失败：无法写入设置存储。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                const applied = await applyTemplatePresetToCurrent_ACU(finalName, {
                    source: 'ui_chat_save_to_global',
                    updateGlobal: true,
                    refreshUi: true,
                    save: true,
                    persistChatScope: false,
                });
                if (!applied) {
                    showToastr_ACU('error', '保存到全局后切换全局模板预设失败。', { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR });
                    return;
                }
                refreshTemplatePresetUiState_ACU({ globalSelectName: finalName, keepGlobalValue: false });
                showToastr_ACU('success', `当前聊天模板配置已保存到全局预设：${finalName}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT });
            });
        }
        if ($templateChatImportBtn_ACU && $templateChatImportBtn_ACU.length) {
            $templateChatImportBtn_ACU.off('click.acu_template_preset').on('click.acu_template_preset', function() {
                if ($templateChatPresetFileInput_ACU && $templateChatPresetFileInput_ACU.length) {
                    $templateChatPresetFileInput_ACU.click();
                }
            });
        }
        if ($templateChatPresetFileInput_ACU && $templateChatPresetFileInput_ACU.length) {
            $templateChatPresetFileInput_ACU.off('change.acu_template_preset').on('change.acu_template_preset', function(e) {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = async readerEvent => {
                    try {
                        const content = String(readerEvent?.target?.result || '');
                        const prepared = parseImportedTemplateData_ACU(content);
                        const fallbackLabel = `导入模板_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;
                        const selectedChatPresetName = normalizeTemplatePresetSelectionValue_ACU(jQuery_API_ACU($templateChatPresetSelect_ACU).val());
                        const presetName = normalizeTemplatePresetSelectionValue_ACU(
                            deriveTemplatePresetNameForImport_ACU({
                                filename: file?.name,
                                fallbackLabel: selectedChatPresetName || fallbackLabel,
                            }) || selectedChatPresetName || fallbackLabel,
                        );
                        const applied = await applyTemplateSnapshotToScope_ACU(prepared.templateStr, {
                            scope: 'chat',
                            source: 'ui_chat_import',
                            presetName,
                            refreshUi: true,
                            save: true,
                            persistChatScope: true,
                            registerChatPresetEntry: true,
                        });
                        if (!applied) {
                            throw new Error('模板结构无效，无法生成当前聊天模板预设。');
                        }
                        try { await refreshMergedDataAndNotify_ACU(); } catch (e) {}
                        refreshTemplatePresetUiState_ACU({ keepGlobalValue: true });
                        showToastr_ACU('success', `当前聊天模板预设已导入${presetName ? `（预设名：${presetName}）` : ''}；同名聊天预设会直接覆盖。`, {
                            acuToastCategory: ACU_TOAST_CATEGORY_ACU.IMPORT,
                        });
                    } catch (error) {
                        logError_ACU('[TemplateScope] 导入当前聊天模板预设失败:', error);
                        showToastr_ACU('error', `导入当前聊天模板预设失败: ${error.message}`, { acuToastCategory: ACU_TOAST_CATEGORY_ACU.ERROR, timeOut: 10000 });
                    } finally {
                        $templateChatPresetFileInput_ACU.val('');
                    }
                };
                reader.readAsText(file, 'UTF-8');
            });
        }
        if ($resetAllDefaultsButton_ACU.length) $resetAllDefaultsButton_ACU.on('click', resetAllToDefaults_ACU);
        if ($exportJsonDataButton_ACU.length) $exportJsonDataButton_ACU.on('click', exportCurrentJsonData_ACU);

        // [新增] 模板覆盖最新层数据按钮绑定
        const $overrideWithTemplateButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-override-with-template`);
        if ($overrideWithTemplateButton.length) {
            $overrideWithTemplateButton.on('click', overrideLatestLayerWithTemplate_ACU);
        }
        
        // [新增] 删除本地数据按钮绑定
        const $deleteCurrentLocalDataButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-current-local-data`);
        const $deleteAllLocalDataButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-all-local-data`);

        if ($deleteCurrentLocalDataButton.length) {
            $deleteCurrentLocalDataButton.on('click', function() {
                const $startFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-start-floor`);
                const $endFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-end-floor`);

                const startFloor = $startFloor.length ? parseInt($startFloor.val()) || null : null;
                const endFloor = $endFloor.length && $endFloor.val() ? parseInt($endFloor.val()) || null : null;

                // 保存楼层范围设置
                settings_ACU.deleteStartFloor = startFloor;
                settings_ACU.deleteEndFloor = endFloor;
                saveSettings_ACU();

                const identityText = settings_ACU.dataIsolationEnabled ? `标识 [${settings_ACU.dataIsolationCode}]` : "所有标识";
                const rangeText = startFloor && endFloor ? `第${startFloor}到${endFloor}AI楼层` :
                                startFloor ? `从第${startFloor}AI楼层开始` :
                                endFloor ? `到第${endFloor}AI楼层结束` : "全部AI楼层";

                if (confirm(`警告：这将永久删除当前聊天记录中${rangeText}所有属于 ${identityText} 的数据库数据。\n\n此操作不可恢复！\n\n确定要继续吗？`)) {
                    deleteLocalDataInChat_ACU('current', startFloor, endFloor);
                }
            });
        }

        if ($deleteAllLocalDataButton.length) {
            $deleteAllLocalDataButton.on('click', function() {
                const $startFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-start-floor`);
                const $endFloor = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-delete-end-floor`);

                const startFloor = $startFloor.length ? parseInt($startFloor.val()) || null : null;
                const endFloor = $endFloor.length && $endFloor.val() ? parseInt($endFloor.val()) || null : null;

                // 保存楼层范围设置
                settings_ACU.deleteStartFloor = startFloor;
                settings_ACU.deleteEndFloor = endFloor;
                saveSettings_ACU();

                const rangeText = startFloor && endFloor ? `第${startFloor}到${endFloor}AI楼层` :
                                startFloor ? `从第${startFloor}AI楼层开始` :
                                endFloor ? `到第${endFloor}AI楼层结束` : "全部AI楼层";

                if (confirm(`严重警告：这将永久删除当前聊天记录中${rangeText}【所有】数据库数据，无论其标识是什么。\n\n此操作不可恢复！\n\n确定要继续吗？`)) {
                    // 二次确认
                    if (confirm(`再次确认：您真的要清空当前聊天的${rangeText}所有数据库存档吗？`)) {
                        deleteLocalDataInChat_ACU('all', startFloor, endFloor);
                    }
                }
            });
        }

        if ($importCombinedSettingsButton.length) $importCombinedSettingsButton.on('click', importCombinedSettings_ACU);
        if ($exportCombinedSettingsButton.length) $exportCombinedSettingsButton.on('click', exportCombinedSettings_ACU);
        if ($openNewVisualizerButton_ACU.length) {
            $openNewVisualizerButton_ACU.on('click', function() {
                if (topLevelWindow_ACU.AutoCardUpdaterAPI && topLevelWindow_ACU.AutoCardUpdaterAPI.openVisualizer) {
                    topLevelWindow_ACU.AutoCardUpdaterAPI.openVisualizer();
                } else {
                     openNewVisualizer_ACU(); // Fallback direct call
                }
            });
        }

        // [新增] 绑定合并总结按钮事件
        const $startMergeSummaryButton = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-start-merge-summary`);
        if ($startMergeSummaryButton.length) {
            $startMergeSummaryButton.on('click', handleManualMergeSummary_ACU);
            
            // 尝试加载默认的提示词模板
            const $promptArea = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-merge-prompt-template`);
            // 这里我们暂时硬编码一个默认值，或者可以通过 ajax 读取文件，但由于这是一个 Tampermonkey 脚本，直接读取文件比较困难
            // 用户提到 "你帮我在旁边新建并设计一个提示词.txt文档供我检查修改"
            // 所以我们可以尝试通过 fetch 获取，或者直接把之前生成的默认值放这里作为 placeholder
            // 更好的方式是每次打开弹窗时去读取那个文件? 不太行，Tampermonkey 读取本地文件受限。
            // 我们先把默认值填进去。
             const defaultMergePrompt = `你接下来需要扮演一个填表用的美杜莎，你需要参考之前的背景设定以及对发送给你的数据进行合并与精简。
你需要在 <现有基础数据> (已生成的底稿) 的基础上，将本批次的 <新增总结数据> 和 <新增大纲数据> 融合进去，并对整体内容进行重新梳理和精简。

### 核心任务
分别维护两个表格：
1.  **总结表 (Table 0)**: 记录关键剧情总结。
2.  **总体大纲 (Table 1)**: 记录时间线和事件大纲。

目标总条目数：将本批次的两个表数据分别精简为 $TARGET_COUNT 条后通过insertRow指令分别插入基础数据中对应的表格当中，注意保持两个表索引条目一致

### 输入数据区
<新增总结数据>:
$A

<新增大纲数据>:
$B

<现有基础数据> (你需要在此基础上插入本批次精简后的条目):
$BASE_DATA

### 填写指南
    **严格格式**:
\`<tableEdit>\` (表格编辑指令块):
功能: 包含实际执行表格数据更新的操作指令 (\`insertRow\`)。所有指令必须被完整包含在 \`<!--\` 和 \`-->\` 注释块内。

**输出格式强制要求:**
- **纯文本输出:** 严格按照 \`<tableThink>\`,  \`<tableEdit>\` 顺序。
- **禁止封装:** 严禁使用 markdown 代码块、引号包裹整个输出。
- **无额外字符:** 除了指令本身，禁止添加任何解释性文字。

**\`<tableEdit>\` 指令语法 (严格遵守):**
- **操作类型**: 仅限\`insertRow\`
- **参数格式**:
    - \`tableIndex\` (表序号): **必须使用你在映射步骤中从标题 \`[Index:Name]\` 提取的真实索引**。
    - \`rowIndex\` (行序号): 对应表格中的行索引 (数字, 从0开始)。
    - \`colIndex\` (列序号): 必须是**带双引号的字符串** (如 \`"0"\`).
- **指令示例**:
    - 插入: \`insertRow(10, {"0": "数据1", "1": 100})\` (注意: 如果表头是 \`[10:xxx]\`，这里必须是 10)


### 输出示例
<tableThink>
<!-- 思考：将新增的战斗细节合并入现有的第3条总结中... 新增的大纲是新的时间点，添加在最后... -->
</tableThink>
<tableEdit>
insertRow(0, ["总结条目1...", "关键词"]);
insertRow(0, ["总结条目2...", "关键词"]);
insertRow(1, ["时间1", "大纲事件1...", "关键词"]);
insertRow(1, ["时间2", "大纲事件2...", "关键词"]);
</tableEdit>`;
            if ($promptArea.length && !$promptArea.val()) {
                $promptArea.val(defaultMergePrompt);
            }
        }

      // Removed call to applyActualMessageVisibility_ACU();
      // Removed call to updateAdvancedHideUIDisplay_ACU();
      if (typeof updateCardUpdateStatusDisplay_ACU === 'function') updateCardUpdateStatusDisplay_ACU(); // Call here

      // --- [剧情推进] UI事件绑定 ---
      // 剧情推进功能开关
      const $plotEnabledCheckbox = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-enabled`);
      if ($plotEnabledCheckbox.length) {
        $plotEnabledCheckbox.on('change', function() {
          settings_ACU.plotSettings.enabled = $(this).is(':checked');
          saveSettings_ACU();
        });
      }


      // 剧情推进：独立提示词组 + 最终注入指令
      // 1) 最终注入指令仍使用原字段（兼容旧数据/旧编辑器）
      const $plotFinalDirective = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-final-directive`);
      if ($plotFinalDirective.length) {
        $plotFinalDirective.on('input change', function() {
          const value = $(this).val() || '';
          const plotSettings = getActivePlotEditorSettings_ACU();
          if (!plotSettings) return;
          plotSettings.finalSystemDirective = value;
          setPlotPromptContentByIdForSettings_ACU(plotSettings, 'finalSystemDirective', value);
          saveSettings_ACU();
        });
      }

      // 2) 独立提示词组编辑器（段落）
      $plotPromptSegmentsContainer_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-prompt-segments-container`);
      $plotTaskListContainer_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-list`);

      // 初次载入：若缺失 plotTasks / promptGroup，则从旧结构迁移生成
      try {
        setActivePlotEditorSettings_ACU(settings_ACU.plotSettings);
        ensurePlotTasksCompat_ACU(settings_ACU.plotSettings, { persist: true, syncLegacy: true });
      } catch (e) {}
      try {
        renderPlotTaskList_ACU();
        loadCurrentPlotTaskToUI_ACU();
      } catch (e) {}

      // 任务切换/新增/删除/排序
      $popupInstance_ACU.on('click', '.acu-plot-task-item', function() {
        const taskId = $(this).data('task-id');
        if (!taskId) return;
        selectPlotTaskForEditing_ACU(taskId, { saveCurrent: true });
      });
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-add`).on('click', function() {
        addPlotTaskFromUI_ACU();
      });
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-delete`).on('click', function() {
        deleteCurrentPlotTaskFromUI_ACU();
      });
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-move-up`).on('click', function() {
        moveCurrentPlotTask_ACU('up');
      });
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-move-down`).on('click', function() {
        moveCurrentPlotTask_ACU('down');
      });

      // 添加段落
      $popupInstance_ACU.on('click', `.${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt-segment-btn`, function() {
        const position = $(this).data('position');
        const newSegment = { role: 'USER', content: '', deletable: true };
        let segments = getPlotPromptGroupFromUI_ACU();
        if (position === 'top') segments.unshift(newSegment);
        else segments.push(newSegment);
        renderPlotPromptSegments_ACU(segments);
        schedulePlotTaskAutoSave_ACU({ renderTaskList: false });
      });

      // 删除段落
      $popupInstance_ACU.on('click', '.plot-prompt-segment-delete-btn', function() {
        const indexToDelete = $(this).data('index');
        let segments = getPlotPromptGroupFromUI_ACU();
        segments.splice(indexToDelete, 1);
        renderPlotPromptSegments_ACU(segments);
        schedulePlotTaskAutoSave_ACU({ renderTaskList: false });
      });

      // A/B 槽位唯一
      $popupInstance_ACU.on('change', '.plot-prompt-segment-main-slot', function() {
        const $currentSegment = $(this).closest('.plot-prompt-segment');
        const selected = String($(this).val() || '').toUpperCase();

        if (selected === 'A' || selected === 'B') {
          $plotPromptSegmentsContainer_ACU
            .find('.plot-prompt-segment')
            .not($currentSegment)
            .each(function() {
              const $seg = $(this);
              const v = String($seg.find('.plot-prompt-segment-main-slot').val() || '').toUpperCase();
              if (v === selected) {
                $seg.find('.plot-prompt-segment-main-slot').val('');
              }
            });
        }

        // 刷新样式/删除按钮
        $plotPromptSegmentsContainer_ACU.find('.plot-prompt-segment').each(function() {
          const $seg = $(this);
          const slot = String($seg.find('.plot-prompt-segment-main-slot').val() || '').toUpperCase();
          const isA = slot === 'A';
          const isB = slot === 'B';
          const isMain = isA || isB;
          const borderColor = isA ? 'var(--accent-primary)' : (isB ? '#ffb74d' : '');
          if (isMain) {
            $seg.css('border-left', `3px solid ${borderColor}`).attr('data-main-slot', slot);
            $seg.find('.plot-prompt-segment-delete-btn').hide();
          } else {
            $seg.css('border-left', '').attr('data-main-slot', '');
            $seg.find('.plot-prompt-segment-delete-btn').show();
          }
        });
        schedulePlotTaskAutoSave_ACU({ renderTaskList: false });
      });

      $popupInstance_ACU.on('input change', '.plot-prompt-segment-role, .plot-prompt-segment-content', function() {
        schedulePlotTaskAutoSave_ACU({ renderTaskList: false });
      });

      // 任务基础信息自动保存
      [
        `#${SCRIPT_ID_PREFIX_ACU}-plot-task-name`,
        `#${SCRIPT_ID_PREFIX_ACU}-plot-extract-tags`,
        `#${SCRIPT_ID_PREFIX_ACU}-plot-min-length`,
        `#${SCRIPT_ID_PREFIX_ACU}-plot-task-stage`,
        `#${SCRIPT_ID_PREFIX_ACU}-plot-task-max-retries`,
      ].forEach(selector => {
        $popupInstance_ACU.on('input change', selector, function() {
          schedulePlotTaskAutoSave_ACU({ renderTaskList: true });
        });
      });
      $popupInstance_ACU.on('change', `#${SCRIPT_ID_PREFIX_ACU}-plot-task-enabled`, function() {
        saveCurrentPlotTaskFromUI_ACU({ silent: true, renderTaskList: true, persist: true });
        loadCurrentPlotTaskToUI_ACU();
      });

      // 匹配替换速率保存
      const plotRateInputs = [
        { id: 'plot-rate-main', key: 'rateMain', defaultValue: 1.0 },
        { id: 'plot-rate-personal', key: 'ratePersonal', defaultValue: 1.0 },
        { id: 'plot-rate-erotic', key: 'rateErotic', defaultValue: 0 },
        { id: 'plot-rate-cuckold', key: 'rateCuckold', defaultValue: 1.0 },
        { id: 'plot-recall-count', key: 'recallCount', defaultValue: 20 }
      ];

      plotRateInputs.forEach(({ id, key, defaultValue }) => {
        const $input = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-${id}`);
        if ($input.length) {
          $input.on('input change', function() {
            const plotSettings = getActivePlotEditorSettings_ACU();
            if (!plotSettings) return;
            plotSettings[key] = parseFloat($(this).val()) || defaultValue;
            saveSettings_ACU();
          });
        }
      });

      // 剧情推进其他全局参数自动保存（不含任务私有参数）
      const plotPersistentInputs = [
        { id: 'plot-context-turn-count', key: 'contextTurnCount', type: 'number' },
        // 注意：plot-quick-reply-content 已改为数组，不再使用单个输入框，改用循环提示词列表管理
        { id: 'plot-loop-tags', key: 'loopSettings.loopTags', type: 'string' },
        { id: 'plot-loop-delay', key: 'loopSettings.loopDelay', type: 'number' },
        { id: 'plot-loop-total-duration', key: 'loopSettings.loopTotalDuration', type: 'number' },
        { id: 'plot-max-retries', key: 'loopSettings.maxRetries', type: 'number' }
      ];

      plotPersistentInputs.forEach(({ id, key, type }) => {
        const $input = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-${id}`);
        if ($input.length) {
          $input.on('input change', function() {
            const plotSettings = getActivePlotEditorSettings_ACU();
            if (!plotSettings) return;

            let value = $(this).val();
            if (type === 'number') {
              value = parseFloat(value) || 0;
            }

            if (key.includes('.')) {
              const [parent, child] = key.split('.');
              if (!plotSettings[parent]) {
                plotSettings[parent] = {};
              }
              plotSettings[parent][child] = value;
            } else {
              plotSettings[key] = value;
            }

            saveSettings_ACU();
          });
        }
      });

      // 剧情推进正文标签提取规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules`,
          { startPlaceholder: '开始词（例如：<think）', endPlaceholder: '结束词（例如：</think>）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules .acu-exclude-rule-end`, function() {
        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        plotSettings.contextExtractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules .acu-exclude-rule-delete`, function() {
        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        plotSettings.contextExtractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules`);
        saveSettings_ACU();
      });

      // 剧情推进标签排除规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules`,
          { startPlaceholder: '开始词（例如：<thinking）', endPlaceholder: '结束词（例如：</thinking>）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules .acu-exclude-rule-end`, function() {
        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        plotSettings.contextExcludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules .acu-exclude-rule-delete`, function() {
        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        plotSettings.contextExcludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules`);
        saveSettings_ACU();
      });

      // 循环提示词列表管理
      // 确保兼容性
      ensureLoopPromptsArray_ACU(settings_ACU.plotSettings);
      // 初始渲染
      renderLoopPromptsList_ACU();

      // 添加提示词按钮
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-plot-add-prompt`, function() {
        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        ensureLoopPromptsArray_ACU(plotSettings);
        plotSettings.loopSettings.quickReplyContent.push('');
        renderLoopPromptsList_ACU();
        // 聚焦到新添加的输入框
        setTimeout(() => {
          const $newTextarea = $popupInstance_ACU.find('.loop-prompt-textarea').last();
          if ($newTextarea.length) {
            $newTextarea.focus();
          }
        }, 100);
      });

      // 删除提示词按钮
      $popupInstance_ACU.on('click', '.loop-prompt-delete-btn', function() {
        const index = parseInt($(this).data('index'), 10);
        if (isNaN(index)) return;

        const plotSettings = getActivePlotEditorSettings_ACU();
        if (!plotSettings) return;
        ensureLoopPromptsArray_ACU(plotSettings);
        const prompts = plotSettings.loopSettings.quickReplyContent;
        
        if (prompts.length > 0 && index >= 0 && index < prompts.length) {
          prompts.splice(index, 1);
          // 调整索引
          if (plotSettings.loopSettings.currentPromptIndex >= prompts.length) {
            plotSettings.loopSettings.currentPromptIndex = 0;
          }
          renderLoopPromptsList_ACU();
          saveLoopPromptsFromUI_ACU();
        }
      });

      // 提示词内容变化时自动保存（防抖）
      let saveLoopPromptsTimeout = null;
      $popupInstance_ACU.on('input', '.loop-prompt-textarea', function() {
        clearTimeout(saveLoopPromptsTimeout);
        saveLoopPromptsTimeout = setTimeout(() => {
          saveLoopPromptsFromUI_ACU();
        }, 500);
      });

      // 预设管理（全局负责管理，当前聊天仅负责切换使用）
      const $plotPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-select`);
      const $plotImportPresets = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-import-presets`);
      const $plotExportPresets = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-export-presets`);
      const $plotSavePreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-save-preset`);
      const $plotSaveAsNewPreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-save-as-new-preset`);
      const $plotResetDefaults = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-reset-defaults`);
      const $plotDeletePreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-delete-preset`);
      const $plotPresetFileInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-file-input`);
      const $plotChatPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-chat-preset-select`);

      // 第一步：全局预设选择事件
      if ($plotPresetSelect.length) {
        $plotPresetSelect.on('change', function() {
          const selectedName = normalizePlotPresetSelectionValue_ACU($(this).val());
          const result = applyGlobalPlotPresetSelectionForEditor_ACU(selectedName, {
            source: 'ui_global_select',
            refreshUi: true,
            save: true,
          });

          if (!result) {
            showToastr_ACU('error', '找不到选中的全局预设。');
            loadPlotPresetSelect_ACU();
          }
        });
      }

      // 第二步：当前聊天预设选择事件（这里只负责切换当前聊天使用的预设）
      if ($plotChatPresetSelect.length) {
        $plotChatPresetSelect.on('change', function() {
          const selectedName = normalizePlotPresetSelectionValue_ACU($(this).val());
          const result = switchCurrentChatPlotPreset_ACU(selectedName, {
            source: 'ui',
            refreshUi: true,
            save: true,
          });

          if (!result) {
            showToastr_ACU('error', '找不到选中的当前聊天预设。');
            loadPlotPresetSelect_ACU();
            return;
          }

          showToastr_ACU(
            'success',
            result.followsGlobal
              ? '当前聊天已改为跟随全局剧情推进预设。'
              : `当前聊天已切换到预设 "${result.presetName}"。`,
          );
        });
      }


      // 导入全局预设
      if ($plotImportPresets.length) {
        $plotImportPresets.on('click', function() {
          $plotPresetFileInput.click();
        });
      }

      // 导出全局预设
      if ($plotExportPresets.length) {
        $plotExportPresets.on('click', function() {
          const selectedName = normalizePlotPresetSelectionValue_ACU($plotPresetSelect.val());
          if (isDefaultPlotPresetSelection_ACU(selectedName)) {
            showToastr_ACU('info', '默认预设不支持直接导出，请先另存为自定义预设。');
            return;
          }

          const presets = settings_ACU.plotSettings.promptPresets || [];
          const selectedPreset = presets.find(p => p.name === selectedName);

          if (!selectedPreset) {
            showToastr_ACU('error', '找不到选中的全局预设。');
            return;
          }

          const exportPreset = stripPlotPresetWorldbookEntrySelectionForExport_ACU(selectedPreset);
          const dataStr = JSON.stringify([exportPreset], null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = `plot_preset_${selectedName.replace(/[^a-z0-9]/gi, '_')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToastr_ACU('success', `全局预设 "${selectedName}" 已成功导出。`);
        });
      }

      // 保存全局预设
      if ($plotSavePreset.length) {
        $plotSavePreset.on('click', function() {
          const selectedName = normalizePlotPresetSelectionValue_ACU($plotPresetSelect.val());
          if (isDefaultPlotPresetSelection_ACU(selectedName)) {
            // 如果当前是默认预设，则等同于“另存为新的全局预设”
            savePlotPresetAsNew_ACU();
            return;
          }

          if (!confirm(`确定要用当前设置覆盖全局预设 "${selectedName}" 吗？`)) {
            return;
          }

          const presets = settings_ACU.plotSettings.promptPresets || [];
          const existingIndex = presets.findIndex(p => p.name === selectedName);

          if (existingIndex === -1) {
            showToastr_ACU('error', '找不到要覆盖的全局预设。');
            return;
          }

          const currentSettings = getCurrentPlotSettingsFromUI_ACU();
          if (!currentSettings || typeof currentSettings !== 'object') {
            showToastr_ACU('error', '读取当前剧情推进设置失败。');
            return;
          }

          const savedPreset = normalizePlotPresetExcludeRules_ACU({ name: selectedName, ...currentSettings });
          const currentRuntimePresetName = getCurrentRuntimePlotPresetName_ACU({ fallbackToGlobal: true });

          presets[existingIndex] = savedPreset;
          settings_ACU.plotSettings.promptPresets = presets;

          if (normalizePlotPresetSelectionValue_ACU(currentRuntimePresetName) === selectedName) {
            applyPlotPresetToSettings_ACU(settings_ACU.plotSettings, savedPreset);
          }

          setCurrentEditablePlotPresetState_ACU(selectedName, {
            scope: 'global',
            source: 'ui_global_save',
          });
          persistPlotPresetSelectionState_ACU(selectedName, { source: 'ui_global_save', updateGlobal: true, save: false });
          saveSettings_ACU();
          loadPlotPresetSelect_ACU();
          showToastr_ACU('success', `全局预设 "${selectedName}" 已被成功覆盖。`);
        });
      }

      // 另存为新的全局预设
      if ($plotSaveAsNewPreset.length) {
        $plotSaveAsNewPreset.on('click', function() {
          savePlotPresetAsNew_ACU();
        });
      }

      // 删除全局预设
      if ($plotDeletePreset.length) {
        $plotDeletePreset.on('click', function() {
          const selectedName = normalizePlotPresetSelectionValue_ACU($plotPresetSelect.val());
          if (isDefaultPlotPresetSelection_ACU(selectedName)) {
            showToastr_ACU('warning', '默认全局预设不能删除。');
            return;
          }

          if (!confirm(`确定要删除全局预设 "${selectedName}" 吗？`)) {
            return;
          }

          const presets = settings_ACU.plotSettings.promptPresets || [];
          const indexToDelete = presets.findIndex(p => p.name === selectedName);

          if (indexToDelete > -1) {
            presets.splice(indexToDelete, 1);
            settings_ACU.plotSettings.promptPresets = presets;

            const shouldResetGlobalSelection = normalizePlotPresetSelectionValue_ACU(settings_ACU.plotSettings.lastUsedPresetName || '') === selectedName;
            const chatScopeState = getCurrentChatPlotScopeState_ACU();
            const currentBinding = getPlotPresetBindingForChat_ACU();
            if (shouldResetGlobalSelection) {
              settings_ACU.plotSettings.lastUsedPresetName = '';
            }
            if (!chatScopeState && currentBinding && normalizePlotPresetSelectionValue_ACU(currentBinding.presetName || '') === selectedName) {
              clearPlotPresetBindingForChat_ACU(currentChatFileIdentifier_ACU);
            }

            saveSettings_ACU();

            // 刷新预设选择器
            loadPlotPresetSelect_ACU();
            showToastr_ACU('success', `全局预设 "${selectedName}" 已被删除。`);
          } else {
            showToastr_ACU('error', '找不到要删除的全局预设。');
          }
        });
      }

      // 恢复全局默认提示词
      if ($plotResetDefaults.length) {
        $plotResetDefaults.on('click', function() {
          if (!confirm('确定要恢复全局默认的剧情推进提示词吗？这将覆盖当前的提示词设置，并重置“标签摘取”。')) {
            return;
          }

          const result = applyGlobalPlotPresetSelectionForEditor_ACU('', {
            source: 'ui_global_reset',
            refreshUi: true,
            save: true,
          });

          if (!result) {
            showToastr_ACU('error', '恢复全局默认预设失败。');
            return;
          }

          showToastr_ACU('success', '全局剧情推进提示词与“标签摘取”已恢复为默认值。');
        });
      }

      // 全局预设文件导入
      if ($plotPresetFileInput.length) {
        $plotPresetFileInput.on('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = function(e) {
            try {
              const importedPresets = JSON.parse(e.target.result);

              if (!Array.isArray(importedPresets)) {
                throw new Error('JSON文件格式不正确，根节点必须是一个数组。');
              }

              let currentPresets = settings_ACU.plotSettings.promptPresets || [];
              let importedCount = 0;
              let overwrittenCount = 0;

              importedPresets.forEach(preset => {
                if (preset && typeof preset.name === 'string' && preset.name.length > 0) {
                  const getLegacyPromptFromThree_ACU = (p, id) => {
                    if (!p) return '';
                    if (Array.isArray(p)) return (p.find(x => x && x.id === id)?.content) || '';
                    if (typeof p === 'object') return p[id] || '';
                    return '';
                  };
                  const looksLikePromptGroupSegments = (arr) => {
                    if (!Array.isArray(arr) || arr.length === 0) return false;
                    const x = arr[0];
                    return x && typeof x === 'object' && 'role' in x && 'content' in x && !('id' in x);
                  };

                  // 兼容导入：新格式(promptGroup) / 某些导出用 prompts 存了段落数组 / 旧格式(三段提示词)
                  let promptGroup = null;
                  if (Array.isArray(preset.promptGroup) && preset.promptGroup.length) {
                    promptGroup = JSON.parse(JSON.stringify(preset.promptGroup));
                  } else if (looksLikePromptGroupSegments(preset.prompts)) {
                    promptGroup = JSON.parse(JSON.stringify(preset.prompts));
                  } else {
                    const legacyMain = preset.mainPrompt || getLegacyPromptFromThree_ACU(preset.prompts, 'mainPrompt') || '';
                    const legacySystem = preset.systemPrompt || getLegacyPromptFromThree_ACU(preset.prompts, 'systemPrompt') || '';
                    promptGroup = buildDefaultPlotPromptGroup_ACU({ mainAContent: legacyMain, mainBContent: legacySystem });
                  }

                  const finalDirective =
                    preset.finalSystemDirective ||
                    preset.finalDirective ||
                    getLegacyPromptFromThree_ACU(preset.prompts, 'finalSystemDirective') ||
                    '';

                  const presetData = normalizePlotPresetExcludeRules_ACU({
                    name: preset.name,
                    promptGroup: promptGroup,
                    plotTasks: Array.isArray(preset.plotTasks) ? JSON.parse(JSON.stringify(preset.plotTasks)) : undefined,
                    finalSystemDirective: finalDirective,
                    rateMain: preset.rateMain ?? 1.0,
                    ratePersonal: preset.ratePersonal ?? 1.0,
                    rateErotic: preset.rateErotic ?? 0,
                    rateCuckold: preset.rateCuckold ?? 1.0,
                    recallCount: preset.recallCount ?? 20,
                    extractTags: preset.extractTags || '',
                    contextExtractRules: normalizeExtractRules_ACU(preset.contextExtractRules, preset.contextExtractTags || ''),
                    contextExcludeRules: normalizeExcludeRules_ACU(preset.contextExcludeRules, preset.contextExcludeTags || ''),
                    minLength: preset.minLength ?? 0,
                    contextTurnCount: preset.contextTurnCount ?? 3,
                    loopSettings: preset.loopSettings || DEFAULT_PLOT_SETTINGS_ACU.loopSettings
                  });

                  const existingIndex = currentPresets.findIndex(p => p.name === preset.name);

                  if (existingIndex !== -1) {
                    currentPresets[existingIndex] = presetData;
                    overwrittenCount++;
                  } else {
                    currentPresets.push(presetData);
                    importedCount++;
                  }
                }
              });

              if (importedCount > 0 || overwrittenCount > 0) {
                settings_ACU.plotSettings.promptPresets = currentPresets;
                saveSettings_ACU();
                loadPlotPresetSelect_ACU();

                let messages = [];
                if (importedCount > 0) messages.push(`成功导入 ${importedCount} 个新预设。`);
                if (overwrittenCount > 0) messages.push(`成功覆盖 ${overwrittenCount} 个同名预设。`);
                showToastr_ACU('success', messages.join(' '));

                // 导入后：自动选择第一个有效全局预设并加载到UI（方便继续修改）
                const firstValid = importedPresets.find(p => p && typeof p.name === 'string' && p.name.length > 0);
                if (firstValid && $plotPresetSelect && $plotPresetSelect.length) {
                  setTimeout(() => {
                    $plotPresetSelect.val(firstValid.name).trigger('change');
                  }, 50);
                }
              } else {
                showToastr_ACU('warning', '未找到可导入的有效预设。');
              }
            } catch (error) {
              logError_ACU('[剧情推进] 导入预设失败:', error);
              showToastr_ACU('error', `导入失败: ${error.message}`);
            } finally {
              // 清空文件输入框
              $plotPresetFileInput.val('');
            }
          };
          reader.readAsText(file);
        });
      }

      // 循环控制按钮
      const $startLoopBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-start-loop-btn`);
      const $stopLoopBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-stop-loop-btn`);

      if ($startLoopBtn.length) {
        $startLoopBtn.on('click', function() {
          const duration = parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-total-duration`).val(), 10);
          if (!duration || duration <= 0) {
            showToastr_ACU('warning', '请设置一个大于0的总倒计时 (分钟) 才能启动循环。');
            return;
          }

          startAutoLoop_ACU();
          $(this).hide();
          $stopLoopBtn.css('display', 'inline-flex').show();
          showToastr_ACU('success', '自动化循环已启动。');
        });
      }

      if ($stopLoopBtn.length) {
        $stopLoopBtn.on('click', function() {
          stopAutoLoop_ACU();
          $(this).hide();
          $startLoopBtn.css('display', 'inline-flex').show();
          showToastr_ACU('info', '自动化循环已停止。');
        });
      }

      // 中止按钮绑定将在剧情规划开始时动态绑定

      // 加载剧情推进设置到UI
      loadPlotSettingsToUI_ACU();

      // --- [正文替换] UI事件绑定 ---
      // 正文替换功能开关
      const $optimizationEnabledCheckbox = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-enabled`);
      if ($optimizationEnabledCheckbox.length) {
        $optimizationEnabledCheckbox.on('change', function() {
          settings_ACU.contentOptimizationSettings.enabled = $(this).is(':checked');
          saveSettings_ACU();
        });
      }

      // API预设选择
      const $optimizationApiPreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-api-preset`);
      if ($optimizationApiPreset.length) {
        $optimizationApiPreset.on('change', function() {
          settings_ACU.contentOptimizationSettings.apiPreset = $(this).val();
          saveSettings_ACU();
        });
      }

      // 最小优化长度
      const $optimizationMinLength = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-min-length`);
      if ($optimizationMinLength.length) {
        $optimizationMinLength.on('input change', function() {
          const val = parseInt($(this).val(), 10);
          if (!isNaN(val) && val >= 0) {
            settings_ACU.contentOptimizationSettings.minLength = val;
            saveSettings_ACU();
          }
        });
      }

      // 最大优化项数
      const $optimizationMaxItems = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-max-items`);
      if ($optimizationMaxItems.length) {
        $optimizationMaxItems.on('input change', function() {
          const val = parseInt($(this).val(), 10);
          if (!isNaN(val) && val >= 1 && val <= 100) {
            settings_ACU.contentOptimizationSettings.maxOptimizations = val;
            saveSettings_ACU();
          }
        });
      }

      // [新增] 循环优化次数
      const $optimizationLoopCount = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-loop-count`);
      if ($optimizationLoopCount.length) {
        $optimizationLoopCount.on('input change', function() {
          const val = parseInt($(this).val(), 10);
          if (!isNaN(val) && val >= 1 && val <= 10) {
            settings_ACU.contentOptimizationSettings.loopCount = val;
            saveSettings_ACU();
          }
        });
      }

      // [新增] 自动重试次数
      const $optimizationRetryCount = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-retry-count`);
      if ($optimizationRetryCount.length) {
        $optimizationRetryCount.on('input change', function() {
          const val = parseInt($(this).val(), 10);
          if (!isNaN(val) && val >= 1 && val <= 10) {
            settings_ACU.contentOptimizationSettings.retryCount = val;
            saveSettings_ACU();
          }
        });
      }

      // 无感替换模式
      const $optimizationSeamlessMode = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-seamless-mode`);
      if ($optimizationSeamlessMode.length) {
        $optimizationSeamlessMode.on('change', function() {
          settings_ACU.contentOptimizationSettings.seamlessMode = $(this).is(':checked');
          saveSettings_ACU();
        });
      }

      // 自动应用优化结果
      const $optimizationAutoApply = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-auto-apply`);
      if ($optimizationAutoApply.length) {
        $optimizationAutoApply.on('change', function() {
          settings_ACU.contentOptimizationSettings.autoApply = $(this).is(':checked');
          saveSettings_ACU();
        });
      }

      // 显示优化对比
      const $optimizationShowDiff = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-show-diff`);
      if ($optimizationShowDiff.length) {
        $optimizationShowDiff.on('change', function() {
          settings_ACU.contentOptimizationSettings.showDiff = $(this).is(':checked');
          saveSettings_ACU();
        });
      }

      // 填表与正文替换并行执行
      const $optimizationParallelMode = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-parallel-mode`);
      if ($optimizationParallelMode.length) {
        $optimizationParallelMode.on('change', function() {
          settings_ACU.contentOptimizationSettings.parallelMode = $(this).is(':checked');
          saveSettings_ACU();
        });
      }

      // 正文优化快捷操作按钮
      const $optimizationReoptimizeLatest = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-reoptimize-latest`);
      if ($optimizationReoptimizeLatest.length) {
        $optimizationReoptimizeLatest.off('click').on('click', async function() {
          const lastOptimizedMessageIndex = getLastOptimizedMessageIndex_ACU();

          if (lastOptimizedMessageIndex < 0) {
            showToastr_ACU('warning', '当前还没有“已被正文替换过”的 AI 回复可供重新优化');
            return;
          }

          jQuery_API_ACU(this).prop('disabled', true).text('处理中...');
          try {
            await reoptimizeMessage_ACU(lastOptimizedMessageIndex);
          } finally {
            jQuery_API_ACU(this).prop('disabled', false).html('<i class="fa-solid fa-rotate-right"></i> 重新优化最近一次被替换的AI回复');
          }
        });
      }

 
      // ═══ 正文替换标签筛选规则 ═══
      // 标签提取输入框
      const $optimizationExtractTags = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-tags`);
      if ($optimizationExtractTags.length) {
        $optimizationExtractTags.on('input', function() {
          settings_ACU.contentOptimizationSettings.extractTags = $(this).val();
          saveSettings_ACU();
        });
      }

      // 标签提取规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules`,
          { startPlaceholder: '开始词（例如：<think）', endPlaceholder: '结束词（例如：</think）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules .acu-exclude-rule-end`, function() {
        settings_ACU.contentOptimizationSettings.extractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules .acu-exclude-rule-delete`, function() {
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        settings_ACU.contentOptimizationSettings.extractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules`);
        saveSettings_ACU();
      });

      // 标签排除规则编辑器
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-add-rule`).on('click', function() {
        appendExcludeRuleRow_ACU(
          `#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules`,
          { startPlaceholder: '开始词（例如：<think）', endPlaceholder: '结束词（例如：</think）' },
        );
      });
      $popupInstance_ACU.on('input', `#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules .acu-exclude-rule-start, #${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules .acu-exclude-rule-end`, function() {
        settings_ACU.contentOptimizationSettings.excludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules`);
        saveSettings_ACU();
      });
      $popupInstance_ACU.on('click', `#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules .acu-exclude-rule-delete`, function() {
        const $row = $(this).closest('.acu-exclude-rule-row');
        if ($row.length) $row.remove();
        settings_ACU.contentOptimizationSettings.excludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules`);
        saveSettings_ACU();
      });

      // ═══ 正文替换预设管理 ═══
      const $optimizationPresetSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-preset-select`);
      const $optimizationImportPresets = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-import-presets`);
      const $optimizationExportPresets = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-export-presets`);
      const $optimizationSavePreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-save-preset`);
      const $optimizationSaveAsNewPreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-save-as-new-preset`);
      const $optimizationDeletePreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-delete-preset`);
      const $optimizationResetDefaults = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-reset-defaults`);
      const $optimizationPresetFileInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-preset-file-input`);

      // 预设选择事件
      if ($optimizationPresetSelect.length) {
        $optimizationPresetSelect.on('change', function() {
          const selectedName = $(this).val();
          if (!selectedName) {
            $optimizationDeletePreset.hide();
            return;
          }

          const presets = settings_ACU.contentOptimizationSettings.promptPresets || [];
          const selectedPreset = presets.find(p => p.name === selectedName);

          if (selectedPreset) {
            // 加载预设到UI
            if (selectedPreset.promptGroup) {
              settings_ACU.contentOptimizationSettings.promptGroup = selectedPreset.promptGroup;
              renderOptimizationPromptSegments_ACU(selectedPreset.promptGroup);
            }
            $optimizationDeletePreset.show();
            saveSettings_ACU();
            showToastr_ACU('success', `已加载预设 "${selectedName}"`);
          }
        });
      }

      // 导入预设
      if ($optimizationImportPresets.length) {
        $optimizationImportPresets.on('click', function() {
          $optimizationPresetFileInput.click();
        });
      }

      // 导出预设
      if ($optimizationExportPresets.length) {
        $optimizationExportPresets.on('click', function() {
          const selectedName = $optimizationPresetSelect.val();
          if (!selectedName) {
            showToastr_ACU('info', '请先选择要导出的预设。');
            return;
          }

          const presets = settings_ACU.contentOptimizationSettings.promptPresets || [];
          const selectedPreset = presets.find(p => p.name === selectedName);

          if (!selectedPreset) {
            showToastr_ACU('error', '找不到选中的预设。');
            return;
          }

          const dataStr = JSON.stringify([selectedPreset], null, 2);
          const blob = new Blob([dataStr], { type: 'application/json' });
          const url = URL.createObjectURL(blob);

          const a = document.createElement('a');
          a.href = url;
          a.download = `optimization_preset_${selectedName.replace(/[^a-z0-9]/gi, '_')}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);

          showToastr_ACU('success', `预设 "${selectedName}" 已成功导出。`);
        });
      }

      // 保存预设（覆盖）
      if ($optimizationSavePreset.length) {
        $optimizationSavePreset.on('click', function() {
          const selectedName = $optimizationPresetSelect.val();
          if (!selectedName) {
            // 如果没有选择预设，则等同于"另存为"
            saveOptimizationPresetAsNew_ACU();
            return;
          }

          if (!confirm(`确定要用当前设置覆盖预设 "${selectedName}" 吗？`)) {
            return;
          }

          const presets = settings_ACU.contentOptimizationSettings.promptPresets || [];
          const existingIndex = presets.findIndex(p => p.name === selectedName);

          if (existingIndex === -1) {
            showToastr_ACU('error', '找不到要覆盖的预设。');
            return;
          }

          const currentPromptGroup = getOptimizationPromptGroupFromUI_ACU();
          presets[existingIndex] = { name: selectedName, promptGroup: currentPromptGroup };
          settings_ACU.contentOptimizationSettings.promptPresets = presets;
          saveSettings_ACU();
          showToastr_ACU('success', `预设 "${selectedName}" 已被成功覆盖。`);
        });
      }

      // 另存为新预设
      if ($optimizationSaveAsNewPreset.length) {
        $optimizationSaveAsNewPreset.on('click', function() {
          saveOptimizationPresetAsNew_ACU();
        });
      }

      // 删除预设
      if ($optimizationDeletePreset.length) {
        $optimizationDeletePreset.on('click', function() {
          const selectedName = $optimizationPresetSelect.val();
          if (!selectedName) {
            showToastr_ACU('warning', '没有选择任何预设。');
            return;
          }

          if (!confirm(`确定要删除预设 "${selectedName}" 吗？`)) {
            return;
          }

          const presets = settings_ACU.contentOptimizationSettings.promptPresets || [];
          const indexToDelete = presets.findIndex(p => p.name === selectedName);

          if (indexToDelete > -1) {
            presets.splice(indexToDelete, 1);
            settings_ACU.contentOptimizationSettings.promptPresets = presets;
            saveSettings_ACU();

            // 刷新预设选择器
            loadOptimizationPresetSelect_ACU();
            showToastr_ACU('success', `预设 "${selectedName}" 已被删除。`);
          } else {
            showToastr_ACU('error', '找不到要删除的预设。');
          }
        });
      }

      // 恢复默认提示词
      if ($optimizationResetDefaults.length) {
        $optimizationResetDefaults.on('click', function() {
          if (!confirm('确定要恢复默认的正文替换提示词吗？这将覆盖当前的提示词设置。')) {
            return;
          }
          settings_ACU.contentOptimizationSettings.promptGroup = buildDefaultContentOptimizationPromptGroup_ACU();
          saveSettings_ACU();
          renderOptimizationPromptSegments_ACU(settings_ACU.contentOptimizationSettings.promptGroup);
          showToastr_ACU('success', '正文替换提示词已恢复为默认值');
        });
      }

      // 预设文件导入
      if ($optimizationPresetFileInput.length) {
        $optimizationPresetFileInput.on('change', function(e) {
          const file = e.target.files[0];
          if (!file) return;

          const reader = new FileReader();
          reader.onload = function(e) {
            try {
              const importedPresets = JSON.parse(e.target.result);

              if (!Array.isArray(importedPresets)) {
                throw new Error('JSON文件格式不正确，根节点必须是一个数组。');
              }

              let currentPresets = settings_ACU.contentOptimizationSettings.promptPresets || [];
              let importedCount = 0;
              let overwrittenCount = 0;

              importedPresets.forEach(preset => {
                if (preset && typeof preset.name === 'string' && preset.name.length > 0) {
                  const presetData = {
                    name: preset.name,
                    promptGroup: preset.promptGroup || buildDefaultContentOptimizationPromptGroup_ACU()
                  };

                  const existingIndex = currentPresets.findIndex(p => p.name === preset.name);

                  if (existingIndex !== -1) {
                    currentPresets[existingIndex] = presetData;
                    overwrittenCount++;
                  } else {
                    currentPresets.push(presetData);
                    importedCount++;
                  }
                }
              });

              if (importedCount > 0 || overwrittenCount > 0) {
                settings_ACU.contentOptimizationSettings.promptPresets = currentPresets;
                saveSettings_ACU();
                loadOptimizationPresetSelect_ACU();

                let messages = [];
                if (importedCount > 0) messages.push(`成功导入 ${importedCount} 个新预设。`);
                if (overwrittenCount > 0) messages.push(`成功覆盖 ${overwrittenCount} 个同名预设。`);
                showToastr_ACU('success', messages.join(' '));

                // 导入后：自动选择第一个有效预设并加载到UI
                const firstValid = importedPresets.find(p => p && typeof p.name === 'string' && p.name.length > 0);
                if (firstValid && $optimizationPresetSelect && $optimizationPresetSelect.length) {
                  setTimeout(() => {
                    $optimizationPresetSelect.val(firstValid.name).trigger('change');
                  }, 50);
                }
              } else {
                showToastr_ACU('warning', '未找到有效的预设数据。');
              }
            } catch (err) {
              showToastr_ACU('error', `导入失败：${err.message}`);
            }
          };
          reader.readAsText(file);
          // 清空文件输入，允许重复导入同一文件
          e.target.value = '';
        });
      }

      // 保存提示词组
      const $optimizationSavePromptGroup = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-save-prompt-group`);
      if ($optimizationSavePromptGroup.length) {
        $optimizationSavePromptGroup.on('click', function() {
          const segments = getOptimizationPromptGroupFromUI_ACU();
          settings_ACU.contentOptimizationSettings.promptGroup = segments;
          saveSettings_ACU();
          showToastr_ACU('success', '正文替换提示词组已保存');
        });
      }

      // 恢复默认提示词组
      const $optimizationResetPromptGroup = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-reset-prompt-group`);
      if ($optimizationResetPromptGroup.length) {
        $optimizationResetPromptGroup.on('click', function() {
          if (!confirm('确定要恢复默认的正文替换提示词吗？这将覆盖当前的提示词设置。')) {
            return;
          }
          settings_ACU.contentOptimizationSettings.promptGroup = buildDefaultContentOptimizationPromptGroup_ACU();
          saveSettings_ACU();
          renderOptimizationPromptSegments_ACU(settings_ACU.contentOptimizationSettings.promptGroup);
          showToastr_ACU('success', '正文替换提示词已恢复为默认值');
        });
      }

      // 添加提示词段落
      $popupInstance_ACU.on('click', `.${SCRIPT_ID_PREFIX_ACU}-optimization-add-prompt-segment-btn`, function() {
        const position = $(this).data('position');
        const newSegment = { role: 'USER', content: '', deletable: true };
        let segments = getOptimizationPromptGroupFromUI_ACU();
        if (position === 'top') segments.unshift(newSegment);
        else segments.push(newSegment);
        renderOptimizationPromptSegments_ACU(segments);
      });

      // 删除提示词段落
      $popupInstance_ACU.on('click', '.optimization-prompt-segment-delete-btn', function() {
        const indexToDelete = $(this).data('index');
        let segments = getOptimizationPromptGroupFromUI_ACU();
        segments.splice(indexToDelete, 1);
        renderOptimizationPromptSegments_ACU(segments);
      });

      // 测试按钮
      const $optimizationTestBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-test-btn`);
      if ($optimizationTestBtn.length) {
        $optimizationTestBtn.on('click', async function() {
          const testInput = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-test-input`).val();
          if (!testInput || testInput.trim().length < 10) {
            showToastr_ACU('warning', '请输入至少10个字符的测试文本');
            return;
          }

          $(this).prop('disabled', true).text('优化中...');
          const $resultDiv = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-test-result`);
          const $outputDiv = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-test-output`);
          $resultDiv.show();
          $outputDiv.text('正在调用AI进行优化...');

          try {
            const result = await performContentOptimization_ACU(testInput);
            if (result.success) {
              let outputText = `优化完成！共 ${result.optimizations.length} 处改进\n\n`;
              outputText += `摘要：${result.summary || '无'}\n\n`;
              outputText += `=== 优化详情 ===\n\n`;
              result.optimizations.forEach((opt, i) => {
                outputText += `[${i + 1}] 修改方案：${opt.plan || opt.reason || '未说明'}\n`;
                outputText += `原文：${opt.original.substring(0, 100)}${opt.original.length > 100 ? '...' : ''}\n`;
                outputText += `优化：${opt.optimized.substring(0, 100)}${opt.optimized.length > 100 ? '...' : ''}\n\n`;
              });
              outputText += `=== 优化后全文 ===\n\n${result.optimizedContent}`;
              $outputDiv.text(outputText);
            } else {
              $outputDiv.text(`优化失败：${result.error || '未知错误'}`);
            }
          } catch (e) {
            $outputDiv.text(`优化出错：${e.message}`);
          }

          $(this).prop('disabled', false).text('执行优化测试');
        });
      }

      // 加载正文优化设置到UI
      loadOptimizationSettingsToUI_ACU();

      // [新增] 刷新API预设选择器
      refreshApiPresetSelectors_ACU();

      // [剧情推进] 世界书选择 UI 绑定（独立）
      try {
        const cfg = getPlotWorldbookConfig_ACU();
        const $plotWbRadios = $popupInstance_ACU.find(`input[name="${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-source"]`);
        if ($plotWbRadios.length) {
          $plotWbRadios.filter(`[value="${cfg.source || 'character'}"]`).prop('checked', true);
          $plotWbRadios.off('change.acu_plot_wb').on('change.acu_plot_wb', async function() {
            const v = $(this).val();
            cfg.source = (v === 'manual') ? 'manual' : 'character';
            saveSettings_ACU();
            await updatePlotWorldbookSourceView_ACU();
          });
        }

        // 手动选择：世界书列表点击切换选中
        const $plotWbList = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select`);
        const $plotWbListFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-filter`);
        const $plotEntryFilter = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-filter`);
        if ($plotWbList.length) {
          $plotWbList.off('click.acu_plot_wb').on('click.acu_plot_wb', '.qrf_worldbook_list_item', async function() {
            const bookName = $(this).data('book-name');
            if (!bookName) return;
            let selection = Array.isArray(cfg.manualSelection) ? cfg.manualSelection : [];
            if (selection.includes(bookName)) selection = selection.filter(x => x !== bookName);
            else selection = [...selection, bookName];
            cfg.manualSelection = selection;
            saveSettings_ACU();
            await updatePlotWorldbookSourceView_ACU();
          });
        }
        if ($plotWbListFilter.length) {
          $plotWbListFilter.off('input.acu_plot_wb').on('input.acu_plot_wb', function() {
            applyWorldbookListFilter_ACU($plotWbList, $(this).val());
          });
        }

        const $plotSelectAll = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-all`);
        const $plotDeselectAll = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-deselect-all`);
        // 兼容旧id（如果用户未更新UI片段或缓存导致旧节点仍在）
        const $plotSelectNoneLegacy = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-select-none`);
        const resolvePlotBookNames_ACU = async () => {
          if ((cfg.source || 'character') === 'manual') return Array.isArray(cfg.manualSelection) ? cfg.manualSelection : [];
          const names = [];
          try {
            const charLorebooks = await TavernHelper_API_ACU.getCharLorebooks({ type: 'all' });
            if (charLorebooks.primary) names.push(charLorebooks.primary);
            if (charLorebooks.additional?.length) names.push(...charLorebooks.additional);
          } catch (e) {}
          return names;
        };
        const isPlotEntryAllowed_ACU = (entry) => {
          if (!entry) return false;
          const comment = entry.comment || entry.name || '';
          // UI 不显示数据库生成条目（含隔离/外部导入前缀），因此“全选/全不选”也只作用于非数据库条目
          let normalizedComment = String(comment).replace(/^ACU-\[[^\]]+\]-/, '');
          normalizedComment = normalizedComment.replace(/^外部导入-(?:[^-]+-)?/, '');
          if (normalizedComment.startsWith('TavernDB-ACU-OutlineTable')) return false; // 仍需屏蔽总结大纲
          const isDbGenerated =
            normalizedComment.startsWith('TavernDB-ACU-') ||
            normalizedComment.startsWith('总结条目') ||
            normalizedComment.startsWith('小总结条目') ||
            normalizedComment.startsWith('重要人物条目');
          if (isDbGenerated) return false;
          if (isEntryBlocked_ACU(entry)) return false;
          // “启用的世界书条目”按钮应只勾选 ST 本身启用的条目（否则勾选了也不会被使用）
          if (!entry.enabled) return false;
          return true;
        };
        const setPlotEntriesSelection_ACU = async (mode) => {
          // mode: 'all' | 'none'
          const bookNames = await resolvePlotBookNames_ACU();
          if (!cfg.enabledEntries) cfg.enabledEntries = {};

          const allBooks = await getWorldBooks_ACU();
          for (const bookName of bookNames) {
            let entries = [];
            const bookData = allBooks.find(b => b.name === bookName);
            if (bookData?.entries?.length) {
              entries = bookData.entries;
            } else {
              try { entries = await TavernHelper_API_ACU.getLorebookEntries(bookName); } catch (e) { entries = []; }
            }

            if (mode === 'none') {
              cfg.enabledEntries[bookName] = [];
            } else {
              cfg.enabledEntries[bookName] = (entries || []).filter(isPlotEntryAllowed_ACU).map(e => e.uid);
            }
          }

          saveSettings_ACU();
          await populatePlotWorldbookEntryList_ACU(); // 立即刷新UI，显示勾选/取消
        };

        if ($plotSelectAll.length) {
          $plotSelectAll.off('click.acu_plot_wb').on('click.acu_plot_wb', async function() {
            await setPlotEntriesSelection_ACU('all');
          });
        }
        if ($plotDeselectAll.length) {
          $plotDeselectAll.off('click.acu_plot_wb').on('click.acu_plot_wb', async function() {
            await setPlotEntriesSelection_ACU('none');
          });
        }
        if ($plotSelectNoneLegacy.length) {
          $plotSelectNoneLegacy.off('click.acu_plot_wb').on('click.acu_plot_wb', async function() {
            await setPlotEntriesSelection_ACU('none');
          });
        }

        const $plotRefreshWorldbooks = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-refresh-worldbooks`);
        if ($plotRefreshWorldbooks.length) {
          $plotRefreshWorldbooks.off('click.acu_plot_wb').on('click.acu_plot_wb', async function() {
            await updatePlotWorldbookSourceView_ACU();
          });
        }

        // 条目勾选
        const $plotEntryList = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-worldbook-entry-list`);
        if ($plotEntryList.length) {
          $plotEntryList.off('change.acu_plot_wb').on('change.acu_plot_wb', 'input[type="checkbox"]', function() {
            const bookName = $(this).data('book');
            const uid = $(this).data('uid');
            if (!bookName || uid === undefined || uid === null) return;
            if (!cfg.enabledEntries) cfg.enabledEntries = {};
            if (!Array.isArray(cfg.enabledEntries[bookName])) cfg.enabledEntries[bookName] = [];
            const list = cfg.enabledEntries[bookName];
            const checked = $(this).is(':checked');
            if (checked && !list.includes(uid)) list.push(uid);
            if (!checked && list.includes(uid)) cfg.enabledEntries[bookName] = list.filter(x => x !== uid);
            updateLazyWorldbookEntryCheckedState_ACU($plotEntryList, bookName, uid, checked);
            saveSettings_ACU();
          });
          $plotEntryList.off('click.acu_plot_wb_toggle').on('click.acu_plot_wb_toggle', '.qrf_worldbook_entry_toggle', function() {
            const bookName = $(this).closest('.qrf_worldbook_entry_group').data('book-name');
            if (!bookName) return;
            toggleLazyWorldbookEntryGroup_ACU($plotEntryList, bookName);
          });
          $plotEntryList.off('click.acu_plot_wb_more').on('click.acu_plot_wb_more', '.qrf_worldbook_entry_load_more', function() {
            const bookName = $(this).closest('.qrf_worldbook_entry_group').data('book-name');
            if (!bookName) return;
            renderLazyWorldbookEntryItems_ACU($plotEntryList, bookName);
          });
        }
        if ($plotEntryFilter.length) {
          $plotEntryFilter.off('input.acu_plot_wb').on('input.acu_plot_wb', function() {
            applyWorldbookEntryFilter_ACU($plotEntryList, $(this).val());
          });
        }

        await updatePlotWorldbookSourceView_ACU();
      } catch (e) {
        logWarn_ACU('[剧情推进] Plot worldbook UI bind failed:', e);
      }

      showToastr_ACU('success', '数据库更新工具已加载。');
      }
    });

    // --- [剧情推进] 辅助函数 ---

    /**
     * 加载剧情推进设置到UI
     */
    function loadPlotSettingsToUI_ACU(plotSettingsOverride = null) {
      if (!$popupInstance_ACU) return;
 
      $plotPromptSegmentsContainer_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-prompt-segments-container`);
      $plotTaskListContainer_ACU = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-task-list`);
 
      const plotSettings = setActivePlotEditorSettings_ACU(plotSettingsOverride || settings_ACU.plotSettings);
      if (!plotSettings) return;

      // 功能开关
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-enabled`).prop('checked', plotSettings.enabled);

      renderPlotTaskList_ACU(plotSettings);
      loadCurrentPlotTaskToUI_ACU(plotSettings);
      // 最终注入指令
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-final-directive`).val(getPlotPromptContentByIdFromSettings_ACU(plotSettings, 'finalSystemDirective'));

      // 匹配替换速率
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-main`).val(plotSettings.rateMain);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-personal`).val(plotSettings.ratePersonal);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-erotic`).val(plotSettings.rateErotic);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-cuckold`).val(plotSettings.rateCuckold);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-recall-count`).val(plotSettings.recallCount ?? 20);

      // 循环设置
      ensureLoopPromptsArray_ACU(plotSettings);
      const loopSettings = plotSettings.loopSettings;
      // 循环提示词现在使用数组，通过 renderLoopPromptsList_ACU 渲染
      renderLoopPromptsList_ACU(plotSettings);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-tags`).val(loopSettings.loopTags || '');
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-delay`).val(loopSettings.loopDelay);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-total-duration`).val(loopSettings.loopTotalDuration);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-max-retries`).val(loopSettings.maxRetries);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-turn-count`).val(plotSettings.contextTurnCount);
      renderExcludeRuleRows_ACU(
        `#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules`,
        normalizeExtractRules_ACU(plotSettings.contextExtractRules, plotSettings.contextExtractTags || ''),
        {
          startPlaceholder: '开始词（例如：<think）',
          endPlaceholder: '结束词（例如：</think>）',
          fallbackRules: getDefaultPlotContextExtractRules_ACU(),
        },
      );
      renderExcludeRuleRows_ACU(
        `#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules`,
        normalizeExcludeRules_ACU(plotSettings.contextExcludeRules, plotSettings.contextExcludeTags || ''),
        {
          startPlaceholder: '开始词（例如：<thinking）',
          endPlaceholder: '结束词（例如：</thinking>）',
          fallbackRules: getDefaultPlotContextExcludeRules_ACU(),
        },
      );

      // 循环状态
      updatePlotLoopStatusUI_ACU();

      // 预设选择器
      loadPlotPresetSelect_ACU();
    }

    /**
     * 加载正文替换预设选择器
     */
    function loadOptimizationPresetSelect_ACU() {
      if (!$popupInstance_ACU) return;

      const $select = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-preset-select`);
      const $deleteBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-delete-preset`);
      if (!$select.length) return;

      const presets = settings_ACU.contentOptimizationSettings?.promptPresets || [];
      const currentValue = $select.val();

      $select.find('option:not(:first)').remove();

      presets.forEach(preset => {
        if (preset && preset.name) {
          $select.append(`<option value="${preset.name}">${preset.name}</option>`);
        }
      });

      // 恢复之前选中的值（如果还存在）
      if (currentValue && presets.find(p => p.name === currentValue)) {
        $select.val(currentValue);
        if ($deleteBtn.length) $deleteBtn.show();
      } else {
        $select.val('');
        if ($deleteBtn.length) $deleteBtn.hide();
      }
    }

    /**
     * 另存为新的正文替换预设
     */
    function saveOptimizationPresetAsNew_ACU() {
      const presetName = prompt('请输入新预设的名称：');
      if (!presetName || !presetName.trim()) {
        showToastr_ACU('warning', '预设名称不能为空。');
        return;
      }

      const name = presetName.trim();
      const presets = settings_ACU.contentOptimizationSettings.promptPresets || [];
      const existingIndex = presets.findIndex(p => p.name === name);

      if (existingIndex !== -1) {
        if (!confirm(`预设 "${name}" 已存在。是否覆盖？`)) {
          return;
        }
        presets[existingIndex] = {
          name: name,
          promptGroup: getOptimizationPromptGroupFromUI_ACU()
        };
        showToastr_ACU('success', `预设 "${name}" 已被覆盖。`);
      } else {
        presets.push({
          name: name,
          promptGroup: getOptimizationPromptGroupFromUI_ACU()
        });
        showToastr_ACU('success', `预设 "${name}" 已成功创建。`);
      }

      settings_ACU.contentOptimizationSettings.promptPresets = presets;
      saveSettings_ACU();
      loadOptimizationPresetSelect_ACU();

      // 选中新创建的预设
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-preset-select`).val(name);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-delete-preset`).show();
    }

    /**
     * 加载正文替换设置到UI
     */
    function loadOptimizationSettingsToUI_ACU() {
      if (!$popupInstance_ACU) return;

      const config = settings_ACU.contentOptimizationSettings || {};

      // [隐藏功能] 只有当剧情推进最大重试次数为49时才显示正文替换标签
      const plotMaxRetries = settings_ACU.plotSettings?.loopSettings?.maxRetries ?? 3;
      const $optimizationTab = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-tab-optimization`);
      if ($optimizationTab.length) {
        if (plotMaxRetries === 49) {
          $optimizationTab.show();
        } else {
          $optimizationTab.hide();
        }
      }

      // 功能开关
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-enabled`).prop('checked', !!config.enabled);

      // API预设
      const $apiPreset = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-api-preset`);
      if ($apiPreset.length) {
        $apiPreset.val(config.apiPreset || '');
      }

      // 基础设置
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-min-length`).val(config.minLength || 100);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-max-items`).val(config.maxOptimizations || 10);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-loop-count`).val(config.loopCount || 1);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-retry-count`).val(config.retryCount || 3);

      // 优化模式
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-seamless-mode`).prop('checked', config.seamlessMode !== false);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-auto-apply`).prop('checked', config.autoApply !== false);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-show-diff`).prop('checked', config.showDiff !== false);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-parallel-mode`).prop('checked', config.parallelMode === true);

      // 标签筛选设置
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-tags`).val(config.extractTags || '');
      
      // 加载标签提取规则
      renderExcludeRuleRows_ACU(
        `#${SCRIPT_ID_PREFIX_ACU}-optimization-extract-rules`,
        config.extractRules || [],
        {
          startPlaceholder: '开始词（例如：<think）',
          endPlaceholder: '结束词（例如：</think）',
        },
      );
      
      // 加载标签排除规则
      renderExcludeRuleRows_ACU(
        `#${SCRIPT_ID_PREFIX_ACU}-optimization-exclude-rules`,
        config.excludeRules || [],
        {
          startPlaceholder: '开始词（例如：<think）',
          endPlaceholder: '结束词（例如：</think）',
        },
      );

      // 加载预设选择器
      loadOptimizationPresetSelect_ACU();

      // 提示词组
      const promptGroup = config.promptGroup && config.promptGroup.length > 0
        ? config.promptGroup
        : DEFAULT_CONTENT_OPTIMIZATION_PROMPT_GROUP_ACU;
      renderOptimizationPromptSegments_ACU(promptGroup);
    }

    /**
     * 渲染正文优化提示词段落
     */
    function renderOptimizationPromptSegments_ACU(segments) {
      if (!$popupInstance_ACU) return;
      const $container = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-optimization-prompt-segments-container`);
      if (!$container.length) return;

      $container.empty();

      if (!Array.isArray(segments)) return;

      segments.forEach((segment, index) => {
        const isMain = segment.isMain || segment.mainSlot === 'A';
        const isMain2 = segment.isMain2 || segment.mainSlot === 'B';
        const deletable = segment.deletable !== false;

        const segmentHtml = `
          <div class="optimization-prompt-segment" data-index="${index}" style="
            margin-bottom: 15px;
            padding: 15px;
            background: var(--background_default);
            border-radius: 8px;
            border: 1px solid var(--border_color_light);
            ${isMain ? 'border-left: 3px solid var(--blue);' : ''}
            ${isMain2 ? 'border-left: 3px solid var(--purple);' : ''}
          ">
            <div style="display: flex; gap: 10px; margin-bottom: 10px; align-items: center;">
              <select class="optimization-prompt-segment-role text_pole" data-index="${index}" style="width: 120px;">
                <option value="SYSTEM" ${segment.role === 'SYSTEM' ? 'selected' : ''}>SYSTEM</option>
                <option value="USER" ${segment.role === 'USER' ? 'selected' : ''}>USER</option>
                <option value="assistant" ${segment.role === 'assistant' ? 'selected' : ''}>assistant</option>
              </select>
              ${deletable ? `
                <button type="button" class="optimization-prompt-segment-delete-btn button" data-index="${index}" style="margin-left: auto; padding: 4px 8px; font-size: 0.85em;">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
            <textarea class="optimization-prompt-segment-content text_pole" data-index="${index}" rows="6" placeholder="输入提示词内容..." style="resize: vertical; width: 100%;">${escapeHtml_ACU(segment.content || '')}</textarea>
          </div>
        `;
        $container.append(segmentHtml);
      });

      // 绑定输入事件
      $container.find('.optimization-prompt-segment-role').on('change', function() {
        const idx = parseInt($(this).data('index'), 10);
        const segments = getOptimizationPromptGroupFromUI_ACU();
        if (segments[idx]) {
          segments[idx].role = $(this).val();
          settings_ACU.contentOptimizationSettings.promptGroup = segments;
          saveSettings_ACU();
        }
      });

      $container.find('.optimization-prompt-segment-content').on('input change', function() {
        const idx = parseInt($(this).data('index'), 10);
        const segments = getOptimizationPromptGroupFromUI_ACU();
        if (segments[idx]) {
          segments[idx].content = $(this).val();
          settings_ACU.contentOptimizationSettings.promptGroup = segments;
          saveSettings_ACU();
        }
      });
    }

    /**
     * 从UI获取正文优化提示词组
     */
    function getOptimizationPromptGroupFromUI_ACU() {
      if (!$popupInstance_ACU) return [];

      const segments = [];
      const $segments = $popupInstance_ACU.find('.optimization-prompt-segment');

      $segments.each(function() {
        const $seg = $(this);
        const index = parseInt($seg.data('index'), 10);
        const role = $seg.find('.optimization-prompt-segment-role').val();
        const content = $seg.find('.optimization-prompt-segment-content').val();

        segments.push({
          role: role || 'USER',
          content: content || '',
          deletable: true
        });
      });

      return segments;
    }

    /**
     * 更新剧情推进循环状态UI
     */
    function updatePlotLoopStatusUI_ACU() {
      if (!$popupInstance_ACU) return;

      const $statusText = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-status-text`);
      const $timerDisplay = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-timer-display`);
      const $startBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-start-loop-btn`);
      const $stopBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-stop-loop-btn`);

      if (loopState_ACU.isLooping) {
        $statusText.text('运行中').css('color', 'var(--green)');
        $startBtn.hide();
        $stopBtn.show();
        $timerDisplay.show();
      } else {
        $statusText.text('未运行').css('color', 'var(--red)');
        $stopBtn.hide();
        $startBtn.show();
        $timerDisplay.hide().text('');
      }
    }

    /**
     * 加载剧情预设选择器
     */
    function getPlotPresetDisplayName_ACU(presetName) {
      const normalizedPresetName = normalizePlotPresetSelectionValue_ACU(presetName);
      return normalizedPresetName || '默认预设';
    }

    function formatPlotScopeUpdatedAt_ACU(updatedAt) {
      const ts = Number(updatedAt) || 0;
      if (!ts) return '';
      try {
        return new Date(ts).toLocaleString('zh-CN', { hour12: false });
      } catch (error) {
        return '';
      }
    }

    function populatePlotPresetSelectOptions_ACU($select, presets, { extraPresetName = '' } = {}) {
      if (!$select || !$select.length) return;

      const normalizedExtraPresetName = normalizePlotPresetSelectionValue_ACU(extraPresetName);
      const normalizedPresetNames = new Set();
      $select.empty().append(`<option value="${DEFAULT_PRESET_OPTION_VALUE_ACU}">默认预设</option>`);

      presets.forEach(preset => {
        const presetName = normalizePlotPresetSelectionValue_ACU(preset?.name);
        if (!presetName || normalizedPresetNames.has(presetName)) return;
        normalizedPresetNames.add(presetName);
        $select.append(`<option value="${escapeHtml_ACU(presetName)}">${escapeHtml_ACU(presetName)}</option>`);
      });

      if (normalizedExtraPresetName && !normalizedPresetNames.has(normalizedExtraPresetName)) {
        $select.append(
          `<option value="${escapeHtml_ACU(normalizedExtraPresetName)}">${escapeHtml_ACU(normalizedExtraPresetName)}（仅当前聊天快照）</option>`
        );
      }
    }

    function loadPlotPresetSelect_ACU() {
      if (!$popupInstance_ACU || !settings_ACU?.plotSettings) return;

      const presets = settings_ACU.plotSettings.promptPresets || [];
      const globalPresetName = normalizePlotPresetSelectionValue_ACU(settings_ACU.plotSettings.lastUsedPresetName || '');
      const chatScopeState = getCurrentChatPlotScopeState_ACU();
      const currentBinding = getPlotPresetBindingForChat_ACU();
      const effectiveChatPresetName = resolveActivePlotPresetName_ACU({ fallbackToGlobal: true });
      const explicitChatPresetName = normalizePlotPresetSelectionValue_ACU(currentBinding?.presetName || '');
      const chatSelectedPresetName = normalizePlotPresetSelectionValue_ACU(explicitChatPresetName || chatScopeState?.presetName || '');

      const $globalSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-select`);
      const $chatSelect = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-chat-preset-select`);
      const $globalDeleteBtn = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-delete-preset`);
      const $globalStatus = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-scope-status`);
      const $chatStatus = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-chat-scope-status`);
      const $chatOriginStatus = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-chat-origin-status`);

      populatePlotPresetSelectOptions_ACU($globalSelect, presets);
      populatePlotPresetSelectOptions_ACU($chatSelect, presets, { extraPresetName: chatSelectedPresetName });

      if ($chatSelect.length) {
        $chatSelect.find(`option[value="${DEFAULT_PRESET_OPTION_VALUE_ACU}"]`).text('跟随全局');
      }

      const hasGlobalPreset = !!globalPresetName && presets.some(p => normalizePlotPresetSelectionValue_ACU(p?.name) === globalPresetName);
      const hasChatPreset = !!chatSelectedPresetName && $chatSelect.find(`option[value="${chatSelectedPresetName.replace(/"/g, '\\"')}"]`).length > 0;
      const hasValidExplicitChatPreset = !!explicitChatPresetName && !!findPlotPresetByName_ACU(explicitChatPresetName);

      if ($globalSelect.length) {
        $globalSelect.val(hasGlobalPreset ? globalPresetName : DEFAULT_PRESET_OPTION_VALUE_ACU);
      }
      if ($globalDeleteBtn.length) {
        $globalDeleteBtn.toggle(hasGlobalPreset);
      }
      if ($chatSelect.length) {
        $chatSelect.val(hasChatPreset ? chatSelectedPresetName : DEFAULT_PRESET_OPTION_VALUE_ACU);
      }

      if ($globalStatus.length) {
        $globalStatus.text(`当前全局预设：${getPlotPresetDisplayName_ACU(globalPresetName)}；新聊天会默认继承这里的剧情推进配置。`);
      }

      if ($chatStatus.length) {
        if (chatScopeState?.snapshot) {
          $chatStatus.text(`当前聊天：历史聊天快照；当前实际预设为 ${getPlotPresetDisplayName_ACU(effectiveChatPresetName)}。`);
        } else if (hasValidExplicitChatPreset) {
          $chatStatus.text(`当前聊天：独立预设；当前实际预设为 ${getPlotPresetDisplayName_ACU(explicitChatPresetName)}。`);
        } else if (chatSelectedPresetName) {
          $chatStatus.text(`当前聊天：原绑定预设不存在；当前已回退为 ${getPlotPresetDisplayName_ACU(effectiveChatPresetName)}。`);
        } else {
          $chatStatus.text(`当前聊天：跟随全局；当前实际预设为 ${getPlotPresetDisplayName_ACU(effectiveChatPresetName)}。`);
        }
      }

      if ($chatOriginStatus.length) {
        if (chatScopeState?.snapshot) {
          $chatOriginStatus.text('当前聊天仍在使用旧版聊天快照；重新切换一次当前聊天预设后，将迁移为新的按预设切换模式。');
        } else if (hasValidExplicitChatPreset) {
          $chatOriginStatus.text('当前聊天已单独指定剧情推进预设；如需修改预设内容，请在左侧全局预设区操作。');
        } else if (chatSelectedPresetName) {
          $chatOriginStatus.text('当前聊天原绑定的剧情推进预设已不存在；当前运行已回退到全局预设，请重新选择一次当前聊天预设。');
        } else {
          $chatOriginStatus.text('当前聊天当前未单独指定剧情推进预设，实际会直接跟随全局。');
        }
      }
    }

    /**
     * 加载预设到UI
     */
    function loadPlotPresetToUI_ACU(preset) {
      if (!$popupInstance_ACU || !preset) return;

      const presetName = preset.name || '默认预设';
      const result = applyGlobalPlotPresetSelectionForEditor_ACU(preset.name || '', {
        source: 'ui_global_load',
        refreshUi: true,
        save: true,
      });

      if (!result) return;
      showToastr_ACU('success', `已加载全局预设 "${presetName}"。`);
    }

    /**
     * 从UI获取当前剧情设置
     */
    function getCurrentPlotSettingsFromUI_ACU() {
      if (!$popupInstance_ACU) return {};

      flushCurrentPlotTaskEditorState_ACU({ renderTaskList: true, persist: false });
      const activeSettings = getActivePlotEditorSettings_ACU();
      const currentSettings = JSON.parse(JSON.stringify(activeSettings || settings_ACU.plotSettings || {}));
      ensurePlotTasksCompat_ACU(currentSettings, { syncLegacy: true });

      delete currentSettings.promptPresets;
      delete currentSettings.lastUsedPresetName;
      delete currentSettings.enabled;

      const promptGroup = getPlotPromptGroupFromSource_ACU(currentSettings);
      const legacyPromptTexts = getLegacyPromptTextsFromPromptGroup_ACU(promptGroup);
      currentSettings.promptGroup = promptGroup;
      currentSettings.finalSystemDirective = $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-final-directive`).val() || '';
      currentSettings.mainPrompt = legacyPromptTexts.mainPrompt || '';
      currentSettings.systemPrompt = legacyPromptTexts.systemPrompt || '';
      currentSettings.rateMain = parseFloat($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-main`).val()) || 1.0;
      currentSettings.ratePersonal = parseFloat($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-personal`).val()) || 1.0;
      currentSettings.rateErotic = parseFloat($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-erotic`).val()) || 0;
      currentSettings.rateCuckold = parseFloat($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-rate-cuckold`).val()) || 1.0;
      currentSettings.recallCount = parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-recall-count`).val(), 10) || 20;
      currentSettings.contextExtractRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-extract-rules`);
      currentSettings.contextExcludeRules = readExcludeRulesFromRows_ACU(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-exclude-rules`);
      currentSettings.contextTurnCount = parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-context-turn-count`).val(), 10) || 3;
      currentSettings.loopSettings = {
        ...(currentSettings.loopSettings || {}),
        quickReplyContent: (() => {
          const prompts = [];
          $popupInstance_ACU.find('.loop-prompt-textarea').each(function() {
            const content = $(this).val()?.trim() || '';
            if (content) prompts.push(content);
          });
          return prompts;
        })(),
        currentPromptIndex: 0,
        loopTags: $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-tags`).val() || '',
        loopDelay: parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-delay`).val(), 10) || 5,
        loopTotalDuration: parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-loop-total-duration`).val(), 10) || 0,
        maxRetries: parseInt($popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-max-retries`).val(), 10) || 3,
      };

      currentSettings.plotTasks = normalizePlotTasks_ACU(currentSettings);
      ensurePlotPromptsArray_ACU(currentSettings);
      setPlotPromptContentByIdForSettings_ACU(currentSettings, 'mainPrompt', currentSettings.mainPrompt || '');
      setPlotPromptContentByIdForSettings_ACU(currentSettings, 'systemPrompt', currentSettings.systemPrompt || '');
      setPlotPromptContentByIdForSettings_ACU(currentSettings, 'finalSystemDirective', currentSettings.finalSystemDirective || '');
      ensurePlotTasksCompat_ACU(currentSettings, { syncLegacy: true });
      currentSettings.finalSystemDirective = getPlotPromptContentByIdFromSettings_ACU(currentSettings, 'finalSystemDirective') || currentSettings.finalSystemDirective || '';

      return currentSettings;
    }

    /**
     * 另存为新的全局预设
     */
    function savePlotPresetAsNew_ACU() {
      const presetName = prompt('请输入新的全局预设名称：');
      const name = String(presetName || '').trim();
      if (!name) return;

      const presets = settings_ACU.plotSettings.promptPresets || [];
      const existingIndex = presets.findIndex(p => p.name === name);

      const currentSettings = getCurrentPlotSettingsFromUI_ACU();
      if (!currentSettings || typeof currentSettings !== 'object') {
        showToastr_ACU('error', '读取当前剧情推进设置失败。');
        return;
      }

      const savedPreset = normalizePlotPresetExcludeRules_ACU({ name, ...currentSettings });
      if (existingIndex !== -1) {
        if (!confirm(`名为 "${name}" 的全局预设已存在。是否要覆盖它？`)) {
          return;
        }
        presets[existingIndex] = savedPreset;
      } else {
        presets.push(savedPreset);
      }

      settings_ACU.plotSettings.promptPresets = presets;
      const currentRuntimePresetName = getCurrentRuntimePlotPresetName_ACU({ fallbackToGlobal: true });
      const currentChatBinding = getPlotPresetBindingForChat_ACU();
      const hasLegacyChatScope = !!getCurrentChatPlotScopeState_ACU();
      const shouldRefreshCurrentChatRuntime =
        normalizePlotPresetSelectionValue_ACU(currentRuntimePresetName) === name ||
        (!currentChatBinding && !hasLegacyChatScope);

      if (shouldRefreshCurrentChatRuntime) {
        applyPlotPresetToSettings_ACU(settings_ACU.plotSettings, savedPreset);
      }

      setCurrentEditablePlotPresetState_ACU(name, {
        scope: 'global',
        source: 'ui_global_save_as_new',
      });
      persistPlotPresetSelectionState_ACU(name, { source: 'ui_global_save_as_new', updateGlobal: true, save: false });
      saveSettings_ACU();

      loadPlotPresetSelect_ACU();
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-preset-select`).val(name);
      $popupInstance_ACU.find(`#${SCRIPT_ID_PREFIX_ACU}-plot-global-delete-preset`).show();

      showToastr_ACU('success', `新全局预设 "${name}" 已保存。`);
    }
  }

  // Removed updateAdvancedHideUIDisplay_ACU function
