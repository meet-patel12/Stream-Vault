const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Applying profile table extensions...");
  await pool.query(`
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pin_hash VARCHAR(255);
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(20) NOT NULL DEFAULT 'en';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_audio VARCHAR(20) NOT NULL DEFAULT 'original';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_subtitle VARCHAR(20) NOT NULL DEFAULT 'off';
    ALTER TABLE profiles ADD COLUMN IF NOT EXISTS autoplay_previews BOOLEAN NOT NULL DEFAULT TRUE;
  `);
  console.log("✅ Profiles table migrated successfully!");
  await pool.end();
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  pool.end();
  process.exit(1);
});
