import React from 'react';
import { X } from 'lucide-react';
import { SettingsPanel } from '../settings/SettingsPanel';
import { ProjectTree } from '../project-explorer/ProjectTree';
import type { ProjectTreeInlineEditState } from '../project-explorer/projectTreeEditing';
import type { ProjectTreeFileKeyboardCommand } from '../project-explorer/projectTreeKeyboardCommands';
import {
  FLOATING_PANEL_DEFINITIONS,
  type FloatingPanelId,
  type FloatingPanelState
} from './floatingPanels';
import {
  panelWindowIdentity,
  workbenchWindowZIndex,
  type WorkbenchWindowOrderState
} from './workbenchWindowOrder';
import type {
  WorkbenchContextMenuPosition,
  WorkbenchContextMenuTarget,
  WorkbenchFileClipboard
} from './contextMenu';
import type { WorkbenchActions, WorkbenchState } from '../../types';
import { DiagnosticList, Inspector } from './Inspector';
import type { CanvasEditorRuntime } from '../canvas/runtime/CanvasEditorRuntime';

export function FloatingPanel({
  panelId,
  state,
  orderState,
  children,
  onClose,
  onBringToFront,
  onDrag,
  onResize
}: {
  panelId: FloatingPanelId;
  state: FloatingPanelState;
  orderState: WorkbenchWindowOrderState;
  children: React.ReactElement;
  onClose: () => void;
  onBringToFront: () => void;
  onDrag: (dx: number, dy: number) => void;
  onResize: (width: number, height: number) => void;
}): React.ReactElement {
  const definition = FLOATING_PANEL_DEFINITIONS[panelId];
  const layout = state.panels[panelId];
  const dragStart = React.useRef<{ x: number; y: number } | undefined>(undefined);
  const resizeStart = React.useRef<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const dragHandleProps = floatingPanelDragHandleProps({
    dragStart,
    onBringToFront,
    onDrag
  });
  const resizeHandleProps = floatingPanelResizeHandleProps({
    resizeStart,
    layout,
    onBringToFront,
    onResize
  });
  return (
    <section
      className={`floating-panel floating-panel-${panelId}`}
      data-testid={`floating-panel-${panelId}`}
      style={{
        left: layout.x,
        top: layout.y,
        width: layout.width,
        height: layout.height,
        zIndex: workbenchWindowZIndex(orderState, panelWindowIdentity(panelId))
      }}
      onPointerDown={onBringToFront}
    >
      <header
        className="floating-panel-header"
        {...dragHandleProps}
      >
        <strong>{definition.title}</strong>
        <button
          type="button"
          aria-label={`Close ${definition.title}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={onClose}
        >
          <X size={14} />
        </button>
      </header>
      <div className="floating-panel-body">
        {children}
      </div>
      <div
        className="floating-panel-resize-handle"
        role="presentation"
        {...resizeHandleProps}
      />
    </section>
  );
}

export function FloatingPanelContent({
  panelId,
  state,
  activeCanvasId,
  activeCanvasRuntime,
  actions,
  onOpenContextMenu,
  fileClipboard,
  inlineProjectTreeEdit,
  onEditValueChange,
  onEditSubmit,
  onEditCancel,
  onClearCut,
  onExplorerSelectionChange,
  onLocateFileInCanvas,
  onProjectTreeInternalDrop,
  onProjectTreeExternalDrop,
  onCreateRootFile,
  desktopPlatform,
  onKeyboardFileCommand,
  terminalPanel
}: {
  panelId: FloatingPanelId;
  state: WorkbenchState;
  activeCanvasId: string | undefined;
  activeCanvasRuntime: CanvasEditorRuntime | undefined;
  actions: WorkbenchActions;
  onOpenContextMenu?: ((target: WorkbenchContextMenuTarget, position: WorkbenchContextMenuPosition) => void) | undefined;
  fileClipboard?: WorkbenchFileClipboard | undefined;
  inlineProjectTreeEdit?: ProjectTreeInlineEditState | undefined;
  onEditValueChange?: ((value: string) => void) | undefined;
  onEditSubmit?: (() => void) | undefined;
  onEditCancel?: (() => void) | undefined;
  onClearCut?: (() => void) | undefined;
  onExplorerSelectionChange: (selection: WorkbenchState['explorerSelection']) => void;
  onLocateFileInCanvas?: ((projectRelativePath: string) => void) | undefined;
  onProjectTreeInternalDrop?: ((input: {
    entries: Array<{ projectRelativePath: string; kind: 'file' | 'directory' }>;
    targetDirectoryProjectRelativePath: string;
    operation: 'copy' | 'move';
  }) => void) | undefined;
  onProjectTreeExternalDrop?: ((input: {
    dataTransfer: DataTransfer;
    targetDirectoryProjectRelativePath: string;
  }) => void) | undefined;
  onCreateRootFile?: (() => void) | undefined;
  desktopPlatform?: NodeJS.Platform | undefined;
  onKeyboardFileCommand?: ((command: ProjectTreeFileKeyboardCommand, target: WorkbenchContextMenuTarget) => void) | undefined;
  terminalPanel: React.ReactElement;
}): React.ReactElement {
  if (panelId === 'explorer') {
    return (
      <ProjectTree
        snapshot={state.snapshot}
        selection={state.explorerSelection}
        cutPaths={fileClipboard?.operation === 'cut' ? fileClipboard.entries.map((entry) => entry.projectRelativePath) : []}
        editing={inlineProjectTreeEdit}
        onSelectionChange={onExplorerSelectionChange}
        onLocateFileInCanvas={onLocateFileInCanvas}
        onInternalDrop={onProjectTreeInternalDrop}
        onExternalDrop={onProjectTreeExternalDrop}
        onOpenContextMenu={onOpenContextMenu}
        onCreateRootFile={onCreateRootFile}
        onEditValueChange={onEditValueChange}
        onEditSubmit={onEditSubmit}
        onEditCancel={onEditCancel}
        onClearCut={onClearCut}
        desktopPlatform={desktopPlatform}
        onKeyboardFileCommand={onKeyboardFileCommand}
      />
    );
  }
  if (panelId === 'inspector') {
    return <Inspector state={state} activeCanvasId={activeCanvasId} selection={activeCanvasRuntime?.getSnapshot().selection} actions={actions} />;
  }
  if (panelId === 'problems') {
    return <DiagnosticList diagnostics={state.snapshot?.diagnostics ?? []} onSelect={(diagnostic) => activeCanvasRuntime?.setSelection({ kind: 'diagnostic', id: diagnostic.id })} />;
  }
  if (panelId === 'terminal') {
    return terminalPanel;
  }
  return <SettingsPanel state={state} actions={actions} />;
}

export function floatingPanelDragHandleProps({
  dragStart,
  onBringToFront,
  onDrag
}: {
  dragStart: React.MutableRefObject<{ x: number; y: number } | undefined>;
  onBringToFront: () => void;
  onDrag: (dx: number, dy: number) => void;
}): React.HTMLAttributes<HTMLElement> {
  return {
    onPointerDown: (event) => {
      dragStart.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      onBringToFront();
    },
    onPointerMove: (event) => {
      if (!dragStart.current) {
        return;
      }
      const next = { x: event.clientX, y: event.clientY };
      onDrag(next.x - dragStart.current.x, next.y - dragStart.current.y);
      dragStart.current = next;
    },
    onPointerUp: (event) => {
      dragStart.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
}

export function floatingPanelResizeHandleProps({
  resizeStart,
  layout,
  onBringToFront,
  onResize
}: {
  resizeStart: React.MutableRefObject<{ x: number; y: number; width: number; height: number } | undefined>;
  layout: { width: number; height: number };
  onBringToFront: () => void;
  onResize: (width: number, height: number) => void;
}): React.HTMLAttributes<HTMLElement> {
  return {
    onPointerDown: (event) => {
      event.stopPropagation();
      resizeStart.current = {
        x: event.clientX,
        y: event.clientY,
        width: layout.width,
        height: layout.height
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      onBringToFront();
    },
    onPointerMove: (event) => {
      if (!resizeStart.current) {
        return;
      }
      onResize(
        resizeStart.current.width + event.clientX - resizeStart.current.x,
        resizeStart.current.height + event.clientY - resizeStart.current.y
      );
    },
    onPointerUp: (event) => {
      resizeStart.current = undefined;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
}
