const test = require("node:test");
const assert = require("node:assert/strict");
const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

test("Integration: Verifies PostgreSQL connection and all 16 platform tables", async () => {
  const result = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);

  const tables = result.rows.map((r) => r.table_name);
  console.log("Verified Live PostgreSQL Tables:", tables.length);

  const requiredTables = [
    "users",
    "profiles",
    "content",
    "genres",
    "content_genres",
    "episodes",
    "watch_history",
    "my_list",
    "ratings",
    "playback_telemetry",
    "encoding_jobs",
    "subscriptions",
    "coupons",
    "invoices",
    "payment_transactions",
    "playlists",
    "playlist_items",
    "offline_downloads",
    "notifications",
    "user_devices",
    "login_history",
  ];

  for (const table of requiredTables) {
    assert.ok(
      tables.includes(table),
      `Expected table '${table}' to exist in PostgreSQL database`
    );
  }

  await pool.end();
});
