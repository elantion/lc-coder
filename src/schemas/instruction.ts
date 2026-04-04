/**
 * 办事员指令 Schema
 * 由任务分发器基于计划文档生成
 */
import { z } from 'zod';
import { TaskTypeSchema } from './common.js';

/** 办事员执行指令 */
export const InstructionSchema = z.object({
  task_id: z.string().describe('对应的任务 ID'),
  type: TaskTypeSchema.describe('任务类型'),
  title: z.string().describe('任务标题'),
  instructions: z.string().describe('详细的执行指令'),
  input_files: z.array(z.string()).describe('需要读取的文件'),
  output_files: z.array(z.string()).describe('需要写入的文件'),
  code_template: z.string().optional().describe('代码模板'),
  verification: z.string().optional().describe('完成后如何验证'),
  context: z.string().optional().describe('必要的上下文信息（精简）'),
});

export type Instruction = z.infer<typeof InstructionSchema>;
