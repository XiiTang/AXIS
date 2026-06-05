import { cp, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sharpRuntimePayloadEntries } from '../../../scripts/sharp-runtime-payload.mjs';

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const electronBuilderArchX64 = 1;
const electronBuilderArchArm64 = 3;

export default async function afterPack(context) {
  await copyDesktopSharpRuntime(context);
}

async function copyDesktopSharpRuntime(context) {
  const productFilename = context.packager.appInfo.productFilename;
  const resourcesDir = desktopResourcesDir(context, productFilename);

  for (const entry of sharpRuntimePayloadEntries(workspaceRoot, desktopSharpReleaseTarget(context))) {
    const destination = join(resourcesDir, entry.to);
    await mkdir(dirname(destination), { recursive: true });
    await cp(entry.from, destination, {
      recursive: entry.recursive,
      dereference: entry.dereference,
      filter: entry.excludeNestedNodeModules
        ? (source) => source === entry.from || !source.startsWith(join(entry.from, 'node_modules'))
        : undefined
    });
  }
}

function desktopResourcesDir(context, productFilename) {
  if (context.electronPlatformName === 'darwin') {
    return join(context.appOutDir, `${productFilename}.app`, 'Contents', 'Resources');
  }
  if (context.electronPlatformName === 'linux' || context.electronPlatformName === 'win32') {
    return join(context.appOutDir, 'resources');
  }
  throw new Error(`No Desktop resources directory mapping for ${context.electronPlatformName}.`);
}

function desktopSharpReleaseTarget(context) {
  const platform = context.electronPlatformName === 'win32' ? 'windows' : context.electronPlatformName;
  return { id: `${platform}-${desktopArchName(context.arch)}` };
}

function desktopArchName(arch) {
  if (arch === electronBuilderArchX64) return 'x64';
  if (arch === electronBuilderArchArm64) return 'arm64';
  throw new Error(`No sharp runtime arch mapping for Electron Builder arch ${arch}.`);
}
