import type { DebruteDaemonHttpServer, DebruteDaemonRuntime } from '@debrute/daemon';
import { openProjectThroughDaemon, projectWebShellUrl, type DebruteDaemonRuntimeLike } from './daemonProjectOpen.js';

type DesktopRuntimeFetch = (url: string, init?: RequestInit) => Promise<Response>;

const releaseWindow = () => undefined;

export interface DesktopRuntimeClient {
  readonly mode: 'hosted' | 'attached';
  runtime(): DebruteDaemonRuntime;
  shellUrl(projectId?: string): string;
  openProject(projectRoot: string): Promise<{ projectId: string; url: string }>;
  registerElectronProjectWindow(projectId: string, windowId: number): () => void;
  close(): Promise<void>;
}

export function createAttachedDesktopRuntimeClient(
  runtime: DebruteDaemonRuntimeLike,
  fetchImpl: DesktopRuntimeFetch = fetch
): DesktopRuntimeClient {
  const daemonRuntime: DebruteDaemonRuntime = {
    daemonUrl: runtime.daemonUrl,
    webBaseUrl: runtime.webBaseUrl,
    platform: runtime.platform ?? process.platform,
    token: runtime.token
  };
  return {
    mode: 'attached',
    runtime: () => daemonRuntime,
    shellUrl: (projectId) => projectWebShellUrl(daemonRuntime, projectId),
    openProject: (projectRoot) => openProjectThroughDaemon(daemonRuntime, projectRoot, fetchImpl),
    registerElectronProjectWindow: () => releaseWindow,
    close: async () => undefined
  };
}

export function createHostedDesktopRuntimeClient(daemon: DebruteDaemonHttpServer): DesktopRuntimeClient {
  const requireRuntime = () => {
    const runtime = daemon.runtime();
    if (!runtime) {
      throw new Error('Debrute daemon runtime is not ready.');
    }
    return runtime;
  };
  return {
    mode: 'hosted',
    runtime: requireRuntime,
    shellUrl: (projectId) => projectWebShellUrl(requireRuntime(), projectId),
    openProject: (projectRoot) => openProjectThroughDaemon(requireRuntime(), projectRoot),
    registerElectronProjectWindow: (projectId, windowId) => daemon.registerElectronProjectWindow(projectId, windowId) ?? releaseWindow,
    close: () => daemon.close()
  };
}
