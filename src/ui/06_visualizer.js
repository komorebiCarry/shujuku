  const VISUALIZER_CSS_ACU = `
    /* ═══════════════════════════════════════════════════════════════
       墨韵清雅 - 可视化编辑器
       与主面板保持一致的设计语言
       ═══════════════════════════════════════════════════════════════ */
    
    /* 仅在可视化编辑器内定义主题变量，避免污染页面其它区域 */
    /* 墨纸主题（默认暗色） */
    #acu-visualizer-content {
        --vis-bg-color: #24221f;
        --vis-border-color: #36332e;
        --vis-text-main: #c1b9ad;
        --vis-text-dim: #9e978e;
        --vis-text-mute: #645e55;
        --vis-accent: #7d4940;
        --vis-accent-dim: #8f5a4e;
        --vis-accent-glow: rgba(125, 73, 64, 0.16);
        --vis-bg-hover: #2a2824;
        --vis-bg-stats: #211f1c;
        --vis-bg-light: rgba(193, 185, 173, 0.04);
        
        --vis-font-serif: "Noto Serif SC", "Source Han Serif CN", "Songti SC", "STSong", "SimSun", serif;
        
        background-color: var(--vis-bg-color);
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
        display: flex;
        flex-direction: column;
        font-family: var(--vis-font-serif);
        color: var(--vis-text-main);
    }
    
    /* 素纱主题（浅色） */
    body.acu-theme-silk #acu-visualizer-content {
        --vis-bg-color: #f4f1eb;
        --vis-border-color: #e0dacb;
        --vis-text-main: #4a453f;
        --vis-text-dim: #6e675e;
        --vis-text-mute: #9e978e;
        --vis-accent: #8a6b5e;
        --vis-accent-dim: #9d7c6f;
        --vis-accent-glow: rgba(138, 107, 94, 0.14);
        --vis-bg-hover: #ebe7de;
        --vis-bg-stats: #f9f8f5;
        --vis-bg-light: rgba(255, 255, 255, 0.58);
    }

    /* ✅ 可视化编辑器复选框：古典风格（仅限 #acu-visualizer-content 作用域） */
    #acu-visualizer-content input[type="checkbox"] {
        -webkit-appearance: none;
        appearance: none;
        accent-color: initial;
        width: 16px;
        height: 16px;
        min-width: 16px;
        min-height: 16px;
        border-radius: 1px;
        border: 1px solid var(--vis-border-color);
        background-color: var(--vis-bg-color);
        background-image: none;
        background-repeat: no-repeat;
        background-position: center;
        background-size: 10px 8px;
        margin: 0;
        cursor: pointer;
        vertical-align: middle;
        transition: all 0.2s ease;
    }
    #acu-visualizer-content input[type="checkbox"]::before,
    #acu-visualizer-content input[type="checkbox"]::after {
        content: none;
        display: none;
    }
    #acu-visualizer-content input[type="checkbox"]:checked {
        background-color: var(--vis-accent);
        border-color: var(--vis-accent);
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 10'%3E%3Cpath fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' d='M1 5l3 3 7-7'/%3E%3C/svg%3E");
    }
    #acu-visualizer-content input[type="checkbox"]:disabled {
        opacity: 0.45;
        cursor: not-allowed;
    }
    #acu-visualizer-content input[type="checkbox"]:focus-visible {
        outline: 2px solid var(--vis-accent-glow);
        outline-offset: 2px;
    }
    
    /* ═══ 顶部标题栏 ═══ */
    .acu-vis-header {
        flex: 0 0 56px;
        background: transparent;
        border-bottom: 1px solid var(--vis-border-color);
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 24px;
    }
    
    .acu-vis-title {
        font-family: var(--vis-font-serif);
        font-size: 16px;
        font-weight: normal;
        color: var(--vis-text-main);
        letter-spacing: 3px;
    }
    .acu-vis-title i {
        color: var(--vis-accent);
        margin-right: 12px;
    }
    
    .acu-vis-actions { display: flex; gap: 10px; }
    .acu-vis-content { flex: 1; display: flex; overflow: hidden; }
    
    /* ═══ 侧边栏 ═══ */
    .acu-vis-sidebar {
        flex: 0 0 340px; /* 增大侧边栏宽度以显示更长的表格名 */
        min-width: 280px;
        max-width: 400px;
        background: var(--vis-bg-stats);
        border-right: 1px solid var(--vis-border-color);
        overflow-y: auto;
        padding: 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }
    
    .acu-vis-sidebar::before {
        content: '表格列表';
        display: block;
        font-size: 11px;
        color: var(--vis-text-mute);
        letter-spacing: 2px;
        padding: 8px 12px 16px;
        border-bottom: 1px solid var(--vis-border-color);
        margin-bottom: 8px;
    }
    
    /* ═══ 主内容区 ═══ */
    .acu-vis-main {
        flex: 1;
        background: var(--vis-bg-color);
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
        color: var(--vis-text-main);
        overflow-y: auto;
        padding: 24px;
    }
    
    /* ═══ 表格导航项 ═══ */
    .acu-table-nav-item {
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 2px;
        color: var(--vis-text-dim);
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: flex-start;
        width: 100%; /* 确保导航项占满侧边栏宽度 */
        box-sizing: border-box;
        position: relative;
        padding-left: 20px;
    }
    
    /* 古典竖线装饰 */
    .acu-table-nav-item::before {
        content: '';
        position: absolute;
        left: 8px;
        top: 50%;
        transform: translateY(-50%);
        width: 1px;
        height: 60%;
        background-color: var(--vis-border-color);
        transition: background-color 0.2s ease;
    }
    
    .acu-table-nav-item:hover {
        background: var(--vis-bg-hover);
        color: var(--vis-text-main);
    }
    
    .acu-table-nav-item:hover::before {
        background-color: var(--vis-accent);
    }
    
    .acu-table-nav-item.active {
        background: rgba(125, 73, 64, 0.10);
        color: var(--vis-accent);
    }
    
    .acu-table-nav-item.active::before {
        background-color: var(--vis-accent);
    }
    
    .acu-table-nav-item i { width: 20px; text-align: center; color: var(--vis-text-mute); }
    .acu-table-nav-item.active i { color: var(--vis-accent); }

    .acu-table-nav-content {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 1 1 0; /* 使用 flex-basis: 0 确保能正确伸展填满 */
        min-width: 0; /* 允许 flex 子项收缩 */
        width: 0; /* 配合 flex: 1 确保能正确计算宽度 */
    }
    
    .acu-table-index {
        flex-shrink: 0;
        min-width: 28px;
        text-align: center;
        font-size: 11px;
        opacity: 0.5;
        font-family: var(--vis-font-serif);
        letter-spacing: 1px;
    }
    
    .acu-table-name {
        /* 表格名称：优先完整显示，超长时省略 */
        flex: 1 1 0; /* 使用 flex-basis: 0 确保正确伸展 */
        min-width: 0;
        width: 0; /* 配合 flex 确保能正确计算宽度并省略 */
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        line-height: 1.4;
    }
    
    .acu-table-nav-actions {
        display: flex;
        gap: 2px;
        opacity: 0;
        transition: opacity 0.15s;
        flex-shrink: 0; /* 防止按钮被压缩 */
        margin-left: auto; /* 使用 auto margin 将按钮推到最右边 */
        padding-left: 6px; /* 与内容保持间距 */
    }
    
    .acu-table-nav-item:hover .acu-table-nav-actions {
        opacity: 1;
    }
    
    .acu-table-nav-item.active .acu-table-nav-actions {
        opacity: 0.7; /* 选中项也显示操作按钮 */
    }
    
    .acu-table-order-btn {
        background: transparent;
        border: 1px solid var(--vis-border-color);
        color: var(--vis-text-mute);
        width: 22px;
        height: 22px;
        border-radius: 1px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s;
        font-size: 10px;
    }
    
    .acu-table-order-btn:hover {
        background: rgba(125, 73, 64, 0.12);
        border-color: var(--vis-accent);
        color: var(--vis-accent);
    }
    
    .acu-table-order-btn:disabled {
        opacity: 0.25;
        cursor: not-allowed;
    }

    /* ═══ 按钮 ═══ */
    .acu-btn-primary {
        background: rgba(125, 73, 64, 0.12);
        color: var(--vis-accent);
        border: 1px solid var(--vis-accent);
        padding: 10px 20px;
        border-radius: 1px;
        cursor: pointer;
        font-family: var(--vis-font-serif);
        font-size: 12px;
        letter-spacing: 1px;
        transition: all 0.2s ease;
    }
    .acu-btn-primary:hover {
        background: rgba(125, 73, 64, 0.18);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }

    /* 小按钮样式优化 */
    #acu-visualizer-content .acu-btn-small {
        padding: 6px 12px;
        font-size: 11px;
        min-width: auto;
        height: 32px;
        letter-spacing: 1px;
    }
    
    .acu-btn-secondary {
        background: transparent;
        color: var(--vis-text-dim);
        border: 1px solid var(--vis-border-color);
        padding: 10px 20px;
        border-radius: 1px;
        cursor: pointer;
        font-family: var(--vis-font-serif);
        font-size: 12px;
        letter-spacing: 1px;
        transition: all 0.2s ease;
    }
    .acu-btn-secondary:hover {
        color: var(--vis-text-main);
        border-color: var(--vis-text-mute);
        background: var(--vis-bg-hover);
    }

    /* ═══ 数据卡片 ═══ */
    .acu-card-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-content: flex-start;
    }
    
    .acu-data-card {
        background: var(--vis-bg-light);
        border-radius: 2px;
        box-shadow: none;
        width: 300px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--vis-border-color);
        transition: border-color 0.2s ease;
    }
    
    .acu-data-card:hover {
        border-color: var(--vis-accent);
    }
    
    .acu-card-header {
        padding: 12px 16px;
        background: var(--vis-bg-stats);
        border-bottom: 1px solid var(--vis-border-color);
        font-weight: normal;
        font-size: 13px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        color: var(--vis-text-main);
        letter-spacing: 1px;
    }
    
    .acu-card-body {
        padding: 14px 16px;
        font-size: 13px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        line-height: 1.8;
        color: var(--vis-text-dim);
    }
    
    .acu-field-row { display: flex; flex-direction: column; gap: 4px; }
    
    .acu-field-label {
        font-size: 10px;
        color: var(--vis-text-mute);
        font-weight: normal;
        letter-spacing: 1px;
    }
    
    .acu-field-value {
        padding: 8px 10px;
        border: 1px solid transparent;
        border-radius: 1px;
        min-height: 20px;
        word-break: break-word;
        white-space: pre-wrap;
        background: var(--vis-bg-color);
        transition: all 0.15s ease;
    }
    .acu-field-value:hover {
        background: var(--vis-bg-hover);
        border-color: var(--vis-border-color);
        cursor: text;
    }
    .acu-field-value:focus {
        background: var(--vis-bg-color);
        border-color: var(--vis-accent);
        outline: none;
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }

    /* ═══ 配置面板 ═══ */
    .acu-config-panel {
        background: var(--vis-bg-light);
        padding: 24px;
        border-radius: 2px;
        box-shadow: none;
        max-width: 800px;
        margin: 0 auto;
        border: 1px solid var(--vis-border-color);
    }
    
    .acu-config-section {
        margin-bottom: 24px;
        padding-bottom: 24px;
        border-bottom: 1px solid var(--vis-border-color);
    }
    
    .acu-config-section:last-child {
        border-bottom: none;
        margin-bottom: 0;
        padding-bottom: 0;
    }
    
    .acu-config-section h4 {
        margin: 0 0 16px 0;
        color: var(--vis-text-main);
        font-family: var(--vis-font-serif);
        font-size: 14px;
        font-weight: normal;
        letter-spacing: 2px;
    }
    
    .acu-form-group { margin-bottom: 16px; }
    
    .acu-form-group label {
        display: block;
        margin-bottom: 6px;
        font-weight: normal;
        color: var(--vis-text-dim);
        font-size: 12px;
        letter-spacing: 1px;
    }
    
    .acu-form-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--vis-border-color);
        border-radius: 1px;
        box-sizing: border-box;
        font-family: var(--vis-font-serif);
        font-size: 14px;
        background: var(--vis-bg-color);
        color: var(--vis-text-main);
        transition: border-color 0.15s, box-shadow 0.15s;
    }
    
    .acu-form-input:focus {
        outline: none;
        border-color: var(--vis-accent);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }
    
    .acu-form-textarea {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--vis-border-color);
        border-radius: 1px;
        box-sizing: border-box;
        min-height: 100px;
        resize: vertical;
        font-family: var(--vis-font-serif);
        font-size: 14px;
        background: var(--vis-bg-color);
        color: var(--vis-text-main);
        line-height: 1.8;
    }
    
    .acu-form-textarea:focus {
        outline: none;
        border-color: var(--vis-accent);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }
    
    .acu-hint {
        font-size: 11px;
        color: var(--vis-text-mute);
        margin-top: 4px;
        letter-spacing: 0.5px;
    }
    
    /* ═══ 模式切换 ═══ */
    .acu-mode-switch {
        display: flex;
        background: var(--vis-bg-stats);
        border-radius: 2px;
        padding: 3px;
        margin-right: 12px;
        border: 1px solid var(--vis-border-color);
    }
    
    .acu-mode-btn {
        padding: 6px 16px;
        border-radius: 1px;
        cursor: pointer;
        color: var(--vis-text-mute);
        font-size: 12px;
        font-family: var(--vis-font-serif);
        border: none;
        background: transparent;
        transition: all 0.2s ease;
        letter-spacing: 1px;
    }
    .acu-mode-btn:hover {
        color: var(--vis-text-main);
        background: var(--vis-bg-hover);
    }
    .acu-mode-btn.active {
        background: rgba(125, 73, 64, 0.12);
        color: var(--vis-accent);
    }

    /* ═══ 列编辑器 ═══ */
    .acu-col-list { display: flex; flex-direction: column; gap: 6px; }

    /* ═══ 表格锁定（仅 updateRow 生效） ═══ */
    .acu-lock-btn {
        border: 1px solid var(--vis-border-color);
        background: transparent;
        color: var(--vis-text-mute);
        border-radius: 1px;
        padding: 2px 6px;
        font-size: 11px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;
        font-family: var(--vis-font-serif);
    }
    .acu-lock-btn:hover {
        border-color: var(--vis-accent);
        color: var(--vis-accent);
    }
    .acu-lock-btn.active {
        border-color: var(--vis-accent);
        background: rgba(125, 73, 64, 0.12);
        color: var(--vis-accent);
    }
    .acu-lock-btn.special {
        border-color: var(--vis-accent);
        background: rgba(125, 73, 64, 0.08);
        color: var(--vis-accent-dim);
    }
    .acu-field-value-wrap { display: flex; align-items: center; gap: 6px; }
    .acu-field-value { flex: 1; min-width: 0; }
    .acu-field-row.acu-locked-field .acu-field-value {
        background: rgba(125, 73, 64, 0.06);
        border-color: rgba(125, 73, 64, 0.20);
        opacity: 0.85;
    }
    
    .acu-col-item {
        display: flex;
        gap: 8px;
        align-items: center;
        background: var(--vis-bg-stats);
        padding: 8px 10px;
        border-radius: 1px;
        border: 1px solid var(--vis-border-color);
    }
    
    .acu-col-input {
        flex: 1;
        padding: 8px 10px;
        border: 1px solid var(--vis-border-color);
        border-radius: 1px;
        font-family: var(--vis-font-serif);
        background: var(--vis-bg-color);
        font-size: 13px;
        color: var(--vis-text-main);
        transition: border-color 0.15s ease;
    }
    
    .acu-col-input:focus {
        outline: none;
        border-color: var(--vis-accent);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }
    
    .acu-col-btn {
        padding: 6px 10px;
        cursor: pointer;
        border: 1px solid var(--vis-border-color);
        border-radius: 1px;
        background: transparent;
        color: var(--vis-text-mute);
        transition: all 0.15s ease;
        font-size: 11px;
        font-family: var(--vis-font-serif);
    }
    
    .acu-col-btn:hover {
        background: rgba(125, 73, 64, 0.12);
        border-color: var(--vis-accent);
        color: var(--vis-accent);
    }
    
    /* ═══ 滚动条 ═══ */
    .acu-vis-sidebar::-webkit-scrollbar,
    .acu-vis-main::-webkit-scrollbar {
        width: 4px;
    }
    
    .acu-vis-sidebar::-webkit-scrollbar-track,
    .acu-vis-main::-webkit-scrollbar-track {
        background: transparent;
    }
    
    .acu-vis-sidebar::-webkit-scrollbar-thumb,
    .acu-vis-main::-webkit-scrollbar-thumb {
        background: var(--vis-border-color);
        border-radius: 1px;
    }
    
    .acu-vis-sidebar::-webkit-scrollbar-thumb:hover,
    .acu-vis-main::-webkit-scrollbar-thumb:hover {
        background: var(--vis-text-mute);
    }
    
    /* ═══ 新增表格按钮 ═══ */
    .acu-add-table-btn {
        padding: 10px 12px;
        cursor: pointer;
        border-radius: 1px;
        color: var(--vis-text-mute);
        background: transparent;
        border: 1px dashed var(--vis-border-color);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.2s ease;
        font-family: var(--vis-font-serif);
        font-size: 12px;
        margin-top: 8px;
        letter-spacing: 1px;
    }
    
    .acu-add-table-btn:hover {
        background: var(--vis-bg-hover);
        border-color: var(--vis-accent);
        border-style: solid;
        color: var(--vis-accent);
    }
    
    /* ═══ 删除表格按钮 ═══ */
    .acu-vis-del-table-btn {
        background: transparent;
        border: none;
        color: var(--vis-text-mute);
        opacity: 0.5;
        cursor: pointer;
        padding: 4px;
        transition: all 0.15s ease;
        font-size: 12px;
    }
    
    .acu-vis-del-table-btn:hover {
        opacity: 1;
        color: var(--vis-accent);
    }
    
    /* ═══════════════════════════════════════════════════════════════
       响应式布局 - 可视化编辑器
       ═══════════════════════════════════════════════════════════════ */
    
    /* 宽屏优化 (≥1400px) - 适度增大侧边栏显示更完整的表格名 */
    @media screen and (min-width: 1400px) {
        .acu-vis-sidebar {
            flex: 0 0 320px; /* 从380px拉窄到320px，避免占用过多空间 */
            max-width: 380px;
        }
        
        .acu-table-nav-item {
            padding: 10px 12px;
            width: 100%; /* 确保占满侧边栏宽度 */
        }
        
        .acu-table-name {
            /* 宽屏时允许表格名换行显示 */
            white-space: normal;
            word-break: break-word;
            flex: 1 1 0;
            width: 0;
        }
    }
    
    /* 超宽屏 (≥1800px) */
    @media screen and (min-width: 1800px) {
        .acu-vis-sidebar {
            flex: 0 0 360px; /* 从420px拉窄到360px */
            max-width: 420px;
        }
        
        .acu-table-name {
            font-size: 14px;
        }
    }
    
    /* 平板及以下 (≤768px) */
    @media screen and (max-width: 768px) {
        #acu-visualizer-content {
            font-size: 13px;
        }
        
        /* 顶部栏 */
        .acu-vis-header {
            flex: 0 0 auto;
            min-height: 50px;
            padding: 10px 16px;
            flex-wrap: wrap;
            gap: 10px;
        }
        
        .acu-vis-title {
            font-size: 14px;
            letter-spacing: 2px;
            width: 100%;
            text-align: center;
            order: 1;
        }
        
        .acu-mode-switch {
            order: 2;
            margin-right: 0;
        }
        
        .acu-vis-actions {
            order: 3;
            width: 100%;
            justify-content: center;
        }
        
        /* 内容区域 - 垂直布局 */
        .acu-vis-content {
            flex-direction: column;
        }
        
        /* 侧边栏变为顶部横向滚动 */
        .acu-vis-sidebar {
            flex: 0 0 auto;
            width: 100%;
            /* 关键修复：基础样式里存在 max-width:400px/min-width:280px，
               在移动端会把“顶部横条”宽度卡死，导致右侧出现空白背景区域 */
            max-width: none !important;
            min-width: 0 !important;
            box-sizing: border-box;
            max-height: 120px;
            border-right: none;
            border-bottom: 1px solid var(--vis-border-color);
            flex-direction: row;
            flex-wrap: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            gap: 8px;
            padding: 12px;
            -webkit-overflow-scrolling: touch;
            /* 关键：避免被外部样式“拉开间距”导致中间/右侧出现大块空白 */
            justify-content: flex-start !important;
            align-items: stretch;
        }
        
        .acu-vis-sidebar::before {
            display: none;
        }
        
        .acu-vis-sidebar::-webkit-scrollbar {
            height: 4px;
            width: auto;
        }
        
        /* 表格导航项 - 横向布局 */
        .acu-table-nav-item {
            /* 显式禁用 grow/shrink，保证按内容紧凑排列；超出则横向滚动 */
            flex: 0 0 auto;
            padding: 8px 12px;
            width: auto; /* 横向滚动时宽度由内容决定 */
            min-width: fit-content; /* 确保最小宽度包裹内容 */
            display: inline-flex;
        }
        
        .acu-table-nav-content {
            gap: 6px;
            flex: 0 0 auto; /* 横向滚动时不伸缩，保持内容宽度 */
            width: auto; /* 重置宽度 */
        }
        
        .acu-table-name {
            white-space: nowrap; /* 确保表格名不换行 */
            overflow: visible; /* 窄屏下不截断，完整显示 */
            text-overflow: clip;
            flex: 0 0 auto; /* 不伸缩，宽度由内容决定 */
            width: auto; /* 重置宽度 */
        }
        
        .acu-table-index {
            display: none; /* 隐藏序号 */
        }
        
        .acu-table-nav-actions {
            opacity: 1;
            gap: 2px;
            flex: 0 0 auto; /* 不允许伸缩 */
            /* 强制取消全局的 margin-left:auto（否则会把按钮推到最右，产生巨量空白） */
            margin-left: 6px !important;
            padding-left: 0;
        }
        
        .acu-table-order-btn {
            width: 20px;
            height: 20px;
            font-size: 9px;
        }
        
        /* 新增表格按钮 */
        .acu-add-table-btn {
            flex-shrink: 0;
            padding: 8px 12px;
            margin-top: 0;
        }
        
        /* 主内容区 */
        .acu-vis-main {
            padding: 16px;
        }
        
        /* 数据卡片 */
        .acu-card-grid {
            gap: 12px;
        }
        
        .acu-data-card {
            width: 100%;
            min-width: 0;
        }
        
        .acu-card-header {
            padding: 10px 12px;
            font-size: 13px;
        }
        
        .acu-card-body {
            padding: 10px 12px;
            font-size: 12px;
        }
        
        /* 配置面板 */
        .acu-config-panel {
            padding: 16px;
        }
        
        .acu-config-section {
            margin-bottom: 16px;
            padding-bottom: 16px;
        }
        
        .acu-config-section h4 {
            font-size: 14px;
        }
        
        .acu-form-group {
            margin-bottom: 12px;
        }
        
        .acu-form-input,
        .acu-form-textarea {
            font-size: 14px; /* 防止iOS缩放 */
            padding: 10px;
        }
        
        /* 列编辑器 */
        .acu-col-item {
            flex-wrap: wrap;
            gap: 6px;
        }
        
        .acu-col-input {
            width: 100%;
            flex: none;
        }
        
        /* 按钮 */
        .acu-btn-primary,
        .acu-btn-secondary {
            padding: 10px 16px;
            font-size: 12px;
        }
    }
    
    /* 手机 (≤480px) */
    @media screen and (max-width: 480px) {
        #acu-visualizer-content {
            font-size: 12px;
        }
        
        .acu-vis-header {
            padding: 8px 12px;
        }
        
        .acu-vis-title {
            font-size: 13px;
            letter-spacing: 1px;
        }
        
        .acu-vis-title i {
            display: none;
        }
        
        .acu-mode-switch {
            padding: 2px;
        }
        
        .acu-mode-btn {
            padding: 5px 10px;
            font-size: 11px;
        }
        
        .acu-btn-primary,
        .acu-btn-secondary {
            padding: 8px 12px;
            font-size: 11px;
        }
        
        .acu-vis-sidebar {
            max-height: 100px;
            padding: 8px;
            gap: 6px;
        }
        
        .acu-table-nav-item {
            padding: 6px 10px;
            font-size: 11px;
            width: auto; /* 横向滚动时宽度由内容决定 */
            min-width: fit-content;
            flex: 0 0 auto;
            display: inline-flex;
        }
        
        .acu-table-name {
            white-space: nowrap;
            overflow: visible;
            text-overflow: clip;
            width: auto;
        }
        
        .acu-table-order-btn {
            width: 18px;
            height: 18px;
        }
        
        .acu-vis-main {
            padding: 12px;
        }
        
        .acu-data-card {
            border-radius: 3px;
        }
        
        .acu-card-header {
            padding: 8px 10px;
            font-size: 12px;
        }
        
        .acu-card-body {
            padding: 8px 10px;
            gap: 8px;
        }
        
        .acu-field-label {
            font-size: 9px;
        }
        
        .acu-field-value {
            padding: 5px 6px;
            font-size: 12px;
            min-height: 16px;
        }
        
        .acu-config-panel {
            padding: 12px;
            border-radius: 3px;
        }
        
        .acu-config-section h4 {
            font-size: 13px;
            margin-bottom: 12px;
        }
        
        .acu-form-group label {
            font-size: 11px;
        }
        
        .acu-hint {
            font-size: 10px;
        }
        
        .acu-col-item {
            padding: 6px 8px;
        }
        
        .acu-col-input {
            padding: 6px 8px;
            font-size: 13px;
        }
        
        .acu-col-btn {
            padding: 5px 8px;
            font-size: 11px;
        }
    }
    
    /* 超小屏幕 (≤360px) */
    @media screen and (max-width: 360px) {
        #acu-visualizer-content {
            font-size: 11px;
        }
        
        .acu-vis-header {
            padding: 4px 8px;
            min-height: 40px;
            gap: 6px;
        }
        
        .acu-vis-title {
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        
        .acu-mode-switch {
            padding: 1px;
        }
        
        .acu-mode-btn {
            padding: 4px 8px;
            font-size: 10px;
        }
        
        .acu-vis-actions {
            gap: 4px;
        }
        
        .acu-btn-primary,
        .acu-btn-secondary {
            padding: 5px 8px;
            font-size: 10px;
        }
        
        .acu-vis-sidebar {
            max-height: 75px;
            padding: 4px;
            gap: 4px;
        }
        
        .acu-table-nav-item {
            padding: 4px 6px;
            font-size: 10px;
        }
        
        .acu-table-order-btn {
            width: 16px;
            height: 16px;
            font-size: 8px;
        }
        
        .acu-add-table-btn {
            padding: 4px 8px;
            font-size: 10px;
        }
        
        .acu-vis-main {
            padding: 8px;
        }
        
        .acu-card-grid {
            gap: 8px;
        }
        
        .acu-data-card {
            border-radius: 4px;
        }
        
        .acu-card-header {
            padding: 6px 8px;
            font-size: 11px;
        }
        
        .acu-card-body {
            padding: 6px 8px;
            gap: 6px;
        }
        
        .acu-field-label {
            font-size: 8px;
        }
        
        .acu-field-value {
            padding: 4px 5px;
            font-size: 11px;
            min-height: 14px;
        }
        
        .acu-config-panel {
            padding: 8px;
            border-radius: 4px;
        }
        
        .acu-config-section {
            margin-bottom: 12px;
            padding-bottom: 12px;
        }
        
        .acu-config-section h4 {
            font-size: 12px;
            margin-bottom: 10px;
        }
        
        .acu-form-group {
            margin-bottom: 10px;
        }
        
        .acu-form-group label {
            font-size: 10px;
        }
        
        .acu-form-input,
        .acu-form-textarea {
            padding: 8px;
            font-size: 14px; /* 防止iOS缩放 */
        }
        
        .acu-hint {
            font-size: 9px;
        }
        
        .acu-col-item {
            padding: 5px 6px;
        }
        
        .acu-col-input {
            padding: 5px 6px;
            font-size: 12px;
        }
        
        .acu-col-btn {
            padding: 4px 6px;
            font-size: 10px;
        }
    }
    
    /* 超极小屏幕 (≤320px) */
    @media screen and (max-width: 320px) {
        #acu-visualizer-content {
            font-size: 10px;
        }
        
        .acu-vis-header {
            padding: 3px 6px;
            min-height: 36px;
        }
        
        .acu-vis-title {
            font-size: 10px;
        }
        
        .acu-mode-btn {
            padding: 3px 6px;
            font-size: 9px;
        }
        
        .acu-btn-primary,
        .acu-btn-secondary {
            padding: 4px 6px;
            font-size: 9px;
        }
        
        .acu-vis-sidebar {
            max-height: 65px;
            padding: 3px;
        }
        
        .acu-table-nav-item {
            padding: 3px 5px;
            font-size: 9px;
        }
        
        .acu-vis-main {
            padding: 6px;
        }
        
        .acu-card-header {
            padding: 5px 6px;
            font-size: 10px;
        }
        
        .acu-card-body {
            padding: 5px 6px;
        }
        
        .acu-config-panel {
            padding: 6px;
        }
        
        .acu-config-section h4 {
            font-size: 11px;
        }
    }

    /* ═══════════════════════════════════════════════════════════════
       古典中国风覆盖（修正深色主题下的一致性）
       仅影响 #acu-visualizer-content 内部
       ═══════════════════════════════════════════════════════════════ */

    #acu-visualizer-content .acu-vis-main {
        background: var(--vis-bg-color);
        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
        color: var(--vis-text-main);
    }

    #acu-visualizer-content .acu-data-card,
    #acu-visualizer-content .acu-config-panel {
        background: var(--vis-bg-light);
        border: 1px solid var(--vis-border-color);
        border-radius: 2px;
        box-shadow: none;
    }

    #acu-visualizer-content .acu-card-header {
        background: var(--vis-bg-stats);
        color: var(--vis-text-main);
        border-bottom: 1px solid var(--vis-border-color);
        font-weight: normal;
    }

    #acu-visualizer-content .acu-card-body { color: var(--vis-text-dim); }
    #acu-visualizer-content .acu-field-label { color: var(--vis-text-mute); }

    #acu-visualizer-content .acu-field-value {
        background: var(--vis-bg-color);
        border: 1px solid var(--vis-border-color);
        color: var(--vis-text-main);
    }
    #acu-visualizer-content .acu-field-value:hover {
        background: var(--vis-bg-hover);
        border-color: var(--vis-accent);
    }
    #acu-visualizer-content .acu-field-value:focus {
        background: var(--vis-bg-color);
        border-color: var(--vis-accent);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }

    #acu-visualizer-content .acu-config-section h4 { color: var(--vis-text-main); }
    #acu-visualizer-content .acu-form-group label { color: var(--vis-text-dim); }

    #acu-visualizer-content .acu-form-input,
    #acu-visualizer-content .acu-form-textarea,
    #acu-visualizer-content .acu-col-input {
        background: var(--vis-bg-color);
        border: 1px solid var(--vis-border-color);
        color: var(--vis-text-main);
    }
    #acu-visualizer-content .acu-form-input:focus,
    #acu-visualizer-content .acu-form-textarea:focus,
    #acu-visualizer-content .acu-col-input:focus {
        border-color: var(--vis-accent);
        box-shadow: 0 0 0 2px var(--vis-accent-glow);
    }

    #acu-visualizer-content .acu-col-item {
        background: var(--vis-bg-stats);
        border: 1px solid var(--vis-border-color);
    }

    /* "添加新行"卡片：古典风格 */
    #acu-visualizer-content #acu-vis-add-row {
        background: rgba(125, 73, 64, 0.08) !important;
        border-color: var(--vis-accent) !important;
        border-radius: 2px;
    }
    #acu-visualizer-content #acu-vis-add-row i,
    #acu-visualizer-content #acu-vis-add-row div {
        color: var(--vis-accent) !important;
    }
  `;

  // Internal state for visualizer
  let _acuVisState = {
      currentSheetKey: null,
      mode: 'data', // 'data' or 'config'
      tempData: null, // Deep copy of currentJsonTableData_ACU
      deletedSheetKeys: [] // 在可视化编辑器中删除的表格key列表（保存时追溯全聊天记录做彻底清理）
  };

  // [核心重构] 定义全局刷新函数，确保无论何时调用都能从本地数据（聊天记录）中获取最新数据并刷新UI
  window.ACU_Visualizer_Refresh = async function() {
      if (!jQuery_API_ACU('#acu-visualizer-content').length && !ACU_WindowManager.isOpen(`${SCRIPT_ID_PREFIX_ACU}-visualizer-window`)) return;
      
      // 1. 尝试从聊天记录重新构建完整数据
      logDebug_ACU('Visualizer: Forcing data refresh directly from chat history (Global Function)...');
      
      // 确保消息列表是最新的
      await loadAllChatMessages_ACU(); 
      
      // 使用合并逻辑从聊天记录提取最新数据
      const freshData = await mergeAllIndependentTables_ACU();
      
      if (!freshData) {
          logWarn_ACU('Visualizer refresh: Failed to merge data from chat history.');
          // 如果失败，回退到使用当前内存数据（如果存在）
          if (currentJsonTableData_ACU) {
              _acuVisState.tempData = JSON.parse(JSON.stringify(currentJsonTableData_ACU));
          } else {
              return;
          }
      } else {
          // 如果成功，更新内存数据和编辑器数据
          const stableKeys = getSortedSheetKeys_ACU(freshData);
          currentJsonTableData_ACU = reorderDataBySheetKeys_ACU(freshData, stableKeys);
          _acuVisState.tempData = JSON.parse(JSON.stringify(currentJsonTableData_ACU));
      }
      
      // 2. Validate current sheet key
      if (_acuVisState.currentSheetKey && !_acuVisState.tempData[_acuVisState.currentSheetKey]) {
          const keys = getSortedSheetKeys_ACU(_acuVisState.tempData);
          _acuVisState.currentSheetKey = keys.length > 0 ? keys[0] : null;
      } else if (!_acuVisState.currentSheetKey) {
          const keys = getSortedSheetKeys_ACU(_acuVisState.tempData);
          _acuVisState.currentSheetKey = keys.length > 0 ? keys[0] : null;
      }
      
      // 3. Re-render
      renderVisualizerSidebar_ACU();
      renderVisualizerMain_ACU();
      updateVisualizerTemplatePresetIndicator_ACU();
      
      logDebug_ACU('Visualizer: Data refresh completed.');
  };

  function updateVisualizerTemplatePresetIndicator_ACU() {
      const $indicator = jQuery_API_ACU('#acu-vis-template-preset-indicator');
      if (!$indicator.length) return;
      const activeTemplateMeta_ACU = getActiveTemplatePresetMeta_ACU();
      $indicator.text(`当前生效模板预设：${activeTemplateMeta_ACU.displayName}（${activeTemplateMeta_ACU.scopeLabel}）`);
  }

  function openNewVisualizer_ACU() {
      if (!currentJsonTableData_ACU) {
          showToastr_ACU('warning', '数据未加载，请先进行一次对话或初始化。');
          return;
      }

      // Initial Load
      _acuVisState.tempData = JSON.parse(JSON.stringify(currentJsonTableData_ACU));
      _acuVisState.currentSheetKey = getSortedSheetKeys_ACU(_acuVisState.tempData)[0] || null; // Default to first sheet
      const activeTemplateMeta_ACU = getActiveTemplatePresetMeta_ACU();
      const activeTemplatePresetText_ACU = `当前生效模板预设：${activeTemplateMeta_ACU.displayName}（${activeTemplateMeta_ACU.scopeLabel}）`;
      
      // 构建可视化编辑器内容（不含外层容器，由独立窗口系统提供）
      const visualizerContent = `
          <div id="acu-visualizer-content" style="display: flex; flex-direction: column; height: 100%;">
              <style>${VISUALIZER_CSS_ACU}</style>
              <div class="acu-vis-toolbar" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 20px; background: transparent; border-bottom: 1px solid var(--vis-border-color); flex-shrink: 0;">
                  <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                      <span class="seal" style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border: 1px solid var(--vis-accent); color: var(--vis-accent); font-size: 12px; border-radius: 1px; opacity: 0.85; letter-spacing: 1px;">墨</span>
                      <div style="display: flex; flex-direction: column; gap: 6px;">
                          <div class="acu-mode-switch">
                              <button class="acu-mode-btn active" data-mode="data">数据编辑</button>
                              <button class="acu-mode-btn" data-mode="config">结构/参数配置</button>
                              <button class="acu-mode-btn" data-mode="globalConfig">全局注入配置</button>
                          </div>
                          <div id="acu-vis-template-preset-indicator" class="acu-hint" style="font-size: 12px; color: var(--vis-text-mute);">${escapeHtml_ACU(activeTemplatePresetText_ACU)}</div>
                      </div>
                  </div>
                  <div class="acu-vis-actions" style="display: flex; gap: 10px;">
                      <button id="acu-vis-theme-btn" class="acu-btn-secondary acu-vis-theme-btn" title="切换主题"><span class="acu-theme-toggle-text">素纱</span></button>
                      <button id="acu-vis-save-btn" class="acu-btn-primary"><i class="fa-solid fa-save"></i> 保存到当前聊天</button>
                      <button id="acu-vis-save-template-btn" class="acu-btn-secondary"><i class="fa-solid fa-save"></i> 保存到全局</button>
                  </div>
              </div>
              <div class="acu-vis-content" style="flex: 1; display: flex; overflow: hidden;">
                  <div class="acu-vis-sidebar" id="acu-vis-sidebar-list"></div>
                  <div class="acu-vis-main" id="acu-vis-main-area"></div>
              </div>
          </div>
      `;
      
      const windowId = `${SCRIPT_ID_PREFIX_ACU}-visualizer-window`;
      
      // 如果窗口已存在，先移除
      closeACUWindow(windowId);
      
      // 创建独立窗口
      createACUWindow({
          id: windowId,
          title: '数据库编辑器',
          content: visualizerContent,
          width: 1400,  // 基础宽度
          height: 900,  // 基础高度
          modal: false,
          resizable: true,
          maximizable: true,
          startMaximized: false, // 由 rememberState 自动管理，首次打开时不全屏
          onClose: () => {
              if (!confirm('确定要关闭吗？未保存的修改将丢失。')) {
                  return false; // 阻止关闭（注意：当前实现会立即关闭，后续可优化）
              }
          },
          onReady: ($window) => {
              // 绑定事件
              $window.find('#acu-vis-save-btn').on('click', async () => {
                  await saveVisualizerChanges_ACU(false);
              });

              $window.find('#acu-vis-save-template-btn').on('click', async () => {
                  await saveVisualizerChanges_ACU(true);
              });

              $window.find('.acu-mode-btn').on('click', function() {
                  $window.find('.acu-mode-btn').removeClass('active');
                  jQuery_API_ACU(this).addClass('active');
                  _acuVisState.mode = jQuery_API_ACU(this).data('mode');
                  renderVisualizerMain_ACU();
              });

              // 主题切换按钮绑定
              $window.find('#acu-vis-theme-btn').on('click', function(e) {
                  e.preventDefault();
                  e.stopPropagation();
                  const nextTheme = toggleACUTheme_ACU();
                  const nextLabel = nextTheme === 'silk' ? '墨纸' : '素纱';
                  $window.find('#acu-vis-theme-btn .acu-theme-toggle-text').text(nextLabel);
              });

              // [核心重构] 绑定事件以支持旧的触发方式，但实际逻辑委托给全局函数
              jQuery_API_ACU(document).off('acu-visualizer-refresh-data');
              jQuery_API_ACU(document).on('acu-visualizer-refresh-data', () => {
                  if (typeof window.ACU_Visualizer_Refresh === 'function') {
                      window.ACU_Visualizer_Refresh();
                  }
              });

              renderVisualizerSidebar_ACU();
              renderVisualizerMain_ACU();
              updateVisualizerTemplatePresetIndicator_ACU();
          }
      });
  }

  // [新增] 表格顺序管理 - 存储有序的表格键列表
  function getOrderedSheetKeys_ACU() {
      // 新机制：顺序由每张表的 orderNo 决定；编辑器内部仍保留一个数组用于“上移/下移”
      //
      // 重要：getSortedSheetKeys_ACU() 在“聊天已存在空白指导表(guide)”时，默认会按 guide 排序并且
      // 过滤掉不在 guide 里的表。可视化编辑器允许用户新增表格，因此这里必须把“当前数据里存在但 guide
      // 里不存在”的新表追加进顺序列表，否则新增表会立刻被过滤掉，进而导致“UI不显示/保存后丢失”。

      // allKeys：忽略聊天 guide，拿到 tempData 里真实存在的全部表（含刚新增的表）
      const allKeys = getSortedSheetKeys_ACU(_acuVisState.tempData, { ignoreChatGuide: true });
      // guidedKeys：若 guide 存在，则为 guide 内已存在且在 tempData 中也存在的表（用于保持既有聊天顺序）
      const guidedKeys = getSortedSheetKeys_ACU(_acuVisState.tempData, { ignoreChatGuide: false });
      const baseOrder = (() => {
          // guidedKeys 可能为空（无 guide 或 guide 读取失败），此时用 allKeys 作为基准
          const base = (Array.isArray(guidedKeys) && guidedKeys.length) ? guidedKeys : allKeys;
          // 追加不在 guide 里的新表，确保新增表可见且可保存
          const missing = allKeys.filter(k => !base.includes(k));
          return [...base, ...missing];
      })();

      if (!_acuVisState.sheetOrder || !Array.isArray(_acuVisState.sheetOrder)) {
          _acuVisState.sheetOrder = baseOrder;
      }

      // 确保顺序列表包含所有当前存在的表格，并移除已删除的表格
      // existingKeys 使用 orderNo 排序（已对缺失编号做兜底补齐）
      const existingKeys = allKeys;
      // 过滤掉已删除的
      _acuVisState.sheetOrder = _acuVisState.sheetOrder.filter(k => existingKeys.includes(k));
      // 添加新增的（未在顺序列表中的）
      existingKeys.forEach(k => {
          if (!_acuVisState.sheetOrder.includes(k)) {
              _acuVisState.sheetOrder.push(k);
          }
      });
      // [新增] 强制去重，防止逻辑错误导致 key 重复
      _acuVisState.sheetOrder = [...new Set(_acuVisState.sheetOrder)];

      // 同步更新 tempData 内每张表的 orderNo（保证“移动顺序即更新编号”）
      applySheetOrderNumbers_ACU(_acuVisState.tempData, _acuVisState.sheetOrder);
      return _acuVisState.sheetOrder;
  }

  // [新增] 移动表格顺序
  function moveSheetOrder_ACU(key, direction) {
      const order = getOrderedSheetKeys_ACU();
      const currentIndex = order.indexOf(key);
      if (currentIndex === -1) return;
      
      const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex < 0 || newIndex >= order.length) return;
      
      // 交换位置
      [order[currentIndex], order[newIndex]] = [order[newIndex], order[currentIndex]];
      _acuVisState.sheetOrder = order;

      // [新机制] 移动后立即重编号（编号随调整顺序变化）
      applySheetOrderNumbers_ACU(_acuVisState.tempData, _acuVisState.sheetOrder);
      
      renderVisualizerSidebar_ACU();
  }

  function renderVisualizerSidebar_ACU() {
      const $list = jQuery_API_ACU('#acu-vis-sidebar-list');
      $list.empty();
      
      const sheetKeys = getOrderedSheetKeys_ACU();
      const totalSheets = sheetKeys.length;
      
      sheetKeys.forEach((key, index) => {
          const sheet = _acuVisState.tempData[key];
          if (!sheet) return;
          
          const isActive = key === _acuVisState.currentSheetKey;
          const isFirst = index === 0;
          const isLast = index === totalSheets - 1;
          
          const $item = jQuery_API_ACU(`
              <div class="acu-table-nav-item ${isActive ? 'active' : ''}" data-key="${key}">
                  <div class="acu-table-nav-content">
                      <span class="acu-table-index">[${index}]</span>
                      <i class="fa-solid fa-table"></i>
                      <span class="acu-table-name" title="${escapeHtml_ACU(sheet.name)}">${escapeHtml_ACU(sheet.name)}</span>
                  </div>
                  <div class="acu-table-nav-actions">
                      <button class="acu-table-order-btn acu-move-up-btn" data-key="${key}" title="上移" ${isFirst ? 'disabled' : ''}>
                          <i class="fa-solid fa-chevron-up"></i>
                      </button>
                      <button class="acu-table-order-btn acu-move-down-btn" data-key="${key}" title="下移" ${isLast ? 'disabled' : ''}>
                          <i class="fa-solid fa-chevron-down"></i>
                      </button>
                      <button class="acu-vis-del-table-btn" data-key="${key}" title="删除表格">
                      <i class="fa-solid fa-trash"></i>
                  </button>
                  </div>
              </div>
          `);
          
          // 点击选中表格
          $item.on('click', function(e) {
              if (jQuery_API_ACU(e.target).closest('.acu-table-order-btn, .acu-vis-del-table-btn').length) return;
              _acuVisState.currentSheetKey = key;
              renderVisualizerSidebar_ACU();
              renderVisualizerMain_ACU();
          });

          // 上移按钮
          $item.find('.acu-move-up-btn').on('click', function(e) {
              e.stopPropagation();
              moveSheetOrder_ACU(key, 'up');
          });

          // 下移按钮
          $item.find('.acu-move-down-btn').on('click', function(e) {
              e.stopPropagation();
              moveSheetOrder_ACU(key, 'down');
          });

          // 删除按钮
          $item.find('.acu-vis-del-table-btn').on('click', function(e) {
              e.stopPropagation();
              const keyToDelete = jQuery_API_ACU(this).data('key');
              const tableName = _acuVisState.tempData[keyToDelete] ? _acuVisState.tempData[keyToDelete].name : '未知';
              if (confirm(`确定要删除表格 "${tableName}" 吗？此操作不可撤销。\n\n注意：删除后保存，该表格的数据和模板配置都将被移除。`)) {
                  // 记录删除队列：保存时会追溯整个聊天记录清除所有本地表格数据
                  if (!_acuVisState.deletedSheetKeys || !Array.isArray(_acuVisState.deletedSheetKeys)) {
                      _acuVisState.deletedSheetKeys = [];
                  }
                  if (keyToDelete && !_acuVisState.deletedSheetKeys.includes(keyToDelete)) {
                      _acuVisState.deletedSheetKeys.push(keyToDelete);
                  }
                  delete _acuVisState.tempData[keyToDelete];
                  // 从顺序列表中移除
                  _acuVisState.sheetOrder = _acuVisState.sheetOrder.filter(k => k !== keyToDelete);
                  if (_acuVisState.currentSheetKey === keyToDelete) {
                      const remainingKeys = getOrderedSheetKeys_ACU();
                      _acuVisState.currentSheetKey = remainingKeys.length > 0 ? remainingKeys[0] : null;
                  }
                  renderVisualizerSidebar_ACU();
                  renderVisualizerMain_ACU();
              }
          });

          $list.append($item);
      });
      
      // 新增表格按钮
      const $addBtn = jQuery_API_ACU(`
          <button class="acu-add-table-btn">
              <i class="fa-solid fa-plus"></i> 新增表格
          </button>
      `);

      $addBtn.on('click', function() {
          const newName = prompt("请输入新表格的名称:", "新建表格");
          if (newName) {
              const newKey = 'sheet_' + Math.random().toString(36).substr(2, 9);
              _acuVisState.tempData[newKey] = {
                  uid: newKey,
                  name: newName,
                  domain: "chat", type: "dynamic", enable: true, required: false,
                  content: [[null, "列1", "列2"]],
                  sourceData: { note: "新表格说明", initNode: "", insertNode: "", updateNode: "", deleteNode: "" },
                  // -1 = 沿用UI全局（新版默认）；updateFrequency=0 可用于"禁用该表自动更新"；groupId=-1 视为默认同组
                  updateConfig: { uiSentinel: -1, contextDepth: -1, updateFrequency: -1, batchSize: -1, skipFloors: -1, sendLatestRows: -1, groupId: -1 },
                  exportConfig: buildDefaultExportConfig_ACU(newName),
                  [TABLE_ORDER_FIELD_ACU]: 999999 // 临时占位，稍后会被 getOrderedSheetKeys_ACU / applySheetOrderNumbers_ACU 重编号
              };
              // 添加到顺序列表末尾 (getOrderedSheetKeys_ACU 会自动同步新增的 key，无需手动 push)
              getOrderedSheetKeys_ACU();
              _acuVisState.currentSheetKey = newKey;
              renderVisualizerSidebar_ACU();
              renderVisualizerMain_ACU();
          }
      });

      $list.append($addBtn);
  }

  function renderVisualizerMain_ACU() {
      const $main = jQuery_API_ACU('#acu-vis-main-area');
      $main.empty();

      if (_acuVisState.mode === 'globalConfig') {
          renderVisualizerGlobalConfigMode_ACU($main);
          return;
      }
      
      if (!_acuVisState.currentSheetKey) {
          $main.html('<div style="text-align:center; padding:50px; color:#888;">请选择一个表格</div>');
          return;
      }
      
      const sheet = _acuVisState.tempData[_acuVisState.currentSheetKey];
      if (!sheet) return;

      if (_acuVisState.mode === 'data') {
          renderVisualizerDataMode_ACU($main, sheet);
      } else {
          renderVisualizerConfigMode_ACU($main, sheet);
      }
  }

  function renderVisualizerGlobalConfigMode_ACU($container) {
      const cfg = getGlobalInjectionConfigFromData_ACU(_acuVisState.tempData, { ensureWriteBack: true });
      const readablePlacement = normalizePlacementConfig_ACU(cfg.readableEntryPlacement, buildDefaultGlobalInjectionConfig_ACU().readableEntryPlacement);
      const wrapperPlacement = normalizePlacementConfig_ACU(cfg.wrapperPlacement, buildDefaultGlobalInjectionConfig_ACU().wrapperPlacement);

      const html = `
          <div class="acu-config-panel">
              <div class="acu-config-section">
                  <h4>全局条目注入配置（跨表）</h4>
                  <div class="acu-hint" style="margin-bottom:10px;">该配置独立于单表，跟随当前模板预设保存。</div>
                  <div class="acu-form-group">
                      <label>全局可读条目位置:</label>
                      <select class="acu-form-input" id="cfg-global-readable-position">
                          <option value="at_depth_as_system" ${readablePlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                          <option value="before_character_definition" ${readablePlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                          <option value="after_character_definition" ${readablePlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                      </select>
                  </div>
                  <div class="acu-form-group">
                      <label>全局可读条目插入深度 (Depth):</label>
                      <input type="number" class="acu-form-input" id="cfg-global-readable-depth" step="1" value="${readablePlacement.depth}">
                  </div>
                  <div class="acu-form-group">
                      <label>全局可读条目插入顺序 (Order):</label>
                      <input type="number" class="acu-form-input" id="cfg-global-readable-order" min="1" step="1" value="${readablePlacement.order}">
                  </div>

                  <div class="acu-form-group" style="margin-top:12px; padding-top:10px; border-top:1px dashed #ddd;">
                      <label>全局包裹条目位置:</label>
                      <select class="acu-form-input" id="cfg-global-wrapper-position">
                          <option value="at_depth_as_system" ${wrapperPlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                          <option value="before_character_definition" ${wrapperPlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                          <option value="after_character_definition" ${wrapperPlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                      </select>
                  </div>
                  <div class="acu-form-group">
                      <label>全局包裹条目插入深度 (Depth):</label>
                      <input type="number" class="acu-form-input" id="cfg-global-wrapper-depth" step="1" value="${wrapperPlacement.depth}">
                  </div>
                  <div class="acu-form-group">
                      <label>全局包裹条目插入顺序 (Order):</label>
                      <input type="number" class="acu-form-input" id="cfg-global-wrapper-order" min="1" step="1" value="${wrapperPlacement.order}">
                  </div>
              </div>
          </div>
      `;
      $container.html(html);

      const parseIntOrDefault_ACU = (val, defVal) => {
          const n = parseInt(val, 10);
          return Number.isFinite(n) ? n : defVal;
      };
      const readPlacementFromInputs_ACU = (prefix, fallbackPlacement) => {
          const position = normalizeLorebookPosition_ACU(jQuery_API_ACU(`#${prefix}-position`).val(), fallbackPlacement.position);
          const depth = parseIntOrDefault_ACU(jQuery_API_ACU(`#${prefix}-depth`).val(), fallbackPlacement.depth);
          const order = parseIntOrDefault_ACU(jQuery_API_ACU(`#${prefix}-order`).val(), fallbackPlacement.order);
          return normalizePlacementConfig_ACU({ position, depth, order }, fallbackPlacement);
      };

      const syncGlobalInjectionConfigFromUi_ACU = () => {
          const nextCfg = getGlobalInjectionConfigFromData_ACU(_acuVisState.tempData, { ensureWriteBack: true });
          nextCfg.readableEntryPlacement = readPlacementFromInputs_ACU('cfg-global-readable', buildDefaultGlobalInjectionConfig_ACU().readableEntryPlacement);
          nextCfg.wrapperPlacement = readPlacementFromInputs_ACU('cfg-global-wrapper', buildDefaultGlobalInjectionConfig_ACU().wrapperPlacement);
          _acuVisState.tempData.mate.globalInjectionConfig = nextCfg;
      };

      jQuery_API_ACU('#cfg-global-readable-position, #cfg-global-readable-depth, #cfg-global-readable-order').on('input change', function() {
          syncGlobalInjectionConfigFromUi_ACU();
      });
      jQuery_API_ACU('#cfg-global-wrapper-position, #cfg-global-wrapper-depth, #cfg-global-wrapper-order').on('input change', function() {
          syncGlobalInjectionConfigFromUi_ACU();
      });
  }

  function renderVisualizerDataMode_ACU($container, sheet) {
      // Headers
      const headers = sheet.content[0] || [];
      const dataHeaders = headers.slice(1);
      const rows = sheet.content.slice(1);
      const sheetKey = _acuVisState.currentSheetKey;
      const lockState = sheetKey ? getTableLocksForSheet_ACU(sheetKey) : { rows: new Set(), cols: new Set(), cells: new Set() };
      const isSummaryTable = isSummaryOrOutlineTable_ACU(sheet.name);
      const specialIndexCol = (isSummaryTable ? getSummaryIndexColumnIndex_ACU(sheet) : -1);
      const specialIndexLocked = (isSummaryTable && sheetKey) ? isSpecialIndexLockEnabled_ACU(sheetKey) : false;
      
      let html = `<div class="acu-card-grid">`;
      
      // Add "Add Row" card
      html += `
          <div class="acu-data-card" style="justify-content:center; align-items:center; cursor:pointer; background:#f0f6ff; border:2px dashed #4a90e2;" id="acu-vis-add-row">
              <i class="fa-solid fa-plus" style="font-size:30px; color:#4a90e2;"></i>
              <div style="margin-top:10px; color:#4a90e2; font-weight:bold;">添加新行</div>
          </div>
      `;

      rows.forEach((row, rIdx) => {
          const rowLocked = lockState.rows.has(rIdx);
          html += `<div class="acu-data-card">
                      <div class="acu-card-header">
                          <span>#${rIdx + 1}</span>
                          <div style="display:flex; align-items:center; gap:8px;">
                              <button class="acu-lock-btn acu-vis-lock-row ${rowLocked ? 'active' : ''}" data-idx="${rIdx}" title="锁定行（仅update）">
                                  <i class="fa-solid ${rowLocked ? 'fa-lock' : 'fa-unlock'}"></i>
                              </button>
                              <button class="acu-vis-del-row" data-idx="${rIdx}" style="background:none; border:none; color:#e95e5e; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                          </div>
                      </div>
                      <div class="acu-card-body">`;
          
          // Render fields (Skip index 0 usually internal ID or null)
          dataHeaders.forEach((header, colIdx) => {
              const val = row[colIdx + 1] || '';
              const colLocked = lockState.cols.has(colIdx);
              const cellLocked = lockState.cells.has(`${rIdx}:${colIdx}`);
              const isSpecialIndex = (isSummaryTable && colIdx === specialIndexCol);
              const lockedClass = (rowLocked || colLocked || cellLocked || (isSpecialIndex && specialIndexLocked)) ? 'acu-locked-field' : '';
              const colLockButton = isSpecialIndex
                  ? `<button class="acu-lock-btn special acu-vis-lock-special ${specialIndexLocked ? 'active' : ''}" data-col="${colIdx}" title="编码索引列特殊锁定">
                         <i class="fa-solid ${specialIndexLocked ? 'fa-lock' : 'fa-unlock'}"></i>
                         <span>特锁</span>
                     </button>`
                  : `<button class="acu-lock-btn acu-vis-lock-col ${colLocked ? 'active' : ''}" data-col="${colIdx}" title="锁定列（仅update）">
                         <i class="fa-solid ${colLocked ? 'fa-lock' : 'fa-unlock'}"></i>
                     </button>`;
              const cellLockButton = isSpecialIndex
                  ? ''
                  : `<button class="acu-lock-btn acu-vis-lock-cell ${cellLocked ? 'active' : ''}" data-row="${rIdx}" data-col="${colIdx}" title="锁定单元格（仅update）">
                         <i class="fa-solid ${cellLocked ? 'fa-lock' : 'fa-unlock'}"></i>
                     </button>`;
              html += `
                  <div class="acu-field-row ${lockedClass}">
                      <div class="acu-field-label" style="display:flex; align-items:center; justify-content:space-between; gap:8px;">
                          <span>${escapeHtml_ACU(header)}</span>
                          ${colLockButton}
                      </div>
                      <div class="acu-field-value-wrap">
                          <div class="acu-field-value" contenteditable="true" data-row="${rIdx}" data-col="${colIdx}">${escapeHtml_ACU(String(val))}</div>
                          ${cellLockButton}
                      </div>
                  </div>
              `;
          });
          
          html += `</div></div>`;
      });
      
      html += `</div>`;
      $container.html(html);
      
      // Bind Data Events
      $container.find('.acu-field-value').on('input', function() {
          const rIdx = parseInt(jQuery_API_ACU(this).data('row'));
          const cIdx = parseInt(jQuery_API_ACU(this).data('col'));
          const val = jQuery_API_ACU(this).text(); // Use text() to avoid HTML injection
          
          // Update temp data (rIdx + 1 because row 0 is header)
          if (sheet.content[rIdx + 1]) {
              sheet.content[rIdx + 1][cIdx + 1] = val;
          }
      });
      
      $container.find('#acu-vis-add-row').on('click', () => {
          const newRow = new Array(headers.length).fill('');
          newRow[0] = null; // convention
          sheet.content.push(newRow);
          if (isSummaryTable && sheetKey && isSpecialIndexLockEnabled_ACU(sheetKey)) {
              applySpecialIndexSequenceToSummaryTables_ACU(_acuVisState.tempData);
          }
          renderVisualizerDataMode_ACU($container, sheet);
      });
      
      $container.find('.acu-vis-del-row').on('click', function() {
          const rIdx = parseInt(jQuery_API_ACU(this).data('idx'));
          if (confirm('确定删除此行吗？')) {
              sheet.content.splice(rIdx + 1, 1);
              if (isSummaryTable && sheetKey && isSpecialIndexLockEnabled_ACU(sheetKey)) {
                  applySpecialIndexSequenceToSummaryTables_ACU(_acuVisState.tempData);
              }
              renderVisualizerDataMode_ACU($container, sheet);
          }
      });

      // 行锁定
      $container.find('.acu-vis-lock-row').on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const rIdx = parseInt(jQuery_API_ACU(this).data('idx'));
          if (!sheetKey || Number.isNaN(rIdx)) return;
          toggleRowLock_ACU(sheetKey, rIdx);
          renderVisualizerDataMode_ACU($container, sheet);
      });

      // 列锁定
      $container.find('.acu-vis-lock-col').on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const cIdx = parseInt(jQuery_API_ACU(this).data('col'));
          if (!sheetKey || Number.isNaN(cIdx)) return;
          toggleColLock_ACU(sheetKey, cIdx);
          renderVisualizerDataMode_ACU($container, sheet);
      });

      // 单元格锁定
      $container.find('.acu-vis-lock-cell').on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          const rIdx = parseInt(jQuery_API_ACU(this).data('row'));
          const cIdx = parseInt(jQuery_API_ACU(this).data('col'));
          if (!sheetKey || Number.isNaN(rIdx) || Number.isNaN(cIdx)) return;
          toggleCellLock_ACU(sheetKey, rIdx, cIdx);
          renderVisualizerDataMode_ACU($container, sheet);
      });

      // 编码索引列特殊锁定
      $container.find('.acu-vis-lock-special').on('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          if (!sheetKey) return;
          const next = !isSpecialIndexLockEnabled_ACU(sheetKey);
          setSpecialIndexLockEnabled_ACU(sheetKey, next);
          if (next) {
              applySpecialIndexSequenceToSummaryTables_ACU(_acuVisState.tempData);
          }
          renderVisualizerDataMode_ACU($container, sheet);
      });
  }

  function renderVisualizerConfigMode_ACU($container, sheet) {
      const config = ensureSheetExportConfigDefaults_ACU(sheet);
      const updateConfig = sheet.updateConfig || {};
      const sourceData = sheet.sourceData || {};
      const ucVal = (v) => (Number.isFinite(v) ? v : -1);
      const entryPlacement = normalizePlacementConfig_ACU(config.entryPlacement, DEFAULT_ENTRY_PLACEMENT_ACU);
      const extraIndexPlacement = normalizePlacementConfig_ACU(config.extraIndexPlacement, DEFAULT_EXTRA_INDEX_PLACEMENT_ACU);
      const fixedDefaults = getFixedPlacementDefaultsForTable_ACU(sheet.name);
      const fixedEntryPlacement = normalizePlacementConfig_ACU(config.fixedEntryPlacement, fixedDefaults.entry);
      const fixedIndexPlacement = normalizePlacementConfig_ACU(config.fixedIndexPlacement, fixedDefaults.index);
      const dataHeaders = Array.isArray(sheet?.content?.[0]) ? sheet.content[0].slice(1) : [];
      const selectedExtraIndexColumns = Array.isArray(config.extraIndexColumns)
          ? [...new Set(config.extraIndexColumns.filter(col => dataHeaders.includes(col)))]
          : [];
      const extraIndexColumnModes = (config.extraIndexColumnModes && typeof config.extraIndexColumnModes === 'object')
          ? config.extraIndexColumnModes
          : {};
      const extraIndexColumnsHtml = dataHeaders.length > 0
          ? dataHeaders.map((header, colIdx) => {
                const checked = selectedExtraIndexColumns.includes(header);
                const modeVal = extraIndexColumnModes[header] === 'index_only' ? 'index_only' : 'both';
                return `
                    <div class="acu-extra-index-col-row" style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                        <label style="display:flex; align-items:center; gap:6px; margin:0; min-width: 220px;">
                            <input type="checkbox" class="cfg-extra-index-col-check" data-col-idx="${colIdx}" ${checked ? 'checked' : ''}>
                            <span>${escapeHtml_ACU(header)}</span>
                        </label>
                        <select class="acu-form-input cfg-extra-index-col-mode" data-col-idx="${colIdx}" style="max-width: 260px;" ${checked ? '' : 'disabled'}>
                            <option value="both" ${modeVal === 'both' ? 'selected' : ''}>该列在原条目和索引条目都保留</option>
                            <option value="index_only" ${modeVal === 'index_only' ? 'selected' : ''}>该列仅放到索引条目</option>
                        </select>
                    </div>
                `;
            }).join('')
          : '<div class="acu-hint">当前表格没有可选列。</div>';
      const isSummaryTable = isSummaryOrOutlineTable_ACU(sheet.name);
      const sheetKey = _acuVisState.currentSheetKey;
      const specialIndexCol = isSummaryTable ? getSummaryIndexColumnIndex_ACU(sheet) : -1;
      const specialIndexHeader = (specialIndexCol >= 0 && Array.isArray(sheet.content?.[0]))
          ? sheet.content[0][specialIndexCol + 1]
          : '';
      const specialIndexLocked = (isSummaryTable && sheetKey) ? isSpecialIndexLockEnabled_ACU(sheetKey) : false;
      const isFixedConfigTable =
          isSummaryTableName_ACU(sheet.name) ||
          isOutlineTableName_ACU(sheet.name) ||
          isImportantPersonsTableName_ACU(sheet.name);
      const specialLockHtml = isSummaryTable ? `
              <div class="acu-config-section">
                  <h4>编码索引列锁定</h4>
                  <div class="acu-form-group">
                      <label>
                          <input type="checkbox" id="cfg-special-index-lock" ${specialIndexLocked ? 'checked' : ''}>
                          启用编码索引列特殊锁定
                      </label>
                      <div class="acu-hint">锁定时该列由系统按 AM0001、AM0002... 自动生成，仅对AI更新生效。</div>
                      ${specialIndexCol >= 0
                          ? `<div class="acu-hint">当前识别列: [${specialIndexCol}] ${escapeHtml_ACU(String(specialIndexHeader || ''))}</div>`
                          : `<div class="acu-hint" style="color:#f6c177;">未识别到编码索引列，将默认使用最后一列。</div>`}
                  </div>
              </div>
      ` : '';
      const fixedPlacementHtml = isFixedConfigTable ? `
              <div class="acu-config-section">
                  <h4>固定条目注入配置（本表专用）</h4>
                  <div class="acu-form-group">
                      <label>主条目位置:</label>
                      <select class="acu-form-input" id="cfg-fixed-entry-position">
                          <option value="at_depth_as_system" ${fixedEntryPlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                          <option value="before_character_definition" ${fixedEntryPlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                          <option value="after_character_definition" ${fixedEntryPlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                      </select>
                  </div>
                  <div class="acu-form-group">
                      <label>主条目插入深度 (Depth):</label>
                      <input type="number" class="acu-form-input" id="cfg-fixed-entry-depth" step="1" value="${fixedEntryPlacement.depth}">
                  </div>
                  <div class="acu-form-group">
                      <label>主条目插入顺序 (Order):</label>
                      <input type="number" class="acu-form-input" id="cfg-fixed-entry-order" min="1" step="1" value="${fixedEntryPlacement.order}">
                  </div>
                  ${isImportantPersonsTableName_ACU(sheet.name) ? `
                  <div class="acu-form-group" style="margin-top:10px; padding-top:10px; border-top: 1px dashed #ddd;">
                      <label>索引条目位置:</label>
                      <select class="acu-form-input" id="cfg-fixed-index-position">
                          <option value="at_depth_as_system" ${fixedIndexPlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                          <option value="before_character_definition" ${fixedIndexPlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                          <option value="after_character_definition" ${fixedIndexPlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                      </select>
                  </div>
                  <div class="acu-form-group">
                      <label>索引条目插入深度 (Depth):</label>
                      <input type="number" class="acu-form-input" id="cfg-fixed-index-depth" step="1" value="${fixedIndexPlacement.depth}">
                  </div>
                  <div class="acu-form-group">
                      <label>索引条目插入顺序 (Order):</label>
                      <input type="number" class="acu-form-input" id="cfg-fixed-index-order" min="1" step="1" value="${fixedIndexPlacement.order}">
                  </div>` : ''}
              </div>
      ` : '';
      
      const html = `
          <div class="acu-config-panel">
              <div class="acu-config-section">
                  <h4>基本信息</h4>
                  <div class="acu-form-group">
                      <label>表格名称:</label>
                      <input type="text" class="acu-form-input" id="cfg-name" value="${escapeHtml_ACU(sheet.name)}">
                  </div>
              </div>

              <div class="acu-config-section">
                  <h4>表头/列定义</h4>
                  <div class="acu-col-list" id="cfg-col-list"></div>
                  <button id="cfg-add-col" class="acu-btn-secondary" style="margin-top:10px; width:100%;"><i class="fa-solid fa-plus"></i> 添加列</button>
              </div>
              ${specialLockHtml}

              <div class="acu-config-section">
                  <h4>自动化更新参数</h4>
                  <div class="acu-form-group">
                      <label>AI读取上下文层数 (Context Depth): <span class="acu-hint">(-1 = 沿用UI全局, 1+ = 生效；0 会被视为沿用UI)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-depth" min="-1" step="1" value="${ucVal(updateConfig.contextDepth)}">
                  </div>
                  <div class="acu-form-group">
                      <label>更新频率 (Update Frequency): <span class="acu-hint">(-1 = 沿用UI全局, 0 = 禁用该表自动更新)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-freq" min="-1" step="1" value="${ucVal(updateConfig.updateFrequency)}">
                  </div>
                  <div class="acu-form-group">
                      <label>批处理大小 (Batch Size): <span class="acu-hint">(-1 = 沿用UI全局, 1+ = 生效；0 会被视为沿用UI)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-batch" min="-1" step="1" value="${ucVal(updateConfig.batchSize)}">
                  </div>
                  <div class="acu-form-group">
                      <label>分组编号 (groupId): <span class="acu-hint">(-1 = 默认同组；不同编号的表会拆分并发；相同编号仍会继续按上下文与 Batch Size 分组)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-group-id" min="-1" step="1" value="${ucVal(updateConfig.groupId)}">
                  </div>
                  <div class="acu-form-group">
                      <label>跳过更新楼层 (Skip Floors): <span class="acu-hint">(-1 = 沿用UI全局, 0+ = 生效)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-skip" min="-1" step="1" value="${ucVal(updateConfig.skipFloors)}">
                  </div>
                  <div class="acu-form-group">
                      <label>发送最新N行 (Send Latest Rows): <span class="acu-hint">(-1 = 全部发送, 0 = 沿用UI全局, 1+ = 仅发送最新N条；纪要表固定使用10条)</span></label>
                      <input type="number" class="acu-form-input" id="cfg-send-rows" min="-1" step="1" value="${ucVal(updateConfig.sendLatestRows)}">
                  </div>
              </div>

              <div class="acu-config-section">
                  <h4>AI提示词指令 (Source Data)</h4>
                  <div class="acu-form-group">
                      <label>表格说明 (Note):</label>
                      <textarea class="acu-form-textarea" id="cfg-note">${escapeHtml_ACU(sourceData.note || '')}</textarea>
                  </div>
                  <div class="acu-form-group">
                      <label>初始化触发 (Init):</label>
                      <textarea class="acu-form-textarea" id="cfg-init">${escapeHtml_ACU(sourceData.initNode || '')}</textarea>
                  </div>
                  <div class="acu-form-group">
                      <label>新增触发 (Insert):</label>
                      <textarea class="acu-form-textarea" id="cfg-insert">${escapeHtml_ACU(sourceData.insertNode || '')}</textarea>
                  </div>
                  <div class="acu-form-group">
                      <label>更新触发 (Update):</label>
                      <textarea class="acu-form-textarea" id="cfg-update">${escapeHtml_ACU(sourceData.updateNode || '')}</textarea>
                  </div>
                  <div class="acu-form-group">
                      <label>删除触发 (Delete):</label>
                      <textarea class="acu-form-textarea" id="cfg-delete">${escapeHtml_ACU(sourceData.deleteNode || '')}</textarea>
                  </div>
              </div>
              
              <div class="acu-config-section">
                  <h4>世界书注入配置</h4>
                  <div class="acu-form-group">
                      <label>
                          <input type="checkbox" id="cfg-inject" ${config.injectIntoWorldbook !== false ? 'checked' : ''}>
                          是否注入到世界书条目
                      </label>
                      <div class="acu-hint">勾选后，该表格会注入到世界书条目中；关闭后不会注入到任何世界书条目。</div>
                  </div>
                  
                  <div style="border-top: 1px dashed #ddd; margin: 10px 0; padding-top: 10px;">
                      <div class="acu-form-group">
                          <label>
                              <input type="checkbox" id="cfg-export-enabled" ${config.enabled ? 'checked' : ''}>
                              启用独立导出 (Custom Export)
                          </label>
                          <div class="acu-hint">勾选后，该表格将额外导出为独立的世界书条目。</div>
                      </div>

                      <div id="cfg-export-options" style="display: ${config.enabled ? 'block' : 'none'}; padding-left: 20px; border-left: 2px solid #eee;">
                          <div class="acu-form-group">
                              <label>
                                  <input type="checkbox" id="cfg-split" ${config.splitByRow ? 'checked' : ''}>
                                  按行拆分 (Split by Row)
                              </label>
                              <div class="acu-hint">勾选后，每一行数据将生成一个单独的条目。</div>
                          </div>
                          
                          <div class="acu-form-group">
                              <label>条目名称 (Entry Name):</label>
                              <input type="text" class="acu-form-input" id="cfg-entry-name" value="${escapeHtml_ACU(config.entryName || sheet.name || '')}" placeholder="例如: ${escapeHtml_ACU(sheet.name)}">
                              <div class="acu-hint">如果不拆分，此为条目名；如果拆分，自动命名为 "名称-1", "名称-2" 等。</div>
                          </div>

                          <div class="acu-form-group">
                              <label>条目类型 (Entry Type):</label>
                              <select class="acu-form-input" id="cfg-entry-type">
                                  <option value="constant" ${(!config.entryType || config.entryType === 'constant') ? 'selected' : ''}>常量条目 (Constant/Blue)</option>
                                  <option value="keyword" ${config.entryType === 'keyword' ? 'selected' : ''}>关键词条目 (Keyword/Green)</option>
                              </select>
                          </div>

                          <div class="acu-form-group">
                              <label>关键词 (Keywords):</label>
                              <input type="text" class="acu-form-input" id="cfg-keywords" value="${escapeHtml_ACU(config.keywords || '')}" placeholder="关键词1, 关键词2">
                              <div class="acu-hint">
                                  如果未拆分，填写的词就是关键词。<br>
                                  如果拆分且关键词与列名相同，则使用该行对应列的内容作为关键词。
                              </div>
                          </div>
                          
                          <div class="acu-form-group">
                              <label>
                                  <input type="checkbox" id="cfg-recursion" ${config.preventRecursion !== false ? 'checked' : ''}>
                                  防止递归 (Prevent Recursion)
                              </label>
                          </div>

                          <div class="acu-form-group">
                              <label>自定义注入模板 (可选):</label>
                              <textarea class="acu-form-textarea" id="cfg-template" placeholder="使用 $1 代表本表导出的蓝灯/绿灯条目列表，$1 上下的内容会分别生成独立的常量条目，插入到该表注入区块的最前与最后。">${escapeHtml_ACU(config.injectionTemplate || '')}</textarea>
                              <div class="acu-hint">注入词现在以独立的常量条目进行包裹。填写模板后，$1 保留为条目本身，$1 之前和之后的内容会各自成为前/后包裹条目。</div>
                          </div>
                          <div class="acu-form-group" style="margin-top:10px; padding-top:10px; border-top: 1px dashed #ddd;">
                              <label>主条目位置:</label>
                              <select class="acu-form-input" id="cfg-entry-position">
                                  <option value="at_depth_as_system" ${entryPlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                                  <option value="before_character_definition" ${entryPlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                                  <option value="after_character_definition" ${entryPlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                              </select>
                          </div>
                          <div class="acu-form-group">
                              <label>主条目插入深度 (Depth):</label>
                              <input type="number" class="acu-form-input" id="cfg-entry-depth" step="1" value="${entryPlacement.depth}">
                          </div>
                          <div class="acu-form-group">
                              <label>主条目插入顺序 (Order):</label>
                              <input type="number" class="acu-form-input" id="cfg-entry-order" min="1" step="1" value="${entryPlacement.order}">
                              <div class="acu-hint">只需设置主条目的顺序；若存在上/下包裹条目，会自动占用前后顺序位。</div>
                          </div>

                          <div class="acu-form-group" style="margin-top: 12px; padding-top: 10px; border-top: 1px dashed #ddd;">
                              <label>
                                  <input type="checkbox" id="cfg-extra-index-enabled" ${config.extraIndexEnabled ? 'checked' : ''}>
                                  额外增加索引条目
                              </label>
                              <div class="acu-hint">启用后会在该表导出区块额外注入 1 条“索引条目”（常量条目）。</div>
                          </div>
                          <div id="cfg-extra-index-options" style="display: ${config.extraIndexEnabled ? 'block' : 'none'}; padding-left: 12px; border-left: 2px solid #eee;">
                              <div class="acu-form-group">
                                  <label>索引条目名称:</label>
                                  <input type="text" class="acu-form-input" id="cfg-extra-index-entry-name" value="${escapeHtml_ACU(config.extraIndexEntryName || `${config.entryName || sheet.name || ''}-索引`)}" placeholder="例如: ${escapeHtml_ACU((config.entryName || sheet.name || '表格') + '-索引')}">
                                  <div class="acu-hint">将作为额外注入世界书条目的名称。</div>
                              </div>
                              <div class="acu-form-group">
                                  <label>索引条目列选择（可多选）:</label>
                                  <div id="cfg-extra-index-columns-list">
                                      ${extraIndexColumnsHtml}
                                  </div>
                                  <div class="acu-hint">每列可独立设置：仅放索引条目，或原条目与索引条目都保留。</div>
                              </div>
                              <div class="acu-form-group">
                                  <label>索引条目自定义注入模板 (可选):</label>
                                  <textarea class="acu-form-textarea" id="cfg-extra-index-template" placeholder="使用 $1 代表索引条目内容；$1 上下内容会分别生成独立常量条目并放在索引条目之前/之后。">${escapeHtml_ACU(config.extraIndexInjectionTemplate || '')}</textarea>
                                  <div class="acu-hint">逻辑与独立导出条目的自定义注入模板一致。</div>
                              </div>
                              <div class="acu-form-group" style="margin-top:10px; padding-top:10px; border-top: 1px dashed #ddd;">
                                  <label>索引条目位置:</label>
                                  <select class="acu-form-input" id="cfg-extra-index-position">
                                      <option value="at_depth_as_system" ${extraIndexPlacement.position === 'at_depth_as_system' ? 'selected' : ''}>系统</option>
                                      <option value="before_character_definition" ${extraIndexPlacement.position === 'before_character_definition' ? 'selected' : ''}>角色定义前</option>
                                      <option value="after_character_definition" ${extraIndexPlacement.position === 'after_character_definition' ? 'selected' : ''}>角色定义后</option>
                                  </select>
                              </div>
                              <div class="acu-form-group">
                                  <label>索引条目插入深度 (Depth):</label>
                                  <input type="number" class="acu-form-input" id="cfg-extra-index-depth" step="1" value="${extraIndexPlacement.depth}">
                              </div>
                              <div class="acu-form-group">
                                  <label>索引条目插入顺序 (Order):</label>
                                  <input type="number" class="acu-form-input" id="cfg-extra-index-order" min="1" step="1" value="${extraIndexPlacement.order}">
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
              ${fixedPlacementHtml}
          </div>
      `;
      
      $container.html(html);
      
      // Render Columns
      const headers = sheet.content[0] || [];
      const $colList = jQuery_API_ACU('#cfg-col-list');
      
      function renderCols() {
          $colList.empty();
          headers.forEach((h, idx) => {
              if (idx === 0) return; // Skip ID
              const $item = jQuery_API_ACU(`
                  <div class="acu-col-item">
                      <span style="width:30px; text-align:center;">#${idx}</span>
                      <input type="text" class="acu-col-input" value="${escapeHtml_ACU(h)}" data-idx="${idx}">
                      <button class="acu-col-btn" style="color:#e95e5e;" data-idx="${idx}"><i class="fa-solid fa-times"></i></button>
                  </div>
              `);
              $colList.append($item);
          });
      }
      renderCols();
      
      // Bind Config Events
      $colList.on('input', '.acu-col-input', function() {
          const idx = parseInt(jQuery_API_ACU(this).data('idx'));
          headers[idx] = jQuery_API_ACU(this).val();
      });
      
      $colList.on('click', '.acu-col-btn', function() {
          const idx = parseInt(jQuery_API_ACU(this).data('idx'));
          if (confirm('删除列将同时删除该列的所有数据，确定吗？')) {
              // [修复] headers 是 sheet.content[0] 的引用，只需对数据行执行splice，避免双重删除
              headers.splice(idx, 1);
              sheet.content.slice(1).forEach(row => row.splice(idx, 1));
              renderCols();
          }
      });
      
      jQuery_API_ACU('#cfg-add-col').on('click', () => {
          const newName = prompt('输入新列名:');
          if (newName) {
              headers.push(newName);
              // Update all rows
              sheet.content.forEach((row, i) => {
                  if (i > 0) row.push('');
              });
              renderCols();
          }
      });
      
      // Inputs bindings
      jQuery_API_ACU('#cfg-name').on('input', function() { sheet.name = jQuery_API_ACU(this).val(); });
      if (isSummaryTable && sheetKey) {
          jQuery_API_ACU('#cfg-special-index-lock').on('change', function() {
              const enabled = jQuery_API_ACU(this).is(':checked');
              setSpecialIndexLockEnabled_ACU(sheetKey, enabled);
              if (enabled) {
                  applySpecialIndexSequenceToSummaryTables_ACU(_acuVisState.tempData);
              }
              renderVisualizerMain_ACU();
          });
      }
      const parseIntOrDefault_ACU = (val, defVal) => {
          const n = parseInt(val, 10);
          return Number.isFinite(n) ? n : defVal;
      };
      jQuery_API_ACU('#cfg-depth').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.contextDepth = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      jQuery_API_ACU('#cfg-freq').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.updateFrequency = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      jQuery_API_ACU('#cfg-batch').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.batchSize = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      jQuery_API_ACU('#cfg-group-id').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.groupId = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      jQuery_API_ACU('#cfg-skip').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.skipFloors = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      jQuery_API_ACU('#cfg-send-rows').on('input', function() { if (!sheet.updateConfig) sheet.updateConfig = {}; sheet.updateConfig.uiSentinel = -1; sheet.updateConfig.sendLatestRows = parseIntOrDefault_ACU(jQuery_API_ACU(this).val(), -1); });
      
      jQuery_API_ACU('#cfg-note').on('input', function() { if (!sheet.sourceData) sheet.sourceData = {}; sheet.sourceData.note = jQuery_API_ACU(this).val(); });
      jQuery_API_ACU('#cfg-init').on('input', function() { if (!sheet.sourceData) sheet.sourceData = {}; sheet.sourceData.initNode = jQuery_API_ACU(this).val(); });
      jQuery_API_ACU('#cfg-insert').on('input', function() { if (!sheet.sourceData) sheet.sourceData = {}; sheet.sourceData.insertNode = jQuery_API_ACU(this).val(); });
      jQuery_API_ACU('#cfg-update').on('input', function() { if (!sheet.sourceData) sheet.sourceData = {}; sheet.sourceData.updateNode = jQuery_API_ACU(this).val(); });
      jQuery_API_ACU('#cfg-delete').on('input', function() { if (!sheet.sourceData) sheet.sourceData = {}; sheet.sourceData.deleteNode = jQuery_API_ACU(this).val(); });
      
      // Worldbook Config Bindings
      const ensureExportConfig = () => { if (!sheet.exportConfig) sheet.exportConfig = {}; };

      jQuery_API_ACU('#cfg-inject').on('change', function() {
          ensureExportConfig();
          sheet.exportConfig.injectIntoWorldbook = jQuery_API_ACU(this).is(':checked');
      });

      jQuery_API_ACU('#cfg-export-enabled').on('change', function() {
          ensureExportConfig();
          const isEnabled = jQuery_API_ACU(this).is(':checked');
          sheet.exportConfig.enabled = isEnabled;
          jQuery_API_ACU('#cfg-export-options').slideToggle(isEnabled);
      });

      jQuery_API_ACU('#cfg-split').on('change', function() {
          ensureExportConfig();
          sheet.exportConfig.splitByRow = jQuery_API_ACU(this).is(':checked');
      });

      jQuery_API_ACU('#cfg-entry-name').on('input', function() {
          ensureExportConfig();
          sheet.exportConfig.entryName = jQuery_API_ACU(this).val();
      });

      jQuery_API_ACU('#cfg-entry-type').on('change', function() {
          ensureExportConfig();
          sheet.exportConfig.entryType = jQuery_API_ACU(this).val();
      });

      jQuery_API_ACU('#cfg-keywords').on('input', function() {
          ensureExportConfig();
          sheet.exportConfig.keywords = jQuery_API_ACU(this).val();
      });

      jQuery_API_ACU('#cfg-recursion').on('change', function() {
          ensureExportConfig();
          sheet.exportConfig.preventRecursion = jQuery_API_ACU(this).is(':checked');
      });

      jQuery_API_ACU('#cfg-template').on('input', function() {
          ensureExportConfig();
          sheet.exportConfig.injectionTemplate = jQuery_API_ACU(this).val();
      });

      const readPlacementFromInputs_ACU = (prefix, fallbackPlacement) => {
          const position = normalizeLorebookPosition_ACU(jQuery_API_ACU(`#${prefix}-position`).val(), fallbackPlacement.position);
          const depth = parseIntOrDefault_ACU(jQuery_API_ACU(`#${prefix}-depth`).val(), fallbackPlacement.depth);
          const order = parseIntOrDefault_ACU(jQuery_API_ACU(`#${prefix}-order`).val(), fallbackPlacement.order);
          return normalizePlacementConfig_ACU({ position, depth, order }, fallbackPlacement);
      };

      const syncEntryPlacementFromUi_ACU = () => {
          ensureExportConfig();
          sheet.exportConfig.entryPlacement = readPlacementFromInputs_ACU('cfg-entry', DEFAULT_ENTRY_PLACEMENT_ACU);
      };
      jQuery_API_ACU('#cfg-entry-position, #cfg-entry-depth, #cfg-entry-order').on('input change', function() {
          syncEntryPlacementFromUi_ACU();
      });

      const syncExtraIndexConfigFromUi = () => {
          ensureExportConfig();
          const enabled = jQuery_API_ACU('#cfg-extra-index-enabled').is(':checked');
          sheet.exportConfig.extraIndexEnabled = enabled;
          const selectedColumns = [];
          const modeMap = {};
          jQuery_API_ACU('.cfg-extra-index-col-check').each(function() {
              const colIdx = parseInt(jQuery_API_ACU(this).attr('data-col-idx'), 10);
              const colName = dataHeaders[colIdx];
              if (!colName) return;
              const isChecked = jQuery_API_ACU(this).is(':checked');
              const $mode = jQuery_API_ACU(`.cfg-extra-index-col-mode[data-col-idx="${colIdx}"]`);
              $mode.prop('disabled', !isChecked);
              if (!isChecked) return;
              selectedColumns.push(colName);
              const modeVal = $mode.val() === 'index_only' ? 'index_only' : 'both';
              modeMap[colName] = modeVal;
          });
          sheet.exportConfig.extraIndexColumns = selectedColumns;
          sheet.exportConfig.extraIndexColumnModes = modeMap;
          sheet.exportConfig.extraIndexPlacement = readPlacementFromInputs_ACU('cfg-extra-index', DEFAULT_EXTRA_INDEX_PLACEMENT_ACU);
      };

      jQuery_API_ACU('#cfg-extra-index-enabled').on('change', function() {
          ensureExportConfig();
          const enabled = jQuery_API_ACU(this).is(':checked');
          sheet.exportConfig.extraIndexEnabled = enabled;
          jQuery_API_ACU('#cfg-extra-index-options').slideToggle(enabled);
          syncExtraIndexConfigFromUi();
      });

      jQuery_API_ACU('#cfg-extra-index-entry-name').on('input', function() {
          ensureExportConfig();
          sheet.exportConfig.extraIndexEntryName = jQuery_API_ACU(this).val();
      });

      jQuery_API_ACU('#cfg-extra-index-template').on('input', function() {
          ensureExportConfig();
          sheet.exportConfig.extraIndexInjectionTemplate = jQuery_API_ACU(this).val();
      });
      jQuery_API_ACU('#cfg-extra-index-position, #cfg-extra-index-depth, #cfg-extra-index-order').on('input change', function() {
          syncExtraIndexConfigFromUi();
      });

      jQuery_API_ACU('.cfg-extra-index-col-check').on('change', function() {
          syncExtraIndexConfigFromUi();
      });

      jQuery_API_ACU('.cfg-extra-index-col-mode').on('change', function() {
          syncExtraIndexConfigFromUi();
      });

      if (isFixedConfigTable) {
          const syncFixedEntryPlacementFromUi_ACU = () => {
              ensureExportConfig();
              const fallback = getFixedPlacementDefaultsForTable_ACU(sheet.name).entry;
              sheet.exportConfig.fixedEntryPlacement = readPlacementFromInputs_ACU('cfg-fixed-entry', fallback);
          };
          jQuery_API_ACU('#cfg-fixed-entry-position, #cfg-fixed-entry-depth, #cfg-fixed-entry-order').on('input change', function() {
              syncFixedEntryPlacementFromUi_ACU();
          });

          if (isImportantPersonsTableName_ACU(sheet.name)) {
              const syncFixedIndexPlacementFromUi_ACU = () => {
                  ensureExportConfig();
                  const fallback = getFixedPlacementDefaultsForTable_ACU(sheet.name).index;
                  sheet.exportConfig.fixedIndexPlacement = readPlacementFromInputs_ACU('cfg-fixed-index', fallback);
              };
              jQuery_API_ACU('#cfg-fixed-index-position, #cfg-fixed-index-depth, #cfg-fixed-index-order').on('input change', function() {
                  syncFixedIndexPlacementFromUi_ACU();
              });
          }
      }

  }

  async function saveVisualizerChanges_ACU(saveToTemplate = false) {
      // 1. Check for Inheritance (Structure Mismatch)
      // Compare _acuVisState.tempData with original TABLE_TEMPLATE_ACU
      // But user might have just edited tempData to be different from template.
      // The requirement says: "check mismatch between new current table data and the CURRENTLY USED TEMPLATE".
      // If mismatch, prompt inheritance.
      
      // [新增] 按照用户调整的顺序重新组织数据
      const orderedData = {};
      const orderedKeys = getOrderedSheetKeys_ACU();
      
      // 先添加非表格数据（如 mate）
      Object.keys(_acuVisState.tempData).forEach(key => {
          if (!key.startsWith('sheet_')) {
              orderedData[key] = _acuVisState.tempData[key];
          }
      });
      
      // 按顺序添加表格数据
      orderedKeys.forEach(key => {
          if (_acuVisState.tempData[key]) {
              orderedData[key] = _acuVisState.tempData[key];
          }
      });

      // [新机制] 保存前统一重编号：编号随当前顺序变化，并写入当前数据（可随导出/导入迁移）
      applySheetOrderNumbers_ACU(orderedData, orderedKeys);
      
      // [新增] 若开启“编码索引列特殊锁定”，保存时强制按 AM 序列重排
      applySpecialIndexSequenceToSummaryTables_ACU(orderedData);
      
      // First, apply changes to local variable (使用排序后的数据)
      currentJsonTableData_ACU = JSON.parse(JSON.stringify(orderedData));

      // [新增] 可视化编辑器属于“用户显式修改表结构/表名/顺序”的入口：
      // 覆盖式更新聊天第一层的“空白指导表”（仅表头+参数，无数据行），让后续合并/显示/填表参数都以此为准。
      // 仅“保存到当前聊天”会把这次修改沉淀为当前聊天模板预设；“保存到全局”只更新全局预设与当前全局选择，不会自动清除当前聊天本地预设。
      if (!saveToTemplate) {
          try {
              const isolationKey = getCurrentIsolationKey_ACU();
              // 需求4（澄清版）：可视化编辑器触发指导表更新时，只更新表名/表头/表格参数，不修改指导表基础数据（seedRows）。
              // - 若当前聊天/标签已存在指导表：必须继承其 seedRows
              // - 若不存在指导表：从当前模板提取预置数据作为 seedRows（需求1）
              const existingGuide = getChatSheetGuideDataForIsolationKey_ACU(isolationKey);
              const templateObjForSeed = parseTableTemplateJson_ACU({ stripSeedRows: false });
              const guideData = buildChatSheetGuideDataFromData_ACU(currentJsonTableData_ACU, {
                  preserveSeedRowsFromGuideData: existingGuide,
                  seedRowsFromTemplateObj: templateObjForSeed,
              });
              if (guideData && Object.keys(guideData).some(k => k.startsWith('sheet_'))) {
                  const syncTemplateScope = true;
                  const templateScopeSource = materializeDataFromSheetGuide_ACU(guideData, { includeSeedRows: true });
                  setChatSheetGuideDataForIsolationKey_ACU(isolationKey, guideData, {
                      reason: 'visualizer_save',
                      syncTemplateScope,
                      templateSource: templateScopeSource,
                      presetName: resolveActiveTemplatePresetName_ACU({ fallbackToGlobal: true, isolationKey }),
                      source: 'visualizer_save',
                  });
                  logDebug_ACU(`[SheetGuide] Overwrote chat sheet guide from visualizer for tag [${isolationKey || '无标签'}] (tables=${Object.keys(guideData).filter(k => k.startsWith('sheet_')).length}).`);
              }
          } catch (e) {
              logWarn_ACU('[SheetGuide] Failed to overwrite sheet guide from visualizer:', e);
          }
      }

      // [新机制] 不再使用 settings_ACU.tableKeyOrder 强制固定顺序（顺序由每张表的 orderNo 决定）
      // 记录本次需要彻底清理的 key（真正清理会在“写回所有楼层”之后执行，防止后续写回把旧表带回）
      const deletedKeysToPurge_ACU = Array.isArray(_acuVisState.deletedSheetKeys) ? [..._acuVisState.deletedSheetKeys] : [];
      
      // Update template only if saveToTemplate is true
      // “保存到全局”会把当前编辑结果同步进全局模板预设；“保存到当前聊天”只沉淀聊天级预设/数据
      if (saveToTemplate) {
          let templateObj = null;
          try {
              templateObj = JSON.parse(TABLE_TEMPLATE_ACU);
              if (!templateObj || typeof templateObj !== 'object') templateObj = {};
              // 同步全局注入配置（存入模板 mate，不走 settings）
              const tempGlobalCfg = getGlobalInjectionConfigFromData_ACU(currentJsonTableData_ACU, { ensureWriteBack: true });
              const prevGlobalCfgStr = safeJsonStringify_ACU(templateObj?.mate?.globalInjectionConfig || {}, '{}');
              const nextGlobalCfgStr = safeJsonStringify_ACU(tempGlobalCfg || {}, '{}');
              if (!templateObj.mate || typeof templateObj.mate !== 'object') templateObj.mate = { type: 'chatSheets', version: 1 };
              if (!templateObj.mate.type) templateObj.mate.type = 'chatSheets';
              if (!Number.isFinite(templateObj.mate.version)) templateObj.mate.version = 1;
              templateObj.mate.globalInjectionConfig = tempGlobalCfg;
              let templateChanged = false;
              if (prevGlobalCfgStr !== nextGlobalCfgStr) templateChanged = true;

              // [优化] 全量同步：不仅更新现有表，也处理新增和删除的表
              // 1. 同步 currentJsonTableData_ACU 中的所有表到 templateObj
              Object.keys(currentJsonTableData_ACU).forEach(key => {
                  if (!key.startsWith('sheet_')) return;

                  const currentTable = currentJsonTableData_ACU[key];

                  // 如果模板中没有这个表，或者有这个key但名字变了(虽然key是唯一标识，但为了保险起见)，则新建/覆盖
                  // 这里的逻辑是：以 currentJsonTableData_ACU 为准

                  if (!templateObj[key]) {
                      // 新增表格：克隆整个结构，但清空数据行（保留表头）
                      const newTemplateTable = JSON.parse(JSON.stringify(currentTable));
                      if (newTemplateTable.content && newTemplateTable.content.length > 1) {
                          newTemplateTable.content = [newTemplateTable.content[0]]; // 只保留表头
                      }
                      // [新机制] 同步顺序编号
                      newTemplateTable[TABLE_ORDER_FIELD_ACU] = currentTable[TABLE_ORDER_FIELD_ACU];
                      templateObj[key] = newTemplateTable;
                      templateChanged = true;
                      logDebug_ACU(`Added new table "${currentTable.name}" to template.`);
                  } else {
                      // 更新现有表格
                      const templateTable = templateObj[key];

                      // 检查是否有实质性变更 (参数、表头、名称)
                      let hasChanges = false;

                      if (templateTable.name !== currentTable.name) {
                          templateTable.name = currentTable.name;
                          hasChanges = true;
                      }

                      // Deep compare and update sourceData
                      if (JSON.stringify(templateTable.sourceData) !== JSON.stringify(currentTable.sourceData)) {
                          templateTable.sourceData = currentTable.sourceData ? JSON.parse(JSON.stringify(currentTable.sourceData)) : {};
                          hasChanges = true;
                      }

                      // Deep compare and update updateConfig
                      if (JSON.stringify(templateTable.updateConfig) !== JSON.stringify(currentTable.updateConfig)) {
                          templateTable.updateConfig = currentTable.updateConfig ? JSON.parse(JSON.stringify(currentTable.updateConfig)) : {};
                          hasChanges = true;
                      }

                      // Deep compare and update exportConfig
                      if (JSON.stringify(templateTable.exportConfig) !== JSON.stringify(currentTable.exportConfig)) {
                          templateTable.exportConfig = currentTable.exportConfig ? JSON.parse(JSON.stringify(currentTable.exportConfig)) : {};
                          hasChanges = true;
                      }

                      // [新机制] 同步顺序编号（顺序变化也属于模板变更）
                      if (templateTable[TABLE_ORDER_FIELD_ACU] !== currentTable[TABLE_ORDER_FIELD_ACU]) {
                          templateTable[TABLE_ORDER_FIELD_ACU] = currentTable[TABLE_ORDER_FIELD_ACU];
                          hasChanges = true;
                      }

                      // Update headers (content[0])
                      if (currentTable.content && Array.isArray(currentTable.content) && currentTable.content.length > 0) {
                          const currentHeaders = currentTable.content[0];
                          const templateHeaders = templateTable.content[0];
                          if (JSON.stringify(currentHeaders) !== JSON.stringify(templateHeaders)) {
                              templateTable.content[0] = JSON.parse(JSON.stringify(currentHeaders));
                              hasChanges = true;
                          }
                      }

                      if (hasChanges) {
                          templateChanged = true;
                      }
                  }
              });

              // 2. 删除模板中存在但在 currentJsonTableData_ACU 中已不存在的表
              Object.keys(templateObj).forEach(key => {
                  if (key.startsWith('sheet_') && !currentJsonTableData_ACU[key]) {
                      delete templateObj[key];
                      templateChanged = true;
                      logDebug_ACU(`Removed table key "${key}" from template.`);
                  }
              });

              // [新机制] 再做一次兜底：按当前顺序补齐/重建模板编号（避免极端情况下编号缺失/重复）
              ensureSheetOrderNumbers_ACU(templateObj, { baseOrderKeys: orderedKeys, forceRebuild: false });

              if (templateChanged) {
                  const isolationKey = getCurrentIsolationKey_ACU();
                  const activePresetName = normalizeTemplatePresetSelectionValue_ACU(
                      resolveActiveTemplatePresetName_ACU({ fallbackToGlobal: true, isolationKey }),
                  );
                  let finalGlobalPresetName = activePresetName;
                  if (isDefaultTemplatePresetSelection_ACU(finalGlobalPresetName)) {
                      const promptedName = prompt('请输入要保存到全局的模板预设名称：', '新模板预设');
                      if (!promptedName) return;
                      finalGlobalPresetName = normalizeTemplatePresetSelectionValue_ACU(String(promptedName).trim());
                  } else if (!confirm(`确定要用当前编辑结果覆盖全局预设 "${finalGlobalPresetName}" 吗？`)) {
                      return;
                  }
                  if (!finalGlobalPresetName) return;

                  const preparedSnapshot = sanitizeTemplateSnapshotForChat_ACU(templateObj);
                  if (!preparedSnapshot?.templateStr) {
                      throw new Error('可视化编辑器保存到全局失败：无法生成模板快照。');
                  }
                  const presetSaved = upsertTemplatePreset_ACU(finalGlobalPresetName, preparedSnapshot.templateStr);
                  if (!presetSaved) {
                      throw new Error('可视化编辑器保存到全局失败：无法写入全局预设库。');
                  }

                  const appliedGlobalTemplate = await applyTemplatePresetToCurrent_ACU(finalGlobalPresetName, {
                      source: 'visualizer_save_to_global',
                      updateGlobal: true,
                      refreshUi: !!$popupInstance_ACU,
                      save: true,
                      persistChatScope: false,
                  });
                  if (!appliedGlobalTemplate) {
                      throw new Error('可视化编辑器保存到全局失败：模板快照应用失败。');
                  }
                  logDebug_ACU('Template fully synchronized via Visualizer.');
                  showToastr_ACU('success', `更改已保存到全局预设：${finalGlobalPresetName}；当前聊天的本地预设不会被自动清除。`);
              } else {
                  showToastr_ACU('info', '模板无变化，无需保存。');
              }
          } catch (e) {
              logError_ACU('Error updating template from visualizer:', e);
          }
      }

      // 2. Save to Chat History (per table, back to its original floor)
      const chat = SillyTavern_API_ACU.chat || [];
      if (!chat.length) {
          showToastr_ACU('warning', '聊天记录为空，更改仅保存在内存，未持久化。');
      } else {
          // 2.1 预先获取当前隔离标签与所有表
          const isolationKey = getCurrentIsolationKey_ACU();
          const allSheetKeys = getSortedSheetKeys_ACU(currentJsonTableData_ACU);
          
          // 2.2 计算最新一条 AI 楼层索引，作为兜底
          const latestAiIndex = (() => {
              for (let i = chat.length - 1; i >= 0; i--) {
                  if (!chat[i].is_user) return i;
              }
              return -1;
          })();
          
          // 2.3 查找每张表当前最新数据所在的原楼层
          const bucketByIndex = {};
          const resolveTargetIndexForSheet = (sheetKey) => {
              const table = currentJsonTableData_ACU[sheetKey];
              const isSummaryTable = table ? isSummaryOrOutlineTable_ACU(table.name) : false;
              
              for (let i = chat.length - 1; i >= 0; i--) {
                  const msg = chat[i];
                  if (msg.is_user) continue;
                  
                  let wasUpdated = false;
                  
                  // 优先：新格式（按标签分组）
                  if (msg.TavernDB_ACU_IsolatedData && msg.TavernDB_ACU_IsolatedData[isolationKey]) {
                      const tagData = msg.TavernDB_ACU_IsolatedData[isolationKey];
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
                  
                  // 兼容：旧格式（同样遵循隔离标签）
                  if (!wasUpdated) {
                      const msgIdentity = msg.TavernDB_ACU_Identity;
                      const isLegacyMatch = settings_ACU.dataIsolationEnabled
                          ? msgIdentity === settings_ACU.dataIsolationCode
                          : !msgIdentity;
                      
                      if (isLegacyMatch) {
                          const modifiedKeys = msg.TavernDB_ACU_ModifiedKeys || [];
                          const updateGroupKeys = msg.TavernDB_ACU_UpdateGroupKeys || [];
                          
                          if (updateGroupKeys.length > 0 && modifiedKeys.length > 0) {
                              wasUpdated = updateGroupKeys.includes(sheetKey);
                          } else if (modifiedKeys.length > 0) {
                              wasUpdated = modifiedKeys.includes(sheetKey);
                          } else {
                              const hasLegacyData =
                                  (msg.TavernDB_ACU_IndependentData && msg.TavernDB_ACU_IndependentData[sheetKey]) ||
                                  (isSummaryTable
                                      ? (msg.TavernDB_ACU_SummaryData && msg.TavernDB_ACU_SummaryData[sheetKey])
                                      : (msg.TavernDB_ACU_Data && msg.TavernDB_ACU_Data[sheetKey]));
                              wasUpdated = !!hasLegacyData;
                          }
                      }
                  }
                  
                  if (wasUpdated) return i; // 找到最新的原始楼层
              }
              
              return latestAiIndex; // 未找到时回退到最新楼层
          };
          
          allSheetKeys.forEach(key => {
              const idx = resolveTargetIndexForSheet(key);
              if (idx === -1) return; // 没有可保存的AI楼层
              
              if (!bucketByIndex[idx]) bucketByIndex[idx] = [];
              bucketByIndex[idx].push(key);
          });
          
          // 如果一个都没匹配到，但存在AI消息，则全部落在最新楼层以避免数据丢失
          if (Object.keys(bucketByIndex).length === 0 && latestAiIndex !== -1) {
              bucketByIndex[latestAiIndex] = [...allSheetKeys];
          }
          
          if (Object.keys(bucketByIndex).length === 0) {
              showToastr_ACU('warning', '找不到AI消息，更改仅保存到内存，未持久化到聊天记录。');
          } else {
              // 2.4 分楼层保存，每层只保存属于该层的表
              for (const [indexStr, keys] of Object.entries(bucketByIndex)) {
                  const idx = parseInt(indexStr, 10);
                  if (Number.isNaN(idx)) continue;
                  await saveIndependentTableToChatHistory_ACU(idx, keys, keys, true);
              }

              // 2.4.5 [关键] 如果本次在可视化编辑器删除了表格，则此处追溯整个聊天记录做“硬删除”
              // 说明：saveIndependentTableToChatHistory_ACU 只会覆盖/追加 keys，不会自动移除旧 keys，因此必须额外做一次全局清理。
              if (typeof purgeSheetKeysFromChatHistoryHard_ACU === 'function' && deletedKeysToPurge_ACU.length > 0) {
                  try {
                      const r = await purgeSheetKeysFromChatHistoryHard_ACU(deletedKeysToPurge_ACU);
                      if (r?.changed) {
                          logDebug_ACU(`[VisualizerDelete] Hard-purged ${deletedKeysToPurge_ACU.length} keys from ${r.changedCount} AI messages.`);
                      }
                      _acuVisState.deletedSheetKeys = [];
                  } catch (e) {
                      logWarn_ACU('[VisualizerDelete] Hard purge failed:', e);
                      // 不清空队列，让用户再次保存时有机会重试
                  }
              }

              // 2.5 所有保存完成后再统一刷新，确保读取最新数据再进行后续操作
              await refreshMergedDataAndNotify_ACU();
              if ($popupInstance_ACU && $popupInstance_ACU.length) {
                  loadTemplatePresetSelect_ACU({ keepGlobalValue: false });
              }
              showToastr_ACU('success', '更改已按原楼层保存到聊天记录！');
          }
      }

      // 3. Trigger UI Update & Worldbook Injection
      await updateReadableLorebookEntry_ACU(true);
      topLevelWindow_ACU.AutoCardUpdaterAPI._notifyTableUpdate();
      if (typeof updateCardUpdateStatusDisplay_ACU === 'function') updateCardUpdateStatusDisplay_ACU();

      // 4. Inheritance Check (已移除旧逻辑)
      // await checkAndPerformInheritance_ACU(templateObj);

      // Close
      closeACUWindow(`${SCRIPT_ID_PREFIX_ACU}-visualizer-window`);
  }

  // --- [Inheritance Logic (Legacy Removed)] ---

  // Direct AI Call helper (simplified version of callCustomOpenAI_ACU for one-off tasks)