import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  getDebruteProjectPaths,
  writeJsonAtomic
} from '@debrute/project-core';
import {
  assertCanvasDocumentId,
  createCanvasDocument,
  type CanvasDocument
} from '@debrute/canvas-core';
import type { CanvasRegistryErrorCode, CanvasRegistryState } from '@debrute/app-protocol';
import { serviceError } from '../server/ServiceErrors.js';

export interface CanvasRegistryDocument {
  schemaVersion: 1;
  canvasOrder: string[];
}

export interface CanvasRegistryReadResult {
  state: CanvasRegistryState;
  sourceHash?: string;
  document?: CanvasRegistryDocument;
}

export interface CanvasRegistryServiceOptions {
  suppressInternalProjectPathEvent(absolutePath: string, content?: string): void;
  loadCanvases(projectRoot: string): Promise<CanvasDocument[]>;
  writeCanvasJson(canvasPath: string, canvas: CanvasDocument): Promise<void>;
}

const CANVAS_REGISTRY_SCHEMA_VERSION = 1;
const EMPTY_CANVAS_MAP_SOURCE = 'paths: []\n';

export class CanvasRegistryService {
  private readonly registrySourceHashByProjectRoot = new Map<string, string>();
  private readonly canvasMapSourceHashByProjectCanvas = new Map<string, string>();

  constructor(private readonly options: CanvasRegistryServiceOptions) {}

