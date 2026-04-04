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
import type { LLMProvider } from '../llm/provider.js';

export interface DispatchResult {
  task: SubTask;
  result: Result | null;
  evaluation: Evaluation | null;
}

export class Dispatcher {
  private provider: LLMProvider;
  private clerkModel: string;
  private evaluatorModel: string;
  private promptsDir?: string;

  constructor(params: {
    provider: LLMProvider;
    clerkModel: string;
    evaluatorModel: string;
    promptsDir?: string;
  }) {
    this.provider = params.provider;
    this.clerkModel = params.clerkModel;
    this.evaluatorModel = params.evaluatorModel;
    this.promptsDir = params.promptsDir;
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
    const clerk = new Clerk(this.provider, this.clerkModel, this.promptsDir);
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

    // 创建全新的评估器评估
    const evaluator = new Evaluator(this.provider, this.evaluatorModel, this.promptsDir);
    const evalOutput = await evaluator.evaluate(result, plan);

    return {
      task,
      result,
      evaluation: evalOutput.evaluation || null,
    };
  }
}
