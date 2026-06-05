import { describe, expect, it } from 'vitest';
import type { AxisAppServer } from '@axis/app-server';
import type {
  SkillsStatusSnapshot,
  SkillsSyncSnapshot
} from '@axis/app-protocol';
import type { AxisSkillsSyncService } from '@axis/capability-runtime';
import { parseAxisArgs } from '../src/parser/parseAxisArgs';
import { runRuntimeCommand } from '../src/commands/runtimeCommands';
import { resolveCliAxisVersion } from '../src/runtime/createCliSkillsRuntime';

describe('axis skills CLI commands', () => {
  it('parses skills sync with --force as a boolean option', () => {
    const parsed = parseAxisArgs(['skills', 'sync', '--force']);

    expect(parsed.command).toBe('skills.sync');
    expect(parsed.options.force).toBe('true');
  });

  it('renders skills status records from the sync service', async () => {
    const result = await runRuntimeCommand(parseAxisArgs(['skills', 'status']), {
      skillsService: fakeSkillsService()
    });

    expect(result).toMatchObject({
      status: 'ok',
      command: 'skills.status',
      fields: {
        skills: 1,
        diagnostics: 0,
        source_root: '/home/user/.agents/skills',
        state_path: '/home/user/.axis/skills-state.json',
        axis_version: '1.2.3'
      }
    });
    expect(result.records).toContainEqual(expect.objectContaining({
      name: 'skill',
      fields: expect.objectContaining({ name: 'axis-core' })
    }));
  });

  it('renders sync updated, added, skipped, and force fields', async () => {
    const result = await runRuntimeCommand(parseAxisArgs(['skills', 'sync']), {
      skillsService: fakeSkillsService()
    });

    expect(result).toMatchObject({
      status: 'ok',
      command: 'skills.sync',
      fields: {
        updated: 1,
        added: 1,
        skipped_deleted: 1,
        force: false
      }
    });
    expect(result.records).toContainEqual(expect.objectContaining({ name: 'updated_skill' }));
    expect(result.records).toContainEqual(expect.objectContaining({ name: 'added_skill' }));
    expect(result.records).toContainEqual(expect.objectContaining({
      name: 'skipped_deleted_skill',
      fields: expect.objectContaining({ name: 'axis-example', reason: 'user_deleted' })
    }));
  });

  it('adds CLI-owned Skills status to runtime status output', async () => {
    const result = await runRuntimeCommand(parseAxisArgs(['runtime', 'status']), {
      server: {
        runtimeStatusForCli: async () => ({
          ok: true,
          imageModels: 2,
          availableImageModels: 1,
          videoModels: 1,
          availableVideoModels: 1,
          availableLlmModels: 1,
          diagnostics: 0
        })
      } as unknown as AxisAppServer,
      skillsService: fakeSkillsService()
    });

    expect(result).toMatchObject({
      status: 'ok',
      command: 'runtime.status',
      fields: {
        image_models: 2,
        available_image_models: 1,
        skills: 1,
        diagnostics: 0
      }
    });
  });

  it('adds CLI-owned Skills diagnostics to runtime doctor output', async () => {
    const result = await runRuntimeCommand(parseAxisArgs(['runtime', 'doctor']), {
      server: {
        runtimeDoctorForCli: async () => ({
          diagnostics: [{
            severity: 'warning',
            code: 'llm_model_not_configured',
            message: 'No available LLM model is configured.'
          }]
        })
      } as unknown as AxisAppServer,
      skillsService: fakeSkillsService({
        skills: [],
        bundledSkillsRoot: undefined,
        bundledRootAvailable: false,
        diagnostics: [{
          source: 'axis-sync',
          root: '/AXIS/skills',
          code: 'skills_bundle_unavailable',
          severity: 'warning',
          message: 'Bundled AXIS Skills are unavailable.'
        }]
      })
    });

    expect(result.status).toBe('ok');
    expect(result.fields).toEqual({ diagnostics: 3 });
    expect(result.records?.map((record) => record.fields.code)).toEqual([
      'llm_model_not_configured',
      'skills_bundle_unavailable',
      'skills_not_installed'
    ]);
  });

  it('reports Skills version drift in runtime doctor from local state', async () => {
    const originalCi = process.env.CI;
    process.env.CI = '1';
    try {
      const result = await runRuntimeCommand(parseAxisArgs(['runtime', 'doctor']), {
        server: {
          runtimeDoctorForCli: async () => ({ diagnostics: [] })
        } as unknown as AxisAppServer,
        skillsService: fakeSkillsService({
          state: staleSkillsState(),
          currentAxisVersion: '1.2.3'
        })
      });

      expect(result.records).toContainEqual(expect.objectContaining({
        name: 'diagnostic',
        fields: expect.objectContaining({
          code: 'skills_out_of_sync',
          severity: 'warning',
          message: expect.stringContaining('Run: axis skills sync')
        })
      }));
    } finally {
      restoreEnv('CI', originalCi);
    }
  });

  it('fails version resolution when package metadata is unavailable', async () => {
    await expect(resolveCliAxisVersion('/tmp/axis-cli-without-package/dist')).rejects.toThrow(/package metadata/i);
  });
});

function fakeSkillsService(overrides: Partial<SkillsStatusSnapshot> = {}): AxisSkillsSyncService {
  const status: SkillsStatusSnapshot = {
    sources: [{ source: 'shared-agents', root: '/home/user/.agents/skills' }],
    skills: [{
      name: 'axis-core',
      description: 'Core',
      source: 'shared-agents',
      root: '/home/user/.agents/skills',
      skillDir: '/home/user/.agents/skills/axis-core',
      skillPath: '/home/user/.agents/skills/axis-core/SKILL.md',
      axisVersion: '1.2.3'
    }],
    diagnostics: [],
    statePath: '/home/user/.axis/skills-state.json',
    currentAxisVersion: '1.2.3',
    sharedSkillsRoot: '/home/user/.agents/skills',
    bundledSkillsRoot: '/AXIS/skills',
    bundledRootAvailable: true,
    bundledSkills: ['axis-core', 'axis-image-director'],
    missingBundledSkills: ['axis-image-director'],
    missingBundledSkillCount: 1,
    skippedDeletedSkills: ['axis-example'],
    ...overrides
  };
  const sync: SkillsSyncSnapshot = {
    ...status,
    force: false,
    updatedSkills: status.skills,
    addedBundledSkills: [{
      ...status.skills[0]!,
      name: 'axis-image-director',
      description: 'Image Director'
    }],
    skippedDeletedSkills: ['axis-example']
  };
  return {
    status: async () => status,
    sync: async () => sync
  };
}

function staleSkillsState() {
  return {
    schemaVersion: 1 as const,
    axisVersion: '1.2.0',
    bundledSkills: ['axis-core'],
    updatedSkills: ['axis-core'],
    addedBundledSkills: [],
    skippedDeletedSkills: [],
    diagnostics: [],
    updatedAt: '2026-06-01T00:00:00.000Z'
  };
}

function restoreEnv(name: 'CI', value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }
  process.env[name] = value;
}
