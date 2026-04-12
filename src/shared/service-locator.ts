/**
 * shared/service-locator.ts — ACU_Services 服务定位器
 *
 * 轻量级服务注册表，各层在初始化时注册服务实例，
 * 其他层通过 ACU_Services.get('name') 获取。
 * 为未来去掉 IIFE、引入真正模块系统打基础。
 *
 * 参见初版设计 plans/three_layer_refactor_plan.md §5.1
 */

interface ServiceRegistry {
    [name: string]: unknown;
}

const _registry: ServiceRegistry = {};

export const ACU_Services = {
    /**
     * 注册一个服务实例
     * @param name 服务名称（如 'tableRepo', 'settingsService'）
     * @param instance 服务实例
     */
    register(name: string, instance: unknown): void {
        _registry[name] = instance;
    },

    /**
     * 获取已注册的服务实例
     * @param name 服务名称
     * @returns 服务实例，未注册时返回 undefined
     */
    get<T = unknown>(name: string): T | undefined {
        return _registry[name] as T | undefined;
    },

    /**
     * 检查服务是否已注册
     * @param name 服务名称
     */
    has(name: string): boolean {
        return name in _registry;
    },

    /**
     * 获取所有已注册的服务名称（调试用）
     */
    listRegistered(): string[] {
        return Object.keys(_registry);
    }
};
