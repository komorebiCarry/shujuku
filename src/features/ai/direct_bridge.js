  async function callCustomOpenAI_ACU_Direct(messages) {
      // Reuse the logic from callCustomOpenAI_ACU but bypass the prompt replacement part
      // ... For brevity, I will just call callCustomOpenAI_ACU with a hacked dynamicContent?
      // No, callCustomOpenAI_ACU relies on settings_ACU.charCardPrompt.
      // I should refactor callCustomOpenAI_ACU to accept direct messages, or duplicate the API calling part.
      
      // Duplicating API calling logic for safety and isolation
      if (settings_ACU.apiMode === 'tavern') {
          const profileId = settings_ACU.tavernProfile;
          return await SillyTavern_API_ACU.ConnectionManagerRequestService.sendRequest(
                profileId, messages, settings_ACU.apiConfig.max_tokens || 4096
          ).then(r => r.result.choices[0].message.content);
      } else {
          // Custom API（流式传输）
          if (settings_ACU.apiConfig.useMainApi) {
             return await TavernHelper_API_ACU.generateRaw({ ordered_prompts: messages, should_stream: settings_ACU.streamingEnabled || false });
          } else {
             const url = `/api/backends/chat-completions/generate`;
             const body = JSON.stringify({
                 messages: messages,
                 model: settings_ACU.apiConfig.model,
                 max_tokens: settings_ACU.apiConfig.max_tokens,
                 stream: settings_ACU.streamingEnabled || false,
                 chat_completion_source: "custom",
                 // ... other params
                 reverse_proxy: settings_ACU.apiConfig.url,
                 custom_url: settings_ACU.apiConfig.url,
                 custom_include_headers: settings_ACU.apiConfig.apiKey ? `Authorization: Bearer ${settings_ACU.apiConfig.apiKey}` : ""
             });
             const res = await fetch(url, { method: 'POST', headers: {...SillyTavern.getRequestHeaders(), 'Content-Type': 'application/json'}, body });
             // 根据streamingEnabled设置选择响应处理方式
             const content = await handleApiResponse_ACU(res);
             return content;
          }
      }
  }