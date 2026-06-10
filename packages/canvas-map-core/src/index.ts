import { createHash } from 'node:crypto';
import { parseDocument, stringify } from 'yaml';

export type CanvasMapRuleKind = 'exact-file' | 'recursive-directory' | 'file-glob';

export interface CanvasMapRule {
  raw: string;
  pattern: string;
  kind: CanvasMapRuleKind;
}

export interface CanvasMapDocument {
  canvasId: string;
  sourcePath: string;
  rules: CanvasMapRule[];
}

export interface CanvasMapParseInput {
  canvasId: string;
  sourcePath: string;
  content: string;
}

export interface CanvasMapProjectEntry {
  projectRelativePath: string;
  kind: 'file' | 'directory';
}

export type CanvasMapNodeKind = 'directory' | 'file';

export interface CanvasMapNodeProjection {
  projectRelativePath: string;
  nodeKind: CanvasMapNodeKind;
}

export interface ExpandedCanvasMap {
  canvasId: string;
  sourcePath: string;
  nodes: CanvasMapNodeProjection[];
}

export class CanvasMapError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'canvas_map_invalid_yaml'
      | 'canvas_map_invalid_path'
      | 'canvas_map_invalid_canvas_id'
      | 'canvas_map_read_failed'
      | 'canvas_map_write_failed'
      | 'canvas_map_conflict'
      | 'canvas_map_canvas_missing'
      | 'canvas_map_target_missing' = 'canvas_map_invalid_yaml',
    readonly line?: number,
    readonly column?: number
  ) {
    super(message);
    this.name = 'CanvasMapError';
  }
}

export function canvasMapPath(canvasId: string): string {
  assertValidCanvasId(canvasId);
  return `.debrute/canvas-maps/${canvasId}.yaml`;
}

export function canvasMapSourceHash(content: string): string {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

export function assertValidCanvasId(value: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value) || value === '.' || value === '..') {
    throw new CanvasMapError('Canvas Map canvas id must be a valid id.', 'canvas_map_invalid_canvas_id');
  }
}

export function parseCanvasMap(input: CanvasMapParseInput): CanvasMapDocument {
  assertValidCanvasId(input.canvasId);
  const expectedSourcePath = canvasMapPath(input.canvasId);
  if (normalizeStrictProjectPath(input.sourcePath) !== expectedSourcePath) {
    throw new CanvasMapError(`Canvas Map path must be "${expectedSourcePath}".`, 'canvas_map_invalid_path');
  }
  const value = parseYaml(input.content);
  if (!Array.isArray(value)) {
    throw new CanvasMapError('Canvas Map YAML must be a top-level sequence.', 'canvas_map_invalid_yaml');
  }
  return {
    canvasId: input.canvasId,
    sourcePath: expectedSourcePath,
    rules: value.map(normalizeRule)
  };
}

export function expandCanvasMap(map: CanvasMapDocument, entries: CanvasMapProjectEntry[]): ExpandedCanvasMap {
  const entryByPath = new Map(entries.map((entry) => [
    normalizeProjectPath(entry.projectRelativePath),
    entry.kind
  ]));
  const filePaths = entries
    .filter((entry) => entry.kind === 'file')
    .map((entry) => normalizeProjectPath(entry.projectRelativePath))
    .sort(compareProjectPath);
  const matchedFiles = new Set<string>();

  for (const rule of map.rules) {
    const currentKind = entryByPath.get(rule.pattern);
    if (rule.kind === 'exact-file') {
      if (currentKind === 'directory') {
        throw new CanvasMapError(
          `Canvas Map file rule currently resolves to a directory. Use a trailing slash for recursive folders: ${rule.pattern}/`,
          'canvas_map_invalid_path'
        );
      }
      if (currentKind === 'file') {
        matchedFiles.add(rule.pattern);
      }
      continue;
    }
    if (rule.kind === 'recursive-directory') {
      if (currentKind === 'file') {
        throw new CanvasMapError(`Canvas Map folder rule currently resolves to a file: ${rule.pattern}`, 'canvas_map_invalid_path');
      }
      for (const filePath of filePaths) {
        if (filePath.startsWith(`${rule.pattern}/`)) {
          matchedFiles.add(filePath);
        }
      }
      continue;
    }
    const matches = controlledGlobMatcher(rule.pattern);
    for (const filePath of filePaths) {
      if (matches(filePath)) {
        matchedFiles.add(filePath);
      }
    }
  }

  const nodeByPath = new Map<string, CanvasMapNodeProjection>();
  for (const filePath of [...matchedFiles].sort(compareProjectPath)) {
    addAncestors(nodeByPath, filePath);
    nodeByPath.set(filePath, { projectRelativePath: filePath, nodeKind: 'file' });
  }
  const nodes = [...nodeByPath.values()].sort(compareNodesByTreeOrder);
  return {
    canvasId: map.canvasId,
    sourcePath: map.sourcePath,
    nodes
  };
}

