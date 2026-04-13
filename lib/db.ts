import mysql from "mysql2/promise";

let pool: mysql.Pool | null = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASSWORD || "",
      database: process.env.DB_NAME || "speed_test",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });
  }

  return pool;
}

export async function ensureSpeedResultsTable() {
  const db = getPool();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS speed_results (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ping INT NOT NULL,
      download DECIMAL(10,2) NOT NULL,
      upload DECIMAL(10,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function saveSpeedResult(ping: number, download: number, upload: number) {
  const db = getPool();
  await ensureSpeedResultsTable();
  await db.execute(
    "INSERT INTO speed_results (ping, download, upload) VALUES (?, ?, ?)",
    [ping, download, upload]
  );
}

export type SpeedHistoryRow = {
  id: number;
  ping: number;
  download: number;
  upload: number;
  created_at: string;
};

export async function getSpeedHistory(limit = 10) {
  const db = getPool();
  await ensureSpeedResultsTable();
  const [rows] = await db.query(
    "SELECT id, ping, download, upload, created_at FROM speed_results ORDER BY id DESC LIMIT ?",
    [limit]
  );

  return rows as SpeedHistoryRow[];
}
