#!/usr/bin/env bun
/**
 * 端到端流水线测试脚本（非交互式）
 * 模拟一个完整的流水线执行过程
 */
import { OllamaProvider } from '../src/llm/ollama.js';
import { classifyRequest } from '../src/pipeline/classifier.js';
import { ProductManager } from '../src/roles/product-manager.js';
import { ProjectManager } from '../src/roles/project-manager.js';
import { Clerk } from '../src/roles/clerk.js';
import { Evaluator } from '../src/roles/evaluator.js';
import { DocumentStore } from '../src/documents/store.js';
import { DEFAULT_CONFIG } from '../src/config/index.js';
import { join } from 'path';

const MODEL = DEFAULT_CONFIG.model;
const HOST = DEFAULT_CONFIG.ollamaHost;
const PROMPTS_DIR = join(import.meta.dir, '../prompts');

// 颜色输出
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(icon: string, msg: string) {
  console.log(`${icon} ${msg}`);
}

function pass(msg: string) { log(`${GREEN}✓${RESET}`, msg); }
function fail(msg: string) { log(`${RED}✗${RESET}`, msg); }
function info(msg: string) { log(`${CYAN}ℹ${RESET}`, msg); }
function warn(msg: string) { log(`${YELLOW}⚠${RESET}`, msg); }
function section(msg: string) {
  console.log(`\n${BOLD}━━━ ${msg} ━━━${RESET}`);
}
function detail(msg: string) {
  console.log(`  ${DIM}${msg}${RESET}`);
}

