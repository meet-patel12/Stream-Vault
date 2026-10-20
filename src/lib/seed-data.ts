import { db } from "@/db";
import {
  users,
  profiles,
  genres,
  content,
  contentGenres,
  episodes,
} from "@/db/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  // Check if already seeded
  const existingUsers = await db.select().from(users).limit(1);
  if (existingUsers.length > 0) return;

  console.log("🌱 Seeding database...");

  // ── Admin user ──────────────────────────────────────────────────────────────
  const adminHash = await hashPassword("Admin@123!");
  const [admin] = await db
    .insert(users)
    .values({
      email: "admin@streamvault.io",
      passwordHash: adminHash,
      role: "admin",
      plan: "premium",
      emailVerified: true,
    })
    .returning();

  // ── Demo user ───────────────────────────────────────────────────────────────
  const userHash = await hashPassword("User@123!");
  const [demoUser] = await db
    .insert(users)
    .values({
      email: "user@streamvault.io",
      passwordHash: userHash,
      role: "user",
      plan: "standard",
      emailVerified: true,
    })
    .returning();

  // ── Profiles ─────────────────────────────────────────────────────────────────
  await db.insert(profiles).values([
    { userId: admin.id, name: "Admin", avatarColor: "#E50914", avatarEmoji: "👑" },
    { userId: demoUser.id, name: "Alex", avatarColor: "#0080FF", avatarEmoji: "🎬" },
    { userId: demoUser.id, name: "Kids", avatarColor: "#FFD700", avatarEmoji: "🧸", isKids: true },
  ]);

  // ── Genres ───────────────────────────────────────────────────────────────────
  const genreData = [
    { name: "Action", slug: "action" },
    { name: "Drama", slug: "drama" },
    { name: "Comedy", slug: "comedy" },
    { name: "Thriller", slug: "thriller" },
    { name: "Sci-Fi", slug: "sci-fi" },
    { name: "Horror", slug: "horror" },
    { name: "Romance", slug: "romance" },
    { name: "Documentary", slug: "documentary" },
    { name: "Animation", slug: "animation" },
    { name: "Crime", slug: "crime" },
  ];

  const insertedGenres = await db.insert(genres).values(genreData).returning();
  const genreMap = Object.fromEntries(insertedGenres.map((g) => [g.slug, g.id]));

  // ── Content ──────────────────────────────────────────────────────────────────
  const contentData = [
    {
      title: "Neon Horizon",
      slug: "neon-horizon",
      description:
        "In a dystopian future where corporations control everything, a rogue hacker uncovers a conspiracy that could change humanity forever. With breathtaking visuals and non-stop action.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "R",
      duration: 128,
      backdropUrl:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1635805737707-575885ab0820?w=500&q=80",
      videoKey: "action",
      hlsManifestKey: "action",
      isFeatured: true,
      cast: ["Alex Storm", "Maya Chen", "Viktor Rowe"],
      directors: ["David Nakamura"],
      imdbRating: 8.2,
      tags: ["cyberpunk", "hacker", "dystopia"],
    },
    {
      title: "The Last Signal",
      slug: "the-last-signal",
      description:
        "When Earth receives a mysterious transmission from deep space, an unlikely team of scientists and soldiers must race against time to decode its meaning before it's too late.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "PG-13",
      duration: 142,
      backdropUrl:
        "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=500&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
      isFeatured: false,
      cast: ["Elena Ross", "James Park", "Dr. Amara Singh"],
      directors: ["Sarah Chen"],
      imdbRating: 7.8,
      tags: ["space", "aliens", "mystery"],
    },
    {
      title: "Crimson Tide Rising",
      slug: "crimson-tide-rising",
      description:
        "A brilliant but conflicted detective delves into the criminal underworld of Neo-Tokyo to solve a series of murders tied to a powerful yakuza syndicate.",
      type: "series" as const,
      releaseYear: 2023,
      maturityRating: "TV-MA",
      backdropUrl:
        "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1578328819058-b69f3a3b0f6b?w=500&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
      isFeatured: true,
      cast: ["Kenji Tanaka", "Yuki Hashimoto", "Carlos Reyes"],
      directors: ["Hiroshi Moto"],
      imdbRating: 9.1,
      totalSeasons: 2,
      tags: ["crime", "neo-noir", "yakuza"],
    },
    {
      title: "Parallel Lives",
      slug: "parallel-lives",
      description:
        "Five strangers discover they are living parallel lives across different dimensions. As their worlds collide, they must cooperate to prevent a catastrophic merge.",
      type: "series" as const,
      releaseYear: 2024,
      maturityRating: "TV-14",
      backdropUrl:
        "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1581822261290-991b38693d1b?w=500&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
      isFeatured: false,
      cast: ["Priya Sharma", "Tom Blake", "Sofia Marquez"],
      directors: ["Anna Fischer"],
      imdbRating: 8.6,
      totalSeasons: 1,
      tags: ["multiverse", "mystery", "drama"],
    },
    {
      title: "Wildfire Protocol",
      slug: "wildfire-protocol",
      description:
        "Elite special forces operators are sent on a classified mission deep into enemy territory. Based on true events, this gripping thriller pulls no punches.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "R",
      duration: 115,
      backdropUrl:
        "https://images.unsplash.com/photo-1569463823016-f7b84bf75b07?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=500&q=80",
      videoKey: "action",
      hlsManifestKey: "action",
      isFeatured: false,
      cast: ["Marcus Reed", "Zara Cole", "Bruno Dias"],
      directors: ["Ryan McAllister"],
      imdbRating: 7.5,
      tags: ["military", "action", "thriller"],
    },
    {
      title: "Laughter Therapy",
      slug: "laughter-therapy",
      description:
        "A lovably neurotic therapist accidentally swaps patient files with a renowned comedian, leading to the most chaotic—and heartwarming—therapy sessions ever recorded.",
      type: "movie" as const,
      releaseYear: 2023,
      maturityRating: "PG-13",
      duration: 98,
      backdropUrl:
        "https://images.unsplash.com/photo-1585238342024-78d387f4a707?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=500&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
      isFeatured: false,
      cast: ["Olivia Hart", "Ben Nguyen", "Rachel Kim"],
      directors: ["Mia Alvarez"],
      imdbRating: 7.2,
      tags: ["comedy", "romance", "feel-good"],
    },
    {
      title: "Deep Blue Silence",
      slug: "deep-blue-silence",
      description:
        "A marine biologist discovers a new species of deep-sea creature that appears to have extraordinary intelligence. As she studies it, she realizes it may be trying to communicate.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "PG-13",
      duration: 132,
      backdropUrl:
        "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=500&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
      isFeatured: false,
      cast: ["Luna Vasquez", "Dr. Hiroshi Yamamoto"],
      directors: ["James O'Brien"],
      imdbRating: 8.0,
      tags: ["ocean", "sci-fi", "mystery"],
    },
    {
      title: "The Algorithm",
      slug: "the-algorithm",
      description:
        "A whistleblower inside a tech giant exposes how their AI algorithm is secretly manipulating elections worldwide. A race against powerful forces ensues.",
      type: "series" as const,
      releaseYear: 2024,
      maturityRating: "TV-MA",
      backdropUrl:
        "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=500&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
      isFeatured: false,
      cast: ["Naomi Clarke", "Richard Frost", "Hannah Lee"],
      directors: ["Samuel Okafor"],
      imdbRating: 8.8,
      totalSeasons: 1,
      tags: ["tech", "thriller", "AI"],
    },
    {
      title: "Ghost Circuit",
      slug: "ghost-circuit",
      description:
        "A former NSA operative haunted by his past must infiltrate a ghost network run by international terrorists using stolen quantum encryption technology.",
      type: "movie" as const,
      releaseYear: 2023,
      maturityRating: "PG-13",
      duration: 119,
      backdropUrl:
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=500&q=80",
      videoKey: "action",
      hlsManifestKey: "action",
      isFeatured: false,
      cast: ["Derek Vance", "Irina Voronova", "Sage Okeke"],
      directors: ["Chris Yamamoto"],
      imdbRating: 7.7,
      tags: ["spy", "quantum", "thriller"],
    },
    {
      title: "Ember Falls",
      slug: "ember-falls",
      description:
        "Set against the sweeping landscapes of rural Montana, a story of love, loss, and redemption unfolds as two childhood sweethearts reunite after 20 years apart.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "PG",
      duration: 108,
      backdropUrl:
        "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=500&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
      isFeatured: false,
      cast: ["Claire Dawson", "Ethan Brooks"],
      directors: ["Lisa Wang"],
      imdbRating: 7.4,
      tags: ["romance", "drama", "countryside"],
    },
    {
      title: "Midnight Protocol",
      slug: "midnight-protocol",
      description:
        "Four strangers wake up in an abandoned research facility with no memory of how they got there. Together they must unravel the sinister experiments performed on them.",
      type: "movie" as const,
      releaseYear: 2024,
      maturityRating: "R",
      duration: 105,
      backdropUrl:
        "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=500&q=80",
      videoKey: "action",
      hlsManifestKey: "action",
      isFeatured: false,
      cast: ["Vera Stone", "Max Holden", "Cleo Pierce"],
      directors: ["Nathan Cross"],
      imdbRating: 7.9,
      tags: ["horror", "mystery", "survival"],
    },
    {
      title: "Cosmos Chronicles",
      slug: "cosmos-chronicles",
      description:
        "An animated series exploring the wonders of the universe through the eyes of a young astronaut and her AI companion as they travel to the far reaches of the galaxy.",
      type: "series" as const,
      releaseYear: 2024,
      maturityRating: "TV-G",
      backdropUrl:
        "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1920&q=80",
      posterUrl:
        "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?w=500&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
      isFeatured: false,
      cast: ["Voiced by: Aria Chen", "AXIOM"],
      directors: ["Animation Studio Nova"],
      imdbRating: 8.3,
      totalSeasons: 2,
      tags: ["space", "kids", "educational"],
    },
  ];

  const insertedContent = await db
    .insert(content)
    .values(contentData)
    .returning();

  // ── Content-Genre Mappings ─────────────────────────────────────────────────
  const mappings = [
    { slug: "neon-horizon", genres: ["action", "sci-fi", "thriller"] },
    { slug: "the-last-signal", genres: ["sci-fi", "thriller"] },
    { slug: "crimson-tide-rising", genres: ["crime", "drama", "thriller"] },
    { slug: "parallel-lives", genres: ["sci-fi", "drama", "thriller"] },
    { slug: "wildfire-protocol", genres: ["action", "thriller"] },
    { slug: "laughter-therapy", genres: ["comedy", "romance"] },
    { slug: "deep-blue-silence", genres: ["sci-fi", "drama"] },
    { slug: "the-algorithm", genres: ["thriller", "drama"] },
    { slug: "ghost-circuit", genres: ["action", "thriller"] },
    { slug: "ember-falls", genres: ["romance", "drama"] },
    { slug: "midnight-protocol", genres: ["horror", "thriller"] },
    { slug: "cosmos-chronicles", genres: ["animation", "sci-fi"] },
  ];

  const contentMap = Object.fromEntries(
    insertedContent.map((c) => [c.slug, c.id])
  );

  const contentGenreData = mappings.flatMap(({ slug, genres: gs }) =>
    gs.map((g) => ({
      contentId: contentMap[slug]!,
      genreId: genreMap[g]!,
    }))
  );

  await db.insert(contentGenres).values(contentGenreData);

  // ── Episodes for Series ───────────────────────────────────────────────────
  const crimsonId = contentMap["crimson-tide-rising"]!;
  await db.insert(episodes).values([
    {
      contentId: crimsonId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "The First Body",
      description: "Detective Kenji is called to investigate a gruesome murder in Neo-Tokyo's red light district.",
      duration: 52,
      thumbnailUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
    },
    {
      contentId: crimsonId,
      seasonNumber: 1,
      episodeNumber: 2,
      title: "Shadow Networks",
      description: "The investigation leads Kenji deep into the city's criminal underbelly.",
      duration: 48,
      thumbnailUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
    },
    {
      contentId: crimsonId,
      seasonNumber: 1,
      episodeNumber: 3,
      title: "The Yakuza's Daughter",
      description: "A shocking revelation about the syndicate's leadership changes everything.",
      duration: 55,
      thumbnailUrl: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=400&q=80",
      videoKey: "drama",
      hlsManifestKey: "drama",
    },
  ]);

  const parallelId = contentMap["parallel-lives"]!;
  await db.insert(episodes).values([
    {
      contentId: parallelId,
      seasonNumber: 1,
      episodeNumber: 1,
      title: "First Contact",
      description: "Five strangers experience identical dreams and begin to seek answers.",
      duration: 45,
      thumbnailUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
    },
    {
      contentId: parallelId,
      seasonNumber: 1,
      episodeNumber: 2,
      title: "The Merge",
      description: "Reality begins to blur as the dimensions start overlapping.",
      duration: 42,
      thumbnailUrl: "https://images.unsplash.com/photo-1419242902214-272b3f66ee7a?w=400&q=80",
      videoKey: "default",
      hlsManifestKey: "default",
    },
  ]);

  console.log("✅ Database seeded successfully!");
}
