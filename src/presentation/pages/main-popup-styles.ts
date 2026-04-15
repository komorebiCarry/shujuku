/**
 * presentation/pages/main-popup-styles.ts
 * 主弹窗样式定义
 * 从 main-popup.ts 拆出的 CSS 模板字符串
 */
import { POPUP_ID_ACU, SCRIPT_ID_PREFIX_ACU } from '../../shared/constants';

export const MAIN_POPUP_CSS_ACU = `
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
`;
