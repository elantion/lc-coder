/**
 * 自动验证层
 * 办事员执行完任务后，自动运行 TypeScript 类型检查、Lint、测试
 */
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';

export interface VerifyResult {
  name: string;
  passed: boolean;
  output: string;
  durationMs: number;
}

export interface VerificationReport {
  checks: VerifyResult[];
  allPassed: boolean;
  timestamp: string;
}

interface ProjectInfo {
  hasTsConfig: boolean;
  hasEslint: boolean;
  hasTestScript: boolean;
  packageManager: 'bun' | 'npm' | 'yarn' | 'pnpm' | 'unknown';
  testCommand?: string;
}

export class Verifier {
  private workingDir: string;

  constructor(workingDir?: string) {
    this.workingDir = workingDir || process.cwd();
  }

  /** 检测项目类型和可用的验证手段 */
  async detectProject(): Promise<ProjectInfo> {
    const info: ProjectInfo = {
      hasTsConfig: false,
      hasEslint: false,
      hasTestScript: false,
      packageManager: 'unknown',
    };

    // tsconfig.json
    info.hasTsConfig = existsSync(join(this.workingDir, 'tsconfig.json'));

    // ESLint 配置 (多种格式)
    const eslintFiles = [
      '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml',
      'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs',
    ];
    info.hasEslint = eslintFiles.some(f => existsSync(join(this.workingDir, f)));

    // package.json — 检测包管理器和测试脚本
    const pkgPath = join(this.workingDir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkgRaw = await readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgRaw);

        // 包管理器
        if (existsSync(join(this.workingDir, 'bun.lock'))) {
          info.packageManager = 'bun';
        } else if (existsSync(join(this.workingDir, 'yarn.lock'))) {
          info.packageManager = 'yarn';
        } else if (existsSync(join(this.workingDir, 'pnpm-lock.yaml'))) {
          info.packageManager = 'pnpm';
        } else {
          info.packageManager = 'npm';
        }

        // 测试脚本
        if (pkg.scripts?.test && pkg.scripts.test !== 'echo "Error: no test specified" && exit 1') {
          info.hasTestScript = true;
          info.testCommand = pkg.scripts.test;
        }
      } catch {
        // 解析失败
      }
    }

    return info;
  }

  /** 运行单个验证命令 */
  private async runCheck(name: string, command: string): Promise<VerifyResult> {
    const start = Date.now();
    try {
      const proc = Bun.spawn(['sh', '-c', command], {
        cwd: this.workingDir,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      const output = [stdout.trim(), stderr.trim()].filter(Boolean).join('\n');
      // 限制输出长度
      const truncated = output.length > 2000
        ? output.slice(0, 2000) + '\n... [输出截断]'
        : output;

      return {
        name,
        passed: exitCode === 0,
        output: truncated || `退出码: ${exitCode}`,
        durationMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        name,
        passed: false,
        output: `运行失败: ${err.message}`,
        durationMs: Date.now() - start,
      };
    }
  }

  /** TypeScript 类型检查 */
  async runTypeCheck(): Promise<VerifyResult | null> {
    const info = await this.detectProject();
    if (!info.hasTsConfig) return null;

    const runner = info.packageManager === 'bun' ? 'bunx' : 'npx';
    return this.runCheck('TypeScript 类型检查', `${runner} tsc --noEmit`);
  }

  /** ESLint 检查 */
  async runLint(): Promise<VerifyResult | null> {
    const info = await this.detectProject();
    if (!info.hasEslint) return null;

    const runner = info.packageManager === 'bun' ? 'bunx' : 'npx';
    return this.runCheck('ESLint 检查', `${runner} eslint . --max-warnings=0`);
  }

  /** 测试运行 */
  async runTests(): Promise<VerifyResult | null> {
    const info = await this.detectProject();
    if (!info.hasTestScript) return null;

    const runner = info.packageManager === 'bun' ? 'bun' : info.packageManager;
    return this.runCheck('测试运行', `${runner} test`);
  }

  /** 运行所有可用的验证 */
  async verify(): Promise<VerificationReport> {
    const checks: VerifyResult[] = [];

    const typeCheck = await this.runTypeCheck();
    if (typeCheck) checks.push(typeCheck);

    const lintCheck = await this.runLint();
    if (lintCheck) checks.push(lintCheck);

    // 注意：测试运行可能比较慢，先不自动运行
    // 只有在有 TypeScript 和 Lint 都通过的情况下才跑测试
    if (checks.every(c => c.passed)) {
      const testCheck = await this.runTests();
      if (testCheck) checks.push(testCheck);
    }

    return {
      checks,
      allPassed: checks.every(c => c.passed),
      timestamp: new Date().toISOString(),
    };
  }
}
