import { execFile as nodeExecFile } from 'node:child_process';
import { dirname } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(nodeExecFile);

export interface DebruteNativeShell {
  platform: NodeJS.Platform;
  showItemInFolder(absolutePath: string): Promise<void>;
  openPath(absolutePath: string): Promise<void>;
  trashItem(absolutePath: string): Promise<void>;
}

export type NativeShellExecFile = (
  file: string,
  args: string[]
) => Promise<{ stdout: string; stderr: string } | unknown>;

export function createNodeNativeShell(input: {
  platform?: NodeJS.Platform;
  execFile?: NativeShellExecFile;
} = {}): DebruteNativeShell {
  const platform = input.platform ?? process.platform;
  const execFile = input.execFile ?? execFileAsync;
  return {
    platform,
    showItemInFolder: (absolutePath) => revealPath(platform, execFile, absolutePath),
    openPath: (absolutePath) => openPath(platform, execFile, absolutePath),
    trashItem: (absolutePath) => trashPath(platform, execFile, absolutePath)
  };
}

async function revealPath(
  platform: NodeJS.Platform,
  execFile: NativeShellExecFile,
  absolutePath: string
): Promise<void> {
  if (platform === 'darwin') {
    await execFile('open', ['-R', absolutePath]);
    return;
  }
  if (platform === 'win32') {
    await execFile('explorer.exe', [`/select,${absolutePath}`]);
    return;
  }
  await execFile('xdg-open', [dirname(absolutePath)]);
}

async function openPath(
  platform: NodeJS.Platform,
  execFile: NativeShellExecFile,
  absolutePath: string
): Promise<void> {
  if (platform === 'darwin') {
    await execFile('open', [absolutePath]);
    return;
  }
  if (platform === 'win32') {
    await execFile('explorer.exe', [absolutePath]);
    return;
  }
  await execFile('xdg-open', [absolutePath]);
}

async function trashPath(
  platform: NodeJS.Platform,
  execFile: NativeShellExecFile,
  absolutePath: string
): Promise<void> {
  if (platform === 'darwin') {
    await execFile('osascript', [
      '-e',
      `tell application "Finder" to delete POSIX file "${appleScriptString(absolutePath)}"`
    ]);
    return;
  }
  if (platform === 'win32') {
    await execFile('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      [
        'Add-Type -AssemblyName Microsoft.VisualBasic',
        '$path = $args[0]',
        'if ([System.IO.Directory]::Exists($path)) {',
        '  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($path, "OnlyErrorDialogs", "SendToRecycleBin")',
        '} else {',
        '  [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($path, "OnlyErrorDialogs", "SendToRecycleBin")',
        '}'
      ].join('; '),
      absolutePath
    ]);
    return;
  }
  await execFile('gio', ['trash', absolutePath]);
}

function appleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
