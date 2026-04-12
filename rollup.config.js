/**
 * rollup.config.js — 纯模块构建
 *
 * 所有代码从 src/shared/, src/data/, src/service/, src/presentation/ 的 TS/JS 模块编译注入。
 * 产物结构：UserScript 头 → IIFE 包裹 → 模块代码 → $(function(){ mainInitialize_ACU(); });
 * 不再有 buildOrder / concat 模式。
 */
import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════
// UserScript 头（固定，不再从源文件提取）
// ═══════════════════════════════════════════════════════════════
const USER_SCRIPT_BANNER = `// ==UserScript==
// @name         数据库-可定制副本
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  为不同的角色卡提供独立的、使用不同默认模板的数据库。通过修改 @name 和 UNIQUE_SCRIPT_ID 来创建互不干扰的副本。
// @author       Cline (AI Assisted)
// @match        */*
// @grant        none
// @注释掉的require  https://code.jquery.com/jquery-3.7.1.min.js
// @注释掉的require  https://cdnjs.cloudflare.com/ajax/libs/toastr.js/latest/toastr.min.js
// ==/UserScript==`;

// ═══════════════════════════════════════════════════════════════
// 模块列表（按依赖顺序排列）
// 构建时 TS → JS 编译，去掉 export/import，注入到 IIFE 闭包内
// ═══════════════════════════════════════════════════════════════
const modules = [
  // --- shared ---
  { path: 'src/shared/constants.ts' },
  { path: 'src/shared/env.ts' },
  { path: 'src/shared/service-locator.ts' },
  { path: 'src/shared/utils.ts' },
  { path: 'src/shared/json-helpers.ts' },
  { path: 'src/shared/html-helpers.ts' },
  { path: 'src/shared/text-optimization.ts' },
  // --- data ---
  { path: 'src/data/constants.ts' },
  { path: 'src/data/storage/idb-import-temp.ts' },
  { path: 'src/data/storage/tavern-storage.ts' },
  { path: 'src/data/storage/chat-history.ts' },
  { path: 'src/data/models/defaults.ts' },
  { path: 'src/data/models/defaults-json.js' },
  { path: 'src/data/repositories/profile-repo.ts' },
  { path: 'src/data/repositories/isolation-repo.ts' },
  { path: 'src/data/repositories/template-preset-repo.ts' },
  { path: 'src/data/repositories/character-settings-repo.ts' },
  { path: 'src/data/repositories/table-repo.ts' },
  // --- service ---
  { path: 'src/service/settings/settings-service.ts' },
  { path: 'src/service/ai/api-call.ts' },
  { path: 'src/service/ai/prompt-builder.ts' },
  { path: 'src/service/table/update-process.ts' },
  { path: 'src/service/worldbook/pipeline.ts' },
  { path: 'src/service/worldbook/injection-engine.ts' },
  { path: 'src/service/data-admin/admin.ts' },
  { path: 'src/service/summary/merge-logic.ts' },
  { path: 'src/service/import/import-process.ts' },
  { path: 'src/service/runtime/init.ts' },
  { path: 'src/service/runtime/state-manager.ts' },
  { path: 'src/service/runtime/event-bus.ts' },
  { path: 'src/service/runtime/helpers-remaining.ts' },
  { path: 'src/service/runtime/api-registry.ts' },
  { path: 'src/service/template/chat-scope.ts' },
  { path: 'src/service/optimization/content-optimization.ts' },
  // --- presentation ---
  { path: 'src/presentation/window/window-system.ts' },
  { path: 'src/presentation/theme/toast.ts' },
  { path: 'src/presentation/components/table-selector.ts' },
  { path: 'src/presentation/components/plot-editors.ts' },
  { path: 'src/presentation/components/status-display.ts' },
  { path: 'src/presentation/bootstrap/startup.ts' },
  { path: 'src/presentation/components/update-controls.ts' },
  { path: 'src/presentation/components/worldbook-selectors.ts' },
  { path: 'src/presentation/pages/main-popup.ts' },
  { path: 'src/presentation/pages/visualizer.ts' },
  { path: 'src/presentation/components/template-preset-ui.ts' },
  { path: 'src/presentation/components/optimization-ui.ts' },
  { path: 'src/presentation/components/worldbook-selector.ts' },
  { path: 'src/presentation/components/update-status-display.ts' },
  { path: 'src/presentation/components/import-status-ui.ts' },
  { path: 'src/presentation/triggers/update-trigger.ts' },
  { path: 'src/presentation/triggers/data-admin-ui.ts' },
];

