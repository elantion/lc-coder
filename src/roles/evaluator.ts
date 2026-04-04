/**
 * 评估器角色
 * 负责评估执行结果，决定是否继续
 */
import { BaseRole } from './base-role.js';
import { EvaluationSchema, type Evaluation, type Result } from '../schemas/result.js';
import type { Plan } from '../schemas/plan.js';
import type { LLMProvider } from '../llm/provider.js';
import type { RoleOutput } from './base-role.js';

export class Evaluator extends BaseRole {
  constructor(provider: LLMProvider, model: string, promptsDir?: string) {
    super({
      roleName: 'evaluator',
      promptFileName: 'evaluator.md',
      provider,
      model,
      promptsDir,
    });
  }

  /**
   * 评估一个任务的执行结果
   */
  async evaluate(
    result: Result,
    plan: Plan,
  ): Promise<RoleOutput & { evaluation?: Evaluation }> {
    const context = {
      task_result: result,
      plan_summary: {
        total_tasks: plan.tasks.length,
        critical_path: plan.critical_path,
        current_task_in_critical_path: plan.critical_path.includes(result.task_id),
        tasks_depending_on_current: plan.tasks
          .filter((t) => t.depends_on.includes(result.task_id))
          .map((t) => t.id),
      },
    };

    const output = await this.execute({
      userMessage: '请评估以下任务的执行结果，并做出继续/跳过/暂停的决策。',
      document: context,
    });

    if (output.document) {
      try {
        const evaluation = EvaluationSchema.parse(output.document);
        return { ...output, evaluation };
      } catch {
        // Schema 校验失败
      }
    }

    // 如果评估器输出解析失败，做保守决策
    if (!output.document) {
      const fallbackEvaluation: Evaluation = {
        task_id: result.task_id,
        evaluated_by: 'evaluator',
        timestamp: new Date().toISOString(),
        task_succeeded: result.status === 'success',
        impacts_critical_path: plan.critical_path.includes(result.task_id),
        decision: result.status === 'success' ? 'continue' : 'pause',
        reason: result.status === 'success'
          ? '任务成功完成'
          : '任务失败，保守决策暂停（评估器输出解析失败）',
      };
      return { ...output, evaluation: fallbackEvaluation };
    }

    return output;
  }
}
