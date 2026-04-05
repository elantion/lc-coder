/**
 * 任务分发器
 * 将计划中的子任务转化为指令，分发给办事员执行
 */
import type { Plan, SubTask } from '../schemas/plan.js';
import type { Instruction } from '../schemas/instruction.js';
import type { Result } from '../schemas/result.js';
import type { Evaluation } from '../schemas/result.js';
import { Clerk } from '../roles/clerk.js';
import { Evaluator } from '../roles/evaluator.js';
import { Verifier, type VerificationReport } from './verifier.js';
import type { LLMProvider } from '../llm/provider.js';
import type { ToolConfirmCallback } from '../roles/base-role.js';

export interface DispatchResult {
  task: SubTask;
  result: Result | null;
  evaluation: Evaluation | null;
  verification: VerificationReport | null;
}

export class Dispatcher {
  private provider: LLMProvider;
  private clerkModel: string;
  private evaluatorModel: string;
  private promptsDir?: string;
  private maxRetries: number;
  private onToolConfirm?: ToolConfirmCallback;
  private enableVerification: boolean;
  private workingDir: string;

  constructor(params: {
    provider: LLMProvider;
    clerkModel: string;
    evaluatorModel: string;
    promptsDir?: string;
    maxRetries?: number;
    onToolConfirm?: ToolConfirmCallback;
    enableVerification?: boolean;
    workingDir?: string;
  }) {
    this.provider = params.provider;
    this.clerkModel = params.clerkModel;
    this.evaluatorModel = params.evaluatorModel;
    this.promptsDir = params.promptsDir;
    this.maxRetries = params.maxRetries ?? 2;
    this.onToolConfirm = params.onToolConfirm;
    this.enableVerification = params.enableVerification ?? true;
    this.workingDir = params.workingDir || process.cwd();
  }

  /**
   * 将子任务转化为办事员指令
   */
  createInstruction(task: SubTask): Instruction {
    return {
      task_id: task.id,
      type: task.type,
      title: task.title,
      instructions: task.instructions,
      input_files: task.input_files,
      output_files: task.output_files,
      code_template: task.code_template,
      verification: task.verification,
      context: task.description,
    };
  }

  /**
   * 分发并执行一个子任务
   * 每次调用都创建全新的 Clerk 和 Evaluator 会话
   */
  async dispatchTask(task: SubTask, plan: Plan): Promise<DispatchResult> {
    const instruction = this.createInstruction(task);

    // 创建全新的办事员执行
    const clerk = new Clerk(this.provider, this.clerkModel, this.promptsDir, {
      maxRetries: this.maxRetries,
      onToolConfirm: this.onToolConfirm,
    });
    const clerkOutput = await clerk.executeTask(instruction);

    let result: Result | null = clerkOutput.result || null;

    // 如果办事员没有返回有效的结果报告，构建一个基本报告
    if (!result) {
      result = {
        task_id: task.id,
        executed_by: 'clerk',
        timestamp: new Date().toISOString(),
        status: 'failed',
        changes_made: [],
        output_summary: clerkOutput.text.slice(0, 500),
        error: '办事员未返回有效的执行结果报告',
      };
    }

    // ===== 自动验证层 =====
    let verification: VerificationReport | null = null;
    if (this.enableVerification && result.status === 'success') {
      // 只对修改代码的任务运行验证
      const shouldVerify = ['write', 'modify', 'shell'].includes(task.type);
      if (shouldVerify) {
        const verifier = new Verifier(this.workingDir);
        verification = await verifier.verify();

        // 如果验证失败，更新结果状态并补充信息
        if (!verification.allPassed) {
          const failedChecks = verification.checks
            .filter(c => !c.passed)
            .map(c => `${c.name}: ${c.output.slice(0, 200)}`)
            .join('\n');

          result = {
            ...result,
            status: 'failed',
            error: `代码验证失败:\n${failedChecks}`,
            notes_for_pm: `自动验证发现问题:\n${failedChecks}`,
          };
        } else {
          // 验证通过，补充信息
          const passedChecks = verification.checks.map(c => c.name).join(', ');
          result = {
            ...result,
            notes_for_pm: (result.notes_for_pm || '') +
              `\n✓ 自动验证通过: ${passedChecks}`,
          };
        }
      }
    }

    // 创建全新的评估器评估
    const evaluator = new Evaluator(this.provider, this.evaluatorModel, this.promptsDir, {
      maxRetries: this.maxRetries,
    });
    const evalOutput = await evaluator.evaluate(result, plan);

    return {
      task,
      result,
      evaluation: evalOutput.evaluation || null,
      verification,
    };
  }
}
