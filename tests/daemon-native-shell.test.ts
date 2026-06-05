import { describe, expect, it, vi } from 'vitest';
import { createNodeNativeShell } from '../apps/daemon/src/http/nativeShell';

describe('daemon native shell adapter', () => {
  it('reveals macOS paths with Finder selection semantics', async () => {
    const execFile = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const shell = createNodeNativeShell({ platform: 'darwin', execFile });

    await shell.showItemInFolder('/tmp/debrute-project/brief.md');

    expect(execFile).toHaveBeenCalledWith('open', ['-R', '/tmp/debrute-project/brief.md']);
  });

  it('opens containing folders on Linux through xdg-open', async () => {
    const execFile = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const shell = createNodeNativeShell({ platform: 'linux', execFile });

    await shell.openPath('/tmp/debrute-project/assets');

    expect(execFile).toHaveBeenCalledWith('xdg-open', ['/tmp/debrute-project/assets']);
  });

  it('moves macOS paths to Trash through Finder without permanent delete fallback', async () => {
    const execFile = vi.fn(async () => ({ stdout: '', stderr: '' }));
    const shell = createNodeNativeShell({ platform: 'darwin', execFile });

    await shell.trashItem('/tmp/debrute-project/brief "draft".md');

    expect(execFile).toHaveBeenCalledWith('osascript', [
      '-e',
      'tell application "Finder" to delete POSIX file "/tmp/debrute-project/brief \\"draft\\".md"'
    ]);
  });

  it('propagates native command failures', async () => {
    const execFile = vi.fn(async () => {
      throw new Error('xdg-open failed');
    });
    const shell = createNodeNativeShell({ platform: 'linux', execFile });

    await expect(shell.openPath('/tmp/debrute-project/assets')).rejects.toThrow('xdg-open failed');
  });
});
