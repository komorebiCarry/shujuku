/**
 * service/runtime/event-bus.ts — ACU_EventBus 事件总线
 *
 * 轻量级发布/订阅事件总线，用于表示层与服务层之间的解耦通信。
 * 表示层 emit 事件，服务层 on 监听并处理。
 *
 * 参见初版设计 plans/three_layer_refactor_plan.md §5.3
 */

type EventHandler = (...args: unknown[]) => void;

const _handlers: Record<string, EventHandler[]> = {};

export const ACU_EventBus = {
    /**
     * 注册事件监听器
     */
    on(event: string, handler: EventHandler): void {
        if (!_handlers[event]) _handlers[event] = [];
        _handlers[event].push(handler);
    },

    /**
     * 移除事件监听器
     */
    off(event: string, handler: EventHandler): void {
        const list = _handlers[event];
        if (!list) return;
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
    },

    /**
     * 触发事件
     */
    emit(event: string, ...args: unknown[]): void {
        const list = _handlers[event];
        if (!list) return;
        for (const handler of list) {
            try { handler(...args); } catch (e) {
                console.error(`[ACU_EventBus] Error in handler for "${event}":`, e);
            }
        }
    },

    /**
     * 注册一次性监听器
     */
    once(event: string, handler: EventHandler): void {
        const wrapper = (...args: unknown[]) => {
            ACU_EventBus.off(event, wrapper);
            handler(...args);
        };
        ACU_EventBus.on(event, wrapper);
    },

    /**
     * 清除指定事件的所有监听器（调试用）
     */
    clear(event?: string): void {
        if (event) { delete _handlers[event]; }
        else { Object.keys(_handlers).forEach(k => delete _handlers[k]); }
    }
};
