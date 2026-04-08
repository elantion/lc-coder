/**
 * OpenAI 兼容提供商实现 (支持 MiniMax, DeepSeek, GPT-4, 甚至本地 vLLM 等)
 */
import OpenAI from 'openai';
import type { Message } from 'ollama';
import type { LLMProvider, LLMResponse, ToolDefinition, ToolCall } from './provider.js';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.client = new OpenAI({
      apiKey,
      baseURL: baseURL || 'https://api.openai.com/v1',
    });
  }

  // 转换 Ollama 消息格式为 OpenAI 格式
  private convertMessages(system: string, messages: Message[]): OpenAI.Chat.ChatCompletionMessageParam[] {
    const msgs: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: system }
    ];
    
    for (const msg of messages) {
      if (msg.role === 'user' || msg.role === 'assistant' || msg.role === 'system' || msg.role === 'tool') {
        msgs.push({
          role: msg.role as any,
          content: msg.content
        });
      }
    }
    
    return msgs;
  }

  async chat(params: {
    model: string;
    system: string;
    messages: Message[];
  }): Promise<LLMResponse> {
    const messages = this.convertMessages(params.system, params.messages);

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      temperature: 0.1, // 编码任务偏好较低的温度
    });

    return {
      content: response.choices[0]?.message?.content || '',
    };
  }

  async chatWithTools(params: {
    model: string;
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    const messages = this.convertMessages(params.system, params.messages);

    const openaiTools = params.tools.map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.function.name,
        description: tool.function.description,
        parameters: tool.function.parameters as any
      }
    }));

    const response = await this.client.chat.completions.create({
      model: params.model,
      messages,
      tools: openaiTools,
      temperature: 0.1,
    });

    const choice = response.choices[0];
    const message = choice?.message;

    const toolCalls: ToolCall[] = [];
    if (message?.tool_calls) {
      for (const tc of message.tool_calls) {
        if (tc.type === 'function') {
          toolCalls.push({
            name: tc.function.name,
            arguments: JSON.parse(tc.function.arguments || '{}'),
          });
        }
      }
    }

    return {
      content: message?.content || '',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async checkHealth(model: string): Promise<{
    connected: boolean;
    modelAvailable: boolean;
    error?: string;
  }> {
    try {
      // 简单地列出模型以验证 API Key 和连接状态
      await this.client.models.list();
      return { connected: true, modelAvailable: true }; // 注意：部分兼容 API 可能不提供 models 列表，这里简化处理
    } catch (err: any) {
      // 如果是因为权限问题等，说明网络是通的
      if (err.status === 401) {
        return {
          connected: true,
          modelAvailable: false,
          error: 'API Key invalid',
        };
      }
      return {
        connected: false,
        modelAvailable: false,
        error: err.message || 'Failed to connect to OpenAI compatible API',
      };
    }
  }
}
