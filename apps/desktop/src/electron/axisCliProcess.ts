import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface AxisCliRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface AxisCliExecutionInput {
  axisPath: string;
  args: string[];
  platform?: NodeJS.Platform;
  comSpec?: string;
}

export interface AxisCliExecutionCommand {
  executablePath: string;
  args: string[];
}

export async function runAxisCli(axisPath: string, args: string[], timeoutMs = 30_000): Promise<AxisCliRunResult> {
  const execution = axisCliExecutionCommand({ axisPath, args });
  try {
    const result = await execFileAsync(execution.executablePath, execution.args, { timeout: timeoutMs });
    return { stdout: result.stdout, stderr: result.stderr, exitCode: 0 };
  } catch (error) {
    const failed = error as NodeJS.ErrnoException & { stdout?: string; stderr?: string; code?: number | string };
    return {
      stdout: failed.stdout ?? '',
      stderr: failed.stderr ?? failed.message,
      exitCode: typeof failed.code === 'number' ? failed.code : 1
    };
  }
}

export function axisCliExecutionCommand(input: AxisCliExecutionInput): AxisCliExecutionCommand {
  const platform = input.platform ?? process.platform;
  if (platform === 'win32' && /\.(?:cmd|bat)$/i.test(input.axisPath)) {
    return {
      executablePath: input.comSpec ?? process.env.ComSpec ?? process.env.COMSPEC ?? 'cmd.exe',
      args: ['/d', '/s', '/c', windowsCmdInvocation(input.axisPath, input.args)]
    };
  }
  return {
    executablePath: input.axisPath,
    args: input.args
  };
}

function windowsCmdInvocation(axisPath: string, args: string[]): string {
  return ['call', quoteWindowsCmdArgument(axisPath), ...args.map(quoteWindowsCmdArgument)].join(' ');
}

function quoteWindowsCmdArgument(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}
