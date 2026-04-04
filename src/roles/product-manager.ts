/**
 * 产品经理角色
 * 负责需求分析、用户追问、输出需求报告
 */
import { BaseRole } from './base-role.js';
import { RequirementSchema, type Requirement } from '../schemas/requirement.js';
import type { LLMProvider } from '../llm/provider.js';
import type { RoleOutput } from './base-role.js';

export class ProductManager extends BaseRole {
  constructor(provider: LLMProvider, model: string, promptsDir?: string) {
    super({
      roleName: 'product-manager',
      promptFileName: 'product-manager.md',
      provider,
      model,
      promptsDir,
    });
  }

  /**
   * 执行需求分析
   * @param userInput 用户原始输入
   * @returns 需求分析结果（可能包含追问问题）
   */
  async analyze(userInput: string): Promise<RoleOutput & { requirement?: Requirement; questions?: string[] }> {
    const result = await this.execute({
      userMessage: `用户的需求如下：\n\n${userInput}\n\n请按照你的工作流程，先了解项目，然后分析需求，生成需求分析报告。如果有需要追问的问题，请在报告的 clarifications 字段中列出（answer 字段留空）。`,
    });

    // 尝试解析为需求文档
    if (result.document) {
      try {
        const requirement = RequirementSchema.parse(result.document);
        // 检查是否有未回答的追问
        const unanswered = requirement.clarifications.filter((c) => !c.answer);
        return {
          ...result,
          requirement,
          questions: unanswered.map((c) => c.question),
        };
      } catch {
        // Schema 校验失败，返回原始结果
      }
    }

    return result;
  }

  /**
   * 提供追问的答案后，重新生成需求报告
   */
  async refineWithAnswers(
    userInput: string,
    previousReport: Record<string, unknown>,
    answers: Record<string, string>,
  ): Promise<RoleOutput & { requirement?: Requirement }> {
    // 将答案合入已有报告
    const updatedReport = { ...previousReport };
    if (Array.isArray(updatedReport.clarifications)) {
      for (const clarification of updatedReport.clarifications as any[]) {
        if (answers[clarification.question]) {
          clarification.answer = answers[clarification.question];
          clarification.answered_by = 'user';
        }
      }
    }

    const result = await this.execute({
      userMessage: `用户已经回答了追问的问题。请基于更新后的信息重新生成完整的需求分析报告。\n\n用户原始需求：${userInput}\n\n更新后的追问回答：\n${JSON.stringify(answers, null, 2)}`,
      document: updatedReport,
    });

    if (result.document) {
      try {
        const requirement = RequirementSchema.parse(result.document);
        return { ...result, requirement };
      } catch {
        // Schema 校验失败
      }
    }

    return result;
  }
}
