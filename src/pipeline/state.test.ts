import { describe, it, expect, vi } from 'vitest';
import { createPipelineState, savePipelineState, loadPipelineState, clearPipelineState, type PipelineState } from './state.js';
import type { DocumentStore } from '../documents/store.js';

describe('pipeline state', () => {
  const mockStore = {
    savePipelineState: vi.fn(),
    loadPipelineState: vi.fn(),
    clearPipelineState: vi.fn(),
  } as unknown as DocumentStore;

  it('should create an initial pipeline state', () => {
    const input = 'some input';
    const state = createPipelineState(input);
    expect(state.id).toMatch(/^pipeline-\d+$/);
    expect(state.userInput).toBe(input);
    expect(state.currentStage).toBe('classify');
    expect(state.completedResults).toEqual([]);
    expect(state.currentTaskIndex).toBe(0);
  });

  it('should save pipeline state', async () => {
    const state = createPipelineState('test');
    await savePipelineState(state, mockStore);
    expect(mockStore.savePipelineState).toHaveBeenCalledWith(state);
    expect(state.savedAt).toBeTypeOf('string');
  });

  it('should load pipeline state', async () => {
    const state = createPipelineState('test');
    vi.mocked(mockStore.loadPipelineState).mockResolvedValueOnce(state);
    const loaded = await loadPipelineState(mockStore);
    expect(mockStore.loadPipelineState).toHaveBeenCalled();
    expect(loaded).toBe(state);
  });

  it('should clear pipeline state', async () => {
    await clearPipelineState(mockStore);
    expect(mockStore.clearPipelineState).toHaveBeenCalled();
  });
});
