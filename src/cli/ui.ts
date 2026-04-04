/**
 * CLI UI 工具函数
 */
import chalk from 'chalk';

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
    console.log(DIM('  小模型流水线编码工具 v0.1.0'));
    console.log('');
  },

  /** 阶段标题 */
  stageStart(icon: string, title: string) {
    console.log(`\n${icon} ${chalk.bold(title)}`);
  },

  /** 阶段完成 */
  stageComplete(title: string) {
    console.log(SUCCESS(`  ✓ ${title} 完成`));
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
};
