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

/**
 * 角色基类
 */
export abstract class BaseRole {
  protected roleName: RoleName;
  protected promptFileName: string;
  protected provider: LLMProvider;
  protected model: string;
  protected promptsDir: string;

  constructor(params: {
    roleName: RoleName;
    promptFileName: string;
    provider: LLMProvider;
    model: string;
    promptsDir?: string;
  }) {
    this.roleName = params.roleName;
    this.promptFileName = params.promptFileName;
    this.provider = params.provider;
    this.model = params.model;
    // prompts 目录默认在项目根目录下的 prompts/ 文件夹
    // 但对于 npm 全局安装的场景，需要使用包内的 prompts 路径
    this.promptsDir = params.promptsDir || join(import.meta.dir, '../../prompts');
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

  /** 创建独立会话并执行 */
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
    );

    const responseText = await session.send(input.userMessage);

    // 尝试从响应中提取 JSON
    const document = this.extractJson(responseText);

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
