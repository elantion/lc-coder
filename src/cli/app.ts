/**
 * 主应用逻辑
 * 连接 CLI 交互和流水线编排器
 */
import * as p from '@clack/prompts';
import { Orchestrator, type PipelineCallbacks } from '../pipeline/orchestrator.js';
import { OllamaProvider } from '../llm/ollama.js';
import { DocumentStore } from '../documents/store.js';
import { loadConfig } from '../config/index.js';
import { ui } from './ui.js';
import {
  getUserInput,
  askQuestions,
  reviewRequirement,
  reviewPlan,
  pauseForDecision,
} from './interactive.js';
import type { Requirement } from '../schemas/requirement.js';
import type { Plan } from '../schemas/plan.js';
import type { Summary } from '../schemas/result.js';

export async function runApp(): Promise<void> {
  // 显示 Banner
  ui.banner();

  // 加载配置
  const config = loadConfig();

  // 初始化 Ollama 连接
  const provider = new OllamaProvider(config.ollamaHost);

  // 健康检查
  const spinner = p.spinner();
  spinner.start('正在连接 Ollama...');
  const health = await provider.checkHealth(config.model);
  spinner.stop('');

  if (!health.connected) {
    ui.error(`无法连接到 Ollama (${config.ollamaHost})`);
    ui.info('请确保 Ollama 已启动：ollama serve');
    process.exit(1);
  }

  if (!health.modelAvailable) {
    ui.warn(`模型 ${config.model} 未找到`);
    ui.info(`请先拉取模型：ollama pull ${config.model}`);
    process.exit(1);
  }

  ui.success(`已连接 Ollama，模型: ${config.model}`);

  // 获取用户输入
  const userInput = await getUserInput();
  if (!userInput) {
    p.outro('再见 👋');
    return;
  }

  // 初始化文档存储
  const store = new DocumentStore();

  // 获取 prompts 目录路径
  const promptsDir = new URL('../../prompts', import.meta.url).pathname;

  // 构建流水线回调
  const callbacks: PipelineCallbacks = {
    onStageStart(stage: string, description: string) {
      const icons: Record<string, string> = {
        'classifier': '🔍',
        'direct-answer': '💬',
        'product-manager': '📋',
        'project-manager': '🗂️',
        'summary': '📊',
      };
      ui.stageStart(icons[stage] || '⚙️', description);
    },

    onStageComplete(stage: string) {
      // spinner 已在 stage start 时停止
    },

    async onQuestion(questions: string[]): Promise<Record<string, string>> {
      return askQuestions(questions);
    },

    async onRequirementReview(requirement: Requirement): Promise<boolean> {
      return reviewRequirement(requirement);
    },

    async onPlanReview(plan: Plan): Promise<boolean> {
      return reviewPlan(plan);
    },

    onTaskStart(taskId: string, title: string, index: number, total: number) {
      ui.taskProgress(index, total, title);
    },

    onTaskComplete(taskId: string, success: boolean, summary: string) {
      ui.taskResult(success, summary);
    },

    async onPause(reason: string): Promise<'continue' | 'abort'> {
      return pauseForDecision(reason);
    },

    onSimpleResponse(response: string) {
      console.log(`\n${response}\n`);
    },

    onSummary(summary: Summary) {
      ui.summary({
        total: summary.total_tasks,
        completed: summary.completed_tasks,
        failed: summary.failed_tasks,
        skipped: summary.skipped_tasks,
      });

      if (summary.failed_items.length > 0) {
        ui.warn('失败的任务：');
        for (const item of summary.failed_items) {
          console.log(`    • ${item}`);
        }
      }
    },

    onError(error: string) {
      ui.error(error);
    },
  };

  // 运行流水线
  const orchestrator = new Orchestrator({
    provider,
    config,
    store,
    callbacks,
    promptsDir,
  });

  try {
    await orchestrator.run(userInput);
  } catch (err: any) {
    ui.error(`流水线执行异常: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err);
    }
  }

  p.outro('完成 🎉');
}
