import { drizzle } from "drizzle-orm/node-postgres";
import pkg from "pg";
const { Pool } = pkg;
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@127.0.0.1:5433/app_db",
});

const db = drizzle(pool);

async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

async function seed() {
  console.log("🌱 Seeding database...");

  // 1. Create or ensure admin user exists
  const adminHash = await hashPassword("Admin@123!");
  const adminResult = await pool.query(
    `INSERT INTO users (email, password_hash, role, plan, email_verified) 
     VALUES ($1, $2, 'admin', 'premium', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, plan = EXCLUDED.plan
     RETURNING id`,
    ["admin@streamvault.io", adminHash]
  );
  let adminId = adminResult.rows[0]?.id;
  if (!adminId) {
    const r = await pool.query("SELECT id FROM users WHERE email = $1", ["admin@streamvault.io"]);
    adminId = r.rows[0]?.id;
  }

  // 2. Create or ensure demo user exists
  const userHash = await hashPassword("User@123!");
  const userResult = await pool.query(
    `INSERT INTO users (email, password_hash, role, plan, email_verified) 
     VALUES ($1, $2, 'user', 'standard', true)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role, plan = EXCLUDED.plan
     RETURNING id`,
    ["user@streamvault.io", userHash]
  );
  let userId = userResult.rows[0]?.id;
  if (!userId) {
    const r = await pool.query("SELECT id FROM users WHERE email = $1", ["user@streamvault.io"]);
    userId = r.rows[0]?.id;
  }

  // 3. Create default profiles
  const profilesCount = await pool.query("SELECT COUNT(*) as count FROM profiles WHERE user_id = $1", [adminId]);
  if (parseInt(profilesCount.rows[0].count) === 0) {
    await pool.query(
      `INSERT INTO profiles (user_id, name, avatar_color, avatar_emoji) VALUES 
       ($1, 'Admin', '#E50914', '👑'),
       ($2, 'Alex', '#0080FF', '🎬'),
       ($3, 'Kids', '#FFD700', '🧸')`,
      [adminId, userId, userId]
    );
  }

  // 4. Create genres
  const genreData = [
    ["Action", "action"],
    ["Drama", "drama"],
    ["Comedy", "comedy"],
    ["Thriller", "thriller"],
    ["Sci-Fi", "sci-fi"],
    ["Horror", "horror"],
    ["Romance", "romance"],
    ["Documentary", "documentary"],
    ["Animation", "animation"],
    ["Crime", "crime"],
  ];

  const genreMap = {};
  for (const [name, slug] of genreData) {
    const res = await pool.query(
      "INSERT INTO genres (name, slug) VALUES ($1, $2) ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id",
      [name, slug]
    );
    genreMap[slug] = res.rows[0].id;
  }

  // 5. Create content catalog items
  const contentItems = [
    {
      title: "Monster: The Lizzie Borden Story",
      slug: "monster-the-lizzie-borden-story",
      description: "A chilling thriller following the mystery and shocking events surrounding Lizzie Borden.",
      type: "movie",
      release_year: 2024,
      maturity_rating: "R",
      duration: 110,
      backdrop_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1920&q=80",
      poster_url: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=500&q=80",
      video_key: "b2://Monster.The.Lizzie.Borden.Story.S01e01.Bloodbath.1080P.Nf.Web-Dl.Multi.Ddp5.1.Atmos.Hdr-Dv.H.265-4Khdhub.Com.mp4",
      hls_manifest_key: "b2://Monster.The.Lizzie.Borden.Story.S01e01.Bloodbath.1080P.Nf.Web-Dl.Multi.Ddp5.1.Atmos.Hdr-Dv.H.265-4Khdhub.Com.mp4",
      is_featured: true,
      cast: JSON.stringify(["Christina Ricci", "Clea DuVall"]),
      directors: JSON.stringify(["Nick Gomez"]),
      imdb_rating: 8.9,
      tags: JSON.stringify(["b2-cloud", "thriller", "drama", "crime"]),
      genres: ["thriller", "drama", "crime"],
    },
    {
      title: "Neon Horizon",
      slug: "neon-horizon",
      description: "In a dystopian future where corporations control everything, a rogue hacker uncovers a conspiracy that could change humanity forever.",
      type: "movie",
      release_year: 2024,
      maturity_rating: "R",
      duration: 128,
      backdrop_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80",
      poster_url: "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&q=80",
      video_key: "action",
      hls_manifest_key: "action",
      is_featured: true,
      cast: JSON.stringify(["Alex Storm", "Maya Chen", "Viktor Rowe"]),
      directors: JSON.stringify(["David Nakamura"]),
      imdb_rating: 8.2,
      tags: JSON.stringify(["cyberpunk", "hacker", "dystopia"]),
      genres: ["action", "sci-fi", "thriller"],
    },
    {
      title: "The Last Signal",
      slug: "the-last-signal",
      description: "When Earth receives a mysterious transmission from deep space, an unlikely team of scientists and soldiers must race against time to decode its meaning.",
      type: "movie",
      release_year: 2024,
      maturity_rating: "PG-13",
      duration: 142,
      backdrop_url: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80",
      poster_url: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=500&q=80",
      video_key: "default",
      hls_manifest_key: "default",
      is_featured: false,
      cast: JSON.stringify(["Elena Ross", "James Park"]),
      directors: JSON.stringify(["Sarah Chen"]),
      imdb_rating: 7.8,
      tags: JSON.stringify(["space", "aliens", "mystery"]),
      genres: ["sci-fi", "thriller"],
    },
    {
      title: "Crimson Tide Rising",
      slug: "crimson-tide-rising",
      description: "A brilliant but conflicted detective delves into the criminal underworld of Neo-Tokyo to solve a series of murders tied to a powerful yakuza syndicate.",
      type: "series",
      release_year: 2023,
      maturity_rating: "TV-MA",
      backdrop_url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80",
      poster_url: "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500&q=80",
      video_key: "drama",
      hls_manifest_key: "drama",
      is_featured: true,
      cast: JSON.stringify(["Kenji Tanaka", "Yuki Hashimoto"]),
      directors: JSON.stringify(["Hiroshi Moto"]),
      imdb_rating: 9.1,
      total_seasons: 2,
      tags: JSON.stringify(["crime", "neo-noir", "yakuza"]),
      genres: ["crime", "drama", "thriller"],
    },
    {
      title: "Marry My Husband",
      slug: "marry-my-husband",
      description: "A terminally ill woman gets a second chance at life when she is transported 10 years into the past to rewrite her fate.",
      type: "series",
      release_year: 2024,
      total_seasons: 1,
      poster_url: "/posters/Marry my husband.jpg",
      backdrop_url: "/posters/Marry my husband.jpg",
      video_key: "/videos/marry_my_husband.mp4",
      hls_manifest_key: "/videos/marry_my_husband.mp4",
      is_featured: true,
      cast: JSON.stringify(["Park Min-young", "Na In-woo", "Lee Yi-kyung", "Song Ha-yoon"]),
      directors: JSON.stringify(["Park Won-gook"]),
      imdb_rating: 9.2,
      tags: JSON.stringify(["kdrama", "romance", "revenge", "fantasy"]),
      genres: ["drama", "romance", "thriller"]
    },
  ];

  const contentMap = {};
  for (const item of contentItems) {
    const { genres: itemGenres, ...fields } = item;
    const cols = Object.keys(fields);
    const vals = Object.values(fields);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const colNames = cols.map(c => `"${c}"`).join(", ");
    const setClause = cols.filter(c => c !== 'slug').map(c => `"${c}" = EXCLUDED."${c}"`).join(", ");

    const res = await pool.query(
      `INSERT INTO content (${colNames}) VALUES (${placeholders}) ON CONFLICT (slug) DO UPDATE SET ${setClause} RETURNING id`,
      vals
    );
    const contentId = res.rows[0].id;
    contentMap[item.slug] = { id: contentId, genres: itemGenres };
  }

  // 6. Insert content-genre mappings
  for (const [slug, { id, genres: contentGenres }] of Object.entries(contentMap)) {
    for (const g of contentGenres) {
      if (genreMap[g]) {
        await pool.query(
          "INSERT INTO content_genres (content_id, genre_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
          [id, genreMap[g]]
        );
      }
    }
  }

  console.log("✅ Database seeded successfully!");
  await pool.end();
}

seed().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
