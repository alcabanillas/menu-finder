import { describe, expect, it } from 'vitest';
import { err, ok } from '@/shared/result';
import type { MigrationRunner } from '@/application/ports/migration-runner';
import { migrate } from '@/application/use-cases/migrate';

const fakeRunner = (available: string[], applied: string[], failing?: string) => {
  const calls: string[] = [];
  const done = [...applied];
  const runner: MigrationRunner = {
    available: async () => ok(available),
    applied: async () => ok([...done]),
    apply: async (id) => {
      calls.push(id);
      if (id === failing) return err({ kind: 'migration-failed', migration: id, reason: 'syntax error' });
      done.push(id);
      return ok(undefined);
    },
  };
  return { runner, calls };
};

describe('migrate', () => {
  it('applies the pending migrations in order', async () => {
    const { runner, calls } = fakeRunner(['002-b.sql', '001-a.sql', '003-c.sql'], ['001-a.sql']);

    expect(await migrate({ runner })).toEqual(ok({ applied: ['002-b.sql', '003-c.sql'] }));
    expect(calls).toEqual(['002-b.sql', '003-c.sql']);
  });

  it('applies nothing when every migration is applied', async () => {
    const { runner, calls } = fakeRunner(['001-a.sql'], ['001-a.sql']);

    expect(await migrate({ runner })).toEqual(ok({ applied: [] }));
    expect(calls).toEqual([]);
  });

  it('stops at the first failing migration and reports the ones applied before it', async () => {
    const { runner, calls } = fakeRunner(['001-a.sql', '002-b.sql', '003-c.sql'], [], '002-b.sql');

    expect(await migrate({ runner })).toEqual(
      err({ kind: 'migration-failed', migration: '002-b.sql', reason: 'syntax error', applied: ['001-a.sql'] }),
    );
    expect(calls).toEqual(['001-a.sql', '002-b.sql']);
  });

  it('reports a runner that cannot list the migrations', async () => {
    const runner: MigrationRunner = {
      available: async () => err({ kind: 'migration-failed', migration: null, reason: 'no folder' }),
      applied: async () => ok([]),
      apply: async () => ok(undefined),
    };

    expect(await migrate({ runner })).toEqual(
      err({ kind: 'migration-failed', migration: null, reason: 'no folder', applied: [] }),
    );
  });

  it('reports a database that cannot say which migrations are applied', async () => {
    const runner: MigrationRunner = {
      available: async () => ok(['001-a.sql']),
      applied: async () => err({ kind: 'migration-failed', migration: null, reason: 'connection refused' }),
      apply: async () => ok(undefined),
    };

    expect(await migrate({ runner })).toEqual(
      err({ kind: 'migration-failed', migration: null, reason: 'connection refused', applied: [] }),
    );
  });
});
