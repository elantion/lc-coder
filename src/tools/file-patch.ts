/**
 * 工具：局部修改文件
 */
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';
import type { ToolDefinition } from '../llm/provider.js';

export const filePatchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'file_patch',
    description: '局部修改文件：将文件中的 search 内容替换为 replace 内容。search 必须精确匹配文件中已有的文本。',
    parameters: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '文件的相对路径',
        },
        search: {
          type: 'string',
          description: '要查找的原始文本（必须精确匹配）',
        },
        replace: {
          type: 'string',
          description: '替换后的新文本',
        },
      },
      required: ['path', 'search', 'replace'],
    },
  },
};

export async function filePatchExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const path = String(args.path);
  const search = String(args.search);
  const replace = String(args.replace);
  const fullPath = resolve(process.cwd(), path);

  try {
    const content = await readFile(fullPath, 'utf-8');
    if (!content.includes(search)) {
      return `错误：在文件 ${path} 中未找到要替换的内容。请确保 search 内容精确匹配。`;
    }

    const newContent = content.replace(search, replace);
    await writeFile(fullPath, newContent, 'utf-8');
    return `成功修改文件: ${path}`;
  } catch (err: any) {
    return `错误：无法修改文件 ${path} - ${err.message}`;
  }
}
