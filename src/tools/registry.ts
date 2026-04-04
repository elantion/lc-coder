/**
 * 工具注册中心
 * 按角色限制可用工具，提供 Ollama function calling 格式的工具定义
 */
import type { ToolDefinition } from '../llm/provider.js';
import type { RoleName } from '../schemas/common.js';
import { fileReadTool, fileReadExecutor } from './file-read.js';
import { fileWriteTool, fileWriteExecutor } from './file-write.js';
import { filePatchTool, filePatchExecutor } from './file-patch.js';
import { dirListTool, dirListExecutor } from './dir-list.js';
import { grepSearchTool, grepSearchExecutor } from './grep-search.js';
import { shellExecTool, shellExecExecutor } from './shell-exec.js';

/** 所有可用工具 */
const ALL_TOOLS: Record<string, {
  definition: ToolDefinition;
  executor: (args: Record<string, unknown>) => Promise<unknown>;
}> = {
  file_read: { definition: fileReadTool, executor: fileReadExecutor },
  file_write: { definition: fileWriteTool, executor: fileWriteExecutor },
  file_patch: { definition: filePatchTool, executor: filePatchExecutor },
  dir_list: { definition: dirListTool, executor: dirListExecutor },
  grep_search: { definition: grepSearchTool, executor: grepSearchExecutor },
  shell_exec: { definition: shellExecTool, executor: shellExecExecutor },
};

/** 角色→可用工具映射 */
const ROLE_TOOLS: Record<RoleName, string[]> = {
  'classifier': [],
  'product-manager': ['file_read', 'dir_list', 'grep_search'],
  'project-manager': ['file_read', 'dir_list', 'grep_search'],
  'clerk': ['file_read', 'file_write', 'file_patch', 'dir_list', 'grep_search', 'shell_exec'],
  'evaluator': [],
};

/**
 * 获取某角色的工具定义列表
 */
export function getToolDefinitions(role: RoleName): ToolDefinition[] {
  const toolNames = ROLE_TOOLS[role] || [];
  return toolNames
    .map((name) => ALL_TOOLS[name]?.definition)
    .filter(Boolean) as ToolDefinition[];
}

/**
 * 获取某角色的工具执行器映射
 */
export function getToolExecutors(
  role: RoleName,
): Map<string, (args: Record<string, unknown>) => Promise<unknown>> {
  const map = new Map<string, (args: Record<string, unknown>) => Promise<unknown>>();
  const toolNames = ROLE_TOOLS[role] || [];
  for (const name of toolNames) {
    const tool = ALL_TOOLS[name];
    if (tool) {
      map.set(name, tool.executor);
    }
  }
  return map;
}
