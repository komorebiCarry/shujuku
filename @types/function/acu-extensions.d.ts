/**
 * ACU 项目对 SillyTavern 类型定义的扩展
 * 补充 @types/iframe/exported.sillytavern.d.ts 中未覆盖的属性
 */

/** 扩展 SillyTavern 的 ChatMessage 类型，添加 ACU 自定义属性 */
declare namespace SillyTavern {
    interface ChatMessage {
        /** ACU 隔离数据 */
        TavernDB_ACU_IsolatedData?: Record<string, unknown>;
        /** ACU 身份标识 */
        TavernDB_ACU_Identity?: Record<string, unknown>;
        /** ACU 独立数据 */
        TavernDB_ACU_IndependentData?: Record<string, unknown>;
        /** ACU 摘要数据 */
        TavernDB_ACU_SummaryData?: Record<string, unknown>;
        /** ACU 数据 */
        TavernDB_ACU_Data?: Record<string, unknown>;
        /** 剧情处理标记 */
        _plot_processed?: boolean;
        /** QRF 来自规划标记 */
        _qrf_from_planning?: boolean;
        /** QRF 剧情待处理哈希 */
        _qrf_plot_pending_hash?: string;
    }
}

/**
 * 扩展 SillyTavern 全局常量的类型定义
 * 补充 exported.sillytavern.d.ts 中未声明的属性
 */
declare const SillyTavern: {
    /** SillyTavern 的 Chat 数组（大写 C，某些版本的 API 使用） */
    readonly Chat?: SillyTavern.ChatMessage[];
    /** 设置聊天消息 */
    readonly setChatMessages?: (messages: SillyTavern.ChatMessage[]) => Promise<void>;
    /** 获取世界书列表 */
    readonly getWorldBooks?: () => Promise<Record<string, unknown>[]>;
    /** 当前角色 ID（数字索引） */
    readonly this_chid?: number;
} & typeof SillyTavern;
