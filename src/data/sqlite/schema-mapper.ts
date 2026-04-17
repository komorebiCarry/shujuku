/**
 * data/sqlite/schema-mapper.ts — Sheet ↔ SQL 双向映射
 *
 * 职责：
 * - Sheet → SQL：生成 DDL + INSERT 语句
 * - SQL → Sheet：SELECT 结果 → content 二维数组
 * - 处理类型亲和性转换（content 全是 string，SQL 有类型）
 * - DDL 解析（表名、中文名、列信息）
 */

import type { Sheet_ACU } from '../../shared/models/table-data';
import { logDebug_ACU, logError_ACU, logWarn_ACU } from '../../shared/utils';

// ═══════════════════════════════════════════════════════════════
// DDL 生成
// ═══════════════════════════════════════════════════════════════

/**
 * 从 Sheet 生成建表 DDL
 * 优先使用 sourceData.ddl，fallback 为全 TEXT 的自动生成 DDL
 *
 * @param sheet Sheet 对象
 * @param fallbackTableName fallback 时使用的英文表名（默认用 sheet.uid）
 * @returns CREATE TABLE 语句
 */
export function generateDDL(sheet: Sheet_ACU, fallbackTableName?: string): string {
  // 优先使用用户定义的 DDL
  const ddl = sheet.sourceData?.ddl?.trim();
  if (ddl) {
    logDebug_ACU(`[Schema] generateDDL: 使用用户定义 DDL, 表名=${parseDDLTableName(ddl) || 'unknown'}`);
    return ddl;
  }

  // fallback：从 content[0] 表头自动生成全 TEXT 的 DDL
  const headers = sheet.content?.[0];
  if (!Array.isArray(headers) || headers.length === 0) {
    const tblName = fallbackTableName || sheet.uid || 'unknown_table';
    return `CREATE TABLE ${sanitizeIdentifier(tblName)} (\n  row_id INTEGER PRIMARY KEY -- 行号\n);`;
  }

  const tblName = fallbackTableName || sheet.uid || 'unknown_table';
  return generateFallbackDDL(sanitizeIdentifier(tblName), headers);
}

/**
 * 从 content[0] 表头自动生成全 TEXT 的 fallback DDL
 * 第一列 "row_id" 映射为 INTEGER PRIMARY KEY
 * 其余列全部为 TEXT
 *
 * @param tableName 英文表名
 * @param headers content[0] 表头行
 * @returns CREATE TABLE 语句
 */
export function generateFallbackDDL(tableName: string, headers: (string | null)[]): string {
  const lines: string[] = [];

  for (let i = 0; i < headers.length; i++) {
    const colName = headers[i];
    if (colName === 'row_id') {
      lines.push('  row_id INTEGER PRIMARY KEY -- 行号');
    } else if (colName) {
      // 中文列名转为合法的 SQL 标识符
      const sqlColName = chineseToIdentifier(colName);
      lines.push(`  ${sqlColName} TEXT -- ${colName}`);
    }
  }

  if (lines.length === 0) {
    lines.push('  row_id INTEGER PRIMARY KEY -- 行号');
  }

  // 逗号必须放在注释之前（-- 注释到行尾，逗号在注释后会被注释掉）
  // 格式：column_def, -- 注释
  const formattedLines = lines.map((line, idx) => {
    if (idx < lines.length - 1) {
      // 非最后一行：在注释前插入逗号
      const commentIdx = line.indexOf('--');
      if (commentIdx > 0) {
        return line.substring(0, commentIdx).trimEnd() + ', ' + line.substring(commentIdx);
      }
      return line + ',';
    }
    return line; // 最后一行不加逗号
  });

  return `CREATE TABLE ${sanitizeIdentifier(tableName)} (\n${formattedLines.join('\n')}\n);`;
}

// ═══════════════════════════════════════════════════════════════
// INSERT 生成
// ═══════════════════════════════════════════════════════════════

/**
 * 从 Sheet 生成 INSERT 语句（灌入 content 数据）
 * content[0] 是表头，content[1:] 是数据行
 *
 * @param sheet Sheet 对象
 * @param tableName SQL 表名（如果不传，从 DDL 解析或用 sheet.uid）
 * @returns INSERT 语句数组（每行一条）
 */
