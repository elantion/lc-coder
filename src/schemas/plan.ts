/**
 * 工作计划 Schema
 * 由项目经理角色生成
 */
import { z } from 'zod';
import { TaskTypeSchema, TaskComplexitySchema, TaskStatusSchema } from './common.js';

/** 单个子任务 */
export const SubTaskSchema = z.object({
  id: z.string().describe('任务 ID，格式：task-xxx'),
  order: z.number().int().describe('执行顺序'),
  type: TaskTypeSchema.describe('任务类型'),
  title: z.string().describe('任务标题（简短）'),
  description: z.string().describe('任务的具体操作描述，越详细越好'),
  input_files: z.array(z.string()).describe('需要读取的文件路径'),
  output_files: z.array(z.string()).describe('需要创建或修改的文件路径'),
  depends_on: z.array(z.string()).describe('依赖的任务 ID 列表'),
  estimated_complexity: TaskComplexitySchema.describe('预估复杂度'),
  instructions: z.string().describe('给办事员的详细指令'),
  code_template: z.string().optional().describe('代码模板（如适用）'),
  verification: z.string().optional().describe('验证方法'),
  status: TaskStatusSchema.default('pending').describe('任务状态'),
});

/** 工作计划 */
export const PlanSchema = z.object({
  id: z.string().describe('计划 ID，格式：plan-xxx'),
  source_requirement: z.string().describe('来源需求 ID'),
  created_by: z.literal('project-manager'),
  timestamp: z.string(),
  summary: z.string().describe('计划概要'),
  tasks: z.array(SubTaskSchema).describe('子任务列表'),
  critical_path: z.array(z.string()).describe('关键路径上的任务 ID'),
  notes: z.string().optional().describe('项目经理的备注'),
});

export type SubTask = z.infer<typeof SubTaskSchema>;
export type Plan = z.infer<typeof PlanSchema>;
