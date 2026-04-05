/**
 * 角色基类
 * 负责加载 Prompt、创建会话、解析输出
 */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { Session, type SessionConfig } from '../llm/session.js';
import type { LLMProvider } from '../llm/provider.js';
import type { RoleName } from '../schemas/common.js';
import { getToolDefinitions, getToolExecutors } from '../tools/registry.js';

/** 角色输入 */
export interface RoleInput {
  userMessage: string;
  document?: Record<string, unknown> | null;
}

/** 角色输出 */
export interface RoleOutput {
  text: string;
  document: Record<string, unknown> | null;
}

/** 工具确认回调 */
export type ToolConfirmCallback = (
  toolName: string,
  args: Record<string, unknown>,
) => Promise<boolean>;

/**
 * 角色基类
 */
export abstract class BaseRole {
  protected roleName: RoleName;
  protected promptFileName: string;
  protected provider: LLMProvider;
  protected model: string;
  protected promptsDir: string;
  protected maxRetries: number;
  protected onToolConfirm?: ToolConfirmCallback;

  constructor(params: {
    roleName: RoleName;
    promptFileName: string;
    provider: LLMProvider;
    model: string;
    promptsDir?: string;
    maxRetries?: number;
    onToolConfirm?: ToolConfirmCallback;
  }) {
    this.roleName = params.roleName;
    this.promptFileName = params.promptFileName;
    this.provider = params.provider;
    this.model = params.model;
    // prompts 目录默认在项目根目录下的 prompts/ 文件夹
    // 但对于 npm 全局安装的场景，需要使用包内的 prompts 路径
    this.promptsDir = params.promptsDir || join(import.meta.dir, '../../prompts');
    this.maxRetries = params.maxRetries ?? 2;
    this.onToolConfirm = params.onToolConfirm;
  }

  /** 加载角色的 System Prompt */
  async loadPrompt(): Promise<string> {
    const promptPath = join(this.promptsDir, this.promptFileName);
    try {
      return await readFile(promptPath, 'utf-8');
    } catch (err: any) {
      throw new Error(
        `无法加载角色 Prompt: ${promptPath}\n${err.message}`
      );
    }
  }

  /** 创建独立会话并执行（带自动重试） */
  async execute(input: RoleInput): Promise<RoleOutput> {
    const systemPrompt = await this.loadPrompt();
    const tools = getToolDefinitions(this.roleName);
    const executors = getToolExecutors(this.roleName);

    const sessionId = `${this.roleName}-${Date.now()}`;
    const session = new Session(
      {
        id: sessionId,
        role: this.roleName,
        systemPrompt,
        model: this.model,
        tools: tools.length > 0 ? tools : undefined,
        inputDocument: input.document || null,
      },
      this.provider,
      executors,
      this.onToolConfirm,
    );

    const responseText = await session.send(input.userMessage);

    // 尝试从响应中提取 JSON
    let document = this.extractJson(responseText);

    // ===== 自动重试：JSON 解析失败时 =====
    if (!document && this.maxRetries > 0) {
      let lastText = responseText;
      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        const retryPrompt =
          `你上一次输出的不是有效的 JSON。请重新输出，确保是完整的 JSON 对象。` +
          `\n不要包含额外的解释，只输出 JSON。` +
          `\n\n上次输出的内容（可能不完整）：\n${lastText.slice(-500)}`;

        lastText = await session.sendFollowUp(retryPrompt);
        document = this.extractJson(lastText);
        if (document) break;
      }

      // 使用最后一次尝试的文本
      if (document) {
        return { text: lastText, document };
      }
    }

    return {
      text: responseText,
      document,
    };
  }

  /** 从模型回复中提取 JSON 文档 */
  protected extractJson(text: string): Record<string, unknown> | null {
    // 尝试从代码块中提取
    const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1]!.trim());
      } catch {
        // 不是有效 JSON
      }
    }

    // 尝试直接找 JSON 对象
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // 不是有效 JSON
      }
    }

    return null;
  }
}

