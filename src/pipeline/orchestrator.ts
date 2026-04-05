/**
 * 流水线编排器
 * 整个工具的核心——硬编码的流程控制
 */
import { classifyRequest } from './classifier.js';
import { Dispatcher, type DispatchResult } from './dispatcher.js';
import { ProductManager } from '../roles/product-manager.js';
import { ProjectManager } from '../roles/project-manager.js';
import { DocumentStore } from '../documents/store.js';
import type { LLMProvider } from '../llm/provider.js';
import type { LcCoderConfig } from '../config/index.js';
import { getModelForRole } from '../config/index.js';
import type { Requirement } from '../schemas/requirement.js';
import type { Plan } from '../schemas/plan.js';
import type { Summary } from '../schemas/result.js';
import type { ToolConfirmCallback } from '../roles/base-role.js';
import type { VerificationReport } from './verifier.js';
import {
  type PipelineState,
  createPipelineState,
  savePipelineState,
  clearPipelineState,
} from './state.js';
import { requiresConfirmation } from '../tools/safety.js';

/** 流水线事件回调 */
export interface PipelineCallbacks {
  onStageStart: (stage: string, description: string) => void;
  onStageComplete: (stage: string, durationMs?: number) => void;
  onQuestion: (questions: string[]) => Promise<Record<string, string>>;
  onRequirementReview: (requirement: Requirement) => Promise<boolean>;
  onPlanReview: (plan: Plan) => Promise<boolean>;
  onTaskStart: (taskId: string, title: string, index: number, total: number) => void;
  onTaskComplete: (taskId: string, success: boolean, summary: string) => void;
  onPause: (reason: string) => Promise<'continue' | 'abort'>;
  onSimpleResponse: (response: string) => void;
  onSummary: (summary: Summary) => void;
  onError: (error: string) => void;
  /** 工具执行安全确认 */
  onToolConfirm?: (toolName: string, args: Record<string, unknown>, reason: string) => Promise<boolean>;
  /** 验证结果回调 */
  onVerification?: (taskId: string, report: VerificationReport) => void;
}

export class Orchestrator {
  private provider: LLMProvider;
  private config: LcCoderConfig;
  private store: DocumentStore;
  private callbacks: PipelineCallbacks;
  private promptsDir?: string;

  constructor(params: {
    provider: LLMProvider;
    config: LcCoderConfig;
    store: DocumentStore;
    callbacks: PipelineCallbacks;
    promptsDir?: string;
  }) {
    this.provider = params.provider;
    this.config = params.config;
    this.store = params.store;
    this.callbacks = params.callbacks;
    this.promptsDir = params.promptsDir;
  }

  /**
   * 构建工具确认回调（桥接安全模块和 CLI 回调）
   */
  private buildToolConfirm(): ToolConfirmCallback | undefined {
    const cb = this.callbacks.onToolConfirm;
    if (!cb) return undefined;

    const config = this.config;
    return async (toolName: string, args: Record<string, unknown>) => {
      const check = requiresConfirmation(toolName, args, config);
      if (!check.needsConfirm) return true;
      return cb(toolName, args, check.reason || `工具 ${toolName} 需要确认`);
    };
  }

