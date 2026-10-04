import { describe, expect, it } from 'vitest';
import { describeDatabaseError } from '@/infrastructure/postgres/describe-database-error';

const driverError = (message: string, code?: string): Error => Object.assign(new Error(message), { code });

describe('describeDatabaseError', () => {
  it('says to run the migrations when a table does not exist', () => {
    const error = driverError('relation "menu" does not exist', '42P01');

    expect(describeDatabaseError(error)).toBe('relation "menu" does not exist (run `pnpm ingest migrate` first)');
  });

  it('says to run ingest menu first when a menu does not exist', () => {
    const error = Object.assign(
      new Error('insert or update on table "shopping_item" violates foreign key constraint'),
      { code: '23503', detail: 'Key (menu_number)=(7) is not present in table "menu".' },
    );

    expect(describeDatabaseError(error)).toBe('Menu 7 is not in the database (run `pnpm ingest menu` first)');
  });

  it('gives no migration hint for any other database error', () => {
    const error = driverError('duplicate key value violates unique constraint "menu_pkey"', '23505');

    expect(describeDatabaseError(error)).toBe('duplicate key value violates unique constraint "menu_pkey"');
  });

  it('removes the credentials of a connection string in the message', () => {
    const error = driverError('connect failed: postgresql://owner:s3cr3t@ep-x.neon.tech/neondb');

    expect(describeDatabaseError(error)).toBe('connect failed: postgresql://***@ep-x.neon.tech/neondb');
  });

  it('describes a thrown value that is not an Error', () => {
    expect(describeDatabaseError('socket hang up')).toBe('socket hang up');
  });
});
