import { describe, expect, it } from 'vitest';
import { axisCliExecutionCommand } from '../apps/desktop/src/electron/axisCliProcess';

describe('Desktop Axis CLI process runner', () => {
  it('dispatches Windows cmd shims through cmd.exe instead of executing them directly', () => {
    const execution = axisCliExecutionCommand({
      axisPath: 'C:\\Users\\me\\.axis\\bin\\axis.cmd',
      args: ['skills', 'sync'],
      platform: 'win32',
      comSpec: 'C:\\Windows\\System32\\cmd.exe'
    });

    expect(execution).toEqual({
      executablePath: 'C:\\Windows\\System32\\cmd.exe',
      args: ['/d', '/s', '/c', 'call "C:\\Users\\me\\.axis\\bin\\axis.cmd" "skills" "sync"']
    });
  });

  it('executes native binaries directly', () => {
    expect(axisCliExecutionCommand({
      axisPath: 'C:\\Users\\me\\.axis\\cli\\0.2.0\\axis.exe',
      args: ['--version'],
      platform: 'win32'
    })).toEqual({
      executablePath: 'C:\\Users\\me\\.axis\\cli\\0.2.0\\axis.exe',
      args: ['--version']
    });
    expect(axisCliExecutionCommand({
      axisPath: '/Users/me/.axis/bin/axis',
      args: ['--version'],
      platform: 'darwin'
    })).toEqual({
      executablePath: '/Users/me/.axis/bin/axis',
      args: ['--version']
    });
  });
});
