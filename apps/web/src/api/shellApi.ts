import type {
  AxisCliInstallResult,
  AxisCliManualCommand,
  AxisCliPathRepairResult,
  AxisCliSkillsSyncResult,
  AxisCliStatus
} from '@axis/app-protocol';

export interface AxisShellApi {
  chooseProjectRoot(): Promise<string | undefined>;
  bindProjectWindowToProject?(input: { projectId: string }): Promise<{ ok: true }>;
  revealProjectPathInSystemFileManager?(input: { projectId: string; projectRelativePath: string; kind: 'file' | 'directory' }): Promise<{ ok: true }>;
  getAxisCliStatus?(): Promise<AxisCliStatus>;
  installAxisCli?(): Promise<AxisCliInstallResult>;
  updateAxisCli?(): Promise<AxisCliInstallResult>;
  syncAxisCliSkills?(): Promise<AxisCliSkillsSyncResult>;
  restoreAxisCliSkills?(): Promise<AxisCliSkillsSyncResult>;
  repairAxisCliPath?(): Promise<AxisCliPathRepairResult>;
  getAxisCliManualInstallCommand?(): Promise<AxisCliManualCommand>;
}

export function getAxisShellApi(): AxisShellApi | undefined {
  return typeof window === 'undefined' ? undefined : window.axisShell;
}
