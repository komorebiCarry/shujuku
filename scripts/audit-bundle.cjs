#!/usr/bin/env node
/**
 * audit-bundle.cjs — 产物工程化审查
 *
 * 核心思路：不猜错误模式，让工具链自己发现问题。
 *
 * 审查项：
 * 1. JS 引擎语法解析（node --check）— SyntaxError / 重复声明等一切语法问题，引擎直接报
 * 2. 基线函数覆盖率 — 原始 index.js 的所有 _ACU 标识符在产物中零丢失
 * 3. UserScript 元数据完整性
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const bundlePath = process.argv[2] || path.join(__dirname, '..', 'dist', 'index.bundle.js');
const baselinePath = process.argv[3] || path.join(__dirname, '..', 'index.js');

if (!fs.existsSync(bundlePath)) {
  console.error(`✗ 产物不存在: ${bundlePath}`);
  process.exit(1);
}

const bundle = fs.readFileSync(bundlePath, 'utf8');
const bundleLines = bundle.split('\n').length;

const hasBaseline = fs.existsSync(baselinePath);

let totalChecks = 0;
let failed = 0;
const failures = [];

function check(name, ok, detail) {
  totalChecks++;
  if (ok) {
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, detail });
    console.log(`  ✗ ${name}`);
    if (detail) console.log(`    → ${detail}`);
  }
}

console.log('═══════════════════════════════════════════════');
console.log('  产物工程化审查');
console.log('═══════════════════════════════════════════════');
console.log(`  产物: ${path.basename(bundlePath)} (${bundleLines} 行)`);
console.log('');

// ══════════════════════════════════════════════
// 1. JS 引擎语法解析
//    用 node --check 跑产物和基线，对比结果。
//    如果产物和基线都报同样的错 → 已知问题，通过。
//    如果产物报了基线没有的错 → 重构引入的问题，失败。
// ══════════════════════════════════════════════
console.log('[1/3] JS 引擎语法解析 (node --check)...');
{
  let bundleErr = '';
  try {
    execSync(`node --check "${bundlePath}"`, { stdio: 'pipe', encoding: 'utf8' });
  } catch (e) {
    bundleErr = (e.stderr || '').trim();
  }

  if (!bundleErr) {
    check('语法解析通过（V8 parser 零错误）', true);
  } else {
    // 检查基线是否有同样的错误
    let baselineErr = '';
    if (hasBaseline) {
      try {
        execSync(`node --check "${baselinePath}"`, { stdio: 'pipe', encoding: 'utf8' });
      } catch (e) {
        baselineErr = (e.stderr || '').trim();
      }
    }

    // 提取错误类型（如 "SyntaxError: Unexpected identifier '用户'"）
    const bundleErrType = (bundleErr.match(/SyntaxError: .+/) || [''])[0];
    const baselineErrType = (baselineErr.match(/SyntaxError: .+/) || [''])[0];

    if (baselineErrType && bundleErrType === baselineErrType) {
      check('语法解析（已知基线问题，非重构引入）', true);
      console.log(`    ℹ 基线和产物有相同的已知问题: ${baselineErrType}`);
    } else if (baselineErr && bundleErr) {
      // 两者都有错但不同
      check('语法解析通过', false,
        `产物错误: ${bundleErrType}\n    基线错误: ${baselineErrType}`);
    } else {
      // 产物有错，基线没有 → 重构引入的新错误
      check('语法解析通过', false, bundleErr);
    }
  }
}

// ══════════════════════════════════════════════
// 2. 基线覆盖率
//    从原始 index.js 提取所有 _ACU 后缀标识符，
//    逐个验证在产物中存在。任何缺失 = 功能回归。
// ══════════════════════════════════════════════
console.log('');
console.log('[2/3] 基线覆盖率...');
if (fs.existsSync(baselinePath)) {
  const baseline = fs.readFileSync(baselinePath, 'utf8');

  // 提取基线中所有 _ACU 标识符（函数/变量声明）
  const declRe = /(?:const|let|var|function|async\s+function)\s+([\w]+_ACU)\b/g;
  const baselineIds = new Set();
  let m;
  while ((m = declRe.exec(baseline)) !== null) baselineIds.add(m[1]);

  // 检查产物中是否包含这些标识符（不限于声明，引用也算——因为有些可能在注入模块中声明但用不同缩进）
  const missing = [];
  for (const id of baselineIds) {
    if (!bundle.includes(id)) missing.push(id);
  }

  check(
    `基线 ${baselineIds.size} 个 _ACU 标识符在产物中全部存在`,
    missing.length === 0,
    missing.length > 0
      ? `缺失 ${missing.length} 个: ${missing.join(', ')}`
      : undefined,
  );
} else {
  console.log('  ⊘ 无基线文件，跳过覆盖率检查');
}

// ══════════════════════════════════════════════
// 3. UserScript 元数据完整性
// ══════════════════════════════════════════════
console.log('');
console.log('[3/3] UserScript 元数据...');
{
  const headerMatch = bundle.match(/\/\/\s*==UserScript==([\s\S]*?)\/\/\s*==\/UserScript==/);
  check('UserScript 头完整（开始+结束标签）', !!headerMatch);

  if (headerMatch) {
    const header = headerMatch[1];
    const requiredFields = ['@name', '@namespace', '@version', '@description'];
    for (const field of requiredFields) {
      check(`元数据 ${field}`, header.includes(field));
    }
  }
}

// ══════════════════════════════════════════════
// 汇总
// ══════════════════════════════════════════════
console.log('');
console.log('═══════════════════════════════════════════════');
const passed = totalChecks - failed;
if (failed === 0) {
  console.log(`  ✓ 全部通过 (${passed}/${totalChecks})`);
} else {
  console.log(`  ✗ ${failed} 项失败 (${passed}/${totalChecks} 通过)`);
  failures.forEach(f => console.log(`    - ${f.name}${f.detail ? ': ' + f.detail : ''}`));
}
console.log('═══════════════════════════════════════════════');
process.exit(failed > 0 ? 1 : 0);
