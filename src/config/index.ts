/**
 * 配置管理
 */
import { existsSync } from 'fs';
import { join } from 'path';

export interface LcCoderConfig {
  /** LLM 提供商 (ollama, openai) */
  provider?: 'ollama' | 'openai';
  /** 默认模型 */
  model: string;
  /** Ollama 地址 */
  ollamaHost: string;
  /** OpenAI 兼容配置 (如 Minimax, DeepSeek) */
  openai?: {
    apiKey: string;
    baseURL?: string;
  };
  /** 每个角色可单独配模型 */
  roles: {
    classifier?: { model?: string; provider?: 'ollama' | 'openai' };
    'product-manager'?: { model?: string; provider?: 'ollama' | 'openai' };
    'project-manager'?: { model?: string; provider?: 'ollama' | 'openai' };
    clerk?: { model?: string; provider?: 'ollama' | 'openai' };
    evaluator?: { model?: string; provider?: 'ollama' | 'openai' };
  };
  /** 执行设置 */
  execution: {
    maxRetries: number;
    parallelTasks: boolean;
    autoConfirm: boolean;
  };
  /** 安全设置 */
  safety: {
    allowShellExec: boolean;
    allowFileWrite: boolean;
    workingDir: string;
  };
}

/** 默认配置 */
export const DEFAULT_CONFIG: LcCoderConfig = {
  provider: 'ollama',
  model: 'gemma4:latest',
  ollamaHost: 'http://192.168.68.210:11434',
  roles: {},
  execution: {
    maxRetries: 2,
    parallelTasks: false,
    autoConfirm: false,
  },
  safety: {
    allowShellExec: false,
    allowFileWrite: true,
    workingDir: process.cwd(),
  },
};

/**
 * 加载配置：项目级 .lc-coder/config.json > 默认配置
 */
export function loadConfig(workingDir?: string): LcCoderConfig {
  const cwd = workingDir || process.cwd();
  const configPath = join(cwd, '.lc-coder', 'config.json');

  let projectConfig: Partial<LcCoderConfig> = {};
  if (existsSync(configPath)) {
    try {
      const raw = require(configPath);
      projectConfig = raw;
    } catch {
      // 配置文件解析失败，使用默认
    }
  }

  const merged = deepMerge(DEFAULT_CONFIG, projectConfig) as LcCoderConfig;

  // 尝试从环境变量读取 API Key
  if (merged.provider === 'openai') {
    if (!merged.openai) {
      merged.openai = { apiKey: '' };
    }
    if (!merged.openai.apiKey) {
      merged.openai.apiKey = process.env.OPENAI_API_KEY || process.env.MINIMAX_API_KEY || '';
    }
  }

  return merged;
}

/**
 * 获取角色使用的模型
 */
export function getModelForRole(config: LcCoderConfig, role: string): string {
  const roleConfig = (config.roles as any)[role];
  return roleConfig?.model || config.model;
}

/**
 * 获取角色使用的 LLM 提供商
 */
export function getProviderForRole(config: LcCoderConfig, role: string): 'ollama' | 'openai' {
  const roleConfig = (config.roles as any)[role];
  return roleConfig?.provider || config.provider || 'ollama';
}

function deepMerge(target: any, source: any): any {
  const output = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object'
    ) {
      output[key] = deepMerge(target[key], source[key]);
    } else if (source[key] !== undefined) {
      output[key] = source[key];
    }
  }
  return output;
}
