import { stat } from 'node:fs/promises';
import type { ProjectFileOperationResult, ProjectSessionSnapshot } from '@debrute/app-protocol';
import { resolveExistingProjectPath } from '@debrute/project-core';
import type { DebruteNativeShell } from './nativeShell.js';

export type ProjectNativePathKind = 'file' | 'directory';

export interface ProjectNativePathInput {
  projectRoot: string;
  projectRelativePath: string;
  kind: ProjectNativePathKind;
}

export async function copyProjectAbsolutePath(
  input: ProjectNativePathInput
): Promise<{ absolutePath: string }> {
  return {
    absolutePath: await resolveProjectNativePath(input)
  };
}

export async function revealProjectPathInSystemFileManager(
  input: ProjectNativePathInput & { nativeShell: DebruteNativeShell }
): Promise<{ ok: true }> {
  const absolutePath = await resolveProjectNativePath(input);
  if (input.kind === 'directory') {
    await input.nativeShell.openPath(absolutePath);
  } else {
    await input.nativeShell.showItemInFolder(absolutePath);
  }
  return { ok: true };
}

export async function trashProjectPathWithNativeShell(
  input: ProjectNativePathInput & {
    nativeShell: DebruteNativeShell;
    refreshProject(): Promise<ProjectSessionSnapshot>;
  }
): Promise<ProjectFileOperationResult> {
  const absolutePath = await resolveProjectNativePath(input);
  await input.nativeShell.trashItem(absolutePath);
  return {
    projectRelativePath: input.projectRelativePath,
    kind: input.kind,
    snapshot: await input.refreshProject()
  };
}

export async function resolveProjectNativePath(input: ProjectNativePathInput): Promise<string> {
  const absolutePath = await resolveExistingProjectPath(input.projectRoot, input.projectRelativePath);
  const resolvedStats = await stat(absolutePath);
  if (input.kind === 'file' && !resolvedStats.isFile()) {
    throw new Error('Resolved project path is not a file.');
  }
  if (input.kind === 'directory' && !resolvedStats.isDirectory()) {
    throw new Error('Resolved project path is not a directory.');
  }
  return absolutePath;
}
