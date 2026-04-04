/**
 * CLI 用户交互函数
 */
import * as p from '@clack/prompts';
import type { Requirement } from '../schemas/requirement.js';
import type { Plan } from '../schemas/plan.js';

/**
 * 获取用户输入
 */
export async function getUserInput(): Promise<string | null> {
  const input = await p.text({
    message: '请输入你的需求：',
    placeholder: '例如：给 Header 组件添加响应式导航菜单',
  });

  if (p.isCancel(input)) return null;
  return input as string;
}

/**
 * 追问用户
 */
export async function askQuestions(questions: string[]): Promise<Record<string, string>> {
  const answers: Record<string, string> = {};

  p.note(
    questions.map((q, i) => `${i + 1}. ${q}`).join('\n'),
    '📋 产品经理有以下问题需要确认',
  );

  for (const question of questions) {
    const answer = await p.text({
      message: question,
      placeholder: '请输入你的回答',
    });

    if (p.isCancel(answer)) {
      return answers;
    }
    answers[question] = answer as string;
  }

  return answers;
}

/**
 * 用户确认需求文档
 */
export async function reviewRequirement(req: Requirement): Promise<boolean> {
  console.log('');
  p.note(
    [
      `📝 ${req.requirement.summary}`,
      '',
      '目标：',
      ...req.requirement.goals.map((g) => `  • ${g}`),
      '',
      '不做的事：',
      ...req.requirement.non_goals.map((g) => `  • ${g}`),
      '',
      '验收标准：',
      ...req.requirement.acceptance_criteria.map((c) => `  • ${c}`),
    ].join('\n'),
    '📋 需求分析报告',
  );

  const confirmed = await p.confirm({
    message: '是否确认这份需求？',
  });

  if (p.isCancel(confirmed)) return false;
  return confirmed as boolean;
}

/**
 * 用户确认工作计划
 */
export async function reviewPlan(plan: Plan): Promise<boolean> {
  console.log('');
  const taskList = plan.tasks
    .sort((a, b) => a.order - b.order)
    .map((t) => `  ${t.order}. [${t.type}] ${t.title} (${t.estimated_complexity})`)
    .join('\n');

  p.note(
    [
      `📋 ${plan.summary}`,
      '',
      `共 ${plan.tasks.length} 个子任务：`,
      '',
      taskList,
    ].join('\n'),
    '🗂️ 工作计划',
  );

  const confirmed = await p.confirm({
    message: '是否确认并开始执行这份计划？',
  });

  if (p.isCancel(confirmed)) return false;
  return confirmed as boolean;
}

/**
 * 暂停等待人工决策
 */
export async function pauseForDecision(reason: string): Promise<'continue' | 'abort'> {
  console.log('');
  p.note(reason, '⚠️ 流水线已暂停');

  const decision = await p.select({
    message: '请选择操作：',
    options: [
      { value: 'continue', label: '继续执行后续任务' },
      { value: 'abort', label: '终止流水线' },
    ],
  });

  if (p.isCancel(decision)) return 'abort';
  return decision as 'continue' | 'abort';
}
