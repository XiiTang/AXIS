import React from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';
import { reorderCanvasIds } from './canvasCardBarState';

export interface CanvasCardBarProps {
  canvasOrder: string[];
  activeCanvasId: string | undefined;
  onActiveCanvasChange(canvasId: string): void;
  onCreateCanvas(): Promise<void>;
  onRenameCanvas(input: { canvasId: string; nextCanvasId: string }): Promise<void>;
  onDeleteCanvas(input: { canvasId: string }): Promise<void>;
  onReorderCanvases(input: { canvasOrder: string[] }): Promise<void>;
}

const DRAG_DATA_TYPE = 'application/x-debrute-canvas-id';

export function CanvasCardBar({
  canvasOrder,
  activeCanvasId,
  onActiveCanvasChange,
  onCreateCanvas,
  onRenameCanvas,
  onDeleteCanvas,
  onReorderCanvases
}: CanvasCardBarProps): React.ReactElement {
  return (
    <nav className="canvas-card-bar" aria-label="Canvases">
      <div className="canvas-card-scroll">
        {canvasOrder.map((canvasId) => (
          <div
            key={canvasId}
            className="canvas-card-wrap"
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(DRAG_DATA_TYPE, canvasId);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
            }}
            onDrop={(event) => {
              event.preventDefault();
              const draggedCanvasId = event.dataTransfer.getData(DRAG_DATA_TYPE);
              if (!draggedCanvasId) {
                return;
              }
              const nextOrder = reorderCanvasIds(canvasOrder, draggedCanvasId, canvasId);
              if (nextOrder !== canvasOrder) {
                void onReorderCanvases({ canvasOrder: nextOrder });
              }
            }}
          >
            <button
              type="button"
              className="canvas-card"
              aria-pressed={canvasId === activeCanvasId}
              onClick={() => onActiveCanvasChange(canvasId)}
            >
              {canvasId}
            </button>
            <details className="canvas-card-menu-details">
              <summary aria-label="Canvas actions" className="canvas-card-menu-button" role="button">
                <MoreHorizontal size={14} />
              </summary>
              <div className="canvas-card-menu" role="menu">
                <button type="button" role="menuitem" onClick={() => { void onCreateCanvas(); }}>New Canvas</button>
                <button type="button" role="menuitem" onClick={() => renameCanvas(canvasId, onRenameCanvas)}>Rename</button>
                <button type="button" role="menuitem" onClick={() => deleteCanvas(canvasId, onDeleteCanvas)}>Delete</button>
              </div>
            </details>
          </div>
        ))}
      </div>
      <button type="button" className="canvas-card-add" aria-label="New Canvas" onClick={() => { void onCreateCanvas(); }}>
        <Plus size={14} />
      </button>
    </nav>
  );
}

function renameCanvas(canvasId: string, onRenameCanvas: CanvasCardBarProps['onRenameCanvas']): void {
  const nextCanvasId = globalThis.prompt?.('Rename canvas', canvasId)?.trim();
  if (nextCanvasId && nextCanvasId !== canvasId) {
    void onRenameCanvas({ canvasId, nextCanvasId });
  }
}

function deleteCanvas(canvasId: string, onDeleteCanvas: CanvasCardBarProps['onDeleteCanvas']): void {
  if (globalThis.confirm?.(`Delete canvas "${canvasId}"?`) === true) {
    void onDeleteCanvas({ canvasId });
  }
}
