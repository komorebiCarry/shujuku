// main-popup-status.ts
// Status标签页（状态 & 操作）HTML生成

import { SCRIPT_ID_PREFIX_ACU } from '../../shared/constants';
import { DEFAULT_AUTO_UPDATE_FREQUENCY_ACU, DEFAULT_AUTO_UPDATE_THRESHOLD_ACU, DEFAULT_AUTO_UPDATE_TOKEN_THRESHOLD_ACU } from '../../shared/defaults';

/**
 * 生成 Status 标签页的 HTML 片段
 * 包含：数据库状态、核心操作、手动更新表选择、公用设置、更新配置
 */
export function generateStatusTabHTML(): string {
    return `
                <div id="acu-tab-status" class="acu-tab-content active">
                    <div class="acu-grid">
                        <div class="acu-card" style="grid-column: span 2;">
                            <h3>数据库状态</h3>
                            <div style="display: flex; justify-content: space-between; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid var(--border-normal);">
                                <span id="${SCRIPT_ID_PREFIX_ACU}-total-messages-display">上下文总层数: N/A (仅计算AI回复楼层)</span>
                                <span id="${SCRIPT_ID_PREFIX_ACU}-card-update-status-display">正在获取状态...</span>
                            </div>
                            
                            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
                                <thead>
                                    <tr style="border-bottom: 1px solid var(--border-normal); color: var(--text-secondary);">
                                        <th style="text-align: left; padding: 5px;">表格名称</th>
                                        <th style="text-align: center; padding: 5px;">更新频率</th>
                                        <th style="text-align: center; padding: 5px;">未记录楼层</th>
                                        <th style="text-align: center; padding: 5px;">上次更新</th>
                                        <th style="text-align: center; padding: 5px;">下次触发</th>
                                    </tr>
                                </thead>
                                <tbody id="${SCRIPT_ID_PREFIX_ACU}-granular-status-table-body">
                                    <tr><td colspan="5" style="text-align: center; padding: 10px;">正在加载数据...</td></tr>
                                </tbody>
                            </table>

                            <p id="${SCRIPT_ID_PREFIX_ACU}-next-update-display" style="border-top: 1px dashed var(--border-normal); padding-top: 10px; margin-top: 10px; font-size: 0.95em; text-align: right;">下一次更新: 计算中...</p>
                        </div>
                        <div class="acu-card" style="grid-column: span 2;">
                            <h3>核心操作</h3>
                            <div class="flex-center" style="flex-direction: column; gap: 15px;">
                                <div style="width: 100%; display: flex; gap: 10px; align-items: center;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">填表API预设:</label>
                                    <select id="${SCRIPT_ID_PREFIX_ACU}-table-api-preset-select" style="flex: 1; padding: 6px 10px; border-radius: 4px; border: 1px solid var(--border-normal);">
                                        <option value="">使用当前API配置</option>
                                    </select>
                                </div>
                                <div style="width: 100%; display: flex; flex-direction: column; gap: 6px;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">正文标签提取规则:</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-table-context-extract-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-table-context-extract-add-rule" class="button" style="align-self: flex-start;">添加规则</button>
                                    <small class="notes">每条规则填写开始词和结束词，仅提取最后一组匹配内容（不影响注入词规则）。</small>
                                </div>
                                <div style="width: 100%; display: flex; flex-direction: column; gap: 6px;">
                                    <label style="white-space: nowrap; font-size: 0.9em;">标签排除规则:</label>
                                    <div id="${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-rules"></div>
                                    <button type="button" id="${SCRIPT_ID_PREFIX_ACU}-table-context-exclude-add-rule" class="button" style="align-self: flex-start;">添加规则</button>
                                    <small class="notes">每条规则填写开始词与结束词，仅移除最后一组匹配内容。</small>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-tableedit-last-pair-only-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-tableedit-last-pair-only-checkbox">仅识别最后一对 &lt;tableEdit&gt; 标签（忽略前面的思维链/草稿）</label>
                                </div>
                                <button id="${SCRIPT_ID_PREFIX_ACU}-manual-update-card" class="primary" style="width:100%;">立即手动更新</button>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-manual-extra-hint-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-manual-extra-hint-checkbox">额外提示词（仅手动更新时临时追加）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-enabled-checkbox">启用自动更新</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-standardized-table-fill-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-standardized-table-fill-enabled-checkbox">规范填表功能（总结表与总体大纲必须同步新增）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-toast-mute-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-toast-mute-enabled-checkbox">静默提示框（除填表/规划/导入/报错外，其它提示不弹窗）</label>
                                </div>
                                <div class="checkbox-group">
                                    <input type="checkbox" id="${SCRIPT_ID_PREFIX_ACU}-prompt-template-enabled-checkbox">
                                    <label for="${SCRIPT_ID_PREFIX_ACU}-prompt-template-enabled-checkbox">启用条件模板功能（<if>条件判断）</label>
                                </div>
                            </div>
                            <p class="notes" style="margin-top: 10px;">手动更新会使用当前UI参数，对勾选的表进行更新；未勾选则默认更新全部表。</p>
                            <p class="notes" style="margin-top: 6px;">勾选"额外提示词"后，点击手动更新会弹出输入框，内容将写入AI指令预设中的 $8 占位符，仅本次操作生效。</p>
                        </div>
                    </div>
                    <div class="acu-card">
                        <h3>手动更新表选择</h3>
                        <div class="notes" style="margin-bottom:6px;">选择需要手动更新的表（可多选，默认全选新表）：</div>
                        <div class="button-group" style="justify-content:flex-start; gap:8px; margin-bottom:6px;">
                            <button id="${SCRIPT_ID_PREFIX_ACU}-manual-table-select-all" class="button">全选</button>
                            <button id="${SCRIPT_ID_PREFIX_ACU}-manual-table-select-none" class="button">全不选</button>
                        </div>
                        <div id="${SCRIPT_ID_PREFIX_ACU}-manual-table-selector" style="min-height:60px;">加载表格列表中...</div>
                    </div>
                     <div class="acu-card">
                        <h3>公用设置</h3>
                            <div class="acu-grid">
                                <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-token-threshold">跳过更新最小回复长度:</label>
                                    <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-token-threshold" min="0" step="100" placeholder="${DEFAULT_AUTO_UPDATE_TOKEN_THRESHOLD_ACU}">
                                    </div>
                                    <small class="notes" style="font-size: 0.85em; color: #888;">AI回复少于此长度时跳过自动填表</small>
                                </div>
                                <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-table-max-retries">填表自动重试次数:</label>
                                    <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-table-max-retries" min="1" max="10" step="1" value="3">
                                    </div>
                                    <small class="notes" style="font-size: 0.85em; color: #888;">错误或空回时自动重试的次数（默认3次）</small>
                                </div>
                                    </div>
                        <p class="notes">当自动更新时，若上下文Token（约等于字符数）低于此值，则跳过本次更新。</p>
                        </div>

                    <div class="acu-card">
                        <h3>更新配置</h3>
                        <div class="acu-grid-2x2">
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-threshold">AI读取上下文层数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-threshold" min="0" step="1" placeholder="${DEFAULT_AUTO_UPDATE_THRESHOLD_ACU}">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-auto-update-frequency">每N层自动更新一次:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-auto-update-frequency" min="1" step="1" placeholder="${DEFAULT_AUTO_UPDATE_FREQUENCY_ACU}">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-update-batch-size">每批次更新楼层数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-update-batch-size" min="1" step="1" placeholder="2">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-max-concurrent-groups">最大并发数:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-max-concurrent-groups" min="1" step="1" placeholder="1">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-skip-update-floors">保留X层楼不更新:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-skip-update-floors" min="0" step="1" placeholder="0">
                                </div>
                            </div>
                            <div>
                                <label for="${SCRIPT_ID_PREFIX_ACU}-retain-recent-layers">保留最近N层数据:</label>
                                <div class="input-group">
                                    <input type="number" id="${SCRIPT_ID_PREFIX_ACU}-retain-recent-layers" min="0" step="1" placeholder="空=全部保留">
                                </div>
                                <div class="notes" style="margin-top:4px;font-size:11px;opacity:0.7;">按AI楼层计数，自动更新后清理超出层数的旧数据</div>
                            </div>
                        </div>
                    </div>
                </div>`;
}