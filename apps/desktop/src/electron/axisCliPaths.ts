import { join } from 'node:path';

export type AxisCliPublicPlatform = 'macos' | 'linux' | 'windows';

export interface AxisCliTargetInput {
  version: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
}

export function axisCliPlatform(platform: NodeJS.Platform = process.platform): AxisCliPublicPlatform {
  if (platform === 'darwin') return 'macos';
  if (platform === 'linux') return 'linux';
  if (platform === 'win32') return 'windows';
  throw new Error(`Unsupported Axis CLI platform: ${platform}`);
}

export function axisCliArchiveExtension(platform: NodeJS.Platform = process.platform): 'tar.gz' | 'zip' {
  return platform === 'win32' ? 'zip' : 'tar.gz';
}

export function axisCliExecutableName(platform: NodeJS.Platform = process.platform): 'axis' | 'axis.exe' {
  return platform === 'win32' ? 'axis.exe' : 'axis';
}

export function axisCliAssetName(input: AxisCliTargetInput): string {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  return `axis-cli-${input.version}-${axisCliPlatform(platform)}-${arch}.${axisCliArchiveExtension(platform)}`;
}

export function axisCliReleaseUrl(input: { version: string; assetName: string }): string {
  return `https://github.com/XiiTang/AXIS/releases/download/v${input.version}/${input.assetName}`;
}

export function axisCliChecksumUrl(version: string): string {
  return axisCliReleaseUrl({ version, assetName: 'axis_SHA256SUMS' });
}

export function axisCliManagedPaths(input: { userHome: string; version: string; platform?: NodeJS.Platform }) {
  const platform = input.platform ?? process.platform;
  const installDir = join(input.userHome, '.axis', 'cli', input.version);
  const executablePath = join(installDir, axisCliExecutableName(platform));
  const binDir = join(input.userHome, '.axis', 'bin');
  const shimPath = join(binDir, platform === 'win32' ? 'axis.cmd' : 'axis');
  const statePath = join(input.userHome, '.axis', 'skills-state.json');
  return { installDir, executablePath, binDir, shimPath, statePath };
}

export function userPathEntry(input: { userHome: string }): string {
  return join(input.userHome, '.axis', 'bin');
}

export function shellProfilePath(input: { userHome: string; platform?: NodeJS.Platform; shell?: string }): string {
  const platform = input.platform ?? process.platform;
  const shell = input.shell ?? process.env.SHELL ?? '';
  if (platform === 'darwin' && shell.endsWith('zsh')) return join(input.userHome, '.zprofile');
  if (platform === 'darwin' && shell.endsWith('bash')) return join(input.userHome, '.bash_profile');
  if (platform === 'linux' && shell.endsWith('zsh')) return join(input.userHome, '.zshrc');
  if (platform === 'linux' && shell.endsWith('bash')) return join(input.userHome, '.bashrc');
  return join(input.userHome, '.profile');
}
