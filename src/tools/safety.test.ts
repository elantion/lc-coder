import { describe, it, expect } from 'vitest';
import { isDangerousCommand, requiresConfirmation } from './safety.js';
import type { LcCoderConfig } from '../config/index.js';

describe('safety - isDangerousCommand', () => {
  it('should flag rm -rf as dangerous', () => {
    const result = isDangerousCommand('rm -rf /');
    expect(result.dangerous).toBe(true);
    expect(result.reason).toContain('递归强制删除');
  });

  it('should flag sudo as dangerous', () => {
    const result = isDangerousCommand('sudo apt update');
    expect(result.dangerous).toBe(true);
    expect(result.reason).toContain('超级用户权限');
  });

  it('should allow normal echo command', () => {
    const result = isDangerousCommand('echo "hello world"');
    expect(result.dangerous).toBe(false);
  });
});

describe('safety - requiresConfirmation', () => {
  const mockConfig = {
    model: 'test-model',
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    workingDir: process.cwd(),
    safety: {
      allowShellExec: false,
      allowFileWrite: false,
      workingDir: process.cwd(),
    },
    execution: {
      maxRetries: 2,
      parallelTasks: false,
      autoConfirm: false,
    },
    roles: {},
  } as unknown as LcCoderConfig;

  it('should require confirmation for dangerous shell commands regardless of config', () => {
    const result = requiresConfirmation('shell_exec', { command: 'rm -rf node_modules' }, { ...mockConfig, safety: { allowShellExec: true, allowFileWrite: true, workingDir: process.cwd() } });
    expect(result.needsConfirm).toBe(true);
    expect(result.reason).toContain('危险命令');
  });

  it('should require confirmation for all shell commands if allowShellExec is false', () => {
    const result = requiresConfirmation('shell_exec', { command: 'ls' }, mockConfig);
    expect(result.needsConfirm).toBe(true);
    expect(result.reason).toContain('执行 Shell 命令');
  });

  it('should not require confirmation for safe shell commands if allowShellExec is true', () => {
    const result = requiresConfirmation('shell_exec', { command: 'ls' }, { ...mockConfig, safety: { allowShellExec: true, allowFileWrite: true, workingDir: process.cwd() } });
    expect(result.needsConfirm).toBe(false);
  });

  it('should require confirmation for file_patch if allowFileWrite is false', () => {
    const result = requiresConfirmation('file_patch', { path: 'test.ts', content: 'test' }, mockConfig);
    expect(result.needsConfirm).toBe(true);
    expect(result.reason).toContain('修改文件');
  });

  it('should not require confirmation for file_patch if allowFileWrite is true', () => {
    const result = requiresConfirmation('file_patch', { path: 'test.ts', content: 'test' }, { ...mockConfig, safety: { allowShellExec: true, allowFileWrite: true, workingDir: process.cwd() } });
    expect(result.needsConfirm).toBe(false);
  });
});
