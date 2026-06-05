import type { AxisCliInstaller } from './axisCliInstaller.js';

interface AxisCliIpcMain {
  handle(channel: string, listener: (event: unknown, input?: unknown) => unknown): void;
}

export function registerAxisCliShellIpc(input: { ipcMain: AxisCliIpcMain; installer: AxisCliInstaller }): void {
  input.ipcMain.handle('axis-shell:getAxisCliStatus', () => input.installer.getStatus());
  input.ipcMain.handle('axis-shell:installAxisCli', () => input.installer.install());
  input.ipcMain.handle('axis-shell:updateAxisCli', () => input.installer.update());
  input.ipcMain.handle('axis-shell:syncAxisCliSkills', () => input.installer.syncSkills(false));
  input.ipcMain.handle('axis-shell:restoreAxisCliSkills', () => input.installer.syncSkills(true));
  input.ipcMain.handle('axis-shell:repairAxisCliPath', () => input.installer.repairPath());
  input.ipcMain.handle('axis-shell:getAxisCliManualInstallCommand', () => input.installer.getManualInstallCommand());
}
