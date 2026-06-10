import { describe, expect, it } from 'vitest';
import {
  CanvasMapError,
  canvasMapPath,
  expandCanvasMap,
  parseCanvasMap,
  serializeCanvasMapWithRule,
  type CanvasMapProjectEntry
} from '@debrute/canvas-map-core';

describe('canvas-map core', () => {
  it('parses top-level sequence path rules', () => {
    const map = parseCanvasMap({
      canvasId: 'production-map',
      sourcePath: '.debrute/canvas-maps/production-map.yaml',
      content: [
        '- prompts/cover.md',
        '- outputs/gpt/',
        '- outputs/**/*.png',
        ''
      ].join('\n')
    });

    expect(map).toEqual({
      canvasId: 'production-map',
      sourcePath: '.debrute/canvas-maps/production-map.yaml',
      rules: [
        { raw: 'prompts/cover.md', pattern: 'prompts/cover.md', kind: 'exact-file' },
        { raw: 'outputs/gpt/', pattern: 'outputs/gpt', kind: 'recursive-directory' },
        { raw: 'outputs/**/*.png', pattern: 'outputs/**/*.png', kind: 'file-glob' }
      ]
    });
    expect(canvasMapPath('production-map')).toBe('.debrute/canvas-maps/production-map.yaml');
  });

  it('rejects non-sequence YAML, non-string items, unsafe paths, and negative rules', () => {
    expect(() => parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: 'items:\n  - a.md\n'
    })).toThrow('Canvas Map YAML must be a top-level sequence.');

    expect(() => parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- 1\n'
    })).toThrow('Canvas Map rule must be a non-empty string.');

    expect(() => parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- ../outside.md\n'
    })).toThrow('Canvas Map path must be a safe relative project path.');

    expect(() => parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- "!outputs/tmp/"\n'
    })).toThrow('Canvas Map negative rules are not supported.');
  });

  it('expands exact files, recursive folders, file-only globs, and ancestor folders', () => {
    const map = parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: [
        '- prompts/cover.md',
        '- outputs/gpt/',
        '- outputs/**/*.png',
        '- missing/future.md',
        ''
      ].join('\n')
    });
    const entries: CanvasMapProjectEntry[] = [
      { projectRelativePath: 'prompts', kind: 'directory' },
      { projectRelativePath: 'prompts/cover.md', kind: 'file' },
      { projectRelativePath: 'outputs', kind: 'directory' },
      { projectRelativePath: 'outputs/gpt', kind: 'directory' },
      { projectRelativePath: 'outputs/gpt/a.png', kind: 'file' },
      { projectRelativePath: 'outputs/gpt/nested', kind: 'directory' },
      { projectRelativePath: 'outputs/gpt/nested/b.txt', kind: 'file' },
      { projectRelativePath: 'outputs/manual', kind: 'directory' },
      { projectRelativePath: 'outputs/manual/c.png', kind: 'file' },
      { projectRelativePath: 'outputs/manual/folder.png', kind: 'directory' }
    ];

    expect(expandCanvasMap(map, entries)).toEqual({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      nodes: [
        { projectRelativePath: 'outputs', nodeKind: 'directory' },
        { projectRelativePath: 'outputs/gpt', nodeKind: 'directory' },
        { projectRelativePath: 'outputs/gpt/nested', nodeKind: 'directory' },
        { projectRelativePath: 'outputs/gpt/nested/b.txt', nodeKind: 'file' },
        { projectRelativePath: 'outputs/gpt/a.png', nodeKind: 'file' },
        { projectRelativePath: 'outputs/manual', nodeKind: 'directory' },
        { projectRelativePath: 'outputs/manual/c.png', nodeKind: 'file' },
        { projectRelativePath: 'prompts', nodeKind: 'directory' },
        { projectRelativePath: 'prompts/cover.md', nodeKind: 'file' }
      ]
    });
  });

  it('accepts missing future paths and rejects rules that contradict existing file kinds', () => {
    expect(() => expandCanvasMap(parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- outputs\n'
    }), [
      { projectRelativePath: 'outputs', kind: 'directory' }
    ])).toThrow('Canvas Map file rule currently resolves to a directory. Use a trailing slash for recursive folders: outputs/');

    expect(() => expandCanvasMap(parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- prompts/cover.md/\n'
    }), [
      { projectRelativePath: 'prompts/cover.md', kind: 'file' }
    ])).toThrow('Canvas Map folder rule currently resolves to a file: prompts/cover.md');

    expect(expandCanvasMap(parseCanvasMap({
      canvasId: 'main',
      sourcePath: '.debrute/canvas-maps/main.yaml',
      content: '- future/path.md\n- future/folder/\n- future/**/*.png\n'
    }), [])).toMatchObject({
      nodes: []
    });
  });

  it('reports invalid glob syntax as a Canvas Map validation error', () => {
    try {
      expandCanvasMap(parseCanvasMap({
        canvasId: 'main',
        sourcePath: '.debrute/canvas-maps/main.yaml',
        content: '- outputs/[z-a].png\n'
      }), [
        { projectRelativePath: 'outputs/a.png', kind: 'file' }
      ]);
      throw new Error('Expected glob validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CanvasMapError);
      expect((error as CanvasMapError).code).toBe('canvas_map_invalid_path');
      expect(error).toMatchObject({ code: 'canvas_map_invalid_path' });
    }
  });

  it('serializes drag-added rules without duplicates', () => {
    expect(serializeCanvasMapWithRule('- prompts/cover.md\n', 'outputs/gpt/')).toBe('- prompts/cover.md\n- outputs/gpt/\n');
    expect(serializeCanvasMapWithRule('- prompts/cover.md\n', 'prompts/cover.md')).toBe('- prompts/cover.md\n');
  });

  it('surfaces YAML parse positions on CanvasMapError', () => {
    try {
      parseCanvasMap({
        canvasId: 'main',
        sourcePath: '.debrute/canvas-maps/main.yaml',
        content: '- [broken\n'
      });
      throw new Error('Expected parse to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(CanvasMapError);
      expect((error as CanvasMapError).code).toBe('canvas_map_invalid_yaml');
      expect(error).toMatchObject({ code: 'canvas_map_invalid_yaml' });
    }
  });
});
