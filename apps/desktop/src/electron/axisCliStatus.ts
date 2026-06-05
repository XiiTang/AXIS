import { execFile } from 'node:child_process';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { delimiter, dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type {
  AxisCliManualCommand,
  AxisCliSkillsStatus,
  AxisCliStatus,
  AxisSkillsState
} from '@axis/app-protocol';
import {
  axisCliAssetName,
  axisCliChecksumUrl,
  axisCliManagedPaths,
  axisCliPlatform,
  axisCliReleaseUrl,
  shellProfilePath,
  userPathEntry
} from './axisCliPaths.js';
import { runAxisCli, type AxisCliRunResult } from './axisCliProcess.js';

const execFileAsync = promisify(execFile);

export interface AxisCliStatusInput {
  desktopVersion: string;
  userHome: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
  envPath?: string;
  shell?: string;
  runAxis?: (axisPath: string, args: string[]) => Promise<AxisCliRunResult>;
}

export async function getAxisCliStatus(input: AxisCliStatusInput): Promise<AxisCliStatus> {
  const platform = input.platform ?? process.platform;
  const runAxis = input.runAxis ?? runAxisCli;
  const paths = axisCliManagedPaths({ userHome: input.userHome, version: input.desktopVersion, platform });
  const manualCommand = manualInstallCommand({
    version: input.desktopVersion,
    platform,
    ...(input.arch ? { arch: input.arch } : {})
  }).command;

  if (!await fileExists(paths.shimPath)) {
    return { kind: 'not_installed', desktopVersion: input.desktopVersion, manualCommand };
  }

  const versionResult = await runAxis(paths.shimPath, ['--version']);
  const cliVersion = parseAxisVersion(versionResult.stdout);
  if (!cliVersion) {
    return {
      kind: 'error',
      desktopVersion: input.desktopVersion,
      code: 'version_probe_failed',
      message: versionResult.stderr || 'Axis CLI version probe failed.',
      manualCommand
    };
  }

  const skills = await readAxisCliSkillsStatus({ userHome: input.userHome, cliVersion });
  const resolvedPath = await resolveAxisCommandPath(input.envPath ?? process.env.PATH ?? '', platform);
  const onPath = pathsEqual(resolvedPath, paths.shimPath, platform);
  const comparison = compareSemver(cliVersion, input.desktopVersion);
  if (!onPath) {
    return {
      kind: 'installed_but_not_on_path',
      desktopVersion: input.desktopVersion,
      cliVersion,
      managedPath: paths.shimPath,
      repairCommand: pathRepairCommand(input),
      skills
    };
  }
  if (comparison < 0) {
    return { kind: 'update_available', desktopVersion: input.desktopVersion, cliVersion, managedPath: paths.shimPath, skills };
  }
  if (comparison > 0) {
    return { kind: 'external_newer', desktopVersion: input.desktopVersion, cliVersion, managedPath: paths.shimPath, skills };
  }
  return {
    kind: 'installed',
    desktopVersion: input.desktopVersion,
    cliVersion,
    managedPath: paths.shimPath,
    resolvedPath,
    onPath,
    skills
  };
}

export function manualInstallCommand(input: {
  version: string;
  platform?: NodeJS.Platform;
  arch?: NodeJS.Architecture;
}): AxisCliManualCommand {
  const platform = input.platform ?? process.platform;
  const arch = input.arch ?? process.arch;
  const assetName = axisCliAssetName({ version: input.version, platform, arch });
  const archiveUrl = axisCliReleaseUrl({ version: input.version, assetName });
  const checksumUrl = axisCliChecksumUrl(input.version);
  if (platform === 'win32') {
    return {
      platform: 'windows',
      command: [
        `$Version = "${input.version}"`,
        `$AxisHome = "$env:USERPROFILE\\.axis"`,
        `$Asset = "${assetName}"`,
        `Invoke-WebRequest -Uri "${archiveUrl}" -OutFile "$env:TEMP\\$Asset"`,
        `Invoke-WebRequest -Uri "${checksumUrl}" -OutFile "$env:TEMP\\axis_SHA256SUMS"`,
        `$Expected = (Select-String -Path "$env:TEMP\\axis_SHA256SUMS" -Pattern $Asset).Line.Split()[0]`,
        `$Actual = (Get-FileHash "$env:TEMP\\$Asset" -Algorithm SHA256).Hash.ToLower()`,
        `if ($Actual -ne $Expected) { throw "Checksum mismatch for $Asset" }`,
        `Expand-Archive -Force "$env:TEMP\\$Asset" "$AxisHome\\cli\\$Version"`,
        `New-Item -ItemType Directory -Force "$AxisHome\\bin" | Out-Null`,
        'Set-Content "$AxisHome\\bin\\axis.cmd" ("@echo off" + [Environment]::NewLine + "`"$AxisHome\\cli\\$Version\\axis.exe`" %*")',
        `& "$AxisHome\\bin\\axis.cmd" --version`,
        `& "$AxisHome\\bin\\axis.cmd" skills sync`
      ].join('\n')
    };
  }
  return {
    platform: axisCliPlatform(platform),
    command: [
      `AXIS_VERSION="${input.version}"`,
      `AXIS_ASSET="${assetName}"`,
      `cd "/tmp"`,
      `curl -L "${archiveUrl}" -o "$AXIS_ASSET"`,
      `curl -L "${checksumUrl}" -o "axis_SHA256SUMS"`,
      platform === 'linux'
        ? `sha256sum -c --ignore-missing "axis_SHA256SUMS"`
        : `grep "  $AXIS_ASSET$" "axis_SHA256SUMS" | shasum -a 256 -c -`,
      `mkdir -p "$HOME/.axis/cli/$AXIS_VERSION" "$HOME/.axis/bin"`,
      `tar -xzf "$AXIS_ASSET" -C "$HOME/.axis/cli/$AXIS_VERSION"`,
      `ln -sf "$HOME/.axis/cli/$AXIS_VERSION/axis" "$HOME/.axis/bin/axis"`,
      `$HOME/.axis/bin/axis --version`,
      `$HOME/.axis/bin/axis skills sync`
    ].join('\n')
  };
}

export async function repairAxisCliPath(input: { userHome: string; platform?: NodeJS.Platform; shell?: string }): Promise<void> {
  const platform = input.platform ?? process.platform;
  if (platform === 'win32') {
    const binDir = userPathEntry({ userHome: input.userHome });
    const script = [
      `$bin = '${binDir.replace(/'/g, "''")}'`,
      `$current = [Environment]::GetEnvironmentVariable('Path', 'User')`,
      `if (-not $current) { [Environment]::SetEnvironmentVariable('Path', $bin, 'User') }`,
      `elseif (($current -split ';') -notcontains $bin) { [Environment]::SetEnvironmentVariable('Path', "$bin;$current", 'User') }`
    ].join('; ');
    await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script]);
    return;
  }

  const profile = shellProfilePath({
    userHome: input.userHome,
    platform,
    ...(input.shell ? { shell: input.shell } : {})
  });
  await mkdir(dirname(profile), { recursive: true });
  const current = await readShellProfile(profile);
  const block = '# >>> AXIS CLI installer >>>\nexport PATH="$HOME/.axis/bin:$PATH"\n# <<< AXIS CLI installer <<<';
  const next = current.includes('# >>> AXIS CLI installer >>>')
    ? current.replace(/# >>> AXIS CLI installer >>>[\s\S]*?# <<< AXIS CLI installer <<</, block)
    : `${current}${current.endsWith('\n') || current.length === 0 ? '' : '\n'}${block}\n`;
  await writeFile(profile, next, 'utf8');
}

