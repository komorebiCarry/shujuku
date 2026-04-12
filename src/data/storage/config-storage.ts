/**
 * data/storage/config-storage.ts — 统一配置存储门面
 *
 * 对应初版设计 plans/three_layer_refactor_plan.md §3.1 的 config-storage.js。
 * 提供统一的配置存储接口，封装自动降级策略：
 *   酒馆设置 → IndexedDB 缓存 → localStorage（如未禁用）
 *
 * 实际实现在 tavern-storage.ts 的 getConfigStorage_ACU 中。
 * 本文件作为门面层，为未来解耦提供接口稳定性。
 */

export { getConfigStorage_ACU } from './tavern-storage';
export { migrateKeyToTavernStorageIfNeeded_ACU } from './tavern-storage';