export function generateInserts(sheet: Sheet_ACU, tableName?: string): string[] {
  const content = sheet.content;
  if (!Array.isArray(content) || content.length < 2) return [];

  const headers = content[0];
  if (!Array.isArray(headers) || headers.length === 0) return [];

  // 确定表名
  const tblName = tableName
    || parseDDLTableName(sheet.sourceData?.ddl || '')
    || sheet.uid
    || 'unknown_table';

  logDebug_ACU(`[Schema] generateInserts: 表=${tblName}, 数据行数=${content.length - 1}`);

  // 确定列名（从 DDL 解析，或从表头生成）
  const ddlColumns = sheet.sourceData?.ddl ? parseDDLColumnNames(sheet.sourceData.ddl) : null;
  const columnNames = ddlColumns || headers.map((h, i) => {
    if (h === 'row_id') return 'row_id';
    return h ? chineseToIdentifier(h) : `col_${i}`;
  });

  const statements: string[] = [];

  for (let r = 1; r < content.length; r++) {
    const row = content[r];
    if (!Array.isArray(row)) continue;

    const values: string[] = [];
    for (let c = 0; c < columnNames.length; c++) {
      const val = c < row.length ? row[c] : null;
      values.push(escapeValue(val));
    }

    statements.push(
      `INSERT INTO ${sanitizeIdentifier(tblName)} (${columnNames.map(sanitizeIdentifier).join(', ')}) VALUES (${values.join(', ')});`
    );
  }

  return statements;
}

// ═══════════════════════════════════════════════════════════════
// SQL 结果 → content 转换
// ═══════════════════════════════════════════════════════════════

/**
 * 从 SQL 查询结果还原为 content 二维数组
 * 自动将 SQL 类型值转为 string（content 的存储格式）
 *
 * @param columns SQL 结果的列名数组
 * @param values SQL 结果的值数组
 * @param chineseHeaders 中文表头映射（列名 → 中文名），用于还原 content[0]
 * @returns content 二维数组（第一行是表头，后续是数据行）
 */
export function resultToContent(
  columns: string[],
  values: SqlJsValueType[][],
  chineseHeaders?: Map<string, string>
): (string | null)[][] {
  if (columns.length === 0) return [['row_id']];

  // 构建表头行：用中文名（如果有映射），否则用 SQL 列名
  const headerRow: (string | null)[] = columns.map(col => {
    if (col === 'row_id') return 'row_id';
    return chineseHeaders?.get(col) || col;
  });

  // 构建数据行：所有值转为 string
  const dataRows: (string | null)[][] = values.map(row =>
    row.map(val => valueToString(val))
  );

  return [headerRow, ...dataRows];
}

// ═══════════════════════════════════════════════════════════════
// DDL 校验
// ═══════════════════════════════════════════════════════════════

/**
 * 校验 DDL 列名与 content[0] 表头是否匹配
 * 比较的是列数和列的对应关系（通过 DDL 注释中的中文名匹配）
 *
 * @param ddl CREATE TABLE 语句
 * @param headers content[0] 表头行
 * @returns 校验结果
 */
export function validateDDLAgainstHeaders(
  ddl: string,
  headers: (string | null)[]
): { valid: boolean; mismatches: string[] } {
  const ddlColumns = parseDDLColumnNames(ddl);
  const ddlComments = parseDDLColumnComments(ddl);
  const mismatches: string[] = [];

  // 列数检查
  const filteredHeaders = headers.filter(h => h !== null);
  if (ddlColumns.length !== filteredHeaders.length) {
    mismatches.push(
      `列数不匹配: DDL 有 ${ddlColumns.length} 列, content 表头有 ${filteredHeaders.length} 列`
    );
  }

  // 逐列检查：DDL 注释中的中文名应该和 content 表头对应
  for (let i = 0; i < Math.min(ddlColumns.length, filteredHeaders.length); i++) {
    const header = filteredHeaders[i];
    const ddlCol = ddlColumns[i];
    const ddlComment = ddlComments.get(ddlCol);

    // row_id 列特殊处理
    if (ddlCol === 'row_id' && header === 'row_id') continue;

    // 如果 DDL 有注释，检查注释是否和表头匹配
    if (ddlComment && header && ddlComment !== header) {
      mismatches.push(
        `第 ${i + 1} 列不匹配: DDL 列 "${ddlCol}" 注释 "${ddlComment}" ≠ 表头 "${header}"`
      );
    }
  }

  return { valid: mismatches.length === 0, mismatches };
}

// ═══════════════════════════════════════════════════════════════
// DDL 解析工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从 DDL 中解析英文表名
 * @param ddl CREATE TABLE 语句
 * @returns 表名，解析失败返回 null
 */
