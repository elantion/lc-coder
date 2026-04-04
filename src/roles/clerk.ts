/**
 * 办事员角色
 * 负责执行具体的子任务
 */
import { BaseRole } from './base-role.js';
import { ResultSchema, type Result } from '../schemas/result.js';
import type { Instruction } from '../schemas/instruction.js';
import type { LLMProvider } from '../llm/provider.js';
import type { RoleOutput } from './base-role.js';

export class Clerk extends BaseRole {
  constructor(provider: LLMProvider, model: string, promptsDir?: string) {
    super({
      roleName: 'clerk',
      promptFileName: 'clerk.md',
      provider,
      model,
      promptsDir,
    });
  }

  /**
   * 执行一个子任务
   */
  async executeTask(instruction: Instruction): Promise<RoleOutput & { result?: Result }> {
    const message = this.buildTaskMessage(instruction);

    const output = await this.execute({
      userMessage: message,
      document: instruction as unknown as Record<string, unknown>,
    });

    if (output.document) {
      try {
        const result = ResultSchema.parse(output.document);
        return { ...output, result };
      } catch {
        // Schema 校验失败
      }
    }

    return output;
  }

  private buildTaskMessage(instruction: Instruction): string {
    let message = `请执行以下任务：\n\n`;
    message += `## 任务：${instruction.title}\n\n`;
    message += `${instruction.instructions}\n\n`;

    if (instruction.input_files.length > 0) {
      message += `## 需要读取的文件\n`;
      for (const f of instruction.input_files) {
        message += `- ${f}\n`;
      }
      message += '\n';
    }

    if (instruction.output_files.length > 0) {
      message += `## 需要操作的文件\n`;
      for (const f of instruction.output_files) {
        message += `- ${f}\n`;
      }
      message += '\n';
    }

    if (instruction.code_template) {
      message += `## 代码模板\n\`\`\`\n${instruction.code_template}\n\`\`\`\n\n`;
    }

    if (instruction.verification) {
      message += `## 验证方法\n${instruction.verification}\n\n`;
    }

    message += `完成后请输出 JSON 格式的执行结果报告。`;
    return message;
  }
}
