import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  assertSafeArchiveEntries,
  checksumForAsset,
  extractAxisCliArchive,
  parseSha256Manifest,
  validateExtractedAxisCliPayload
} from '../apps/desktop/src/electron/axisCliArchive';

const execFileAsync = promisify(execFile);

describe('Desktop Axis CLI archive helpers', () => {
  it('parses SHA256 manifests by asset name', () => {
    const manifest = parseSha256Manifest([
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  axis-cli-0.2.0-macos-arm64.tar.gz',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb *axis-cli-0.2.0-linux-x64.tar.gz'
    ].join('\n'));

    expect(checksumForAsset(manifest, 'axis-cli-0.2.0-macos-arm64.tar.gz')).toBe('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
    expect(checksumForAsset(manifest, 'axis-cli-0.2.0-linux-x64.tar.gz')).toBe('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });

  it('rejects unsafe archive entries before extraction', () => {
    expect(() => assertSafeArchiveEntries(['axis', 'skills/axis-core/SKILL.md'])).not.toThrow();
    expect(() => assertSafeArchiveEntries(['/tmp/axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries(['C:/Users/me/axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries(['C:\\Users\\me\\axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries(['C:axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries(['../axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries(['skills/../../axis'])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries([{ name: 'axis-link', type: 'symlink' }])).toThrow(/unsafe/i);
    expect(() => assertSafeArchiveEntries([{ name: 'axis-hardlink', type: 'hardlink' }])).toThrow(/unsafe/i);
  });

  it('rejects tar archives with symlinks before extraction', async () => {
    const root = await mkdtemp(join(tmpdir(), 'axis-cli-tar-link-'));
    const source = join(root, 'source');
    const destination = join(root, 'destination');
    const archive = join(root, 'axis-cli.tar.gz');
    await mkdir(source, { recursive: true });
    await mkdir(destination, { recursive: true });
    await writeFile(join(source, 'axis'), '', 'utf8');
    await symlink('axis', join(source, 'axis-link'));
    await execFileAsync('tar', ['-czf', archive, '-C', source, '.']);

    await expect(extractAxisCliArchive({ archivePath: archive, destinationDir: destination, platform: 'darwin' })).rejects.toThrow(/unsafe/i);
    await expect(pathExists(join(destination, 'axis-link'))).resolves.toBe(false);
  });

  it('requires expected extracted executable and Skills payload', async () => {
    const root = await mkdtemp(join(tmpdir(), 'axis-cli-archive-'));
    await mkdir(join(root, 'skills', 'axis-core'), { recursive: true });
    await writeFile(join(root, 'axis'), '', 'utf8');
    await writeFile(join(root, 'skills', 'axis-core', 'SKILL.md'), '---\nname: axis-core\n---\n', 'utf8');

    await expect(validateExtractedAxisCliPayload({ root, executableName: 'axis' })).resolves.toBeUndefined();
    await expect(validateExtractedAxisCliPayload({ root, executableName: 'missing-axis' })).rejects.toThrow(/executable/i);
  });
});

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}