export function parseDDLTableName(ddl: string): string | null {
  if (!ddl) return null;
  // 匹配 CREATE TABLE [IF NOT EXISTS] table_name
  const match = ddl.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/i);
  return match ? match[1] : null;
}

/**
 * 从 DDL 第一行注释中解析中文表名
 * 格式：CREATE TABLE table_name ( -- 中文表名
 * @param ddl CREATE TABLE 语句
 * @returns 中文表名，解析失败返回 null
 */
export function parseDDLChineseName(ddl: string): string | null {
  if (!ddl) return null;
  // 匹配第一行的 -- 注释
  const firstLine = ddl.split('\n')[0];
  const match = firstLine.match(/--\s*(.+?)\s*$/);
  return match ? match[1].trim() : null;
}

/**
 * 从 DDL 中解析所有列名（按顺序）
 * @param ddl CREATE TABLE 语句
 * @returns 列名数组
 */
export function parseDDLColumnNames(ddl: string): string[] {
  if (!ddl) return [];
  const columns: string[] = [];

  // 提取括号内的列定义部分
  const bodyMatch = ddl.match(/\(([^]*)\)/);
  if (!bodyMatch) return [];

  const body = bodyMatch[1];
  // 按逗号分割（但要注意括号内和注释内的逗号）
  const lines = splitColumnDefinitions(body);

  for (const line of lines) {
    // 去掉行注释（-- 到行尾），然后取最后一个非注释行的内容
    const withoutComments = line.replace(/--[^\n]*/g, '').trim();
    if (!withoutComments) continue;
    // 跳过表级约束（PRIMARY KEY、FOREIGN KEY、UNIQUE、CHECK、CONSTRAINT）
    if (/^(?:PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|CONSTRAINT)\b/i.test(withoutComments)) continue;
    // 提取列名（第一个标识符）
    const colMatch = withoutComments.match(/^(\w+)/);
    if (colMatch) {
      columns.push(colMatch[1]);
    }
  }

  return columns;
}

/**
 * 从 DDL 中解析列名 → 注释的映射
 * 格式：column_name TYPE ... -- 注释
 * @param ddl CREATE TABLE 语句
 * @returns Map<列名, 注释>
 */
export function parseDDLColumnComments(ddl: string): Map<string, string> {
  const comments = new Map<string, string>();
  if (!ddl) return comments;

  const bodyMatch = ddl.match(/\(([^]*)\)/);
  if (!bodyMatch) return comments;

  const body = bodyMatch[1];
  // 按行分割（注释是行级概念，标准 SQL 中 `-- 注释` 到行尾）
  // 而非按 splitColumnDefinitions 分割（逗号在注释之前，会截断注释）
  const lines = body.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // 匹配 column_name ... -- 注释（行内可能有逗号、CHECK 约束等）
    const match = trimmed.match(/^(\w+)\s+.*?--\s*(.+?)\s*,?\s*$/);
    if (match) {
      comments.set(match[1], match[2]);
    }
  }

  return comments;
}

/**
 * 构建 DDL 列名 → 中文名的双向映射
 * @param ddl CREATE TABLE 语句
 * @returns { sqlToChinese: Map<英文列名, 中文名>, chineseToSql: Map<中文名, 英文列名> }
 */
export function buildColumnNameMap(ddl: string): {
  sqlToChinese: Map<string, string>;
  chineseToSql: Map<string, string>;
} {
  const comments = parseDDLColumnComments(ddl);
  const sqlToChinese = new Map<string, string>();
  const chineseToSql = new Map<string, string>();

  for (const [colName, comment] of comments) {
    sqlToChinese.set(colName, comment);
    chineseToSql.set(comment, colName);
  }

  return { sqlToChinese, chineseToSql };
}

/**
 * 根据列在 DDL 中的位置索引获取英文列名
 * 索引从 0 开始，对应 content[0] 中的位置（包含 row_id）
 *
 * @param ddl CREATE TABLE 语句
 * @param index 列索引（对应 content[0] 的位置，0 通常是 row_id）
 * @returns 英文列名，找不到返回 null
 */
export function getDDLColumnNameByIndex(ddl: string, index: number): string | null {
  const columns = parseDDLColumnNames(ddl);
  if (index < 0 || index >= columns.length) return null;
  return columns[index];
}

