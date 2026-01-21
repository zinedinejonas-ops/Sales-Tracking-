import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: "localhost",
  port: 3306,
  user: "root",
  password: "2408@Dvd",
  database: "sales_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return { rows };
}

export async function transaction(run) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const client = {
      query: async (sql, params = []) => {
        const [rows] = await conn.execute(sql, params);
        return { rows };
      }
    };

    const result = await run(client);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
