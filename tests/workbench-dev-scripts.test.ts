import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface PackageJson {
  scripts: Record<string, string>;
}

describe('Workbench development scripts', () => {
  it('routes root pnpm dev through the registry-aware script', () => {
    const rootPackage = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as PackageJson;

    expect(rootPackage.scripts.dev).toBe('tsx scripts/dev-workbench.ts');
  });

  it('does not require fixed Electron development ports', () => {
    const desktopPackage = JSON.parse(readFileSync(join(process.cwd(), 'apps/desktop/package.json'), 'utf8')) as PackageJson;

    expect(desktopPackage.scripts['dev:electron']).toBe('tsx ../../scripts/dev-electron-workbench.ts');
  });

  it('passes Vite dev server arguments directly to the filtered web script', () => {
    const sourceDevScript = readFileSync(join(process.cwd(), 'scripts/dev-workbench.ts'), 'utf8');
    const electronDevScript = readFileSync(join(process.cwd(), 'scripts/dev-electron-workbench.ts'), 'utf8');
    const cliRuntimeLauncher = readFileSync(
      join(process.cwd(), 'apps/debrute-cli/src/workbench/workbenchRuntimeLauncher.ts'),
      'utf8'
    );

    for (const script of [sourceDevScript, electronDevScript, cliRuntimeLauncher]) {
      expect(script).not.toContain("'@debrute/web',\n    'dev',\n    '--',\n    '--host'");
      expect(script).toContain("'@debrute/web',\n    'dev',\n    '--host'");
    }
  });

  it('passes daemon runtime arguments directly to the filtered daemon script', () => {
    const sourceDevScript = readFileSync(join(process.cwd(), 'scripts/dev-workbench.ts'), 'utf8');
    const cliRuntimeLauncher = readFileSync(
      join(process.cwd(), 'apps/debrute-cli/src/workbench/workbenchRuntimeLauncher.ts'),
      'utf8'
    );

    for (const script of [sourceDevScript, cliRuntimeLauncher]) {
      expect(script).not.toContain("'@debrute/daemon',\n    'dev',\n    '--',\n    '--port'");
      expect(script).toContain("'@debrute/daemon',\n    'dev',\n    '--port'");
    }
  });
});
