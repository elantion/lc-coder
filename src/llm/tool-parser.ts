/**
 * Tool call 文本解析器（回退机制）
 * 当模型不通过正式 tool_calls 字段返回时，从文本中提取
 */
import type { ToolCall } from './provider.js';

/**
 * 尝试从模型的文本输出中解析 tool calls
 * 支持格式：
 * 1. JSON 格式：{"name": "tool_name", "arguments": {...}}
 * 2. 代码块格式：```json\n{"name": "tool_name", ...}\n```
 */
export function parseToolCallsFromText(text: string): ToolCall[] | undefined {
  const calls: ToolCall[] = [];

  // 尝试从代码块中提取
  const codeBlockPattern = /```(?:json)?\s*\n?([\s\S]*?)\n?```/g;
  let match: RegExpExecArray | null;

  while ((match = codeBlockPattern.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1]!.trim());
      const extracted = extractToolCall(parsed);
      if (extracted) calls.push(extracted);
    } catch {
      // 不是有效 JSON，跳过
    }
  }

  if (calls.length > 0) return calls;

  // 尝试直接解析整个文本为 JSON
  try {
    const parsed = JSON.parse(text.trim());
    const extracted = extractToolCall(parsed);
    if (extracted) return [extracted];
  } catch {
    // 不是 JSON
  }

  return undefined;
}

function extractToolCall(obj: unknown): ToolCall | null {
  if (!obj || typeof obj !== 'object') return null;

  const record = obj as Record<string, unknown>;

  // 格式 1: { name: "tool", arguments: {...} }
  if (typeof record.name === 'string' && record.arguments && typeof record.arguments === 'object') {
    return {
      name: record.name,
      arguments: record.arguments as Record<string, unknown>,
    };
  }

  // 格式 2: { tool: "name", args: {...} }
  if (typeof record.tool === 'string' && record.args && typeof record.args === 'object') {
    return {
      name: record.tool,
      arguments: record.args as Record<string, unknown>,
    };
  }

  // 格式 3: { function: { name: "tool", arguments: {...} } }
  if (record.function && typeof record.function === 'object') {
    const fn = record.function as Record<string, unknown>;
    if (typeof fn.name === 'string' && fn.arguments && typeof fn.arguments === 'object') {
      return {
        name: fn.name,
        arguments: fn.arguments as Record<string, unknown>,
      };
    }
  }

  return null;
}
