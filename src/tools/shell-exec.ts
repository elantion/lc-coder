/**
 * 工具：执行 Shell 命令
 * 需要用户确认后才能执行
 */
import type { ToolDefinition } from '../llm/provider.js';

export const shellExecTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'shell_exec',
    description: '执行一条 shell 命令。命令在项目根目录下执行。注意：命令会实际执行，请谨慎使用。',
    parameters: {
      type: 'object',
      properties: {
        command: {
          type: 'string',
          description: '要执行的 shell 命令',
        },
      },
      required: ['command'],
    },
  },
};

export async function shellExecExecutor(
  args: Record<string, unknown>,
): Promise<unknown> {
  const command = String(args.command);
  const cwd = process.cwd();

  try {
    const proc = Bun.spawn(['sh', '-c', command], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    let result = '';
    if (stdout.trim()) result += stdout.trim();
    if (stderr.trim()) result += (result ? '\n' : '') + `[stderr] ${stderr.trim()}`;
    if (!result) result = `命令已执行，退出码: ${exitCode}`;

    // 限制输出长度
    if (result.length > 4000) {
      result = result.slice(0, 4000) + `\n... [输出截断]`;
    }

    return exitCode === 0
      ? result
      : `命令执行失败 (退出码 ${exitCode}):\n${result}`;
  } catch (err: any) {
    return `命令执行错误: ${err.message}`;
  }
}
