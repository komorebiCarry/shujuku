  async function prepareAIInput_ACU(messages, updateMode = 'standard', targetSheetKeys = null, options = {}) {
    // updateMode: 'standard' 表示更新标准表，'summary' 表示更新总结表和总体大纲
    // targetSheetKeys: 可选，指定要更新的表格key列表
    // This function is now simplified to only prepare the dynamic content parts.