/**
 * shared/host-api.ts — 宿主平台 API 引用
 * SillyTavern、TavernHelper、jQuery、toastr 的运行时引用。
 * 属于 shared 层，任何层均可 import。
 */

/**
 * toastr 通知库的类型定义
 * 实际使用的方法：info/success/warning/error（通过动态 key 调用）和 clear
 */
export interface IToastrAPI_ACU {
    info(message: string, title?: string, options?: Record<string, unknown>): JQuery<HTMLElement> | null;
    success(message: string, title?: string, options?: Record<string, unknown>): JQuery<HTMLElement> | null;
    warning(message: string, title?: string, options?: Record<string, unknown>): JQuery<HTMLElement> | null;
    error(message: string, title?: string, options?: Record<string, unknown>): JQuery<HTMLElement> | null;
    clear(toast?: JQuery<HTMLElement> | null, options?: Record<string, unknown>): void;
}

/** SillyTavern 主 API — 类型来自 @types/iframe/exported.sillytavern.d.ts */
export type SillyTavernAPI_Type = typeof SillyTavern;
/** TavernHelper 辅助 API — 类型来自 @types/function/index.d.ts (Window['TavernHelper']) */
export type TavernHelperAPI_Type = Window['TavernHelper'];

export let SillyTavern_API_ACU: SillyTavernAPI_Type | undefined;
export let TavernHelper_API_ACU: TavernHelperAPI_Type | undefined;
export let jQuery_API_ACU: JQueryStatic | undefined;
export let toastr_API_ACU: IToastrAPI_ACU | undefined;

export function _set_SillyTavern_API_ACU(v: SillyTavernAPI_Type | undefined) { SillyTavern_API_ACU = v; }
export function _set_TavernHelper_API_ACU(v: TavernHelperAPI_Type | undefined) { TavernHelper_API_ACU = v; }
export function _set_jQuery_API_ACU(v: JQueryStatic | undefined) { jQuery_API_ACU = v; }
export function _set_toastr_API_ACU(v: IToastrAPI_ACU | undefined) { toastr_API_ACU = v; }
