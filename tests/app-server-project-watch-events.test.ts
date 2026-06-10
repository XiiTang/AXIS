import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NormalizedFileWatchEvent } from '@debrute/project-core';
import { DebruteAppServer } from '../apps/app-server/src/server/DebruteAppServer';
import { shouldIgnoreInternalProjectFileEvent } from '../apps/app-server/src/project-session/projectWatchEvents';

describe('App Server project watch events', () => {
  it('does not suppress unrelated external events during an internal write window', async () => {
    const event: NormalizedFileWatchEvent = {
      type: 'changed',
      absolutePath: '/project/notes.md',
      projectRelativePath: 'notes.md',
      observedAt: 100,
      affects: ['content']
    };

    await expect(shouldIgnoreInternalProjectFileEvent({
      event,
      internalProjectFileWrites: new Map()
    })).resolves.toBe(false);
  });

  it('refreshes Canvas Map file changes without compiling Canvas JSON', async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), 'debrute-watch-canvas-map-'));
    const server = new DebruteAppServer({
      canvasNodeLayoutSizeReader: async (input) => {
        if (input.nodeKind === 'directory') {
          return { width: 240, height: 96 };
        }
        return { width: 100, height: 100 };
      }
    });

    try {
      await mkdir(join(projectRoot, 'outputs'), { recursive: true });
      await writeFile(join(projectRoot, 'outputs/a.png'), 'fake', 'utf8');
      await writeFile(join(projectRoot, 'outputs/b.png'), 'fake', 'utf8');
      await server.openProject(projectRoot, { initializeIfMissing: true, createDefaultCanvas: true, watchFiles: false });
      await writeCanvasMap(projectRoot, 'production-map', [
        '- outputs/a.png',
        ''
      ]);
      await server.publishCanvasMapForProject(projectRoot, { canvasId: 'production-map' });
      const canvasBefore = await readFile(join(projectRoot, '.debrute/canvases/production-map.json'), 'utf8');

      const mapPath = join(projectRoot, '.debrute/canvas-maps/production-map.yaml');
      await writeFile(mapPath, '- outputs/b.png\n', 'utf8');
      await callWatchedFileEvent(server, {
        type: 'changed',
        absolutePath: mapPath,
        projectRelativePath: '.debrute/canvas-maps/production-map.yaml',
        observedAt: Date.now() + 1000,
        affects: ['canvas-map']
      });

      const snapshot = server.getSnapshot();
      expect(snapshot.files.map((file) => file.projectRelativePath)).toContain('.debrute/canvas-maps/production-map.yaml');
      await expect(readFile(join(projectRoot, '.debrute/canvases/production-map.json'), 'utf8')).resolves.toBe(canvasBefore);
      expect(snapshot.canvases[0]?.nodeElements.map((node) => node.projectRelativePath)).toEqual(['outputs', 'outputs/a.png']);
    } finally {
      server.close();
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

async function callWatchedFileEvent(server: DebruteAppServer, event: NormalizedFileWatchEvent): Promise<void> {
  await (server as unknown as {
    handleWatchedFileEvent(event: NormalizedFileWatchEvent): Promise<void>;
  }).handleWatchedFileEvent(event);
}

async function writeCanvasMap(projectRoot: string, canvasId: string, lines: string[]): Promise<void> {
  await mkdir(join(projectRoot, '.debrute/canvas-maps'), { recursive: true });
  await writeFile(join(projectRoot, `.debrute/canvas-maps/${canvasId}.yaml`), lines.join('\n'), 'utf8');
}
