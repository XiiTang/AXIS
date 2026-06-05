import type { DebruteNativeShell } from '@debrute/daemon';

interface ElectronShellLike {
  showItemInFolder(fullPath: string): void;
  openPath(fullPath: string): Promise<string>;
  trashItem(fullPath: string): Promise<void>;
}

export function createElectronNativeShell(shell: ElectronShellLike): DebruteNativeShell {
  return {
    platform: process.platform,
    showItemInFolder: async (absolutePath) => {
      shell.showItemInFolder(absolutePath);
    },
    openPath: async (absolutePath) => {
      const errorMessage = await shell.openPath(absolutePath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
    },
    trashItem: (absolutePath) => shell.trashItem(absolutePath)
  };
}
