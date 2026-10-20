const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  console.log("Connecting to PostgreSQL database for Phases 8-14 schema migration...");

  try {
    // 1. Playlists table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        type VARCHAR(50) NOT NULL DEFAULT 'custom',
        is_public BOOLEAN NOT NULL DEFAULT false,
        share_token VARCHAR(100) UNIQUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ 'playlists' table ready.");

    // 2. Playlist items table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlist_items (
        id SERIAL PRIMARY KEY,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        position INTEGER NOT NULL DEFAULT 0,
        added_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_playlist_content UNIQUE (playlist_id, content_id)
      );
    `);
    console.log("✓ 'playlist_items' table ready.");

    // 3. Offline downloads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS offline_downloads (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
        episode_id INTEGER REFERENCES episodes(id) ON DELETE CASCADE,
        quality VARCHAR(20) NOT NULL DEFAULT '1080p',
        file_size_bytes BIGINT NOT NULL DEFAULT 0,
        storage_path TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'completed',
        expires_at TIMESTAMP,
        downloaded_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ 'offline_downloads' table ready.");

    // 4. Notifications table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        profile_id INTEGER REFERENCES profiles(id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type VARCHAR(50) NOT NULL DEFAULT 'system',
        action_url VARCHAR(500),
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ 'notifications' table ready.");

    // 5. User Devices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_devices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        device_name VARCHAR(255) NOT NULL,
        device_type VARCHAR(50) NOT NULL DEFAULT 'desktop',
        ip_address VARCHAR(64),
        user_agent TEXT,
        last_active_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_current BOOLEAN NOT NULL DEFAULT false,
        is_revoked BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ 'user_devices' table ready.");

    // 6. Login History table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS login_history (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ip_address VARCHAR(64),
        location VARCHAR(255),
        user_agent TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'success',
        attempted_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    console.log("✓ 'login_history' table ready.");

    // 7. Alter Users table for 2FA and Token Rotation
    await pool.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255),
      ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS two_factor_backup_codes TEXT,
      ADD COLUMN IF NOT EXISTS refresh_token_version INTEGER NOT NULL DEFAULT 1;
    `);
    console.log("✓ 'users' table columns for 2FA & token rotation ready.");

    console.log("All Phase 8-14 schema migrations completed successfully!");
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    await pool.end();
    process.exit(1);
  }
}

migrate();
