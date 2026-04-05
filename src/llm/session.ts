/**
 * 独立会话管理器
 * 每个管道阶段都创建全新会话，不携带历史上下文
 */
import type { Message } from 'ollama';
import type { LLMProvider, LLMResponse, ToolDefinition, ToolCall } from './provider.js';
import type { RoleName } from '../schemas/common.js';
import { parseToolCallsFromText } from './tool-parser.js';

export interface SessionConfig {
  id: string;
  role: RoleName;
  systemPrompt: string;
  model: string;
  tools?: ToolDefinition[];
  inputDocument?: Record<string, unknown> | null;
}

export interface SessionRecord {
  id: string;
  role: RoleName;
  model: string;
  messages: Message[];
  toolCallLog: { call: ToolCall; result: unknown }[];
  outputDocument: Record<string, unknown> | null;
  startedAt: string;
  finishedAt: string | null;
}

/**
 * 独立会话 —— 整个架构的核心
 * 每个会话都是从零开始，仅通过 inputDocument 接收上游信息
 */
export class Session {
  private config: SessionConfig;
  private provider: LLMProvider;
  private messages: Message[] = [];
  private toolCallLog: { call: ToolCall; result: unknown }[] = [];
  private toolExecutors: Map<string, (args: Record<string, unknown>) => Promise<unknown>>;
  private onToolConfirm?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>;
  private startedAt: string;

  constructor(
    config: SessionConfig,
    provider: LLMProvider,
    toolExecutors: Map<string, (args: Record<string, unknown>) => Promise<unknown>>,
    onToolConfirm?: (toolName: string, args: Record<string, unknown>) => Promise<boolean>,
  ) {
    this.config = config;
    this.provider = provider;
    this.toolExecutors = toolExecutors;
    this.onToolConfirm = onToolConfirm;
    this.startedAt = new Date().toISOString();
  }

  /**
   * 发送用户消息并获取响应
   * 如果有 tool calls，自动执行并追加结果
   */
  async send(userMessage: string): Promise<string> {
    this.messages.push({ role: 'user', content: userMessage });

    // 构建 system prompt，注入上游文档
    let system = this.config.systemPrompt;
    if (this.config.inputDocument) {
      system += `\n\n## 上游文档\n\`\`\`json\n${JSON.stringify(this.config.inputDocument, null, 2)}\n\`\`\``;
    }

    const hasTools = this.config.tools && this.config.tools.length > 0;
    let response: LLMResponse;

    if (hasTools) {
      response = await this.provider.chatWithTools({
        model: this.config.model,
        system,
        messages: this.messages,
        tools: this.config.tools!,
      });
    } else {
      response = await this.provider.chat({
        model: this.config.model,
        system,
        messages: this.messages,
      });
    }

    // 多轮 tool call 循环（小模型可能需要多步工具调用才能完成工作）
    const MAX_TOOL_ROUNDS = 5;
    let currentResponse = response;

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let toolCalls = currentResponse.toolCalls;

      // 回退：如果没有正式的 tool calls，尝试从文本解析
      if (!toolCalls && hasTools && currentResponse.content) {
        toolCalls = parseToolCallsFromText(currentResponse.content);
      }

      if (!toolCalls || toolCalls.length === 0) {
        // 没有更多 tool calls，返回最终回复
        this.messages.push({ role: 'assistant', content: currentResponse.content });
        return currentResponse.content;
      }

      // 执行所有 tool calls
      const toolResults: string[] = [];
      for (const call of toolCalls) {
        // 安全确认检查
        if (this.onToolConfirm) {
          const confirmed = await this.onToolConfirm(call.name, call.arguments);
          if (!confirmed) {
            const rejectedResult = { rejected: true, reason: '用户拒绝执行' };
            this.toolCallLog.push({ call, result: rejectedResult });
            toolResults.push(`Tool ${call.name} 被用户拒绝执行`);
            continue;
          }
        }

        const executor = this.toolExecutors.get(call.name);
        if (executor) {
          try {
            const result = await executor(call.arguments);
            this.toolCallLog.push({ call, result });
            toolResults.push(
              `Tool ${call.name} result:\n${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`
            );
          } catch (err: any) {
            const errorResult = { error: err.message };
            this.toolCallLog.push({ call, result: errorResult });
            toolResults.push(`Tool ${call.name} error: ${err.message}`);
          }
        } else {
          toolResults.push(`Tool ${call.name} not found`);
        }
      }

      // 将 assistant 回复和 tool results 加入消息历史
      this.messages.push({ role: 'assistant', content: currentResponse.content || '' });
      this.messages.push({
        role: 'user',
        content: `工具执行结果：\n${toolResults.join('\n\n')}\n\n请继续你的工作。如果已经收集到足够信息，请输出最终结果。`,
      });

      // 让模型基于 tool 结果继续（可能还需要更多工具调用）
      if (hasTools) {
        currentResponse = await this.provider.chatWithTools({
          model: this.config.model,
          system,
          messages: this.messages,
          tools: this.config.tools!,
        });
      } else {
        const followUp = await this.provider.chat({
          model: this.config.model,
          system,
          messages: this.messages,
        });
        this.messages.push({ role: 'assistant', content: followUp.content });
        return followUp.content;
      }
    }

    // 达到最大轮次，返回最后的回复
    this.messages.push({ role: 'assistant', content: currentResponse.content });
    return currentResponse.content;
  }

  /**
   * 在已有会话上追加消息并获取响应（用于重试场景）
   * 不重新创建会话，保留上下文
   */
  async sendFollowUp(message: string): Promise<string> {
    this.messages.push({ role: 'user', content: message });

    let system = this.config.systemPrompt;
    if (this.config.inputDocument) {
      system += `\n\n## 上游文档\n\`\`\`json\n${JSON.stringify(this.config.inputDocument, null, 2)}\n\`\`\``;
    }

    const hasTools = this.config.tools && this.config.tools.length > 0;
    let response;

    if (hasTools) {
      response = await this.provider.chatWithTools({
        model: this.config.model,
        system,
        messages: this.messages,
        tools: this.config.tools!,
      });
    } else {
      response = await this.provider.chat({
        model: this.config.model,
        system,
        messages: this.messages,
      });
    }

    this.messages.push({ role: 'assistant', content: response.content });
    return response.content;
  }

  /** 导出会话记录（用于审计和存档） */
  toRecord(): SessionRecord {
    return {
      id: this.config.id,
      role: this.config.role,
      model: this.config.model,
      messages: [...this.messages],
      toolCallLog: [...this.toolCallLog],
      outputDocument: null,
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
    };
  }
}
