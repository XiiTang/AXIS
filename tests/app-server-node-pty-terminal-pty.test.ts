import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ensureNodePtySpawnHelperExecutable } from '../apps/app-server/src/terminal/NodePtyTerminalPty';

describe('NodePtyTerminalPty', () => {
  const roots: string[] = [];

  afterEach(async () => {
    while (roots.length > 0) {
      await rm(roots.pop()!, { recursive: true, force: true });
    }
  });

  it('makes the Unix node-pty spawn helper executable before spawning', async () => {
    const root = await tempRoot();
    const helperPath = join(root, 'prebuilds/darwin-arm64/spawn-helper');
    await mkdir(join(root, 'prebuilds/darwin-arm64'), { recursive: true });
    await writeFile(helperPath, 'helper', { mode: 0o644 });

    ensureNodePtySpawnHelperExecutable({
      packageRoot: root,
      platform: 'darwin',
      arch: 'arm64'
    });

    expect((await stat(helperPath)).mode & 0o111).toBe(0o111);
  });

  async function tempRoot(): Promise<string> {
    const root = await mkdtemp(join(tmpdir(), 'debrute-node-pty-'));
    roots.push(root);
    return root;
  }
});
