/**
 * 工具：代码搜索 (grep)
 */
import { resolve } from 'path';
import type { ToolDefinition } from '../llm/provider.js';

export const grepSearchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'grep_search',
    description: '在项目文件中搜索指定内容。返回匹配的文件名和行号。',
    parameters: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: '搜索的文本模式',
        },
        path: {
          type: 'string',
          description: '搜索的目录路径，默认为 "."（项目根目录）',
        },
        file_pattern: {
          type: 'string',
          description: '文件过滤模式，如 "*.ts"，"*.py"',
        },
      },
      required: ['pattern'],
    },
  },
};

export async function grepSearchExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const pattern = String(args.pattern);
  const searchPath = resolve(process.cwd(), String(args.path || '.'));
  const filePattern = args.file_pattern ? String(args.file_pattern) : undefined;

  try {
    // 使用 grep 命令进行搜索
    const grepArgs = ['-rn', '--include', filePattern || '*', pattern, searchPath];
    if (!filePattern) {
      grepArgs.splice(2, 2); // 移除 --include 如果没有指定
    }

    const proc = Bun.spawn(['grep', '-rn', '-l', '--max-count=5', pattern, searchPath], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (!output.trim()) {
      return `未找到匹配 "${pattern}" 的内容`;
    }

    // 限制输出
    const lines = output.trim().split('\n').slice(0, 20);
    // 将绝对路径转为相对路径
    const cwd = process.cwd();
    const relative = lines.map((l) => l.replace(cwd + '/', ''));
    return relative.join('\n');
  } catch (err: any) {
    return `搜索错误: ${err.message}`;
  }
}
