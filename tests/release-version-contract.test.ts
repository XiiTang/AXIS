import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  releaseVersionContract,
  validateReleaseVersionContract
} from '../scripts/validate-release-version-contract.mjs';

describe('release version contract', () => {
  it('keeps root, Desktop, Axis CLI, and bundled Skills on one product version', async () => {
    const contract = await releaseVersionContract(process.cwd());
    const rootPackage = JSON.parse(await readFile(join(process.cwd(), 'package.json'), 'utf8')) as { version: string };

    expect(contract.version).toBe(rootPackage.version);
    expect(contract.entries.map((entry) => entry.label)).toEqual([
      'root package',
      'Desktop package',
      'Axis CLI package',
      'axis-core Skill',
      'axis-image-director Skill'
    ]);
    expect(contract.entries.every((entry) => entry.version === contract.version)).toBe(true);
  });

  it('rejects mismatched package and Skill versions instead of publishing a mixed release', async () => {
    const root = await mkdtemp(join(tmpdir(), 'axis-release-version-contract-'));
    try {
      await mkdir(join(root, 'apps/desktop'), { recursive: true });
      await mkdir(join(root, 'apps/axis-cli'), { recursive: true });
      await mkdir(join(root, 'skills/axis-core'), { recursive: true });
      await writeFile(join(root, 'package.json'), JSON.stringify({ version: '1.2.3' }), 'utf8');
      await writeFile(join(root, 'apps/desktop/package.json'), JSON.stringify({ version: '1.2.3' }), 'utf8');
      await writeFile(join(root, 'apps/axis-cli/package.json'), JSON.stringify({ version: '1.2.4' }), 'utf8');
      await writeFile(join(root, 'skills/axis-core/SKILL.md'), [
        '---',
        'name: axis-core',
        'metadata:',
        '  axis.version: "1.2.5"',
        '---',
        ''
      ].join('\n'), 'utf8');

      await expect(validateReleaseVersionContract(root)).rejects.toThrow(/release version mismatch/i);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
