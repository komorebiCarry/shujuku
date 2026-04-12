// ═══════════════════════════════════════════════════════════════
// data/index.ts — data 层统一出口
// ═══════════════════════════════════════════════════════════════

// 存储键常量 + Profile 工具函数
export * from './constants';

// 默认常量（char card prompt, table template, plot settings, auto update 阈值等）
// 注意：defaults.ts 已从 tsconfig exclude（巨型 JSON 字符串导致 TS 解析误报），但 rollup 正常编译
// export * from './models/defaults';

// 存储后端
export * from './storage/idb-import-temp';
export * from './storage/tavern-storage';

// 仓库
export * from './repositories/profile-repo';
export * from './repositories/isolation-repo';
export * from './repositories/template-preset-repo';
export * from './repositories/character-settings-repo';
