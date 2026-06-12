import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  normalizeProjectDirectoryPath,
  parentProjectPath,
  resolveExistingProjectPath
} from '@debrute/project-core';
import { serviceError } from '../server/ServiceErrors.js';

export interface ResolveTerminalCwdInput {
  projectRoot: string;
  cwdProjectRelativePath?: string;
}

export interface ResolvedTerminalCwd {
  absolutePath: string;
  projectRelativePath: string;
  title: string;
}

export async function resolveTerminalCwd(input: ResolveTerminalCwdInput): Promise<ResolvedTerminalCwd> {
  try {
    const requestedPath = normalizeProjectDirectoryPath(input.cwdProjectRelativePath ?? '');
    const requestedAbsolutePath = await resolveExistingProjectPath(input.projectRoot, requestedPath);
    const requestedStat = await stat(requestedAbsolutePath);
    const projectRelativePath = requestedStat.isDirectory()
      ? requestedPath
      : parentProjectPath(requestedPath);
    const absolutePath = await resolveExistingProjectPath(input.projectRoot, projectRelativePath);
    const directoryStat = await stat(absolutePath);
    if (!directoryStat.isDirectory()) {
      throw serviceError('terminal_invalid_cwd', `Terminal cwd is not a directory: ${projectRelativePath}`);
    }
    return {
      absolutePath,
      projectRelativePath,
      title: basename(absolutePath) || 'Terminal'
    };
  } catch (error) {
    if (isServiceError(error)) {
      throw error;
    }
    throw serviceError('terminal_invalid_cwd', `Terminal cwd is invalid: ${input.cwdProjectRelativePath ?? ''}`, {
      cwdProjectRelativePath: input.cwdProjectRelativePath ?? ''
    });
  }
}

function isServiceError(error: unknown): error is Error & { code: string } {
  return typeof error === 'object' && error !== null && 'code' in error;
}