  async ensureDefaultCanvas(projectRoot: string): Promise<void> {
    const paths = getDebruteProjectPaths(projectRoot);
    await mkdir(paths.canvasesDir, { recursive: true });
    await mkdir(paths.canvasMapsDir, { recursive: true });
    const existingCanvases = await this.options.loadCanvases(projectRoot);
    if (existingCanvases.length > 0 || await fileExists(paths.canvasIndexFile)) {
      return;
    }

    const canvas = createCanvasDocument({ id: 'canvas-1' });
    await this.writeCanvasMap(projectRoot, canvas.id, EMPTY_CANVAS_MAP_SOURCE);
    await this.options.writeCanvasJson(join(paths.canvasesDir, `${canvas.id}.json`), canvas);
    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: [canvas.id]
    });
  }

  async readRegistry(projectRoot: string): Promise<CanvasRegistryReadResult> {
    const registry = await this.readRegistryFromDisk(projectRoot);
    if (registry.state.status === 'ready' && registry.sourceHash) {
      this.registrySourceHashByProjectRoot.set(projectRoot, registry.sourceHash);
    }
    return registry;
  }

  async orderedCanvases(projectRoot: string): Promise<{ canvases: CanvasDocument[]; registry: CanvasRegistryState }> {
    const canvases = await this.options.loadCanvases(projectRoot);
    const mapIds = await this.currentCanvasMapIds(projectRoot);
    const registry = await this.readRegistry(projectRoot);
    if (registry.state.status === 'invalid' || !registry.document) {
      return { canvases: [], registry: registry.state };
    }
    const validation = validateRegistryPairs(registry.document.canvasOrder, canvases, mapIds);
    if (validation) {
      return { canvases: [], registry: validation };
    }

    const canvasesById = new Map(canvases.map((canvas) => [canvas.id, canvas]));
    await this.recordCanvasMapHashes(projectRoot, registry.document.canvasOrder);
    return {
      canvases: registry.document.canvasOrder.map((id) => canvasesById.get(id)!),
      registry: registry.state
    };
  }

  async createCanvas(projectRoot: string): Promise<{ canvasId: string }> {
    const { document } = await this.currentRegistryDocumentForWrite(projectRoot);
    const canvasId = nextCanvasId(document.canvasOrder);
    const paths = getDebruteProjectPaths(projectRoot);
    await this.writeCanvasMap(projectRoot, canvasId, EMPTY_CANVAS_MAP_SOURCE);
    await this.options.writeCanvasJson(join(paths.canvasesDir, `${canvasId}.json`), createCanvasDocument({ id: canvasId }));
    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: [...document.canvasOrder, canvasId]
    });
    return { canvasId };
  }

  async renameCanvas(projectRoot: string, input: { canvasId: string; nextCanvasId: string }): Promise<{ canvasId: string }> {
    assertCanvasDocumentId(input.canvasId);
    assertCanvasDocumentId(input.nextCanvasId);
    const { document } = await this.currentRegistryDocumentForWrite(projectRoot);
    if (!document.canvasOrder.includes(input.canvasId)) {
      throw serviceError('canvas_registry_invalid', `Canvas is not in registry: ${input.canvasId}`, { canvas_id: input.canvasId });
    }
    if (document.canvasOrder.includes(input.nextCanvasId)) {
      throw serviceError('canvas_registry_invalid', `Canvas already exists: ${input.nextCanvasId}`, { canvas_id: input.nextCanvasId });
    }

    const sourceMapContent = await this.assertCanvasMapHash(projectRoot, input.canvasId);
    const paths = getDebruteProjectPaths(projectRoot);
    const oldJsonPath = join(paths.canvasesDir, `${input.canvasId}.json`);
    const nextJsonPath = join(paths.canvasesDir, `${input.nextCanvasId}.json`);
    const oldMapPath = join(paths.canvasMapsDir, `${input.canvasId}.yaml`);
    const nextMapPath = join(paths.canvasMapsDir, `${input.nextCanvasId}.yaml`);
    const canvas = (await this.options.loadCanvases(projectRoot)).find((item) => item.id === input.canvasId);
    if (!canvas) {
      throw serviceError('canvas_registry_invalid', `Canvas JSON is missing: ${input.canvasId}`, { canvas_id: input.canvasId });
    }

    this.options.suppressInternalProjectPathEvent(oldMapPath);
    this.options.suppressInternalProjectPathEvent(nextMapPath, sourceMapContent);
    await rename(oldMapPath, nextMapPath);
    await this.options.writeCanvasJson(nextJsonPath, { ...canvas, id: input.nextCanvasId });
    this.options.suppressInternalProjectPathEvent(oldJsonPath);
    await rm(oldJsonPath, { force: true });
    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: document.canvasOrder.map((id) => id === input.canvasId ? input.nextCanvasId : id)
    });
    this.canvasMapSourceHashByProjectCanvas.delete(projectCanvasKey(projectRoot, input.canvasId));
    this.canvasMapSourceHashByProjectCanvas.set(projectCanvasKey(projectRoot, input.nextCanvasId), rawContentHash(sourceMapContent));
    return { canvasId: input.nextCanvasId };
  }

  async deleteCanvas(projectRoot: string, input: { canvasId: string }): Promise<{ activeCanvasId: string }> {
    assertCanvasDocumentId(input.canvasId);
    const { document } = await this.currentRegistryDocumentForWrite(projectRoot);
    if (document.canvasOrder.length <= 1) {
      throw serviceError('canvas_registry_invalid', 'Cannot delete the final canvas.', { canvas_id: input.canvasId });
    }
    const index = document.canvasOrder.indexOf(input.canvasId);
    if (index < 0) {
      throw serviceError('canvas_registry_invalid', `Canvas is not in registry: ${input.canvasId}`, { canvas_id: input.canvasId });
    }

    await this.assertCanvasMapHash(projectRoot, input.canvasId);
    const paths = getDebruteProjectPaths(projectRoot);
    const mapPath = join(paths.canvasMapsDir, `${input.canvasId}.yaml`);
    const jsonPath = join(paths.canvasesDir, `${input.canvasId}.json`);
    this.options.suppressInternalProjectPathEvent(mapPath);
    this.options.suppressInternalProjectPathEvent(jsonPath);
    await rm(mapPath, { force: true });
    await rm(jsonPath, { force: true });
    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: document.canvasOrder.filter((id) => id !== input.canvasId)
    });
    this.canvasMapSourceHashByProjectCanvas.delete(projectCanvasKey(projectRoot, input.canvasId));
    return {
      activeCanvasId: document.canvasOrder[index + 1] ?? document.canvasOrder[index - 1]!
    };
  }

  async reorderCanvases(projectRoot: string, input: { canvasOrder: string[] }): Promise<void> {
    const { document } = await this.currentRegistryDocumentForWrite(projectRoot);
    assertCompletePermutation(input.canvasOrder, document.canvasOrder);
    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: input.canvasOrder
    });
  }

  async repairCanvasIndex(projectRoot: string): Promise<{ activeCanvasId: string }> {
    const canvases = await this.options.loadCanvases(projectRoot);
    const mapIds = await this.currentCanvasMapIds(projectRoot);
    const canvasIds = canvases
      .map((canvas) => canvas.id)
      .filter((id) => mapIds.has(id))
      .sort((left, right) => left.localeCompare(right));
    if (canvasIds.length === 0) {
      throw serviceError('canvas_registry_repair_failed', 'Canvas registry repair found no valid canvas pairs.');
    }

    await this.writeRegistry(projectRoot, {
      schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
      canvasOrder: canvasIds
    });
    await this.recordCanvasMapHashes(projectRoot, canvasIds);
    return { activeCanvasId: canvasIds[0]! };
  }

  private async currentRegistryDocumentForWrite(projectRoot: string): Promise<{ document: CanvasRegistryDocument }> {
    const registry = await this.readRegistryFromDisk(projectRoot);
    if (registry.state.status === 'invalid') {
      throw serviceError(registry.state.code, registry.state.message);
    }
    if (!registry.document) {
      throw serviceError('canvas_registry_invalid', 'Canvas registry document is missing.');
    }
    const expected = this.registrySourceHashByProjectRoot.get(projectRoot);
    if (!expected || registry.sourceHash !== expected) {
      throw serviceError('canvas_registry_conflict', 'Canvas registry changed on disk. Refresh or repair before retrying.');
    }

    const validation = validateRegistryPairs(
      registry.document.canvasOrder,
      await this.options.loadCanvases(projectRoot),
      await this.currentCanvasMapIds(projectRoot)
    );
    if (validation) {
      throw serviceError(validation.code, validation.message);
    }
    return { document: registry.document };
  }

  private async readRegistryFromDisk(projectRoot: string): Promise<CanvasRegistryReadResult> {
    const path = getDebruteProjectPaths(projectRoot).canvasIndexFile;
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      if (isMissingPathError(error)) {
        return invalidRegistry('canvas_registry_missing', 'Canvas registry is missing.');
      }
      throw error;
    }

    try {
      const document = normalizeCanvasRegistryDocument(JSON.parse(content));
      const sourceHash = rawContentHash(content);
      return {
        state: { status: 'ready', canvasOrder: document.canvasOrder },
        sourceHash,
        document
      };
    } catch (error) {
      return invalidRegistry('canvas_registry_invalid', errorMessage(error));
    }
  }

  private async writeRegistry(projectRoot: string, document: CanvasRegistryDocument): Promise<void> {
    const path = getDebruteProjectPaths(projectRoot).canvasIndexFile;
    const serialized = `${JSON.stringify(document, null, 2)}\n`;
    this.options.suppressInternalProjectPathEvent(path, serialized);
    await writeJsonAtomic(path, document);
    this.registrySourceHashByProjectRoot.set(projectRoot, rawContentHash(serialized));
  }

  private async writeCanvasMap(projectRoot: string, canvasId: string, content: string): Promise<void> {
    const path = join(getDebruteProjectPaths(projectRoot).canvasMapsDir, `${canvasId}.yaml`);
    this.options.suppressInternalProjectPathEvent(path, content);
    await writeFile(path, content, 'utf8');
    this.canvasMapSourceHashByProjectCanvas.set(projectCanvasKey(projectRoot, canvasId), rawContentHash(content));
  }

  private async currentCanvasMapIds(projectRoot: string): Promise<Set<string>> {
    const dir = getDebruteProjectPaths(projectRoot).canvasMapsDir;
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch (error) {
      if (isMissingPathError(error)) {
        entries = [];
      } else {
        throw error;
      }
    }
    return new Set(entries
      .filter((name) => name.endsWith('.yaml'))
      .map((name) => name.slice(0, -'.yaml'.length)));
  }

  private async recordCanvasMapHashes(projectRoot: string, canvasIds: string[]): Promise<void> {
    for (const canvasId of canvasIds) {
      const content = await readFile(join(getDebruteProjectPaths(projectRoot).canvasMapsDir, `${canvasId}.yaml`), 'utf8');
      this.canvasMapSourceHashByProjectCanvas.set(projectCanvasKey(projectRoot, canvasId), rawContentHash(content));
    }
  }

  private async assertCanvasMapHash(projectRoot: string, canvasId: string): Promise<string> {
    const path = join(getDebruteProjectPaths(projectRoot).canvasMapsDir, `${canvasId}.yaml`);
    const content = await readFile(path, 'utf8');
    const current = rawContentHash(content);
    const expected = this.canvasMapSourceHashByProjectCanvas.get(projectCanvasKey(projectRoot, canvasId));
    if (expected !== current) {
      throw serviceError('canvas_map_conflict', 'Canvas Map changed on disk. Publish or refresh before retrying.', {
        canvas_id: canvasId,
        file_path: `.debrute/canvas-maps/${canvasId}.yaml`
      });
    }
    return content;
  }
}

