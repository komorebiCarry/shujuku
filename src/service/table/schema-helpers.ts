/**
 * service/table/schema-helpers.ts — DDL/Schema 工具函数的 service 层 re-export
 *
 * presentation 层不应直接引用 data 层，通过此文件中转。
 */
export { parseDDLTableName, parseDDLColumnNames, updateDDLColumnComment } from '../../data/sqlite/schema-mapper';