// ═══════════════════════════════════════════════════════════════
// 构建插件：编译模块 → 组装 IIFE 产物
// ═══════════════════════════════════════════════════════════════
function moduleAssemblyPlugin() {
  return {
    name: 'module-assembly',
    resolveId(source) {
      if (source === 'virtual:module-entry') return source;
      return null;
    },
    load(id) {
      if (id === 'virtual:module-entry') {
        return 'export default null;';
      }
      return null;
    },
    generateBundle(options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        delete bundle[fileName];
      }

      // 1. 编译所有模块 TS/JS → JS
      const esmRequire = createRequire(import.meta.url);
      const ts = esmRequire('typescript');
      const compiledParts = [];

      for (const mod of modules) {
        const source = readFileSync(join(__dirname, mod.path), 'utf8').replace(/\r\n/g, '\n');
        let jsCode;

        if (mod.path.endsWith('.js')) {
          jsCode = source;
        } else {
          const result = ts.transpileModule(source, {
            compilerOptions: {
              target: ts.ScriptTarget.ES2020,
              module: ts.ModuleKind.ESNext,
              removeComments: false,
              strict: false,
            },
          });
          jsCode = result.outputText;
        }

        // 去掉 export/import（闭包内函数名自动可见）
        jsCode = jsCode.replace(/^export\s+(async\s+)?function\s/gm, '$1function ');
        jsCode = jsCode.replace(/^export\s+const\s/gm, 'const ');
        jsCode = jsCode.replace(/^export\s+let\s/gm, 'let ');
        jsCode = jsCode.replace(/^export\s+var\s/gm, 'var ');
        jsCode = jsCode.replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '');
        jsCode = jsCode.replace(/^import\s+.*;\s*$/gm, '');

        compiledParts.push(`// ── [module] ${mod.path} ──\n${jsCode}`);
      }

      const modulesCode = compiledParts.join('\n\n');

      // 2. 组装最终产物
      const result = [
        USER_SCRIPT_BANNER,
        '',
        '(function () {',
        "  'use strict';",
        "  console.log('ACU_SCRIPT_DEBUG: AutoCardUpdater script execution started.');",
        '',
        '// ════════════════════════════════════════════════════════',
        '// [rollup:module] 以下为模块编译注入',
        '// ════════════════════════════════════════════════════════',
        modulesCode,
        '// ════════════════════════════════════════════════════════',
        '// [rollup:module] 模块注入结束',
        '// ════════════════════════════════════════════════════════',
        '',
        "  $(function() {",
        "      console.log('ACU_INIT_DEBUG: Document is ready, attempting to initialize ACU script.');",
        "      mainInitialize_ACU();",
        "  });",
        '',
        '})();',
        '',
      ].join('\n');

      // 3. 写入
      const distDir = join(__dirname, 'dist');
      mkdirSync(distDir, { recursive: true });
      writeFileSync(join(distDir, 'index.bundle.js'), result, 'utf8');

      console.log(`[rollup:module] 输出 dist/index.bundle.js (${result.split('\n').length} 行) [${modules.length} 个模块]`);
    },
  };
}

export default {
  input: 'virtual:module-entry',
  plugins: [moduleAssemblyPlugin()],
  output: {
    dir: 'dist',
    format: 'es',
  },
};
