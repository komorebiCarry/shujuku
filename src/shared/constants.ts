/**
 * shared/constants.ts — 环境常量
 *
 * 纯常量定义，不依赖运行时环境。
 * 从 src/core/01_header_and_env.js 迁移而来。
 */

/** 调试模式开关 */
export const DEBUG_MODE_ACU = true;

/**
 * 唯一脚本标识符
 * 重要：如需创建独立副本，请修改此值为全新的唯一英文名称
 */
export const UNIQUE_SCRIPT_ID = 'shujuku_v120';

/** 脚本 ID 前缀（等同于 UNIQUE_SCRIPT_ID） */
export const SCRIPT_ID_PREFIX_ACU = UNIQUE_SCRIPT_ID;

/** 主弹窗 ID */
export const POPUP_ID_ACU = `${SCRIPT_ID_PREFIX_ACU}-popup`;

/** 菜单项 ID */
export const MENU_ITEM_ID_ACU = `${SCRIPT_ID_PREFIX_ACU}-menu-item`;
