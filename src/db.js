import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    }
  : {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "2408@Dvd",
      database: process.env.DB_NAME || "sales_db",
    };

const pool = new Pool(poolConfig);

export async function query(text, params = []) {
  const result = await pool.query(text, params);
  return { rows: result.rows };
}

export async function transaction(run) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const clientWrapper = {
      query: async (text, params = []) => {
        const result = await client.query(text, params);
        return { rows: result.rows };
      }
    };

    const result = await run(clientWrapper);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
