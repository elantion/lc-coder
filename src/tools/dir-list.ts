/**
 * 工具：列出目录
 */
import { readdir, stat } from 'fs/promises';
import { resolve, join } from 'path';
import type { ToolDefinition } from '../llm/provider.js';

export const dirListTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'dir_list',
    description: '列出指定目录的内容（文件和子目录）。默认只列出一层，可设置 recursive 列出子目录。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目录的相对路径，默认为 "."（项目根目录）',
        },
        recursive: {
          type: 'string',
          description: '是否递归列出子目录，值为 "true" 或 "false"，默认 "false"',
        },
      },
      required: ['path'],
    },
  },
};

export async function dirListExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const path = String(args.path || '.');
  const recursive = String(args.recursive) === 'true';
  const fullPath = resolve(process.cwd(), path);

  try {
    const entries = await listDir(fullPath, recursive, '', 0);
    // 限制结果数量
    if (entries.length > 200) {
      return entries.slice(0, 200).join('\n') + `\n... [截断，共 ${entries.length} 项]`;
    }
    return entries.join('\n');
  } catch (err: any) {
    return `错误：无法列出目录 ${path} - ${err.message}`;
  }
}

async function listDir(
  dir: string,
  recursive: boolean,
  prefix: string,
  depth: number,
): Promise<string[]> {
  if (depth > 5) return []; // 防止过深递归

  const entries = await readdir(dir);
  const results: string[] = [];

  for (const entry of entries) {
    // 跳过常见的不需要列出的目录
    if (['node_modules', '.git', '.lc-coder', 'dist', '.next'].includes(entry)) continue;

    const fullPath = join(dir, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      results.push(`${prefix}${entry}/`);
      if (recursive) {
        const children = await listDir(fullPath, true, prefix + '  ', depth + 1);
        results.push(...children);
      }
    } else {
      results.push(`${prefix}${entry}`);
    }
  }

  return results;
}
