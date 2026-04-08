/**
 * 主应用逻辑
 * 连接 CLI 交互和流水线编排器
 */
import * as p from '@clack/prompts';
import { Orchestrator, type PipelineCallbacks } from '../pipeline/orchestrator.js';
import { OllamaProvider } from '../llm/ollama.js';
import { OpenAIProvider } from '../llm/openai.js';
import type { LLMProvider } from '../llm/provider.js';
import { DocumentStore } from '../documents/store.js';
import { loadConfig } from '../config/index.js';
import { loadPipelineState } from '../pipeline/state.js';
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
import type { VerificationReport } from '../pipeline/verifier.js';

export async function runApp(): Promise<void> {
  // 显示 Banner
  ui.banner();

  // 加载配置
  const config = loadConfig();

  // 初始化 LLM 连接
  let provider: LLMProvider;
  let providerName = 'Ollama';
  if (config.provider === 'openai') {
    if (!config.openai?.apiKey) {
      ui.error('使用 OpenAI/Minimax 兼容提供商时，需要在配置中设置 openai.apiKey');
      process.exit(1);
    }
    provider = new OpenAIProvider(config.openai.apiKey, config.openai.baseURL);
    providerName = config.openai.baseURL?.includes('minimax') ? 'Minimax' : 'OpenAI Compatible';
  } else {
    provider = new OllamaProvider(config.ollamaHost);
  }

  // 健康检查
  const healthSpinner = ui.createSpinner(`正在连接 ${providerName}...`);
  healthSpinner.start();
  const health = await provider.checkHealth(config.model);
  healthSpinner.stop();

  if (!health.connected) {
    ui.error(`无法连接到 ${providerName}`);
    ui.info(config.provider === 'openai' ? '请检查网络连接或 API Key。' : `请确保 Ollama 已启动：ollama serve (${config.ollamaHost})`);
    process.exit(1);
  }

  if (!health.modelAvailable) {
    ui.warn(`模型 ${config.model} 未找到`);
    ui.info(config.provider === 'openai' ? '请检查模型名称是否拼写正确，或者您的 API Key 是否有权限访问。' : `请先拉取模型：ollama pull ${config.model}`);
    process.exit(1);
  }

  ui.success(`已连接 ${providerName}，模型: ${config.model}`);

  // 初始化文档存储
  const store = new DocumentStore();

  // 获取 prompts 目录路径
  const promptsDir = new URL('../../prompts', import.meta.url).pathname;

  // 构建回调
  const callbacks = buildCallbacks();

  // 构建编排器
  const orchestrator = new Orchestrator({
    provider,
    config,
    store,
    callbacks,
    promptsDir,
  });

  // 检查是否有中断的流水线
  await store.init();
  const savedState = await loadPipelineState(store);
  if (savedState) {
    ui.resumePrompt(savedState.currentStage, savedState.savedAt);
    const resumeChoice = await p.confirm({
      message: '是否从上次中断处恢复？',
    });

    if (!p.isCancel(resumeChoice) && resumeChoice) {
      ui.info(`正在恢复流水线...`);
      try {
        await orchestrator.resume(savedState);
      } catch (err: any) {
        ui.error(`流水线恢复异常: ${err.message}`);
        if (process.env.DEBUG) console.error(err);
      }
      p.outro('完成 🎉');
      return;
    }
  }

  // 获取用户输入
  const userInput = await getUserInput();
  if (!userInput) {
    p.outro('再见 👋');
    return;
  }

  // 运行流水线
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

/**
 * 恢复模式入口（从 CLI 参数调用）
 */
export async function resumeApp(): Promise<void> {
  ui.banner();

  const config = loadConfig();
  let provider: LLMProvider;
  if (config.provider === 'openai') {
    if (!config.openai?.apiKey) {
      ui.error('使用 OpenAI/Minimax 兼容提供商时，需要在配置中设置 openai.apiKey');
      process.exit(1);
    }
    provider = new OpenAIProvider(config.openai.apiKey, config.openai.baseURL);
  } else {
    provider = new OllamaProvider(config.ollamaHost);
  }
  
  const store = new DocumentStore();
  await store.init();

  // 检查是否有中断的流水线
  const savedState = await loadPipelineState(store);
  if (!savedState) {
    ui.info('没有发现中断的流水线。');
    return;
  }

  ui.resumePrompt(savedState.currentStage, savedState.savedAt);
  ui.info(`用户输入: ${savedState.userInput.slice(0, 100)}`);

  const confirmed = await p.confirm({
    message: '是否恢复这个流水线？',
  });

  if (p.isCancel(confirmed) || !confirmed) {
    // 询问是否删除旧状态
    const deleteChoice = await p.confirm({
      message: '是否清除旧的流水线状态？',
    });
    if (!p.isCancel(deleteChoice) && deleteChoice) {
      const { clearPipelineState } = await import('../pipeline/state.js');
      await clearPipelineState(store);
      ui.success('已清除旧状态。');
    }
    return;
  }

  const promptsDir = new URL('../../prompts', import.meta.url).pathname;
  const callbacks = buildCallbacks();

  const orchestrator = new Orchestrator({
    provider,
    config,
    store,
    callbacks,
    promptsDir,
  });

  try {
    await orchestrator.resume(savedState);
  } catch (err: any) {
    ui.error(`流水线恢复异常: ${err.message}`);
    if (process.env.DEBUG) console.error(err);
  }

  p.outro('完成 🎉');
}

/**
 * 构建流水线回调（抽取为公用函数）
 */
function buildCallbacks(): PipelineCallbacks {
  let currentSpinner: ReturnType<typeof ui.createSpinner> | null = null;
  let stageStartTime = 0;

  return {
    onStageStart(stage: string, description: string) {
      const icons: Record<string, string> = {
        'classifier': '🔍',
        'direct-answer': '💬',
        'product-manager': '📋',
        'project-manager': '🗂️',
        'summary': '📊',
      };
      const icon = icons[stage] || '⚙️';

      // 停止之前的 spinner
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }

      ui.stageStart(icon, description);
      stageStartTime = Date.now();

      // 启动新 spinner
      currentSpinner = ui.createSpinner(description);
      currentSpinner.start();
    },

    onStageComplete(stage: string, durationMs?: number) {
      if (currentSpinner) {
        const time = durationMs || (Date.now() - stageStartTime);
        currentSpinner.succeed(`完成 (${ui.formatDuration(time)})`);
        currentSpinner = null;
      }
    },

    async onQuestion(questions: string[]): Promise<Record<string, string>> {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      return askQuestions(questions);
    },

    async onRequirementReview(requirement: Requirement): Promise<boolean> {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      return reviewRequirement(requirement);
    },

    async onPlanReview(plan: Plan): Promise<boolean> {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      return reviewPlan(plan);
    },

    onTaskStart(taskId: string, title: string, index: number, total: number) {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      ui.taskProgress(index, total, title);
      stageStartTime = Date.now();
      currentSpinner = ui.createSpinner(`执行中: ${title}`);
      currentSpinner.start();
    },

    onTaskComplete(taskId: string, success: boolean, summary: string) {
      if (currentSpinner) {
        const time = Date.now() - stageStartTime;
        if (success) {
          currentSpinner.succeed(`${summary} (${ui.formatDuration(time)})`);
        } else {
          currentSpinner.fail(`${summary} (${ui.formatDuration(time)})`);
        }
        currentSpinner = null;
      } else {
        ui.taskResult(success, summary);
      }
    },

    async onPause(reason: string): Promise<'continue' | 'abort'> {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      return pauseForDecision(reason);
    },

    onSimpleResponse(response: string) {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      console.log(`\n${response}\n`);
    },

    onSummary(summary: Summary) {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
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
      if (currentSpinner) {
        currentSpinner.fail(error);
        currentSpinner = null;
      } else {
        ui.error(error);
      }
    },

    async onToolConfirm(
      toolName: string,
      args: Record<string, unknown>,
      reason: string,
    ): Promise<boolean> {
      if (currentSpinner) {
        currentSpinner.stop();
        currentSpinner = null;
      }
      ui.toolConfirmPrompt(toolName, reason);
      const confirmed = await p.confirm({
        message: '是否允许执行？',
      });
      if (p.isCancel(confirmed)) return false;
      return confirmed as boolean;
    },

    onVerification(taskId: string, report: VerificationReport) {
      ui.verificationReport(report.checks);
    },
  };
}
