import { mkdir, readFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), '..');

const iconTargets = [
  'apps/web/public/debrute.svg',
  'apps/desktop/build/icon.svg'
];
const desktopPngTarget = 'apps/desktop/build/icon.png';

export async function syncProjectIcons({ root = defaultRoot } = {}) {
  const source = resolve(root, 'assets/project-icon/debrute.svg');
  const svg = await readCanonicalSvg(source);

  await Promise.all(iconTargets.map(async (relativeTarget) => {
    const target = resolve(root, relativeTarget);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(source, target);
  }));
  await writeDesktopPngIcon(svg, resolve(root, desktopPngTarget));

  return {
    source,
    targets: [...iconTargets, desktopPngTarget].map((relativeTarget) => resolve(root, relativeTarget)),
    bytes: Buffer.byteLength(svg)
  };
}

async function writeDesktopPngIcon(svg, target) {
  await mkdir(dirname(target), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(1024, 1024, { fit: 'contain' })
    .png()
    .toFile(target);
}

async function readCanonicalSvg(source) {
  let content;
  try {
    content = await readFile(source, 'utf8');
  } catch (error) {
    if (isMissingPathError(error)) {
      throw new Error(`Missing canonical project icon: ${source}`);
    }
    throw error;
  }

  if (!/<svg[\s>]/.test(content)) {
    throw new Error(`Canonical project icon is not an SVG file: ${source}`);
  }
  return content;
}

function isMissingPathError(error) {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'ENOENT' || error.code === 'ENOTDIR');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await syncProjectIcons();
}
