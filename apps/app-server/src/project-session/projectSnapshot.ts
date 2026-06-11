import {
  getDebruteProjectPaths,
  listDebruteProjectFiles,
  readProjectMetadata
} from '@debrute/project-core';
import type {
  CanvasDocument,
  CanvasProjection,
  Diagnostic
} from '@debrute/canvas-core';
import type { ProjectSessionSnapshot } from '@debrute/app-protocol';
import { createProjectHealthSummary } from './projectHealth.js';

export interface LoadProjectSnapshotInput {
  projectRoot: string;
  loadOrderedCanvases(projectRoot: string): Promise<{
    canvases: CanvasDocument[];
    registry: ProjectSessionSnapshot['canvasRegistry'];
  }>;
  projectCanvasDocument(
    projectRoot: string,
    canvas: CanvasDocument,
    diagnostics?: Diagnostic[]
  ): Promise<CanvasProjection>;
}

export async function loadProjectSnapshot(input: LoadProjectSnapshotInput): Promise<ProjectSessionSnapshot> {
  const paths = getDebruteProjectPaths(input.projectRoot);
  const metadata = await readProjectMetadata(input.projectRoot);
  const files = await listDebruteProjectFiles(input.projectRoot);
  const { canvases, registry } = await input.loadOrderedCanvases(input.projectRoot);
  const projections = registry.status === 'ready'
    ? await Promise.all(canvases.map((canvas) => input.projectCanvasDocument(
        input.projectRoot,
        canvas,
        []
      )))
    : [];
  const diagnostics = uniqueDiagnostics(projections.flatMap((projection) => projection.diagnostics));

  return {
    projectRoot: input.projectRoot,
    metadata,
    files,
    canvases,
    projections,
    diagnostics,
    canvasRegistry: registry,
    health: createProjectHealthSummary({
      metadata,
      canvasCount: canvases.length,
      diagnostics,
      runtimeDataLocation: paths.globalRuntimeDir,
      checkedAt: new Date().toISOString()
    })
  };
}

function uniqueDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  return [...new Map(diagnostics.map((diagnostic) => [diagnostic.id, diagnostic])).values()];
}
