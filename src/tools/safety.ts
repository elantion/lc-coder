/**
 * 安全检查模块
 * 拦截危险命令、覆盖确认
 */
import { existsSync } from 'fs';
import { resolve } from 'path';
import type { LcCoderConfig } from '../config/index.js';

/** 危险命令模式（正则） */
const DANGEROUS_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /rm\s+(-[^\s]*)?r[^\s]*f/i, reason: '递归强制删除' },
  { pattern: /rm\s+(-[^\s]*)?f[^\s]*r/i, reason: '强制递归删除' },
  { pattern: /\bsudo\b/, reason: '需要超级用户权限' },
  { pattern: /\bmkfs\b/, reason: '格式化文件系统' },
  { pattern: /\bdd\b\s+.*of=/, reason: '直接写入设备' },
  { pattern: /chmod\s+777/, reason: '过于宽松的权限' },
  { pattern: /:\(\)\{.*\|.*&\}/, reason: 'Fork bomb' },
  { pattern: />\s*\/dev\/sd[a-z]/, reason: '直接写入磁盘设备' },
  { pattern: /curl.*\|\s*(ba)?sh/, reason: '远程脚本执行' },
  { pattern: /wget.*\|\s*(ba)?sh/, reason: '远程脚本执行' },
  { pattern: /\bshutdown\b/, reason: '关机命令' },
  { pattern: /\breboot\b/, reason: '重启命令' },
];

/**
 * 检测是否是危险命令
 */
export function isDangerousCommand(command: string): { dangerous: boolean; reason?: string } {
  for (const { pattern, reason } of DANGEROUS_PATTERNS) {
    if (pattern.test(command)) {
      return { dangerous: true, reason };
    }
  }
  return { dangerous: false };
}

/**
 * 判断工具是否需要用户确认
 */
export function requiresConfirmation(
  toolName: string,
  args: Record<string, unknown>,
  config: LcCoderConfig,
): { needsConfirm: boolean; reason?: string } {
  // shell_exec
  if (toolName === 'shell_exec') {
    const command = String(args.command || '');
    // 危险命令始终拦截（即使 allowShellExec = true）
    const check = isDangerousCommand(command);
    if (check.dangerous) {
      return { needsConfirm: true, reason: `⚠ 危险命令：${check.reason}\n  命令：${command}` };
    }
    // 非危险命令看配置
    if (!config.safety.allowShellExec) {
      return { needsConfirm: true, reason: `执行 Shell 命令：${command}` };
    }
    return { needsConfirm: false };
  }

  // file_write — 覆盖已有文件时确认
  if (toolName === 'file_write') {
    const path = String(args.path || '');
    const fullPath = resolve(config.safety.workingDir || process.cwd(), path);
    if (existsSync(fullPath)) {
      return { needsConfirm: true, reason: `覆盖已有文件：${path}` };
    }
    // 新创建的文件不需要确认
    return { needsConfirm: false };
  }

  // file_patch — 修改文件确认
  if (toolName === 'file_patch') {
    if (!config.safety.allowFileWrite) {
      const path = String(args.path || '');
      return { needsConfirm: true, reason: `修改文件：${path}` };
    }
    return { needsConfirm: false };
  }

  return { needsConfirm: false };
}
