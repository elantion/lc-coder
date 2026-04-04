/**
 * 项目经理角色
 * 负责将需求转化为工作计划
 */
import { BaseRole } from './base-role.js';
import { PlanSchema, type Plan } from '../schemas/plan.js';
import type { Requirement } from '../schemas/requirement.js';
import type { LLMProvider } from '../llm/provider.js';
import type { RoleOutput } from './base-role.js';

export class ProjectManager extends BaseRole {
  constructor(provider: LLMProvider, model: string, promptsDir?: string) {
    super({
      roleName: 'project-manager',
      promptFileName: 'project-manager.md',
      provider,
      model,
      promptsDir,
    });
  }

  /**
   * 基于需求报告生成工作计划
   */
  async createPlan(requirement: Requirement): Promise<RoleOutput & { plan?: Plan }> {
    const result = await this.execute({
      userMessage: '请基于上游的需求分析报告，分析项目代码，然后制定详细的工作计划。',
      document: requirement as unknown as Record<string, unknown>,
    });

    if (result.document) {
      try {
        const plan = PlanSchema.parse(result.document);
        return { ...result, plan };
      } catch (err: any) {
        // Schema 校验失败，尝试修复常见问题
        return { ...result };
      }
    }

    return result;
  }
}