export async function readAxisCliSkillsStatus(input: { userHome: string; cliVersion: string }): Promise<AxisCliSkillsStatus> {
  const statePath = join(input.userHome, '.axis', 'skills-state.json');
  const state = await readSkillsState(statePath);
  if (state === 'missing') {
    return { kind: 'out_of_sync', cliVersion: input.cliVersion, stateAxisVersion: null };
  }
  if (state === 'unreadable') {
    return {
      kind: 'error',
      code: 'skills_state_unreadable',
      message: 'AXIS Skills state cannot be read.'
    };
  }
  if (state.skippedDeletedSkills.length > 0) {
    return { kind: 'partially_removed', skippedDeletedSkills: state.skippedDeletedSkills };
  }
  if (state.axisVersion !== input.cliVersion) {
    return { kind: 'out_of_sync', cliVersion: input.cliVersion, stateAxisVersion: state.axisVersion };
  }
  return { kind: 'in_sync', axisVersion: state.axisVersion };
}

export function pathRepairCommand(input: { userHome: string; platform?: NodeJS.Platform }): string {
  const platform = input.platform ?? process.platform;
  const binDir = userPathEntry({ userHome: input.userHome });
  return platform === 'win32'
    ? `[Environment]::SetEnvironmentVariable('Path', '${binDir};' + [Environment]::GetEnvironmentVariable('Path', 'User'), 'User')`
    : 'export PATH="$HOME/.axis/bin:$PATH"';
}

async function resolveAxisCommandPath(envPath: string, platform: NodeJS.Platform): Promise<string | null> {
  const pathDelimiter = platform === 'win32' ? ';' : delimiter;
  const names = platform === 'win32' ? ['axis.cmd', 'axis.exe', 'axis.bat'] : ['axis'];
  for (const entry of envPath.split(pathDelimiter).filter(Boolean)) {
    for (const name of names) {
      const candidate = join(entry, name);
      if (await fileExists(candidate)) {
        return candidate;
      }
    }
  }
  return null;
}

function pathsEqual(left: string | null, right: string, platform: NodeJS.Platform): boolean {
  if (!left) return false;
  return platform === 'win32'
    ? left.toLowerCase() === right.toLowerCase()
    : left === right;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (isMissingPathError(error)) {
      return false;
    }
    throw error;
  }
}

async function readShellProfile(path: string): Promise<string> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      return '';
    }
    throw error;
  }
}

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readSkillsState(path: string): Promise<AxisSkillsState | 'missing' | 'unreadable'> {
  try {
    const parsed = await readJson<unknown>(path);
    return isAxisSkillsState(parsed) ? parsed : 'unreadable';
  } catch (error) {
    if (isMissingPathError(error)) {
      return 'missing';
    }
    return 'unreadable';
  }
}

function isMissingPathError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

function isAxisSkillsState(value: unknown): value is AxisSkillsState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Partial<AxisSkillsState>;
  return record.schemaVersion === 1
    && typeof record.axisVersion === 'string'
    && stringArray(record.bundledSkills)
    && stringArray(record.updatedSkills)
    && stringArray(record.addedBundledSkills)
    && stringArray(record.skippedDeletedSkills)
    && Array.isArray(record.diagnostics)
    && record.diagnostics.every(isAxisSkillsDiagnostic)
    && typeof record.updatedAt === 'string';
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isAxisSkillsDiagnostic(value: unknown): boolean {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return typeof record.code === 'string'
    && (record.severity === 'info' || record.severity === 'warning' || record.severity === 'error')
    && typeof record.message === 'string'
    && (record.path === undefined || typeof record.path === 'string');
}

function parseAxisVersion(stdout: string): string | undefined {
  return /(\d+\.\d+\.\d+)/.exec(stdout)?.[1];
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}
