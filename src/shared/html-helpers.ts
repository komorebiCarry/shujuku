/**
 * shared/html-helpers.ts — HTML 工具函数
 *
 * 零副作用、零全局依赖、零 DOM 操作。
 * 从 src/ui/03_theme_and_toast.js 和 src/core/02_storage_and_profile.js 迁移而来。
 */

/**
 * HTML 特殊字符转义（防 XSS）
 */
export function escapeHtml_ACU(unsafe: string): string {
  if (typeof unsafe !== 'string' || !unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
