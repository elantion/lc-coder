/**
 * 流水线状态管理
 * 断点续传：保存执行状态，支持从中断处恢复
 */
import type { Requirement } from '../schemas/requirement.js';
import type { Plan } from '../schemas/plan.js';
import type { DispatchResult } from './dispatcher.js';
import { DocumentStore } from '../documents/store.js';

/** 流水线执行阶段 */
export type PipelineStage = 'classify' | 'pm' | 'pjm' | 'dispatch' | 'summary' | 'done';

/** 流水线状态快照 */
export interface PipelineState {
  /** 状态 ID */
  id: string;
  /** 用户原始输入 */
  userInput: string;
  /** 开始时间 */
  startedAt: string;
  /** 上次保存时间 */
  savedAt: string;
  /** 当前阶段 */
  currentStage: PipelineStage;

  // 各阶段的输出（逐步填充）
  classification?: {
    complexity: string;
    reason: string;
  };
  requirement?: Requirement;
  plan?: Plan;
  completedResults: DispatchResult[];
  currentTaskIndex: number;
}

/**
 * 创建初始状态
 */
export function createPipelineState(userInput: string): PipelineState {
  return {
    id: `pipeline-${Date.now()}`,
    userInput,
    startedAt: new Date().toISOString(),
    savedAt: new Date().toISOString(),
    currentStage: 'classify',
    completedResults: [],
    currentTaskIndex: 0,
  };
}

/**
 * 保存流水线状态
 */
export async function savePipelineState(
  state: PipelineState,
  store: DocumentStore,
): Promise<void> {
  state.savedAt = new Date().toISOString();
  await store.savePipelineState(state);
}

/**
 * 加载流水线状态
 */
export async function loadPipelineState(
  store: DocumentStore,
): Promise<PipelineState | null> {
  return store.loadPipelineState<PipelineState>();
}

/**
 * 清除流水线状态（完成或用户放弃后）
 */
export async function clearPipelineState(
  store: DocumentStore,
): Promise<void> {
  await store.clearPipelineState();
}
