/**
 * data/gateways/ai-gateway.ts — AI 调用网关
 *
 * 封装 TavernHelper_API_ACU.generateRaw、triggerSlash
 * 以及 SillyTavern_API_ACU.ConnectionManagerRequestService.sendRequest 等 AI 调用方法。
 * service 层通过本模块发起 AI 请求，不再直接调用宿主 API。
 *
 * 所有方法内置存在性检查，宿主 API 不可用时抛出明确错误。
 */

import { TavernHelper_API_ACU, SillyTavern_API_ACU } from '../../shared/host-api';
import { logWarn_ACU } from '../../shared/utils';

// ═══ 可用性检查 ═══

/**
 * 检查 generateRaw 是否可用
 */
export function isGenerateRawAvailable_ACU(): boolean {
    return !!(TavernHelper_API_ACU && typeof TavernHelper_API_ACU.generateRaw === 'function');
}

/**
 * 检查 ConnectionManagerRequestService 是否可用
 */
export function isConnectionManagerAvailable_ACU(): boolean {
    return !!(SillyTavern_API_ACU?.ConnectionManagerRequestService &&
        typeof SillyTavern_API_ACU.ConnectionManagerRequestService.sendRequest === 'function');
}

/**
 * 检查 triggerSlash 是否可用
 */
export function isTriggerSlashAvailable_ACU(): boolean {
    return !!(TavernHelper_API_ACU && typeof TavernHelper_API_ACU.triggerSlash === 'function');
}

// ═══ AI 生成 ═══

/**
 * 通过酒馆主 API 生成文本
 * @param options generateRaw 的参数（ordered_prompts、should_stream 等）
 * @returns 生成的文本
 * @throws 如果 generateRaw 不可用
 */
export async function generateRaw_ACU(options: {
    ordered_prompts: any[];
    should_stream?: boolean;
    [key: string]: any;
}): Promise<string> {
    if (!isGenerateRawAvailable_ACU()) {
        throw new Error('TavernHelper.generateRaw 函数不存在。请检查酒馆版本。');
    }
    const response = await TavernHelper_API_ACU.generateRaw(options);
    return typeof response === 'string' ? response : String(response ?? '');
}

/**
 * 通过 ConnectionManager 发送请求
 * @param profileId 配置文件 ID
 * @param messages 消息数组
 * @param maxTokens 最大 token 数
 * @returns API 响应结果
 * @throws 如果 ConnectionManagerRequestService 不可用
 */
export async function sendConnectionManagerRequest_ACU(
    profileId: string,
    messages: any[],
    maxTokens: number,
): Promise<any> {
    if (!isConnectionManagerAvailable_ACU()) {
        throw new Error('ConnectionManagerRequestService 不可用。请检查酒馆版本或连接管理器配置。');
    }
    return await SillyTavern_API_ACU.ConnectionManagerRequestService.sendRequest(profileId, messages, maxTokens);
}

/**
 * 触发斜杠命令
 * @param command 斜杠命令字符串
 * @returns 命令执行结果
 */
export async function triggerSlash_ACU(command: string): Promise<string> {
    if (!isTriggerSlashAvailable_ACU()) {
        logWarn_ACU('[AIGateway] triggerSlash 不可用，返回空字符串');
        return '';
    }
    return await TavernHelper_API_ACU.triggerSlash(command);
}

// ═══ 配置读取 ═══

/**
 * 获取 ConnectionManager 的配置文件列表
 * @returns 配置文件数组，不可用时返回 []
 */
export function getConnectionManagerProfiles_ACU(): any[] {
    return SillyTavern_API_ACU?.extensionSettings?.connectionManager?.profiles || [];
}
