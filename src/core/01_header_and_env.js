// ==UserScript==
// @name         数据库-可定制副本
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  为不同的角色卡提供独立的、使用不同默认模板的数据库。通过修改 @name 和 UNIQUE_SCRIPT_ID 来创建互不干扰的副本。
// @author       Cline (AI Assisted)
// @match        */*
// @grant        none
// @注释掉的require  https://code.jquery.com/jquery-3.7.1.min.js
// @注释掉的require  https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js
// ==/UserScript==

(function () {
  'use strict';
  console.log('ACU_SCRIPT_DEBUG: AutoCardUpdater script execution started.'); // Very first log

  // --- 安全存储 & 顶层窗口 ---
  const topLevelWindow_ACU = (typeof window.parent !== 'undefined' ? window.parent : window);

  // --- 存储策略 ---
  // - 主存：写入 SillyTavern 服务端设置（extensionSettings + saveSettings），同一酒馆服务端下所有浏览器一致。
  // - 本地副本：同时写入 IndexedDB（仅本浏览器可用，用作酒馆设置读取失败时的回退）。
  // - 读取顺序：酒馆设置 -> IndexedDB -> 默认设置。
  // - 禁止 localStorage / sessionStorage（除非手动关闭禁用开关）。
  const FORBID_BROWSER_LOCAL_STORAGE_FOR_CONFIG_ACU = true;
  const ALLOW_LEGACY_LOCALSTORAGE_MIGRATION_ACU = false; // 如需把旧 localStorage 设置迁移到酒馆设置，可改为 true（迁移后仍不再写 localStorage）

  // legacyLocalStorage_ACU：仅用于“可选迁移”，不是配置持久化后端
  let legacyLocalStorage_ACU = null;
  try { legacyLocalStorage_ACU = topLevelWindow_ACU.localStorage; } catch (e) { legacyLocalStorage_ACU = null; }

  // storage_ACU：旧代码里大量把它当作“配置存储”。现在默认是一个 NO-OP 存储，避免任何本地持久化。
  // 真实持久化后端请走 getConfigStorage_ACU()（优先写入酒馆设置）。
  let storage_ACU = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
  };

  if (!FORBID_BROWSER_LOCAL_STORAGE_FOR_CONFIG_ACU) {
      try {
          storage_ACU = topLevelWindow_ACU.localStorage;
      } catch (e) {
          console.error('[AutoCardUpdater] localStorage is not available. Settings will not be saved.', e);
          storage_ACU = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
      }
  }

  // --- 脚本配置常量 ---
  const DEBUG_MODE_ACU = true; // Keep this true for now for user debugging

  // --- [核心改造] 唯一标识符 ---
  // !!! 重要: 如果您想创建此脚本的独立副本（例如，为不同角色使用不同模板），
  // !!! 请将下面的 'biaozhunbanv2_v1' 更改为一个【全新的、唯一的】英文名称。
  // !!! 例如: 'my_sci_fi_db', 'fantasy_world_db' 等。
  // !!! 同时，请务必修改上面的 @name 以便在菜单中区分它们。
  const UNIQUE_SCRIPT_ID = 'shujuku_v120'; // <--- 为每个副本修改这里
  const SCRIPT_ID_PREFIX_ACU = UNIQUE_SCRIPT_ID;

  const POPUP_ID_ACU = `${SCRIPT_ID_PREFIX_ACU}-popup`;
  const MENU_ITEM_ID_ACU = `${SCRIPT_ID_PREFIX_ACU}-menu-item`;

  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ 独立窗口系统 - 不依赖酒馆 callGenericPopup ███
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // 窗口管理器：追踪所有打开的窗口实例