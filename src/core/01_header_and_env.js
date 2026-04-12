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

  // [已迁移到 src/shared/env.ts] topLevelWindow_ACU, FORBID_BROWSER_LOCAL_STORAGE_FOR_CONFIG_ACU, ALLOW_LEGACY_LOCALSTORAGE_MIGRATION_ACU, legacyLocalStorage_ACU, storage_ACU
  // [已迁移到 src/shared/constants.ts] DEBUG_MODE_ACU, UNIQUE_SCRIPT_ID, SCRIPT_ID_PREFIX_ACU, POPUP_ID_ACU, MENU_ITEM_ID_ACU

  // ═══════════════════════════════════════════════════════════════════════════════
  // ███ 独立窗口系统 - 不依赖酒馆 callGenericPopup ███
  // ═══════════════════════════════════════════════════════════════════════════════
  
  // 窗口管理器：追踪所有打开的窗口实例