async function main() {
  console.log(`\n${BOLD}${CYAN}LC-Coder 端到端流水线测试${RESET}`);
  console.log(`${DIM}模型: ${MODEL} | 地址: ${HOST}${RESET}\n`);

  const provider = new OllamaProvider(HOST);
  const store = new DocumentStore(join(import.meta.dir, '..'));
  await store.init();

  // ============================================
  // 测试 1: 健康检查
  // ============================================
  section('测试 1: Ollama 健康检查');
  const health = await provider.checkHealth(MODEL);
  if (health.connected) {
    pass(`Ollama 连接成功`);
  } else {
    fail(`Ollama 连接失败: ${health.error}`);
    process.exit(1);
  }
  if (health.modelAvailable) {
    pass(`模型 ${MODEL} 可用`);
  } else {
    fail(`模型 ${MODEL} 不可用`);
    process.exit(1);
  }

  // ============================================
  // 测试 2: 简单请求分类
  // ============================================
  section('测试 2: 分类器 — 简单请求');
  const simpleInput = '1 + 1 等于几？';
  info(`输入: "${simpleInput}"`);

  const t2Start = Date.now();
  const simpleResult = await classifyRequest(simpleInput, provider, MODEL, PROMPTS_DIR);
  const t2Time = Date.now() - t2Start;

  detail(`分类结果: ${JSON.stringify(simpleResult)}`);
  detail(`耗时: ${t2Time}ms`);

  if (simpleResult.complexity === 'simple') {
    pass('正确分类为 simple');
  } else {
    warn(`分类为 ${simpleResult.complexity}，期望 simple`);
  }

  // ============================================
  // 测试 3: 复杂请求分类
  // ============================================
  section('测试 3: 分类器 — 复杂请求');
  const complexInput = '重构 Header 组件，添加响应式导航菜单，支持移动端汉堡菜单';
  info(`输入: "${complexInput}"`);

  const t3Start = Date.now();
  const complexResult = await classifyRequest(complexInput, provider, MODEL, PROMPTS_DIR);
  const t3Time = Date.now() - t3Start;

  detail(`分类结果: ${JSON.stringify(complexResult)}`);
  detail(`耗时: ${t3Time}ms`);

  if (complexResult.complexity === 'complex') {
    pass('正确分类为 complex');
  } else {
    warn(`分类为 ${complexResult.complexity}，期望 complex`);
  }

  // ============================================
  // 测试 4: 产品经理 — 需求分析
  // ============================================
  section('测试 4: 产品经理 — 需求分析');
  const testRequirement = '在项目根目录创建一个 utils.ts 文件，导出一个 add 函数，接受两个数字参数并返回它们的和。';
  info(`输入: "${testRequirement}"`);

  const pm = new ProductManager(provider, MODEL, PROMPTS_DIR);
  const t4Start = Date.now();
  const pmResult = await pm.analyze(testRequirement);
  const t4Time = Date.now() - t4Start;

  detail(`耗时: ${t4Time}ms`);

  if (pmResult.requirement) {
    pass('成功生成需求文档');
    detail(`概要: ${pmResult.requirement.requirement.summary}`);
    detail(`目标: ${pmResult.requirement.requirement.goals.join(', ')}`);
    detail(`验收标准: ${pmResult.requirement.requirement.acceptance_criteria.join(', ')}`);
    await store.saveDocument('test-requirement', pmResult.requirement);
  } else if (pmResult.document) {
    warn('生成了文档但 Schema 校验失败');
    detail(`原始文档 keys: ${Object.keys(pmResult.document).join(', ')}`);
    detail(`原始文本片段: ${pmResult.text.slice(0, 300)}`);
    await store.saveDocument('test-requirement-raw', pmResult.document);
  } else {
    fail('未生成文档');
    detail(`原始文本: ${pmResult.text.slice(0, 500)}`);
  }

  // ============================================
  // 测试 5: 项目经理 — 任务拆分
  // ============================================
  section('测试 5: 项目经理 — 任务拆分');

  // 构造一个简单的需求文档用于测试
  const mockRequirement = pmResult.requirement || {
    id: 'req-test-001',
    version: '1.0',
    created_by: 'product-manager' as const,
    timestamp: new Date().toISOString(),
    project_context: {
      tech_stack: ['TypeScript', 'Bun'],
      key_files: [],
      project_type: 'cli-tool',
    },
    requirement: {
      user_input: testRequirement,
      summary: '创建 utils.ts 文件并导出 add 函数',
      detailed_description: '在项目根目录创建 utils.ts，导出 add(a: number, b: number): number 函数',
      goals: ['创建 utils.ts 文件', '导出 add 函数'],
      non_goals: ['不需要测试文件'],
      acceptance_criteria: ['utils.ts 文件存在', 'add(1, 2) 返回 3'],
    },
    clarifications: [],
  };

  const pjm = new ProjectManager(provider, MODEL, PROMPTS_DIR);
  const t5Start = Date.now();
  const pjmResult = await pjm.createPlan(mockRequirement);
  const t5Time = Date.now() - t5Start;

  detail(`耗时: ${t5Time}ms`);

  if (pjmResult.plan) {
    pass(`成功生成工作计划，共 ${pjmResult.plan.tasks.length} 个子任务`);
    for (const task of pjmResult.plan.tasks) {
      detail(`  ${task.order}. [${task.type}] ${task.title} (${task.estimated_complexity})`);
    }
    await store.saveDocument('test-plan', pjmResult.plan);
  } else if (pjmResult.document) {
    warn('生成了文档但 Schema 校验失败');
    detail(`原始文档 keys: ${Object.keys(pjmResult.document).join(', ')}`);
    detail(`原始文本片段: ${pjmResult.text.slice(0, 300)}`);
    await store.saveDocument('test-plan-raw', pjmResult.document);
  } else {
    fail('未生成计划');
    detail(`原始文本: ${pjmResult.text.slice(0, 500)}`);
  }

  // ============================================
  // 测试 6: 办事员 — 执行任务
  // ============================================
  section('测试 6: 办事员 — 执行单个任务');

  const testInstruction = {
    task_id: 'task-test-001',
    type: 'write' as const,
    title: '创建 utils.ts 文件',
    instructions: `在项目根目录创建文件 test-output/utils.ts，内容如下：

export function add(a: number, b: number): number {
  return a + b;
}

请使用 file_write 工具创建此文件。`,
    input_files: [],
    output_files: ['test-output/utils.ts'],
    code_template: `export function add(a: number, b: number): number {\n  return a + b;\n}`,
    verification: '文件已创建且内容正确',
  };

  info(`任务: ${testInstruction.title}`);

  const clerk = new Clerk(provider, MODEL, PROMPTS_DIR);
  const t6Start = Date.now();
  const clerkResult = await clerk.executeTask(testInstruction);
  const t6Time = Date.now() - t6Start;

  detail(`耗时: ${t6Time}ms`);

  if (clerkResult.result) {
    if (clerkResult.result.status === 'success') {
      pass(`任务执行成功: ${clerkResult.result.output_summary}`);
    } else {
      warn(`任务状态: ${clerkResult.result.status}`);
      detail(`错误: ${clerkResult.result.error || '无'}`);
    }
    detail(`变更: ${JSON.stringify(clerkResult.result.changes_made)}`);
    await store.saveDocument('test-result', clerkResult.result);
  } else {
    warn('未返回标准结果报告');
    detail(`原始文本: ${clerkResult.text.slice(0, 500)}`);
  }

  // 验证文件是否真的创建了
  try {
    const created = await Bun.file(join(import.meta.dir, '../test-output/utils.ts')).text();
    if (created.includes('function add')) {
      pass('文件验证: utils.ts 已成功创建且包含 add 函数');
      detail(`文件内容:\n${created}`);
    } else {
      warn('文件已创建但内容不符预期');
      detail(`文件内容:\n${created}`);
    }
  } catch {
    fail('文件验证失败: test-output/utils.ts 未被创建');
  }

  // ============================================
  // 测试 7: 评估器
  // ============================================
  section('测试 7: 评估器 — 评估执行结果');

  const testResult = clerkResult.result || {
    task_id: 'task-test-001',
    executed_by: 'clerk' as const,
    timestamp: new Date().toISOString(),
    status: 'success' as const,
    changes_made: [{ file: 'test-output/utils.ts', action: 'created' as const }],
    output_summary: '成功创建 utils.ts',
  };

  const testPlan = pjmResult.plan || {
    id: 'plan-test-001',
    source_requirement: 'req-test-001',
    created_by: 'project-manager' as const,
    timestamp: new Date().toISOString(),
    summary: '测试计划',
    tasks: [{
      id: 'task-test-001',
      order: 1,
      type: 'write' as const,
      title: '创建 utils.ts',
      description: '创建文件',
      input_files: [],
      output_files: ['test-output/utils.ts'],
      depends_on: [],
      estimated_complexity: 'simple' as const,
      instructions: '创建文件',
      status: 'success' as const,
    }],
    critical_path: ['task-test-001'],
  };

  const evaluator = new Evaluator(provider, MODEL, PROMPTS_DIR);
  const t7Start = Date.now();
  const evalResult = await evaluator.evaluate(testResult, testPlan);
  const t7Time = Date.now() - t7Start;

  detail(`耗时: ${t7Time}ms`);

  if (evalResult.evaluation) {
    pass(`评估完成: decision = ${evalResult.evaluation.decision}`);
    detail(`任务成功: ${evalResult.evaluation.task_succeeded}`);
    detail(`影响关键路径: ${evalResult.evaluation.impacts_critical_path}`);
    detail(`理由: ${evalResult.evaluation.reason}`);
    await store.saveDocument('test-evaluation', evalResult.evaluation);
  } else {
    warn('未返回标准评估结果');
    detail(`原始文本: ${evalResult.text.slice(0, 500)}`);
  }

  // ============================================
  // 总结
  // ============================================
  section('测试总结');
  console.log('');
  info('所有测试文档已保存到 .lc-coder/documents/ 目录');
  info('你可以检查这些 JSON 文件来评估模型的输出质量');
  console.log('');
}

main().catch((err) => {
  console.error(`\n${RED}测试失败:${RESET}`, err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
