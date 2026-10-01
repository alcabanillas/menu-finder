import type pg from "pg";

/** Runs `work` in one transaction: every statement is kept, or none is. */
export async function inTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rows go in as one JSON parameter expanded by `jsonb_to_recordset`: one round
 * trip per table, and no value from the data is ever part of the SQL text.
 */
export const asJson = (rows: unknown[]): string => JSON.stringify(rows);
