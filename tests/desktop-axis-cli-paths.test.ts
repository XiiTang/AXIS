import { describe, expect, it } from 'vitest';
import {
  axisCliAssetName,
  axisCliManagedPaths,
  axisCliPlatform,
  axisCliReleaseUrl,
  shellProfilePath,
  userPathEntry
} from '../apps/desktop/src/electron/axisCliPaths';

describe('Desktop Axis CLI paths', () => {
  it('maps Node platforms to public release platforms', () => {
    expect(axisCliPlatform('darwin')).toBe('macos');
    expect(axisCliPlatform('win32')).toBe('windows');
    expect(axisCliPlatform('linux')).toBe('linux');
  });

  it('builds trusted GitHub Release asset names and URLs', () => {
    expect(axisCliAssetName({ version: '0.2.0', platform: 'darwin', arch: 'arm64' })).toBe('axis-cli-0.2.0-macos-arm64.tar.gz');
    expect(axisCliAssetName({ version: '0.2.0', platform: 'win32', arch: 'x64' })).toBe('axis-cli-0.2.0-windows-x64.zip');
    expect(axisCliReleaseUrl({ version: '0.2.0', assetName: 'axis-cli-0.2.0-macos-arm64.tar.gz' })).toBe(
      'https://github.com/XiiTang/AXIS/releases/download/v0.2.0/axis-cli-0.2.0-macos-arm64.tar.gz'
    );
  });

  it('uses AXIS-owned user directories', () => {
    expect(axisCliManagedPaths({ userHome: '/Users/me', version: '0.2.0', platform: 'darwin' })).toEqual({
      installDir: '/Users/me/.axis/cli/0.2.0',
      executablePath: '/Users/me/.axis/cli/0.2.0/axis',
      binDir: '/Users/me/.axis/bin',
      shimPath: '/Users/me/.axis/bin/axis',
      statePath: '/Users/me/.axis/skills-state.json'
    });
    expect(axisCliManagedPaths({ userHome: 'C:\\Users\\me', version: '0.2.0', platform: 'win32' }).shimPath).toContain('.axis');
  });

  it('selects user shell profiles and PATH entries', () => {
    expect(shellProfilePath({ userHome: '/Users/me', platform: 'darwin', shell: '/bin/zsh' })).toBe('/Users/me/.zprofile');
    expect(shellProfilePath({ userHome: '/home/me', platform: 'linux', shell: '/bin/bash' })).toBe('/home/me/.bashrc');
    expect(userPathEntry({ userHome: '/Users/me' })).toBe('/Users/me/.axis/bin');
  });
});