export function serializeCanvasMapWithRule(content: string, rule: string): string {
  const parsed = parseYaml(content);
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new CanvasMapError('Canvas Map YAML must be a top-level sequence.', 'canvas_map_invalid_yaml');
  }
  const existing = parsed.map((item) => normalizeRule(item).raw);
  const normalized = normalizeRule(rule).raw;
  const next = existing.includes(normalized) ? existing : [...existing, normalized];
  return ensureTrailingNewline(stringify(next, { sortMapEntries: false }));
}

function normalizeRule(value: unknown): CanvasMapRule {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new CanvasMapError('Canvas Map rule must be a non-empty string.', 'canvas_map_invalid_yaml');
  }
  const raw = value.trim().replaceAll('\\', '/');
  if (raw.startsWith('!')) {
    throw new CanvasMapError('Canvas Map negative rules are not supported.', 'canvas_map_invalid_path');
  }
  const isDirectoryRule = raw.endsWith('/');
  const pattern = normalizeStrictProjectPath(isDirectoryRule ? raw.slice(0, -1) : raw);
  if (isDirectoryRule) {
    return { raw: `${pattern}/`, pattern, kind: 'recursive-directory' };
  }
  return {
    raw: pattern,
    pattern,
    kind: hasGlobSyntax(pattern) ? 'file-glob' : 'exact-file'
  };
}

function parseYaml(content: string): unknown {
  const document = parseDocument(content, { prettyErrors: false });
  if (document.errors[0]) {
    const error = document.errors[0];
    const position = error.linePos?.[0];
    throw new CanvasMapError(
      error.message,
      'canvas_map_invalid_yaml',
      position?.line,
      position?.col
    );
  }
  return document.toJSON();
}

function hasGlobSyntax(value: string): boolean {
  return /[*?\[]/.test(value);
}

function normalizeProjectPath(projectRelativePath: string): string {
  return projectRelativePath.replaceAll('\\', '/');
}

function normalizeStrictProjectPath(projectRelativePath: string): string {
  const normalized = normalizeProjectPath(projectRelativePath);
  const parts = normalized.split('/');
  if (!normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:/.test(normalized)
    || parts.some((part) => part === '' || part === '.' || part === '..')) {
    throw new CanvasMapError('Canvas Map path must be a safe relative project path.', 'canvas_map_invalid_path');
  }
  return normalized;
}

function controlledGlobMatcher(pattern: string): (value: string) => boolean {
  let expression: RegExp;
  try {
    expression = new RegExp(`^${globPatternToRegExpSource(pattern)}$`);
  } catch (error) {
    throw new CanvasMapError(
      `Canvas Map glob pattern is invalid: ${pattern}: ${errorMessage(error)}`,
      'canvas_map_invalid_path'
    );
  }
  return (value) => expression.test(value);
}

function globPatternToRegExpSource(pattern: string): string {
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]!;
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        if (pattern[index + 2] === '/') {
          source += '(?:.*\\/)?';
          index += 2;
        } else {
          source += '.*';
          index += 1;
        }
      } else {
        source += '[^/]*';
      }
      continue;
    }
    if (char === '?') {
      source += '[^/]';
      continue;
    }
    if (char === '[') {
      const endIndex = pattern.indexOf(']', index + 1);
      if (endIndex > index + 1) {
        source += pattern.slice(index, endIndex + 1);
        index = endIndex;
        continue;
      }
    }
    source += escapeRegExp(char);
  }
  return source;
}

function addAncestors(nodeByPath: Map<string, CanvasMapNodeProjection>, projectPath: string): void {
  const parts = projectPath.split('/');
  let current = '';
  for (const part of parts.slice(0, -1)) {
    current = current ? `${current}/${part}` : part;
    nodeByPath.set(current, { projectRelativePath: current, nodeKind: 'directory' });
  }
}

function compareNodesByTreeOrder(left: CanvasMapNodeProjection, right: CanvasMapNodeProjection): number {
  const leftParts = left.projectRelativePath.split('/');
  const rightParts = right.projectRelativePath.split('/');
  const length = Math.min(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    if (leftParts[index] === rightParts[index]) {
      continue;
    }
    const leftKind = index === leftParts.length - 1 ? left.nodeKind : 'directory';
    const rightKind = index === rightParts.length - 1 ? right.nodeKind : 'directory';
    if (leftKind !== rightKind) {
      return leftKind === 'directory' ? -1 : 1;
    }
    return leftParts[index]!.localeCompare(rightParts[index]!, undefined, { numeric: true, sensitivity: 'base' });
  }
  return leftParts.length - rightParts.length;
}

function compareProjectPath(left: string, right: string): number {
  const leftParts = left.split('/');
  const rightParts = right.split('/');
  const length = Math.min(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const comparison = leftParts[index]!.localeCompare(rightParts[index]!, undefined, { numeric: true, sensitivity: 'base' });
    if (comparison !== 0) {
      return comparison;
    }
  }
  return leftParts.length - rightParts.length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');
}

function ensureTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value : `${value}\n`;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
