import { describe, expect, it } from 'vitest';
import {
  activeCanvasStorageKey,
  chooseInitialActiveCanvasId,
  reorderCanvasIds
} from './canvasCardBarState';

describe('canvasCardBarState', () => {
  it('uses stored active canvas when it still exists', () => {
    expect(chooseInitialActiveCanvasId({
      projectId: 'project-1',
      canvasOrder: ['canvas-1', 'canvas-2'],
      readStoredActiveCanvasId: () => 'canvas-2'
    })).toBe('canvas-2');
  });

  it('falls back to the first registry canvas when stored active canvas is missing', () => {
    expect(chooseInitialActiveCanvasId({
      projectId: 'project-1',
      canvasOrder: ['canvas-1', 'canvas-2'],
      readStoredActiveCanvasId: () => 'missing'
    })).toBe('canvas-1');
  });

  it('reorders ids by drag source and drop target', () => {
    expect(reorderCanvasIds(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a']);
  });

  it('uses a project-scoped local storage key', () => {
    expect(activeCanvasStorageKey('project-1')).toBe('debrute:active-canvas:project-1');
  });
});