  /**
   * 运行完整的流水线
   */
  async run(userInput: string): Promise<void> {
    await this.store.init();
    const state = createPipelineState(userInput);
    const stageStart = Date.now();

    // ==========================================
    // Step 0: 分类
    // ==========================================
    this.callbacks.onStageStart('classifier', '正在分析请求复杂度...');
    const classification = await classifyRequest(
      userInput,
      this.provider,
      getModelForRole(this.config, 'classifier'),
      this.promptsDir,
    );
    state.classification = classification;
    state.currentStage = 'pm';
    await savePipelineState(state, this.store);
    this.callbacks.onStageComplete('classifier', Date.now() - stageStart);

    if (classification.complexity === 'simple') {
      // 简单请求：直接用模型回答
      this.callbacks.onStageStart('direct-answer', '正在回答...');
      const pmStart = Date.now();
      const pm = new ProductManager(
        this.provider,
        getModelForRole(this.config, 'product-manager'),
        this.promptsDir,
      );
      const answer = await pm.execute({ userMessage: userInput });
      this.callbacks.onSimpleResponse(answer.text);
      this.callbacks.onStageComplete('direct-answer', Date.now() - pmStart);
      await clearPipelineState(this.store);
      return;
    }

    // ==========================================
    // Step 1: 产品经理 — 需求分析
    // ==========================================
    const pmStart = Date.now();
    this.callbacks.onStageStart('product-manager', '产品经理正在分析需求...');
    const onToolConfirm = this.buildToolConfirm();
    const pm = new ProductManager(
      this.provider,
      getModelForRole(this.config, 'product-manager'),
      this.promptsDir,
      { maxRetries: this.config.execution.maxRetries, onToolConfirm },
    );
    let pmResult = await pm.analyze(userInput);
    this.callbacks.onStageComplete('product-manager', Date.now() - pmStart);

    // 处理追问
    if (pmResult.questions && pmResult.questions.length > 0) {
      const answers = await this.callbacks.onQuestion(pmResult.questions);
      const refineStart = Date.now();
      this.callbacks.onStageStart('product-manager', '正在完善需求分析...');
      pmResult = await pm.refineWithAnswers(
        userInput,
        pmResult.document || {},
        answers,
      );
      this.callbacks.onStageComplete('product-manager', Date.now() - refineStart);
    }

    if (!pmResult.requirement) {
      this.callbacks.onError('产品经理未能生成有效的需求分析报告。');
      return;
    }

    // 保存需求文档 & 状态
    await this.store.saveDocument(`requirement-${pmResult.requirement.id}`, pmResult.requirement);
    state.requirement = pmResult.requirement;
    state.currentStage = 'pjm';
    await savePipelineState(state, this.store);

    // 用户确认需求
    const requirementApproved = await this.callbacks.onRequirementReview(pmResult.requirement);
    if (!requirementApproved) {
      this.callbacks.onError('用户取消了需求。');
      await clearPipelineState(this.store);
      return;
    }

    // ==========================================
    // Step 2: 项目经理 — 任务拆分
    // ==========================================
    const pjmStart = Date.now();
    this.callbacks.onStageStart('project-manager', '项目经理正在拆分任务...');
    const pjm = new ProjectManager(
      this.provider,
      getModelForRole(this.config, 'project-manager'),
      this.promptsDir,
      { maxRetries: this.config.execution.maxRetries, onToolConfirm },
    );
    const pjmResult = await pjm.createPlan(pmResult.requirement);
    this.callbacks.onStageComplete('project-manager', Date.now() - pjmStart);

    if (!pjmResult.plan) {
      this.callbacks.onError('项目经理未能生成有效的工作计划。');
      return;
    }

    // 保存计划文档 & 状态
    await this.store.saveDocument(`plan-${pjmResult.plan.id}`, pjmResult.plan);
    state.plan = pjmResult.plan;
    state.currentStage = 'dispatch';
    await savePipelineState(state, this.store);

    // 用户确认计划
    const planApproved = await this.callbacks.onPlanReview(pjmResult.plan);
    if (!planApproved) {
      this.callbacks.onError('用户取消了工作计划。');
      await clearPipelineState(this.store);
      return;
    }

    // ==========================================
    // Step 3+4: 分发任务 + 评估结果
    // ==========================================
    await this.executeTasks(state, onToolConfirm);

    // 清除状态
    await clearPipelineState(this.store);
  }

  /**
   * 从中断处恢复流水线
   */
  async resume(state: PipelineState): Promise<void> {
    await this.store.init();

    const onToolConfirm = this.buildToolConfirm();

    switch (state.currentStage) {
      case 'classify':
      case 'pm':
        // 需要重新开始
        return this.run(state.userInput);

      case 'pjm': {
        // 有需求但没计划，从项目经理开始
        if (!state.requirement) return this.run(state.userInput);

        const pjmStart = Date.now();
        this.callbacks.onStageStart('project-manager', '项目经理正在拆分任务（恢复中）...');
        const pjm = new ProjectManager(
          this.provider,
          getModelForRole(this.config, 'project-manager'),
          this.promptsDir,
          { maxRetries: this.config.execution.maxRetries, onToolConfirm },
        );
        const pjmResult = await pjm.createPlan(state.requirement);
        this.callbacks.onStageComplete('project-manager', Date.now() - pjmStart);

        if (!pjmResult.plan) {
          this.callbacks.onError('项目经理未能生成有效的工作计划。');
          return;
        }

        await this.store.saveDocument(`plan-${pjmResult.plan.id}`, pjmResult.plan);
        state.plan = pjmResult.plan;

        const planApproved = await this.callbacks.onPlanReview(pjmResult.plan);
        if (!planApproved) {
          this.callbacks.onError('用户取消了工作计划。');
          await clearPipelineState(this.store);
          return;
        }

        state.currentStage = 'dispatch';
        await savePipelineState(state, this.store);
        await this.executeTasks(state, onToolConfirm);
        await clearPipelineState(this.store);
        break;
      }

      case 'dispatch': {
        // 有计划，从中断的任务继续
        if (!state.plan) return this.run(state.userInput);
        await this.executeTasks(state, onToolConfirm);
        await clearPipelineState(this.store);
        break;
      }

      case 'summary':
      case 'done':
        // 已完成
        break;
    }
  }

