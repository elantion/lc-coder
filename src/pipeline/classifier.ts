/**
 * 复杂度分类器
 * 判断用户请求是简单还是复杂
 */
import { BaseRole } from '../roles/base-role.js';
import type { LLMProvider } from '../llm/provider.js';
import type { Complexity } from '../schemas/common.js';

class ClassifierRole extends BaseRole {
  constructor(provider: LLMProvider, model: string, promptsDir?: string) {
    super({
      roleName: 'classifier',
      promptFileName: 'classifier.md',
      provider,
      model,
      promptsDir,
    });
  }
}

/**
 * 分类用户请求
 */
export async function classifyRequest(
  userInput: string,
  provider: LLMProvider,
  model: string,
  promptsDir?: string,
): Promise<{ complexity: Complexity; reason: string }> {
  const classifier = new ClassifierRole(provider, model, promptsDir);
  const result = await classifier.execute({
    userMessage: userInput,
  });

  // 尝试解析分类结果
  if (result.document) {
    const doc = result.document as any;
    if (doc.complexity === 'simple' || doc.complexity === 'complex') {
      return { complexity: doc.complexity, reason: doc.reason || '' };
    }
  }

  // 回退：从文本中查找关键词
  const text = result.text.toLowerCase();
  if (text.includes('"simple"') || text.includes("'simple'")) {
    return { complexity: 'simple', reason: '从文本推断' };
  }

  // 默认为复杂
  return { complexity: 'complex', reason: '无法确定，默认为复杂' };
}
