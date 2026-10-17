import pg from 'pg';

/** The CLI owns the owner role of the database (ADR-001 §2); the web gets a limited role later (MF-17, MF-20). */
export async function withPool<T>(url: string, work: (pool: pg.Pool) => Promise<T>): Promise<T> {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  try {
    return await work(pool);
  } finally {
    await pool.end();
  }
}
