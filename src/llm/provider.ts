/**
 * LLM 提供商抽象接口
 */
import type { Tool, Message } from 'ollama';

/** LLM 聊天响应 */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
}

/** 工具调用 */
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

/** 工具定义（用于 function calling） */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

/** LLM 提供商接口 */
export interface LLMProvider {
  /** 普通文本聊天 */
  chat(params: {
    model: string;
    system: string;
    messages: Message[];
  }): Promise<LLMResponse>;

  /** 带工具调用的聊天 */
  chatWithTools(params: {
    model: string;
    system: string;
    messages: Message[];
    tools: ToolDefinition[];
  }): Promise<LLMResponse>;

  /** 检查连接和模型可用性 */
  checkHealth(model: string): Promise<{
    connected: boolean;
    modelAvailable: boolean;
    error?: string;
  }>;
}
