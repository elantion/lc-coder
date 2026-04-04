/**
 * 需求分析报告 Schema
 * 由产品经理角色生成
 */
import { z } from 'zod';

/** 澄清问答 */
export const ClarificationSchema = z.object({
  question: z.string().describe('向用户提出的问题'),
  answer: z.string().describe('用户的回答'),
  answered_by: z.enum(['user', 'inferred']).describe('回答来源：用户直接回答 / AI 推断'),
});

/** 需求分析报告 */
export const RequirementSchema = z.object({
  id: z.string().describe('需求 ID，格式：req-xxx'),
  version: z.string().default('1.0'),
  created_by: z.literal('product-manager'),
  timestamp: z.string(),
  project_context: z.object({
    tech_stack: z.array(z.string()).describe('项目使用的技术栈'),
    key_files: z.array(z.string()).describe('与需求相关的核心文件路径'),
    framework: z.string().optional().describe('项目使用的框架'),
    project_type: z.string().optional().describe('项目类型，如 web-app, cli-tool, library'),
  }),
  requirement: z.object({
    user_input: z.string().describe('用户原始输入'),
    summary: z.string().describe('需求概要（一句话）'),
    detailed_description: z.string().describe('需求详细描述'),
    goals: z.array(z.string()).describe('需求目标列表'),
    non_goals: z.array(z.string()).describe('明确不做的事项'),
    acceptance_criteria: z.array(z.string()).describe('验收标准'),
  }),
  clarifications: z.array(ClarificationSchema).describe('需求澄清问答记录'),
});

export type Requirement = z.infer<typeof RequirementSchema>;
export type Clarification = z.infer<typeof ClarificationSchema>;
