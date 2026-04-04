/**
 * Ollama LLM 提供商实现
 */
import { Ollama } from 'ollama';
import type { Message } from 'ollama';
import type { LLMProvider, LLMResponse, ToolDefinition, ToolCall } from './provider.js';

export class OllamaProvider implements LLMProvider {
  private client: Ollama;

  constructor(host: string = 'http://localhost:11434') {
    this.client = new Ollama({ host });
  }

  async chat(params: {
    model: string;
    system: string;
    messages: Message[];
  }): Promise<LLMResponse> {
    const messages: Message[] = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const response = await this.client.chat({
      model: params.model,
      messages,
    });

    return {
      content: response.message.content,
    };
  }

  async chatWithTools(params: {
    model: string;
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse> {
    const messages: Message[] = [
      { role: 'system', content: params.system },
      ...params.messages,
    ];

    const response = await this.client.chat({
      model: params.model,
      messages,
      tools: params.tools as any,
    });

    const toolCalls: ToolCall[] = [];
    if (response.message.tool_calls) {
      for (const tc of response.message.tool_calls) {
        toolCalls.push({
          name: tc.function.name,
          arguments: tc.function.arguments as Record<string, unknown>,
        });
      }
    }

    return {
      content: response.message.content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
    };
  }

  async checkHealth(model: string): Promise<{
    connected: boolean;
    modelAvailable: boolean;
    error?: string;
  }> {
    try {
      const models = await this.client.list();
      const available = models.models.some(
        (m) => m.name === model || m.name.startsWith(model.split(':')[0] ?? model)
      );
      return { connected: true, modelAvailable: available };
    } catch (err: any) {
      return {
        connected: false,
        modelAvailable: false,
        error: err.message || 'Failed to connect to Ollama',
      };
    }
  }
}