  /**
   * 执行任务分发循环（抽取为公用方法，支持 run 和 resume）
   */
  private async executeTasks(
    state: PipelineState,
    onToolConfirm?: ToolConfirmCallback,
  ): Promise<void> {
    const plan = state.plan!;
    const dispatcher = new Dispatcher({
      provider: this.provider,
      clerkModel: getModelForRole(this.config, 'clerk'),
      evaluatorModel: getModelForRole(this.config, 'evaluator'),
      promptsDir: this.promptsDir,
      maxRetries: this.config.execution.maxRetries,
      onToolConfirm,
      enableVerification: true,
      workingDir: this.config.safety.workingDir,
    });

    const results: DispatchResult[] = [...state.completedResults];
    const tasks = [...plan.tasks].sort((a, b) => a.order - b.order);
    const startIndex = state.currentTaskIndex;

    for (let i = startIndex; i < tasks.length; i++) {
      const task = tasks[i]!;
      this.callbacks.onTaskStart(task.id, task.title, i + 1, tasks.length);

      // 检查依赖是否已完成
      const depsOk = task.depends_on.every((depId) => {
        const depResult = results.find((r) => r.task.id === depId);
        return depResult && depResult.result?.status === 'success';
      });

      if (!depsOk) {
        // 跳过依赖未满足的任务
        this.callbacks.onTaskComplete(task.id, false, '依赖任务未完成，跳过');
        results.push({
          task,
          result: {
            task_id: task.id,
            executed_by: 'clerk',
            timestamp: new Date().toISOString(),
            status: 'skipped',
            changes_made: [],
            output_summary: '依赖任务未完成，跳过',
          },
          evaluation: null,
          verification: null,
        });
        continue;
      }

      // 分发执行
      const taskStart = Date.now();
      const dispatchResult = await dispatcher.dispatchTask(task, plan);
      results.push(dispatchResult);

      const success = dispatchResult.result?.status === 'success';
      this.callbacks.onTaskComplete(
        task.id,
        success,
        dispatchResult.result?.output_summary || '无结果',
      );

      // 报告验证结果
      if (dispatchResult.verification && this.callbacks.onVerification) {
        this.callbacks.onVerification(task.id, dispatchResult.verification);
      }

      // 保存结果
      await this.store.saveDocument(`result-${task.id}`, dispatchResult.result);
      if (dispatchResult.evaluation) {
        await this.store.saveDocument(`evaluation-${task.id}`, dispatchResult.evaluation);
      }

      // 更新断点状态
      state.completedResults = results;
      state.currentTaskIndex = i + 1;
      await savePipelineState(state, this.store);

      // 检查评估决策
      if (dispatchResult.evaluation?.decision === 'pause') {
        const decision = await this.callbacks.onPause(
          dispatchResult.evaluation.reason,
        );
        if (decision === 'abort') {
          break;
        }
      }

      // 更新任务状态
      task.status = success ? 'success' : 'failed';
    }

    // ==========================================
    // Step 5: 总结报告
    // ==========================================
    state.currentStage = 'summary';
    await savePipelineState(state, this.store);

    this.callbacks.onStageStart('summary', '正在生成工作总结...');

    const summary: Summary = {
      plan_id: plan.id,
      timestamp: new Date().toISOString(),
      total_tasks: tasks.length,
      completed_tasks: results.filter((r) => r.result?.status === 'success').length,
      failed_tasks: results.filter((r) => r.result?.status === 'failed').length,
      skipped_tasks: results.filter((r) => r.result?.status === 'skipped').length,
      completed_items: results
        .filter((r) => r.result?.status === 'success')
        .map((r) => r.task.title),
      failed_items: results
        .filter((r) => r.result?.status === 'failed')
        .map((r) => `${r.task.title}: ${r.result?.error || '未知错误'}`),
      overall_summary: `共 ${tasks.length} 个任务，完成 ${results.filter((r) => r.result?.status === 'success').length} 个，失败 ${results.filter((r) => r.result?.status === 'failed').length} 个，跳过 ${results.filter((r) => r.result?.status === 'skipped').length} 个。`,
    };

    await this.store.saveDocument(`summary-${plan.id}`, summary);
    this.callbacks.onSummary(summary);
    this.callbacks.onStageComplete('summary');

    state.currentStage = 'done';
  }
}
