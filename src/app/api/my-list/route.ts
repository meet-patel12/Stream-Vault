import { NextRequest } from "next/server";
import { db } from "@/db";
import { myList, profiles, content, contentGenres, genres } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionOrRefresh } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  validationErrorResponse,
  internalErrorResponse,
} from "@/lib/api-response";

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileId = parseInt(searchParams.get("profileId") ?? "0");

    if (!profileId) return validationErrorResponse("profileId is required.");

    const userId = parseInt(session.sub);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    const list = await db
      .select()
      .from(myList)
      .where(eq(myList.profileId, profileId))
      .orderBy(myList.addedAt);

    const contentIds = list.map((l) => l.contentId);

    if (contentIds.length === 0) {
      return successResponse([]);
    }

    const contentItems = await db
      .select()
      .from(content)
      .where(inArray(content.id, contentIds));

    const genreJoins = await db
      .select({
        contentId: contentGenres.contentId,
        genreId: genres.id,
        genreName: genres.name,
        genreSlug: genres.slug,
      })
      .from(contentGenres)
      .innerJoin(genres, eq(contentGenres.genreId, genres.id))
      .where(inArray(contentGenres.contentId, contentIds));

    const genresByContent = genreJoins.reduce<
      Record<number, { id: number; name: string; slug: string }[]>
    >((acc, row) => {
      if (!acc[row.contentId]) acc[row.contentId] = [];
      acc[row.contentId].push({ id: row.genreId, name: row.genreName, slug: row.genreSlug });
      return acc;
    }, {});

    const enriched = contentItems.map((item) => ({
      ...item,
      genres: genresByContent[item.id] ?? [],
    }));

    return successResponse(enriched);
  } catch (err) {
    console.error("My list get error:", err);
    return internalErrorResponse();
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const body = await request.json();
    const { profileId, contentId } = body;

    if (!profileId || !contentId) {
      return validationErrorResponse("profileId and contentId are required.");
    }

    const userId = parseInt(session.sub);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    // Check if already in list
    const existing = await db
      .select({ id: myList.id })
      .from(myList)
      .where(
        and(eq(myList.profileId, profileId), eq(myList.contentId, contentId))
      )
      .limit(1);

    if (existing.length > 0) {
      return errorResponse("Already in list.", 409, "ALREADY_IN_LIST");
    }

    await db.insert(myList).values({ profileId, contentId });

    return successResponse({ added: true }, 201);
  } catch (err) {
    console.error("My list add error:", err);
    return internalErrorResponse();
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionOrRefresh();
    if (!session) return unauthorizedResponse();

    const { searchParams } = new URL(request.url);
    const profileId = parseInt(searchParams.get("profileId") ?? "0");
    const contentId = parseInt(searchParams.get("contentId") ?? "0");

    if (!profileId || !contentId) {
      return validationErrorResponse("profileId and contentId are required.");
    }

    const userId = parseInt(session.sub);
    const [profile] = await db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.userId, userId)))
      .limit(1);

    if (!profile) return unauthorizedResponse("Profile not found.");

    await db
      .delete(myList)
      .where(
        and(eq(myList.profileId, profileId), eq(myList.contentId, contentId))
      );

    return successResponse({ removed: true });
  } catch (err) {
    console.error("My list remove error:", err);
    return internalErrorResponse();
  }
}
