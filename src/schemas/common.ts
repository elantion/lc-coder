/**
 * 共享类型定义
 */
import { z } from 'zod';

/** 角色名称枚举 */
export const RoleNameSchema = z.enum([
  'classifier',
  'product-manager',
  'project-manager',
  'clerk',
  'evaluator',
]);
export type RoleName = z.infer<typeof RoleNameSchema>;

/** 任务复杂度 */
export const ComplexitySchema = z.enum(['simple', 'complex']);
export type Complexity = z.infer<typeof ComplexitySchema>;

/** 任务状态 */
export const TaskStatusSchema = z.enum([
  'pending',
  'running',
  'success',
  'failed',
  'skipped',
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/** 任务类型 */
export const TaskTypeSchema = z.enum([
  'read',       // 读取文件/信息
  'write',      // 创建新文件
  'modify',     // 修改现有文件
  'delete',     // 删除文件
  'shell',      // 执行命令
  'verify',     // 验证/测试
]);
export type TaskType = z.infer<typeof TaskTypeSchema>;

/** 任务复杂度估算 */
export const TaskComplexitySchema = z.enum([
  'trivial',    // 改一个字、读一个文件
  'simple',     // 创建一个简单文件、小的修改
  'moderate',   // 较复杂的修改，需要理解上下文
]);
export type TaskComplexity = z.infer<typeof TaskComplexitySchema>;

/** 评估结论 */
export const EvaluationDecisionSchema = z.enum([
  'continue',         // 成功，继续下一个任务
  'continue-skip',    // 失败但不影响主流程，跳过继续
  'pause',            // 失败且影响主流程，暂停等人工
]);
export type EvaluationDecision = z.infer<typeof EvaluationDecisionSchema>;

/** 文件变更记录 */
export const FileChangeSchema = z.object({
  file: z.string(),
  action: z.enum(['created', 'modified', 'deleted', 'read']),
  summary: z.string().optional(),
});
export type FileChange = z.infer<typeof FileChangeSchema>;