function normalizeCanvasRegistryDocument(value: unknown): CanvasRegistryDocument {
  if (!isRecord(value)
    || value.schemaVersion !== CANVAS_REGISTRY_SCHEMA_VERSION
    || !Array.isArray(value.canvasOrder)) {
    throw new Error('Invalid Canvas registry document.');
  }
  const ids = value.canvasOrder.map((item) => {
    if (typeof item !== 'string') {
      throw new Error('Canvas registry ids must be strings.');
    }
    return assertCanvasDocumentId(item);
  });
  if (new Set(ids).size !== ids.length) {
    throw new Error('Canvas registry contains duplicate canvas ids.');
  }
  return {
    schemaVersion: CANVAS_REGISTRY_SCHEMA_VERSION,
    canvasOrder: ids
  };
}

function validateRegistryPairs(
  canvasOrder: string[],
  canvases: CanvasDocument[],
  mapIds: Set<string>
): Extract<CanvasRegistryState, { status: 'invalid' }> | undefined {
  const canvasIds = new Set(canvases.map((canvas) => canvas.id));
  const orderedIds = new Set(canvasOrder);
  for (const id of canvasOrder) {
    if (!canvasIds.has(id) || !mapIds.has(id)) {
      return { status: 'invalid', code: 'canvas_registry_invalid', message: `Canvas registry references missing canvas: ${id}` };
    }
  }
  for (const id of canvasIds) {
    if (!orderedIds.has(id)) {
      return { status: 'invalid', code: 'canvas_registry_invalid', message: `Canvas registry is missing canvas: ${id}` };
    }
  }
  for (const id of mapIds) {
    if (!orderedIds.has(id)) {
      return { status: 'invalid', code: 'canvas_registry_invalid', message: `Canvas registry is missing Canvas Map: ${id}` };
    }
  }
  return undefined;
}

function nextCanvasId(canvasIds: string[]): string {
  const max = canvasIds.reduce((current, id) => {
    const match = /^canvas-(\d+)$/.exec(id);
    return match ? Math.max(current, Number(match[1])) : current;
  }, 0);
  return `canvas-${max + 1}`;
}

function assertCompletePermutation(input: string[], existing: string[]): void {
  if (input.length !== existing.length) {
    throw serviceError('canvas_registry_invalid', 'Canvas order must include every canvas exactly once.');
  }
  const expected = new Set(existing);
  const seen = new Set<string>();
  for (const id of input) {
    assertCanvasDocumentId(id);
    if (!expected.has(id) || seen.has(id)) {
      throw serviceError('canvas_registry_invalid', 'Canvas order must be a complete canvas id permutation.');
    }
    seen.add(id);
  }
}

function invalidRegistry(code: CanvasRegistryErrorCode, message: string): CanvasRegistryReadResult {
  return { state: { status: 'invalid', code, message } };
}

function rawContentHash(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function projectCanvasKey(projectRoot: string, canvasId: string): string {
  return `${projectRoot}\u0000${canvasId}`;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
