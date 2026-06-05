import electron from 'electron';
import type {
  AxisCliInstallResult,
  AxisCliManualCommand,
  AxisCliPathRepairResult,
  AxisCliSkillsSyncResult,
  AxisCliStatus
} from '@axis/app-protocol';

const { contextBridge, ipcRenderer } = electron;

interface AxisShellApi {
  chooseProjectRoot(): Promise<string | undefined>;
  bindProjectWindowToProject(input: { projectId: string }): Promise<{ ok: true }>;
  revealProjectPathInSystemFileManager(input: { projectId: string; projectRelativePath: string; kind: 'file' | 'directory' }): Promise<{ ok: true }>;
  getAxisCliStatus(): Promise<AxisCliStatus>;
  installAxisCli(): Promise<AxisCliInstallResult>;
  updateAxisCli(): Promise<AxisCliInstallResult>;
  syncAxisCliSkills(): Promise<AxisCliSkillsSyncResult>;
  restoreAxisCliSkills(): Promise<AxisCliSkillsSyncResult>;
  repairAxisCliPath(): Promise<AxisCliPathRepairResult>;
  getAxisCliManualInstallCommand(): Promise<AxisCliManualCommand>;
}

const axisShellApi: AxisShellApi = {
  chooseProjectRoot: () => ipcRenderer.invoke('axis-shell:chooseProjectRoot') as Promise<string | undefined>,
  bindProjectWindowToProject: (input) => (
    ipcRenderer.invoke('axis-shell:bindProjectWindowToProject', input) as Promise<{ ok: true }>
  ),
  revealProjectPathInSystemFileManager: (input) => (
    ipcRenderer.invoke('axis-shell:revealProjectPathInSystemFileManager', input) as Promise<{ ok: true }>
  ),
  getAxisCliStatus: () => ipcRenderer.invoke('axis-shell:getAxisCliStatus') as Promise<AxisCliStatus>,
  installAxisCli: () => ipcRenderer.invoke('axis-shell:installAxisCli') as Promise<AxisCliInstallResult>,
  updateAxisCli: () => ipcRenderer.invoke('axis-shell:updateAxisCli') as Promise<AxisCliInstallResult>,
  syncAxisCliSkills: () => ipcRenderer.invoke('axis-shell:syncAxisCliSkills') as Promise<AxisCliSkillsSyncResult>,
  restoreAxisCliSkills: () => ipcRenderer.invoke('axis-shell:restoreAxisCliSkills') as Promise<AxisCliSkillsSyncResult>,
  repairAxisCliPath: () => ipcRenderer.invoke('axis-shell:repairAxisCliPath') as Promise<AxisCliPathRepairResult>,
  getAxisCliManualInstallCommand: () => ipcRenderer.invoke('axis-shell:getAxisCliManualInstallCommand') as Promise<AxisCliManualCommand>
};

contextBridge.exposeInMainWorld('axisShell', axisShellApi);
