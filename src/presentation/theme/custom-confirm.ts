/**
 * presentation/theme/custom-confirm.ts
 *
 * 与插件 UI 风格一致的自定义确认框，替代原生 confirm()。
 * 返回 Promise<boolean>，调用方在 async 函数中使用 await 即可。
 *
 * 样式复用窗口系统的 CSS 变量（--acu-panel-bg 等）和遮罩层（.acu-window-overlay），
 * 自动兼容双主题（墨色/素纱）。
 *
 * 重要：DOM 挂载到 topLevelWindow_ACU.document（酒馆主窗口），
 * 而非当前 iframe 的 document，与窗口系统（window-system.ts）保持一致。
 */
import { SCRIPT_ID_PREFIX_ACU } from '../../shared/constants';
import { topLevelWindow_ACU } from '../../shared/env';

/** 确认框选项 */
export interface CustomConfirmOptions {
  /** 确认按钮文案（默认"确定"） */
  confirmLabel?: string;
  /** 取消按钮文案（默认"取消"） */
  cancelLabel?: string;
}

/**
 * 获取目标 document（酒馆主窗口），与窗口系统保持一致。
 */
function getTargetDoc(): Document {
  return (topLevelWindow_ACU || window).document;
}

/**
 * 弹出自定义确认框，返回 Promise<boolean>。
 * - 用户点击确认按钮 → resolve(true)
 * - 用户点击取消按钮或点击遮罩层 → resolve(false)
 *
 * @param title 标题
 * @param message 正文（支持换行 \n）
 * @param options 可选配置
 */
export function showCustomConfirm_ACU(
  title: string,
  message: string,
  options: CustomConfirmOptions = {},
): Promise<boolean> {
  const {
    confirmLabel = '确定',
    cancelLabel = '取消',
  } = options;

  const targetDoc = getTargetDoc();

  // 移除可能残留的旧确认框（防止重复）
  removeExistingConfirm();

  const confirmId = `${SCRIPT_ID_PREFIX_ACU}-custom-confirm`;

  // 将 \n 转为 <br>，HTML 转义防止 XSS
  const safeMessage = escapeHtml_ACU(message).replace(/\n/g, '<br>');

  const html = `
    <div class="acu-window-overlay" id="${confirmId}-overlay" style="z-index: 100000;">
      <div id="${confirmId}" style="
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        min-width: 320px;
        max-width: min(420px, calc(100vw - 40px));
        background-color: var(--acu-panel-bg, #24221f);
        border: 1px solid var(--acu-panel-border, #36332e);
        border-radius: 2px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.42);
        animation: acuWindowSlideIn 0.25s ease-out;
        font-family: 'Noto Serif SC', 'Source Han Serif CN', 'Songti SC', 'STSong', 'SimSun', serif;
        color: var(--acu-panel-text, #c1b9ad);
        padding: 0;
        overflow: hidden;
      ">
        <div style="
          padding: 16px 20px 12px 20px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 1px;
          color: var(--acu-panel-text, #c1b9ad);
          border-bottom: 1px solid var(--acu-panel-border, #36332e);
        ">${escapeHtml_ACU(title)}</div>
        <div style="
          padding: 16px 20px;
          font-size: 13px;
          line-height: 1.7;
          color: var(--acu-panel-text-dim, #9e978e);
        ">${safeMessage}</div>
        <div style="
          padding: 12px 20px 16px 20px;
          display: flex;
          justify-content: flex-end;
          gap: 10px;
        ">
          <button id="${confirmId}-cancel" style="
            padding: 8px 18px;
            border: 1px solid var(--acu-panel-border, #36332e);
            border-radius: 1px;
            background: transparent;
            color: var(--acu-panel-text-dim, #9e978e);
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
          ">${escapeHtml_ACU(cancelLabel)}</button>
          <button id="${confirmId}-ok" style="
            padding: 8px 18px;
            border: 1px solid var(--acu-panel-accent, #7d4940);
            border-radius: 1px;
            background: var(--acu-panel-accent, #7d4940);
            color: #fff;
            cursor: pointer;
            font-family: inherit;
            font-size: 13px;
            font-weight: 600;
            letter-spacing: 0.5px;
            transition: background 0.18s ease, border-color 0.18s ease;
          ">${escapeHtml_ACU(confirmLabel)}</button>
        </div>
      </div>
    </div>
  `;

  // 挂载到主窗口（与窗口系统一致），而非当前 iframe
  targetDoc.body.insertAdjacentHTML('beforeend', html);

  // 在主窗口 document 中查找元素
  const $ok = targetDoc.getElementById(`${confirmId}-ok`);
  const $cancel = targetDoc.getElementById(`${confirmId}-cancel`);
  const $overlay = targetDoc.getElementById(`${confirmId}-overlay`);

  // 给按钮加 hover 效果（用 JS 而非 CSS 类，避免污染全局样式）
  if ($ok) {
    $ok.addEventListener('mouseenter', () => {
      $ok.style.opacity = '0.85';
    });
    $ok.addEventListener('mouseleave', () => {
      $ok.style.opacity = '1';
    });
  }
  if ($cancel) {
    $cancel.addEventListener('mouseenter', () => {
      $cancel.style.background = 'var(--acu-panel-hover, #2a2824)';
      $cancel.style.color = 'var(--acu-panel-text, #c1b9ad)';
    });
    $cancel.addEventListener('mouseleave', () => {
      $cancel.style.background = 'transparent';
      $cancel.style.color = 'var(--acu-panel-text-dim, #9e978e)';
    });
  }

  return new Promise<boolean>((resolve) => {
    const cleanup = (result: boolean) => {
      removeExistingConfirm();
      resolve(result);
    };

    $ok?.addEventListener('click', () => cleanup(true));
    $cancel?.addEventListener('click', () => cleanup(false));
    $overlay?.addEventListener('click', (e) => {
      if (e.target === $overlay) cleanup(false);
    });
  });
}

/** 移除已有的自定义确认框 DOM（从主窗口中查找并移除） */
function removeExistingConfirm(): void {
  const confirmId = `${SCRIPT_ID_PREFIX_ACU}-custom-confirm`;
  const targetDoc = getTargetDoc();
  const existing = targetDoc.getElementById(`${confirmId}-overlay`);
  if (existing) existing.remove();
}

/** 简易 HTML 转义（使用主窗口 document 创建元素） */
function escapeHtml_ACU(text: string): string {
  const targetDoc = getTargetDoc();
  const div = targetDoc.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
