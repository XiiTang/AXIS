import { readdir, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { desktopReleaseAssetName } from './release-asset-contract.mjs';

export function electronBuilderPlatformName(platform) {
  if (platform === 'darwin') return 'macos';
  if (platform === 'win32') return 'windows';
  if (platform === 'linux') return 'linux';
  throw new Error(`Unsupported Desktop release platform: ${platform}`);
}

export function inferDesktopExtension(fileName) {
  if (fileName.endsWith('.dmg')) return 'dmg';
  if (fileName.endsWith('.exe')) return 'exe';
  if (fileName.endsWith('.AppImage')) return 'AppImage';
  return undefined;
}

export async function renameDesktopReleaseAssets({
  releaseDir,
  version,
  platform = process.platform,
  arch = process.arch
}) {
  const publicPlatform = electronBuilderPlatformName(platform);
  const files = await readdir(releaseDir);
  const renamed = [];
  for (const fileName of files) {
    const extension = inferDesktopExtension(fileName);
    if (!extension) continue;
    const source = join(releaseDir, fileName);
    if (!(await stat(source)).isFile()) continue;
    const nextName = desktopReleaseAssetName(version, publicPlatform, arch, extension);
    await rename(source, join(releaseDir, nextName));
    renamed.push(nextName);
  }
  return renamed.sort();
}

export function isDirectCliInvocation(moduleUrl, argvPath) {
  if (!argvPath) return false;
  return normalizeCliPath(fileURLToPath(moduleUrl)) === normalizeCliPath(argvPath);
}

function normalizeCliPath(path) {
  return path.replace(/\\/g, '/').replace(/^\/([A-Za-z]:\/)/, '$1');
}

if (isDirectCliInvocation(import.meta.url, process.argv[1])) {
  const releaseDir = valueAfter('--release-dir') ?? 'release';
  const version = valueAfter('--version');
  const platform = valueAfter('--platform') ?? process.platform;
  const arch = valueAfter('--arch') ?? process.arch;
  if (!version) {
    console.error('--version is required');
    process.exit(1);
  }
  renameDesktopReleaseAssets({ releaseDir, version, platform, arch })
    .then((renamed) => {
      console.log(`Renamed Desktop release assets: ${renamed.join(', ')}`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}
