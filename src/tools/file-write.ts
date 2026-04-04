/**
 * 工具：写入文件
 */
import { writeFile, mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import type { ToolDefinition } from '../llm/provider.js';

export const fileWriteTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'file_write',
    description: '将内容写入指定文件。如果文件不存在，会自动创建（包括中间目录）。如果文件已存在，会覆盖。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件的相对路径（相对于项目根目录）',
        },
        content: {
          type: 'string',
          description: '要写入的文件内容',
        },
      },
      required: ['path', 'content'],
    },
  },
};

export async function fileWriteExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const path = String(args.path);
  const content = String(args.content);
  const fullPath = resolve(process.cwd(), path);

  try {
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, 'utf-8');
    return `成功写入文件: ${path} (${content.length} 字符)`;
  } catch (err: any) {
    return `错误：无法写入文件 ${path} - ${err.message}`;
  }
}
