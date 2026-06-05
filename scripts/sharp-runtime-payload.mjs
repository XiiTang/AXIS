import { existsSync } from 'node:fs';
import { join } from 'node:path';

export function sharpRuntimePayloadEntries(root, releaseTarget) {
  return sharpRuntimePayloadPackages(releaseTarget).map((packageName) => nodeModulePayloadEntry(root, packageName));
}

function sharpRuntimePayloadPackages(releaseTarget) {
  const nativePackages = {
    'darwin-arm64': ['@img/sharp-darwin-arm64', '@img/sharp-libvips-darwin-arm64'],
    'darwin-x64': ['@img/sharp-darwin-x64', '@img/sharp-libvips-darwin-x64'],
    'linux-arm64': ['@img/sharp-linux-arm64', '@img/sharp-libvips-linux-arm64'],
    'linux-x64': ['@img/sharp-linux-x64', '@img/sharp-libvips-linux-x64'],
    'windows-arm64': ['@img/sharp-win32-arm64'],
    'windows-x64': ['@img/sharp-win32-x64']
  }[releaseTarget.id];
  if (!nativePackages) {
    throw new Error(`No sharp native package mapping for ${releaseTarget.id}.`);
  }
  return ['sharp', '@img/colour', 'detect-libc', 'semver', ...nativePackages];
}

function nodeModulePayloadEntry(root, packageName) {
  return {
    from: resolveNodeModulePackageRoot(root, packageName),
    to: `node_modules/${packageName}`,
    recursive: true,
    dereference: true,
    ...(packageName === 'sharp' ? { excludeNestedNodeModules: true } : {})
  };
}

export function resolveNodeModulePackageRoot(root, packageName) {
  const packageSegments = packageName.split('/');
  const directPath = join(root, 'node_modules', ...packageSegments);
  if (existsSync(directPath)) return directPath;

  const pnpmHoistPath = join(root, 'node_modules', '.pnpm', 'node_modules', ...packageSegments);
  if (existsSync(pnpmHoistPath)) return pnpmHoistPath;

  throw new Error(`Cannot resolve node module package ${packageName} from ${root}.`);
}
