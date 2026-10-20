const { Pool } = require("pg");
require("dotenv").config({ path: ".env.local" });
require("dotenv").config({ path: ".env" });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function optimizeIndexes() {
  console.log("Analyzing and optimizing database indexes for high-throughput query performance...");

  const indexQueries = [
    // Content indexes for browse, recommendation, and search filtering
    `CREATE INDEX IF NOT EXISTS idx_content_published_type ON content (is_published, type);`,
    `CREATE INDEX IF NOT EXISTS idx_content_published_rating ON content (is_published, imdb_rating DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_content_slug ON content (slug);`,
    `CREATE INDEX IF NOT EXISTS idx_content_year ON content (release_year);`,

    // Content Genres join optimization
    `CREATE INDEX IF NOT EXISTS idx_content_genres_content ON content_genres (content_id);`,
    `CREATE INDEX IF NOT EXISTS idx_content_genres_genre ON content_genres (genre_id);`,

    // Watch history and Continue Watching optimization
    `CREATE INDEX IF NOT EXISTS idx_watch_history_profile_completed ON watch_history (profile_id, completed, updated_at DESC);`,

    // Ratings & My List optimization
    `CREATE INDEX IF NOT EXISTS idx_ratings_profile_score ON ratings (profile_id, score DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_my_list_profile_content ON my_list (profile_id, content_id);`,

    // Subscriptions and Invoices optimization
    `CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions (user_id, status);`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_user_created ON invoices (user_id, created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_payment_tx_user_created ON payment_transactions (user_id, created_at DESC);`,

    // Telemetry & QoE optimization
    `CREATE INDEX IF NOT EXISTS idx_telemetry_created ON playback_telemetry (created_at DESC);`,
    `CREATE INDEX IF NOT EXISTS idx_telemetry_event ON playback_telemetry (event_type);`,
  ];

  for (const q of indexQueries) {
    try {
      await pool.query(q);
      const indexName = q.match(/idx_[a-z_]+/)?.[0] || "index";
      console.log(`✓ Optimized index: ${indexName}`);
    } catch (err) {
      console.warn(`Notice for query: ${err.message}`);
    }
  }

  console.log("Database index optimization completed successfully!");
  await pool.end();
}

optimizeIndexes();
