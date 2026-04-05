/**
 * CLI UI 工具函数
 */
import chalk from 'chalk';
import ora, { type Ora } from 'ora';

const BRAND = chalk.hex('#7C3AED'); // 紫色品牌色
const DIM = chalk.dim;
const SUCCESS = chalk.green;
const WARN = chalk.yellow;
const ERROR = chalk.red;
const INFO = chalk.cyan;

export const ui = {
  /** 品牌 Banner */
  banner() {
    console.log('');
    console.log(BRAND('  ╦  ╔═╗  ╔═╗╔═╗╔╦╗╔═╗╦═╗'));
    console.log(BRAND('  ║  ║    ║  ║║ ║ ║║║╣ ╠╦╝'));
    console.log(BRAND('  ╩═╝╚═╝  ╚═╝╚═╝═╩╝╚═╝╩╚═'));
    console.log(DIM('  小模型流水线编码工具 v0.2.0'));
    console.log('');
  },

  /** 阶段标题 */
  stageStart(icon: string, title: string) {
    console.log(`\n${icon} ${chalk.bold(title)}`);
  },

  /** 阶段完成（带耗时） */
  stageComplete(title: string, durationMs?: number) {
    const timeStr = durationMs ? DIM(` (${ui.formatDuration(durationMs)})`) : '';
    console.log(SUCCESS(`  ✓ ${title} 完成${timeStr}`));
  },

  /** 任务进度 */
  taskProgress(index: number, total: number, title: string) {
    const bar = `[${index}/${total}]`;
    console.log(`\n  ${INFO(bar)} ${title}`);
  },

  /** 任务结果 */
  taskResult(success: boolean, summary: string) {
    if (success) {
      console.log(SUCCESS(`    ✓ ${summary}`));
    } else {
      console.log(ERROR(`    ✗ ${summary}`));
    }
  },

  /** 验证结果 */
  verificationReport(checks: { name: string; passed: boolean; output: string; durationMs: number }[]) {
    if (checks.length === 0) return;
    console.log(`\n  ${chalk.bold('🔍 自动验证')}`);
    for (const check of checks) {
      const icon = check.passed ? SUCCESS('✓') : ERROR('✗');
      const time = DIM(`(${ui.formatDuration(check.durationMs)})`);
      console.log(`    ${icon} ${check.name} ${time}`);
      if (!check.passed) {
        // 显示失败输出的前 3 行
        const lines = check.output.split('\n').slice(0, 3);
        for (const line of lines) {
          console.log(DIM(`      ${line}`));
        }
      }
    }
  },

  /** 文档预览 */
  documentPreview(title: string, doc: Record<string, unknown>) {
    console.log(`\n  ${chalk.bold.underline(title)}`);
    const json = JSON.stringify(doc, null, 2);
    const lines = json.split('\n');
    for (const line of lines.slice(0, 30)) {
      console.log(DIM(`    ${line}`));
    }
    if (lines.length > 30) {
      console.log(DIM(`    ... (${lines.length - 30} 行省略)`));
    }
    console.log('');
  },

  /** 工具确认提示 */
  toolConfirmPrompt(toolName: string, reason: string) {
    console.log('');
    console.log(WARN(`  ⚠ 工具安全确认`));
    console.log(`    工具: ${chalk.bold(toolName)}`);
    console.log(`    原因: ${reason}`);
  },

  /** 错误信息 */
  error(message: string) {
    console.log(ERROR(`\n  ✗ 错误：${message}`));
  },

  /** 警告 */
  warn(message: string) {
    console.log(WARN(`  ⚠ ${message}`));
  },

  /** 信息 */
  info(message: string) {
    console.log(INFO(`  ℹ ${message}`));
  },

  /** 成功 */
  success(message: string) {
    console.log(SUCCESS(`  ✓ ${message}`));
  },

  /** 分隔线 */
  divider() {
    console.log(DIM('  ─────────────────────────────────────'));
  },

  /** 总结报告 */
  summary(data: { total: number; completed: number; failed: number; skipped: number }) {
    console.log(`\n${chalk.bold('  📊 工作总结')}`);
    ui.divider();
    console.log(`  总任务数:  ${data.total}`);
    console.log(`  已完成:    ${SUCCESS(String(data.completed))}`);
    if (data.failed > 0) {
      console.log(`  失败:      ${ERROR(String(data.failed))}`);
    }
    if (data.skipped > 0) {
      console.log(`  跳过:      ${WARN(String(data.skipped))}`);
    }
    ui.divider();
    console.log('');
  },

  /** 创建 Spinner */
  createSpinner(text: string): Ora {
    return ora({
      text,
      color: 'magenta',
      indent: 2,
    });
  },

  /** 格式化耗时 */
  formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainSec = seconds % 60;
    return `${minutes}m${remainSec}s`;
  },

  /** 恢复提示 */
  resumePrompt(stage: string, savedAt: string) {
    console.log('');
    console.log(WARN('  ⚠ 发现未完成的流水线'));
    console.log(`    阶段: ${chalk.bold(stage)}`);
    console.log(`    保存时间: ${savedAt}`);
  },
};
