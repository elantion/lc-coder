/**
 * 工具：读取文件
 */
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import type { ToolDefinition } from '../llm/provider.js';

export const fileReadTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'file_read',
    description: '读取指定文件的内容。返回文件的文本内容。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件的相对路径（相对于项目根目录）',
        },
      },
      required: ['path'],
    },
  },
};

export async function fileReadExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const path = String(args.path);
  const fullPath = resolve(process.cwd(), path);
  try {
    const content = await readFile(fullPath, 'utf-8');
    // 限制返回长度，避免上下文爆炸
    if (content.length > 8000) {
      return content.slice(0, 8000) + `\n\n... [文件截断，总长度 ${content.length} 字符]`;
    }
    return content;
  } catch (err: any) {
    return `错误：无法读取文件 ${path} - ${err.message}`;
  }
}