/**
 * 更新 DDL 中指定列的注释（中文名）
 * 按行扫描 DDL，找到指定列名的行，替换其 `-- 注释` 部分。
 * 如果该行没有注释，则在行尾添加 `-- 新注释`。
 *
 * @param ddl 原始 CREATE TABLE 语句
 * @param columnName 要更新注释的英文列名
 * @param newComment 新的注释内容（中文名）
 * @returns 更新后的 DDL 字符串；如果找不到列名则返回原 DDL
 */
export function updateDDLColumnComment(ddl: string, columnName: string, newComment: string): string {
  if (!ddl || !columnName || !newComment) return ddl;

  const lines = ddl.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // 检查该行是否以目标列名开头（列定义行）
    const colMatch = trimmed.match(/^(\w+)\s+/);
    if (!colMatch || colMatch[1] !== columnName) continue;

    // 找到目标列，替换或添加注释
    found = true;
    const line = lines[i];

    // 情况 1：行内已有 `-- 注释`，替换注释内容
    const commentMatch = line.match(/^(.*?)(--\s*).+?(,?\s*)$/);
    if (commentMatch) {
      lines[i] = `${commentMatch[1]}-- ${newComment}${commentMatch[3]}`;
      break;
    }

    // 情况 2：行内没有注释，需要添加
    // 先检查行尾是否有逗号
    const trailingCommaMatch = line.match(/^(.*?)(,\s*)$/);
    if (trailingCommaMatch) {
      // 有逗号：在逗号前插入注释 → `  col TEXT, -- 注释`
      // 按照项目约定格式：逗号在注释前 → `  col TEXT, -- 注释`
      lines[i] = `${trailingCommaMatch[1]}, -- ${newComment}`;
    } else {
      // 无逗号（最后一列）：直接在行尾添加注释
      lines[i] = `${line.trimEnd()} -- ${newComment}`;
    }
    break;
  }

  if (!found) {
    logWarn_ACU(`[Schema] updateDDLColumnComment: 未找到列 "${columnName}"，DDL 未修改`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// 内部工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 将 SQL 值转为 content 中的 string 格式
 * null → null, number → string, Uint8Array → "[BLOB]", string → string
 */
function valueToString(val: SqlJsValueType): string | null {
  if (val === null || val === undefined) return null;
  if (val instanceof Uint8Array) return '[BLOB]';
  return String(val);
}

/**
 * 将 content 中的值转为 SQL 字面量
 * null/undefined → NULL, 数字字符串 → 数字, 其他 → 带引号的字符串
 */
function escapeValue(val: string | null | undefined): string {
  if (val === null || val === undefined || val === '') return 'NULL';
  // 纯数字（整数或浮点数）直接输出
  if (/^-?\d+(\.\d+)?$/.test(val)) return val;
  // 字符串：单引号转义
  return `'${val.replace(/'/g, "''")}'`;
}

/**
 * 清理 SQL 标识符（防止注入）
 * 只保留字母、数字、下划线
 */
function sanitizeIdentifier(name: string): string {
  // 如果已经是合法标识符，直接返回
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return name;
  // 否则去掉非法字符
  const cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
  return cleaned || '_unknown';
}

/**
 * 将中文列名转为合法的 SQL 标识符
 * 使用拼音首字母或简单的 col_N 格式
 */
function chineseToIdentifier(name: string): string {
  if (!name) return '_unknown';
  // 如果已经是合法标识符，直接返回
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) return name;
  // 中文名：用下划线连接的 ASCII 化
  const ascii = name.replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  if (ascii && /^[a-zA-Z_]/.test(ascii)) return ascii;
  // 实在不行就用 col_ 前缀
  return `col_${ascii || 'unknown'}`;
}

/**
 * 分割 DDL 括号内的列定义（处理嵌套括号）
 */
function splitColumnDefinitions(body: string): string[] {
  const results: string[] = [];
  let current = '';
  let depth = 0;
  let inLineComment = false;

  for (let i = 0; i < body.length; i++) {
    const char = body[i];

    // 检测 -- 行注释开始
    if (!inLineComment && char === '-' && i + 1 < body.length && body[i + 1] === '-') {
      inLineComment = true;
      current += char;
      continue;
    }

    // 换行符结束行注释
    if (inLineComment && char === '\n') {
      inLineComment = false;
      current += char;
      continue;
    }

    // 在行注释内，所有字符直接追加（包括逗号）
    if (inLineComment) {
      current += char;
      continue;
    }

    if (char === '(') {
      depth++;
      current += char;
    } else if (char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      results.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    results.push(current);
  }

  return results;
}
