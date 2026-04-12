/**
 * data/repositories/settings-repo.ts — 设置读写 Repository
 *
 * 对应初版设计 plans/three_layer_refactor_plan.md §3.1 的 settings-repo.js。
 * 当前阶段：re-export 门面，实际读写逻辑在 service/settings/settings-service.ts 中。
 * 后续去掉 IIFE 后，将从 settings-service 拆出纯数据读写部分到此处。
 */

export { saveSettings_ACU, loadSettings_ACU } from '../../service/settings/settings-service';
