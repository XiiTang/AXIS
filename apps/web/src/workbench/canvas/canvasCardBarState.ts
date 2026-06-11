export function activeCanvasStorageKey(projectId: string): string {
  return `debrute:active-canvas:${projectId}`;
}

export function chooseInitialActiveCanvasId(input: {
  projectId: string;
  canvasOrder: string[];
  readStoredActiveCanvasId: (key: string) => string | null | undefined;
}): string | undefined {
  const stored = input.readStoredActiveCanvasId(activeCanvasStorageKey(input.projectId));
  return stored && input.canvasOrder.includes(stored) ? stored : input.canvasOrder[0];
}

export function reorderCanvasIds(canvasOrder: string[], draggedCanvasId: string, targetCanvasId: string): string[] {
  if (draggedCanvasId === targetCanvasId) {
    return canvasOrder;
  }
  const next = canvasOrder.filter((id) => id !== draggedCanvasId);
  const targetIndex = next.indexOf(targetCanvasId);
  if (targetIndex < 0) {
    return canvasOrder;
  }
  next.splice(targetIndex + 1, 0, draggedCanvasId);
  return next;
}
